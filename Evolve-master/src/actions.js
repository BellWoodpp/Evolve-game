import { global, save, seededRandom, webWorker, keyMultiplier, keyMap, srSpeak, sizeApproximation, p_on, support_on, int_on, gal_on, spire_on, tmp_vars, setupStats, callback_queue, isMainTabActive, getMainTabIndex } from './vars.js';
import { loc } from './locale.js';
import { timeCheck, timeFormat, vBind, popover, clearPopper, flib, tagEvent, clearElement, costMultiplier, darkEffect, genCivName, powerModifier, powerCostMod, calcPrestige, adjustCosts, modRes, messageQueue, buildQueue, updateQueueBadges, format_emblem, shrineBonusActive, calc_mastery, calcPillar, calcGenomeScore, getShrineBonus, eventActive, easterEgg, getHalloween, trickOrTreat, deepClone, hoovedRename, get_qlevel } from './functions.js';
import { unlockAchieve, challengeIcon, alevel, universeAffix, checkAdept } from './achieve.js';
import { races, traits, genus_def, neg_roll_traits, randomMinorTrait, cleanAddTrait, combineTraits, biomes, planetTraits, setJType, altRace, setTraitRank, setImitation, shapeShift, basicRace, fathomCheck, traitCostMod, renderSupernatural, blubberFill, traitRank } from './races.js';
import { defineResources, unlockCrates, unlockContainers, crateValue, containerValue, galacticTrade, spatialReasoning, resource_values, initResourceTabs, marketItem, containerItem, tradeSummery, faithBonus, templePlasmidBonus, faithTempleCount, breakdownPopover } from './resources.js';
import { loadFoundry, defineJobs, jobScale, workerScale, job_desc, dockArmyPanelToCityDistricts } from './jobs.js';
import { loadIndustry, defineIndustry, nf_resources, gridDefs, addSmelter, cancelRituals } from './industry.js';
import { defineGovernment, defineGarrison, buildGarrison, commisionGarrison, foreignGov, armyRating, garrisonSize, govEffect } from './civics.js';
import { spaceTech, interstellarTech, galaxyTech, incrementStruct, universe_affixes, renderSpace, piracy, fuel_adjust, isStargateOn } from './space.js';
import { renderFortress, fortressTech, warlordSetup } from './portal.js';
import { edenicTech, renderEdenic } from './edenic.js';
import { tauCetiTech, renderTauCeti, loneSurvivor } from './truepath.js';
import { arpa, gainGene, gainBlood } from './arpa.js';
import { production, highPopAdjust } from './prod.js';
import { techList, techPath } from './tech.js';
import { defineGovernor, govActive, removeTask, gov_tasks } from './governor.js';
import { bioseed } from './resets.js';
import { initTabs, refreshTopBarAndResearchToggle, updateEvolutionBgm } from './index.js';

let sentienceSelecting = false;
let sentiencePendingCosts = null;
let sentiencePendingAllowed = null;
let sentienceAutoScroll = false;
const evolutionBranchLock = {
    species: 'pinguicula',
    actions: new Set([
        'rna',
        'dna',
        'membrane',
        'organelles',
        'nucleus',
        'eukaryotic_cell',
        'mitochondria',
        'sexual_reproduction',
        'chloroplasts',
        'multicellular',
        'poikilohydric',
        'bryophyte',
        'sentience',
        'pinguicula'
    ])
};

const actionImageUrlCache = {};
const actionImageLoadState = {};
const actionUnlockSeenByContext = new Map();
const actionUnlockReadyContexts = new Set();
const actionUnlockReadyScheduled = new Set();

function getUnlockSeenSet(contextKey){
    let seen = actionUnlockSeenByContext.get(contextKey);
    if (!seen){
        seen = new Set();
        actionUnlockSeenByContext.set(contextKey, seen);
    }
    return seen;
}

function scheduleUnlockContextReady(contextKey){
    if (actionUnlockReadyContexts.has(contextKey) || actionUnlockReadyScheduled.has(contextKey)){
        return;
    }
    actionUnlockReadyScheduled.add(contextKey);
    setTimeout(() => {
        actionUnlockReadyContexts.add(contextKey);
        actionUnlockReadyScheduled.delete(contextKey);
    }, 0);
}

function isEvolutionActionAllowed(actionKey){
    if (!evolutionBranchLock || !evolutionBranchLock.actions){
        return true;
    }
    return evolutionBranchLock.actions.has(actionKey);
}

function resolveActionBackgroundUrl(className){
    if (!className || typeof document === 'undefined'){
        return '';
    }
    if (global.evolution && global.evolution.iconCache && global.evolution.iconCache[className]){
        return global.evolution.iconCache[className];
    }
    if (Object.prototype.hasOwnProperty.call(actionImageUrlCache, className)){
        return actionImageUrlCache[className];
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'action';
    wrapper.style.position = 'absolute';
    wrapper.style.visibility = 'hidden';
    wrapper.style.pointerEvents = 'none';
    const probe = document.createElement('a');
    probe.className = `button is-dark ${className}`;
    wrapper.appendChild(probe);
    const mount = document.querySelector('.main .content') || document.querySelector('#evolution') || document.body || document.documentElement;
    mount.appendChild(wrapper);
    const backgroundImage = window.getComputedStyle(probe).backgroundImage || '';
    wrapper.remove();
    const match = /url\(["']?(.*?)["']?\)/.exec(backgroundImage);
    const url = match && match[1] ? match[1] : '';
    if (url){
        actionImageUrlCache[className] = url;
    }
    return url;
}

function buildActionImageProgress(loaded, total, lengthComputable, status, previous){
    const safeLoaded = Number.isFinite(loaded) ? loaded : 0;
    const safeTotal = Number.isFinite(total) ? total : 0;
    const canCompute = Boolean(lengthComputable) && safeTotal > 0;
    let progress = canCompute ? safeLoaded / safeTotal : 0;
    if (previous && previous.lengthComputable && canCompute){
        progress = Math.max(previous.progress, progress);
    }
    return {
        loaded: safeLoaded,
        total: safeTotal,
        lengthComputable: canCompute,
        progress: Math.min(1, Math.max(0, progress)),
        status
    };
}

function preloadActionBackgroundImage(className, onProgress){
    const url = resolveActionBackgroundUrl(className);
    if (!url || typeof Image === 'undefined'){
        if (onProgress){
            onProgress(buildActionImageProgress(0, 0, false, 'missing'));
        }
        return Promise.resolve('missing');
    }
    const cached = actionImageLoadState[className];
    if (cached){
        if (onProgress){
            const progress = cached.progress
                || (cached.status === 'loaded'
                    ? buildActionImageProgress(1, 1, true, 'loaded')
                    : buildActionImageProgress(0, 0, false, cached.status));
            onProgress(progress);
            if (cached.status === 'loading' && cached.listeners){
                cached.listeners.add(onProgress);
            }
        }
        if (cached.status === 'loaded' || cached.status === 'error'){
            return Promise.resolve(cached.status);
        }
        return cached.promise;
    }
    const listeners = new Set();
    if (onProgress){
        listeners.add(onProgress);
    }
    const state = {
        status: 'loading',
        promise: null,
        progress: buildActionImageProgress(0, 0, false, 'loading'),
        listeners
    };
    actionImageLoadState[className] = state;

    const notifyProgress = (progress) => {
        state.progress = progress;
        if (state.listeners){
            state.listeners.forEach((listener) => listener(progress));
        }
    };

    const finalize = (status) => {
        state.status = status;
        if (status === 'loaded'){
            notifyProgress(buildActionImageProgress(1, 1, true, 'loaded', state.progress));
        }
        else {
            notifyProgress({ ...state.progress, status });
        }
        if (state.listeners){
            state.listeners.clear();
            state.listeners = null;
        }
        return status;
    };

    const promise = new Promise((resolve) => {
        let settled = false;
        const finalizeOnce = (status) => {
            if (settled){
                return;
            }
            settled = true;
            resolve(finalize(status));
        };
        const loadViaImage = () => {
            if (settled){
                return;
            }
            const img = new Image();
            img.onload = () => finalizeOnce('loaded');
            img.onerror = () => finalizeOnce('error');
            img.src = url;
            if (img.complete){
                finalizeOnce(img.naturalWidth > 0 ? 'loaded' : 'error');
            }
        };
        if (typeof XMLHttpRequest !== 'undefined'){
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.onprogress = (evt) => {
                notifyProgress(buildActionImageProgress(
                    evt.loaded,
                    evt.total,
                    evt.lengthComputable,
                    'loading',
                    state.progress
                ));
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300){
                    finalizeOnce('loaded');
                }
                else {
                    loadViaImage();
                }
            };
            xhr.onerror = () => loadViaImage();
            xhr.send();
        }
        else {
            loadViaImage();
        }
    });
    state.promise = promise;
    notifyProgress(state.progress);
    return promise;
}

function isActionImageLoaded(className){
    return actionImageLoadState[className] && actionImageLoadState[className].status === 'loaded';
}

function getActionImageClass(classValue){
    if (!classValue){
        return '';
    }
    const classList = classValue.split(/\s+/).filter(Boolean);
    for (const name of classList){
        if (resolveActionBackgroundUrl(name)){
            return name;
        }
    }
    return '';
}

function ensureUnlockProgressElement(button){
    if (!button || !button.length){
        return $();
    }
    let progress = button.find('.unlock-progress');
    if (!progress.length){
        button.append('<span class="unlock-progress" aria-hidden="true"><span class="unlock-progress-bar"></span></span>');
        progress = button.find('.unlock-progress');
    }
    return progress;
}

function setUnlockProgressValue(progressElement, value){
    if (!progressElement || !progressElement.length){
        return;
    }
    const clamped = Math.min(1, Math.max(0, value));
    const bar = progressElement.find('.unlock-progress-bar');
    if (bar.length){
        const barNode = bar.get(0);
        if (barNode){
            barNode.style.width = `${(clamped * 100).toFixed(2)}%`;
        }
    }
}

function cleanupUnlockingState(actionId){
    if (!actionId){
        return;
    }
    const current = $(`#${actionId}`);
    if (!current.length){
        return;
    }
    current.removeClass('is-unlocking');
    current.find('a.button').removeAttr('data-unlocking-label');
    current.find('.unlock-progress').remove();
    const node = current.get(0);
    if (node){
        node.style.removeProperty('--unlock-progress');
    }
}

function scheduleUnlockCleanup(actionId, progressElement){
    if (!actionId){
        return;
    }
    const bar = progressElement && progressElement.length ? progressElement.find('.unlock-progress-bar') : $();
    if (!bar.length || typeof window === 'undefined'){
        cleanupUnlockingState(actionId);
        return;
    }
    let done = false;
    const finish = () => {
        if (done){
            return;
        }
        done = true;
        cleanupUnlockingState(actionId);
    };
    bar.one('transitionend', finish);
    const node = bar.get(0);
    if (!node){
        finish();
        return;
    }
    const durationValue = window.getComputedStyle(node).transitionDuration || '0s';
    const duration = parseFloat(durationValue.split(',')[0]) || 0;
    if (duration <= 0){
        finish();
        return;
    }
    setTimeout(finish, duration * 1000 + 50);
}

function applyActionUnlockingState(parent, button, imageClass){
    if (!imageClass || !button || !button.length){
        return;
    }
    const actionId = parent.attr('id');
    parent.addClass('is-unlocking');
    button.attr('data-unlocking-label', loc('status_unlocking'));
    const progressElement = ensureUnlockProgressElement(button);
    progressElement.addClass('is-animated');
    let displayProgress = 0;
    const applyProgress = (value) => {
        if (!Number.isFinite(value)){
            return;
        }
        displayProgress = Math.max(displayProgress, value);
        setUnlockProgressValue(progressElement, displayProgress);
    };
    applyProgress(0);
    let hasRealProgress = false;
    const handleProgress = (progress) => {
        if (!progress || !progress.lengthComputable){
            return;
        }
        const value = Number.isFinite(progress.progress) ? progress.progress : 0;
        if (value < 1){
            hasRealProgress = true;
            progressElement.removeClass('is-animated');
            applyProgress(value);
            return;
        }
        if (hasRealProgress){
            progressElement.removeClass('is-animated');
            applyProgress(1);
        }
    };
    const startLoad = () => {
        preloadActionBackgroundImage(imageClass, handleProgress).then(() => {
            if (!actionId){
                return;
            }
            if (typeof requestAnimationFrame !== 'undefined'){
                requestAnimationFrame(() => {
                    progressElement.removeClass('is-animated');
                    applyProgress(1);
                    scheduleUnlockCleanup(actionId, progressElement);
                });
            }
            else {
                progressElement.removeClass('is-animated');
                applyProgress(1);
                scheduleUnlockCleanup(actionId, progressElement);
            }
        });
    };
    if (typeof requestAnimationFrame !== 'undefined'){
        requestAnimationFrame(startLoad);
    }
    else {
        startLoad();
    }
}

export function preloadEvolutionActionImage(actionKey){
    const action = actions?.evolution?.[actionKey];
    if (!action || !action.class){
        return;
    }
    const classValue = typeof action.class === 'function' ? action.class() : action.class;
    if (!classValue){
        return;
    }
    const className = getActionImageClass(classValue) || classValue.split(/\s+/)[0];
    if (!className){
        return;
    }
    preloadActionBackgroundImage(className);
}

function showFullBadge(actionId){
    const action = $(`#${actionId}`);
    if (!action.length){
        return;
    }
    let badge = action.find('.full-badge');
    if (!badge.length){
        badge = $(`<span class="full-badge">${loc('status_full')}</span>`);
        action.append(badge);
    }
    action.addClass('show-full-badge');
    const timer = action.data('fullBadgeTimer');
    if (timer){
        clearTimeout(timer);
    }
    action.data('fullBadgeTimer', setTimeout(() => {
        action.removeClass('show-full-badge');
    }, 900));
}

function showInsufficientBadge(actionId){
    const action = $(`#${actionId}`);
    if (!action.length){
        return;
    }
    let badge = action.find('.insufficient-badge');
    if (!badge.length){
        badge = $(`<span class="insufficient-badge">${loc('status_insufficient')}</span>`);
        action.append(badge);
    }
    action.addClass('show-insufficient-badge');
    const timer = action.data('insufficientBadgeTimer');
    if (timer){
        clearTimeout(timer);
    }
    action.data('insufficientBadgeTimer', setTimeout(() => {
        action.removeClass('show-insufficient-badge');
    }, 900));
}

function showResourceFullBadge(c_action){
    const actionId = getActionId(c_action);
    if (!actionId){
        return false;
    }
    const resourceMap = {
        'city-food': 'Food',
        'city-lumber': 'Lumber',
        'city-stone': 'Stone',
        'city-chrysotile': 'Chrysotile'
    };
    const resName = resourceMap[actionId];
    if (!resName || !global.resource || !global.resource[resName]){
        return false;
    }
    const resource = global.resource[resName];
    if (resource.max >= 0 && resource.max !== -1 && resource.amount >= resource.max){
        showFullBadge(actionId);
        return true;
    }
    return false;
}

export function updateAffordableCountBadge(actionId, count){
    const action = $(`#${actionId}`);
    if (!action.length){
        return;
    }
    let badge = action.find('.afford-count-badge');
    if (!badge.length){
        badge = $('<span class="afford-count-badge"></span>');
        action.append(badge);
    }
    if (count && count > 0){
        badge.text(count);
        action.addClass('show-afford-count');
    }
    else {
        action.removeClass('show-afford-count');
    }
}

export function calcAffordableCount(c_action, type){
    if (!c_action || !c_action.cost){
        return 0;
    }
    let costs = type !== 'genes' && type !== 'blood' ? adjustCosts(c_action) : c_action.cost;
    let maxCount = Infinity;
    let hasCost = false;
    let invalid = false;

    Object.keys(costs).forEach(function (res){
        let cost = Number(costs[res]()) || 0;
        if (cost <= 0){
            return;
        }
        hasCost = true;

        if (['Custom','Structs','Bool','Morale','Army','HellArmy','Troops','Supply'].includes(res)){
            invalid = true;
            return;
        }
        if (global.prestige && global.prestige.hasOwnProperty(res)){
            invalid = true;
            return;
        }

        let f_res = res === 'Species' ? global.race.species : res;
        if (!global.resource || !global.resource[f_res]){
            invalid = true;
            return;
        }
        let resource = global.resource[f_res];
        if (resource.max >= 0 && resource.max !== -1 && cost > Number(resource.max)){
            maxCount = 0;
            return;
        }
        let avail = Number(resource.amount);
        let possible = Math.floor(avail / cost);
        if (!Number.isFinite(possible)){
            invalid = true;
            return;
        }
        if (possible < maxCount){
            maxCount = possible;
        }
    });

    if (invalid || !hasCost || maxCount === Infinity){
        return 0;
    }
    return Math.max(0, maxCount);
}

function getActionId(target){
    if (!target){
        return null;
    }
    if (typeof target === 'string'){
        return target;
    }
    if (target.id){
        return target.id;
    }
    if (target.jquery){
        return target.attr('id') || target.closest('.action').attr('id');
    }
    if (target.nodeType === 1){
        return $(target).closest('.action').attr('id');
    }
    return null;
}

const newActionSfx = (() => {
    if (typeof window === 'undefined') {
        return null;
    }
    if (!window.evolveActionSfx) {
        const audio = new Audio('/voice/new-one.wav');
        audio.preload = 'auto';
        audio.volume = 0.5;
        window.evolveActionSfx = { ready: false, seen: new Set(), audio };
    }
    return window.evolveActionSfx;
})();

function playNewActionSound(id, old, prediction){
    if (!newActionSfx){
        return;
    }
    if (old || prediction){
        newActionSfx.seen.add(id);
        return;
    }
    if (newActionSfx.seen.has(id)){
        return;
    }
    newActionSfx.seen.add(id);
    if (!newActionSfx.ready){
        return;
    }
    try {
        newActionSfx.audio.currentTime = 0;
        newActionSfx.audio.play();
    }
    catch {
        // Ignore playback errors (e.g. autoplay restrictions).
    }
}

function playEvolutionCompleteSfx(){
    if (typeof window === 'undefined'){
        return;
    }
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx){
            return;
        }
        if (!window.evolveEvolutionSfx){
            window.evolveEvolutionSfx = { ctx: new AudioCtx() };
        }
        const ctx = window.evolveEvolutionSfx.ctx;
        if (ctx.state === 'suspended'){
            ctx.resume();
        }
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
        master.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        master.connect(ctx.destination);
        const tones = [
            { freq: 392, time: 0.0 },
            { freq: 523.25, time: 0.07 },
            { freq: 659.25, time: 0.14 },
        ];
        tones.forEach((tone) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(tone.freq, now + tone.time);
            osc.frequency.exponentialRampToValueAtTime(tone.freq * 1.4, now + tone.time + 0.25);
            gain.gain.setValueAtTime(0.0001, now + tone.time);
            gain.gain.exponentialRampToValueAtTime(0.4, now + tone.time + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + tone.time + 0.45);
            osc.connect(gain);
            gain.connect(master);
            osc.start(now + tone.time);
            osc.stop(now + tone.time + 0.5);
        });
    }
    catch {
        // Ignore audio errors (e.g. autoplay restrictions).
    }
}

export const actions = {
    evolution: {
        rna: {
            id: 'evolution-rna',
            class: 'rna-action',
            title: loc('resource_RNA_name'),
            desc(){
                let rna = global.race['rapid_mutation'] ? 2 : 1;
                return loc('evo_rna',[rna]);
            },
            condition(){ return global.resource.hasOwnProperty('RNA') && global.resource.RNA.display && !global.race['evoFinalMenu']; },
            action(args){
                if(global['resource']['RNA'].amount < global['resource']['RNA'].max){
                    modRes('RNA',global.race['rapid_mutation'] ? 2 : 1,true);
                }
                else {
                    showFullBadge('evolution-rna');
                }
                return false;
            },
            queue_complete(){ return 0; }
        },
        dna: {
            id: 'evolution-dna',
            class: 'dna-action',
            title: loc('evo_dna_title'),
            desc: loc('evo_dna_desc'),
            condition(){ return global.resource.hasOwnProperty('DNA') && global.resource.DNA.display && !global.race['evoFinalMenu']; },
            cost: { RNA(){ return 2; } },
            action(args){
                if (global['resource']['RNA'].amount >= 2 && global['resource']['DNA'].amount < global['resource']['DNA'].max){
                    modRes('RNA',-2,true);
                    modRes('DNA',1,true);
                }
                else if (global['resource']['DNA'].amount >= global['resource']['DNA'].max){
                    showFullBadge('evolution-dna');
                }
                else {
                    showInsufficientBadge('evolution-dna');
                }
                return false;
            },
            effect: loc('evo_dna_effect'),
            queue_complete(){ return 0; }
        },
        membrane: {
            id: 'evolution-membrane',
            class: 'membrane-action',
            title: loc('evo_membrane_title'),
            desc: loc('evo_membrane_desc'),
            condition(){ return global.evolution.hasOwnProperty('membrane') && !global.race['evoFinalMenu']; },
            cost: { RNA(offset){ return evolveCosts('membrane',2,2,offset); } },
            effect(){
                let effect = global.evolution['mitochondria'] ? global.evolution['mitochondria'].count * 5 + 5 : 5;
                return loc('evo_membrane_effect',[effect]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    global['resource']['RNA'].max += global.evolution['mitochondria'] ? global.evolution['mitochondria'].count * 5 + 5 : 5;
                    global.evolution.membrane.count++;
                    return true;
                }
                return false;
            }
        },
        organelles: {
            id: 'evolution-organelles',
            class: 'organelles-action',
            title: loc('evo_organelles_title'),
            desc: loc('evo_organelles_desc'),
            condition(){ return global.evolution.hasOwnProperty('organelles') && !global.race['evoFinalMenu']; },
            cost: {
                RNA(offset){ return evolveCosts('organelles',12,8,offset); },
                DNA(offset){ return evolveCosts('organelles',4,4,offset); }
            },
            effect(){
                let rna = global.race['rapid_mutation'] ? 2 : 1;
                if (global.tech['evo'] && global.tech.evo >= 2){
                    rna++;
                }
                return loc('evo_organelles_effect',[rna]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution.organelles.count++;
                    return true;
                }
                return false;
            }
        },
        nucleus: {
            id: 'evolution-nucleus',
            class: 'nucleus-action',
            title: loc('evo_nucleus_title'),
            desc: loc('evo_nucleus_desc'),
            condition(){ return global.evolution.hasOwnProperty('nucleus') && !global.race['evoFinalMenu']; },
            cost: {
                RNA(offset){ return evolveCosts('nucleus',38, global.tech['evo'] && global.tech.evo >= 4 ? 16 : 32, offset ); },
                DNA(offset){ return evolveCosts('nucleus',18, global.tech['evo'] && global.tech.evo >= 4 ? 12 : 16, offset ); }
            },
            effect(){
                let dna = (global.tech['evo'] && global.tech.evo >= 5) ? 2 : 1;
                return loc('evo_nucleus_effect',[dna]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution.nucleus.count++;
                    return true;
                }
                return false;
            }
        },
        eukaryotic_cell: {
            id: 'evolution-eukaryotic_cell',
            class: 'eukaryotic-cell-action',
            title: loc('evo_eukaryotic_title'),
            desc: loc('evo_eukaryotic_desc'),
            condition(){ return global.evolution.hasOwnProperty('eukaryotic_cell') && !global.race['evoFinalMenu']; },
            cost: {
                RNA(offset){ return evolveCosts('eukaryotic_cell',20,20,offset); },
                DNA(offset){ return evolveCosts('eukaryotic_cell',40,12,offset); }
            },
            effect(){
                let effect = global.evolution['mitochondria'] ? global.evolution['mitochondria'].count * 10 + 10 : 10;
                return loc('evo_eukaryotic_effect',[effect]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution.eukaryotic_cell.count++;
                    global['resource']['DNA'].max += global.evolution['mitochondria'] ? global.evolution['mitochondria'].count * 10 + 10 : 10;
                    return true;
                }
                return false;
            }
        },
        mitochondria: {
            id: 'evolution-mitochondria',
            class: 'mitochondria-action',
            title: loc('evo_mitochondria_title'),
            desc: loc('evo_mitochondria_desc'),
            condition(){ return global.evolution.hasOwnProperty('mitochondria') && !global.race['evoFinalMenu']; },
            cost: {
                RNA(offset){ return evolveCosts('mitochondria',75,50,offset); },
                DNA(offset){ return evolveCosts('mitochondria',65,35,offset); }
            },
            effect: loc('evo_mitochondria_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution.mitochondria.count++;
                    return true;
                }
                return false;
            }
        },
        sexual_reproduction: {
            id: 'evolution-sexual_reproduction',
            class: 'sexual-reproduction-action',
            title: loc('evo_sexual_reproduction_title'),
            desc: loc('evo_sexual_reproduction_desc'),
            reqs: { evo: 1 },
            grant: ['evo',2],
            condition(){ return global.tech['evo'] && global.tech.evo === 1; },
            cost: {
                DNA(){ return 150; }
            },
            effect: loc('evo_sexual_reproduction_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution['final'] = 20;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 1 ? 1 : 0;}
        },
        phagocytosis: {
            id: 'evolution-phagocytosis',
            class: 'phagocytosis-action',
            title: loc('evo_phagocytosis_title'),
            desc: loc('evo_phagocytosis_desc'),
            reqs: { evo: 2 },
            grant: ['evo',3],
            condition(){ return global.tech['evo'] && global.tech.evo === 2; },
            cost: {
                DNA(){ return 175; }
            },
            effect: loc('evo_phagocytosis_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo_animal'] = 1;
                    global.evolution['final'] = 40;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 2 ? 1 : 0; }
        },
        chloroplasts: {
            id: 'evolution-chloroplasts',
            class: 'chloroplasts-action',
            title(){ return global.evolution['gselect'] ? loc('genelab_genus_plant') : loc('evo_chloroplasts_title'); },
            desc: loc('evo_chloroplasts_desc'),
            reqs: { evo: 2 },
            grant: ['evo',3],
            condition(){ return genus_condition(2); },
            cost: {
                DNA(){ return 175; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_chloroplasts_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_chloroplasts_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    if (global.evolution['gselect']){
                        global.tech['evo'] = 7;
                        global.tech['evo_plant'] = 2;
                        global.evolution['final'] = 100;
                    }
                    else {
                        global.tech['evo_plant'] = 1;
                        global.evolution['final'] = 40;
                    }
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 2 ? 1 : 0; },
            emblem(){ return format_emblem('genus_plant'); }
        },
        chitin: {
            id: 'evolution-chitin',
            class: 'chitin-action',
            title(){ return global.evolution['gselect'] ? loc('genelab_genus_fungi') : loc('evo_chitin_title'); },
            desc: loc('evo_chitin_desc'),
            reqs: { evo: 2 },
            grant: ['evo',3],
            condition(){ return genus_condition(2); },
            cost: {
                DNA(){ return 175; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_chitin_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_chitin_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    if (global.evolution['gselect']){
                        global.tech['evo'] = 7;
                        global.tech['evo_fungi'] = 2;
                        global.evolution['final'] = 100;
                    }
                    else {
                        global.tech['evo_fungi'] = 1;
                        global.evolution['final'] = 40;
                    }
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 2 ? 1 : 0; },
            emblem(){ return format_emblem('genus_fungi'); }
        },
        exterminate: {
            id: 'evolution-exterminate',
            title(){ return global.evolution['gselect'] ? loc('genelab_genus_synthetic') : loc('evo_exterminate_title'); },
            desc: loc('evo_exterminate_desc'),
            reqs: { evo: 2 },
            grant: ['evo',7],
            condition(){
                return genus_condition(2) && global.stats.achieve['obsolete'] && global.stats.achieve.obsolete.l >= 5;
            },
            cost: {
                DNA(){ return 200; }
            },
            effect(){ return loc('evo_exterminate_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo_synthetic'] = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 2 ? 1 : 0; },
            emblem(){ return format_emblem('genus_synthetic'); }
        },
        multicellular: {
            id: 'evolution-multicellular',
            class: 'multicellular-action',
            title: loc('evo_multicellular_title'),
            desc: loc('evo_multicellular_desc'),
            reqs: { evo: 3 },
            grant: ['evo',4],
            condition(){ return global.tech['evo'] && global.tech.evo === 3; },
            cost: {
                DNA(){ return 200; }
            },
            effect: loc('evo_multicellular_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution['final'] = 60;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 3 ? 1 : 0; }
        },
        spores: {
            id: 'evolution-spores',
            class: 'spores-action',
            title: loc('evo_spores_title'),
            desc: loc('evo_spores_desc'),
            reqs: { evo: 4, evo_fungi: 1 },
            grant: ['evo',5],
            condition(){ return global.tech['evo'] && global.tech.evo === 4; },
            cost: {
                DNA(){ return 230; }
            },
            effect: loc('evo_nucleus_boost'),
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution['final'] = 80;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 4 ? 1 : 0; }
        },
        poikilohydric: {
            id: 'evolution-poikilohydric',
            class: 'poikilohydric-action',
            title: loc('evo_poikilohydric_title'),
            desc: loc('evo_poikilohydric_desc'),
            reqs: { evo: 4, evo_plant: 1 },
            grant: ['evo',5],
            condition(){ return global.tech['evo'] && global.tech.evo === 4; },
            cost: {
                DNA(){ return 230; }
            },
            effect: loc('evo_nucleus_boost'),
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution['final'] = 80;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 4 ? 1 : 0; }
        },
        bilateral_symmetry: {
            id: 'evolution-bilateral_symmetry',
            class: 'bilateral-symmetry-action',
            title: loc('evo_bilateral_symmetry_title'),
            desc: loc('evo_bilateral_symmetry_desc'),
            reqs: { evo: 4, evo_animal: 1 },
            grant: ['evo',5],
            condition(){ return global.tech['evo'] && global.tech.evo === 4; },
            cost: {
                DNA(){ return 230; }
            },
            effect: loc('evo_nucleus_boost'),
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution['final'] = 80;
                    global.tech['evo_insectoid'] = 1;
                    global.tech['evo_mammals'] = 1;
                    global.tech['evo_eggshell'] = 1;
                    global.tech['evo_eldritch'] = 1;
                    global.tech['evo_aquatic'] = 1;
                    global.tech['evo_fey'] = 1;
                    global.tech['evo_sand'] = 1;
                    global.tech['evo_heat'] = 1;
                    global.tech['evo_polar'] = 1;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 4 ? 1 : 0; }
        },
        bryophyte: {
            id: 'evolution-bryophyte',
            class: 'bryophyte-action',
            title: loc('evo_bryophyte_title'),
            desc: loc('evo_bryophyte_desc'),
            reqs: { evo: 5 },
            grant: ['evo',7],
            condition(){
                let allowed = global.tech['evo_plant'] || global.tech['evo_fungi'] ? true : false;
                return allowed && genus_condition(5);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_bryophyte_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.evolution['final'] = 100;
                    if (global.tech['evo_fungi']){
                        global.tech['evo_fungi'] = 2;
                    }
                    if (global.tech['evo_plant']){
                        global.tech['evo_plant'] = 2;
                    }
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; }
        },
        athropods: {
            id: 'evolution-athropods',
            class: 'arthropods-action',
            title: loc('evo_athropods_title'),
            desc: loc('evo_athropods_desc'),
            reqs: { evo: 5, evo_insectoid: 1 },
            grant: ['evo',7],
            condition(){ return genus_condition(5); },
            cost: {
                DNA(){ return 260; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_athropods_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_athropods_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_insectoid = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; },
            emblem(){ return format_emblem('genus_insectoid'); }
        },
        mammals: {
            id: 'evolution-mammals',
            class: 'mammals-action',
            title: loc('evo_mammals_title'),
            desc: loc('evo_mammals_desc'),
            reqs: { evo: 5, evo_mammals: 1 },
            grant: ['evo',6],
            condition(){ return global.tech['evo'] && global.tech.evo === 5; },
            cost: {
                DNA(){ return 245; }
            },
            effect: loc('evo_mammals_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo_humanoid'] = 1;
                    global.tech['evo_giant'] = 1;
                    global.tech['evo_small'] = 1;
                    global.tech['evo_animalism'] = 1;
                    global.tech['evo_demonic'] = 1;
                    global.tech['evo_angelic'] = 1;
                    global.evolution['final'] = 90;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; }
        },
        humanoid: {
            id: 'evolution-humanoid',
            class: 'humanoid-action',
            title: loc('evo_humanoid_title'),
            desc: loc('evo_humanoid_desc'),
            reqs: { evo: 6, evo_humanoid: 1 },
            grant: ['evo',7],
            condition(){ return genus_condition(6); },
            cost: {
                DNA(){ return 260; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_humanoid_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_humanoid_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_humanoid = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_humanoid'); }
        },
        gigantism: {
            id: 'evolution-gigantism',
            class: 'gigantism-action',
            title: loc('evo_gigantism_title'),
            desc: loc('evo_gigantism_desc'),
            reqs: { evo: 6, evo_giant: 1 },
            grant: ['evo',7],
            condition(){ return genus_condition(6); },
            cost: {
                DNA(){ return 260; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_gigantism_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_gigantism_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_giant = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_giant'); }
        },
        dwarfism: {
            id: 'evolution-dwarfism',
            class: 'dwarfism-action',
            title: loc('evo_dwarfism_title'),
            desc: loc('evo_dwarfism_desc'),
            reqs: { evo: 6, evo_small: 1 },
            grant: ['evo',7],
            condition(){ return genus_condition(6); },
            cost: {
                DNA(){ return 260; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_dwarfism_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_dwarfism_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_small = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_small'); }
        },
        animalism: {
            id: 'evolution-animalism',
            class: 'animalism-action',
            title: loc('evo_animalism_title'),
            desc: loc('evo_animalism_desc'),
            reqs: { evo: 6, evo_animalism: 1 },
            grant: ['evo',7],
            condition(){ return genus_condition(6) && global.tech['evo_animalism'] && global.tech.evo_animalism === 1; },
            cost: {
                DNA(){ return 250; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_animalism_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_animalism_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_animalism = 2;
                    global.evolution['final'] = 95;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 && global.tech.evo_animalism === 1 ? 1 : 0; }
        },
        carnivore: {
            id: 'evolution-carnivore',
            class: 'carnivore-action',
            title: loc('evo_carnivore_title'),
            desc: loc('evo_carnivore_desc'),
            reqs: { evo_animalism: 2 },
            grant: ['evo_animalism',3],
            condition(){ return genus_condition(7) && global.tech['evo_animalism'] && global.tech.evo_animalism === 2; },
            cost: {
                DNA(){ return 255; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_carnivore_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_carnivore_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo'] = 7;
                    global.tech['evo_carnivore'] = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 7 && global.tech.evo_animalism === 2 ? 1 : 0; },
            emblem(){ return format_emblem('genus_carnivore'); }
        },
        herbivore: {
            id: 'evolution-herbivore',
            class: 'herbivore-action',
            title: loc('evo_herbivore_title'),
            desc: loc('evo_herbivore_desc'),
            reqs: { evo_animalism: 2 },
            grant: ['evo_animalism',3],
            condition(){ return genus_condition(7) && global.tech['evo_animalism'] && global.tech.evo_animalism === 2; },
            cost: {
                DNA(){ return 255; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_herbivore_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_herbivore_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo'] = 7;
                    global.tech['evo_herbivore'] = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 7 && global.tech.evo_animalism === 2 ? 1 : 0; },
            emblem(){ return format_emblem('genus_herbivore'); }
        },
        omnivore: {
            id: 'evolution-omnivore',
            title: loc('evo_omnivore_title'),
            desc: loc('evo_omnivore_desc'),
            reqs: { evo_animalism: 2, locked: 1 },
            grant: ['evo_animalism',3],
            condition(){ return genus_condition(7) && global.tech['evo_animalism'] && global.tech.evo_animalism === 2; },
            cost: {
                DNA(){ return 255; }
            },
            wiki: false,
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_omnivore_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_omnivore_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo_omnivore'] = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 7 && global.tech.evo_animalism === 2 ? 1 : 0; },
            emblem(){ return format_emblem('genus_omnivore'); }
        },
        celestial: {
            id: 'evolution-celestial',
            title: loc('evo_celestial_title'),
            desc: loc('evo_celestial_desc'),
            reqs: { evo: 6, evo_angelic: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = global.city.biome === 'eden' || global.blood['unbound'] && global.blood.unbound >= 3 ? true : false;
                return allowed && genus_condition(6);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect(){ return loc('evo_celestial_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_angelic = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_angelic'); }
        },
        demonic: {
            id: 'evolution-demonic',
            title: loc('evo_demonic_title'),
            desc: loc('evo_demonic_desc'),
            reqs: { evo: 6, evo_demonic: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = global.city.biome === 'hellscape' || global.blood['unbound'] && global.blood.unbound >= 3 ? true : false;
                return allowed && genus_condition(6);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe === 'evil' ? `<div>${loc('evo_demonic_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_demonic_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_demonic = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_demonic'); }
        },
        eldritch: {
            id: 'evolution-eldritch',
            title: loc('evo_eldritch_title'),
            desc: loc('evo_eldritch_desc'),
            reqs: { evo: 5, evo_eldritch: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = global.stats.achieve['nightmare'] && global.stats.achieve.nightmare['mg'] ? true : false;
                return allowed && genus_condition(5);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_eldritch_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_eldritch = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_eldritch'); }
        },
        aquatic: {
            id: 'evolution-aquatic',
            title: loc('evo_aquatic_title'),
            desc: loc('evo_aquatic_desc'),
            reqs: { evo: 5, evo_aquatic: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = ['oceanic','swamp'].includes(global.city.biome) || global.blood['unbound'] ? true : false;
                return allowed && genus_condition(5);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_aquatic_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_aquatic = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; },
            emblem(){ return format_emblem('genus_aquatic'); }
        },
        fey: {
            id: 'evolution-fey',
            title: loc('evo_fey_title'),
            desc: loc('evo_fey_desc'),
            reqs: { evo: 5, evo_fey: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = ['forest','swamp','taiga'].includes(global.city.biome) || global.blood['unbound'] ? true : false;
                return allowed && genus_condition(5);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_fey_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_fey = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; },
            emblem(){ return format_emblem('genus_fey'); }
        },
        heat: {
            id: 'evolution-heat',
            title: loc('evo_heat_title'),
            desc: loc('evo_heat_desc'),
            reqs: { evo: 5, evo_heat: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = ['volcanic','ashland'].includes(global.city.biome) || global.blood['unbound'] ? true : false;
                return allowed && genus_condition(5);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_heat_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_heat = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; },
            emblem(){ return format_emblem('genus_heat'); }
        },
        polar: {
            id: 'evolution-polar',
            title: loc('evo_polar_title'),
            desc: loc('evo_polar_desc'),
            reqs: { evo: 5, evo_polar: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = ['tundra','taiga'].includes(global.city.biome) || global.blood['unbound'] ? true : false;
                return allowed && genus_condition(5);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_polar_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_polar = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; },
            emblem(){ return format_emblem('genus_polar'); }
        },
        sand: {
            id: 'evolution-sand',
            title: loc('evo_sand_title'),
            desc: loc('evo_sand_desc'),
            reqs: { evo: 5, evo_sand: 1 },
            grant: ['evo',7],
            condition(){
                let allowed = ['desert','ashland'].includes(global.city.biome) || global.blood['unbound'] ? true : false;
                return allowed && genus_condition(5);
            },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_sand_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_sand = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; },
            emblem(){ return format_emblem('genus_sand'); }
        },
        eggshell: {
            id: 'evolution-eggshell',
            class: 'eggshell-action',
            title: loc('evo_eggshell_title'),
            desc: loc('evo_eggshell_desc'),
            reqs: { evo: 5, evo_eggshell: 1 },
            grant: ['evo',6],
            condition(){ return global.tech['evo'] && global.tech.evo === 5 && !global.evolution['gselect']; },
            cost: {
                DNA(){ return 245; }
            },
            effect(){ return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_eggshell_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_eggshell_effect'); },
            action(args){
                if (payCosts($(this)[0])){
                    global.tech.evo_eggshell = 2;
                    global.evolution['final'] = 90;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 5 ? 1 : 0; }
        },
        endothermic: {
            id: 'evolution-endothermic',
            class: 'endothermic-action',
            title(){ return global.evolution['gselect'] ? loc('genelab_genus_avian') : loc('evo_endothermic_title'); },
            desc: loc('evo_endothermic_desc'),
            reqs: { evo: 6, evo_eggshell: 2 },
            grant: ['evo',7],
            condition(){ return genus_condition(6); },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_endothermic_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo_avian'] = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_avian'); }
        },
        ectothermic: {
            id: 'evolution-ectothermic',
            class: 'ectothermic-action',
            title(){ return global.evolution['gselect'] ? loc('genelab_genus_reptilian') : loc('evo_ectothermic_title'); },
            desc: loc('evo_ectothermic_desc'),
            reqs: { evo: 6, evo_eggshell: 2 },
            grant: ['evo',7],
            condition(){ return genus_condition(6); },
            cost: {
                DNA(){ return 260; }
            },
            effect: loc('evo_ectothermic_effect'),
            action(args){
                if (payCosts($(this)[0])){
                    global.tech['evo_reptilian'] = 2;
                    global.evolution['final'] = 100;
                    return true;
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 6 ? 1 : 0; },
            emblem(){ return format_emblem('genus_reptilian'); }
        },
        sentience: {
            id: 'evolution-sentience',
            class: 'sentience-action',
            title: loc('evo_sentience_title'),
            desc: loc('evo_sentience_desc'),
            reqs: { evo: 7 },
            grant: ['evo',8],
            condition(){ return global.tech['evo'] && global.tech.evo === 7 && global.evolution['final'] === 100 && !sentienceSelecting; },
            cost: {
                RNA(){ return 300; },
                DNA(){ return 300; }
            },
            effect(){ return global.evolution['exterminate'] ? loc('evo_sentience_ai_effect') : loc('evo_sentience_effect'); },
            action(args){
                if (sentienceSelecting){
                    return false;
                }
                const costs = adjustCosts(actions.evolution.sentience);
                if (!checkCosts(costs)){
                    showInsufficientBadge('evolution-sentience');
                    return false;
                }
                const allowed = getSentienceAllowedRaces();
                if (!allowed.length){
                    return false;
                }
                sentienceSelecting = true;
                sentiencePendingCosts = costs;
                sentiencePendingAllowed = allowed;
                drawEvolution();
                return false;
            },
            emblem(){
                for (let idx in raceList){
                    let id = raceList[idx];
                    if (global.tech[`evo_${races[id].type}`] && global.tech[`evo_${races[id].type}`] >= 2){
                        return format_emblem(`genus_${races[id].type}`);
                    }
                }
                return '';
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 7 ? 1 : 0; },
        },
    },
    city: {
        gift: {
            id: 'city-gift',
            title: loc('city_gift'),
            desc: loc('city_gift_desc'),
            wiki: false,
            category: 'outskirts',
            reqs: { primitive: 1 },
            queue_complete(){ return 0; },
            not_tech: ['santa'],
            not_trait: ['cataclysm','lone_survivor'],
            class: ['hgift'],
            condition(){
                const date = new Date();
                if (date.getMonth() !== 11 || (date.getMonth() === 11 && (date.getDate() <= 16 || date.getDate() >= 25))){
                    let active_gift = false;
                    if (global['special'] && global.special['gift']){
                        Object.keys(global.special.gift).forEach(function(g){
                            if (global.special.gift[g]){
                                active_gift = true;
                            }
                        });
                    }
                    return active_gift;
                }
                return false;
            },
            count(){
                let gift_count = 0;
                if (global['special'] && global.special['gift']){
                    Object.keys(global.special.gift).forEach(function(g){
                        if (global.special.gift[g]){
                            gift_count++;
                        }
                    });
                }
                return gift_count;
            },
            action(args){
                if (!global.settings.pause){
                    const date = new Date();

                    let active_gift = false;
                    if (global['special'] && global.special['gift']){
                        Object.keys(global.special.gift).forEach(function(g){
                            if (global.special.gift[g]){
                                active_gift = g;
                            }
                        });
                    }
                    
                    if (date.getMonth() !== 11 || (date.getMonth() === 11 && (date.getDate() <= 16 || date.getDate() >= 25))){
                        if (active_gift === `g2019`){
                            if (global['special'] && global.special['gift']){
                                delete global.special.gift[active_gift];
                                if (global.race.universe === 'antimatter'){
                                    global.prestige.AntiPlasmid.count += 100;
                                    global.stats.antiplasmid += 100;
                                    messageQueue(loc('city_gift_msg',[100,loc('arpa_genepool_effect_antiplasmid')]),'info',false,['events']);
                                }
                                else {
                                    global.prestige.Plasmid.count += 100;
                                    global.stats.plasmid += 100;
                                    messageQueue(loc('city_gift_msg',[100,loc('arpa_genepool_effect_plasmid')]),'info',false,['events']);
                                }
                                drawCity();
                            }
                        }
                        else {
                            if (global['special'] && global.special['gift']){
                                delete global.special.gift[active_gift];
                                
                                let resets = global.stats.hasOwnProperty('reset') ? global.stats.reset : 0;
                                let mad = global.stats.hasOwnProperty('mad') ? global.stats.mad : 0;
                                let bioseed = global.stats.hasOwnProperty('bioseed') ? global.stats.bioseed : 0;
                                let cataclysm = global.stats.hasOwnProperty('cataclysm') ? global.stats.cataclysm : 0;
        
                                let plasmid = 100 + resets + mad;
                                let phage = bioseed + cataclysm;
                                let gift = [];

                                if (global.stats.died + global.stats.tdied > 0){
                                    let dead = global.stats.died + global.stats.tdied;
                                    global.resource.Coal.amount += dead;
                                    gift.push(`${dead.toLocaleString()} ${loc(`resource_Coal_name`)}`);
                                }

                                if (global.race.universe === 'antimatter'){
                                    global.prestige.AntiPlasmid.count += plasmid;
                                    global.stats.antiplasmid += plasmid;
                                    gift.push(`${plasmid.toLocaleString()} ${loc(`resource_AntiPlasmid_plural_name`)}`);
                                }
                                else {
                                    global.prestige.Plasmid.count += plasmid;
                                    global.stats.plasmid += plasmid;
                                    gift.push(`${plasmid.toLocaleString()} ${loc(`resource_Plasmid_plural_name`)}`);
                                }
                                if (phage > 0){
                                    global.prestige.Phage.count += phage;
                                    global.stats.phage += phage;
                                    gift.push(`${phage.toLocaleString()} ${loc(`resource_Phage_name`)}`);
                                }
        
                                if (global.stats.hasOwnProperty('achieve')){
                                    let universe = global.stats.achieve['whitehole'] ? global.stats.achieve['whitehole'].l : 0;
                                    universe += global.stats.achieve['heavy'] ? global.stats.achieve['heavy'].l : 0;
                                    universe += global.stats.achieve['canceled'] ? global.stats.achieve['canceled'].l : 0;
                                    universe += global.stats.achieve['eviltwin'] ? global.stats.achieve['eviltwin'].l : 0;
                                    universe += global.stats.achieve['microbang'] ? global.stats.achieve['microbang'].l : 0;
                                    universe += global.stats.achieve['pw_apocalypse'] ? global.stats.achieve['pw_apocalypse'].l : 0;
        
                                    let ascended = global.stats.achieve['ascended'] ? global.stats.achieve['ascended'].l : 0;
                                    let descend = global.stats.achieve['corrupted'] ? global.stats.achieve['corrupted'].l : 0;
                                    let ai = global.stats.achieve['obsolete'] ? global.stats.achieve['obsolete'].l : 0;
        
                                    if (universe > 30){ universe = 30; }
                                    if (ascended > 5){ ascended = 5; }
                                    if (descend > 5){ descend = 5; }
                                    
                                    if (universe > 0){
                                        let dark = +(universe / 7.5).toFixed(2);
                                        global.prestige.Dark.count += dark;
                                        global.stats.dark += dark;
                                        gift.push(`${dark} ${loc(`resource_Dark_name`)}`);
                                    }
                                    if (ascended > 0){
                                        global.prestige.Harmony.count += ascended;
                                        global.stats.harmony += ascended;
                                        gift.push(`${ascended} ${loc(`resource_Harmony_name`)}`);
                                    }
                                    if (descend > 0){
                                        let blood = descend * 5;
                                        let art = descend;
                                        global.prestige.Blood_Stone.count += blood;
                                        global.stats.blood += blood;
                                        global.prestige.Artifact.count += art;
                                        global.stats.artifact += art;
                                        gift.push(`${blood} ${loc(`resource_Blood_Stone_name`)}`);
                                        gift.push(`${art} ${loc(`resource_Artifact_name`)}`);
                                    }
                                    if (active_gift !== `g2020` && ai > 0){
                                        global.prestige.AICore.count += ai;
                                        global.stats.cores += ai;
                                        gift.push(`${ai} ${loc(`resource_AICore_name`)}`);
                                    }
                                }

                                messageQueue(loc('city_gift2_msg',[gift.join(", ")]),'info',false,['events']);
                                drawCity();
                            }
                        }
                    }
                }
                return false;
            },
            touchlabel: loc(`open`)
        },
        food: {
            id: 'city-food',
            class(){
                return global.race.species === 'pinguicula' ? 'pinguicula-food-action' : '';
            },
            title(){
                let hallowed = getHalloween();
                if (hallowed.active){
                    return global.tech['conjuring'] ? loc('city_trick_conjure') : loc('city_trick');
                }
                else {
                    return global.tech['conjuring'] ? loc('city_food_conjure') : loc('city_food');
                }
            },
            desc(){
                let gain = $(this)[0].val(false);
                let hallowed = getHalloween();
                if(global.race['fasting']){
                    return loc('city_food_fasting');
                }
                if (hallowed.active){
                    return global.tech['conjuring'] ? loc('city_trick_conjure_desc',[gain]) : loc('city_trick_desc',[gain]);
                }
                else {
                    return global.tech['conjuring'] ? loc('city_food_conjure_desc',[gain]) : loc('city_food_desc',[gain]);
                }
            },
            category: 'outskirts',
            reqs: { primitive: 1 },
            not_trait: ['cataclysm','artifical'],
            condition(){
                let hallowed = getHalloween();
                if (hallowed && global.race['soul_eater'] && !global.race['evil']){
                    return true;
                }
                return global.race['soul_eater'] ? false : true;
            },
            queue_complete(){ return 0; },
            cost: {
                Mana(){ return global.tech['conjuring'] ? 1 : 0; },
            },
            action(args){
                if (!global.settings.pause){
                    if(global['resource']['Food'].amount < global['resource']['Food'].max && !global.race['fasting']){
                        modRes('Food',$(this)[0].val(true),true);
                    }
                    global.stats.cfood++;
                    global.stats.tfood++;
                }
                return false;
            },
            val(spend){
                let gain = global.race['strong'] ? traits.strong.vars()[0] : 1;
                if (global.genes['enhance']){
                    gain *= 2;
                }
                if (global.tech['conjuring'] && global.resource.Mana.amount >= 1){
                    gain *= 10;
                    if (global['resource']['Food'].amount < global['resource']['Food'].max && spend){
                        modRes('Mana',-1,true);
                    }
                }
                return gain;
            },
            touchlabel: loc(`harvest`)
        },
        lumber: {
            id: 'city-lumber',
            class(){
                return global.race.species === 'pinguicula' ? 'pinguicula-lumber-action' : '';
            },
            title(){
                let hallowed = getHalloween();
                if (hallowed.active){
                    return global.tech['conjuring'] && global.tech['conjuring'] >= 2 ? loc('city_dig_conjour') : loc('city_dig');
                }
                else {
                    return global.tech['conjuring'] && global.tech['conjuring'] >= 2 ? loc('city_lumber_conjure') : loc('city_lumber');
                }
            },
            desc(){
                let gain = $(this)[0].val(false);
                let hallowed = getHalloween();
                if (hallowed.active){
                    return global.tech['conjuring'] && global.tech['conjuring'] >= 2 ? loc('city_dig_conjour_desc',[gain]) : loc('city_dig_desc',[gain]);
                }
                else {
                    return global.tech['conjuring'] && global.tech['conjuring'] >= 2 ? loc('city_lumber_conjure_desc',[gain]) : loc('city_lumber_desc',[gain]);
                }
            },
            category: 'outskirts',
            reqs: {},
            not_trait: ['evil','cataclysm'],
            queue_complete(){ return 0; },
            cost: {
                Mana(){ return global.tech['conjuring'] && global.tech['conjuring'] >= 2 ? 1 : 0; },
            },
            action(args){
                if (!global.settings.pause){
                    if (global['resource']['Lumber'].amount < global['resource']['Lumber'].max){
                        modRes('Lumber',$(this)[0].val(true),true);
                    }
                    global.stats.clumber++;
                    global.stats.tlumber++;
                }
                return false;
            },
            val(spend){
                let gain = global.race['strong'] ? traits.strong.vars()[0] : 1;
                if (global.genes['enhance']){
                    gain *= 2;
                }
                if (global.tech['conjuring'] && global.tech['conjuring'] >= 2 && global.resource.Mana.amount >= 1){
                    gain *= 10;
                    if (global['resource']['Lumber'].amount < global['resource']['Lumber'].max && spend){
                        modRes('Mana',-1,true);
                    }
                }
                return gain;
            },
            touchlabel: loc(`harvest`)
        },
        stone: {
            id: 'city-stone',
            class(){
                return global.race['sappy'] ? 'gather-amber-action' : '';
            },
            title(){
                if (global.tech['conjuring'] && global.tech['conjuring'] >= 2){
                    return loc(`city_conjour`,[global.resource.Stone.name]);
                }
                else {
                    return loc(`city_gather`,[global.resource.Stone.name]);
                }                
            },
            desc(){
                let gain = $(this)[0].val(false);
                if (global.tech['conjuring'] && global.tech['conjuring'] >= 2){
                    return loc('city_stone_conjour_desc',[gain,global.resource.Stone.name]);
                }
                else {
                    return loc(global.race['sappy'] ? 'city_amber_desc' : 'city_stone_desc',[gain,global.resource.Stone.name]);
                }                
            },
            category: 'outskirts',
            reqs: { primitive: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            queue_complete(){ return 0; },
            cost: {
                Mana(){ return global.tech['conjuring'] && global.tech['conjuring'] >= 2 ? 1 : 0; },
            },
            action(args){
                if (!global.settings.pause){
                    if (global['resource']['Stone'].amount < global['resource']['Stone'].max){
                        modRes('Stone',$(this)[0].val(true),true);
                    }
                    global.stats.cstone++;
                    global.stats.tstone++;
                }
                return false;
            },
            val(spend){
                let gain = global.race['strong'] ? traits.strong.vars()[0] : 1;
                if (global.genes['enhance']){
                    gain *= 2;
                }
                if (global.tech['conjuring'] && global.tech['conjuring'] >= 2 && global.resource.Mana.amount >= 1){
                    gain *= 10;
                    if (global['resource']['Stone'].amount < global['resource']['Stone'].max && spend){
                        modRes('Mana',-1,true);
                    }
                }
                return gain;
            },
            touchlabel: loc(`harvest`)
        },
        chrysotile: {
            id: 'city-chrysotile',
            title(){
                if (global.tech['conjuring'] && global.tech['conjuring'] >= 2){
                    return loc('city_chrysotile_conjour');
                }
                else {
                    return loc(`city_gather`,[global.resource.Chrysotile.name]);
                }                
            },
            desc(){
                let gain = $(this)[0].val(false);
                if (global.tech['conjuring'] && global.tech['conjuring'] >= 2){
                    return loc('city_stone_conjour_desc',[gain,global.resource.Chrysotile.name]);
                }
                else {
                    return loc('city_stone_desc',[gain,global.resource.Chrysotile.name]);
                }                
            },
            category: 'outskirts',
            reqs: { primitive: 2 },
            trait: ['smoldering'],
            not_trait: ['cataclysm','lone_survivor'],
            queue_complete(){ return 0; },
            cost: {
                Mana(){ return global.tech['conjuring'] && global.tech['conjuring'] >= 2 ? 1 : 0; },
            },
            action(args){
                if (!global.settings.pause){
                    if (global['resource']['Chrysotile'].amount < global['resource']['Chrysotile'].max){
                        modRes('Chrysotile',$(this)[0].val(true),true);
                    }
                }
                return false;
            },
            val(spend){
                let gain = global.race['strong'] ? traits.strong.vars()[0] : 1;
                if (global.genes['enhance']){
                    gain *= 2;
                }
                if (global.tech['conjuring'] && global.tech['conjuring'] >= 2 && global.resource.Mana.amount >= 1){
                    gain *= 10;
                    if (global['resource']['Chrysotile'].amount < global['resource']['Chrysotile'].max && spend){
                        modRes('Mana',-1,true);
                    }
                }
                return gain;
            },
            touchlabel: loc(`harvest`)
        },
        slaughter: {
            id: 'city-slaughter',
            title: loc('city_evil'),
            desc(){
                if (global.race['soul_eater']){
                    return global.tech['primitive'] ? (global.resource.hasOwnProperty('furs') && global.resource.Furs.display ? loc('city_evil_desc3') : loc('city_evil_desc2')) : loc('city_evil_desc1');
                }
                else {
                    return global.resource.hasOwnProperty('furs') && global.resource.Furs.display ? loc('city_evil_desc4') : loc('city_evil_desc1');
                }
            },
            category: 'outskirts',
            reqs: {},
            trait: ['evil'],
            not_trait: ['kindling_kindred','smoldering','cataclysm'],
            queue_complete(){ return 0; },
            action(args){
                if (!global.settings.pause){
                    let gain = global.race['strong'] ? traits.strong.vars()[0] : 1;
                    if (global.genes['enhance']){
                        gain *= 2;
                    }
                    if (!global.race['smoldering']){
                        if (global['resource']['Lumber'].amount < global['resource']['Lumber'].max){
                            modRes('Lumber',gain,true);
                        }
                        global.stats.clumber++;
                        global.stats.tlumber++;
                    }
                    if (global.race['soul_eater']){
                        if (global.tech['primitive'] && global['resource']['Food'].amount < global['resource']['Food'].max){
                            modRes('Food',gain,true);
                        }
                        global.stats.cfood++;
                        global.stats.tfood++;
                    }
                    if (global.resource.Furs.display && global['resource']['Furs'].amount < global['resource']['Furs'].max){
                        modRes('Furs',gain,true);
                    }
                }
                return false;
            },
            touchlabel: loc(`kill`)
        },
        horseshoe: buildTemplate(`horseshoe`,'city'),
        bonfire: buildTemplate(`bonfire`,'city'),
        firework: buildTemplate(`firework`,'city'),
        slave_market: {
            id: 'city-slave_market',
            title(){ return loc('city_slaver_market',[global.resource.Slave.name]); },
            desc(){ return loc('city_slaver_market_desc',[global.resource.Slave.name]); },
            category: 'outskirts',
            reqs: { slaves: 2 },
            trait: ['slaver'],
            not_trait: ['cataclysm','lone_survivor'],
            inflation: false,
            cost: {
                Money(){ return 25000; },
            },
            queue_complete(){ return global.city['slave_pen'] ? global.city.slave_pen.count * 4 - global.resource.Slave.amount : 0; },
            action(args){
                if (global.city['slave_pen'] && global.city.slave_pen.count * 4 > global.resource.Slave.amount){
                    if (payCosts($(this)[0])){
                        global.resource.Slave.amount++;
                        return true;
                    }
                }
                return false;
            },
            touchlabel: loc(`purchase`)
        },
        s_alter: buildTemplate(`s_alter`,'city'),
        basic_housing: {
            id: 'city-basic_housing',
            class(){
                let raceType = global.race.maintype || races[global.race.species].type;
                return raceType === 'plant' ? 'grove-action' : '';
            },
            title(){
                return housingLabel('small');
            },
            desc(){
                return $(this)[0].citizens() === 1 ? loc('city_basic_housing_desc') : loc('city_basic_housing_desc_plural',[$(this)[0].citizens()]);
            },
            category: 'residential',
            reqs: { housing: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['basic_housing'] ? global.city['basic_housing'].count : 0) + offset >= 5){
                        return costMultiplier('basic_housing', offset, 20, 1.17);
                    }
                    else {
                        return 0;
                    }
                },
                Lumber(offset){ return global.race['kindling_kindred'] || global.race['smoldering'] ? 0 : costMultiplier('basic_housing', offset, 10, 1.23); },
                Stone(offset){ return global.race['kindling_kindred'] ? costMultiplier('basic_housing', offset, 10, 1.23) : 0; },
                Chrysotile(offset){ return global.race['smoldering'] ? costMultiplier('basic_housing', offset, 10, 1.23) : 0; },
                Horseshoe(){ return global.race['hooved'] ? 1 : 0; }
            },
            effect(){
                let pop = $(this)[0].citizens();
                return global.race['sappy'] ? `<div>${loc('plus_max_resource',[pop,loc('citizen')])}</div><div>${loc('city_grove_effect',[2.5])}</div>` : loc('plus_max_resource',[pop,loc('citizen')]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    global['resource'][global.race.species].display = true;
                    global['resource'][global.race.species].max += $(this)[0].citizens();
                    incrementStruct($(this)[0]);
                    global.settings.showCivic = true;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['basic_housing','city']
                };
            },
            citizens(){
                let pop = 1;
                if (global.race['high_pop']){
                    pop *= traits.high_pop.vars()[0];
                }
                return pop;
            }
        },
        cottage: {
            id: 'city-cottage',
            class: 'cottage-action',
            title(){
                return housingLabel('medium');
            },
            desc(){
                return loc('city_cottage_desc',[$(this)[0].citizens()]);
            },
            category: 'residential',
            reqs: { housing: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('cottage', offset, 900, 1.15); },
                Plywood(offset){ return costMultiplier('cottage', offset, 25, 1.25); },
                Brick(offset){ return costMultiplier('cottage', offset, 20, 1.25); },
                Wrought_Iron(offset){ return costMultiplier('cottage', offset, 15, 1.25); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('cottage', offset, 5, 1.25) : 0; },
                Horseshoe(){ return global.race['hooved'] ? 2 : 0; }
            },
            effect(){
                let pop = $(this)[0].citizens();
                if (global.tech['home_safe']){
                    let safe = spatialReasoning(global.tech.home_safe >= 2 ? (global.tech.home_safe >= 3 ? 5000 : 2000) : 1000);
                    return `<div>${loc('plus_max_citizens',[pop])}</div><div>${loc('plus_max_resource',[`\$${safe.toLocaleString()}`,loc('resource_Money_name')])}</div>`;
                }
                else {
                    return loc('plus_max_citizens',[pop]);
                }
            },
            action(args){
                if (payCosts($(this)[0])){
                    global['resource'][global.race.species].max += $(this)[0].citizens();
                    incrementStruct('cottage','city');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['cottage','city']
                };
            },
            citizens(){
                let pop = 2;
                if (global.race['high_pop']){
                    pop *= traits.high_pop.vars()[0];
                }
                return pop;
            }
        },
        apartment: {
            id: 'city-apartment',
            title(){
                return housingLabel('large');
            },
            desc(){
                return `<div>${loc('city_apartment_desc',[$(this)[0].citizens()])}</div><div class="has-text-special">${loc('requires_power')}</div>`
            },
            category: 'residential',
            reqs: { housing: 3 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('apartment', offset, 1750, 1.26) - 500; },
                Crystal(offset){ return global.race.universe === 'magic' ? costMultiplier('apartment', offset, 25, 1.22) : 0; },
                Furs(offset){ return costMultiplier('apartment', offset, 725, 1.32) - 500; },
                Copper(offset){ return costMultiplier('apartment', offset, 650, 1.32) - 500; },
                Cement(offset){ return costMultiplier('apartment', offset, 700, 1.32) - 500; },
                Steel(offset){ return costMultiplier('apartment', offset, 800, 1.32) - 500; },
                Horseshoe(){ return global.race['hooved'] ? 5 : 0; }
            },
            effect(){
                let extraVal = govActive('extravagant',2);
                let pop = $(this)[0].citizens();
                if (global.tech['home_safe']){
                    let safe = spatialReasoning(global.tech.home_safe >= 2 ? (global.tech.home_safe >= 3 ? 10000 : 5000) : 2000);
                    if (extraVal){
                        safe *= 2;
                    }
                    return `<div>${loc('plus_max_citizens',[pop])}. <span class="has-text-caution">${loc('minus_power',[$(this)[0].powered()])}</span></div><div>${loc('plus_max_resource',[`\$${safe.toLocaleString()}`,loc('resource_Money_name')])}</div>`;
                }
                else {
                    return `${loc('plus_max_citizens',[pop])}. <span class="has-text-caution">${loc('minus_power',[$(this)[0].powered()])}</span>`;
                }
            },
            powered(){
                let extraVal = govActive('extravagant',1);
                return powerCostMod(extraVal ? extraVal : 1);
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('apartment','city');
                    if (powerOnNewStruct($(this)[0])){
                        global['resource'][global.race.species].max += $(this)[0].citizens();
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['apartment','city']
                };
            },
            citizens(){
                let extraVal = govActive('extravagant',2);
                let pop = extraVal ? 5 + extraVal : 5;
                if (global.race['high_pop']){
                    pop *= traits.high_pop.vars()[0];
                }
                return pop;
            }
        },
        lodge: {
            id: 'city-lodge',
            title: loc('city_lodge'),
            desc(){ return global.race['detritivore'] ? loc('city_lodge_desc_alt') : loc('city_lodge_desc'); },
            category: 'residential',
            reqs: { housing: 1, currency: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            condition(){
                return ((global.race['soul_eater'] || global.race['detritivore'] || global.race['artifical'] || global.race['unfathomable'] || global.race['forager']) && global.tech['s_lodge']) || (global.tech['hunting'] && global.tech['hunting'] >= 2) ? true : false;
            },
            cost: {
                Money(offset){ return costMultiplier('lodge', offset, 50, 1.32); },
                Lumber(offset){ return costMultiplier('lodge', offset, 20, 1.36); },
                Stone(offset){ return costMultiplier('lodge', offset, 10, 1.36); },
                Horseshoe(){ return global.race['hooved'] ? 1 : 0; }
            },
            effect(){
                let pop = $(this)[0].citizens();
                return global.race['carnivore'] && !global.race['artifical'] ? `<div>${loc('plus_max_resource',[pop,loc('citizen')])}</div><div>${loc('city_lodge_effect',[5])}</div>` : loc('plus_max_resource',[pop,loc('citizen')]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('lodge','city');
                    global['resource'][global.race.species].display = true;
                    global['resource'][global.race.species].max += 1;
                    global.settings.showCivic = true;
                    return true;
                }
                return false;
            },
            citizens(){
                let pop = 1;
                if (global.race['high_pop']){
                    pop *= traits.high_pop.vars()[0];
                }
                return pop;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['lodge','city']
                };
            }
        },
        smokehouse: {
            id: 'city-smokehouse',
            title(){ return global.race['hrt'] && ['wolven','vulpine'].includes(global.race['hrt']) ? loc('city_smokehouse_easter') : loc('city_smokehouse'); },
            desc: loc('city_smokehouse_desc'),
            category: 'trade',
            reqs: { hunting: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('smokehouse', offset, 85, 1.32); },
                Lumber(offset){ return costMultiplier('smokehouse', offset, 65, 1.36) },
                Stone(offset){ return costMultiplier('smokehouse', offset, 50, 1.36); }
            },
            effect(){
                let food = BHStorageMulti(spatialReasoning(100));
                return `<div>${loc('plus_max_resource',[food, global.resource.Food.name])}</div><div>${loc('city_smokehouse_effect',[10])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('smokehouse','city');
                    global['resource']['Food'].max += BHStorageMulti(spatialReasoning(100));
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['smokehouse','city']
                };
            }
        },
        soul_well: {
            id: 'city-soul_well',
            title: loc('city_soul_well'),
            desc: loc('city_soul_well_desc'),
            category: 'trade',
            reqs: { soul_eater: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['soul_well'] ? global.city['soul_well'].count : 0) + offset >= 3){
                        return costMultiplier('soul_well', offset, 50, 1.32);
                    }
                    else {
                        return 0;
                    }
                },
                Lumber(offset){ return costMultiplier('soul_well', offset, 20, 1.36); },
                Stone(offset){ return costMultiplier('soul_well', offset, 10, 1.36); }
            },
            effect(){
                let souls = BHStorageMulti(spatialReasoning(500));
                let production = global.race['ghostly'] ? (2 + traits.ghostly.vars()[1]) : 2;
                return `<div>${loc('city_soul_well_effect',[production])}</div><div>${loc('plus_max_resource',[souls, loc('resource_Souls_name')])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('soul_well','city');
                    global['resource']['Food'].max += BHStorageMulti(spatialReasoning(500));
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['soul_well','city']
                };
            }
        },
        slave_pen: {
            id: 'city-slave_pen',
            title(){ return loc('city_slave_housing',[global.resource.Slave.name]); },
            desc(){ return loc('city_slave_housing',[global.resource.Slave.name]); },
            category: 'commercial',
            reqs: { slaves: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('slave_pen', offset, 250, 1.32); },
                Lumber(offset){ return costMultiplier('slave_pen', offset, 100, 1.36); },
                Stone(offset){ return costMultiplier('slave_pen', offset, 75, 1.36); },
                Copper(offset){ return costMultiplier('slave_pen', offset, 10, 1.36); },
                Nanite(offset){ return global.race['deconstructor'] ? costMultiplier('slave_pen', offset, 4, 1.36) : 0; },
            },
            effect(){
                return `<div>${loc('plus_max_resource',[4,global.resource.Slave.name])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('slave_pen','city');
                    global.resource.Slave.display = true;
                    global.resource.Slave.max = global.city.slave_pen.count * 4;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['slave_pen','city']
                };
            }
        },
        transmitter: {
            id: 'city-transmitter',
            title: loc('city_transmitter'),
            desc(){ return `<div>${loc('city_transmitter_desc')}</div><div class="has-text-special">${loc('requires_power')}</div>`; },
            category: 'residential',
            reqs: { high_tech: 4 },
            trait: ['artifical'],
            cost: {
                Money(offset){ if (global.city['transmitter'] && global.city['transmitter'].count >= 3){ return costMultiplier('transmitter', offset, 50, 1.32);} else { return 0; } },
                Copper(offset){ return costMultiplier('transmitter', offset, 20, 1.36); },
                Steel(offset){ return costMultiplier('transmitter', offset, 10, 1.36); },
            },
            effect(){
                let signal = +(production('transmitter')).toFixed(2);
                let sig_cap = spatialReasoning(100);
                return `<div>${loc('gain',[signal, global.resource.Food.name])}</div><div>${loc('city_transmitter_effect',[sig_cap])}</div><div class="has-text-caution">${loc('minus_power',[$(this)[0].powered()])}</div>`;
            },
            powered(){ return powerCostMod(0.5); },
            powerBalancer(){
                return [{ r: 'Food', k: 'lpmod' }];
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('transmitter','city');
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['transmitter','city']
                };
            }
        },
        captive_housing: buildTemplate(`captive_housing`,'city'),
        farm: {
            id: 'city-farm',
            class: 'farm-action',
            title(){ return structName('farm'); },
            desc: loc('city_farm_desc'),
            category: 'residential',
            reqs: { agriculture: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['farm'] ? global.city['farm'].count : 0) + offset >= 3){
                        return costMultiplier('farm', offset, 50, 1.32);
                    }
                    else {
                        return 0;
                    }
                },
                Lumber(offset){ return costMultiplier('farm', offset, 20, 1.36); },
                Stone(offset){ return costMultiplier('farm', offset, 10, 1.36); },
                Horseshoe(offset){ return global.race['hooved'] && ((global.city['farm'] ? global.city['farm'].count : 0) + (offset || 0)) >= 2 ? 1 : 0; }
            },
            effect(){
                let pop = $(this)[0].citizens();
                return global.tech['farm'] ? `<div>${loc('city_farm_effect')}</div><div>${loc('plus_max_resource',[pop,loc('citizen')])}</div>` : loc('city_farm_effect');
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('farm','city');
                    if(global.race['fasting']){
                        global.civic.farmer.display = false;
                        global.civic.farmer.assigned = 0;
                    }
                    else{
                        global.civic.farmer.display = true;
                    }
                    if (global.tech['farm']){
                        global['resource'][global.race.species].display = true;
                        global['resource'][global.race.species].max += $(this)[0].citizens();
                        global.settings.showCivic = true;
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['farm','city']
                };
            },
            citizens(){
                let pop = 1;
                if (global.race['high_pop']){
                    pop *= traits.high_pop.vars()[0];
                }
                return pop;
            },
            flair(){ return global.tech.agriculture >= 7 ? loc('city_farm_flair2') : loc('city_farm_flair1'); }
        },
        compost: {
            id: 'city-compost',
            title: loc('city_compost_heap'),
            desc: loc('city_compost_heap_desc'),
            category: 'residential',
            reqs: { compost: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['compost'] ? global.city['compost'].count : 0) + offset >= 3){
                        return costMultiplier('compost', offset, 50, 1.32);
                    }
                    else {
                        return 0;
                    }
                },
                Lumber(offset){ return costMultiplier('compost', offset, 12, 1.36); },
                Stone(offset){ return costMultiplier('compost', offset, 12, 1.36); }
            },
            effect(){
                let generated = 1.2 + ((global.tech['compost'] ? global.tech['compost'] : 0) * 0.8);
                generated *= global.city.biome === 'grassland' ? biomes.grassland.vars()[0] : 1;
                generated *= global.city.biome === 'savanna' ? biomes.savanna.vars()[0] : 1;
                generated *= global.city.biome === 'ashland' ? biomes.ashland.vars()[0] : 1;
                generated *= global.city.biome === 'volcanic' ? biomes.volcanic.vars()[0] : 1;
                generated *= global.city.biome === 'hellscape' ? biomes.hellscape.vars()[0] : 1;
                generated *= global.city.ptrait.includes('trashed') ? planetTraits.trashed.vars()[0] : 1;
                generated = +(generated).toFixed(2);
                let store = BHStorageMulti(spatialReasoning(200));
                let wood = global.race['kindling_kindred'] || global.race['smoldering'] ? `` : `<div class="has-text-caution">${loc('city_compost_heap_effect2',[0.5,global.resource.Lumber.name])}</div>`;
                return `<div>${loc('city_compost_heap_effect',[generated])}</div><div>${loc('city_compost_heap_effect3',[store])}</div>${wood}`;
            },
            switchable(){ return true; },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('compost','city');
                    global.city.compost.on++;
                    global['resource']['Food'].max += BHStorageMulti(spatialReasoning(200));
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['compost','city']
                };
            }
        },
        mill: {
            id: 'city-mill',
            title(){
                return global.tech['agriculture'] >= 5 ? structName('windmill') : loc('city_mill_title1');
            },
            desc(){
                let bonus = global.tech['agriculture'] >= 5 ? 5 : 3;
                if (global.tech['agriculture'] >= 6){
                    let power = $(this)[0].powered() * -1;
                    return loc('city_mill_desc2',[bonus,power]);
                }
                else {
                    return loc('city_mill_desc1',[bonus]);
                }
            },
            category: 'utility',
            reqs: { agriculture: 4 },
            not_tech: ['wind_plant'],
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('mill', offset, 1000, 1.31); },
                Lumber(offset){ return costMultiplier('mill', offset, 600, 1.33); },
                Iron(offset){ return costMultiplier('mill', offset, 150, 1.33); },
                Cement(offset){ return costMultiplier('mill', offset, 125, 1.33); },
            },
            powered(){ return powerModifier(global.race['environmentalist'] ? -(traits.environmentalist.vars()[1]) : -1); },
            power_reqs: { agriculture: 6 },
            effect(){
                if (global.tech['agriculture'] >= 6){
                    return `<span class="has-text-success">${loc('city_on')}</span> ${loc('city_mill_effect1')} <span class="has-text-danger">${loc('city_off')}</span> ${loc('city_mill_effect2')}`;
                }
                else {
                    return false;
                }
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('mill','city');
                    // Prevent alwaysPower from enabling mills that were built before researching Wind Turbines
                    if (checkPowerRequirements($(this)[0])){
                        powerOnNewStruct($(this)[0]);
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['mill','city']
                };
            },
        },
        windmill: {
            id: 'city-windmill',
            title(){
                return global.race['unfathomable'] ? loc('tech_watermill') : structName('windmill');
            },
            desc(){
                return global.race['unfathomable'] ? loc('tech_watermill') : structName('windmill');
            },
            wiki: false,
            category: 'utility',
            reqs: { wind_plant: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            powered(){ return powerModifier(global.race['environmentalist'] ? -(traits.environmentalist.vars()[1]) : -1); },
            power_reqs: { false: 1 },
            cost: {
                Money(offset){ return costMultiplier('windmill', offset, 1000, 1.31); },
                Lumber(offset){ return costMultiplier('windmill', offset, 600, 1.33); },
                Iron(offset){ return costMultiplier('windmill', offset, 150, 1.33); },
                Cement(offset){ return costMultiplier('windmill', offset, 125, 1.33); },
            },
            effect(){
                let power = $(this)[0].powered() * -1;
                return `<div>${loc('space_dwarf_reactor_effect1',[power])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('windmill','city');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['windmill','city']
                };
            },
        },
        silo: {
            id: 'city-silo',
            class: 'grain-silo-action',
            title: loc('city_silo'),
            desc: loc('city_food_storage'),
            category: 'trade',
            reqs: { agriculture: 3 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('silo', offset, 85, 1.32); },
                Lumber(offset){ return costMultiplier('silo', offset, 65, 1.36) },
                Stone(offset){ return costMultiplier('silo', offset, 50, 1.36); },
                Iron(offset){ return ((global.city.silo ? global.city.silo.count : 0) + (offset || 0)) >= 4 && global.city.ptrait.includes('unstable') ? costMultiplier('silo', offset, 10, 1.36) : 0; }
            },
            effect(){
                let food = BHStorageMulti(spatialReasoning(500));
                return loc('plus_max_resource',[food, global.resource.Food.name]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('silo','city');
                    global['resource']['Food'].max += BHStorageMulti(spatialReasoning(500));
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['silo','city']
                };
            },
        },
        assembly: buildTemplate(`assembly`,'city'),
        garrison: {
            id: 'city-garrison',
            class: 'garrison-action',
            title(){ return global.race['flier'] ? loc('city_garrison_flier') : loc('city_garrison'); },
            desc: loc('city_garrison_desc'),
            category: 'military',
            reqs: { military: 1, housing: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('garrison', offset, 240, 1.5); },
                Stone(offset){ return costMultiplier('garrison', offset, 260, 1.46); },
                Iron(offset){ return ((global.city['garrison'] ? global.city.garrison.count : 0) + (offset || 0)) >= 4 && global.city.ptrait.includes('unstable') ? costMultiplier('garrison', offset, 50, 1.4) : 0; },
                Horseshoe(){ return global.race['hooved'] ? (global.race['chameleon'] ? 1 : 2) : 0; }
            },
            effect(){
                let bunks = $(this)[0].soldiers();
                let desc = `<div>${loc('plus_max_resource',[bunks,loc('civics_garrison_soldiers')])}</div>`;
                if (global.race.universe === 'evil'){
                    desc += `<div>${loc('plus_max_resource',[0.5,global.resource.Authority.name])}</div>`;
                }
                return desc;
            },
            switchable(){ return true; },
            action(args){
                if (payCosts($(this)[0])){
                    global.settings['showMil'] = true;
                    if (!global.settings.msgFilters.combat.unlocked){
                        global.settings.msgFilters.combat.unlocked = true;
                        global.settings.msgFilters.combat.vis = true;
                    }
                    if (!global.civic.garrison.display){
                        global.civic.garrison.display = true;
                        vBind({el: `#garrison`},'update');
                        vBind({el: `#c_garrison`},'update');
                    }
                    global.civic['garrison'].max += $(this)[0].soldiers();
                    incrementStruct('garrison','city');
                    global.city['garrison'].on++;
                    global.resource.Furs.display = true;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['garrison','city']
                };
            },
            soldiers(){
                let soldiers = global.tech['military'] >= 5 ? 3 : 2;
                if (global.race['chameleon']){
                    soldiers--;
                }
                if (global.race['grenadier']){
                    soldiers--;
                }
                if (soldiers <= 0){ return 1; }
                return jobScale(soldiers);
            }
        },
        hospital: {
            id: 'city-hospital',
            title(){ return structName('hospital'); },
            desc: loc('city_hospital_desc'),
            category: 'military',
            reqs: { medic: 1 },
            not_trait: ['cataclysm','artifical'],
            cost: {
                Money(offset){ return costMultiplier('hospital', offset, 22000, 1.32); },
                Furs(offset){ return costMultiplier('hospital', offset, 4000, 1.32); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('hospital', offset, 500, 1.32) : 0; },
                Aluminium(offset){ return costMultiplier('hospital', offset, 10000, 1.32); },
            },
            effect(){
                let clinic = global.tech['reproduction'] && global.tech.reproduction >= 2 ? `<div>${loc('city_hospital_effect2')}</div>` : ``;
                let healing = (global.tech['medic'] ?? 1) * 5;
                let desc = `<div>${loc('city_hospital_effect',[healing])}</div>${clinic}`;
                if (!global.race['artifical'] && global.race.hasOwnProperty('vax')){
                    desc = desc + `<div>${loc('tau_home_disease_lab_vax',[+global.race.vax.toFixed(2)])}</div>`;
                }
                return desc;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('hospital','city');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['hospital','city']
                };
            },
        },
        boot_camp: {
            id: 'city-boot_camp',
            title(){ return global.race['artifical'] ? loc('city_boot_camp_art') : loc('city_boot_camp'); },
            desc(){ return global.race['artifical'] ? loc('city_boot_camp_art_desc',[races[global.race.species].name]) : loc('city_boot_camp_desc'); },
            category: 'military',
            reqs: { boot_camp: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('boot_camp', offset, 50000, 1.32); },
                Lumber(offset){ return costMultiplier('boot_camp', offset, 21500, 1.32); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('boot_camp', offset, 300, 1.32) : 0; },
                Aluminium(offset){ return costMultiplier('boot_camp', offset, 12000, 1.32); },
                Brick(offset){ return costMultiplier('boot_camp', offset, 1400, 1.32); },
            },
            effect(){
                let rate = global.tech['boot_camp'] >= 2 ? 8 : 5;
                if (global.blood['lust']){
                    rate += global.blood.lust * 0.2;
                }
                let milVal = govActive('militant',0);
                if (milVal){
                    rate *= 1 + (milVal / 100);
                }
                let effect = global.tech['spy'] && global.tech['spy'] >= 3 ? `<div>${loc('city_boot_camp_effect',[rate])}</div><div>${loc('city_boot_camp_effect2',[10])}</div>` : `<div>${loc('city_boot_camp_effect',[rate])}</div>`;
                if (global.race['artifical'] && !global.race['orbit_decayed']){
                    let repair = global.tech['medic'] || 1;
                    effect += `<div>${loc('city_boot_camp_art_effect',[repair * 5])}</div>`;
                }
                if (global.race['artifical'] && global.race.hasOwnProperty('vax')){
                    effect += `<div>${loc('tau_home_disease_lab_vax',[+global.race.vax.toFixed(2)])}</div>`;
                }
                return effect;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('boot_camp','city');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['boot_camp','city']
                };
            },
        },
        shed: {
            id: 'city-shed',
            class: 'shed-action',
            title(){
                return global.tech['storage'] >= 3 ? (global.tech['storage'] >= 4 ? loc('city_shed_title3') : loc('city_shed_title2')) : loc('city_shed_title1');
            },
            desc(){
                let storage = global.tech['storage'] >= 3 ? (global.tech['storage'] >= 4 ? loc('city_shed_desc_size3') : loc('city_shed_desc_size2')) : loc('city_shed_desc_size1');
                return loc('city_shed_desc',[storage]);
            },
            category: 'trade',
            reqs: { storage: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('shed', offset, 75, 1.22); },
                Lumber(offset){
                    if (global.tech['storage'] && global.tech['storage'] < 4){
                        return costMultiplier('shed', offset, 55, 1.32);
                    }
                    else {
                        return 0;
                    }
                },
                Stone(offset){
                    if (global.tech['storage'] && global.tech['storage'] < 3){
                        return costMultiplier('shed', offset, 45, 1.32);
                    }
                    else {
                        return 0;
                    }
                },
                Iron(offset){
                    if (global.tech['storage'] && global.tech['storage'] >= 4){
                        return costMultiplier('shed', offset, 22, 1.32);
                    }
                    else {
                        return 0;
                    }
                },
                Cement(offset){
                    if (global.tech['storage'] && global.tech['storage'] >= 3){
                        return costMultiplier('shed', offset, 18, 1.32);
                    }
                    else {
                        return 0;
                    }
                }
            },
            res(){
                let r_list = ['Lumber','Stone','Chrysotile','Crystal','Furs','Copper','Iron','Aluminium','Cement','Coal'];
                if (global.tech['storage'] >= 3 && global.resource.Steel.display){
                    r_list.push('Steel');
                }
                if (global.tech['storage'] >= 4 && global.resource.Titanium.display){
                    r_list.push('Titanium');
                }
                if (global.tech['shelving'] && global.tech.shelving >= 3 && global.resource.Graphene.display){
                    r_list.push('Graphene');
                }
                if (global.tech['shelving'] && global.tech.shelving >= 3 && global.resource.Stanene.display){
                    r_list.push('Stanene');
                }
                if (global.race['unfathomable']){
                    r_list.push('Food');
                }
                return r_list;
            },
            val(res){
                switch (res){
                    case 'Food':
                        return 50;
                    case 'Lumber':
                        return 300;
                    case 'Stone':
                        return 300;
                    case 'Chrysotile':
                        return 300;
                    case 'Crystal':
                        return 8;
                    case 'Furs':
                        return 125;
                    case 'Copper':
                        return 90;
                    case 'Iron':
                        return 125;
                    case 'Aluminium':
                        return 90;
                    case 'Cement':
                        return 100;
                    case 'Coal':
                        return 75;
                    case 'Steel':
                        return 40;
                    case 'Titanium':
                        return 20;
                    case 'Graphene':
                        return 15;
                    case 'Stanene':
                        return 25;
                    default:
                        return 0;
                }
            },
            effect(wiki){
                let storage = '<div class="aTable">';
                let multiplier = storageMultipler(1, wiki);
                for (const res of $(this)[0].res()){
                    if (global.resource[res].display){
                        let val = sizeApproximation(+(spatialReasoning($(this)[0].val(res)) * multiplier).toFixed(0),1);
                        storage = storage + `<span>${loc('plus_max_resource',[val,global.resource[res].name])}</span>`;
                    }
                };
                storage = storage + '</div>';
                return storage;
            },
            wide: true,
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('shed','city');
                    let multiplier = storageMultipler();
                    for (const res of $(this)[0].res()){
                        if (global.resource[res].display){
                            global.resource[res].max += (spatialReasoning($(this)[0].val(res) * multiplier));
                        }
                    };
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['shed','city']
                };
            },
        },
        storage_yard: {
            id: 'city-storage_yard',
            class: 'freight-yard-action',
            title(){ return structName('storage_yard'); },
            desc: loc('city_storage_yard_desc'),
            category: 'trade',
            reqs: { container: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('storage_yard', offset, 10, bananaPerk(1.36)); },
                Brick(offset){ return costMultiplier('storage_yard', offset, 3, bananaPerk(1.35)); },
                Wrought_Iron(offset){ return costMultiplier('storage_yard', offset, 5, bananaPerk(1.35)); }
            },
            effect(){
                let cap = global.tech.container >= 3 ? 20 : 10;
                if (global.stats.achieve['pathfinder'] && global.stats.achieve.pathfinder.l >= 1){
                    cap += 10;
                }
                if (global.tech['world_control']){
                    cap += 10;
                }
                if (global.tech['particles'] && global.tech['particles'] >= 2){
                    cap *= 2;
                }
                if (global.tech['trade'] && global.tech['trade'] >= 3){
                    return `<div>${loc('plus_max_resource',[cap,global.resource.Crates.name])}</div><div>${loc('city_trade_effect',[1])}</div>`;
                }
                else {
                    return loc('plus_max_resource',[cap,global.resource.Crates.name]);
                }
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('storage_yard','city');
                    let cap = global.tech.container >= 3 ? 20 : 10;
                    if (global.stats.achieve['pathfinder'] && global.stats.achieve.pathfinder.l >= 1){
                        cap += 10;
                    }
                    if (global.tech['world_control']){
                        cap += 10;
                    }
                    if (global.tech['particles'] && global.tech['particles'] >= 2){
                        cap *= 2;
                    }
                    global.resource.Crates.max += cap;
                    // A freight yard is always required, so this is the only struct that can unlock crates
                    // Any scenario where a freight yard is unnecessary will begin with crates unlocked
                    if (!global.resource.Crates.display){
                        unlockCrates();
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['storage_yard','city']
                };
            },
        },
        warehouse: {
            id: 'city-warehouse',
            class: 'warehouse-action',
            title: loc('city_warehouse'),
            desc: loc('city_warehouse_desc'),
            category: 'trade',
            reqs: { steel_container: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('warehouse', offset, 400, bananaPerk(1.26)); },
                Cement(offset){ return costMultiplier('warehouse', offset, 75, bananaPerk(1.26)); },
                Sheet_Metal(offset){ return costMultiplier('warehouse', offset, 25, bananaPerk(1.25)); }
            },
            effect(){
                let cap = global.tech.steel_container >= 2 ? 20 : 10;
                if (global.stats.achieve['pathfinder'] && global.stats.achieve.pathfinder.l >= 2){
                    cap += 10;
                }
                if (global.tech['world_control']){
                    cap += 10;
                }
                if (global.tech['particles'] && global.tech['particles'] >= 2){
                    cap *= 2;
                }
                return loc('plus_max_resource',[cap,global.resource.Containers.name]);
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('warehouse','city');
                    let cap = global.tech['steel_container'] >= 2 ? 20 : 10;
                    if (global.stats.achieve['pathfinder'] && global.stats.achieve.pathfinder.l >= 2){
                        cap += 10;
                    }
                    if (global.tech['world_control']){
                        cap += 10;
                    }
                    if (global.tech['particles'] && global.tech['particles'] >= 2){
                        cap *= 2;
                    }
                    global.resource.Containers.max += cap;
                    if (!global.resource.Containers.display){
                        unlockContainers();
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['warehouse','city']
                };
            },
        },
        bank: {
            id: 'city-bank',
            class: 'bank-action',
            title: loc('city_bank'),
            desc(){
                let planet = races[global.race.species].home;
                return loc('city_bank_desc',[planet]);
            },
            category: 'commercial',
            reqs: { banking: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('bank', offset, traitCostMod('untrustworthy',250), 1.35); },
                Lumber(offset){ return costMultiplier('bank', offset, traitCostMod('untrustworthy',75), 1.32); },
                Stone(offset){ return costMultiplier('bank', offset, traitCostMod('untrustworthy',100), 1.35); },
                Iron(offset){ return ((global.city['bank'] ? global.city.bank.count : 0) + (offset || 0)) >= 2 && global.city.ptrait.includes('unstable') ? costMultiplier('bank', offset, traitCostMod('untrustworthy',30), 1.3) : 0; }
            },
            effect(){
                let vault = bank_vault();
                vault = spatialReasoning(vault);
                vault = (+(vault).toFixed(0)).toLocaleString();

                if (global.tech['banking'] >= 2){
                    return `<div>${loc('plus_max_resource',[`\$${vault}`,loc('resource_Money_name')])}</div><div>${loc('plus_max_resource',[jobScale(1),loc('banker_name')])}</div>`;
                }
                else {
                    return loc('plus_max_resource',[`\$${vault}`,loc('resource_Money_name')]);
                }
            },
            action(args){
                if (payCosts($(this)[0])){
                    global['resource']['Money'].max += spatialReasoning(1800);
                    incrementStruct('bank','city');
                    global.civic.banker.max = jobScale(global.city.bank.count);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['bank','city']
                };
            }
        },
        pylon: {
            id: 'city-pylon',
            title: loc('city_pylon'),
            desc: loc('city_pylon'),
            category: 'industrial',
            reqs: { magic: 2 },
            not_trait: ['cataclysm','orbit_decayed'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['pylon'] ? global.city['pylon'].count : 0) + offset >= 2){
                        return costMultiplier('pylon', offset, 10, 1.48);
                    }
                    else {
                        return 0;
                    }
                },
                Stone(offset){ return costMultiplier('pylon', offset, 12, 1.42); },
                Crystal(offset){ return costMultiplier('pylon', offset, 8, 1.42) - 3; }
            },
            effect(){
                let max = spatialReasoning(5);
                let mana = +(0.01 * darkEffect('magic')).toFixed(3);
                return `<div>${loc('gain',[mana,global.resource.Mana.name])}</div><div>${loc('plus_max_resource',[max,global.resource.Mana.name])}</div>`;
            },
            special(){ return global.tech['magic'] && global.tech.magic >= 3 ? true : false; },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('pylon','city');
                    global.resource.Mana.max += spatialReasoning(5);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['pylon','city']
                };
            }
        },
        conceal_ward: {
            id: 'city-conceal_ward',
            title: loc('city_conceal_ward'),
            desc: loc('city_conceal_ward'),
            category: 'industrial',
            reqs: { roguemagic: 3 },
            not_trait: ['cataclysm','orbit_decayed'],
            cost: {
                Money(offset){return costMultiplier('conceal_ward', offset, 500, 1.25);  },
                Mana(offset){ return costMultiplier('conceal_ward', offset, conceal_adjust(42), 1.25); },
                Crystal(offset){ return costMultiplier('conceal_ward', offset, 5, 1.25); }
            },
            effect(){
                let ward = global.tech['roguemagic'] && global.tech.roguemagic >= 8 ? 1.25 : 1;
                return `<div>${loc('city_conceal_ward_effect',[ward])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('conceal_ward','city');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['conceal_ward','city']
                };
            }
        },
        graveyard: {
            id: 'city-graveyard',
            title: loc('city_graveyard'),
            desc: loc('city_graveyard_desc'),
            category: 'industrial',
            reqs: { reclaimer: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['graveyard'] ? global.city['graveyard'].count : 0) + offset >= 5){
                        return costMultiplier('graveyard', offset, 5, 1.85);
                    }
                    else {
                        return 0;
                    }
                },
                Lumber(offset){ return costMultiplier('graveyard', offset, 2, 1.95); },
                Stone(offset){ return costMultiplier('graveyard', offset, 6, 1.9); }
            },
            effect(){
                let lum = BHStorageMulti(spatialReasoning(100));
                return `<div>${loc('city_graveyard_effect',[8])}</div><div>${loc('plus_max_resource',[lum,global.resource.Lumber.name])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('graveyard','city');
                    global['resource']['Lumber'].max += BHStorageMulti(spatialReasoning(100));
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['graveyard','city']
                };
            }
        },
        lumber_yard: {
            id: 'city-lumber_yard',
            class: 'lumber-yard-action',
            title(){ return structName('lumberyard'); },
            desc(){ return structName('lumberyard'); },
            category: 'industrial',
            reqs: { axe: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['lumber_yard'] ? global.city['lumber_yard'].count : 0) + offset >= 5){
                        return costMultiplier('lumber_yard', offset, 5, 1.85);
                    }
                    else {
                        return 0;
                    }
                },
                Lumber(offset){ return costMultiplier('lumber_yard', offset, 6, 1.9); },
                Stone(offset){ return costMultiplier('lumber_yard', offset, 2, 1.95); }
            },
            effect(){
                let lum = BHStorageMulti(spatialReasoning(100));
                return `<div>${loc('production',[2,global.resource.Lumber.name])}</div><div>${loc('plus_max_resource',[lum,global.resource.Lumber.name])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('lumber_yard','city');
                    global.civic.lumberjack.display = true;
                    global['resource']['Lumber'].max += BHStorageMulti(spatialReasoning(100));
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['lumber_yard','city']
                };
            }
        },
        sawmill: {
            id: 'city-sawmill',
            title(){ return structName('sawmill'); },
            desc(){ return structName('sawmill'); },
            category: 'industrial',
            reqs: { saw: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('sawmill', offset, 3000, 1.26); },
                Iron(offset){ return costMultiplier('sawmill', offset, 400, 1.26); },
                Cement(offset){ return costMultiplier('sawmill', offset, 420, 1.26); }
            },
            effect(){
                let impact = global.tech['saw'] >= 2 ? 8 : 5;
                let lum = BHStorageMulti(spatialReasoning(200));
                let desc = `<div>${loc('plus_max_resource',[lum,global.resource.Lumber.name])}</div><div>${loc('production',[impact,global.resource.Lumber.name])}</div>`;
                if (global.tech['foundry'] && global.tech['foundry'] >= 4){
                    desc = desc + `<div>${loc('crafting',[2,global.resource.Plywood.name])}</div>`;
                }
                if (global.city.powered){
                    desc = desc + `<div class="has-text-caution">${loc('city_sawmill_effect3',[4,$(this)[0].powered()])}</div>`;
                }
                return desc;
            },
            powered(){ return powerCostMod(1); },
            powerBalancer(){
                return global.city.sawmill.hasOwnProperty('psaw')
                    ? [{ r: 'Lumber', k: 'psaw' }]
                    : false;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('sawmill','city');
                    global['resource']['Lumber'].max += BHStorageMulti(spatialReasoning(200));
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['sawmill','city']
                };
            }
        },
        rock_quarry: {
            id: 'city-rock_quarry',
            title(){ return global.race['flier'] ? loc('city_rock_quarry_alt') : loc('city_rock_quarry'); },
            desc(){ return global.race['flier'] ? loc('city_rock_quarry_desc_alt',[global.resource.Stone.name]) : loc('city_rock_quarry_desc'); },
            category: 'industrial',
            reqs: { mining: 1 },
            not_trait: ['cataclysm','sappy'],
            cost: {
                Money(offset){
                    offset = offset || 0;
                    if ((global.city['rock_quarry'] ? global.city['rock_quarry'].count : 0) + offset >= 2){
                        return costMultiplier('rock_quarry', offset, 20, 1.45);
                    }
                    else {
                        return 0;
                    }
                },
                Lumber(offset){ return costMultiplier('rock_quarry', offset, 50, 1.36); },
                Stone(offset){ return costMultiplier('rock_quarry', offset, 10, 1.36); }
            },
            effect(){
                let stone = BHStorageMulti(spatialReasoning(100));
                let asbestos = global.race['smoldering'] ? `<div>${loc('plus_max_resource',[stone,global.resource.Chrysotile.name])}</div>` : '';
                if (global.tech['mine_conveyor']){
                    return `<div>${loc('city_rock_quarry_effect1',[2])}</div><div>${loc('plus_max_resource',[stone,global.resource.Stone.name])}</div>${asbestos}<div class="has-text-caution">${loc('city_rock_quarry_effect2',[4,$(this)[0].powered()])}</div>`;
                }
                else {
                    return `<div>${loc('city_rock_quarry_effect1',[2])}</div><div>${loc('plus_max_resource',[stone,global.resource.Stone.name])}</div>${asbestos}`;
                }
            },
            special(){ return global.race['smoldering'] ? true : false; },
            powered(){ return powerCostMod(1); },
            powerBalancer(){
                if (global.city.rock_quarry.hasOwnProperty('cnvay')){
                    if (global.city.hasOwnProperty('metal_refinery') && global.city.rock_quarry.hasOwnProperty('almcvy')){
                        return [
                            { r: 'Stone', k: 'cnvay' },
                            { r: 'Aluminium', k: 'almcvy' },
                        ];
                    }
                    return [{ r: 'Stone', k: 'cnvay' }];
                }
                return false;
            },
            power_reqs: { mine_conveyor: 1 },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('rock_quarry','city');
                    global.civic.quarry_worker.display = true;
                    let stone = BHStorageMulti(spatialReasoning(100));
                    global['resource']['Stone'].max += stone;
                    if (global.race['smoldering'] && global.resource.Chrysotile.display){
                        global['resource']['Chrysotile'].max += stone;
                        if (global.city.rock_quarry.count === 1){
                            global.settings.showCivic = true;
                            global.settings.showIndustry = true;
                            defineIndustry();
                        }
                    }
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: {
                        count: 0,
                        on: 0,
                        asbestos: 50
                    },
                    p: ['rock_quarry','city']
                };
            },
        },
        cement_plant: {
            id: 'city-cement_plant',
            class: 'cement-plant-action',
            title: loc('city_cement_plant'),
            desc: loc('city_cement_plant_desc'),
            category: 'industrial',
            reqs: { cement: 1 },
            not_trait: ['cataclysm','lone_survivor','flier'],
            cost: {
                Money(offset){ return costMultiplier('cement_plant', offset, 3000, 1.5); },
                Lumber(offset){ return costMultiplier('cement_plant', offset, 1800, 1.36); },
                Stone(offset){ return costMultiplier('cement_plant', offset, 2000, 1.32); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('cement_plant', offset, 275, 1.32) : 0; }
            },
            effect(){
                if (global.tech['cement'] >= 5){
                    let screws = global.tech['cement'] >= 6 ? 8 : 5;
                    return `<div>${loc('plus_max_resource',[jobScale(2),loc(`job_cement_worker`)])}</div><div class="has-text-caution">${loc('city_cement_plant_effect2',[$(this)[0].powered(),screws])}</div>`;
                }
                else {
                    return loc('plus_max_resource',[jobScale(2),loc(`job_cement_worker`)]);
                }
            },
            powered(){ return powerCostMod(2); },
            powerBalancer(){
                return global.city.cement_plant.hasOwnProperty('cnvay')
                    ? [{ r: 'Cement', k: 'cnvay' }]
                    : false;
            },
            power_reqs: { cement: 5 },
            action(args){
                if (payCosts($(this)[0])){
                    global.resource.Cement.display = true;
                    incrementStruct('cement_plant','city');
                    global.civic.cement_worker.display = true;
                    global.civic.cement_worker.max = global.city.cement_plant.count * jobScale(2);
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['cement_plant','city']
                };
            }
        },
        foundry: {
            id: 'city-foundry',
            class: 'foundry-action',
            title: loc('city_foundry'),
            desc: loc('city_foundry_desc'),
            category: 'industrial',
            reqs: { foundry: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('foundry', offset, 750, 1.36); },
                Stone(offset){ return costMultiplier('foundry', offset, 100, 1.36); },
                Copper(offset){ return costMultiplier('foundry', offset, 250, 1.36); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('foundry', offset, 40, 1.36) : 0; },
            },
            effect(){
                let desc = `<div>${loc('city_foundry_effect1',[jobScale(1)])}</div>`;
                if (global.tech['foundry'] >= 2){
                    let skill = global.tech['foundry'] >= 5 ? (global.tech['foundry'] >= 8 ? 8 : 5) : 3;
                    desc = desc + `<div>${loc('city_crafted_mats',[skill])}</div>`;
                }
                if (global.tech['foundry'] >= 6){
                    desc = desc + `<div>${loc('city_foundry_effect2',[2])}</div>`;
                }
                return desc;
            },
            action(args){
                if (payCosts($(this)[0])){
                    if (global.city['foundry'].count === 0){
                        if (global.race['no_craft']) {
                            messageQueue(loc('city_foundry_msg2'),'info',false,['progress']);
                        }
                        else {
                            messageQueue(loc('city_foundry_msg1'),'info',false,['progress']);
                        }
                    }
                    incrementStruct('foundry','city');
                    global.civic.craftsman.max += jobScale(1);
                    global.civic.craftsman.display = true;
                    if (!global.race['kindling_kindred'] && !global.race['smoldering']){
                        global.resource.Plywood.display = true;
                    }
                    global.resource.Brick.display = true;
                    if (global.resource.Iron.display){
                        global.resource.Wrought_Iron.display = true;
                    }
                    if (global.resource.Aluminium.display){
                        global.resource.Sheet_Metal.display = true;
                    }
                    loadFoundry();
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: {
                        count: 0,
                        crafting: 0,
                        Plywood: 0,
                        Brick: 0,
                        Bronze: 0,
                        Wrought_Iron: 0,
                        Sheet_Metal: 0,
                        Mythril: 0,
                        Aerogel: 0,
                        Nanoweave: 0,
                        Scarletite: 0,
                        Quantium: 0,
                    },
                    p: ['foundry','city']
                };
            }
        },
        factory: {
            id: 'city-factory',
            title(){ return structName('factory'); },
            desc: `<div>${loc('city_factory_desc')}</div><div class="has-text-special">${loc('requires_power')}</div>`,
            category: 'industrial',
            reqs: { high_tech: 3 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('factory', offset, 25000, dirt_adjust(1.32)); },
                Cement(offset){ return costMultiplier('factory', offset, 1000, dirt_adjust(1.32)); },
                Steel(offset){ return costMultiplier('factory', offset, 7500, dirt_adjust(1.32)); },
                Titanium(offset){ return costMultiplier('factory', offset, 2500, dirt_adjust(1.32)); }
            },
            effect(){
                let desc = `<div>${loc('city_factory_effect')}</div><div class="has-text-caution">${loc('minus_power',[$(this)[0].powered()])}</div>`;
                if (global.tech['foundry'] >= 7){
                    desc = desc + `<div>${loc('city_crafted_mats',[5])}</div>`;
                }
                return desc;
            },
            powered(){ return powerCostMod(3); },
            special: true,
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('factory','city');
                    if (global.city.factory.count === 1){
                        global.resource.Alloy.display = true;
                        if (global.tech['polymer']){
                            global.resource.Polymer.display = true;
                        }
                        global.settings.showIndustry = true;
                        defineIndustry();
                    }
                    if (powerOnNewStruct($(this)[0])){
                        global.city.factory.Alloy++;
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: {
                        count: 0,
                        on: 0,
                        Lux: 0,
                        Furs: 0,
                        Alloy: 0,
                        Polymer: 0,
                        Nano: 0,
                        Stanene: 0
                    },
                    p: ['factory','city']
                };
            },
        },
        nanite_factory: buildTemplate(`nanite_factory`,'city'),
        smelter: {
            id: 'city-smelter',
            title: loc('city_smelter'),
            desc: loc('city_smelter_desc'),
            category: 'industrial',
            reqs: { smelting: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('smelter', offset, 1000, dirt_adjust(1.32)); },
                Iron(offset){ return costMultiplier('smelter', offset, 500, dirt_adjust(1.33)); }
            },
            effect(){
                var iron_yield = global.tech['smelting'] >= 3 ? (global.tech['smelting'] >= 7 ? 15 : 12) : 10;
                if (global.race['pyrophobia']){
                    iron_yield *= 0.9;
                }
                if (global.tech['smelting'] >= 2 && !global.race['steelen']){
                    return loc('city_smelter_effect2',[iron_yield]);
                }
                else {
                    return loc('city_smelter_effect1',[iron_yield]);
                }
            },
            special: true,
            smelting(){
                return 1;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('smelter','city');
                    let fuel = 'Wood';
                    if (global.race['artifical']){
                        fuel = 'Oil';
                    }
                    else if ((global.race['kindling_kindred'] || global.race['smoldering']) && !global.race['evil']) {
                        fuel = 'Coal';
                    }
                    addSmelter($(this)[0].smelting(), 'Iron', fuel);
                    if (global.city.smelter.count === 1){
                        global.settings.showIndustry = true;
                        defineIndustry();
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: {
                        count: 0,
                        cap: 0,
                        Wood: 0,
                        Coal: 0,
                        Oil: 0,
                        Star: 0,
                        StarCap: 0,
                        Inferno: 0,
                        Iron: 0,
                        Steel: 0,
                        Iridium: 0
                    },
                    p: ['smelter','city']
                };
            },
            flair: `<div>${loc('city_smelter_flair1')}<div></div>${loc('city_smelter_flair2')}</div>`
        },
        metal_refinery: {
            id: 'city-metal_refinery',
            title: loc('city_metal_refinery'),
            desc: loc('city_metal_refinery_desc'),
            category: 'industrial',
            reqs: { alumina: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('metal_refinery', offset, 2500, 1.35); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('metal_refinery', offset, 125, 1.35) : 0; },
                Steel(offset){ return costMultiplier('metal_refinery', offset, 350, 1.35); }
            },
            powered(){ return powerCostMod(2); },
            powerBalancer(){
                return global.city.metal_refinery.hasOwnProperty('pwr')
                    ? [{ r: 'Aluminium', k: 'cnvay' }]
                    : false;
            },
            power_reqs: { alumina: 2 },
            effect(){
                let label = global.race['sappy'] ? 'city_metal_refinery_effect_alt' : 'city_metal_refinery_effect';
                if (global.tech['alumina'] >= 2){
                    return `<span>${loc(label,[6])}</span> <span class="has-text-caution">${loc('city_metal_refinery_effect2',[6,12,$(this)[0].powered()])}</span>`;
                }
                else {
                    return loc(label,[6]);
                }
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('metal_refinery','city');
                    global.resource.Aluminium.display = true;
                    if (global.city['foundry'] && global.city.foundry.count > 0 && !global.resource.Sheet_Metal.display){
                        global.resource.Sheet_Metal.display = true;
                        loadFoundry();
                    }
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: {
                        count: 0,
                        on: 0,
                    },
                    p: ['metal_refinery','city']
                };
            },
        },
        mine: {
            id: 'city-mine',
            class: 'mine-action',
            title(){ return structName('mine'); },
            desc: loc('city_mine_desc'),
            category: 'industrial',
            reqs: { mining: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('mine', offset, 60, dirt_adjust(1.6)); },
                Lumber(offset){ return costMultiplier('mine', offset, 175, dirt_adjust(1.38)); }
            },
            effect(){
                if (global.tech['mine_conveyor']){
                    return `<div>${loc('plus_max_resource',[jobScale(1),loc(`job_miner`)])}</div><div class="has-text-caution">${loc('city_mine_effect2',[$(this)[0].powered(),5])}</div>`;
                }
                else {
                    return loc('plus_max_resource',[jobScale(1),loc(`job_miner`)]);
                }
            },
            powered(){ return powerCostMod(1); },
            powerBalancer(){
                return global.city.mine.hasOwnProperty('cpow') && global.city.mine.hasOwnProperty('ipow')
                    ? [{ r: 'Copper', k: 'cpow' },{ r: 'Iron', k: 'ipow' }]
                    : false;
            },
            power_reqs: { mine_conveyor: 1 },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct($(this)[0]);
                    global.resource.Copper.display = true;
                    global.civic.miner.display = true;
                    global.civic.miner.max = jobScale(global.city.mine.count);
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['mine','city']
                };
            },
            flair(){
                return races[global.race.species].type === 'avian' ? loc(`city_mine_flair_avian`) : '';
            }
        },
        coal_mine: {
            id: 'city-coal_mine',
            title(){ return structName('coal_mine'); },
            desc: loc('city_coal_mine_desc'),
            category: 'industrial',
            reqs: { mining: 4 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('coal_mine', offset, 480, dirt_adjust(1.4)); },
                Lumber(offset){ return costMultiplier('coal_mine', offset, 250, dirt_adjust(1.36)); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('coal_mine', offset, 28, dirt_adjust(1.36)) : 0; },
                Wrought_Iron(offset){ return costMultiplier('coal_mine', offset, 18, dirt_adjust(1.36)); }
            },
            effect(){
                if (global.tech['mine_conveyor']){
                    return `<div>${loc('plus_max_resource',[jobScale(1),loc(`job_coal_miner`)])}</div><div class="has-text-caution">${loc('city_coal_mine_effect2',[$(this)[0].powered(),5])}</div>`;
                }
                else {
                    return loc('plus_max_resource',[jobScale(1),loc(`job_coal_miner`)]);
                }
            },
            powered(){ return powerCostMod(1); },
            powerBalancer(){
                return global.city.coal_mine.hasOwnProperty('cpow') && global.city.coal_mine.hasOwnProperty('upow') && global.resource.Uranium.display
                    ? [{ r: 'Coal', k: 'cpow' },{ r: 'Uranium', k: 'upow' }]
                    : (global.city.coal_mine.hasOwnProperty('cpow') ? [{ r: 'Coal', k: 'cpow' }] : false);
            },
            power_reqs: { mine_conveyor: 1 },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct($(this)[0]);
                    global.resource.Coal.display = true;
                    global.civic.coal_miner.display = true;
                    global.civic.coal_miner.max = jobScale(global.city.coal_mine.count);
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['coal_mine','city']
                };
            },
        },
        oil_well: {
            id: 'city-oil_well',
            title(){ return global.race['blubber'] ? loc('tech_oil_refinery') : loc('city_oil_well'); },
            desc(){ return global.race['blubber'] ? loc('city_oil_well_blubber') : loc('city_oil_well_desc'); },
            category: 'industrial',
            reqs: { oil: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('oil_well', offset, 5000, dirt_adjust(1.5)); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('oil_well', offset, 450, dirt_adjust(1.5)) : 0; },
                Cement(offset){ return costMultiplier('oil_well', offset, 5250, dirt_adjust(1.5)); },
                Steel(offset){ return costMultiplier('oil_well', offset, 6000, dirt_adjust(1.5)); }
            },
            effect(){
                let oil = +(production('oil_well')).toFixed(2);
                let oc = spatialReasoning(500);
                let desc = `<div>${loc('city_oil_well_effect',[oil,oc])}</div>`;
                if (global.race['blubber'] && global.city.hasOwnProperty('oil_well')){
                    let maxDead = global.city.oil_well.count + (global.space['oil_extractor'] ? global.space.oil_extractor.count : 0);
                    desc += `<div>${loc('city_oil_well_bodies',[+(global.city.oil_well.dead).toFixed(1),50 * maxDead])}</div>`;
                    desc += `<div>${loc('city_oil_well_consume',[traits.blubber.vars()[0]])}</div>`;
                }
                return desc;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('oil_well','city');
                    global['resource']['Oil'].max += spatialReasoning(500);
                    if (global.city.oil_well.count === 1) {
                        global.resource.Oil.display = true;
                        defineIndustry();
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, dead: 0 },
                    p: ['oil_well','city']
                };
            },
            flair: loc('city_oil_well_flair')
        },
        oil_depot: {
            id: 'city-oil_depot',
            title: loc('city_oil_depot'),
            desc: loc('city_oil_depot_desc'),
            category: 'trade',
            reqs: { oil: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('oil_depot', offset, 2500, dirt_adjust(1.46)); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('oil_depot', offset, 325, dirt_adjust(1.36)) : 0; },
                Cement(offset){ return costMultiplier('oil_depot', offset, 3750, dirt_adjust(1.46)); },
                Sheet_Metal(offset){ return costMultiplier('oil_depot', offset, 100, dirt_adjust(1.45)); }
            },
            effect() {
                let oil = spatialReasoning(1000);
                oil *= global.tech['world_control'] ? 1.5 : 1;
                let effect = `<div>${loc('plus_max_resource',[oil,global.resource.Oil.name])}.</div>`;
                if (global.resource['Helium_3'].display){
                    let val = spatialReasoning(400);
                    val *= global.tech['world_control'] ? 1.5 : 1;
                    effect = effect + `<div>${loc('plus_max_resource',[val,global.resource.Helium_3.name])}.</div>`;
                }
                if (global.tech['uranium'] >= 2){
                    let val = spatialReasoning(250);
                    val *= global.tech['world_control'] ? 1.5 : 1;
                    effect = effect + `<div>${loc('plus_max_resource',[val,global.resource.Uranium.name])}.</div>`;
                }
                return effect;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('oil_depot','city');
                    global['resource']['Oil'].max += spatialReasoning(1000) * (global.tech['world_control'] ? 1.5 : 1);
                    if (global.resource['Helium_3'].display){
                        global['resource']['Helium_3'].max += spatialReasoning(400) * (global.tech['world_control'] ? 1.5 : 1);
                    }
                    if (global.tech['uranium'] >= 2){
                        global['resource']['Uranium'].max += spatialReasoning(250) * (global.tech['world_control'] ? 1.5 : 1);
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['oil_depot','city']
                };
            },
        },
        trade: {
            id: 'city-trade',
            title: loc('city_trade'),
            desc: loc('city_trade_desc'),
            category: 'trade',
            reqs: { trade: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('trade', offset, 500, 1.36); },
                Lumber(offset){ return costMultiplier('trade', offset, 125, 1.36); },
                Stone(offset){ return costMultiplier('trade', offset, 50, 1.36); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('trade', offset, 15, 1.36) : 0; },
                Furs(offset){ return costMultiplier('trade', offset, 65, 1.36); }
            },
            effect(){
                return loc('city_trade_effect',[$(this)[0].routes()]);
            },
            routes(){
                let routes = (global.tech['trade'] >= 2) ? 3 : 2;
                if (global.race['xenophobic'] || global.race['nomadic']){
                    routes--;
                }
                if (global.race['flier']){
                    routes += traits.flier.vars()[1];
                }
                return routes;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('trade','city');
                    global.city.market.mtrade += $(this)[0].routes();
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['trade','city']
                };
            }
        },
        wharf: {
            id: 'city-wharf',
            title: loc('city_wharf'),
            desc: loc('city_wharf_desc'),
            category: 'trade',
            era: 'industrialized',
            reqs: { wharf: 1 },
            not_trait: ['thalassophobia','cataclysm','warlord'],
            cost: {
                Money(offset){ return costMultiplier('wharf', offset, 62000, 1.32); },
                Lumber(offset){ return costMultiplier('wharf', offset, 44000, 1.32); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('wharf', offset, 200, 1.32) : 0; },
                Cement(offset){ return costMultiplier('wharf', offset, 3000, 1.32); },
                Oil(offset){ return costMultiplier('wharf', offset, 750, 1.32); }
            },
            effect(){
                let containers = global.tech['world_control'] ? 15 : 10;
                if (global.tech['particles'] && global.tech['particles'] >= 2){
                    containers *= 2;
                }
                return `<div>${loc('city_trade_effect',[2])}</div><div>${loc('city_wharf_effect')}</div><div>${loc('plus_max_crates',[containers])}</div><div>${loc('plus_max_containers',[containers])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('wharf','city');
                    global.city.market.mtrade += 2;
                    let vol = global.tech['world_control'] ? 15 : 10;
                    if (global.tech['particles'] && global.tech['particles'] >= 2){
                        vol *= 2;
                    }
                    global.resource.Crates.max += vol;
                    global.resource.Containers.max += vol;
                    if (!global.resource.Containers.display){
                        unlockContainers();
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['wharf','city']
                };
            }
        },
        tourist_center: {
            id: 'city-tourist_center',
            title: loc('city_tourist_center'),
            desc: loc('city_tourist_center_desc'),
            category: 'commercial',
            reqs: { monument: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('tourist_center', offset, 100000, 1.36); },
                Stone(offset){ return costMultiplier('tourist_center', offset, 25000, 1.36); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('tourist_center', offset, 1000, 1.36) : 0; },
                Furs(offset){ return costMultiplier('tourist_center', offset, 7500, 1.36); },
                Plywood(offset){ return costMultiplier('tourist_center', offset, 5000, 1.36); },
            },
            effect(wiki){
                let xeno = global.tech['monument'] && global.tech.monument >= 3 && isStargateOn(wiki) ? 3 : 1;
                let amp = (global.civic.govern.type === 'corpocracy' ? 2 : 1) * xeno;
                let cas = (global.civic.govern.type === 'corpocracy' ? 10 : 5) * xeno;
                let mon = (global.civic.govern.type === 'corpocracy' ? 4 : 2) * xeno;

                let desc = `<div class="has-text-caution">${loc('city_tourist_center_effect1',[global.resource.Food.name])}</div>`;
                desc += `<div>${loc('city_tourist_center_effect2',[amp,actions.city.amphitheatre.title()])}</div>`;
                desc += `<div>${loc('city_tourist_center_effect2',[cas,structName('casino')])}</div>`;
                desc += `<div>${loc('city_tourist_center_effect2',[mon,loc(`arpa_project_monument_title`)])}</div>`;
                if (global.stats.achieve['banana'] && global.stats.achieve.banana.l >= 4){
                    desc += `<div>${loc(`city_tourist_center_effect2`,[(global.civic.govern.type === 'corpocracy' ? 6 : 3) * xeno, loc('city_trade')])}</div>`;
                }
                let piousVal = govActive('pious',1);
                if (piousVal){
                    desc += `<div>${loc(`city_tourist_center_effect2`,[(global.civic.govern.type === 'corpocracy' ? (piousVal * 2) : piousVal) * xeno, structName('temple')])}</div>`;
                }

                return desc;
            },
            powered(){ return 0; },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('tourist_center','city');
                    global.city.tourist_center.on++;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['tourist_center','city']
                };
            },
        },
        amphitheatre: {
            id: 'city-amphitheatre',
            class: 'amphitheatre-action',
            title(){
                if (global.race.universe === 'evil'){
                    return loc('city_colosseum');
                }
                let athVal = govActive('athleticism',0);
                return athVal ? loc('city_stadium') : loc('city_amphitheatre');
            },
            desc(){
                if (global.race.universe === 'evil'){
                    return loc('city_colosseum');
                }
                let athVal = govActive('athleticism',0);
                return athVal ? loc('city_stadium') : loc('city_amphitheatre_desc');
            },
            category: 'commercial',
            reqs: { theatre: 1 },
            not_trait: ['joyless','cataclysm'],
            cost: {
                Money(offset){ return costMultiplier('amphitheatre', offset, 500, 1.55); },
                Lumber(offset){ return costMultiplier('amphitheatre', offset, 50, 1.75); },
                Stone(offset){ return costMultiplier('amphitheatre', offset, 200, 1.75); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('amphitheatre', offset, 18, 1.36) : 0; },
            },
            effect(){
                let athVal1 = govActive('athleticism',0);
                let athVal2 = govActive('athleticism',1);
                return`<div>${loc('plus_max_resource',[jobScale(athVal2 ? athVal2 : 1),loc(`job_entertainer`)])}</div><div>${loc('city_max_morale',[athVal1 ? athVal1 : 1])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('amphitheatre','city');
                    let athVal2 = govActive('athleticism',1);
                    global.civic.entertainer.max += jobScale(athVal2 ? athVal2 : 1);
                    global.civic.entertainer.display = true;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, evil: 0 },
                    p: ['amphitheatre','city']
                };
            },
            flair(){
                if (global.race.universe === 'evil'){
                    return loc('city_colosseum_flair');
                }
                let athVal = govActive('athleticism',0);
                return athVal ? loc('city_stadium_flair') : loc('city_amphitheatre_flair');
            },
        },
        casino: {
            id: 'city-casino',
            title(){ return structName('casino'); },
            desc(){ return structName('casino'); },
            category: 'commercial',
            reqs: { gambling: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('casino', offset, traitCostMod('untrustworthy',350000), 1.35); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('casino', offset, traitCostMod('untrustworthy',2000), 1.35) : 0; },
                Furs(offset){ return costMultiplier('casino', offset, traitCostMod('untrustworthy',60000), 1.35); },
                Plywood(offset){ return costMultiplier('casino', offset, traitCostMod('untrustworthy',10000), 1.35); },
                Brick(offset){ return costMultiplier('casino', offset, traitCostMod('untrustworthy',6000), 1.35); }
            },
            effect(){
                let desc = casinoEffect();
                desc = desc + `<div class="has-text-caution">${loc('minus_power',[$(this)[0].powered()])}</div>`;
                return desc;
            },
            powered(){ return powerCostMod(global.stats.achieve['dissipated'] && global.stats.achieve['dissipated'].l >= 2 ? 2 : 3); },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('casino','city');
                    if (global.tech['theatre'] && !global.race['joyless']){
                        global.civic.entertainer.max += jobScale(1);
                        global.civic.entertainer.display = true;
                    }
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['casino','city']
                };
            },
            flair: loc('city_casino_flair')
        },
        temple: {
            id: 'city-temple',
            title(){ return structName('temple'); },
            desc(){
                let entity = global.race.gods !== 'none' ? races[global.race.gods.toLowerCase()].entity : races[global.race.species].entity;
                return global.race.universe === 'evil' && global.civic.govern.type != 'theocracy' ? loc('city_temple_desc_evil',[entity]) : loc('city_temple_desc',[entity]);
            },
            category: 'commercial',
            reqs: { theology: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('temple', offset, 50, 1.36); },
                Lumber(offset){ return costMultiplier('temple', offset, 25, 1.36); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('temple', offset, 6, 1.36) : 0; },
                Furs(offset){ return costMultiplier('temple', offset, 15, 1.36); },
                Cement(offset){ return costMultiplier('temple', offset, 10, 1.36); }
            },
            effect(){
                let desc = templeEffect();
                if (global.genes['ancients'] && global.genes['ancients'] >= 2){
                    desc = desc + `<div>${loc('plus_max_resource',[jobScale(1),global.civic?.priest?.name || loc(`job_priest`)])}</div>`;
                }
                if (global.race.universe === 'evil'){
                    desc += `<div>${loc('plus_max_resource',[0.5,global.resource.Authority.name])}</div>`;
                }
                return desc;
            },
            action(args){
                if (payCosts($(this)[0])){
                    if (global.genes['ancients'] && global.genes['ancients'] >= 2){
                        global.civic.priest.display = true;
                        global.civic.priest.max += jobScale(1);
                    }
                    incrementStruct('temple','city');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['temple','city']
                };
            },
        },
        wonder_lighthouse: {
            id: 'city-wonder_lighthouse',
            title(){
                return loc('city_wonder_lighthouse',[races[global.race.species].home]);
            },
            desc(){
                return loc('city_wonder_lighthouse',[races[global.race.species].home]);
            },
            category: 'commercial',
            reqs: {},
            condition(){
                return global.race['wish'] && global.race['wishStats'] && global.city['wonder_lighthouse'] ? true : false;
            },
            trait: ['wish'],
            wiki: false,
            queue_complete(){ return false; },
            effect(){
                return loc(`city_wonder_effect`,[5]);
            },
            action(args){
                return false;
            }
        },
        wonder_pyramid: {
            id: 'city-wonder_pyramid',
            title(){
                return loc('city_wonder_pyramid',[races[global.race.species].name]);
            },
            desc(){
                return loc('city_wonder_pyramid',[races[global.race.species].name]);
            },
            category: 'commercial',
            reqs: {},
            condition(){
                return global.race['wish'] && global.race['wishStats'] && global.city['wonder_pyramid'] ? true : false;
            },
            trait: ['wish'],
            wiki: false,
            queue_complete(){ return false; },
            effect(){
                return loc(`city_wonder_effect`,[5]);
            },
            action(args){
                return false;
            }
        },
        shrine: buildTemplate(`shrine`,'city'),
        meditation: buildTemplate(`meditation`,'city'),
        banquet: {
            id: 'city-banquet',
            title: loc('city_banquet'),
            desc: loc(`city_banquet_desc`),
            category: 'commercial',
            reqs: { banquet:1 },
            queue_complete(){ return global.stats.achieve['endless_hunger'] ? global.stats.achieve['endless_hunger'].l - global.city['banquet'].level : 0},
            no_multi: true,
            condition(){
                return global.stats.achieve['endless_hunger'] && global.stats.achieve['endless_hunger'].l >= 1 ? true : false;
            },
            cost: {
                Money(offset){
                    const level = (offset ? offset : 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                    switch (level){
                        case 0:
                            return 45000;
                        case 1:
                            return 180000;
                        case 2:
                            return 2400000;
                        case 3:
                            return 30000000;
                        case 4:
                            return 140000000;
                        default:
                            return 0;
                    }
                },
                Food(offset){
                    const level = (offset ? offset : 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                    return (() => {
                        switch (level){
                            case 0:
                                return 40000;
                            case 1:
                                return 124000;
                            case 2:
                                return 300000;
                            case 3:
                                return 720000;
                            case 4:
                                return 1200000;
                            default:
                                return 0;
                        }
                    })() * (global.race['artifical'] ? 0.25 : 1);
                },
                Brick(offset){ 
                    const level = (offset ? offset : 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                    switch (level){
                        case 0:
                            return 1600;
                        case 1:
                            return 18000;
                        case 2:
                            return 75000;
                        default:
                            return 0;
                    }
                },
                Wrought_Iron(offset){
                    const level = (offset ? offset : 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                    switch (level){
                        case 0:
                            return 0;
                        case 1:
                            return 26000;
                        case 2:
                            return 88000;
                        case 3:
                            return 144000;
                        case 4:
                            return 240000;
                        default:
                            return 0;
                    }
                },
                Iridium(offset){
                    const level = (offset ? offset : 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                    switch (level){
                        case 2:
                            return 50000;
                        case 3:
                            return 270000;
                        case 4:
                            return 700000;
                        default:
                            return 0;
                    }
                },
                Aerogel(offset, wiki){
                    const level = (offset ? offset : 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                    if(wiki ? wiki.truepath : global.race['truepath']){
                        return 0;
                    }
                    switch (level){
                        case 3:
                            return 40000;
                        case 4:
                            return 150000;
                        default:
                            return 0;
                    }
                },
                Quantium(offset, wiki){
                    const level = (offset ? offset : 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                    if(wiki ? !wiki.truepath : !global.race['truepath']){
                        return 0;
                    }
                    switch (level){
                        case 3:
                            return 40000;
                        case 4:
                            return 150000;
                        default:
                            return 0;
                    }
                },
                Bolognium(offset){
                    const level = (offset ? offset : 0) || (global.city['banquet'] ? global.city['banquet'].level : 0);
                    switch (level){
                        case 4:
                            return 150000;
                        default:
                            return 0;
                    }
                }
            },
            effect(wiki){
                let strength = global.city['banquet'] ? global.city['banquet'].strength : 0;
                let level = (wiki?.count ?? 0) + (global.city['banquet'] ? global.city['banquet'].level : 0);
                let desc = `<div>Strength: <span class="has-text-caution">${strength}</span></div>`;
                desc += `<div>${loc(`city_banquet_effect1`, [sizeApproximation(((level >= 5 ? 1.02 : 1.022)**(strength) - 1) * 100)])}</div>`;
                if(level >= 1){
                    desc += `<div>${loc(`city_banquet_effect2`, [(strength**0.75).toFixed(2)])}</div>`;
                }
                if(level >= 2){
                    desc += `<div>${loc(`city_banquet_effect3`, [(strength**0.65).toFixed(2)])}</div>`;
                }
                if(level >= 3){
                    desc += `<div>${loc(`city_banquet_effect4`, [(strength**0.65).toFixed(2)])}</div>`;
                }
                if(level >= 4){
                    desc += `<div>${loc(`city_banquet_effect5`, [(strength**0.75).toFixed(2)])}</div>`;
                }
                return desc;
            },
            powered(){ return 0; },
            action(args){
                if (global.city['banquet'].level < global.stats.achieve['endless_hunger'].l && payCosts($(this)[0])){
                    incrementStruct('banquet','city');
                    global.city['banquet'].level++;
                    if(global.city['banquet'].level === 1){
                        global.city['banquet'].on = 1;
                    }
                    global.city['banquet'].count = 1; //banquet hall can be powered on once at most
                    drawCity();
                    return true;
                }
                return false;
            },
            count(){ return global.city['banquet'].level },
            struct(){
                return {
                    d: { count: 0, on: 0, strength: 0, level: 0 },
                    p: ['banquet','city']
                };
            },
            flair: loc('city_banquet_flair')
        },
        university: {
            id: 'city-university',
            class: 'university-action',
            title: loc('city_university'),
            desc(){
                let planet = races[global.race.species].home;
                return loc('city_university_desc',[planet]);
            },
            category: 'science',
            reqs: { science: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('university', offset, 900, 1.5) - 500; },
                Lumber(offset){ return costMultiplier('university', offset, 500, 1.36) - 200; },
                Stone(offset){ return costMultiplier('university', offset, 750, 1.36) - 350; },
                Crystal(offset){ return global.race.universe === 'magic' ? costMultiplier('university', offset, 5, 1.36) : 0; },
                Iron(offset){ return ((global.city['university'] ? global.city.university.count : 0) + (offset || 0)) >= 3 && global.city.ptrait.includes('unstable') ? costMultiplier('university', offset, 25, 1.36) : 0; }
            },
            effect(wiki){
                let gain = +($(this)[0].knowVal(wiki)).toFixed(0);
                return `<div>${loc('city_university_effect',[jobScale(1)])}</div><div>${loc('city_max_knowledge',[gain.toLocaleString()])}</div>`;
            },
            knowVal(wiki){
                let multiplier = 1;
                let base = global.tech['science'] && global.tech['science'] >= 8 ? 700 : 500;
                if (global.city.ptrait.includes('permafrost')){
                    base += planetTraits.permafrost.vars()[1];
                }
                if (global.tech['science'] >= 4){
                    multiplier += global.city.library.count * 0.02;
                }
                if (global.space['observatory'] && global.space.observatory.count > 0){
                    multiplier += (wiki ? global.space.observatory.on : support_on['observatory']) * 0.05;
                }
                if (global.portal['sensor_drone'] && global.tech['science'] >= 14){
                    multiplier += (wiki ? global.portal.sensor_drone.on : p_on['sensor_drone']) * 0.02;
                }
                if (global.race['hard_of_hearing']){
                    multiplier *= 1 - (traits.hard_of_hearing.vars()[0] / 100);
                }
                if (global.race['curious']){
                    multiplier *= 1 + (traits.curious.vars()[0] / 100 * global.resource[global.race.species].amount);
                }
                let fathom = fathomCheck('cath');
                if (fathom > 0){
                    multiplier *= 1 + (traits.curious.vars(3)[0] * fathom);
                }
                let sg_on = isStargateOn(wiki);
                let num_tech_scavs_on = sg_on ? (wiki ? (global.galaxy?.scavenger?.on ?? 0) : gal_on['scavenger']) : 0;
                if (num_tech_scavs_on > 0){
                    let pirate_alien2 = piracy('gxy_alien2', false, false, wiki);
                    let uni = num_tech_scavs_on * pirate_alien2 / 4;
                    multiplier *= 1 + uni;
                }
                let teachVal = govActive('teacher',0);
                if (teachVal){
                    multiplier *= 1 + (teachVal / 100);
                }
                let athVal = govActive('athleticism',2);
                if (athVal){
                    multiplier *= 1 - (athVal / 100);
                }
                if (shrineBonusActive()){
                    let shrineBonus = getShrineBonus('know');
                    multiplier *= shrineBonus.mult;
                }
                let gain = (base * multiplier);
                if (global.tech['supercollider']){
                    let ratio = global.tech['tp_particles'] || (global.tech['particles'] && global.tech.particles >= 3) ? 12.5: 25;
                    gain *= (global.tech['supercollider'] / ratio) + 1;
                }
                if (global.race['orbit_decayed']){
                    if (global.space['satellite']){
                        gain *= 1 + (global.space.satellite.count * 0.12);
                    }
                    if (global.tech['biotech'] && global.tech['biotech'] >= 1){
                        gain *= 2;
                    }
                }
                return gain;
            },
            action(args){
                if (payCosts($(this)[0])){
                    let gain = global.tech['science'] && global.tech['science'] >= 8 ? 700 : 500;
                    if (global.tech['science'] >= 4){
                        gain *= 1 + (global.city.library.count * 0.02);
                    }
                    if (global.tech['supercollider']){
                        let ratio = global.tech['particles'] && global.tech['particles'] >= 3 ? 12.5: 25;
                        gain *= (global.tech['supercollider'] / ratio) + 1;
                    }
                    global['resource']['Knowledge'].max += gain;
                    incrementStruct('university','city');
                    global.civic.professor.display = true;
                    global.civic.professor.max = jobScale(global.city.university.count);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['university','city']
                };
            }
        },
        library: {
            id: 'city-library',
            class: 'library-action',
            title: loc('city_library'),
            desc(){
                let planet = races[global.race.species].home;
                return loc('city_library_desc',[planet]);
            },
            category: 'science',
            reqs: { science: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('library', offset, 45, 1.2); },
                Crystal(offset){ return global.race.universe === 'magic' ? costMultiplier('library', offset, 2, 1.2) : 0; },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('library', offset, 4, 1.2) : 0; },
                Furs(offset){ return costMultiplier('library', offset, 22, 1.2); },
                Plywood(offset){ return costMultiplier('library', offset, 20, 1.2); },
                Brick(offset){ return costMultiplier('library', offset, 15, 1.2); }
            },
            effect(){
                let gain = 125;
                if (global.race['nearsighted']){
                    gain *= 1 - (traits.nearsighted.vars()[0] / 100);
                }
                if (global.race['studious']){
                    gain *= 1 + (traits.studious.vars()[1] / 100);
                }
                let fathom = fathomCheck('elven');
                if (fathom > 0){
                    gain *= 1 + (traits.studious.vars(1)[1] / 100 * fathom);
                }
                if (global.tech['science'] && global.tech['science'] >= 8){
                    gain *= 1.4;
                }
                if (global.tech['anthropology'] && global.tech['anthropology'] >= 2){
                    gain *= 1 + (faithTempleCount() * 0.05);
                }
                if (global.tech['science'] && global.tech['science'] >= 5){
                    let sci_val = workerScale(global.civic.scientist.workers,'scientist');
                    if (global.race['high_pop']){
                        sci_val = highPopAdjust(sci_val);
                    }
                    gain *= 1 + (sci_val * 0.12);
                }
                let teachVal = govActive('teacher',0);
                if (teachVal){
                    gain *= 1 + (teachVal / 100);
                }
                let athVal = govActive('athleticism',2);
                if (athVal){
                    gain *= 1 - (athVal / 100);
                }
                let muckVal1 = govActive('muckraker',1);
                if (muckVal1){
                    gain *= 1 + (muckVal1 / 100);
                }
                gain = +(gain).toFixed(0);
                let muckVal2 = govActive('muckraker',2);
                let know = muckVal2 ? (5 - muckVal2) : 5;
                if (global.race['autoignition']){
                    know -= traits.autoignition.vars()[0];
                    if (know < 0){
                        know = 0;
                    }
                }
                return `<div>${loc('city_max_knowledge',[gain.toLocaleString()])}</div><div>${loc('city_library_effect',[know])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    let gain = 125;
                    if (global.race['nearsighted']){
                        gain *= 1 - (traits.nearsighted.vars()[0] / 100);
                    }
                    if (global.tech['science'] && global.tech.science >= 8){
                        gain *= 1.4;
                    }
                    if (global.tech['anthropology'] && global.tech.anthropology >= 2){
                        gain *= 1 + (faithTempleCount() * 0.05);
                    }
                    if (global.tech['science'] && global.tech.science >= 5){
                        gain *= 1 + (workerScale(global.civic.scientist.workers,'scientist') * 0.12);
                    }
                    gain = +(gain).toFixed(1);
                    global['resource']['Knowledge'].max += gain;
                    incrementStruct('library','city');
                    if (global.tech['science'] && global.tech.science >= 3){
                        global.civic.professor.impact = 0.5 + (global.city.library.count * 0.01)
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['library','city']
                };
            },
            flair: loc('city_library_flair')
        },
        wardenclyffe: {
            id: 'city-wardenclyffe',
            title(){ return wardenLabel(); },
            desc: loc('city_wardenclyffe_desc'),
            category: 'science',
            reqs: { high_tech: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('wardenclyffe', offset, 5000, 1.22); },
                Knowledge(offset){ return costMultiplier('wardenclyffe', offset, global.race['logical'] ? (1000 - traits.logical.vars()[0]) : 1000, 1.22); },
                Crystal(offset){ return global.race.universe === 'magic' ? costMultiplier('wardenclyffe', offset, 100, 1.22) : 0; },
                Copper(offset){ return costMultiplier('wardenclyffe', offset, 500, 1.22); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('wardenclyffe', offset, 75, 1.22) : 0; },
                Cement(offset){ return costMultiplier('wardenclyffe', offset, 350, 1.22); },
                Sheet_Metal(offset){ return costMultiplier('wardenclyffe', offset, 125, 1.2); },
                Nanite(offset){ return global.race['deconstructor'] ? costMultiplier('wardenclyffe', offset, 50, 1.18) : 0; },
            },
            effect(){
                let gain = 1000;
                if (global.city.ptrait.includes('magnetic')){
                    gain += planetTraits.magnetic.vars()[1];
                }
                if (global.tech['supercollider']){
                    let ratio = global.tech['particles'] && global.tech['particles'] >= 3 ? 12.5: 25;
                    gain *= (global.tech['supercollider'] / ratio) + 1;
                }
                if (global.space['satellite']){
                    gain *= 1 + (global.space.satellite.count * 0.04);
                }
                let athVal = govActive('athleticism',2);
                if (athVal){
                    gain *= 1 - (athVal / 100);
                }
                gain = +(gain).toFixed(0);

                let desc = `<div>${loc('city_wardenclyffe_effect1',[jobScale(1),global.civic.scientist ? global.civic.scientist.name : loc('job_scientist')])}</div><div>${loc('city_max_knowledge',[gain.toLocaleString()])}</div>`;
                if (global.city.powered){
                    let pgain = global.tech['science'] >= 7 ? 2500 : 2000;
                    if (global.city.ptrait.includes('magnetic')){
                        pgain += planetTraits.magnetic.vars()[1];
                    }
                    if (global.space['satellite']){
                        pgain *= 1 + (global.space.satellite.count * 0.04);
                    }
                    if (global.tech['supercollider']){
                        let ratio = global.tech['particles'] && global.tech['particles'] >= 3 ? 12.5: 25;
                        pgain *= (global.tech['supercollider'] / ratio) + 1;
                    }
                    let athVal = govActive('athleticism',2);
                    if (athVal){
                        pgain *= 1 - (athVal / 100);
                    }
                    pgain = +(pgain).toFixed(1);
                    if (global.tech.science >= 15){
                        desc = desc + `<div>${loc('city_wardenclyffe_effect4',[2])}</div>`;
                    }
                    if (global.race.universe === 'magic'){
                        let mana = spatialReasoning(8);
                        desc = desc + `<div>${loc('plus_max_resource',[mana,global.resource.Mana.name])}</div>`;
                    }
                    if (global.tech['broadcast']){
                        let morale = global.tech['broadcast'];
                        desc = desc + `<div class="has-text-caution">${loc('city_wardenclyffe_effect3',[$(this)[0].powered(),pgain.toLocaleString(),morale])}</div>`
                    }
                    else {
                        desc = desc + `<div class="has-text-caution">${loc('city_wardenclyffe_effect2',[$(this)[0].powered(),pgain.toLocaleString()])}</div>`;
                    }
                    if (global.race['artifical']){
                        desc = desc + `<div class="has-text-caution">${loc('city_transmitter_effect',[spatialReasoning(250)])}</div`;
                    }
                }
                return desc;
            },
            powered(){ return powerCostMod(2); },
            action(args){
                if (payCosts($(this)[0])){
                    let gain = 1000;
                    incrementStruct('wardenclyffe','city');
                    global.civic.scientist.display = true;
                    global.civic.scientist.max += jobScale(1);
                    if (powerOnNewStruct($(this)[0])){
                        gain = global.tech['science'] >= 7 ? 2500 : 2000;
                    }
                    if (global.tech['supercollider']){
                        let ratio = global.tech['particles'] && global.tech['particles'] >= 3 ? 12.5: 25;
                        gain *= (global.tech['supercollider'] / ratio) + 1;
                    }
                    global['resource']['Knowledge'].max += gain;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['wardenclyffe','city']
                };
            },
            flair(){ return global.race.universe === 'magic' ? `<div>${loc('city_wizard_tower_flair')}</div>` :  (global.race['evil'] ? `<div>${loc('city_babel_flair')}</div>` : `<div>${loc('city_wardenclyffe_flair1')}</div><div>${loc('city_wardenclyffe_flair2')}</div>`); }
        },
        biolab: {
            id: 'city-biolab',
            title: loc('city_biolab'),
            desc: `<div>${loc('city_biolab_desc')}</div><div class="has-text-special">${loc('requires_power')}</div>`,
            category: 'science',
            reqs: { genetics: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('biolab', offset, 25000, 1.3); },
                Knowledge(offset){ return costMultiplier('biolab', offset, 5000, 1.3); },
                Copper(offset){ return costMultiplier('biolab', offset, 1250, 1.3); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('biolab', offset, 160, 1.3) : 0; },
                Alloy(offset){ return costMultiplier('biolab', offset, 350, 1.3); }
            },
            effect(wiki){
                let gain = 3000;
                if (global.portal['sensor_drone'] && global.tech['science'] >= 14){
                    gain *= 1 + (wiki ? global.portal.sensor_drone.on : p_on['sensor_drone']) * 0.02;
                }
                if (global.tech['science'] >= 20){
                    gain *= 3;
                }
                if (global.tech['science'] >= 21){
                    gain *= 1.45;
                }
                if (global.tech['biotech'] >= 1){
                    gain *= 2.5;
                }
                if (global.race['elemental'] && traits.elemental.vars()[0] === 'frost'){
                    gain *= 1 + (traits.elemental.vars()[4] * global.resource[global.race.species].amount / 100);
                }
                gain = +(gain).toFixed(0);
                return `<span>${loc('city_max_knowledge',[gain.toLocaleString()])}</span>, <span class="has-text-caution">${loc('minus_power',[$(this)[0].powered()])}</span>`;
            },
            powered(){ return powerCostMod(2); },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('biolab','city');
                    if (powerOnNewStruct($(this)[0])){
                        global.resource.Knowledge.max += 3000;
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['biolab','city']
                };
            }
        },
        coal_power: {
            id: 'city-coal_power',
            title(){
                return global.race['environmentalist'] ? loc('city_hydro_power') : loc(global.race.universe === 'magic' ? 'city_mana_engine' : 'city_coal_power');
            },
            desc(){
                return global.race['environmentalist']
                    ? `<div>${loc('city_hydro_power_desc')}</div>`
                    : `<div>${loc(global.race.universe === 'magic' ? 'city_mana_engine_desc' : 'city_coal_power_desc')}</div><div class="has-text-special">${loc('requires_res',[loc(global.race.universe === 'magic' ? 'resource_Mana_name' : 'resource_Coal_name')])}</div>`;
            },
            category: 'utility',
            reqs: { high_tech: 2 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('coal_power', offset, 10000, dirt_adjust(1.22)); },
                Crystal(offset){ return global.race.universe === 'magic' ? costMultiplier('coal_power', offset, 125, dirt_adjust(1.22)) : 0; },
                Copper(offset){ return costMultiplier('coal_power', offset, 1800, dirt_adjust(1.22)) - 1000; },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('coal_power', offset, 175, dirt_adjust(1.22)) : 0; },
                Cement(offset){ return costMultiplier('coal_power', offset, 600, dirt_adjust(1.22)); },
                Steel(offset){ return costMultiplier('coal_power', offset, 2000, dirt_adjust(1.22)) - 1000; }
            },
            effect(){
                let consume = global.race.universe === 'magic' ? 0.05 : 0.35;
                let power = -($(this)[0].powered());
                return global.race['environmentalist'] ? `+${power}MW` : `<span>+${power}MW.</span> <span class="has-text-caution">${loc(global.race.universe === 'magic' ? 'city_mana_engine_effect' : 'city_coal_power_effect',[consume])}</span>`;
            },
            powered(wiki){
                let power = global.stats.achieve['dissipated'] && global.stats.achieve['dissipated'].l >= 1 ? -6 : -5;
                if (!wiki && global.race['environmentalist']){
                    power -= traits.environmentalist.vars()[0];
                }
                let dirt = govActive('dirty_jobs',1);
                if (dirt){ power -= dirt; }
                return powerModifier(power);
            },
            p_fuel(){
                if (global.race.universe === 'magic'){
                    return { r: 'Mana', a: global.race['environmentalist'] ? 0 : 0.05 };
                }
                else {
                    return { r: 'Coal', a: global.race['environmentalist'] ? 0 : 0.35 };
                }
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('coal_power','city');
                    global.city.coal_power.on++;
                    global.city.power += 5;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['coal_power','city']
                };
            },
        },
        oil_power: {
            id: 'city-oil_power',
            title(){
                return global.race['environmentalist'] ? loc('city_wind_power') : loc('city_oil_power');
            },
            desc(){
                return global.race['environmentalist']
                    ? `<div>${loc('city_wind_power_desc')}</div>`
                    : `<div>${loc('city_oil_power_desc')}</div><div class="has-text-special">${loc('requires_res',[global.resource.Oil.name])}</div>`
            },
            category: 'utility',
            reqs: { oil: 3 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('oil_power', offset, 50000, dirt_adjust(1.22)); },
                Copper(offset){ return costMultiplier('oil_power', offset, 6500, dirt_adjust(1.22)) + 1000; },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('oil_power', offset, 180, dirt_adjust(1.22)) : 0; },
                Aluminium(offset){ return costMultiplier('oil_power', offset, 12000, dirt_adjust(1.22)); },
                Cement(offset){ return costMultiplier('oil_power', offset, 5600, dirt_adjust(1.22)) + 1000; }
            },
            effect(){
                let consume = 0.65;
                let power = -($(this)[0].powered());
                return global.race['environmentalist'] ? `+${power}MW` : `<span>+${power}MW.</span> <span class="has-text-caution">${loc('city_oil_power_effect',[consume])}</span>`;
            },
            powered(wiki){
                let power = 0;
                if (global.stats.achieve['dissipated'] && global.stats.achieve['dissipated'].l >= 3){
                    power = global.stats.achieve['dissipated'].l >= 5 ? -8 : -7;
                }
                else {
                    power = -6;
                }
                if (!wiki && global.race['environmentalist']){
                    power -= traits.environmentalist.vars()[0];
                    if (global.city.calendar.wind === 1){
                        power -= 1;
                    }
                    else {
                        power += 1;
                    }
                }
                let dirt = govActive('dirty_jobs',1);
                if (dirt){ power -= dirt; }
                return powerModifier(power);
            },
            p_fuel(){ return { r: 'Oil', a: global.race['environmentalist'] ? 0 : 0.65 }; },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('oil_power','city');
                    global.city.oil_power.on++;
                    global.city.power += 6;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['oil_power','city']
                };
            },
        },
        fission_power: {
            id: 'city-fission_power',
            title: loc('city_fission_power'),
            desc(){ return `<div>${loc('city_fission_power_desc')}</div><div class="has-text-special">${loc('requires_res',[global.resource.Uranium.name])}</div>`; },
            category: 'utility',
            reqs: { high_tech: 5 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('fission_power', offset, 250000, 1.36); },
                Copper(offset){ return costMultiplier('fission_power', offset, 13500, 1.36); },
                Iron(offset){ return global.city.ptrait.includes('unstable') ? costMultiplier('fission_power', offset, 1750, 1.36) : 0; },
                Cement(offset){ return costMultiplier('fission_power', offset, 10800, 1.36); },
                Titanium(offset){ return costMultiplier('fission_power', offset, 7500, 1.36); }
            },
            effect(){
                let consume = 0.1;
                return `<span>+${-($(this)[0].powered())}MW.</span> <span class="has-text-caution">${loc('city_fission_power_effect',[consume])}</span>`;
            },
            powered(){ return powerModifier(global.tech['uranium'] >= 4 ? -18 : -14); },
            p_fuel(){ return { r: 'Uranium', a: 0.1 }; },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('fission_power','city');
                    global.city.fission_power.on++;
                    global.city.power += 14;
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['fission_power','city']
                };
            },
        },
        mass_driver: {
            id: 'city-mass_driver',
            title: loc('city_mass_driver'),
            desc: `<div>${loc('city_mass_driver_desc')}</div><div class="has-text-special">${loc('requires_power')}</div>`,
            category: 'utility',
            reqs: { mass: 1 },
            not_trait: ['cataclysm','lone_survivor'],
            cost: {
                Money(offset){ return costMultiplier('mass_driver', offset, 375000, 1.32); },
                Copper(offset){ return costMultiplier('mass_driver', offset, 33000, 1.32); },
                Iron(offset){ return costMultiplier('mass_driver', offset, 42500, 1.32); },
                Iridium(offset){ return costMultiplier('mass_driver', offset, 2200, 1.32); }
            },
            effect(){
                let exo = global.tech.mass >= 2 ? `<div>${loc('city_mass_driver_effect2',[1,global.civic.scientist.name])}</div>` : '';
                return `${exo}<span>${loc('city_mass_driver_effect',[global.race['truepath'] ? 6 : 5,flib('name')])}</span> <span class="has-text-caution">${loc('minus_power',[$(this)[0].powered()])}</span>`;
            },
            powered(){
                let power = global.stats.achieve['dissipated'] && global.stats.achieve['dissipated'].l >= 4 ? 4 : 5;
                return powerCostMod(global.tech.mass >= 2 ? power - 1 : power);
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('mass_driver','city');
                    powerOnNewStruct($(this)[0]);
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0, on: 0 },
                    p: ['mass_driver','city']
                };
            }
        },
        replicator: {
            id: 'city-replicator',
            title: loc('tech_replicator'),
            desc: loc('tech_replicator'),
            category: 'utility',
            reqs: { special_hack: 1 },
            cost: {},
            wiki: false,
            effect(){
                return 'fake structure';
            },
            powered(){
                return 1;
            },
            action(args){
                return false;
            }
        },
    },
    tech: techList(),
    arpa: arpa('PhysicsTech'),
    genes: arpa('GeneTech'),
    blood: arpa('BloodTech'),
    space: spaceTech(),
    interstellar: interstellarTech(),
    galaxy: galaxyTech(),
    starDock: {
        probes: {
            id: 'starDock-probes',
            title: loc('star_dock_probe'),
            desc(){
                return `<div>${loc('star_dock_probe_desc')}</div>`;
            },
            reqs: { genesis: 4 },
            cost: {
                Money(offset){ return costMultiplier('probes', offset, 350000, global.race['truepath'] ? 1.125 : 1.25,'starDock'); },
                Alloy(offset){ return costMultiplier('probes', offset, 75000, global.race['truepath'] ? 1.125 : 1.25,'starDock'); },
                Polymer(offset){ return costMultiplier('probes', offset, 85000, global.race['truepath'] ? 1.125 : 1.25,'starDock'); },
                Iridium(offset){ return costMultiplier('probes', offset, 12000, global.race['truepath'] ? 1.125 : 1.25,'starDock'); },
                Mythril(offset){ return costMultiplier('probes', offset, 3500, global.race['truepath'] ? 1.125 : 1.25,'starDock'); },
            },
            effect(){
                return `<div>${loc('star_dock_probe_effect')}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('probes','starDock');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['probes','starDock']
                };
            }
        },
        geck: {
            id: 'starDock-geck',
            title: loc('tech_geck'),
            desc(){
                return `<div>${loc('tech_geck_desc')}</div>`;
            },
            reqs: { geck: 1 },
            condition(){
                return global.stats.achieve['lamentis'] && global.stats.achieve.lamentis.l >= 5 ? true : false;
            },
            queue_complete(){ return 0; },
            no_multi: true,
            cost: {
                Money(offset){ return costMultiplier('geck', offset, 1000000, 1.25,'starDock'); },
                Elerium(offset){ return costMultiplier('geck', offset, 1000, 1.25,'starDock'); },
                Plasmid(offset){ return costMultiplier('geck', offset, 25, 1.4,'starDock'); },
            },
            effect(){
                return `<div>${loc('star_dock_geck_effect')}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])){
                    incrementStruct('geck','starDock');
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['geck','starDock']
                };
            }
        },
        seeder: {
            id: 'starDock-seeder',
            title(){ return global.race['cataclysm'] ? loc('star_dock_exodus') : loc('star_dock_seeder'); },
            desc(){
                let label = global.race['cataclysm'] ? loc('star_dock_exodus') : loc('star_dock_seeder');
                if (global.starDock['seeder'] && global.starDock.seeder.count >= 100){
                    return `<div>${label}</div><div class="has-text-special">${loc('star_dock_seeder_desc2')}</div>`;
                }
                else {
                    return `<div>${label}</div><div class="has-text-special">${loc('star_dock_seeder_desc1')}</div>`;
                }
            },
            reqs: { genesis: 5 },
            queue_size: 10,
            queue_complete(){ return 100 - global.starDock.seeder.count; },
            cost: {
                Money(offset){ return ((offset || 0) + (global.starDock.hasOwnProperty('seeder') ? global.starDock.seeder.count : 0)) < 100 ? 100000 : 0; },
                Steel(offset){ return ((offset || 0) + (global.starDock.hasOwnProperty('seeder') ? global.starDock.seeder.count : 0)) < 100 ? 25000 : 0; },
                Neutronium(offset){ return ((offset || 0) + (global.starDock.hasOwnProperty('seeder') ? global.starDock.seeder.count : 0)) < 100 ? 240 : 0; },
                Elerium(offset){ return ((offset || 0) + (global.starDock.hasOwnProperty('seeder') ? global.starDock.seeder.count : 0)) < 100 ? 10 : 0; },
                Nano_Tube(offset){ return ((offset || 0) + (global.starDock.hasOwnProperty('seeder') ? global.starDock.seeder.count : 0)) < 100 ? 12000 : 0; },
            },
            effect(wiki){
                let count = (wiki?.count ?? 0) + (global.starDock['seeder'] ? global.starDock.seeder.count : 0);
                let remain = count < 100 ? loc('star_dock_seeder_status1',[100 - count]) : loc('star_dock_seeder_status2');
                return `<div>${global.race['cataclysm'] ? loc('star_dock_exodus_effect') : loc('star_dock_seeder_effect')}</div><div class="has-text-special">${remain}</div>`;
            },
            action(args){
                if (global.starDock.seeder.count < 100 && payCosts($(this)[0])){
                    incrementStruct('seeder','starDock');
                    if (global.starDock.seeder.count >= 100){
                        global.tech.genesis = 6;
                        clearPopper(`starDock-seeder`);
                        clearElement($('#modalBox'));
                        let c_action = actions.space.spc_gas.star_dock;
                        drawModal(c_action,'star_dock');
                    }
                    return true;
                }
                return false;
            },
            struct(){
                return {
                    d: { count: 0 },
                    p: ['seeder','starDock']
                };
            }
        },
        prep_ship: {
            id: 'starDock-prep_ship',
            title: loc('star_dock_prep'),
            desc(){
                let label = global.race['cataclysm'] ? loc('star_dock_prep_cata_desc') : loc('star_dock_prep_desc');
                return `<div>${label}</div><div class="has-text-danger">${loc('star_dock_genesis_desc2')}</div>`;
            },
            reqs: { genesis: 6 },
            queue_complete(){ return 0; },
            cost: {
                Helium_3(offset,wiki){ return +fuel_adjust(global.race['gravity_well'] ? 150000 : 75000,false,wiki).toFixed(0); }
            },
            effect(){
                let gains = calcPrestige('bioseed');
                let plasmidType = global.race.universe === 'antimatter' ? loc('resource_AntiPlasmid_plural_name') : loc('resource_Plasmid_plural_name');
                let label = global.race['cataclysm'] ? loc('star_dock_prep_cata_effect') : loc('star_dock_prep_effect');
                return `<div>${label}</div><div class="has-text-special">${loc('star_dock_genesis_effect2',[gains.plasmid,plasmidType])}</div><div class="has-text-special">${loc('star_dock_genesis_effect3',[gains.phage])}</div>`;
            },
            action(args){
                if (payCosts($(this)[0])) {
                    global.tech['genesis'] = 7;
                    clearPopper(`starDock-prep_ship`);
                    clearElement($('#modalBox'));
                    let c_action = actions.space.spc_gas.star_dock;
                    drawModal(c_action,'star_dock');
                    return true;
                }
                return false;
            },
        },
        launch_ship: {
            id: 'starDock-launch_ship',
            title: loc('star_dock_genesis'),
            desc(){
                let label = global.race['cataclysm'] ? loc('star_dock_prep_cata_effect') : loc('star_dock_genesis_desc1');
                return `<div>${label}</div><div class="has-text-danger">${loc('star_dock_genesis_desc2')}</div>`;
            },
            reqs: { genesis: 7 },
            queue_complete(){ return 0; },
            cost: {},
            effect(){
                let gains = calcPrestige('bioseed');
                let plasmidType = global.race.universe === 'antimatter' ? loc('resource_AntiPlasmid_plural_name') : loc('resource_Plasmid_plural_name');
                let label = global.race['cataclysm'] ? loc('star_dock_genesis_cata_effect1') : loc('star_dock_genesis_effect1');
                return `<div>${label}</div><div class="has-text-special">${loc('star_dock_genesis_effect2',[gains.plasmid,plasmidType])}</div><div class="has-text-special">${loc('star_dock_genesis_effect3',[gains.phage])}</div>`;
            },
            action(args){
                bioseed();
                return false;
            },
        },
    },
    portal: fortressTech(),
    tauceti: tauCetiTech(),
    eden: edenicTech(),
};

export function setChallengeScreen(){
    let list = $(`#evolution .evolving`).nextAll();
    Object.values(list).forEach(function(elm){
        clearElement($(elm),true);
    });
    clearElement($(`#evolution .evolving`),true);
    global.evolution['bunker'] = { count: 1 };
    removeAction(actions.evolution.bunker.id);
    evoProgress();
    if (global.race['truepath'] || global.race['lone_survivor']){
        global.evolution['nerfed'] = { count: 0 };
        global.evolution['badgenes'] = { count: 0 };
    }
    else {
        if (global.race.universe === 'antimatter'){
            global.evolution['mastery'] = { count: 0 };
        }
        else {
            global.evolution['plasmid'] = { count: 0 };
        }
        global.evolution['crispr'] = { count: 0 };
    }
    global.evolution['trade'] = { count: 0 };
    global.evolution['craft'] = { count: 0 };
    global.evolution['junker'] = { count: 0 };
    global.evolution['joyless'] = { count: 0 };
    global.evolution['steelen'] = { count: 0 };
    if (global.stats.achieve['whitehole'] || global['sim']){
        global.evolution['decay'] = { count: 0 };
    }
    if (global.stats.achieve['ascended'] || global['sim']){
        global.evolution['emfield'] = { count: 0 };
    }
    if (global.stats.achieve['scrooge'] || global['sim']){
        global.evolution['inflation'] = { count: 0 };
    }
    if (global.stats.achieve['shaken'] || global['sim']){
        global.evolution['cataclysm'] = { count: 0 };
    }
    if (global.stats.achieve['whitehole'] || global.stats.achieve['ascended'] || global['sim']){
        global.evolution['banana'] = { count: 0 };
        global.evolution['orbit_decay'] = { count: 0 };
    }
    if (global.race.universe === 'standard' && (global.stats.achieve['whitehole'] || global['sim'])){
        //global.evolution['nonstandard'] = { count: 0 };
    }
    if (global.race.universe === 'heavy' && ((global.stats.achieve['seeder'] && global.stats.achieve.seeder['h']) || global['sim'])){
        global.evolution['gravity_well'] = { count: 0 };
    }
    if (global.race.universe === 'magic' && ((global.stats.achieve['ascended'] && global.stats.achieve.ascended['mg']) || global['sim'])){
        global.evolution['witch_hunter'] = { count: 0 };
    }
    if (global.race.universe === 'evil' && ((global.stats.achieve['godslayer'] && global.stats.achieve.godslayer['e']) || global['sim'])){
        global.evolution['warlord'] = { count: 0 };
    }
    if (global.stats.achieve['ascended'] || global.stats.achieve['corrupted'] || global['sim']){
        global.evolution['truepath'] = { count: 0 };
    }
    if ((global.stats.achieve['ascended'] || global.stats.achieve['corrupted']) && global.stats.achieve['extinct_junker'] || global['sim']){
        global.evolution['sludge'] = { count: 0 };
    }
    if (global.stats.achieve['godslayer'] && global.stats.achieve['extinct_sludge'] || global['sim']){
        global.evolution['ultra_sludge'] = { count: 0 };
    }
    if (global.stats.achieve['bluepill'] || global['sim']){
        global.evolution['simulation'] = { count: 0 };
    }
    if (global.stats.achieve['retired'] || global['sim']){
        global.evolution['lone_survivor'] = { count: 0 };
    }
    if(global.stats.achieve['corrupted'] || global['sim']){
        global.evolution['fasting'] = { count:0 };
    }
    challengeGeneHeader();
    if (global.race['truepath'] || global.race['lone_survivor']){
        addAction('evolution','nerfed');
    }
    else {
        if (global.race.universe === 'antimatter'){
            addAction('evolution','mastery');
        }
        else {
            addAction('evolution','plasmid');
        }
    }
    addAction('evolution','trade');
    addAction('evolution','craft');
    if (global.race['truepath'] || global.race['lone_survivor']){
        addAction('evolution','badgenes');
    }
    else {
        addAction('evolution','crispr');
    }
    challengeActionHeader();
    addAction('evolution','joyless');
    addAction('evolution','steelen');
    if (global.stats.achieve['whitehole'] || global['sim']){
        addAction('evolution','decay');
    }
    if (global.stats.achieve['ascended'] || global['sim']){
        addAction('evolution','emfield');
    }
    if (global.stats.achieve['scrooge'] || global['sim']){
        addAction('evolution','inflation');
    }
    if ((global.stats.achieve['ascended'] || global.stats.achieve['corrupted']) && global.stats.achieve['extinct_junker'] || global['sim']){
        addAction('evolution','sludge');
    }
    if (global.stats.achieve['godslayer'] && global.stats.achieve['extinct_sludge'] || global['sim']){
        addAction('evolution','ultra_sludge');
    }
    if (global.stats.achieve['whitehole'] || global.stats.achieve['ascended'] || global['sim']){
        addAction('evolution','orbit_decay');
    }
    if (global.race.universe === 'standard' && (global.stats.achieve['whitehole'] || global['sim'])){
        //addAction('evolution','nonstandard');
    }
    if (global.race.universe === 'heavy' && ((global.stats.achieve['seeder'] && global.stats.achieve.seeder['h']) || global['sim'])){
        addAction('evolution','gravity_well');
    }
    if (global.race.universe === 'magic' && ((global.stats.achieve['ascended'] && global.stats.achieve.ascended['mg']) || global['sim'])){
        addAction('evolution','witch_hunter');
    }
    if (global.hasOwnProperty('beta') && !global['sim']){
        addAction('evolution','simulation');
    }
    scenarioActionHeader();
    addAction('evolution','junker');
    if (global.stats.achieve['shaken'] || global['sim']){
        addAction('evolution','cataclysm');
    }
    if (global.stats.achieve['whitehole'] || global.stats.achieve['ascended'] || global['sim']){
        addAction('evolution','banana');
    }
    if (global.stats.achieve['ascended'] || global.stats.achieve['corrupted'] || global['sim']){
        addAction('evolution','truepath');
    }
    if (global.stats.achieve['retired'] || global['sim']){
        addAction('evolution','lone_survivor');
    }
    if(global.stats.achieve['corrupted'] || global['sim']){
        addAction('evolution','fasting');
    }
    if (global.race.universe === 'evil' && ((global.stats.achieve['godslayer'] && global.stats.achieve.godslayer['e']) || global['sim'])){
        addAction('evolution','warlord');
    }
    if (global['sim']){
        exitSimulation();
    }
    else if (global.race['simulation']){
        configSimulation();
    }

    if (global.race['warlord']){
        ['custom','hybrid','nano','sentience'].forEach(function(r){
            if ($(`#evolution-${r}`).length > 0){
                $(`#evolution-${r}`).addClass('disabled');
            }
        });
    }
    else {
        ['custom','hybrid','nano','sentience'].forEach(function(r){
            if ($(`#evolution-${r}`).length > 0 && $(`#evolution-${r}`).hasClass('disabled')){
                $(`#evolution-${r}`).removeClass('disabled');
            }
        });
    }
}

export function buildTemplate(key, region){
    let tName = global.race['orbit_decay'] ? 'orbit_decayed' : (global.race['warlord'] ? 'warlord' :'cataclysm');

    let tKey = function(a,k,r){
        if (r === 'space' || r === 'portal'){
            if (a.hasOwnProperty('trait')){
                a.trait.push(k);
            }
            else {
                a['trait'] = [k];
            }
        }
        else if (r === 'tauceti'){
            a.reqs['isolation'] = 1;
        }
        else {
            if (a.hasOwnProperty('not_trait')){
                a.not_trait.push(k);
            }
            else {
                a['not_trait'] = [k];
            }
        }
        return a;
    };

    switch (key){
        case 'bonfire':
        {
            let action = {
                id: `${region}-bonfire`,
                title: loc('city_bonfire'),
                desc: loc('city_bonfire_desc'),
                category: 'outskirts',
                wiki: false,
                reqs: { primitive: 3  },
                condition(){
                    return eventActive(`summer`);
                },
                queue_complete(){ return 0; },
                effect(){
                    let morale = (global.resource.Thermite.diff * 2.5) / (global.resource.Thermite.diff * 2.5 + 500) * 500;
                    let thermite = 100000 + global.stats.reset * 9000;
                    if (thermite > 1000000){ thermite = 1000000; }
                    let goal = global.resource.Thermite.amount < thermite ? `<div class="has-text-warning">${loc('city_bonfire_effect3',[(thermite).toLocaleString()])}</div><div class="has-text-caution">${loc('city_bonfire_effect4',[(+(global.resource.Thermite.amount).toFixed(0)).toLocaleString(),(thermite).toLocaleString()])}</div>` : ``;
                    return `<div>${loc(`city_bonfire_effect`,[global.resource.Thermite.diff])}</div><div>${loc(`city_bonfire_effect2`,[+(morale).toFixed(1)])}</div>${goal}`;
                },
                action(args){
                    return false;
                },
                flair(){
                    return loc(`city_bonfire_flair`);
                }
            };
            return tKey(action,tName,region);
        }
        case 'firework':
        {
            let action = {
                id: `${region}-firework`,
                title: loc('city_firework'),
                desc: loc('city_firework'),
                category: 'outskirts',
                wiki: false,
                reqs: { mining: 3 },
                condition(){
                    return eventActive(`firework`) && global[region].firework && (global.tech['cement'] || global.race['flier']);
                },
                cost: {
                    Money(){ return global[region].firework.count === 0 ? 50000 : 0; },
                    Iron(){ return global[region].firework.count === 0 ? 7500 : 0; },
                    Cement(){ return global[region].firework.count === 0 ? 10000 : 0; }
                },
                queue_complete(){ return 1 - global[region].firework.count; },
                switchable(){ return true; },
                effect(){
                    return global[region].firework.count === 0 ? loc(`city_firework_build`) : loc(`city_firework_effect`);
                },
                action(args){
                    if (global[region].firework.count === 0 && payCosts($(this)[0])){
                        global[region].firework.count = 1;
                        return true;
                    }
                    return false;
                }
            };
            return tKey(action,tName,region);
        }
        case 'assembly':
        {
            let assemblyCostAdjust = function(v){
                let cost = highPopAdjust(v);
                if (global.race['promiscuous']){
                    cost /= 1 + traits.promiscuous.vars()[1] * global.race['promiscuous'];
                }
                return Math.round(cost);
            }
            let action = {
                id: `${region}-assembly`,
                title: loc('city_assembly'),
                desc(){ return loc('city_assembly_desc',[races[global.race.species].name]); },
                category: 'military',
                reqs: {},
                trait: ['artifical'],
                queue_complete(){ return global.resource[global.race.species].max - global.resource[global.race.species].amount; },
                cost: {
                    Money(offset){ return global['resource'][global.race.species].amount ? costMultiplier('citizen', offset, assemblyCostAdjust(125), 1.01) : 0; },
                    Copper(offset){ return global.race['deconstructor'] ? 0 : global['resource'][global.race.species].amount >= 5 ? costMultiplier('citizen', offset, assemblyCostAdjust(50), 1.01) : 0; },
                    Aluminium(offset){ return global.race['deconstructor'] ? 0 : global['resource'][global.race.species].amount >= 5 ? costMultiplier('citizen', offset, assemblyCostAdjust(50), 1.01) : 0; },
                    Nanite(offset){ return global.race['deconstructor'] ? (global['resource'][global.race.species].amount >= 3 ? costMultiplier('citizen', offset, assemblyCostAdjust(500), 1.01) : 0) : 0; },
                },
                effect(){
                    let warn = '';
                    if (global['resource'][global.race.species].max === global['resource'][global.race.species].amount){
                        warn = `<div class="has-text-caution">${loc('city_assembly_effect_warn')}</div>`;
                    }
                    else if (global.race['parasite']){
                        let buffer = 6;
                        switch (traitRank('parasite')){
                            case 0.25:
                                buffer = 5;
                                break;
                            case 0.5:   
                                buffer = 4;
                                break;
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                                buffer = 4 - traitRank('parasite');
                                break;
                        }
                        if (global.race['last_assembled'] && global.race.last_assembled + buffer >= global.stats.days){
                            warn = `<div class="has-text-caution">${loc('city_assembly_effect_parasite',[global.race.last_assembled + buffer + 1 - global.stats.days])}</div>`;
                        }
                        else {
                            warn = `<div class="has-text-success">${loc('city_assembly_effect_parasite_ok')}</div>`;
                        }
                    }
                    return `<div>${loc('city_assembly_effect',[races[global.race.species].name])}</div>${warn}`;
                },
                action(args){
                    if (global.race['parasite'] && (global.race['cataclysm'] || global.race['orbit_decayed'])){
                        let buffer = 6;
                        switch (traitRank('parasite')){
                            case 0.25:
                                buffer = 5;
                                break;
                            case 0.5:   
                                buffer = 4;
                                break;
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                                buffer = 4 - traitRank('parasite');
                                break;
                        }
                        if (global.race['last_assembled'] && global.race.last_assembled + buffer >= global.stats.days){
                            return false;
                        }
                    }
                    if (global.race['vax'] && global.race.vax >= 100){
                        return true;
                    }
                    else if (global['resource'][global.race.species].max > global['resource'][global.race.species].amount && payCosts($(this)[0])){
                        global['resource'][global.race.species].amount++;
                        global.civic[global.civic.d_job].workers++;
                        global.race['last_assembled'] = global.stats.days;
                        return true;
                    }
                    return false;
                }
            };
            return tKey(action,tName,region);
        }
        case 'nanite_factory':
        {
            let action = {
                id: `${region}-nanite_factory`,
                title: loc('city_nanite_factory'),
                desc: loc('city_nanite_factory'),
                category: 'industrial',
                reqs: {},
                trait: ['deconstructor'],
                region: 'city',
                cost: {
                    Money(offset){ return costMultiplier('nanite_factory', offset, 25000, dirt_adjust(1.25)); },
                    Copper(offset){ return costMultiplier('nanite_factory', offset, 1200, dirt_adjust(1.25)); },
                    Steel(offset){ return costMultiplier('nanite_factory', offset, 1000, dirt_adjust(1.25)); }
                },
                effect(){
                    let val = spatialReasoning(2500);
                    return `<div>${loc('city_nanite_factory_effect',[global.resource.Nanite.name])}</div><div>${loc('plus_max_resource',[val,global.resource.Nanite.name])}.</div>`;
                },
                special: true,
                action(args){
                    if (payCosts($(this)[0])){
                        incrementStruct('nanite_factory','city');
                        if (global.city.nanite_factory.count === 1){
                            global.settings.showIndustry = true;
                            defineIndustry();
                        }
                        return true;
                    }
                    return false;
                },
                flair: loc(`city_nanite_factory_flair`)
            };
            return tKey(action,tName,region);
        }
        case 'captive_housing':
        {
            let action = {
                id: `${region}-captive_housing`,
                title: loc('city_captive_housing'),
                desc: loc('city_captive_housing_desc'),
                category: 'residential',
                reqs: { unfathomable: 1 },
                trait: ['unfathomable'],
                region: 'city',
                cost: {
                    Money(offset){ return costMultiplier('captive_housing', offset, 40, 1.35); },
                    Lumber(offset){ return costMultiplier('captive_housing', offset, 30, 1.35); },
                    Stone(offset){ return costMultiplier('captive_housing', offset, 18, 1.35); },
                },
                effect(){
                    let desc = ``;
                    if (!global.race['artifical'] && !global.race['detritivore'] && !global.race['carnivore'] && !global.race['soul_eater']){
                        let cattle = global.city.hasOwnProperty('captive_housing') ? global.city.captive_housing.cattle : 0;
                        let cattleCap = global.city.hasOwnProperty('captive_housing') ? global.city.captive_housing.cattleCap : 0;
                        desc += `<div>${loc(`city_captive_housing_cattle`,[cattle,cattleCap])}</div>`;
                    }

                    let usedCap = 0;
                    if (global.city.hasOwnProperty('surfaceDwellers')){
                        for (let i = 0; i < global.city.surfaceDwellers.length; i++){
                            let r = global.city.surfaceDwellers[i];
                            let mindbreak = global.city.captive_housing[`race${i}`];
                            let jailed = global.city.captive_housing[`jailrace${i}`];
                            usedCap += mindbreak + jailed;
                            desc += `<div>${loc(`city_captive_housing_broken`,[races[r].name,mindbreak])}</div>`;
                            desc += `<div>${loc(`city_captive_housing_untrained`,[races[r].name,jailed])}</div>`;
                        }
                    }

                    let raceCap = global.city.hasOwnProperty('captive_housing') ? global.city.captive_housing.raceCap : 0;
                    desc += `<div>${loc(`city_captive_housing_capacity`,[usedCap,raceCap])}</div>`;
                    if (global.tech['unfathomable'] && global.tech.unfathomable >= 2){
                        desc += `<div>${loc(`plus_max_resource`,[1,loc('job_torturer')])}</div>`;
                    }
                    return desc;
                },
                action(args){
                    if (payCosts($(this)[0])){
                        incrementStruct('captive_housing','city');
                        let houses = global.city.captive_housing.count;
                        global.city.captive_housing.raceCap = houses * (global.tech['unfathomable'] && global.tech.unfathomable >= 3 ? 3 : 2);
                        global.city.captive_housing.cattleCap = houses * 5;
                        return true;
                    }
                    return false;
                },
                struct(){
                    return {
                        d: {
                            count: 0, cattle: 0, cattleCatch: 0,
                            race0: 0, jailrace0: 0,
                            race1: 0, jailrace1: 0,
                            race2: 0, jailrace2: 0,
                            raceCap: 0, cattleCap: 0,
                        },
                        p: ['captive_housing','city']
                    };
                },
            };
            return tKey(action,tName,region);
        }
        case 'horseshoe':
        {
            let action = {
                id: `${region}-horseshoe`,
                title(){ return loc(`city_${hoovedRename(true)}`,[hoovedRename(false)]); },
                desc(){ return loc(`city_${hoovedRename(true)}_desc`,[hoovedRename(false)]); },
                category: 'outskirts',
                reqs: { primitive: 3 },
                condition(){
                    return global.race['hooved'] || eventActive('fool',2023);
                },
                inflation: false,
                cost: {
                    Lumber(offset){
                        let shoes = (global.race['shoecnt'] || 0) + (offset || 0);
                        let active = !global.race['kindling_kindred'] && !global.race['smoldering']
                            && (!global.resource.Copper.display || shoes <= 12) ? true : false;
                        return active ? Math.round((shoes > 12 ? 25 : 5) * (shoes <= 5 ? 1 : shoes - 4) * (traits.hooved.vars()[0] / 100)) : 0;
                    },
                    Copper(offset){
                        let shoes = (global.race['shoecnt'] || 0) + (offset || 0);
                        let lum = (global.race['kindling_kindred'] || global.race['smoldering']) ? false : true;
                        let active = (!lum || (lum && shoes > 12 && global.resource.Copper.display))
                            && (!global.resource.Iron.display || shoes <= 75) ? true : false;
                        return active ? Math.round((shoes > 75 ? 20 : 5) * (shoes <= 12 ? 1 : shoes - 11) * (traits.hooved.vars()[0] / 100)) : 0;
                    },
                    Iron(offset){
                        let shoes = (global.race['shoecnt'] || 0) + (offset || 0);
                        return global.resource.Iron.display && shoes > 75 && (!global.resource.Steel.display || shoes <= 150) ? Math.round((shoes <= 150 ? 12 : 28) * shoes * (traits.hooved.vars()[0] / 100)) : 0;
                    },
                    Steel(offset){
                        let shoes = (global.race['shoecnt'] || 0) + (offset || 0);
                        return global.resource.Steel.display && shoes > 150 && (!global.resource.Adamantite.display || shoes <= 500) ? Math.round((shoes <= 500 ? 40 : 100) * shoes * (traits.hooved.vars()[0] / 100)) : 0;
                    },
                    Adamantite(offset){
                        let shoes = (global.race['shoecnt'] || 0) + (offset || 0);
                        return global.resource.Adamantite.display && shoes > 500 && (!global.resource.Orichalcum.display || shoes <= 5000) ? Math.round((shoes <= 5000 ? 5 : 25) * shoes * (traits.hooved.vars()[0] / 100)) : 0;
                    },
                    Orichalcum(offset){
                        let shoes = (global.race['shoecnt'] || 0) + (offset || 0);
                        return global.resource.Orichalcum.display && shoes > 5000 ? Math.round((25 * shoes - 120000) * (traits.hooved.vars()[0] / 100)) : 0;
                    }
                },
                action(args){
                    if (!global.race['hooved'] && eventActive('fool',2023)){
                        return true;
                    }
                    if (global.resource.Horseshoe.display && payCosts($(this)[0])){
                        global.resource.Horseshoe.amount++;
                        global.race.shoecnt++;

                        if ((global.race.shoecnt === 5001 && global.resource.Orichalcum.display) ||
                            (global.race.shoecnt === 501 && global.resource.Adamantite.display) ||
                            (global.race.shoecnt === 151 && global.resource.Steel.display) ||
                            (global.race.shoecnt === 76 && global.resource.Iron.display) ||
                            (global.race.shoecnt === 13 && global.resource.Copper.display && global.resource.Lumber.display)){
                            return 0;
                        }
                        return true;
                    }
                    return false;
                }
            };
            return tKey(action,tName,region);
        }
        case 's_alter':   
        {
            let action = {
                id: `${region}-s_alter`,
                title: loc('city_s_alter'),
                desc(){
                    return global.city.hasOwnProperty('s_alter') && global.city['s_alter'].count >= 1 ? `<div>${loc('city_s_alter')}</div><div class="has-text-special">${loc('city_s_alter_desc')}</div>` : loc('city_s_alter');
                },
                category: 'outskirts',
                reqs: { mining: 1 },
                trait: ['cannibalize'],
                not_trait: ['cataclysm','lone_survivor'],
                inflation: false,
                region: 'city',
                cost: {
                    Stone(offset){ return ((offset || 0) + (global.city.hasOwnProperty('s_alter') ? global.city['s_alter'].count : 0)) >= 1 ? 0 : 100; }
                },
                effect(){
                    let sacrifices = global.civic[global.civic.d_job] ? global.civic[global.civic.d_job].workers : 0;
                    let desc = `<div class="has-text-caution">${loc('city_s_alter_sacrifice',[sacrifices])}</div>`;
                    if (global.city.hasOwnProperty('s_alter') && global.city.s_alter.rage > 0){
                        desc = desc + `<div>${loc('city_s_alter_rage',[traits.cannibalize.vars()[0],timeFormat(global.city.s_alter.rage)])}</div>`;
                    }
                    if (global.city.hasOwnProperty('s_alter') && global.city.s_alter.regen > 0){
                        desc = desc + `<div>${loc('city_s_alter_regen',[traits.cannibalize.vars()[0],timeFormat(global.city.s_alter.regen)])}</div>`;
                    }
                    if (global.city.hasOwnProperty('s_alter') && global.city.s_alter.mind > 0){
                        desc = desc + `<div>${loc('city_s_alter_mind',[traits.cannibalize.vars()[0],timeFormat(global.city.s_alter.mind)])}</div>`;
                    }
                    if (global.city.hasOwnProperty('s_alter') && global.city.s_alter.mine > 0){
                        desc = desc + `<div>${loc('city_s_alter_mine',[traits.cannibalize.vars()[0],timeFormat(global.city.s_alter.mine)])}</div>`;
                    }
                    if (global.city.hasOwnProperty('s_alter') && global.city.s_alter.harvest > 0){
                        let jobType = global.race['evil'] && !global.race['soul_eater'] ? loc('job_reclaimer') : loc('job_lumberjack');
                        desc = desc + `<div>${loc('city_s_alter_harvest',[traits.cannibalize.vars()[0],timeFormat(global.city.s_alter.harvest),jobType])}</div>`;
                    }
                    return desc;
                },
                action(args){
                    if (payCosts($(this)[0])){
                        if (global.city['s_alter'].count === 0){
                            incrementStruct('s_alter','city');
                        }
                        else {
                            let sacrifices = global.civic[global.civic.d_job].workers;
                            if (sacrifices > 0){
                                global.resource[global.race.species].amount--;
                                global.civic[global.civic.d_job].workers--;
                                global.stats.sac++;
                                blubberFill(1);
                                modRes('Food', Math.rand(250,1000), true);
                                let low = 300;
                                let high = 600;
                                if (global.tech['sacrifice']){
                                    switch (global.tech['sacrifice']){
                                        case 1:
                                            low = 600;
                                            high = 1500;
                                            break;
                                        case 2:
                                            low = 1800;
                                            high = 3600;
                                            break;
                                        case 3:
                                            low = 5400;
                                            high = 16200;
                                            break;
                                    }
                                }
                                switch (global.race['kindling_kindred'] || global.race['smoldering'] ? Math.rand(0,4) : Math.rand(0,5)){
                                    case 0:
                                        global.city.s_alter.rage += Math.rand(low,high);
                                        break;
                                    case 1:
                                        global.city.s_alter.mind += Math.rand(low,high);
                                        break;
                                    case 2:
                                        global.city.s_alter.regen += Math.rand(low,high);
                                        break;
                                    case 3:
                                        global.city.s_alter.mine += Math.rand(low,high);
                                        break;
                                    case 4:
                                        global.city.s_alter.harvest += Math.rand(low,high);
                                        break;
                                }
                            }
                        }
                        return true;
                    }
                    return false;
                },
                struct(){
                    return {
                        d: {
                            count: 0,
                            rage: 0,
                            mind: 0,
                            regen: 0,
                            mine: 0,
                            harvest: 0,
                        },
                        p: ['s_alter','city']
                    };
                },
                touchlabel: loc(`tech_dist_sacrifice`)
            };
            return tKey(action,tName,region);
        }
        case 'shrine':
        {
            let action = {
                id: `${region}-shrine`,
                title: loc('city_shrine'),
                desc(){
                    return global.race['warlord'] ? loc('city_shrine_warlord_desc') : loc('city_shrine_desc');
                },
                category: 'commercial',
                reqs: { theology: 2 },
                trait: ['magnificent'],
                not_trait: ['cataclysm','lone_survivor'],
                region: 'city',
                cost: {
                    Money(offset){ return costMultiplier('shrine', offset, 75, 1.32); },
                    Stone(offset){ return costMultiplier('shrine', offset, 65, 1.32); },
                    Furs(offset){ return costMultiplier('shrine', offset, 10, 1.32); },
                    Copper(offset){ return costMultiplier('shrine', offset, 15, 1.32); }
                },
                effect(){
                    let morale = getShrineBonus('morale');
                    let metal = getShrineBonus('metal');
                    let know = getShrineBonus('know');
                    let tax = getShrineBonus('tax');
    
                    let desc = `<div class="has-text-special">${loc('city_shrine_effect')}</div>`;
                    if (global.city['shrine'] && morale.active){
                        desc = desc + `<div>${loc('city_shrine_morale',[+(morale.add).toFixed(1)])}</div>`;
                    }
                    if (global.city['shrine'] && metal.active){
                        desc = desc + `<div>${loc('city_shrine_metal',[+((metal.mult - 1) * 100).toFixed(2)])}</div>`;
                    }
                    if (global.city['shrine'] && know.active){
                        desc = desc + `<div>${loc('city_shrine_know',[(+(know.add).toFixed(1)).toLocaleString()])}</div>`;
                        desc = desc + `<div>${loc(global.race['warlord'] ? 'city_shrine_warlord' : 'city_shrine_know2',[+((know.mult - 1) * 100).toFixed(1)])}</div>`;
                    }
                    if (global.city['shrine'] && tax.active){
                        desc = desc + `<div>${loc('city_shrine_tax',[+((tax.mult - 1) * 100).toFixed(1)])}</div>`;
                    }
                    return desc;
                },
                action(args){
                    if (payCosts($(this)[0])){
                        incrementStruct('shrine','city');
                        if (global.city.calendar.moon > 0 && global.city.calendar.moon < 7){
                            global.city.shrine.morale++;
                        }
                        else if (global.city.calendar.moon > 7 && global.city.calendar.moon < 14){
                            global.city.shrine.metal++;
                        }
                        else if (global.city.calendar.moon > 14 && global.city.calendar.moon < 21){
                            global.city.shrine.know++;
                        }
                        else if (global.city.calendar.moon > 21){
                            global.city.shrine.tax++;
                        }
                        else {
                            global.city.shrine.cycle++;
                        }
                        return true;
                    }
                    return false;
                },
                struct(){
                    return {
                        d: {
                            count: 0,
                            morale: 0,
                            metal: 0,
                            know: 0,
                            tax: 0,
                            cycle: 0,
                        },
                        p: ['shrine','city']
                    };
                },
            };
            return tKey(action,tName,region);
        }
        case 'meditation':
        {
            let action = {
                id: `${region}-meditation`,
                title: loc('city_meditation'),
                desc: loc('city_meditation'),
                category: 'commercial',
                reqs: { primitive: 3 },
                trait: ['calm'],
                not_trait: ['cataclysm','lone_survivor'],
                region: 'city',
                cost: {
                    Money(offset){ return costMultiplier('meditation', offset, 50, 1.2); },
                    Stone(offset){ return costMultiplier('meditation', offset, 25, 1.2); },
                    Furs(offset){ return costMultiplier('meditation', offset, 8, 1.2); }
                },
                effect(){
                    let zen = global.resource.Zen.amount / (global.resource.Zen.amount + 5000);
                    return `<div>${loc(`city_meditation_effect`,[traits.calm.vars()[0]])}</div><div class="has-text-special">${loc(`city_meditation_effect2`,[2])}</div><div class="has-text-special">${loc(`city_meditation_effect3`,[1])}</div><div>${loc(`city_meditation_effect4`,[`${(zen * 100).toFixed(2)}%`])}</div>`;
                },
                action(args){
                    if (payCosts($(this)[0])){
                        incrementStruct('meditation','city');
                        global.resource.Zen.max += traits.calm.vars()[0];
                        return true;
                    }
                    return false;
                },
                struct(){
                    return {
                        d: { count: 0 },
                        p: ['meditation','city']
                    };
                },
            };
            return tKey(action,tName,region);
        }
    }
}

function genus_condition(r,t){
    t = t || 'evo';
    let f = global.evolution['final'] || 0;
    return ((global.tech[t] && global.tech[t] === r) || (global.evolution['gselect'])) && f < 100;
}

const raceList = [
    'human','orc','elven',
    'troll','ogre','cyclops',
    'kobold','goblin','gnome',
    'cath','wolven','vulpine',
    'centaur','rhinotaur','capybara',
    //'bearkin','porkenari','hedgeoken',
    'tortoisan','gecko','slitheryn',
    'arraak','pterodacti','dracnid',
    'sporgar','shroomi','moldling',
    'mantis','scorpid','antid',
    'entish','cacti','pinguicula',
    'sharkin','octigoran',
    'dryad','satyr',
    'phoenix','salamander',
    'yeti','wendigo',
    'tuskin','kamel',
    'imp','balorg',
    'seraph','unicorn',
    'synth','nano',
    'ghast','shoggoth',
    'dwarf','raccoon','lichen','wyvern','beholder','djinn','narwhal','bombardier','nephilim',
    'custom','hybrid'
];
raceList.forEach(function(race){
    if (!['custom','hybrid'].includes(race) || (race === 'custom' && global.custom.hasOwnProperty('race0')) || (race === 'hybrid' && global.custom.hasOwnProperty('race1')) ){
        if (race === 'hybrid' && global.custom.race1.genus !== 'hybrid'){
            global.custom.race1.hybrid = [global.custom.race1.genus, global.custom.race1.genus === 'humanoid' ? 'small' : 'humanoid'];
            global.custom.race1.genus = 'hybrid';
        }
        else if (race === 'custom' && global.custom.race0.genus === 'hybrid'){ global.custom.race0.genus = 'humanoid'; }
        actions.evolution[race] = {
            id: `evolution-${race}`,
            title(){ return races[race].name; },
            desc(){ return `${loc("evo_evolve")} ${races[race].name}`; },
            reqs: { evo: 7 },
            grant: ['evo',8],
            condition(){
                let typeList = global.stats.achieve['godslayer'] && races[race].type === 'hybrid' ? races[race].hybrid : [races[race].type];
                let typeCheck = false;
                typeList.forEach(function(t){
                    if (global.tech[`evo_${t}`] >= 2){ typeCheck = true; }
                });
                 
                return (global.race.seeded 
                    || (global.stats.achieve['mass_extinction'] && global.stats.achieve['mass_extinction'].l >= 1) 
                    || (global.stats.achieve[`extinct_${race}`] && global.stats.achieve[`extinct_${race}`].l >= 1))
                    && typeCheck 
                    && global.evolution.final === 100 && !global.race['evoFinalMenu']; 
            },
            cost: {
                RNA(){ return 320; },
                DNA(){ return 320; }
            },
            race: true,
            effect(){
                let raceDesc = typeof races[race].desc === 'string' ? races[race].desc : races[race].desc();
                return `${raceDesc} ${loc(`evo_complete`)}`;
            },
            action(args){
                if (global.race['warlord'] && ['custom','hybrid','nano'].includes(race)){ return false; }
                if (payCosts($(this)[0])){
                    if (['synth','custom'].includes(race)){
                        return evoExtraState(race);
                    }
                    else {
                        global.race.species = race;
                        sentience();
                    };
                }
                return false;
            },
            queue_complete(){ return global.tech['evo'] && global.tech.evo === 7 ? 1 : 0; },
            emblem(){ return format_emblem(`extinct_${race}`); }
        }
    }
});

if (Object.keys(global.stats.synth).length > 1){
    let synthList = deepClone(raceList.filter(r => !['nano','synth'].includes(r)));
    synthList.forEach(race => actions.evolution[`s-${race}`] = {
        id: `evolution-s-${race}`,
        title(){ return races[race].name; },
        desc(){ return `${loc("evo_imitate")} ${races[race].name}`; },
        reqs: { evo: 8 },
        grant: ['evo',9],
        condition(){
            if ((race === 'custom' && !global.custom.hasOwnProperty('race0')) || (race === 'hybrid' && !global.custom.hasOwnProperty('race1'))){
                return false;
            }
            return (global.stats.synth[race] || global['beta']) && global.race['evoFinalMenu'];
        },
        cost: {},
        wiki: false,
        race: true,
        effect(){ return loc(`evo_imitate_race`,[races[race].name]); },
        action(args){
            if (global.stats.synth[race] || global['beta']){
                global.race.species = global.race['evoFinalMenu'];
                global.race['srace'] = race;
                sentience();
            }
            return false;
        },
        queue_complete(){ return global.tech['evo'] && global.tech.evo === 8 ? 1 : 0; }
    });
}
            
const challengeList = {
    'plasmid': 'no_plasmid',
    'mastery': 'weak_mastery',
    'trade': 'no_trade',
    'craft': 'no_craft',
    'crispr': 'no_crispr',
    'nerfed': 'nerfed',
    'badgenes': 'badgenes',
};
Object.keys(challengeList).forEach(challenge => actions.evolution[challenge] = {
    id: `evolution-${challenge}`,
    title: loc(`evo_challenge_${challenge}`),
    desc: loc(`evo_challenge_${challenge}`),
    condition(){ return global.evolution.hasOwnProperty(challenge); },
    cost: {
        DNA(){ return 10; }
    },
    challenge: true,
    effect(){ return challengeEffect(challenge); },
    action(args){
        if (payCosts($(this)[0])){
            if (global.race[challengeList[challenge]]){
                delete global.race[challengeList[challenge]];
                $(`#${$(this)[0].id}`).removeClass('hl');
                if (global.race['truepath'] || global.race['lone_survivor']){
                    delete global.race['nerfed'];
                    delete global.race['badgenes'];
                }
                ['junker','cataclysm','banana','truepath','lone_survivor','fasting','warlord'].forEach(function(s){
                    delete global.race[s];
                    $(`#evolution-${s}`).removeClass('hl');
                });
            }
            else {
                global.race[challengeList[challenge]] = 1;
                $(`#${$(this)[0].id}`).addClass('hl');
            }
            setChallengeScreen();
            challengeIcon();
        }
        return false;
    },
    highlight(){ return global.race[challengeList[challenge]] ? true : false; },
    queue_complete(){ return 0; }
});

const advancedChallengeList = {
    'joyless': {t: 'c', e: 'joyless' },
    'steelen': {t: 'c', e: 'steelen' },
    'decay': {t: 'c', e: 'dissipated' },
    'emfield': {t: 'c', e: 'technophobe' },
    'inflation': {t: 'c', e: 'wheelbarrow' },
    'sludge': {t: 'c', e: 'extinct_sludge' },
    'ultra_sludge': {t: 'c', e: 'extinct_ultra_sludge' },
    'orbit_decay': {t: 'c', e: 'lamentis' },
    //'nonstandard': {t: 'c', e: 'anathema' },
    'gravity_well': {t: 'c', e: 'escape_velocity' },
    'witch_hunter': {t: 'c', e: 'soul_sponge' },
    //'storage_wars': {t: 'c', e: '???' },
    'simulation': {t: 'c', e: 'thereisnospoon' },
    'junker': {t: 's', e: 'extinct_junker' },
    'cataclysm': {t: 's', e: 'iron_will' },
    'banana': {t: 's', e: 'banana' },
    'truepath': {t: 's', e: 'pathfinder' },
    'lone_survivor': {t: 's', e: 'adam_eve' },
    'fasting': {t: 's', e: 'endless_hunger' },
    'warlord': {t: 's', e: 'what_is_best' },
};
Object.keys(advancedChallengeList).forEach(challenge => actions.evolution[challenge] = {
    id: `evolution-${challenge}`,
    title: loc(`evo_challenge_${challenge}`),
    desc(){
        let desc = '';
        if (global.race.universe === 'micro'){
            desc = desc + `<div class="has-text-danger">${loc('evo_challenge_micro_warn')}</div>`;
        }
        desc = desc + `<div>${loc(`evo_challenge_${challenge}_desc`)}</div>`;
        if (['sludge','junker','ultra_sludge'].includes(challenge)){
            desc = desc + `<div class="has-text-danger">${loc('evo_start')}</div>`;
        }
        return desc;
    },
    condition(){ return global.evolution.hasOwnProperty(challenge); },
    cost: {
        DNA(){ return advancedChallengeList[challenge].t === 'c' ? 25 : 50; }
    },
    challenge: true,
    effect(){ return challengeEffect(challenge); },
    action(args){
        if (payCosts($(this)[0])){
            if (advancedChallengeList[challenge].t === 'c'){
                setChallenge(challenge);
            }
            else {
                setScenario(challenge);
            }
        }
        return false;
    },
    emblem(){ return format_emblem(advancedChallengeList[challenge].e); },
    highlight(){ return global.race[challenge] ? true : false; },
    queue_complete(){ return 0; }
});

actions.evolution['bunker'] = {
    id: 'evolution-bunker',
    title: loc('evo_bunker'),
    desc(){ return `<div>${loc('evo_bunker')}</div><div class="has-text-special">${loc('evo_challenge')}</div>`; },
    reqs: { evo: 6 },
    grant: ['evo_challenge',1],
    condition(){ return global.genes['challenge'] && global.evolution['final'] === 100 && !global.race['evoFinalMenu']; },
    cost: {
        DNA(){ return 10; }
    },
    effect: loc('evo_bunker_effect'),
    action(args){
        if (payCosts($(this)[0])){
            return true;
        }
        return false;
    },
    queue_complete(){ return global.tech['evo_challenge'] ? 0 : 1; },
    flair: loc('evo_bunker_flair')
};

function insertEvolutionDivider(){
    const separatorId = 'evolution-divider';
    $(`#${separatorId}`).remove();
    const mitochondria = $('#evolution-mitochondria');
    if (!mitochondria.length){
        return;
    }
    mitochondria.after($(`<div id="${separatorId}" class="evolution-divider" aria-hidden="true"></div>`));
}

export function drawEvolution(){
    if (!global.settings.tabLoad && !isMainTabActive('evolution')){
        return;
    }
    if (global.race.universe === 'bigbang' || (global.race.seeded && !global.race['chose'])){
        return;
    }
    if (global.tech['evo_challenge']){
        let list = $(`#evolution .evolving`).nextAll();
        Object.values(list).forEach(function(elm){
            clearElement($(elm),true);
        });
        clearElement($(`#evolution .evolving`),true);
    }

    Object.keys(actions.evolution).forEach(function (evo) {
        if (!actions.evolution[evo]['challenge']){
            removeAction(actions.evolution[evo].id);

            var isMet = true;
            if (actions.evolution[evo].hasOwnProperty('reqs')){
                Object.keys(actions.evolution[evo].reqs).forEach(function (req){
                    if (!global.tech[req] || global.tech[req] < actions.evolution[evo].reqs[req]){
                        isMet = false;
                    }
                });
            }

            if (isMet && isEvolutionActionAllowed(evo)){
                addAction('evolution', evo);
            }
        }
    });

    insertEvolutionDivider();

    if (!global.race['evoFinalMenu']){
        if (global.tech['evo'] && global.tech.evo >= 2){
            evoProgress();
        }
        if (global.tech['evo_challenge']){
            setChallengeScreen();
        }
    }

    if (sentienceSelecting){
        renderSentienceSelector();
    }
    else {
        clearSentienceSelector();
    }
}

function challengeEffect(c){
    switch (c){
        case 'nerfed':
            let nVal = global.race.universe === 'antimatter' ? [`20%`,`50%`,`50%`,`33%`] : [`50%`,`20%`,`50%`,`33%`];
            return loc(`evo_challenge_${c}_effect`,nVal);
        case 'badgenes':
            return loc(`evo_challenge_${c}_effect`,[1,2]);
        case 'orbit_decay':
        {
            if (calc_mastery() >= 100){
                return `<div>${loc('evo_challenge_orbit_decay_effect',[5000])}</div><div class="has-text-caution">${loc('evo_challenge_scenario_failwarn')}</div>`;
            }
            else {
                return `<div>${loc('evo_challenge_orbit_decay_effect',[5000])}</div><div class="has-text-caution">${loc('evo_challenge_scenario_failwarn')}</div><div class="has-text-danger">${loc('evo_challenge_scenario_warn')}</div>`;
            }
        }
        case 'junker':
        {
            return global.city.biome === 'hellscape' && global.race.universe !== 'evil' ? `<div>${loc('evo_challenge_junker_effect')}</div><div class="has-text-special">${loc('evo_warn_unwise')}</div>` : loc('evo_challenge_junker_effect');
        }
        case 'cataclysm':
        {
            if (calc_mastery() >= 50){
                return `<div>${loc('evo_challenge_cataclysm_effect')}</div><div class="has-text-caution">${loc('evo_challenge_cataclysm_warn')}</div>`;
            }
            else {
                return `<div>${loc('evo_challenge_cataclysm_effect')}</div><div class="has-text-danger">${loc('evo_challenge_scenario_warn')}</div>`;
            }   
        }
        case 'gravity_well':
        {
            let addedFlag = !global.race.hasOwnProperty('gravity_well');
            if (addedFlag){ global.race['gravity_well'] = 1; }

            // Check storage based on current challenge genes
            // Could be pessimistic: trait-related adjustments are unknown in protoplasm stage
            let crates = 36*40;         // 36 freight yards   (max with no CRISPR is usually 46)
            let containers = 36*40;     // 36 container ports (max with no CRISPR is usually 45)
            if (global.stats.achieve['pathfinder'] && global.stats.achieve.pathfinder.l >= 1){
                crates *= 1.5;
                if (global.stats.achieve.pathfinder.l >= 2){
                    containers *= 1.5;
                }
            }
            // 10 wharves (can build up to 13 even with no CRISPR)
            crates += 10*20;
            containers += 10*20;

            // max crate tech = 4
            if (global.tech['container']) {
                let real_tech = global.tech['container'];
                global.tech['container'] = 4;
                crates *= crateValue();
                global.tech['container'] = real_tech;
            }
            else {
                global.tech['container'] = 4;
                crates *= crateValue();
                delete global.tech['container'];
            }

            // max container tech = 3
            if (global.tech['steel_container']) {
                let real_tech = global.tech['steel_container'];
                global.tech['steel_container'] = 3;
                containers *= containerValue();
                global.tech['steel_container'] = real_tech;
            }
            else {
                global.tech['steel_container'] = 3;
                containers *= containerValue();
                delete global.tech['steel_container'];
            }

            let warehouses = 40; // no spatial reasoning required for 43 warehouses
            let coeff = 50;      // roughly same as all pre-space warehouses tech + 26 supercolliders

            let cement_name = global.race['flier'] ? 'Stone' : 'Cement';
            let max_cement = crates + containers + storageMultipler(warehouses * coeff * actions.city.shed.val(cement_name));
            let num_fuel_depot = 0; // max with no CRISPR is usually 20 fuel depots
            let offset = global.city?.oil_depot?.count ?? 0;
            while (true){
                let costs = adjustCosts(actions.city.oil_depot, num_fuel_depot - offset);
                let cement_cost = costs[cement_name](num_fuel_depot - offset);
                if (cement_cost > max_cement){ break; }
                num_fuel_depot++;
            }

            let max_derrick = max_cement + storageMultipler(warehouses * coeff * actions.city.shed.val('Steel'));
            let num_oil_derrick = 0; // max with no CRISPR is usually 16 oil derricks
            offset = global.city?.oil_well?.count ?? 0;
            while (true){
                let costs = adjustCosts(actions.city.oil_well, num_oil_derrick - offset);
                let cement_cost = costs[cement_name](num_oil_derrick - offset);
                let steel_cost = costs['Steel'](num_oil_derrick - offset);
                if (cement_cost + steel_cost > max_derrick){ break; }
                num_oil_derrick++;
            }

            let num_propellant_depot = 0; // with low dark energy it may be impossible to build even 1 propellant depot
            let unified = global.race['unified'] ? 1.5 : 1;
            let max_oil = spatialReasoning(1000*unified*num_fuel_depot + 500*num_oil_derrick + 1250*unified*num_propellant_depot);
            offset = global.space?.propellant_depot?.count ?? 0;
            while (true){
                let costs = adjustCosts(actions.space.spc_home.propellant_depot, num_propellant_depot - offset);
                let oil_cost = costs['Oil'](num_propellant_depot - offset);
                if (oil_cost > max_oil){ break; }
                num_propellant_depot++;
                max_oil = spatialReasoning(1000*unified*num_fuel_depot + 500*num_oil_derrick + 1250*unified*num_propellant_depot);
            }

            let costs = adjustCosts(actions.space.spc_moon.moon_mission);
            let oil_cost = costs['Oil']();
            let show_warning = max_oil < oil_cost;

            if (addedFlag){ delete global.race['gravity_well']; }
            if (show_warning){
                return `<div>${loc('evo_challenge_gravity_well_effect')}</div><div class="has-text-danger">${loc('evo_challenge_gravity_well_warn')}</div>`;
            }
            break;
        }
        case 'warlord':
        {
            if (global.prestige.Artifact === 0){
                return `<div>${loc('evo_challenge_warlord_effect')}</div><div class="has-text-danger">${loc('evo_challenge_warlord_warn',[1,loc(`resource_Artifact_name`)])}</div>`;
            }
            break;
        }
    }
    return loc(`evo_challenge_${c}_effect`);
}

export function templeEffect(){
    let desc;
    if (global.race.universe === 'antimatter' || global.race['no_plasmid']){
        let faith = faithBonus(100); // 1 temple portion of faith, multiplied by 100 for a percentage display

        faith = +(faith).toFixed(3);
        desc = `<div>${loc('city_temple_effect1',[faith])}</div>`;
        if (global.race.universe === 'antimatter'){
            let temple = 6;
            if (global.genes['ancients'] && global.genes['ancients'] >= 2 && global.civic.priest.display){
                let priest = global.genes['ancients'] >= 5 ? 0.12 : (global.genes['ancients'] >= 3 ? 0.1 : 0.08);
                if (global.race['high_pop']){
                    priest = highPopAdjust(priest);
                }
                temple += priest * workerScale(global.civic.priest.workers,'priest');
            }
            desc += `<div>${loc('city_temple_effect5',[temple.toFixed(2)])}</div>`;
        }
    }
    else {
        let plasmid = templePlasmidBonus(100); // 1 temple portion of plasmids bonus, multiplied by 100 for a percentage display

        plasmid = +(plasmid).toFixed(3);
        desc = `<div>${loc('city_temple_effect2',[plasmid])}</div>`;
    }
    if (global.tech['fanaticism'] && global.tech['fanaticism'] >= 3){
        desc = desc + `<div>${loc('city_temple_effect3')}</div>`;
    }
    if (global.tech['anthropology'] && global.tech['anthropology'] >= 4){
        desc = desc + `<div>${global.race['truepath'] ? loc('city_temple_effect_tp',[2,25]) : loc('city_temple_effect4')}</div>`;
    }
    return desc;
}

export function casino_vault(){
    let vault = global.tech['gambling'] >= 3 ? 60000 : 40000;
    if (global.tech['gambling'] >= 5){
        vault += global.tech['gambling'] >= 6 ? 240000 : 60000;
    }
    vault = spatialReasoning(vault);
    if (global.race['gambler']){
        vault *= 1 + (traits.gambler.vars()[0] * global.race['gambler'] / 100);
    }
    if (global.tech['world_control']){
        vault *= 1.25;
    }
    if (global.race['truepath']){
        vault *= 1.5;
    }
    if (global.tech['stock_exchange'] && global.tech['gambling'] >= 4){
        vault *= 1 + (global.tech['stock_exchange'] * 0.05);
    }
    if (global.race['inflation']){
        vault *= 1 + (global.race.inflation / 100);
    }
    if (global.tech['isolation']){
        vault *= 5.5;
    }
    if (global.race['warlord']){
        let absorb = global.race?.absorbed?.length || 1;
        vault *= 1 + (absorb / 10);
        if (global.portal['hell_casino'] && global.portal.hell_casino.rank > 1){
            let rank = global.portal.hell_casino.rank - 1;
            vault *= 1 + rank * 0.1;
        }
    }
    return vault;
}

export function casinoEarn(){
    let cash = Math.log2(1 + global.resource[global.race.species].amount) * 2.5;
    if (global.race['gambler']){
        cash *= 1 + (traits.gambler.vars()[0] * global.race['gambler'] / 100);
    }
    if (global.tech['gambling'] && global.tech['gambling'] >= 2){
        cash *= global.tech.gambling >= 5 ? 2 : 1.5;
        if (global.tech['stock_exchange'] && global.tech['gambling'] >= 4){
            cash *= 1 + (global.tech['stock_exchange'] * 0.01);
        }
    }
    if (global.civic.govern.type === 'corpocracy'){
        cash *= 1 + (govEffect.corpocracy()[0] / 100);
    }
    if (global.civic.govern.type === 'socialist'){
        cash *= 1 - (govEffect.socialist()[3] / 100);
    }
    if (global.race['inflation']){
        cash *= 1 + (global.race.inflation / 1250);
    }
    if (global.tech['isolation']){
        cash *= 1.25;
        if (global.tech['iso_gambling']){
            cash *= 1 + (workerScale(global.civic.banker.workers,'banker') * 0.05)
        }
    }
    if (global.race['warlord'] && global.race['befuddle']){
        cash *= 1 + (traits.befuddle.vars()[0] / 100);
    }
    cash *= production('psychic_cash');
    let racVal = govActive('racketeer', 1);
    if (racVal){
        cash *= 1 + (racVal / 100);
    }
    if (global.race['wish'] && global.race['wishStats'] && global.race.wishStats.casino){
        cash *= 1.35;
    }
    if (global.race['warlord'] && global.portal['hell_casino'] && global.portal.hell_casino.rank > 1){
        let rank = global.portal.hell_casino.rank - 1;
        cash *= 1 + rank * 0.36;
    }
    return cash;
}

export function casinoEffect(){
    let money = Math.round(casino_vault());

    let joy = (global.tech['theatre'] && !global.race['joyless']) ? `<div>${loc('plus_max_resource',[jobScale(global.race['warlord'] ? 3 : 1),loc(`job_entertainer`)])}</div>` : '';
    let banker = global.race['orbit_decayed'] || global.tech['isolation'] || global.race['warlord'] ? `<div>${loc('plus_max_resource',[jobScale(1),loc('banker_name')])}</div>` : '';
    let desc = `<div>${loc('plus_max_resource',[`\$${money.toLocaleString()}`,loc('resource_Money_name')])}</div>${joy}${banker}<div>${loc('city_max_morale',[1])}</div>`;
    let cash = +(casinoEarn()).toFixed(2);
    desc = desc + `<div>${loc('tech_casino_effect2',[cash])}</div>`;
    return desc;
}

function evolveCosts(molecule,base,mult,offset){
    let count = (global.evolution.hasOwnProperty(molecule) ? global.evolution[molecule].count : 0) + (offset || 0);
    return count * mult + base;
}

function setChallenge(challenge){
    if (global.race[challenge]){
        delete global.race[challenge];
        $(`#evolution-${challenge}`).removeClass('hl');
        if (challenge === 'sludge'){
            Object.keys(races).forEach(function(r){
                if (r !== 'junker' && r !== 'sludge' && r !== 'ultra_sludge'){
                    $(`#evolution-${r}`).removeClass('is-hidden');
                }
            });
        }
    }
    else {
        global.race[challenge] = 1;
        $(`#evolution-${challenge}`).addClass('hl');
        if (challenge === 'sludge' || challenge === 'ultra_sludge'){
            Object.keys(races).forEach(function(r){
                if (r !== 'junker' && r !== 'sludge' && r !== 'ultra_sludge'){
                    $(`#evolution-${r}`).addClass('is-hidden');
                }
            });
            if (global.race['junker']){
                delete global.race['junker'];
            }
            if (challenge !== 'sludge'){
                delete global.race['sludge'];
            }
            if (challenge !== 'ultra_sludge'){
                delete global.race['ultra_sludge'];
            }
        }
        if (challenge === 'orbit_decay'){
            delete global.race['cataclysm'];
            delete global.race['warlord'];
            if (global.race['lone_survivor']){
                delete global.race['lone_survivor'];
                ['nerfed','badgenes'].forEach(function(gene){
                    delete global.race[challengeList[gene]];
                });
            }
        }
    }
    setChallengeScreen();
    challengeIcon();
}

function setScenario(scenario){
    if (!global.race['sludge']){
        Object.keys(races).forEach(function(r){
            if (r !== 'junker' && r !== 'sludge' && r !== 'ultra_sludge'){
                $(`#evolution-${r}`).removeClass('is-hidden');
            }
        });
    }
    if (global.race[scenario]){
        delete global.race[scenario];
        $(`#evolution-${scenario}`).removeClass('hl');
        ['nerfed','badgenes'].forEach(function(gene){
            delete global.race[challengeList[gene]];
        });
    }
    else {
        ['junker','cataclysm','banana','truepath','lone_survivor','fasting','warlord'].forEach(function(s){
            delete global.race[s];
            $(`#evolution-${s}`).removeClass('hl');
        });
        global.race[scenario] = 1;
        $(`#evolution-${scenario}`).addClass('hl');

        if (scenario === 'junker'){
            Object.keys(races).forEach(function(r){
                if (r !== 'junker' && r !== 'sludge' && r !== 'ultra_sludge'){
                    $(`#evolution-${r}`).addClass('is-hidden');
                }
            });
            if (global.race['sludge']){
                delete global.race['sludge'];
            }
            if (global.race['ultra_sludge']){
                delete global.race['ultra_sludge'];
            }
        }

        if (scenario === 'cataclysm' || scenario === 'lone_survivor' || scenario === 'warlord'){
            delete global.race['orbit_decay'];
        }

        if (scenario === 'truepath' || scenario === 'lone_survivor'){
            global.race['nerfed'] = 1;
            ['crispr','plasmid','mastery'].forEach(function(gene){
                delete global.race[challengeList[gene]];
            });
        }
        else {
            ['nerfed','badgenes'].forEach(function(gene){
                delete global.race[challengeList[gene]];
            });

            if (global.race.universe === 'antimatter'){
                global.race['weak_mastery'] = 1;
                if (!$(`#evolution-mastery`).hasClass('hl')){
                    $(`#evolution-mastery`).addClass('hl');
                }
            }
            else {
                global.race['no_plasmid'] = 1;
                if (!$(`#evolution-plasmid`).hasClass('hl')){
                    $(`#evolution-plasmid`).addClass('hl');
                }
            }
        }

        let genes = scenario === 'truepath' || scenario === 'lone_survivor' ? ['badgenes','trade','craft'] : ['crispr','trade','craft'];
        for (let i=0; i<genes.length; i++){
            global.race[challengeList[genes[i]]] = 1;
            if (!$(`#evolution-${genes[i]}`).hasClass('hl')){
                $(`#evolution-${genes[i]}`).addClass('hl');
            }
        }
    }
    setChallengeScreen();
    challengeIcon();
}

export function BHStorageMulti(val){
    if (global.stats.achieve['blackhole']){
        val *= 1 + global.stats.achieve.blackhole.l * 0.05;
    }
    return Math.round(val);
}

export function storageMultipler(scale = 1, wiki = false){
    let multiplier = ((global.tech['storage'] ?? 1) - 1) * 1.25 + 1;
    if (global.tech['storage'] >= 3){
        multiplier *= global.tech['storage'] >= 4 ? 3 : 1.5;
    }
    if (global.race['pack_rat']){
        multiplier *= 1 + (traits.pack_rat.vars()[1] / 100);
    }
    let fathom = fathomCheck('kobold');
    if (fathom > 0){
        multiplier *= 1 + (traits.pack_rat.vars(1)[1] / 100 * fathom);
    }
    if (global.tech['storage'] >= 6){
        multiplier *= 1 + (global.tech['supercollider'] / 20);
    }
    if (global.tech['tp_depot']){
        multiplier *= 1 + (global.tech['tp_depot'] / 20);
    }
    if (global.tech['shelving'] && global.tech.shelving >= 3){
        multiplier *= 1.5;
    }
    if (global.stats.achieve['blackhole']){
        multiplier *= 1 + global.stats.achieve.blackhole.l * 0.05;
    }
    multiplier *= global.tech['world_control'] ? 3 : 1;
    if (global.race['ascended']){
        multiplier *= 1.1;
    }
    if (global.blood['hoarder']){
        multiplier *= 1 + (global.blood['hoarder'] / 100);
    }
    if (global.tech['storage'] >= 7 && global.interstellar['cargo_yard']){
        multiplier *= 1 + ((global.interstellar['cargo_yard'].count * get_qlevel(wiki)) / 100);
    }
    return multiplier * scale;
}

export function checkCityRequirements(action){
    if ((global.race['kindling_kindred'] || global.race['smoldering']) && action === 'lumber'){
        return false;
    }
    else if ((global.race['kindling_kindred'] || global.race['smoldering']) && action === 'stone'){
        return true;
    }
    let c_path = global.race['truepath'] ? 'truepath' : 'standard';
    if (actions.city[action].hasOwnProperty('path') && !actions.city[action].path.includes(c_path)){
        return false;
    }
    var isMet = true;
    Object.keys(actions.city[action].reqs).forEach(function (req){
        if (!global.tech[req] || global.tech[req] < actions.city[action].reqs[req]){
            isMet = false;
        }
    });
    return isMet;
}

function checkTechPath(tech){
    let path = global.race['truepath'] ? 'truepath' : 'standard';
    if ((!techPath[path].includes(actions.tech[tech].era) && !actions.tech[tech].hasOwnProperty('path')) || (actions.tech[tech].hasOwnProperty('path') && !actions.tech[tech].path.includes(path))){
        return false;
    }
    return true;
}

export function skipRequirement(req,rank){
    if (global.race['flier'] && req === 'cement'){
        return true;
    }
    return false;
}

export function checkTechRequirements(tech,predList){
    let isMet = true; let precog = false;

    let failChecks = {};
    Object.keys(actions.tech[tech].reqs).forEach(function (req){
        if (skipRequirement(req, global.tech[req] || 0)){ return; }
        if (!global.tech[req] || global.tech[req] < actions.tech[tech].reqs[req]){
            isMet = false;
            failChecks[req] = actions.tech[tech].reqs[req];
        }
    });
    if (predList && typeof predList === 'object' && global.genes.hasOwnProperty('queue') && global.genes.queue >= 3){
        precog = true;
        global.r_queue.queue.forEach(function(q){
            if (checkTechRequirements(q.type,false)){
                predList[actions[q.action][q.type].grant[0]] = { v: actions[q.action][q.type].grant[1], a: q.type };
            }
        });
        Object.keys(failChecks).forEach(function (req){
            let cTech = global.tech[req] || 0;
            if (skipRequirement(req, global.tech[req] || 0)){ return; }
            if (!predList[req] || predList[req].v < actions.tech[tech].reqs[req] || predList[req].v > cTech + 1){
                precog = false;
            }
        });
    }
    if ((isMet || precog) && (!global.tech[actions.tech[tech].grant[0]] || global.tech[actions.tech[tech].grant[0]] < actions.tech[tech].grant[1])){
        return isMet ? 'ok' : 'precog';
    }
    return false;
}

export function checkTechQualifications(c_action,type){
    if (c_action['condition'] && !c_action.condition()){
        return false;
    }
    if (c_action['not_trait']){
        for (let i=0; i<c_action.not_trait.length; i++){
            if (global.race[c_action.not_trait[i]]){
                return false;
            }
        }
    }
    if (c_action['trait']){
        for (let i=0; i<c_action.trait.length; i++){
            if (!global.race[c_action.trait[i]]){
                return false;
            }
        }
    }
    if (c_action['not_gene']){
        for (let i=0; i<c_action.not_gene.length; i++){
            if (global.genes[c_action.not_gene[i]]){
                return false;
            }
        }
    }
    if (c_action['gene']){
        for (let i=0; i<c_action.gene.length; i++){
            if (!global.genes[c_action.gene[i]]){
                return false;
            }
        }
    }
    if (c_action['not_tech']){
        for (let i=0; i<c_action.not_tech.length; i++){
            if (global.tech[c_action.not_tech[i]]){
                return false;
            }
        }
    }
    return true;
}

function checkOldTech(tech){
    if (global?.tech_completed && global.tech_completed[tech]){
        return true;
    }
    let tch = actions.tech[tech].grant[0];
    if (global.tech[tch] && global.tech[tch] >= actions.tech[tech].grant[1]){
        switch (tech) {
            case 'fanaticism':
                return Boolean(global.tech['fanaticism']);
            case 'anthropology':
                return Boolean(global.tech['anthropology']);
            case 'deify':
                return Boolean(global.tech['ancient_deify']);
            case 'study':
                return Boolean(global.tech['ancient_study']);
            case 'isolation_protocol':
                return Boolean(global.tech['isolation']);
            case 'focus_cure':
                return Boolean(global.tech['focus_cure']);
            case 'vax_strat1':
                return Boolean(global.tech['vax_p']);
            case 'vax_strat2':
                return Boolean(global.tech['vax_f']);
            case 'vax_strat3':
                return Boolean(global.tech['vax_s']);
            case 'vax_strat4':
                return Boolean(global.tech['vax_c']);
            default:
                return true;
        }
    }
    return false;
}

function updateTechUnlockFlags(){
    const reqSet = new Set();
    Object.keys(actions.tech).forEach(function(tech_name){
        if (!checkTechPath(tech_name)){
            return;
        }
        const reqs = actions.tech[tech_name].reqs;
        if (!reqs){
            return;
        }
        Object.keys(reqs).forEach(function(req){
            if (skipRequirement(req, reqs[req])){
                return;
            }
            const level = reqs[req];
            if (!Number.isFinite(level)){
                return;
            }
            reqSet.add(`${req}:${level}`);
        });
    });
    Object.keys(actions.tech).forEach(function(tech_name){
        const grant = actions.tech[tech_name].grant;
        let unlocks = false;
        if (grant && grant.length >= 2 && Number.isFinite(grant[1])){
            unlocks = reqSet.has(`${grant[0]}:${grant[1]}`);
        }
        actions.tech[tech_name].unlocks_tech = unlocks;
    });
}

export function countAvailableResearchTechs(){
    if (!global.settings?.showResearch){
        return 0;
    }
    let count = 0;
    let preReq = {};
    Object.keys(actions.tech).forEach(function(tech_name){
        if (!checkTechPath(tech_name)){
            return;
        }
        if (checkOldTech(tech_name)){
            return;
        }
        const c_action = actions.tech[tech_name];
        if (!checkTechQualifications(c_action, tech_name)){
            return;
        }
        const techAvail = checkTechRequirements(tech_name, preReq);
        if (!techAvail){
            return;
        }
        if (!checkAffordable(c_action)){
            return;
        }
        count += 1;
    });
    return count;
}

export function checkPowerRequirements(c_action){
    let isMet = true;
    if (c_action['power_reqs']){
        Object.keys(c_action.power_reqs).forEach(function (req){
            if (!global.tech[req] || global.tech[req] < c_action.power_reqs[req]){
                isMet = false;
            }
        });
    }
    return isMet;
}

function registerTech(action){
    let tech = actions.tech[action].grant[0];
    if (!global.tech[tech]){
        global.tech[tech] = 0;
    }
    addAction('tech',action);
}

export function setupResourceDrag(stack, storageKey, options){
    if (!stack || !stack.length){
        return;
    }
    if (stack.data('dragBound')){
        return;
    }
    stack.data('dragBound', true);
    const config = options && typeof options === 'object' ? options : {};
    const handleSelector = config.handleSelector || null;
    const boundsSelector = config.boundsSelector || null;
    const disableWhenFloating = config.disableWhenFloating || false;
    const allowBodyDrag = config.allowBodyDrag || false;
    const dragThreshold = Number.isFinite(config.dragThreshold) ? config.dragThreshold : 4;
    const suppressClick = config.suppressClick || false;
    const clampToBounds = config.clampToBounds || false;
    const skipEnsureVisible = config.skipEnsureVisible === true;
    const skipEnsureInBounds = config.skipEnsureInBounds === true;
    const boundsPadding = config.boundsPadding ?? null;
    const scaleKey = config.scaleKey || null;
    const minScale = Number.isFinite(config.minScale) ? config.minScale : 0.35;
    const maxScale = Number.isFinite(config.maxScale) ? config.maxScale : 3;
    const scaleStep = Number.isFinite(config.scaleStep) ? config.scaleStep : 0.05;
    const scaleModifier = typeof config.scaleModifier === 'string' ? config.scaleModifier : 'alt';
    const scaleWithoutModifier = config.scaleWithoutModifier === true;
    const key = storageKey || 'evolve.outskirtsResourcePos';
    let offset = { x: 0, y: 0 };
    let scale = 1;
    if (save && save.getItem){
        const raw = save.getItem(key);
        if (raw){
            try {
                const parsed = JSON.parse(raw);
                if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)){
                    offset = { x: parsed.x, y: parsed.y };
                }
            }
            catch {
                // Ignore malformed stored offsets.
            }
        }
        if (scaleKey){
            const rawScale = save.getItem(scaleKey);
            const parsedScale = rawScale ? Number.parseFloat(rawScale) : NaN;
            if (Number.isFinite(parsedScale) && parsedScale > 0){
                scale = Math.min(maxScale, Math.max(minScale, parsedScale));
            }
        }
    }
    const applyOffset = (x, y) => {
        if (scaleKey){
            stack.css('transform', `translate(${x}px, ${y}px) scale(${scale})`);
        }
        else {
            stack.css('transform', `translate(${x}px, ${y}px)`);
        }
    };
    const setScale = (nextScale) => {
        if (!scaleKey){
            return;
        }
        scale = Math.min(maxScale, Math.max(minScale, nextScale));
        stack.data('dragScale', scale);
        applyOffset(offset.x, offset.y);
        if (save && save.setItem){
            save.setItem(scaleKey, scale.toFixed(3));
        }
    };
    applyOffset(offset.x, offset.y);
    let ensureAttempts = 0;
    const maxEnsureAttempts = 12;
    const resolveBoundsPadding = () => {
        if (boundsPadding == null){
            return null;
        }
        if (Number.isFinite(boundsPadding)){
            return {
                top: boundsPadding,
                right: boundsPadding,
                bottom: boundsPadding,
                left: boundsPadding
            };
        }
        if (typeof boundsPadding === 'object'){
            return {
                top: Number(boundsPadding.top) || 0,
                right: Number(boundsPadding.right) || 0,
                bottom: Number(boundsPadding.bottom) || 0,
                left: Number(boundsPadding.left) || 0
            };
        }
        return null;
    };

    const resolveBounds = () => {
        if (boundsSelector){
            const bounds = $(boundsSelector).first();
            if (bounds.length){
                return bounds;
            }
        }
        return stack.parent();
    };

    const getBoundsRect = () => {
        const parent = resolveBounds();
        if (!parent.length){
            return null;
        }
        const rect = parent[0].getBoundingClientRect();
        if (!rect.width || !rect.height){
            return rect;
        }
        const pad = resolveBoundsPadding();
        if (!pad){
            return rect;
        }
        return {
            top: rect.top - pad.top,
            right: rect.right + pad.right,
            bottom: rect.bottom + pad.bottom,
            left: rect.left - pad.left,
            width: rect.width + pad.left + pad.right,
            height: rect.height + pad.top + pad.bottom
        };
    };
    const ensureVisible = () => {
        if (!stack.length){
            return;
        }
        const parentRect = getBoundsRect();
        if (!parentRect){
            return;
        }
        if (!parentRect.width || !parentRect.height){
            if (ensureAttempts < maxEnsureAttempts){
                ensureAttempts += 1;
                if (typeof requestAnimationFrame === 'function'){
                    requestAnimationFrame(ensureVisible);
                }
                else {
                    setTimeout(ensureVisible, 50);
                }
            }
            return;
        }
        const stackRect = stack[0].getBoundingClientRect();
        const intersects = !(
            stackRect.right < parentRect.left ||
            stackRect.left > parentRect.right ||
            stackRect.bottom < parentRect.top ||
            stackRect.top > parentRect.bottom
        );
        if (!intersects){
            offset = { x: 0, y: 0 };
            applyOffset(offset.x, offset.y);
            if (save && save.setItem){
                save.setItem(key, JSON.stringify(offset));
            }
        }
    };
    if (!skipEnsureVisible){
        ensureVisible();
    }

    const ensureInBounds = () => {
        if (!clampToBounds){
            return;
        }
        if (!stack.length){
            return;
        }
        const parentRect = getBoundsRect();
        if (!parentRect){
            return;
        }
        if (!parentRect.width || !parentRect.height){
            if (ensureAttempts < maxEnsureAttempts){
                ensureAttempts += 1;
                if (typeof requestAnimationFrame === 'function'){
                    requestAnimationFrame(ensureInBounds);
                }
                else {
                    setTimeout(ensureInBounds, 50);
                }
            }
            return;
        }
        currentX = offset.x;
        currentY = offset.y;
        clampOffsetToBounds();
        if (currentX !== offset.x || currentY !== offset.y){
            offset = { x: currentX, y: currentY };
            applyOffset(offset.x, offset.y);
            if (save && save.setItem){
                save.setItem(key, JSON.stringify(offset));
            }
        }
    };
    if (!skipEnsureInBounds){
        ensureInBounds();
    }

    const clampOffsetToBounds = () => {
        if (!clampToBounds){
            return;
        }
        const parentRect = getBoundsRect();
        if (!parentRect){
            return;
        }
        if (!parentRect.width || !parentRect.height){
            return;
        }
        const stackRect = stack[0].getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (stackRect.width > parentRect.width){
            dx = parentRect.left - stackRect.left;
        }
        else {
            if (stackRect.left < parentRect.left){
                dx = parentRect.left - stackRect.left;
            }
            else if (stackRect.right > parentRect.right){
                dx = parentRect.right - stackRect.right;
            }
        }
        if (stackRect.height > parentRect.height){
            dy = parentRect.top - stackRect.top;
        }
        else {
            if (stackRect.top < parentRect.top){
                dy = parentRect.top - stackRect.top;
            }
            else if (stackRect.bottom > parentRect.bottom){
                dy = parentRect.bottom - stackRect.bottom;
            }
        }
        if (dx || dy){
            currentX += dx;
            currentY += dy;
            applyOffset(currentX, currentY);
        }
    };

    let dragging = false;
    let pending = false;
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let currentX = 0;
    let currentY = 0;

    const getPoint = (event) => {
        if (event?.touches?.length){
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        if (event?.changedTouches?.length){
            return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        }
        return { x: event.clientX, y: event.clientY };
    };

    const isTouchEvent = (event) => event.pointerType === 'touch' || event.type.startsWith('touch');

    const stopDrag = () => {
        if (!dragging && !pending){
            return;
        }
        const wasDragging = dragging;
        dragging = false;
        pending = false;
        if (wasDragging){
            clampOffsetToBounds();
            offset = { x: currentX, y: currentY };
            applyOffset(offset.x, offset.y);
            if (save && save.setItem){
                save.setItem(key, JSON.stringify(offset));
            }
            if (suppressClick){
                stack.data('justDragged', true);
            }
        }
        stack.removeClass('is-dragging');
        $(document).off('pointermove.outskirts pointerup.outskirts pointercancel.outskirts mousemove.outskirts mouseup.outskirts touchmove.outskirts touchend.outskirts touchcancel.outskirts');
    };

    const moveDrag = (event) => {
        if (!dragging && !pending){
            return;
        }
        const point = getPoint(event);
        const dx = point.x - startX;
        const dy = point.y - startY;
        if (!dragging){
            if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold){
                return;
            }
            dragging = true;
            pending = false;
            stack.addClass('is-dragging');
        }
        currentX = baseX + dx;
        currentY = baseY + dy;
        applyOffset(currentX, currentY);
        if (event.cancelable){
            event.preventDefault();
        }
    };

    const startDrag = (event) => {
        if (stack.hasClass('resources-fixed')){
            return;
        }
        if (disableWhenFloating && stack.hasClass('resources-floating')){
            return;
        }
        const isHandle = handleSelector ? $(event.target).closest(handleSelector).length > 0 : true;
        if (!isHandle){
            if (!allowBodyDrag){
                return;
            }
            if (isTouchEvent(event)){
                return;
            }
            if ($(event.target).closest('button, a, input, textarea, select, [role="button"], .job-avatar-control, .resource-resize-handle').length){
                return;
            }
        }
        if ($(event.target).closest('.resource-resize-handle').length){
            return;
        }
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        pending = true;
        const point = getPoint(event);
        startX = point.x;
        startY = point.y;
        baseX = offset.x;
        baseY = offset.y;
        currentX = baseX;
        currentY = baseY;
        $(document).on('pointermove.outskirts mousemove.outskirts touchmove.outskirts', moveDrag);
        $(document).on('pointerup.outskirts pointercancel.outskirts mouseup.outskirts touchend.outskirts touchcancel.outskirts', stopDrag);
        if (isHandle){
            event.preventDefault();
        }
    };

    const allowScale = () => Boolean(scaleKey);
    const hasModifier = (event) => {
        if (scaleWithoutModifier){
            return true;
        }
        switch (scaleModifier) {
            case 'shift':
                return event.shiftKey;
            case 'ctrl':
                return event.ctrlKey;
            case 'meta':
                return event.metaKey;
            case 'none':
                return true;
            case 'alt':
            default:
                return event.altKey;
        }
    };
    const onWheelScale = (event) => {
        if (!allowScale()){
            return;
        }
        const rawEvent = event.originalEvent || event;
        if (!rawEvent || !hasModifier(rawEvent)){
            return;
        }
        if (!Number.isFinite(rawEvent.deltaY) || rawEvent.deltaY === 0){
            return;
        }
        const direction = rawEvent.deltaY < 0 ? 1 : -1;
        setScale(scale + direction * scaleStep);
        if (event.cancelable){
            event.preventDefault();
        }
        event.stopPropagation();
    };
    if (scaleKey){
        stack.on('wheel.resdragscale', onWheelScale);
    }

    if (typeof window !== 'undefined' && window.PointerEvent){
        stack.on('pointerdown', startDrag);
    }
    else {
        stack.on('mousedown', startDrag);
        stack.on('touchstart', startDrag);
    }

    if (suppressClick && !stack.data('dragClickBound')){
        stack.data('dragClickBound', true);
        stack.on('click', (event) => {
            if (stack.data('justDragged')){
                stack.data('justDragged', false);
                event.preventDefault();
                event.stopPropagation();
            }
        });
    }
}

function setupAbsoluteDrag(stack, storageKey, options){
    if (!stack || !stack.length){
        return;
    }
    const config = options && typeof options === 'object' ? options : {};
    const boundsSelector = config.boundsSelector || null;
    const dragThreshold = Number.isFinite(config.dragThreshold) ? config.dragThreshold : 4;
    const suppressClick = config.suppressClick || false;
    const defaultPosition = config.defaultPosition || null;
    const disableDrag = config.disableDrag === true;
    if (stack.data('absDragBound')){
        if (disableDrag){
            stack.off('pointerdown.absdrag mousedown.absdrag touchstart.absdrag pointerdown mousedown touchstart');
        }
        return;
    }
    stack.data('absDragBound', true);
    const key = storageKey || 'evolve.absolutePos';
    let position = null;

    if (save && save.getItem){
        const raw = save.getItem(key);
        if (raw){
            try {
                const parsed = JSON.parse(raw);
                if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)){
                    position = { left: parsed.left, top: parsed.top };
                }
            }
            catch {
                // Ignore malformed stored positions.
            }
        }
    }

    const applyPosition = (left, top) => {
        stack.css({ left: `${left}px`, top: `${top}px`, transform: 'none' });
    };

    if (!position && defaultPosition){
        const next = typeof defaultPosition === 'function' ? defaultPosition() : defaultPosition;
        if (next && Number.isFinite(next.left) && Number.isFinite(next.top)){
            position = { left: next.left, top: next.top };
        }
    }
    if (position){
        applyPosition(position.left, position.top);
    }

    const resolveBounds = () => {
        if (boundsSelector){
            const bounds = $(boundsSelector).first();
            if (bounds.length){
                return bounds;
            }
        }
        return null;
    };

    const clampToBounds = (left, top) => {
        const bounds = resolveBounds();
        if (!bounds || !bounds.length){
            return { left, top };
        }
        const boundsRect = bounds[0].getBoundingClientRect();
        const rect = stack[0].getBoundingClientRect();
        let nextLeft = left;
        let nextTop = top;
        if (rect.width && rect.height){
            const maxLeft = boundsRect.right - rect.width;
            const maxTop = boundsRect.bottom - rect.height;
            nextLeft = Math.min(Math.max(left, boundsRect.left), maxLeft);
            nextTop = Math.min(Math.max(top, boundsRect.top), maxTop);
        }
        return { left: nextLeft, top: nextTop };
    };

    let dragging = false;
    let pending = false;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;

    const getPoint = (event) => {
        if (event?.touches?.length){
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        if (event?.changedTouches?.length){
            return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        }
        return { x: event.clientX, y: event.clientY };
    };

    const stopDrag = () => {
        if (!dragging && !pending){
            return;
        }
        const wasDragging = dragging;
        dragging = false;
        pending = false;
        if (wasDragging){
            const rect = stack[0].getBoundingClientRect();
            const finalLeft = rect.left;
            const finalTop = rect.top;
            if (save && save.setItem){
                save.setItem(key, JSON.stringify({ left: Math.round(finalLeft), top: Math.round(finalTop) }));
            }
            if (suppressClick){
                stack.data('justDragged', true);
            }
        }
        stack.removeClass('is-dragging');
        $(document).off('pointermove.absdrag pointerup.absdrag pointercancel.absdrag mousemove.absdrag mouseup.absdrag touchmove.absdrag touchend.absdrag touchcancel.absdrag');
    };

    const moveDrag = (event) => {
        if (!dragging && !pending){
            return;
        }
        const point = getPoint(event);
        const dx = point.x - startX;
        const dy = point.y - startY;
        if (!dragging){
            if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold){
                return;
            }
            dragging = true;
            pending = false;
            stack.addClass('is-dragging');
        }
        let nextLeft = baseLeft + dx;
        let nextTop = baseTop + dy;
        if (boundsSelector){
            const clamped = clampToBounds(nextLeft, nextTop);
            nextLeft = clamped.left;
            nextTop = clamped.top;
        }
        applyPosition(nextLeft, nextTop);
        if (event.cancelable){
            event.preventDefault();
        }
    };

    const startDrag = (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        pending = true;
        const point = getPoint(event);
        startX = point.x;
        startY = point.y;
        const rect = stack[0].getBoundingClientRect();
        baseLeft = rect.left;
        baseTop = rect.top;
        $(document).on('pointermove.absdrag mousemove.absdrag touchmove.absdrag', moveDrag);
        $(document).on('pointerup.absdrag pointercancel.absdrag mouseup.absdrag touchend.absdrag touchcancel.absdrag', stopDrag);
        event.preventDefault();
    };

    if (!disableDrag){
        if (typeof window !== 'undefined' && window.PointerEvent){
            stack.on('pointerdown.absdrag', startDrag);
        }
        else {
            stack.on('mousedown.absdrag', startDrag);
            stack.on('touchstart.absdrag', startDrag);
        }
    }
}

function setupResourceResize(stack, storageKey){
    if (!stack || !stack.length){
        return;
    }
    if (stack.data('resizeBound')){
        return;
    }
    stack.data('resizeBound', true);
    const key = storageKey || 'evolve.outskirtsResourceWidth';
    const minWidth = 160;
    if (save && save.getItem){
        const raw = save.getItem(key);
        const parsed = raw ? Number.parseFloat(raw) : NaN;
        if (Number.isFinite(parsed) && parsed > 0){
            stack.css('width', `${parsed}px`);
            stack.find('.resource').css('width', `${parsed}px`);
        }
    }

    let handle = stack.find('.resource-resize-handle');
    if (!handle.length){
        handle = $('<div class="resource-resize-handle" aria-hidden="true"></div>');
        stack.append(handle);
    }

    let resizing = false;
    let startX = 0;
    let startWidth = 0;
    let currentWidth = 0;

    const stopResize = () => {
        if (!resizing){
            return;
        }
        resizing = false;
        if (save && save.setItem && Number.isFinite(currentWidth) && currentWidth > 0){
            save.setItem(key, `${Math.round(currentWidth)}`);
        }
        stack.removeClass('is-resizing');
        $(document).off('pointermove.resresize pointerup.resresize pointercancel.resresize');
    };

    const moveResize = (event) => {
        if (!resizing){
            return;
        }
        const dx = event.clientX - startX;
        currentWidth = Math.max(minWidth, startWidth + dx);
        stack.css('width', `${currentWidth}px`);
        stack.find('.resource').css('width', `${currentWidth}px`);
    };

    handle.on('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        resizing = true;
        if (event.pointerId !== undefined && handle[0]?.setPointerCapture){
            handle[0].setPointerCapture(event.pointerId);
        }
        startX = event.clientX;
        const firstRow = stack.find('.resource').first();
        startWidth = firstRow.length ? firstRow.outerWidth() : stack.outerWidth();
        currentWidth = startWidth;
        stack.addClass('is-resizing');
        event.preventDefault();
        event.stopPropagation();
        $(document).on('pointermove.resresize', moveResize);
        $(document).on('pointerup.resresize pointercancel.resresize', stopResize);
    });
}

let cityDistrictLinkRaf = null;
let cityDistrictLinkObserver = null;
let cityDistrictLinkObserverTarget = null;
let cityDistrictLinkRetry = 0;
const CITY_DISTRICT_LINK_MAX_RETRY = 20;
const cityDistrictOpen = new Set();
let cityDistrictPanelLayoutScheduled = false;
let techRenderTarget = null;

function layoutCityDistrictPanels(){
    const grid = $('#cityDistrictGrid');
    if (!grid.length){
        return;
    }
    const openPanels = grid.find('.city-district-window:not(.district-collapsed)');
    grid.toggleClass('district-panel-open', openPanels.length > 0);
    let offset = 16;
    const gap = 12;
    openPanels.each((_, el) => {
        if (!el){
            return;
        }
        el.style.setProperty('--district-panel-top', `${offset}px`);
        const rect = el.getBoundingClientRect();
        offset += rect.height + gap;
    });
}

function scheduleCityDistrictPanelLayout(){
    if (cityDistrictPanelLayoutScheduled){
        return;
    }
    cityDistrictPanelLayoutScheduled = true;
    const run = () => {
        cityDistrictPanelLayoutScheduled = false;
        layoutCityDistrictPanels();
    };
    if (typeof requestAnimationFrame === 'function'){
        requestAnimationFrame(run);
    }
    else {
        setTimeout(run, 0);
    }
}
const CITY_DISTRICT_ICON_MAP = {
    outskirts: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/outskirts.webp',
    residential: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/residential-block.webp',
    commercial: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/commercial-district.webp',
    science: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/secience-sector.webp',
    military: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/military-complex.webp',
    trade: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/trade-district.webp',
    industrial: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/industrial-park.webp',
    utility: '/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/env/service&utility-sectors.webp'
};

function scheduleCityDistrictLinks(){
    if (typeof window === 'undefined'){
        return;
    }
    if (cityDistrictLinkRaf !== null){
        cancelAnimationFrame(cityDistrictLinkRaf);
    }
    cityDistrictLinkRaf = requestAnimationFrame(() => {
        cityDistrictLinkRaf = null;
        updateCityDistrictLinks();
    });
}

function ensureCityDistrictLinksObserver(gridEl){
    if (!gridEl || typeof window === 'undefined'){
        return;
    }
    if (window.ResizeObserver){
        if (!cityDistrictLinkObserver){
            cityDistrictLinkObserver = new ResizeObserver(() => {
                scheduleCityDistrictLinks();
            });
        }
        if (cityDistrictLinkObserverTarget !== gridEl){
            if (cityDistrictLinkObserverTarget){
                cityDistrictLinkObserver.unobserve(cityDistrictLinkObserverTarget);
            }
            cityDistrictLinkObserver.observe(gridEl);
            cityDistrictLinkObserverTarget = gridEl;
        }
    }
    if (!gridEl.dataset.cityLinksBound){
        gridEl.dataset.cityLinksBound = '1';
        gridEl.addEventListener('load', () => {
            scheduleCityDistrictLinks();
        }, true);
    }
}

function updateCityDistrictLinks(){
    if (typeof document === 'undefined'){
        return;
    }
    const grid = $('#cityDistrictGrid');
    const svgId = 'cityDistrictLinks';
    if (!grid.length || !grid.is(':visible')){
        $(`#${svgId}`).remove();
        return;
    }
    const gridEl = grid[0];
    ensureCityDistrictLinksObserver(gridEl);
    const gridRect = gridEl.getBoundingClientRect();
    if (!gridRect.width || !gridRect.height){
        if (cityDistrictLinkRetry < CITY_DISTRICT_LINK_MAX_RETRY){
            cityDistrictLinkRetry += 1;
            setTimeout(scheduleCityDistrictLinks, 100);
        }
        return;
    }
    cityDistrictLinkRetry = 0;

    let svg = $(`#${svgId}`);
    if (!svg.length){
        svg = $('<svg id="cityDistrictLinks" aria-hidden="true" focusable="false"></svg>');
        $('body').append(svg);
    }
    else if (!svg.parent().is('body')){
        svg.detach().appendTo('body');
    }
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || gridRect.width;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight || gridRect.height;
    svg.attr('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    svg.attr('width', viewportWidth);
    svg.attr('height', viewportHeight);
    svg.css({
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 100000
    });
    svg.empty();

    const residential = document.getElementById('city-dist-residential');
    if (!residential || !$(residential).is(':visible')){
        svg.remove();
        return;
    }
    const resRect = residential.getBoundingClientRect();
    const resCenter = {
        x: resRect.left + resRect.width / 2,
        y: resRect.top + resRect.height / 2
    };

    const pointOnEdge = (rect, toCenter) => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = toCenter.x - cx;
        const dy = toCenter.y - cy;
        if (!dx && !dy){
            return { x: cx, y: cy };
        }
        const halfW = Math.max(rect.width / 2, 1);
        const halfH = Math.max(rect.height / 2, 1);
        const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
        return { x: cx + dx * scale, y: cy + dy * scale };
    };

    const group = $('<g></g>');

    const targets = ['outskirts', 'commercial', 'science', 'military', 'trade', 'industrial', 'utility'];
    targets.forEach((key) => {
        const el = document.getElementById(`city-dist-${key}`);
        if (!el || !$(el).is(':visible')){
            return;
        }
        const rect = el.getBoundingClientRect();
        const targetCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        const start = pointOnEdge(resRect, targetCenter);
        const end = pointOnEdge(rect, resCenter);
        group.append(
            `<line class="road-base" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"></line>`
        );
        group.append(
            `<line class="road-center" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"></line>`
        );
    });
    svg.append(group);
}

if (typeof window !== 'undefined' && !window.evolveCityDistrictLinksBound){
    window.evolveCityDistrictLinksBound = true;
    window.addEventListener('resize', () => {
        scheduleCityDistrictLinks();
    });
}

function isDistrictOpen(category){
    return cityDistrictOpen.has(category);
}

function setDistrictOpen(category, open){
    if (!category){
        return;
    }
    if (open){
        cityDistrictOpen.clear();
        cityDistrictOpen.add(category);
    }
    else {
        cityDistrictOpen.delete(category);
    }
}

function ensureCityDistrictToggle(district, category){
    if (!district || !district.length || !category){
        return;
    }
    const toggleClass = 'district-toggle';
    const slotId = `city-dist-${category}-slot`;
    const ensureSlotPlaceholder = () => {
        if (!district || !district.length){
            return;
        }
        let slot = $(`#${slotId}`);
        if (!slot.length){
            slot = $(`<div id="${slotId}" class="city city-district-window district-placeholder district-collapsed" aria-hidden="true"></div>`);
            slot.insertBefore(district);
        }
    };
    const removeSlotPlaceholder = () => {
        $(`#${slotId}`).remove();
    };
    if (typeof window !== 'undefined' && !window.evolveCityDistrictPanelLayoutBound){
        window.evolveCityDistrictPanelLayoutBound = true;
        window.addEventListener('resize', () => {
            scheduleCityDistrictPanelLayout();
        });
    }
    let toggle = district.find(`.${toggleClass}`).first();
    if (!toggle.length){
        const icon = CITY_DISTRICT_ICON_MAP[category] || '';
        toggle = $(`
            <div class="${toggleClass}">
                <button type="button" class="district-toggle-button" aria-expanded="false" title="${loc(`city_dist_${category}`)}">
                    <span class="district-toggle-icon" aria-hidden="true"></span>
                </button>
            </div>
        `);
        toggle.find('.district-toggle-icon').css('background-image', icon ? `url(${icon})` : '');
        district.prepend(toggle);
    }

    if (!district.find('.district-close').length){
        district.append(`<button type="button" class="district-close" aria-label="Close">×</button>`);
    }
    if (!district.find('.district-backdrop').length){
        district.prepend(`<div class="district-backdrop" aria-hidden="true"></div>`);
    }

    const closeOtherDistrictPanels = () => {
        const grid = $('#cityDistrictGrid');
        if (!grid.length){
            return;
        }
        const others = grid.find('.city-district-window').not(district);
        others.each((_, el) => {
            const $el = $(el);
            if ($el.hasClass('district-collapsed')){
                return;
            }
            const id = $el.attr('id') || '';
            const match = id.match(/^city-dist-(.+)$/);
            const cat = match ? match[1] : null;
            $el.addClass('district-collapsed');
            setDistrictOpen(cat, false);
            $el.find('.district-toggle-button').attr('aria-expanded', 'false');
            $(`#city-dist-${cat}-slot`).remove();
        });
    };

    const open = isDistrictOpen(category);
    district.toggleClass('district-collapsed', !open);
    toggle.find('.district-toggle-button').attr('aria-expanded', open ? 'true' : 'false');
    if (open){
        ensureSlotPlaceholder();
        closeOtherDistrictPanels();
    }
    else {
        removeSlotPlaceholder();
    }
    scheduleCityDistrictPanelLayout();
    toggle.off('click.districtToggle').on('click.districtToggle', '.district-toggle-button', (event) => {
        if (district.data('justDragged')){
            district.data('justDragged', false);
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        district.toggleClass('district-collapsed');
        const nowOpen = !district.hasClass('district-collapsed');
        setDistrictOpen(category, nowOpen);
        toggle.find('.district-toggle-button').attr('aria-expanded', nowOpen ? 'true' : 'false');
        if (nowOpen){
            ensureSlotPlaceholder();
            closeOtherDistrictPanels();
        }
        else {
            removeSlotPlaceholder();
        }
        scheduleCityDistrictPanelLayout();
    });

    district.off('click.districtClose').on('click.districtClose', '.district-close', (event) => {
        event.preventDefault();
        event.stopPropagation();
        district.addClass('district-collapsed');
        setDistrictOpen(category, false);
        toggle.find('.district-toggle-button').attr('aria-expanded', 'false');
        removeSlotPlaceholder();
        scheduleCityDistrictPanelLayout();
    });

    if (typeof window !== 'undefined' && !window.evolveCityDistrictOutsideCloseBound){
        window.evolveCityDistrictOutsideCloseBound = true;
        $(document).on('click.cityDistrictOutsideClose', (event) => {
            const target = $(event.target);
            const grid = $('#cityDistrictGrid');
            const districts = $('#cityDistrictGrid .city-district-window');
            if (!districts.length){
                return;
            }
            const inGrid = target.closest('#cityDistrictGrid').length > 0;
            const inDistrict = target.closest('.city-district-window').length > 0;
            if (inGrid && inDistrict){
                return;
            }
            if (target.closest('#researchFloatingPanel, #researchFloatingToggle, #civilTripleResearch, #mTabResearch, .researchTabs, #resQueue').length){
                return;
            }
            if (inGrid && !inDistrict){
                // Clicked the grid background: close all open districts.
            }
            if (!inGrid){
                // Clicked outside the grid: close all open districts.
            }
            districts.each((_, el) => {
                const $el = $(el);
                if ($el.hasClass('district-collapsed')){
                    return;
                }
                const id = $el.attr('id') || '';
                const match = id.match(/^city-dist-(.+)$/);
                const cat = match ? match[1] : null;
                $el.addClass('district-collapsed');
                setDistrictOpen(cat, false);
                $el.find('.district-toggle-button').attr('aria-expanded', 'false');
                $(`#city-dist-${cat}-slot`).remove();
            });
            scheduleCityDistrictPanelLayout();
        });
    }
}

export function gainTech(action){
    let tech = actions.tech[action].grant[0];
    if (!global.tech_completed){
        global.tech_completed = {};
    }
    global.tech_completed[action] = true;
    global.tech[tech] = actions.tech[action].grant[1];
    if (tech === 'container' && global.tech[tech] >= 1 && !global.resource.Crates.display){
        unlockCrates();
    }
    if (tech === 'steel_container' && global.tech[tech] >= 1 && !global.resource.Containers.display){
        unlockContainers();
    }
    drawCity();
    drawTech(true);
    if (typeof requestAnimationFrame === 'function'){
        requestAnimationFrame(() => {
            requestAnimationFrame(() => drawTech(true));
        });
    }
    else {
        setTimeout(() => drawTech(true), 0);
    }
    renderSpace();
    renderFortress();
    renderTauCeti();
    renderEdenic();
    const techId = actions?.tech?.[action]?.id;
    scheduleResearchRefresh(techId);
}

export var cLabels = global.settings['cLabels'];
export function drawCity(force = false){
    if (!force && !global.settings.tabLoad && (!isMainTabActive('civ') || global.settings.spaceTabs !== 0)){
        return;
    }
    if (!global.settings.showCity){
        return;
    }
    let city_buildings = {};
    Object.keys(actions.city).forEach(function (city_name) {
        removeAction(actions.city[city_name].id);

        if(!checkCityRequirements(city_name))
            return;

        let action = actions.city[city_name];
        let category = 'category' in action ? action.category : 'utility';

        if(!(category in city_buildings)) {
            city_buildings[category] = [];
        }

        if (global.settings['cLabels']){
            city_buildings[category].push(city_name);
        }
        else {
            addAction('city', city_name);
        }
    });

    let city_categories =  [
        'outskirts',
        'residential',
        'commercial',
        'science',
        'military',
        'trade',
        'industrial',
        'utility'
    ];

    const industrialResources = ['Copper','Iron','Aluminium','Cement','Coal','Steel','Plywood','Brick','Wrought_Iron','Sheet_Metal'];
    const tradeResources = ['Crates','Containers'];
    const scienceResources = ['Knowledge'];
    const commercialResources = ['Money'];
    const residentialResources = global.race?.species === 'pinguicula' ? [global.race.species] : [];

    const buildDistrictResourceStack = (district, resources, stackId, posKey, widthKey, idSuffix) => {
        if (!district || !district.length || !resources?.length){
            return;
        }
        const suffix = idSuffix || stackId;
        const rows = [];
        const binds = [];
        const addDistrictResource = (resName) => {
            const res = global.resource?.[resName];
            if (!res || !res.display){
                return;
            }
            const color = tmp_vars?.resource?.[resName]?.color || 'info';
            const showBar = res.max > 0 && global.settings?.resBar?.[resName] ? ' showBar' : '';
            const countText = res.max > 0
                ? '{{ amount | size }} / {{ max | size }}'
                : '{{ amount | diffSize }}';
            const rowId = `res${resName}${suffix}`;
            const countId = `cnt${resName}${suffix}`;
            const diffId = `inc${resName}${suffix}`;
            const row = $(
                `<div id="${rowId}" class="resource${showBar} district-resource" v-show="display" :style="{ '--percent-full': (bar && max > 0 ? (amount/max)*100 : 0) + '%', '--percent-full-ratio': (bar && max > 0 ? Math.min(amount / max, 1) : 0) }">` +
                    `<div><h3 class="res has-text-${color}">${res.name}</h3>` +
                    `<span id="${countId}" class="count">${countText}</span></div>` +
                `</div>`
            );
            const showCraft = res.max === -1 && !global.race['no_craft'] && resName !== 'Scarletite' && resName !== 'Quantium';
            const showRate = !showCraft && (res.rate !== 0 || (res.max === -1 && res.rate === 0 && global.race['no_craft']) || resName === 'Scarletite' || resName === 'Quantium');
            const showFastingDiff = !showCraft && !showRate && global.race['fasting'] && resName === global.race.species;

            if (showCraft){
                const craft = $('<span class="craftable"></span>');
                const inc = [1,5];
                inc.forEach(function(amount){
                    craft.append(
                        `<span id="${diffId}${amount}">` +
                            `<a @click="craft('${resName}',${amount})" aria-label="craft ${amount} ${res.name}" role="button">` +
                                `+<span class="craft" data-val="${amount}">${amount}</span>` +
                            `</a>` +
                        `</span>`
                    );
                });
                craft.append(
                    `<span id="${diffId}A">` +
                        `<a @click="craft('${resName}','A')" aria-label="craft max ${res.name}" role="button">` +
                            `+<span class="craft" data-val="A">A</span>` +
                        `</a>` +
                    `</span>`
                );
                row.append(craft);
            }
            else {
                row.append('<span></span>');
            }

            if (showRate){
                row.append(`<span id="${diffId}" class="diff">{{ diff | diffSize }} /s</span>`);
            }
            else if (showFastingDiff){
                row.append(`<span id="${diffId}" class="diff">{{ diff | diffSize }}</span>`);
            }
            else {
                row.append('<span></span>');
            }
            rows.push(row);
            binds.push({ id: rowId, res, resName, countId, diffId });
        };

        resources.forEach(addDistrictResource);
        if (!rows.length){
            return;
        }

        const stack = $(`<div id="${stackId}" class="${stackId}"></div>`);
        rows.forEach(function(row){
            stack.append(row);
        });
        district.prepend(stack);
        setupResourceDrag(stack, posKey);
        setupResourceResize(stack, widthKey);
        binds.forEach(function(bind){
            vBind({
                el: `#${bind.id}`,
                data: bind.res,
                filters: {
                    size(value){
                        return value ? sizeApproximation(value,0) : value;
                    },
                    diffSize(value){
                        return sizeApproximation(value,2);
                    }
                }
            });
            if ((bind.resName !== global.race.species || global.race['fasting']) && bind.resName !== 'Crates' && bind.resName !== 'Containers' && bind.res.max !== -1){
                breakdownPopover(bind.countId, bind.resName, 'c');
                breakdownPopover(bind.diffId, bind.resName, 'p');
            }
        });
    };

    let districtGrid = null;
    if (global.settings['cLabels']){
        districtGrid = $('#cityDistrictGrid');
        if (!districtGrid.length){
            districtGrid = $('<div id="cityDistrictGrid" class="city-district-grid"></div>');
            $('#city').append(districtGrid);
        }
        else if (!districtGrid.parent().is('#city')){
            districtGrid.detach().appendTo('#city');
        }
    }
    if (global.settings['cLabels'] && districtGrid && districtGrid.length){
        let cityOverlay = $('#cityOverlayLayer');
        if (!cityOverlay.length){
            cityOverlay = $('<div id="cityOverlayLayer" aria-hidden="true"></div>');
            $('body').append(cityOverlay);
        }
        let armyScene = districtGrid.find('.city-army-scene').first();
        if (!armyScene.length){
            armyScene = $('<div class="city-army-scene" aria-hidden="true"><div class="army-unit-layer"></div></div>');
            districtGrid.prepend(armyScene);
        }
        else if (!armyScene.find('.army-unit-layer').length){
            armyScene.append('<div class="army-unit-layer"></div>');
        }
        let junYingProp = districtGrid.find('.city-bg-prop-jun-ying');
        if (!junYingProp.length){
            junYingProp = $('<div class="city-bg-prop city-bg-prop-jun-ying" aria-hidden="true"></div>');
            districtGrid.prepend(junYingProp);
        }
        setupResourceDrag(
            junYingProp,
            'evolve.cityGrid.junYingPos',
            {
                boundsSelector: '#cityDistrictGrid',
                clampToBounds: true
            }
        );
        const lumberAction = actions?.city?.lumber;
        const foodAction = actions?.city?.food;
        const stoneAction = actions?.city?.stone;
        const groveAction = actions?.city?.basic_housing;
        const farmAction = actions?.city?.farm;
        const lumberYardAction = actions?.city?.lumber_yard;
        const storageYardAction = actions?.city?.storage_yard;
        const cottageAction = actions?.city?.cottage;
        const sawmillAction = actions?.city?.sawmill;
        const shedAction = actions?.city?.shed;
        const universityAction = actions?.city?.university;
        const garrisonAction = actions?.city?.garrison;
        const siloAction = actions?.city?.silo;
        const bankAction = actions?.city?.bank;
        const mineAction = actions?.city?.mine;
        const coalMineAction = actions?.city?.coal_mine;
        const cementAction = actions?.city?.cement_plant;
        const smelterAction = actions?.city?.smelter;
        const foundryAction = actions?.city?.foundry;
        const libraryAction = actions?.city?.library;
        const amphitheatreAction = actions?.city?.amphitheatre;
        const isPlantRace = (() => {
            const raceType = global?.race?.maintype || races?.[global?.race?.species]?.type;
            return raceType === 'plant';
        })();
        const buildLumberTooltip = () => {
            if (!lumberAction){
                return loc('city_lumber_desc',[1]);
            }
            return typeof lumberAction.desc === 'string' ? lumberAction.desc : lumberAction.desc();
        };
        const buildFoodTooltip = () => {
            if (!foodAction){
                return loc('city_food_desc',[1]);
            }
            let gain = foodAction.val(false);
            let hallowed = getHalloween();
            if (global.race['fasting']){
                return loc('city_food_fasting');
            }
            if (hallowed.active){
                return global.tech['conjuring'] ? loc('city_trick_conjure_desc',[gain]) : loc('city_trick_desc',[gain]);
            }
            return global.tech['conjuring'] ? loc('city_food_conjure_desc',[gain]) : loc('city_food_desc',[gain]);
        };
        const buildAmberTooltip = () => {
            if (!stoneAction){
                const amberName = global.resource?.Stone?.name || loc('resource_Amber_name');
                return loc('city_amber_desc', [1, amberName]);
            }
            return typeof stoneAction.desc === 'string' ? stoneAction.desc : stoneAction.desc();
        };
        const buildGroveTooltip = () => {
            if (!groveAction){
                return loc('city_basic_housing_desc');
            }
            return typeof groveAction.desc === 'string' ? groveAction.desc : groveAction.desc();
        };
        const buildFarmTooltip = () => {
            if (!farmAction){
                return loc('city_farm_desc');
            }
            return typeof farmAction.desc === 'string' ? farmAction.desc : farmAction.desc();
        };
        const buildLumberYardTooltip = () => {
            if (!lumberYardAction){
                return loc('city_lumber_yard');
            }
            return typeof lumberYardAction.desc === 'string' ? lumberYardAction.desc : lumberYardAction.desc();
        };
        const buildStorageYardTooltip = () => {
            if (!storageYardAction){
                return loc('city_storage_yard');
            }
            return typeof storageYardAction.desc === 'string' ? storageYardAction.desc : storageYardAction.desc();
        };
        const buildCottageTooltip = () => {
            if (!cottageAction){
                return loc('city_cottage_title1');
            }
            return typeof cottageAction.desc === 'string' ? cottageAction.desc : cottageAction.desc();
        };
        const buildSawmillTooltip = () => {
            if (!sawmillAction){
                return loc('city_sawmill');
            }
            return typeof sawmillAction.desc === 'string' ? sawmillAction.desc : sawmillAction.desc();
        };
        const buildShedTooltip = () => {
            if (!shedAction){
                return loc('city_shed_title1');
            }
            return typeof shedAction.desc === 'string' ? shedAction.desc : shedAction.desc();
        };
        const buildUniversityTooltip = () => {
            if (!universityAction){
                return loc('city_university');
            }
            return typeof universityAction.desc === 'string' ? universityAction.desc : universityAction.desc();
        };
        const buildGarrisonTooltip = () => {
            if (!garrisonAction){
                return loc('city_garrison_desc');
            }
            return typeof garrisonAction.desc === 'string' ? garrisonAction.desc : garrisonAction.desc();
        };
        const buildSiloTooltip = () => {
            if (!siloAction){
                return loc('city_silo');
            }
            return typeof siloAction.desc === 'string' ? siloAction.desc : siloAction.desc();
        };
        const buildBankTooltip = () => {
            if (!bankAction){
                return loc('city_bank');
            }
            return typeof bankAction.desc === 'string' ? bankAction.desc : bankAction.desc();
        };
        const buildMineTooltip = () => {
            if (!mineAction){
                return loc('city_mine_desc');
            }
            return typeof mineAction.desc === 'string' ? mineAction.desc : mineAction.desc();
        };
        const buildCoalMineTooltip = () => {
            if (!coalMineAction){
                return loc('city_coal_mine');
            }
            return typeof coalMineAction.desc === 'string' ? coalMineAction.desc : coalMineAction.desc();
        };
        const buildCementTooltip = () => {
            if (!cementAction){
                return loc('city_cement_plant_desc');
            }
            return typeof cementAction.desc === 'string' ? cementAction.desc : cementAction.desc();
        };
        const buildSmelterTooltip = () => {
            if (!smelterAction){
                return loc('city_smelter_desc');
            }
            return typeof smelterAction.desc === 'string' ? smelterAction.desc : smelterAction.desc();
        };
        const buildFoundryTooltip = () => {
            if (!foundryAction){
                return loc('city_foundry_desc');
            }
            return typeof foundryAction.desc === 'string' ? foundryAction.desc : foundryAction.desc();
        };
        const buildLibraryTooltip = () => {
            if (!libraryAction){
                const planet = races?.[global?.race?.species]?.home;
                return planet ? loc('city_library_desc', [planet]) : loc('city_library');
            }
            return typeof libraryAction.desc === 'string' ? libraryAction.desc : libraryAction.desc();
        };
        const buildAmphitheatreTooltip = () => {
            if (!amphitheatreAction){
                return loc('city_amphitheatre_desc');
            }
            return typeof amphitheatreAction.desc === 'string' ? amphitheatreAction.desc : amphitheatreAction.desc();
        };
        const mapCoverRect = (imageRect, imageSize, containerRect) => {
            if (!containerRect || !containerRect.width || !containerRect.height){
                return null;
            }
            const scale = Math.max(containerRect.width / imageSize.width, containerRect.height / imageSize.height);
            const scaledWidth = imageSize.width * scale;
            const scaledHeight = imageSize.height * scale;
            const offsetX = (scaledWidth - containerRect.width) / 2;
            const offsetY = (scaledHeight - containerRect.height) / 2;
            return {
                left: imageRect.x * scale - offsetX,
                top: imageRect.y * scale - offsetY,
                width: imageRect.width * scale,
                height: imageRect.height * scale
            };
        };
        const applyCoverRect = (target, imageRect, imageSize) => {
            if (!target || !target.length){
                return false;
            }
            const rect = mapCoverRect(imageRect, imageSize, districtGrid[0]?.getBoundingClientRect?.());
            if (!rect){
                return false;
            }
            target.css({
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                transform: 'none'
            });
            return true;
        };
        const scheduleCoverRect = (target, imageRect, imageSize) => {
            if (target?.data){
                target.data('coverRect', imageRect);
                target.data('coverSize', imageSize);
                target.attr('data-cover-rect', '1');
            }
            if (applyCoverRect(target, imageRect, imageSize)){
                return;
            }
            let tries = 0;
            const retry = () => {
                if (applyCoverRect(target, imageRect, imageSize)){
                    return;
                }
                tries += 1;
                if (tries < 6){
                    if (typeof requestAnimationFrame === 'function'){
                        requestAnimationFrame(retry);
                    }
                    else {
                        setTimeout(retry, 50);
                    }
                }
            };
            if (typeof requestAnimationFrame === 'function'){
                requestAnimationFrame(retry);
            }
            else {
                setTimeout(retry, 50);
            }
        };
        const isCityPropInnerHit = (event) => {
            if (!event?.target){
                return false;
            }
            return $(event.target).closest('.city-bg-prop-inner').length > 0;
        };
        const refreshCoverRects = () => {
            if (!districtGrid || !districtGrid.length){
                return;
            }
            districtGrid.find('[data-cover-rect="1"]').each((_, el) => {
                const target = $(el);
                const rect = target.data('coverRect');
                const size = target.data('coverSize');
                if (rect && size){
                    applyCoverRect(target, rect, size);
                }
            });
        };
        const mapCoverPointFromContainer = (point, imageSize, containerRect) => {
            if (!containerRect || !containerRect.width || !containerRect.height){
                return null;
            }
            const scale = Math.max(containerRect.width / imageSize.width, containerRect.height / imageSize.height);
            const scaledWidth = imageSize.width * scale;
            const scaledHeight = imageSize.height * scale;
            const offsetX = (scaledWidth - containerRect.width) / 2;
            const offsetY = (scaledHeight - containerRect.height) / 2;
            return {
                x: (point.x + offsetX) / scale,
                y: (point.y + offsetY) / scale
            };
        };
        if (!districtGrid.data('coverRectObserver')){
            const scheduleRefresh = (() => {
                let queued = false;
                return () => {
                    if (queued){
                        return;
                    }
                    queued = true;
                    const run = () => {
                        queued = false;
                        refreshCoverRects();
                    };
                    if (typeof requestAnimationFrame === 'function'){
                        requestAnimationFrame(run);
                    }
                    else {
                        setTimeout(run, 50);
                    }
                };
            })();
            try {
                if (typeof ResizeObserver === 'function'){
                    const observer = new ResizeObserver(() => scheduleRefresh());
                    observer.observe(districtGrid[0]);
                    districtGrid.data('coverRectObserver', observer);
                }
                else {
                    $(window).on('resize', scheduleRefresh);
                    districtGrid.data('coverRectObserver', 'window-resize');
                }
            }
            catch {
                // Ignore observer errors.
            }
        }
        const showLumberFx = (event, gain) => {
            const grid = districtGrid || $('#cityDistrictGrid');
            if (!grid.length){
                return;
            }
            const rect = grid[0].getBoundingClientRect();
            const x = (event?.clientX ?? rect.left + rect.width / 2) - rect.left;
            const y = (event?.clientY ?? rect.top + rect.height / 2) - rect.top;
            const fx = $('<div class="wood-collect-fx" aria-hidden="true"></div>');
            fx.text(`+${gain}`);
            fx.css({ left: `${x}px`, top: `${y}px` });
            grid.append(fx);
            setTimeout(() => fx.remove(), 900);
        };
        const showFoodFx = (event, gain) => {
            const grid = districtGrid || $('#cityDistrictGrid');
            if (!grid.length){
                return;
            }
            const rect = grid[0].getBoundingClientRect();
            const x = (event?.clientX ?? rect.left + rect.width / 2) - rect.left;
            const y = (event?.clientY ?? rect.top + rect.height / 2) - rect.top;
            const fx = $('<div class="food-collect-fx" aria-hidden="true"></div>');
            fx.text(`+${gain}`);
            fx.css({ left: `${x}px`, top: `${y}px` });
            grid.append(fx);
            setTimeout(() => fx.remove(), 900);
        };
        const showAmberFx = (event, gain) => {
            const grid = districtGrid || $('#cityDistrictGrid');
            if (!grid.length){
                return;
            }
            const rect = grid[0].getBoundingClientRect();
            const x = (event?.clientX ?? rect.left + rect.width / 2) - rect.left;
            const y = (event?.clientY ?? rect.top + rect.height / 2) - rect.top;
            const fx = $('<div class="wood-collect-fx" aria-hidden="true"></div>');
            fx.text(`+${gain}`);
            fx.css({ left: `${x}px`, top: `${y}px` });
            grid.append(fx);
            setTimeout(() => fx.remove(), 900);
        };
        const collectLumber = (event) => {
            if (!lumberAction){
                return false;
            }
            if (event?.isDefaultPrevented?.()){
                return false;
            }
            if (global.settings.pause){
                return false;
            }
            if (global.race?.evil || global.race?.cataclysm){
                return false;
            }
            if (global.race?.kindling_kindred || global.race?.smoldering){
                return false;
            }
            const lumberRes = global.resource?.Lumber;
            if (!lumberRes){
                return false;
            }
            if (Number.isFinite(lumberRes.max) && lumberRes.amount >= lumberRes.max){
                return false;
            }
            const gain = lumberAction.val(true);
            if (gain <= 0){
                return false;
            }
            modRes('Lumber', gain, true);
            global.stats.clumber++;
            global.stats.tlumber++;
            showLumberFx(event, gain);
            return true;
        };
        const collectLumberOnce = (event) => {
            if (!lumberAction){
                return false;
            }
            if (event?.isDefaultPrevented?.()){
                return false;
            }
            if (global.settings.pause){
                return false;
            }
            if (global.race?.evil || global.race?.cataclysm){
                return false;
            }
            if (global.race?.kindling_kindred || global.race?.smoldering){
                return false;
            }
            const lumberRes = global.resource?.Lumber;
            if (!lumberRes){
                return false;
            }
            if (Number.isFinite(lumberRes.max) && lumberRes.amount >= lumberRes.max){
                return false;
            }
            const gain = 1;
            modRes('Lumber', gain, true);
            global.stats.clumber++;
            global.stats.tlumber++;
            showLumberFx(event, gain);
            return true;
        };
        const collectAmber = (event) => {
            if (!stoneAction){
                return false;
            }
            if (event?.isDefaultPrevented?.()){
                return false;
            }
            if (global.settings.pause){
                return false;
            }
            if (!global.race?.sappy){
                return false;
            }
            const amberRes = global.resource?.Stone;
            if (!amberRes){
                return false;
            }
            if (Number.isFinite(amberRes.max) && amberRes.amount >= amberRes.max){
                return false;
            }
            const gain = stoneAction.val(true);
            if (gain <= 0){
                return false;
            }
            modRes('Stone', gain, true);
            global.stats.cstone++;
            global.stats.tstone++;
            showAmberFx(event, gain);
            return true;
        };
        const bindLumberTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('lumberTooltipBound')){
                return;
            }
            target.data('lumberTooltipBound', true);
            const popId = lumberAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildLumberTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (lumberAction){
                        actionDesc(obj.popper,lumberAction,global?.city?.lumber,false,'city','lumber');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindFoodTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('foodTooltipBound')){
                return;
            }
            target.data('foodTooltipBound', true);
            const popId = foodAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildFoodTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (foodAction){
                        actionDesc(obj.popper, foodAction, global?.city?.food, false, 'city', 'food');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindAmberTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('amberTooltipBound')){
                return;
            }
            target.data('amberTooltipBound', true);
            const popId = stoneAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildAmberTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (stoneAction){
                        actionDesc(obj.popper, stoneAction, global?.city?.stone, false, 'city', 'stone');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindGroveTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('groveTooltipBound')){
                return;
            }
            target.data('groveTooltipBound', true);
            const popId = groveAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildGroveTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (groveAction){
                        actionDesc(obj.popper, groveAction, global?.city?.basic_housing, false, 'city', 'basic_housing');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindFarmTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('farmTooltipBound')){
                return;
            }
            target.data('farmTooltipBound', true);
            const popId = farmAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildFarmTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (farmAction){
                        actionDesc(obj.popper, farmAction, global?.city?.farm, false, 'city', 'farm');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindLumberYardTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('lumberYardTooltipBound')){
                return;
            }
            target.data('lumberYardTooltipBound', true);
            const popId = lumberYardAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildLumberYardTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (lumberYardAction){
                        actionDesc(obj.popper, lumberYardAction, global?.city?.lumber_yard, false, 'city', 'lumber_yard');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindStorageYardTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('storageYardTooltipBound')){
                return;
            }
            target.data('storageYardTooltipBound', true);
            const popId = storageYardAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildStorageYardTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (storageYardAction){
                        actionDesc(obj.popper, storageYardAction, global?.city?.storage_yard, false, 'city', 'storage_yard');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindCottageTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('cottageTooltipBound')){
                return;
            }
            target.data('cottageTooltipBound', true);
            const popId = cottageAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildCottageTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (cottageAction){
                        actionDesc(obj.popper, cottageAction, global?.city?.cottage, false, 'city', 'cottage');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindSawmillTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('sawmillTooltipBound')){
                return;
            }
            target.data('sawmillTooltipBound', true);
            const popId = sawmillAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildSawmillTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (sawmillAction){
                        actionDesc(obj.popper, sawmillAction, global?.city?.sawmill, false, 'city', 'sawmill');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindShedTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('shedTooltipBound')){
                return;
            }
            target.data('shedTooltipBound', true);
            const popId = shedAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildShedTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (shedAction){
                        actionDesc(obj.popper, shedAction, global?.city?.shed, false, 'city', 'shed');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindUniversityTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('universityTooltipBound')){
                return;
            }
            target.data('universityTooltipBound', true);
            const popId = universityAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildUniversityTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (universityAction){
                        actionDesc(obj.popper, universityAction, global?.city?.university, false, 'city', 'university');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindGarrisonTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('garrisonTooltipBound')){
                return;
            }
            target.data('garrisonTooltipBound', true);
            const popId = garrisonAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildGarrisonTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (garrisonAction){
                        actionDesc(obj.popper, garrisonAction, global?.city?.garrison, false, 'city', 'garrison');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindSiloTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('siloTooltipBound')){
                return;
            }
            target.data('siloTooltipBound', true);
            const popId = siloAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildSiloTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (siloAction){
                        actionDesc(obj.popper, siloAction, global?.city?.silo, false, 'city', 'silo');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindBankTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('bankTooltipBound')){
                return;
            }
            target.data('bankTooltipBound', true);
            const popId = bankAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildBankTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (bankAction){
                        actionDesc(obj.popper, bankAction, global?.city?.bank, false, 'city', 'bank');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindMineTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('mineTooltipBound')){
                return;
            }
            target.data('mineTooltipBound', true);
            const popId = mineAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildMineTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (mineAction){
                        actionDesc(obj.popper, mineAction, global?.city?.mine, false, 'city', 'mine');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindCoalMineTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('coalMineTooltipBound')){
                return;
            }
            target.data('coalMineTooltipBound', true);
            const popId = coalMineAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildCoalMineTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (coalMineAction){
                        actionDesc(obj.popper, coalMineAction, global?.city?.coal_mine, false, 'city', 'coal_mine');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindCementTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('cementTooltipBound')){
                return;
            }
            target.data('cementTooltipBound', true);
            const popId = cementAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildCementTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (cementAction){
                        actionDesc(obj.popper, cementAction, global?.city?.cement_plant, false, 'city', 'cement_plant');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindSmelterTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('smelterTooltipBound')){
                return;
            }
            target.data('smelterTooltipBound', true);
            const popId = smelterAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildSmelterTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (smelterAction){
                        actionDesc(obj.popper, smelterAction, global?.city?.smelter, false, 'city', 'smelter');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindFoundryTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('foundryTooltipBound')){
                return;
            }
            target.data('foundryTooltipBound', true);
            const popId = foundryAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildFoundryTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (foundryAction){
                        actionDesc(obj.popper, foundryAction, global?.city?.foundry, false, 'city', 'foundry');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindLibraryTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('libraryTooltipBound')){
                return;
            }
            target.data('libraryTooltipBound', true);
            const popId = libraryAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildLibraryTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (libraryAction){
                        actionDesc(obj.popper, libraryAction, global?.city?.library, false, 'city', 'library');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const bindAmphitheatreTooltip = (target, tooltipId) => {
            if (!target || !target.length || target.data('amphitheatreTooltipBound')){
                return;
            }
            target.data('amphitheatreTooltipBound', true);
            const popId = amphitheatreAction?.id || tooltipId;
            popover(popId, function(){ return undefined; },{
                elm: target,
                self: true,
                in: function(obj){
                    const tooltip = buildAmphitheatreTooltip();
                    $(obj.this).attr('aria-label', tooltip);
                    $(obj.this).attr('title', tooltip);
                    if (amphitheatreAction){
                        actionDesc(obj.popper, amphitheatreAction, global?.city?.amphitheatre, false, 'city', 'amphitheatre');
                    }
                    else {
                        obj.popper.append(`<div>${tooltip}</div>`);
                    }
                },
                out: function(){
                    vBind({el: '#popTimer'},'destroy');
                }
            });
        };
        const applyAbsolutePosition = (stack, storageKey, defaultPosition) => {
            if (!stack || !stack.length){
                return null;
            }
            const key = storageKey || 'evolve.absolutePos';
            let position = null;
            if (save && save.getItem){
                const raw = save.getItem(key);
                if (raw){
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)){
                            position = { left: parsed.left, top: parsed.top };
                        }
                    }
                    catch {
                        // Ignore malformed stored positions.
                    }
                }
            }
            if (!position && defaultPosition){
                const next = typeof defaultPosition === 'function' ? defaultPosition() : defaultPosition;
                if (next && Number.isFinite(next.left) && Number.isFinite(next.top)){
                    position = { left: next.left, top: next.top };
                }
            }
            if (position){
                stack.css({ left: `${position.left}px`, top: `${position.top}px`, transform: 'none' });
            }
            return position;
        };
        const lockAbsolutePosition = (stack) => {
            if (!stack || !stack.length || stack.data('absPosLocked')){
                return;
            }
            stack.data('absPosLocked', true);
            const enforce = () => {
                if (!stack.length){
                    return;
                }
                const rect = stack[0].getBoundingClientRect();
                const left = Math.round(rect.left);
                const top = Math.round(rect.top);
                stack.data('lockedLeft', left);
                stack.data('lockedTop', top);
                stack.css({ left: `${left}px`, top: `${top}px`, transform: 'none' });
            };
            enforce();
            stack.on('pointerdown.lockpos mousedown.lockpos touchstart.lockpos', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === 'function'){
                    event.stopImmediatePropagation();
                }
            });
            stack.on('pointermove.lockpos mousemove.lockpos touchmove.lockpos', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === 'function'){
                    event.stopImmediatePropagation();
                }
            });
            if (typeof MutationObserver !== 'undefined'){
                const observer = new MutationObserver(() => {
                    const left = stack.data('lockedLeft');
                    const top = stack.data('lockedTop');
                    if (left !== undefined && top !== undefined){
                        stack.css({ left: `${left}px`, top: `${top}px`, transform: 'none' });
                    }
                });
                observer.observe(stack[0], { attributes: true, attributeFilter: ['style'] });
            }
        };
        const lockPointerDrag = (stack) => {
            if (!stack || !stack.length || stack.data('dragCaptureBound')){
                return;
            }
            stack.data('dragCaptureBound', true);
            let lockActive = false;
            const isTarget = (event) => stack[0] && (event.target === stack[0] || stack[0].contains(event.target));
            const start = (event) => {
                if (!isTarget(event)){
                    return;
                }
                lockActive = true;
                if (typeof event.stopImmediatePropagation === 'function'){
                    event.stopImmediatePropagation();
                }
                event.stopPropagation();
            };
            const move = (event) => {
                if (!lockActive){
                    return;
                }
                if (typeof event.stopImmediatePropagation === 'function'){
                    event.stopImmediatePropagation();
                }
                event.stopPropagation();
                if (event.cancelable){
                    event.preventDefault();
                }
            };
            const end = () => {
                lockActive = false;
            };
            document.addEventListener('pointerdown', start, true);
            document.addEventListener('pointermove', move, true);
            document.addEventListener('pointerup', end, true);
            document.addEventListener('pointercancel', end, true);
            document.addEventListener('mousedown', start, true);
            document.addEventListener('mousemove', move, true);
            document.addEventListener('mouseup', end, true);
            document.addEventListener('touchstart', start, { capture: true, passive: false });
            document.addEventListener('touchmove', move, { capture: true, passive: false });
            document.addEventListener('touchend', end, true);
            document.addEventListener('touchcancel', end, true);
        };

        cityOverlay.find('.city-bg-prop-wood-collect, .city-bg-prop-wood-collect-hit').remove();
        districtGrid.find('.city-bg-prop-wood-collect, .city-bg-prop-wood-collect-hit').remove();

        let woodCollectHit = $('<div class="city-bg-prop-wood-collect-hit"></div>');
        districtGrid.append(woodCollectHit);
        scheduleCoverRect(
            woodCollectHit,
            { x: 388, y: 640, width: 149, height: 80 },
            { width: 1583, height: 706 }
        );
        if (!woodCollectHit.data('collectBound')){
            woodCollectHit.data('collectBound', true);
            woodCollectHit.attr('role', 'button');
            const lumberTooltip = buildLumberTooltip();
            woodCollectHit.attr('aria-label', lumberTooltip);
            woodCollectHit.attr('title', lumberTooltip);
            woodCollectHit.on('click', (event) => {
                if (woodCollectHit.data('justDragged')){
                    woodCollectHit.data('justDragged', false);
                    return;
                }
                if (collectLumberOnce(event)){
                    woodCollectHit.addClass('is-clicked');
                    setTimeout(() => {
                        woodCollectHit.removeClass('is-clicked');
                    }, 220);
                    const press = $('<div class=\"wood-collect-press\" aria-hidden=\"true\"></div>');
                    districtGrid.append(press);
                    scheduleCoverRect(
                        press,
                        { x: 388, y: 640, width: 149, height: 80 },
                        { width: 1583, height: 706 }
                    );
                    setTimeout(() => press.remove(), 240);
                }
            });
            woodCollectHit.on('pointerdown mousedown touchstart', (event) => {
                if (event.cancelable){
                    event.preventDefault();
                }
            });
        }
        bindLumberTooltip(woodCollectHit, 'wood-collect-tooltip');

        const canCollectAmber = stoneAction && global.race?.sappy && checkCityRequirements('stone') && checkTechQualifications(stoneAction, 'stone');
        let amberCollect = districtGrid.find('.city-bg-prop-amber-collect');
        if (!canCollectAmber){
            if (amberCollect.length){
                amberCollect.remove();
            }
        }
        else {
            if (!amberCollect.length){
                amberCollect = $('<div class="city-bg-prop-amber-collect" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(amberCollect);
            }
            scheduleCoverRect(
                amberCollect,
                { x: 390, y: 535, width: 92, height: 59 },
                { width: 1583, height: 706 }
            );
            if (!amberCollect.data('collectBound')){
                amberCollect.data('collectBound', true);
                const amberTooltip = buildAmberTooltip();
                amberCollect.attr('aria-label', amberTooltip);
                amberCollect.attr('title', amberTooltip);
                amberCollect.on('click', (event) => {
                    if (amberCollect.data('justDragged')){
                        amberCollect.data('justDragged', false);
                        return;
                    }
                    if (collectAmber(event)){
                        amberCollect.addClass('is-clicked');
                        setTimeout(() => {
                            amberCollect.removeClass('is-clicked');
                        }, 300);
                    }
                });
                amberCollect.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindAmberTooltip(amberCollect, 'amber-collect-tooltip');
        }

        const canBuildGrove = groveAction && isPlantRace && checkCityRequirements('basic_housing') && checkTechQualifications(groveAction, 'basic_housing');
        let groveBuild = districtGrid.find('.city-bg-prop-grove-build');
        if (!canBuildGrove){
            if (groveBuild.length){
                groveBuild.remove();
            }
        }
        else {
            if (!groveBuild.length){
                groveBuild = $('<div class="city-bg-prop-grove-build" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(groveBuild);
            }
            scheduleCoverRect(
                groveBuild,
                { x: 1140, y: 210, width: 55, height: 52 },
                { width: 1583, height: 706 }
            );
            const groveLabel = typeof groveAction?.title === 'string' ? groveAction.title : groveAction?.title?.();
            if (groveLabel){
                groveBuild.attr('data-label', groveLabel);
            }
            let groveCount = groveBuild.find('.city-bg-prop-count');
            if (!groveCount.length){
                groveCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                groveBuild.append(groveCount);
            }
            const updateGroveCount = () => {
                const groveCountVal = global.city?.basic_housing?.count ?? 0;
                if (groveCountVal > 0){
                    groveBuild.addClass('has-count');
                    groveCount.text(groveCountVal);
                }
                else {
                    groveBuild.removeClass('has-count');
                    groveCount.text('');
                }
            };
            updateGroveCount();
            if (!groveBuild.data('buildBound')){
                groveBuild.data('buildBound', true);
                const groveTooltip = buildGroveTooltip();
                groveBuild.attr('aria-label', groveTooltip);
                groveBuild.attr('title', groveTooltip);
                groveBuild.on('click', (event) => {
                    if (groveBuild.data('justDragged')){
                        groveBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(groveAction, 'city', 'basic_housing');
                    updateGroveCount();
                    groveBuild.addClass('is-clicked');
                    setTimeout(() => {
                        groveBuild.removeClass('is-clicked');
                    }, 300);
                });
                groveBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindGroveTooltip(groveBuild, 'grove-build-tooltip');
        }


        const canBuildFarm = farmAction && checkCityRequirements('farm') && checkTechQualifications(farmAction, 'farm');
        let farmBuild = districtGrid.find('.city-bg-prop-farm-build');
        if (!canBuildFarm){
            if (farmBuild.length){
                farmBuild.remove();
            }
        }
        else {
            if (!farmBuild.length){
                farmBuild = $('<div class="city-bg-prop-farm-build" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(farmBuild);
            }
            scheduleCoverRect(
                farmBuild,
                { x: 1260, y: 380, width: 119, height: 61 },
                { width: 1583, height: 706 }
            );
            let farmCount = farmBuild.find('.city-bg-prop-count');
            if (!farmCount.length){
                farmCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                farmBuild.append(farmCount);
            }
            const farmLabel = typeof farmAction?.title === 'string' ? farmAction.title : farmAction?.title?.();
            if (farmLabel){
                farmBuild.attr('data-label', farmLabel);
            }
            const updateFarmCount = () => {
                const farmCountVal = global.city?.farm?.count ?? 0;
                if (farmCountVal > 0){
                    farmBuild.addClass('has-count');
                    farmCount.text(farmCountVal);
                }
                else {
                    farmBuild.removeClass('has-count');
                    farmCount.text('');
                }
            };
            updateFarmCount();
            if (!farmBuild.data('buildBound')){
                farmBuild.data('buildBound', true);
                const farmTooltip = buildFarmTooltip();
                farmBuild.attr('aria-label', farmTooltip);
                farmBuild.attr('title', farmTooltip);
                farmBuild.on('click', (event) => {
                    if (farmBuild.data('justDragged')){
                        farmBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(farmAction, 'city', 'farm');
                    updateFarmCount();
                    farmBuild.addClass('is-clicked');
                    setTimeout(() => {
                        farmBuild.removeClass('is-clicked');
                    }, 300);
                });
                farmBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindFarmTooltip(farmBuild, 'farm-build-tooltip');
        }

        const canBuildLumberYard = lumberYardAction && checkCityRequirements('lumber_yard') && checkTechQualifications(lumberYardAction, 'lumber_yard');
        let lumberYardBuild = districtGrid.find('.city-bg-prop-lumberyard');
        if (!canBuildLumberYard){
            if (lumberYardBuild.length){
                lumberYardBuild.remove();
            }
        }
        else {
            if (!lumberYardBuild.length){
                lumberYardBuild = $('<div class="city-bg-prop-lumberyard" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(lumberYardBuild);
            }
            scheduleCoverRect(
                lumberYardBuild,
                { x: 0, y: 340, width: 397, height: 351 },
                { width: 1583, height: 706 }
            );
            const lumberYardLabel = typeof lumberYardAction?.title === 'string' ? lumberYardAction.title : lumberYardAction?.title?.();
            if (lumberYardLabel){
                lumberYardBuild.attr('data-label', lumberYardLabel);
            }
            let lumberYardCount = lumberYardBuild.find('.city-bg-prop-count');
            if (!lumberYardCount.length){
                lumberYardCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                lumberYardBuild.append(lumberYardCount);
            }
            const updateLumberYardCount = () => {
                const lumberYardCountVal = global.city?.lumber_yard?.count ?? 0;
                if (lumberYardCountVal > 0){
                    lumberYardBuild.addClass('has-count');
                    lumberYardCount.text(lumberYardCountVal);
                }
                else {
                    lumberYardBuild.removeClass('has-count');
                    lumberYardCount.text('');
                }
            };
            updateLumberYardCount();
            if (!lumberYardBuild.data('buildBound')){
                lumberYardBuild.data('buildBound', true);
                const lumberYardTooltip = buildLumberYardTooltip();
                lumberYardBuild.attr('aria-label', lumberYardTooltip);
                lumberYardBuild.attr('title', lumberYardTooltip);
                lumberYardBuild.on('click', (event) => {
                    if (lumberYardBuild.data('justDragged')){
                        lumberYardBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(lumberYardAction, 'city', 'lumber_yard');
                    updateLumberYardCount();
                    lumberYardBuild.addClass('is-clicked');
                    setTimeout(() => {
                        lumberYardBuild.removeClass('is-clicked');
                    }, 300);
                });
                lumberYardBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindLumberYardTooltip(lumberYardBuild, 'lumberyard-build-tooltip');
        }

        const canBuildSawmill = sawmillAction && checkCityRequirements('sawmill') && checkTechQualifications(sawmillAction, 'sawmill');
        let sawmillBuild = districtGrid.find('.city-bg-prop-sawmill');
        if (!canBuildSawmill){
            if (sawmillBuild.length){
                sawmillBuild.remove();
            }
        }
        else {
            if (!sawmillBuild.length){
                sawmillBuild = $('<div class="city-bg-prop-sawmill" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(sawmillBuild);
            }
            scheduleCoverRect(
                sawmillBuild,
                { x: 340, y: 320, width: 301, height: 180 },
                { width: 1583, height: 706 }
            );
            const sawmillLabel = typeof sawmillAction?.title === 'string' ? sawmillAction.title : sawmillAction?.title?.();
            if (sawmillLabel){
                sawmillBuild.attr('data-label', sawmillLabel);
            }
            let sawmillCount = sawmillBuild.find('.city-bg-prop-count');
            if (!sawmillCount.length){
                sawmillCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                sawmillBuild.append(sawmillCount);
            }
            const updateSawmillCount = () => {
                const sawmillCountVal = global.city?.sawmill?.count ?? 0;
                if (sawmillCountVal > 0){
                    sawmillBuild.addClass('has-count');
                    sawmillCount.text(sawmillCountVal);
                }
                else {
                    sawmillBuild.removeClass('has-count');
                    sawmillCount.text('');
                }
            };
            updateSawmillCount();
            if (!sawmillBuild.data('buildBound')){
                sawmillBuild.data('buildBound', true);
                const sawmillTooltip = buildSawmillTooltip();
                sawmillBuild.attr('aria-label', sawmillTooltip);
                sawmillBuild.attr('title', sawmillTooltip);
                sawmillBuild.on('click', (event) => {
                    if (sawmillBuild.data('justDragged')){
                        sawmillBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(sawmillAction, 'city', 'sawmill');
                    updateSawmillCount();
                    sawmillBuild.addClass('is-clicked');
                    setTimeout(() => {
                        sawmillBuild.removeClass('is-clicked');
                    }, 300);
                });
                sawmillBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindSawmillTooltip(sawmillBuild, 'sawmill-build-tooltip');
        }

        const canShowStorageYard = storageYardAction && checkTechQualifications(storageYardAction, 'storage_yard');
        const canBuildStorageYard = canShowStorageYard && checkCityRequirements('storage_yard');
        let storageYardBuild = districtGrid.find('.city-bg-prop-storage-yard');
        if (!canShowStorageYard){
            if (storageYardBuild.length){
                storageYardBuild.remove();
            }
        }
        else {
            if (!storageYardBuild.length){
                storageYardBuild = $('<div class="city-bg-prop-storage-yard" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(storageYardBuild);
            }
            scheduleCoverRect(
                storageYardBuild,
                { x: 1156, y: 522, width: 176, height: 176 },
                { width: 1583, height: 706 }
            );
            const storageYardLabel = typeof storageYardAction?.title === 'string' ? storageYardAction.title : storageYardAction?.title?.();
            if (storageYardLabel){
                storageYardBuild.attr('data-label', storageYardLabel);
            }
            let storageYardCount = storageYardBuild.find('.city-bg-prop-count');
            if (!storageYardCount.length){
                storageYardCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                storageYardBuild.append(storageYardCount);
            }
            const updateStorageYardCount = () => {
                const storageYardCountVal = global.city?.storage_yard?.count ?? 0;
                if (storageYardCountVal > 0){
                    storageYardBuild.addClass('has-count');
                    storageYardCount.text(storageYardCountVal);
                }
                else {
                    storageYardBuild.removeClass('has-count');
                    storageYardCount.text('');
                }
            };
            updateStorageYardCount();
            if (!storageYardBuild.data('buildBound')){
                storageYardBuild.data('buildBound', true);
                const storageYardTooltip = buildStorageYardTooltip();
                storageYardBuild.attr('aria-label', storageYardTooltip);
                storageYardBuild.attr('title', storageYardTooltip);
                storageYardBuild.on('click', (event) => {
                    if (storageYardBuild.data('justDragged')){
                        storageYardBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(storageYardAction, 'city', 'storage_yard');
                    updateStorageYardCount();
                    storageYardBuild.addClass('is-clicked');
                    setTimeout(() => {
                        storageYardBuild.removeClass('is-clicked');
                    }, 300);
                });
                storageYardBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindStorageYardTooltip(storageYardBuild, 'storage-yard-build-tooltip');
        }

        const canBuildCottage = cottageAction && checkCityRequirements('cottage') && checkTechQualifications(cottageAction, 'cottage');
        let cottageBuild = districtGrid.find('.city-bg-prop-cottage');
        if (!canBuildCottage){
            if (cottageBuild.length){
                cottageBuild.remove();
            }
        }
        else {
            if (!cottageBuild.length){
                cottageBuild = $('<div class="city-bg-prop-cottage" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(cottageBuild);
            }
            scheduleCoverRect(
                cottageBuild,
                { x: 560, y: 310, width: 172, height: 128 },
                { width: 1583, height: 706 }
            );
            const cottageLabel = typeof cottageAction?.title === 'string' ? cottageAction.title : cottageAction?.title?.();
            if (cottageLabel){
                cottageBuild.attr('data-label', cottageLabel);
            }
            let cottageCount = cottageBuild.find('.city-bg-prop-count');
            if (!cottageCount.length){
                cottageCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                cottageBuild.append(cottageCount);
            }
            const updateCottageCount = () => {
                const cottageCountVal = global.city?.cottage?.count ?? 0;
                if (cottageCountVal > 0){
                    cottageBuild.addClass('has-count');
                    cottageCount.text(cottageCountVal);
                }
                else {
                    cottageBuild.removeClass('has-count');
                    cottageCount.text('');
                }
            };
            updateCottageCount();
            if (!cottageBuild.data('buildBound')){
                cottageBuild.data('buildBound', true);
                const cottageTooltip = buildCottageTooltip();
                cottageBuild.attr('aria-label', cottageTooltip);
                cottageBuild.attr('title', cottageTooltip);
                cottageBuild.on('click', (event) => {
                    if (cottageBuild.data('justDragged')){
                        cottageBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(cottageAction, 'city', 'cottage');
                    updateCottageCount();
                    cottageBuild.addClass('is-clicked');
                    setTimeout(() => {
                        cottageBuild.removeClass('is-clicked');
                    }, 300);
                });
                cottageBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindCottageTooltip(cottageBuild, 'cottage-build-tooltip');
        }

        const canBuildShed = shedAction && checkCityRequirements('shed') && checkTechQualifications(shedAction, 'shed');
        let shedBuild = districtGrid.find('.city-bg-prop-shed');
        if (!canBuildShed){
            if (shedBuild.length){
                shedBuild.remove();
            }
        }
        else {
            if (!shedBuild.length){
                shedBuild = $('<div class="city-bg-prop-shed" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(shedBuild);
            }
            scheduleCoverRect(
                shedBuild,
                { x: 708, y: 310, width: 62, height: 47 },
                { width: 1583, height: 706 }
            );
            const shedLabel = typeof shedAction?.title === 'string' ? shedAction.title : shedAction?.title?.();
            if (shedLabel){
                shedBuild.attr('data-label', shedLabel);
            }
            let shedCount = shedBuild.find('.city-bg-prop-count');
            if (!shedCount.length){
                shedCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                shedBuild.append(shedCount);
            }
            const updateShedCount = () => {
                const shedCountVal = global.city?.shed?.count ?? 0;
                if (shedCountVal > 0){
                    shedBuild.addClass('has-count');
                    shedCount.text(shedCountVal);
                }
                else {
                    shedBuild.removeClass('has-count');
                    shedCount.text('');
                }
            };
            updateShedCount();
            if (!shedBuild.data('buildBound')){
                shedBuild.data('buildBound', true);
                const shedTooltip = buildShedTooltip();
                shedBuild.attr('aria-label', shedTooltip);
                shedBuild.attr('title', shedTooltip);
                shedBuild.on('click', (event) => {
                    if (shedBuild.data('justDragged')){
                        shedBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(shedAction, 'city', 'shed');
                    updateShedCount();
                    shedBuild.addClass('is-clicked');
                    setTimeout(() => {
                        shedBuild.removeClass('is-clicked');
                    }, 300);
                });
                shedBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindShedTooltip(shedBuild, 'shed-build-tooltip');
        }

        const canBuildUniversity = universityAction && checkCityRequirements('university') && checkTechQualifications(universityAction, 'university');
        let universityBuild = districtGrid.find('.city-bg-prop-university');
        if (!canBuildUniversity){
            if (universityBuild.length){
                universityBuild.remove();
            }
        }
        else {
            if (!universityBuild.length){
                universityBuild = $('<div class="city-bg-prop-university" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(universityBuild);
            }
            scheduleCoverRect(
                universityBuild,
                { x: 746, y: 85, width: 124, height: 202 },
                { width: 1583, height: 706 }
            );
            const universityLabel = typeof universityAction?.title === 'string' ? universityAction.title : universityAction?.title?.();
            if (universityLabel){
                universityBuild.attr('data-label', universityLabel);
            }
            let universityCount = universityBuild.find('.city-bg-prop-count');
            if (!universityCount.length){
                universityCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                universityBuild.append(universityCount);
            }
            const updateUniversityCount = () => {
                const universityCountVal = global.city?.university?.count ?? 0;
                if (universityCountVal > 0){
                    universityBuild.addClass('has-count');
                    universityCount.text(universityCountVal);
                }
                else {
                    universityBuild.removeClass('has-count');
                    universityCount.text('');
                }
            };
            updateUniversityCount();
            if (!universityBuild.data('buildBound')){
                universityBuild.data('buildBound', true);
                const universityTooltip = buildUniversityTooltip();
                universityBuild.attr('aria-label', universityTooltip);
                universityBuild.attr('title', universityTooltip);
                universityBuild.on('click', (event) => {
                    if (universityBuild.data('justDragged')){
                        universityBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(universityAction, 'city', 'university');
                    updateUniversityCount();
                    universityBuild.addClass('is-clicked');
                    setTimeout(() => {
                        universityBuild.removeClass('is-clicked');
                    }, 300);
                });
                universityBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindUniversityTooltip(universityBuild, 'university-build-tooltip');
        }

        const canBuildGarrison = garrisonAction && checkCityRequirements('garrison') && checkTechQualifications(garrisonAction, 'garrison');
        let garrisonBuild = districtGrid.find('.city-bg-prop-garrison');
        if (!canBuildGarrison){
            if (garrisonBuild.length){
                garrisonBuild.remove();
            }
        }
        else {
            if (!garrisonBuild.length){
                garrisonBuild = $('<div class="city-bg-prop-garrison" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(garrisonBuild);
            }
            scheduleCoverRect(
                garrisonBuild,
                { x: 695, y: 405, width: 170, height: 102 },
                { width: 1583, height: 706 }
            );
            const garrisonLabel = typeof garrisonAction?.title === 'string' ? garrisonAction.title : garrisonAction?.title?.();
            if (garrisonLabel){
                garrisonBuild.attr('data-label', garrisonLabel);
            }
            let garrisonCount = garrisonBuild.find('.city-bg-prop-count');
            if (!garrisonCount.length){
                garrisonCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                garrisonBuild.append(garrisonCount);
            }
            const updateGarrisonCount = () => {
                const garrisonCountVal = global.city?.garrison?.count ?? 0;
                if (garrisonCountVal > 0){
                    garrisonBuild.addClass('has-count');
                    garrisonCount.text(garrisonCountVal);
                }
                else {
                    garrisonBuild.removeClass('has-count');
                    garrisonCount.text('');
                }
            };
            updateGarrisonCount();
            if (!garrisonBuild.data('buildBound')){
                garrisonBuild.data('buildBound', true);
                const garrisonTooltip = buildGarrisonTooltip();
                garrisonBuild.attr('aria-label', garrisonTooltip);
                garrisonBuild.attr('title', garrisonTooltip);
                garrisonBuild.on('click', (event) => {
                    if (garrisonBuild.data('justDragged')){
                        garrisonBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(garrisonAction, 'city', 'garrison');
                    updateGarrisonCount();
                    garrisonBuild.addClass('is-clicked');
                    setTimeout(() => {
                        garrisonBuild.removeClass('is-clicked');
                    }, 300);
                });
                garrisonBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindGarrisonTooltip(garrisonBuild, 'garrison-build-tooltip');
        }

        const canBuildSilo = siloAction && checkCityRequirements('silo') && checkTechQualifications(siloAction, 'silo');
        let siloBuild = districtGrid.find('.city-bg-prop-silo');
        if (!canBuildSilo){
            if (siloBuild.length){
                siloBuild.remove();
            }
        }
        else {
            if (!siloBuild.length){
                siloBuild = $('<div class="city-bg-prop-silo" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(siloBuild);
            }
            scheduleCoverRect(
                siloBuild,
                { x: 1366, y: 250, width: 88, height: 102 },
                { width: 1583, height: 706 }
            );
            const siloLabel = typeof siloAction?.title === 'string' ? siloAction.title : siloAction?.title?.();
            if (siloLabel){
                siloBuild.attr('data-label', siloLabel);
            }
            let siloCount = siloBuild.find('.city-bg-prop-count');
            if (!siloCount.length){
                siloCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                siloBuild.append(siloCount);
            }
            const updateSiloCount = () => {
                const siloCountVal = global.city?.silo?.count ?? 0;
                if (siloCountVal > 0){
                    siloBuild.addClass('has-count');
                    siloCount.text(siloCountVal);
                }
                else {
                    siloBuild.removeClass('has-count');
                    siloCount.text('');
                }
            };
            updateSiloCount();
            if (!siloBuild.data('buildBound')){
                siloBuild.data('buildBound', true);
                const siloTooltip = buildSiloTooltip();
                siloBuild.attr('aria-label', siloTooltip);
                siloBuild.attr('title', siloTooltip);
                siloBuild.on('click', (event) => {
                    if (siloBuild.data('justDragged')){
                        siloBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(siloAction, 'city', 'silo');
                    updateSiloCount();
                    siloBuild.addClass('is-clicked');
                    setTimeout(() => {
                        siloBuild.removeClass('is-clicked');
                    }, 300);
                });
                siloBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindSiloTooltip(siloBuild, 'silo-build-tooltip');
        }

        const canShowBank = bankAction && checkTechQualifications(bankAction, 'bank');
        const canBuildBank = canShowBank && checkCityRequirements('bank');
        let bankBuild = districtGrid.find('.city-bg-prop-bank');
        if (!canShowBank){
            if (bankBuild.length){
                bankBuild.remove();
            }
        }
        else {
            if (!bankBuild.length){
                bankBuild = $('<div class="city-bg-prop-bank" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(bankBuild);
            }
            scheduleCoverRect(
                bankBuild,
                { x: 945, y: 188, width: 152, height: 208 },
                { width: 1583, height: 706 }
            );
            const bankLabel = typeof bankAction?.title === 'string' ? bankAction.title : bankAction?.title?.();
            if (bankLabel){
                bankBuild.attr('data-label', bankLabel);
            }
            let bankCount = bankBuild.find('.city-bg-prop-count');
            if (!bankCount.length){
                bankCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                bankBuild.append(bankCount);
            }
            const updateBankCount = () => {
                const bankCountVal = global.city?.bank?.count ?? 0;
                if (bankCountVal > 0){
                    bankBuild.addClass('has-count');
                    bankCount.text(bankCountVal);
                }
                else {
                    bankBuild.removeClass('has-count');
                    bankCount.text('');
                }
            };
            updateBankCount();
            if (!bankBuild.data('buildBound')){
                bankBuild.data('buildBound', true);
                const bankTooltip = buildBankTooltip();
                bankBuild.attr('aria-label', bankTooltip);
                bankBuild.attr('title', bankTooltip);
                bankBuild.on('click', (event) => {
                    if (bankBuild.data('justDragged')){
                        bankBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    const canBuildNow = bankAction && checkCityRequirements('bank') && checkTechQualifications(bankAction, 'bank');
                    if (!canBuildNow){
                        bankBuild.addClass('is-clicked');
                        setTimeout(() => {
                            bankBuild.removeClass('is-clicked');
                        }, 300);
                        return;
                    }
                    runAction(bankAction, 'city', 'bank');
                    updateBankCount();
                    bankBuild.addClass('is-clicked');
                    setTimeout(() => {
                        bankBuild.removeClass('is-clicked');
                    }, 300);
                });
                bankBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindBankTooltip(bankBuild, 'bank-build-tooltip');
        }

        const hasMetalWorking = Boolean(global.tech_completed?.metal_working || checkOldTech('metal_working'));
        const canShowMine = mineAction && hasMetalWorking && checkTechQualifications(mineAction, 'mine');
        const canBuildMine = canShowMine && checkCityRequirements('mine');
        let mineBuild = districtGrid.find('.city-bg-prop-mine');
        if (!canShowMine){
            if (mineBuild.length){
                mineBuild.remove();
            }
        }
        else {
            if (!mineBuild.length){
                mineBuild = $('<div class="city-bg-prop-mine" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(mineBuild);
            }
            scheduleCoverRect(
                mineBuild,
                { x: 1460, y: 100, width: 132, height: 102 },
                { width: 1583, height: 706 }
            );
            const mineLabel = typeof mineAction?.title === 'string' ? mineAction.title : mineAction?.title?.();
            if (mineLabel){
                mineBuild.attr('data-label', mineLabel);
            }
            let mineCount = mineBuild.find('.city-bg-prop-count');
            if (!mineCount.length){
                mineCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                mineBuild.append(mineCount);
            }
            const updateMineCount = () => {
                const mineCountVal = global.city?.mine?.count ?? 0;
                if (mineCountVal > 0){
                    mineBuild.addClass('has-count');
                    mineCount.text(mineCountVal);
                }
                else {
                    mineBuild.removeClass('has-count');
                    mineCount.text('');
                }
            };
            updateMineCount();
            if (!mineBuild.data('buildBound')){
                mineBuild.data('buildBound', true);
                const mineTooltip = buildMineTooltip();
                mineBuild.attr('aria-label', mineTooltip);
                mineBuild.attr('title', mineTooltip);
                mineBuild.on('click', (event) => {
                    if (mineBuild.data('justDragged')){
                        mineBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    const canBuildNow = mineAction && checkCityRequirements('mine') && checkTechQualifications(mineAction, 'mine');
                    if (!canBuildNow){
                        mineBuild.addClass('is-clicked');
                        setTimeout(() => {
                            mineBuild.removeClass('is-clicked');
                        }, 300);
                        return;
                    }
                    runAction(mineAction, 'city', 'mine');
                    updateMineCount();
                    mineBuild.addClass('is-clicked');
                    setTimeout(() => {
                        mineBuild.removeClass('is-clicked');
                    }, 300);
                });
                mineBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindMineTooltip(mineBuild, 'mine-build-tooltip');
        }

        const hasCoalMining = Boolean(global.tech_completed?.coal_mining || checkOldTech('coal_mining'));
        const canShowCoalMine = coalMineAction && hasCoalMining && checkTechQualifications(coalMineAction, 'coal_mine');
        const canBuildCoalMine = canShowCoalMine && checkCityRequirements('coal_mine');
        let coalMineBuild = districtGrid.find('.city-bg-prop-coal-mine');
        if (!canShowCoalMine){
            if (coalMineBuild.length){
                coalMineBuild.remove();
            }
        }
        else {
            if (!coalMineBuild.length){
                coalMineBuild = $('<div class="city-bg-prop-coal-mine" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(coalMineBuild);
            }
            scheduleCoverRect(
                coalMineBuild,
                { x: 1335, y: 130, width: 120, height: 64 },
                { width: 1583, height: 706 }
            );
            const coalMineLabel = typeof coalMineAction?.title === 'string' ? coalMineAction.title : coalMineAction?.title?.();
            if (coalMineLabel){
                coalMineBuild.attr('data-label', coalMineLabel);
            }
            let coalMineCount = coalMineBuild.find('.city-bg-prop-count');
            if (!coalMineCount.length){
                coalMineCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                coalMineBuild.append(coalMineCount);
            }
            const updateCoalMineCount = () => {
                const coalMineCountVal = global.city?.coal_mine?.count ?? 0;
                if (coalMineCountVal > 0){
                    coalMineBuild.addClass('has-count');
                    coalMineCount.text(coalMineCountVal);
                }
                else {
                    coalMineBuild.removeClass('has-count');
                    coalMineCount.text('');
                }
            };
            updateCoalMineCount();
            if (!coalMineBuild.data('buildBound')){
                coalMineBuild.data('buildBound', true);
                const coalMineTooltip = buildCoalMineTooltip();
                coalMineBuild.attr('aria-label', coalMineTooltip);
                coalMineBuild.attr('title', coalMineTooltip);
                coalMineBuild.on('click', (event) => {
                    if (coalMineBuild.data('justDragged')){
                        coalMineBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    runAction(coalMineAction, 'city', 'coal_mine');
                    updateCoalMineCount();
                    coalMineBuild.addClass('is-clicked');
                    setTimeout(() => {
                        coalMineBuild.removeClass('is-clicked');
                    }, 300);
                });
                coalMineBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindCoalMineTooltip(coalMineBuild, 'coal-mine-build-tooltip');
        }

        const canShowCement = cementAction && checkTechQualifications(cementAction, 'cement_plant');
        const canBuildCement = canShowCement && checkCityRequirements('cement_plant');
        let cementBuild = districtGrid.find('.city-bg-prop-cement');
        if (!canShowCement){
            if (cementBuild.length){
                cementBuild.remove();
            }
        }
        else {
            if (!cementBuild.length){
                cementBuild = $('<div class="city-bg-prop-cement" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(cementBuild);
            }
            scheduleCoverRect(
                cementBuild,
                { x: 63, y: 157, width: 142, height: 166 },
                { width: 1583, height: 706 }
            );
            const cementLabel = typeof cementAction?.title === 'string' ? cementAction.title : cementAction?.title?.();
            if (cementLabel){
                cementBuild.attr('data-label', cementLabel);
            }
            let cementCount = cementBuild.find('.city-bg-prop-count');
            if (!cementCount.length){
                cementCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                cementBuild.append(cementCount);
            }
            const updateCementCount = () => {
                const cementCountVal = global.city?.cement_plant?.count ?? 0;
                if (cementCountVal > 0){
                    cementBuild.addClass('has-count');
                    cementCount.text(cementCountVal);
                }
                else {
                    cementBuild.removeClass('has-count');
                    cementCount.text('');
                }
            };
            updateCementCount();
            if (!cementBuild.data('buildBound')){
                cementBuild.data('buildBound', true);
                const cementTooltip = buildCementTooltip();
                cementBuild.attr('aria-label', cementTooltip);
                cementBuild.attr('title', cementTooltip);
                cementBuild.on('click', (event) => {
                    if (cementBuild.data('justDragged')){
                        cementBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    const canBuildNow = cementAction && checkCityRequirements('cement_plant') && checkTechQualifications(cementAction, 'cement_plant');
                    if (!canBuildNow){
                        cementBuild.addClass('is-clicked');
                        setTimeout(() => {
                            cementBuild.removeClass('is-clicked');
                        }, 300);
                        return;
                    }
                    runAction(cementAction, 'city', 'cement_plant');
                    updateCementCount();
                    cementBuild.addClass('is-clicked');
                    setTimeout(() => {
                        cementBuild.removeClass('is-clicked');
                    }, 300);
                });
                cementBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindCementTooltip(cementBuild, 'cement-build-tooltip');
        }

        const canShowSmelter = smelterAction && checkTechQualifications(smelterAction, 'smelter');
        const canBuildSmelter = canShowSmelter && checkCityRequirements('smelter');
        let smelterBuild = districtGrid.find('.city-bg-prop-smelter');
        if (!canShowSmelter){
            if (smelterBuild.length){
                smelterBuild.remove();
            }
        }
        else {
            if (!smelterBuild.length){
                smelterBuild = $('<div class="city-bg-prop-smelter" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(smelterBuild);
            }
            let smelterGear = smelterBuild.find('.smelter-gear');
            if (!smelterGear.length){
                smelterGear = $(
                    `<span class="smelter-gear" aria-hidden="true">` +
                        `<svg version="1.1" x="0px" y="0px" viewBox="340 140 280 279.416" xml:space="preserve">` +
                            `<path class="gear" d="M620,305.666v-51.333l-31.5-5.25c-2.333-8.75-5.833-16.917-9.917-23.917L597.25,199.5l-36.167-36.75l-26.25,18.083` +
                                ` c-7.583-4.083-15.75-7.583-23.916-9.917L505.667,140h-51.334l-5.25,31.5c-8.75,2.333-16.333,5.833-23.916,9.916L399.5,163.333` +
                                ` L362.75,199.5l18.667,25.666c-4.083,7.584-7.583,15.75-9.917,24.5l-31.5,4.667v51.333l31.5,5.25` +
                                ` c2.333,8.75,5.833,16.334,9.917,23.917l-18.667,26.25l36.167,36.167l26.25-18.667c7.583,4.083,15.75,7.583,24.5,9.917l5.25,30.916` +
                                ` h51.333l5.25-31.5c8.167-2.333,16.333-5.833,23.917-9.916l26.25,18.666l36.166-36.166l-18.666-26.25` +
                                ` c4.083-7.584,7.583-15.167,9.916-23.917L620,305.666z M480,333.666c-29.75,0-53.667-23.916-53.667-53.666s24.5-53.667,53.667-53.667` +
                                ` S533.667,250.25,533.667,280S509.75,333.666,480,333.666z"/>` +
                        `</svg>` +
                    `</span>`
                );
                smelterBuild.append(smelterGear);
            }
            if (!smelterGear.data('clickBound')){
                smelterGear.data('clickBound', true);
                smelterGear.on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (global.settings){
                        global.settings.smelterFloatingOpen = true;
                    }
                    refreshTopBarAndResearchToggle();
                });
                smelterGear.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                    event.stopPropagation();
                });
            }
            scheduleCoverRect(
                smelterBuild,
                { x: 317, y: 166, width: 163, height: 150 },
                { width: 1583, height: 706 }
            );
            const smelterLabel = typeof smelterAction?.title === 'string' ? smelterAction.title : smelterAction?.title?.();
            if (smelterLabel){
                smelterBuild.attr('data-label', smelterLabel);
            }
            let smelterCount = smelterBuild.find('.city-bg-prop-count');
            if (!smelterCount.length){
                smelterCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                smelterBuild.append(smelterCount);
            }
            const updateSmelterCount = () => {
                const smelterCountVal = global.city?.smelter?.count ?? 0;
                if (smelterCountVal > 0){
                    smelterBuild.addClass('has-count');
                    smelterCount.text(smelterCountVal);
                }
                else {
                    smelterBuild.removeClass('has-count');
                    smelterCount.text('');
                }
            };
            updateSmelterCount();
            if (!smelterBuild.data('buildBound')){
                smelterBuild.data('buildBound', true);
                const smelterTooltip = buildSmelterTooltip();
                smelterBuild.attr('aria-label', smelterTooltip);
                smelterBuild.attr('title', smelterTooltip);
                smelterBuild.on('click', (event) => {
                    if (smelterBuild.data('justDragged')){
                        smelterBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    const canBuildNow = smelterAction && checkCityRequirements('smelter') && checkTechQualifications(smelterAction, 'smelter');
                    if (!canBuildNow){
                        smelterBuild.addClass('is-clicked');
                        setTimeout(() => {
                            smelterBuild.removeClass('is-clicked');
                        }, 300);
                        return;
                    }
                    runAction(smelterAction, 'city', 'smelter');
                    updateSmelterCount();
                    smelterBuild.addClass('is-clicked');
                    setTimeout(() => {
                        smelterBuild.removeClass('is-clicked');
                    }, 300);
                });
                smelterBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindSmelterTooltip(smelterBuild, 'smelter-build-tooltip');
        }

        const canShowFoundry = foundryAction && checkTechQualifications(foundryAction, 'foundry');
        const canBuildFoundry = canShowFoundry && checkCityRequirements('foundry');
        let foundryBuild = districtGrid.find('.city-bg-prop-foundry');
        if (!canShowFoundry){
            if (foundryBuild.length){
                foundryBuild.remove();
            }
        }
        else {
            if (!foundryBuild.length){
                foundryBuild = $('<div class="city-bg-prop-foundry" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(foundryBuild);
            }
            scheduleCoverRect(
                foundryBuild,
                { x: 0, y: 270, width: 78, height: 75 },
                { width: 1583, height: 706 }
            );
            const foundryLabel = typeof foundryAction?.title === 'string' ? foundryAction.title : foundryAction?.title?.();
            if (foundryLabel){
                foundryBuild.attr('data-label', foundryLabel);
            }
            let foundryCount = foundryBuild.find('.city-bg-prop-count');
            if (!foundryCount.length){
                foundryCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                foundryBuild.append(foundryCount);
            }
            const updateFoundryCount = () => {
                const foundryCountVal = global.city?.foundry?.count ?? 0;
                if (foundryCountVal > 0){
                    foundryBuild.addClass('has-count');
                    foundryCount.text(foundryCountVal);
                }
                else {
                    foundryBuild.removeClass('has-count');
                    foundryCount.text('');
                }
            };
            updateFoundryCount();
            if (!foundryBuild.data('buildBound')){
                foundryBuild.data('buildBound', true);
                const foundryTooltip = buildFoundryTooltip();
                foundryBuild.attr('aria-label', foundryTooltip);
                foundryBuild.attr('title', foundryTooltip);
                foundryBuild.on('click', (event) => {
                    if (foundryBuild.data('justDragged')){
                        foundryBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    const canBuildNow = foundryAction && checkCityRequirements('foundry') && checkTechQualifications(foundryAction, 'foundry');
                    if (!canBuildNow){
                        foundryBuild.addClass('is-clicked');
                        setTimeout(() => {
                            foundryBuild.removeClass('is-clicked');
                        }, 300);
                        return;
                    }
                    runAction(foundryAction, 'city', 'foundry');
                    updateFoundryCount();
                    foundryBuild.addClass('is-clicked');
                    setTimeout(() => {
                        foundryBuild.removeClass('is-clicked');
                    }, 300);
                });
                foundryBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindFoundryTooltip(foundryBuild, 'foundry-build-tooltip');
        }

        const canShowLibrary = libraryAction && checkTechQualifications(libraryAction, 'library');
        const canBuildLibrary = canShowLibrary && checkCityRequirements('library');
        let libraryBuild = districtGrid.find('.city-bg-prop-library');
        if (!canShowLibrary){
            if (libraryBuild.length){
                libraryBuild.remove();
            }
        }
        else {
            if (!libraryBuild.length){
                libraryBuild = $('<div class="city-bg-prop-library" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(libraryBuild);
            }
            scheduleCoverRect(
                libraryBuild,
                { x: 1052, y: 258, width: 164, height: 219 },
                { width: 1583, height: 706 }
            );
            const libraryLabel = typeof libraryAction?.title === 'string' ? libraryAction.title : libraryAction?.title?.();
            if (libraryLabel){
                libraryBuild.attr('data-label', libraryLabel);
            }
            let libraryCount = libraryBuild.find('.city-bg-prop-count');
            if (!libraryCount.length){
                libraryCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                libraryBuild.append(libraryCount);
            }
            const updateLibraryCount = () => {
                const libraryCountVal = global.city?.library?.count ?? 0;
                if (libraryCountVal > 0){
                    libraryBuild.addClass('has-count');
                    libraryCount.text(libraryCountVal);
                }
                else {
                    libraryBuild.removeClass('has-count');
                    libraryCount.text('');
                }
            };
            updateLibraryCount();
            if (!libraryBuild.data('buildBound')){
                libraryBuild.data('buildBound', true);
                const libraryTooltip = buildLibraryTooltip();
                libraryBuild.attr('aria-label', libraryTooltip);
                libraryBuild.attr('title', libraryTooltip);
                libraryBuild.on('click', (event) => {
                    if (libraryBuild.data('justDragged')){
                        libraryBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    const canBuildNow = libraryAction && checkCityRequirements('library') && checkTechQualifications(libraryAction, 'library');
                    if (!canBuildNow){
                        libraryBuild.addClass('is-clicked');
                        setTimeout(() => {
                            libraryBuild.removeClass('is-clicked');
                        }, 300);
                        return;
                    }
                    runAction(libraryAction, 'city', 'library');
                    updateLibraryCount();
                    libraryBuild.addClass('is-clicked');
                    setTimeout(() => {
                        libraryBuild.removeClass('is-clicked');
                    }, 300);
                });
                libraryBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindLibraryTooltip(libraryBuild, 'library-build-tooltip');
        }

        const canShowAmphitheatre = amphitheatreAction && checkTechQualifications(amphitheatreAction, 'amphitheatre');
        const canBuildAmphitheatre = canShowAmphitheatre && checkCityRequirements('amphitheatre');
        let amphitheatreBuild = districtGrid.find('.city-bg-prop-amphitheatre');
        if (!canShowAmphitheatre){
            if (amphitheatreBuild.length){
                amphitheatreBuild.remove();
            }
        }
        else {
            if (!amphitheatreBuild.length){
                amphitheatreBuild = $('<div class="city-bg-prop-amphitheatre" role="button"><div class="city-bg-prop-inner" aria-hidden="true"></div></div>');
                districtGrid.append(amphitheatreBuild);
            }
            scheduleCoverRect(
                amphitheatreBuild,
                { x: 722, y: 570, width: 385, height: 143 },
                { width: 1583, height: 706 }
            );
            const amphitheatreLabel = loc('city_amphitheatre');
            if (amphitheatreLabel){
                amphitheatreBuild.attr('data-label', amphitheatreLabel);
            }
            let amphitheatreCount = amphitheatreBuild.find('.city-bg-prop-count');
            if (!amphitheatreCount.length){
                amphitheatreCount = $('<div class="city-bg-prop-count" aria-hidden="true"></div>');
                amphitheatreBuild.append(amphitheatreCount);
            }
            const updateAmphitheatreCount = () => {
                const amphitheatreCountVal = global.city?.amphitheatre?.count ?? 0;
                if (amphitheatreCountVal > 0){
                    amphitheatreBuild.addClass('has-count');
                    amphitheatreCount.text(amphitheatreCountVal);
                }
                else {
                    amphitheatreBuild.removeClass('has-count');
                    amphitheatreCount.text('');
                }
            };
            updateAmphitheatreCount();
            if (!amphitheatreBuild.data('buildBound')){
                amphitheatreBuild.data('buildBound', true);
                const amphitheatreTooltip = buildAmphitheatreTooltip();
                amphitheatreBuild.attr('aria-label', amphitheatreTooltip);
                amphitheatreBuild.attr('title', amphitheatreTooltip);
                amphitheatreBuild.on('click', (event) => {
                    if (amphitheatreBuild.data('justDragged')){
                        amphitheatreBuild.data('justDragged', false);
                        return;
                    }
                    if (!isCityPropInnerHit(event)){
                        return;
                    }
                    const canBuildNow = amphitheatreAction && checkCityRequirements('amphitheatre') && checkTechQualifications(amphitheatreAction, 'amphitheatre');
                    if (!canBuildNow){
                        amphitheatreBuild.addClass('is-clicked');
                        setTimeout(() => {
                            amphitheatreBuild.removeClass('is-clicked');
                        }, 300);
                        return;
                    }
                    runAction(amphitheatreAction, 'city', 'amphitheatre');
                    updateAmphitheatreCount();
                    amphitheatreBuild.addClass('is-clicked');
                    setTimeout(() => {
                        amphitheatreBuild.removeClass('is-clicked');
                    }, 300);
                });
                amphitheatreBuild.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindAmphitheatreTooltip(amphitheatreBuild, 'amphitheatre-build-tooltip');
        }

        const canCollectFood = foodAction && checkCityRequirements('food') && checkTechQualifications(foodAction, 'food');
        let foodCollectHit = districtGrid.find('.city-bg-prop-food-collect-hit');
        if (!canCollectFood){
            if (foodCollectHit.length){
                foodCollectHit.remove();
            }
        }
        else {
            if (!foodCollectHit.length){
                foodCollectHit = $('<div class="city-bg-prop-food-collect-hit"></div>');
                districtGrid.append(foodCollectHit);
            }
            scheduleCoverRect(
                foodCollectHit,
                { x: 535, y: 540, width: 77, height: 72 },
                { width: 1583, height: 706 }
            );
            if (!foodCollectHit.data('collectBound')){
                foodCollectHit.data('collectBound', true);
                foodCollectHit.attr('role', 'button');
                const foodTooltip = buildFoodTooltip();
                foodCollectHit.attr('aria-label', foodTooltip);
                foodCollectHit.attr('title', foodTooltip);
                foodCollectHit.on('click', (event) => {
                    if (foodCollectHit.data('justDragged')){
                        foodCollectHit.data('justDragged', false);
                        return;
                    }
                    if (!global.settings.pause && foodAction){
                        let gain = 0;
                        if (global['resource']['Food'].amount < global['resource']['Food'].max && !global.race['fasting']){
                            gain = foodAction.val(true);
                            if (gain > 0){
                                modRes('Food', gain, true);
                            }
                        }
                        if (gain > 0){
                            global.stats.cfood++;
                            global.stats.tfood++;
                            showFoodFx(event, gain);
                            foodCollectHit.addClass('is-clicked');
                            setTimeout(() => {
                                foodCollectHit.removeClass('is-clicked');
                            }, 220);
                            const press = $('<div class=\"food-collect-press\" aria-hidden=\"true\"></div>');
                            districtGrid.append(press);
                            scheduleCoverRect(
                                press,
                                { x: 535, y: 540, width: 77, height: 72 },
                                { width: 1583, height: 706 }
                            );
                            setTimeout(() => press.remove(), 240);
                        }
                    }
                });
                foodCollectHit.on('pointerdown mousedown touchstart', (event) => {
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });
            }
            bindFoodTooltip(foodCollectHit, 'food-collect-tooltip');
        }

        if (!districtGrid.data('mapDebugBound')){
            districtGrid.data('mapDebugBound', true);
            const debugLayer = $('<div class="city-map-debug-layer" aria-hidden="true"></div>');
            const debugBox = $('<div class="city-map-debug-box" aria-hidden="true"></div>');
            const debugLabel = $('<div class="city-map-debug-label" aria-hidden="true"></div>');
            debugLayer.append(debugBox, debugLabel);
            const debugToggle = $('<button type="button" class="city-map-debug-toggle" aria-pressed="false">标点</button>');
            districtGrid.append(debugLayer, debugToggle);

            const readDebugSetting = () => {
                try {
                    if (window?.location?.hash?.includes('mapdebug')){
                        return true;
                    }
                    return window?.localStorage?.getItem('evolve.mapDebug') === '1';
                }
                catch {
                    return false;
                }
            };

            const setDebugActive = (active) => {
                if (active){
                    districtGrid.addClass('map-debug-enabled');
                }
                else {
                    districtGrid.removeClass('map-debug-enabled');
                    debugBox.hide();
                    debugLabel.hide();
                }
            };
            const updateDebugToggle = (active) => {
                debugToggle.toggleClass('is-active', active);
                debugToggle.attr('aria-pressed', active ? 'true' : 'false');
                debugToggle.attr('title', active ? '标点模式：开' : '标点模式：关');
            };

            let mapDebugEnabled = readDebugSetting();
            setDebugActive(mapDebugEnabled);
            updateDebugToggle(mapDebugEnabled);

            debugToggle.on('click', () => {
                mapDebugEnabled = !districtGrid.hasClass('map-debug-enabled');
                try {
                    if (mapDebugEnabled){
                        window?.localStorage?.setItem('evolve.mapDebug', '1');
                    }
                    else {
                        window?.localStorage?.removeItem('evolve.mapDebug');
                    }
                }
                catch {
                    // Ignore storage errors.
                }
                setDebugActive(mapDebugEnabled);
                updateDebugToggle(mapDebugEnabled);
            });

            const imageSize = { width: 1583, height: 706 };
            let dragging = false;
            let start = { x: 0, y: 0 };
            let startRect = null;

                const getLocalPoint = (event) => {
                    const rect = districtGrid[0]?.getBoundingClientRect?.();
                    const clientX = event?.clientX ?? event?.touches?.[0]?.clientX ?? event?.changedTouches?.[0]?.clientX ?? 0;
                    const clientY = event?.clientY ?? event?.touches?.[0]?.clientY ?? event?.changedTouches?.[0]?.clientY ?? 0;
                    return {
                        x: clientX - (rect?.left ?? 0),
                        y: clientY - (rect?.top ?? 0),
                        rect
                    };
                };

                const updateLabel = (text, x, y) => {
                    debugLabel.text(text);
                    debugLabel.css({ left: `${x + 12}px`, top: `${y + 12}px` });
                    debugLabel.show();
                };

                const clampRect = (rect) => {
                    const x = Math.max(0, Math.min(imageSize.width, rect.x));
                    const y = Math.max(0, Math.min(imageSize.height, rect.y));
                    const maxW = imageSize.width - x;
                    const maxH = imageSize.height - y;
                    return {
                        x: Math.round(x),
                        y: Math.round(y),
                        width: Math.max(1, Math.round(Math.min(rect.width, maxW))),
                        height: Math.max(1, Math.round(Math.min(rect.height, maxH)))
                    };
                };

                const copyText = (text) => {
                    try {
                        if (navigator?.clipboard?.writeText){
                            navigator.clipboard.writeText(text).catch(() => {});
                        }
                    }
                    catch {
                        // Ignore copy failures.
                    }
                };

                debugLabel.on('click', () => {
                    const text = debugLabel.data('copyText');
                    if (text){
                        copyText(text);
                    }
                });

            debugLayer.on('pointerdown mousedown touchstart', (event) => {
                if (!districtGrid.hasClass('map-debug-enabled')){
                    return;
                }
                    if (!event.shiftKey){
                        return;
                    }
                    const local = getLocalPoint(event);
                    if (!local.rect){
                        return;
                    }
                    dragging = true;
                    start = { x: local.x, y: local.y };
                    startRect = local.rect;
                    debugBox.css({ left: `${start.x}px`, top: `${start.y}px`, width: 0, height: 0 }).show();
                    debugLabel.hide();
                    if (event.cancelable){
                        event.preventDefault();
                    }
                });

            debugLayer.on('pointermove mousemove touchmove', (event) => {
                if (!districtGrid.hasClass('map-debug-enabled')){
                    return;
                }
                    if (!dragging){
                        return;
                    }
                    const local = getLocalPoint(event);
                    const x1 = Math.min(start.x, local.x);
                    const y1 = Math.min(start.y, local.y);
                    const x2 = Math.max(start.x, local.x);
                    const y2 = Math.max(start.y, local.y);
                    debugBox.css({
                        left: `${x1}px`,
                        top: `${y1}px`,
                        width: `${Math.max(1, x2 - x1)}px`,
                        height: `${Math.max(1, y2 - y1)}px`
                    });
                });

            debugLayer.on('pointerup pointercancel mouseup touchend touchcancel', (event) => {
                if (!districtGrid.hasClass('map-debug-enabled')){
                    return;
                }
                    if (!dragging){
                        return;
                    }
                    dragging = false;
                    const local = getLocalPoint(event);
                    if (!startRect){
                        return;
                    }
                    const left = Math.min(start.x, local.x);
                    const top = Math.min(start.y, local.y);
                    const width = Math.max(1, Math.abs(local.x - start.x));
                    const height = Math.max(1, Math.abs(local.y - start.y));
                    const p1 = mapCoverPointFromContainer({ x: left, y: top }, imageSize, startRect);
                    const p2 = mapCoverPointFromContainer({ x: left + width, y: top + height }, imageSize, startRect);
                    if (!p1 || !p2){
                        return;
                    }
                    const rect = clampRect({
                        x: Math.min(p1.x, p2.x),
                        y: Math.min(p1.y, p2.y),
                        width: Math.abs(p2.x - p1.x),
                        height: Math.abs(p2.y - p1.y)
                    });
                    const text = `imageRect: { x: ${rect.x}, y: ${rect.y}, width: ${rect.width}, height: ${rect.height} }`;
                    debugLabel.data('copyText', text);
                    updateLabel(`${text}\n(点击复制)`, left, top);
                    console.log(text);
                });

            debugLayer.on('click', (event) => {
                if (!districtGrid.hasClass('map-debug-enabled')){
                    return;
                }
                    if (event.shiftKey || dragging){
                        return;
                    }
                    const local = getLocalPoint(event);
                    if (!local.rect){
                        return;
                    }
                    const imgPoint = mapCoverPointFromContainer({ x: local.x, y: local.y }, imageSize, local.rect);
                    if (!imgPoint){
                        return;
                    }
                    const text = `imagePoint: { x: ${Math.round(imgPoint.x)}, y: ${Math.round(imgPoint.y)} }`;
                    debugLabel.data('copyText', text);
                    updateLabel(`${text}\n(点击复制)`, local.x, local.y);
                    console.log(text);
            });
        }
    }

    city_categories.forEach(function(category){
        clearElement($(`#city-dist-${category}`),true);
        clearElement($(`#city-dist-${category}-slot`),true);
        if (global.settings['cLabels']){
            const showEmptyMilitary = category === 'military' && global.resource?.Furs?.display;
            const showEmptyIndustrial = category === 'industrial' && industrialResources.some((res) => global.resource?.[res]?.display);
            const showEmptyTrade = category === 'trade' && tradeResources.some((res) => global.resource?.[res]?.display);
            const showEmptyScience = category === 'science' && scienceResources.some((res) => global.resource?.[res]?.display);
            const showEmptyCommercial = category === 'commercial' && commercialResources.some((res) => global.resource?.[res]?.display);
            const showEmptyResidential = category === 'residential' && residentialResources.some((res) => global.resource?.[res]?.display);
            const isAvailable = (category in city_buildings) || showEmptyMilitary || showEmptyIndustrial || showEmptyTrade || showEmptyScience || showEmptyCommercial || showEmptyResidential;

            const district = $(`<div id="city-dist-${category}" class="city city-district-window"></div>`)
                .appendTo(districtGrid || '#city');

            if (!isAvailable){
                district.addClass('district-placeholder district-collapsed');
                district.attr('aria-hidden', 'true');
                return;
            }

            district.append(`<div><h3 class="name has-text-warning">${loc(`city_dist_${category}`)}</h3></div>`);

            if (category in city_buildings){
                city_buildings[category].forEach(function(city_name) {
                    addAction('city', city_name);
                });
            }

            if (category === 'outskirts' && global.race?.species === 'pinguicula'){
                const outskirts = district;
                const buildOutskirtsResourceStack = (resourceNames, stackId, posKey, widthKey, extraClass) => {
                    const rows = [];
                    const binds = [];
                    resourceNames.forEach((resName) => {
                        const res = global.resource?.[resName];
                        if (!res || !res.display){
                            return;
                        }
                        const color = tmp_vars?.resource?.[resName]?.color || 'info';
                        const showBar = global.settings?.resBar?.[resName] ? ' showBar' : '';
                        const rowId = `res${resName}${stackId}`;
                        const countId = `cnt${resName}${stackId}`;
                        const diffId = `inc${resName}${stackId}`;
                        const row = $(
                            `<div id="${rowId}" class="resource${showBar} outskirts-resource district-resource" v-show="display" :style="{ '--percent-full': (bar && max > 0 ? (amount/max)*100 : 0) + '%', '--percent-full-ratio': (bar && max > 0 ? Math.min(amount / max, 1) : 0) }">` +
                                `<div><h3 class="res has-text-${color}">${res.name}</h3>` +
                                `<span id="${countId}" class="count">{{ amount | size }} / {{ max | size }}</span></div>` +
                                `<span></span>` +
                                `<span id="${diffId}" class="diff">{{ diff | diffSize }} /s</span>` +
                            `</div>`
                        );
                        rows.push(row);
                        binds.push({ id: rowId, res, resName, countId, diffId });
                    });
                    if (!rows.length){
                        return;
                    }
                    const stackClass = `outskirts-resource-stack${extraClass ? ` ${extraClass}` : ''}`;
                    const stack = $(`<div id="${stackId}" class="${stackClass}"></div>`);
                    rows.forEach(function(row){
                        stack.append(row);
                    });
                    outskirts.prepend(stack);
                    setupResourceDrag(stack, posKey);
                    if (widthKey){
                        setupResourceResize(stack, widthKey);
                    }
                    binds.forEach(function(bind){
                        vBind({
                            el: `#${bind.id}`,
                            data: bind.res,
                            filters: {
                                size(value){
                                    return value ? sizeApproximation(value,0) : value;
                                },
                                diffSize(value){
                                    return sizeApproximation(value,2);
                                }
                            }
                        });
                        if ((bind.resName !== global.race.species || global.race['fasting']) && bind.resName !== 'Crates' && bind.resName !== 'Containers' && bind.res.max !== -1){
                            breakdownPopover(bind.countId, bind.resName, 'c');
                            if ($(`#${bind.diffId}`).length){
                                breakdownPopover(bind.diffId, bind.resName, 'p');
                            }
                        }
                    });
                };

                buildOutskirtsResourceStack(['Food'], 'outskirts-food-stack', 'evolve.outskirtsFoodPos', null, 'outskirts-food-stack');
                buildOutskirtsResourceStack(['Stone'], 'outskirts-resource-stack', 'evolve.outskirtsResourcePos', 'evolve.outskirtsResourceWidth');
                buildOutskirtsResourceStack(['Lumber'], 'outskirts-lumber-stack', 'evolve.outskirtsLumberPos', 'evolve.outskirtsLumberWidth', 'outskirts-lumber-stack');

                let resetAttempts = 0;
                const resetMaxAttempts = 20;
                const resetOutskirtsStacks = () => {
                    if (!outskirts.length){
                        return;
                    }
                    const parentRect = outskirts[0].getBoundingClientRect();
                    if (!parentRect.width || !parentRect.height){
                        if (resetAttempts < resetMaxAttempts){
                            resetAttempts += 1;
                            setTimeout(resetOutskirtsStacks, 100);
                        }
                        return;
                    }
                    [
                        { selector: '#outskirts-food-stack', key: 'evolve.outskirtsFoodPos' },
                        { selector: '#outskirts-resource-stack', key: 'evolve.outskirtsResourcePos' },
                        { selector: '#outskirts-lumber-stack', key: 'evolve.outskirtsLumberPos' }
                    ].forEach((entry) => {
                        const stack = $(entry.selector);
                        if (!stack.length){
                            return;
                        }
                        const rect = stack[0].getBoundingClientRect();
                        const intersects = !(
                            rect.right < parentRect.left ||
                            rect.left > parentRect.right ||
                            rect.bottom < parentRect.top ||
                            rect.top > parentRect.bottom
                        );
                        if (!intersects){
                            stack.css('transform', 'translate(0px, 0px)');
                            if (save && save.setItem){
                                save.setItem(entry.key, JSON.stringify({ x: 0, y: 0 }));
                            }
                        }
                    });
                };
                resetOutskirtsStacks();
            }

            if (category === 'military'){
                buildDistrictResourceStack(
                    district,
                    ['Furs'],
                    'military-resource-stack',
                    'evolve.militaryResourcePos',
                    'evolve.militaryResourceWidth',
                    'Military'
                );
            }

            if (category === 'industrial'){
                buildDistrictResourceStack(
                    district,
                    industrialResources,
                    'industrial-resource-stack',
                    'evolve.industrialResourcePos',
                    'evolve.industrialResourceWidth',
                    'Industrial'
                );
            }

            if (category === 'trade'){
                buildDistrictResourceStack(
                    district,
                    tradeResources,
                    'trade-resource-stack',
                    'evolve.tradeResourcePos',
                    'evolve.tradeResourceWidth',
                    'Trade'
                );
            }

            if (category === 'science'){
                buildDistrictResourceStack(
                    district,
                    scienceResources,
                    'science-resource-stack',
                    'evolve.scienceResourcePos',
                    'evolve.scienceResourceWidth',
                    'Science'
                );
            }

            if (category === 'residential'){
                buildDistrictResourceStack(
                    district,
                    residentialResources,
                    'residential-resource-stack',
                    'evolve.residentialResourcePos',
                    'evolve.residentialResourceWidth',
                    'Residential'
                );
            }

            if (category === 'commercial'){
                buildDistrictResourceStack(
                    district,
                    commercialResources,
                    'commercial-resource-stack',
                    'evolve.commercialResourcePos',
                    'evolve.commercialResourceWidth',
                    'Commercial'
                );
            }

            popover(`dist-${category}`, function(){
                return loc(`city_dist_${category}_desc`);
            },
            {
                elm: `#city-dist-${category} h3`,
                classes: `has-background-light has-text-dark`
            });

            const dragHandle = '.name, .district-toggle-button';
            setupResourceDrag(
                district,
                `evolve.cityDistrictPos.${category}`,
                {
                    handleSelector: dragHandle,
                    boundsSelector: '#cityDistrictGrid',
                    suppressClick: true,
                    clampToBounds: true
                }
            );

            ensureCityDistrictToggle(district, category);
        }
    });

    if (!global.settings['cLabels']){
        const warehouseAction = $('#city-warehouse');
        const garrisonAction = $('#city-garrison');
        if (warehouseAction.length && garrisonAction.length && warehouseAction.parent().is(garrisonAction.parent())){
            warehouseAction.insertBefore(garrisonAction);
        }
    }

    dockArmyPanelToCityDistricts();

    if (global.settings['cLabels']){
        scheduleCityDistrictLinks();
        setTimeout(scheduleCityDistrictLinks, 150);
    }
    else {
        $('#cityDistrictLinks').remove();
    }

    cLabels = global.settings['cLabels'];
}

export function drawTech(force = false){
    const techRoots = $('[id="tech"]');
    if (!techRoots.length){
        return;
    }
    if (!force && !global.settings.tabLoad && !isMainTabActive('research') && !global.settings.researchEmbedded){
        return;
    }
    let techs = {};
    let old_techs = {};
    let new_techs = {};
    let tech_categories = [];
    let old_categories = [];
    let all_categories = [];

    updateTechUnlockFlags();

    ['primitive','civilized','discovery','industrialized','globalized','early_space','deep_space','interstellar','intergalactic'].forEach(function (era){
        new_techs[era] = [];
    });

    const tp_era = {
        interstellar: 'solar'
    };

    let preReq = {};
    Object.keys(actions.tech).forEach(function (tech_name){
        if (!checkTechPath(tech_name)){
            return;
        }
        removeAction(actions.tech[tech_name].id);

        let isOld = checkOldTech(tech_name);

        let action = actions.tech[tech_name];
        let category = 'category' in action ? action.category : 'research';

        if (!isOld && tech_categories.indexOf(category) === -1) {
            tech_categories.push(category);
        }
        if (isOld && old_categories.indexOf(category) === -1) {
            old_categories.push(category);
        }
        if (all_categories.indexOf(category) === -1) {
            all_categories.push(category);
        }

        if (isOld === true) {
            if (!(category in old_techs)){
                old_techs[category] = [];
            }

            old_techs[category].push(tech_name);
        }
        else {
            let c_action = actions['tech'][tech_name];
            if (!checkTechQualifications(c_action,tech_name)){
                return;
            }

            let techAvail = checkTechRequirements(tech_name,preReq);
            if (!techAvail){
                return;
            }

            if (!(category in techs)) {
                techs[category] = [];
            }

            let era = global.race['truepath'] && tp_era[c_action.era] ? tp_era[c_action.era] : c_action.era;

            if (!new_techs.hasOwnProperty(era)){
                new_techs[era] = [];
            }

            new_techs[era].push({ t: tech_name, p: techAvail === 'precog' ? true : false });
        }
    });

    techRoots.each((_, root) => {
        const techRoot = $(root);
        techRenderTarget = techRoot;
        clearElement(techRoot);
        techRoot.append(`<div><h3 class="name has-text-warning tech-title-new">${loc('tab_new_sr_res')}</h3></div>`);
        techRoot.find('#techCompleted').remove();
        Object.keys(new_techs).forEach(function (era){
            if (new_techs[era].length > 0){
                techRoot.append(`<div><h3 class="name has-text-warning">${loc(`tech_era_${era}`)}</h3></div>`);

                new_techs[era].sort(function(a, b){
                    if(actions.tech[a.t].cost.Knowledge == undefined){
                        return -1;
                    }
                    if(actions.tech[b.t].cost.Knowledge == undefined){
                        return 1;
                    }
                    if (actions.tech[a.t].cost.Omniscience != undefined && actions.tech[b.t].cost.Omniscience != undefined){
                        return actions.tech[a.t].cost.Omniscience() > actions.tech[b.t].cost.Omniscience() ? 1 : -1;
                    }
                    return actions.tech[a.t].cost.Knowledge() > actions.tech[b.t].cost.Knowledge() ? 1 : -1;
                });
                new_techs[era].forEach(function(tech){
                    addAction('tech', tech.t, false, tech.p ? preReq : false);
                });
            }
        });
        let completedContainer = $(`<div id="techCompleted" class="tech tech-completed"></div>`);
        completedContainer.append(`<div><h3 class="name has-text-warning tech-title-completed">${loc('tab_old_sr_res')}</h3></div>`);
        techRoot.append(completedContainer);

        all_categories.forEach(function(category){
            clearElement(techRoot.find(`#tech-dist-${category}`),true);
            clearElement(techRoot.find(`#tech-dist-old-${category}`),true);
        });

        const completedRoot = completedContainer;
        old_categories.forEach(function(category){
            if(!(category in old_techs)){
                return;
            }

            $(`<div id="tech-dist-old-${category}" class="tech"></div>`)
                .appendTo(completedRoot)
                .append(`<div><h3 class="name has-text-warning">${loc(`tech_dist_${category}`)}</h3></div>`);

            let trick = trickOrTreat(4,12,false);
            if (trick.length > 0 && category === 'science'){
                completedRoot.find('#tech-dist-old-science h3').append(trick);
            }

            old_techs[category].forEach(function(tech_name) {
                addAction('tech', tech_name, true, false);
            });
        });
    });

    techRenderTarget = null;
}

export function addAction(action,type,old,prediction){
    let c_action = actions[action][type];
    setAction(c_action,action,type,old,prediction)
}

export function setAction(c_action,action,type,old,prediction){
    if (checkTechQualifications(c_action,type) === false) {
        return;
    }
    let tab = action;
    if (action === 'outerSol'){
        action = 'space';
    }
    if (c_action['region']){
        action = c_action.region;
    }
    if (tab === 'city' && global.settings['cLabels'] && c_action.category){
        const categoryTab = `city-dist-${c_action.category}`;
        if ($(`#${categoryTab}`).length){
            tab = categoryTab;
        }
    }
    if (c_action['powered'] && !global[action][type]['on']){
        global[action][type]['on'] = 0;
    }
    let id = c_action.id;
    removeAction(id);

    let reqs = ``;
    if (prediction && c_action && c_action.reqs){
        Object.keys(c_action.reqs).forEach(function(req){
            if (prediction[req]){
                reqs += ` data-req-${req}="${prediction[req].a}"`;
            }
        });
    }

    let parent = c_action['highlight'] && c_action.highlight() ? $(`<div id="${id}" class="action hl"${reqs}></div>`) : $(`<div id="${id}" class="action"${reqs}></div>`);
    if (!checkAffordable(c_action,false,(['genes','blood'].includes(action)))){
        parent.addClass('cna');
    }
    if (!checkAffordable(c_action,true,(['genes','blood'].includes(action)))){
        parent.addClass('cnam');
    }
    let classValue = '';
    if (c_action['class']){
        classValue = typeof c_action['class'] === 'function' ? c_action.class() : c_action['class'];
    }
    let clss = classValue ? ` ${classValue}` : ``;
    if (prediction){ clss = ' precog'; }
    else if (c_action['aura'] && c_action.aura()){ clss = ` ${c_action.aura()}`; }
    const imageClass = !prediction ? getActionImageClass(classValue) : '';
    const appliedClassList = clss.trim() ? clss.trim().split(/\s+/) : [];
    const contextKey = action;
    const seen = getUnlockSeenSet(contextKey);
    const isNewAction = !seen.has(id);
    if (!prediction){
        seen.add(id);
    }
    scheduleUnlockContextReady(contextKey);
    const allowUnlocking = tab === 'evolution' && global.settings.showEvolve;
    const shouldShowUnlocking = allowUnlocking
        && !prediction
        && actionUnlockReadyContexts.has(contextKey)
        && isNewAction
        && !old
        && imageClass
        && appliedClassList.includes(imageClass);
    let element;
    if (old){
        element = $(`<a class="button is-dark oldTech${clss}" role="presentation" tabindex="-1" aria-disabled="true"><span class="aTitle">{{ title }}</span></a>`);
    }
    else {
        let cst = '';
        let data = '';
        if (c_action['cost']){
            let costs = action !== 'genes' && action !== 'blood' ? adjustCosts(c_action) : c_action.cost;
            Object.keys(costs).forEach(function (res){
                let cost = costs[res]();
                if (cost > 0){
                    cst = cst + ` res-${res}`;
                    data = data + ` data-${res}="${cost}"`;
                }
            });
        }
        let active = c_action['highlight'] ? (c_action.highlight() ? `<span class="is-sr-only">${loc('active')}</span>` : `<span class="is-sr-only">${loc('not_active')}</span>`) : '';
        element = $(`<a class="button is-dark${cst}${clss}"${data} v-on:click="action" role="link"><span class="aTitle" v-html="$options.filters.title(title)"></span>${active}</a><a role="button" v-on:click="describe" class="is-sr-only">{{ title }} description</a>`);
    }
    parent.append(element);
    if (shouldShowUnlocking){
        const button = element.filter('a.button');
        applyActionUnlockingState(parent, button, imageClass);
    }

    if (action === 'tech' && !old && c_action.unlocks_tech){
        element.addClass('has-unlock-icon');
        element.append($(
            `<span class="tech-unlock-icon" aria-hidden="true">` +
                `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-icon lucide-lock">` +
                    `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>` +
                    `<path d="M7 11V7a5 5 0 0 1 10 0v4"/>` +
                `</svg>` +
            `</span>`
        ));
    }

    if (c_action.hasOwnProperty('special') && ((typeof c_action['special'] === 'function' && c_action.special()) || c_action['special'] === true) ){
        let special = $(`<div class="special" role="button" v-bind:title="title | options" @click="trigModal"><svg version="1.1" x="0px" y="0px" width="12px" height="12px" viewBox="340 140 280 279.416" enable-background="new 340 140 280 279.416" xml:space="preserve">
            <path class="gear" d="M620,305.666v-51.333l-31.5-5.25c-2.333-8.75-5.833-16.917-9.917-23.917L597.25,199.5l-36.167-36.75l-26.25,18.083
                c-7.583-4.083-15.75-7.583-23.916-9.917L505.667,140h-51.334l-5.25,31.5c-8.75,2.333-16.333,5.833-23.916,9.916L399.5,163.333
                L362.75,199.5l18.667,25.666c-4.083,7.584-7.583,15.75-9.917,24.5l-31.5,4.667v51.333l31.5,5.25
                c2.333,8.75,5.833,16.334,9.917,23.917l-18.667,26.25l36.167,36.167l26.25-18.667c7.583,4.083,15.75,7.583,24.5,9.917l5.25,30.916
                h51.333l5.25-31.5c8.167-2.333,16.333-5.833,23.917-9.916l26.25,18.666l36.166-36.166l-18.666-26.25
                c4.083-7.584,7.583-15.167,9.916-23.917L620,305.666z M480,333.666c-29.75,0-53.667-23.916-53.667-53.666s24.5-53.667,53.667-53.667
                S533.667,250.25,533.667,280S509.75,333.666,480,333.666z"/>
            </svg></div>`);
        parent.append(special);
    }
    if (c_action['on'] || c_action['off']){
        if (c_action['on']){
            let powerOn = $(`<span class="on" title="ON" v-html="$options.filters.val('on')"></span>`);
            parent.append(powerOn);
        }
        if (c_action['off']){
            let powerOff = $(`<span class="off" title="OFF" v-html="$options.filters.val('off')"></span>`);
            parent.append(powerOff);
        }
    }
    else {
        let switchable = c_action['switchable'] ? c_action.switchable() : (c_action['powered'] && global.tech['high_tech'] && global.tech['high_tech'] >= 2 && checkPowerRequirements(c_action));
        if (switchable){
            let powerOn = $(`<span role="button" :aria-label="on_label()" class="on" @click="power_on" title="ON" v-html="$options.filters.p_on(act.on,'${c_action.id}')"></span>`);
            let powerOff = $(`<span role="button" :aria-label="off_label()" class="off" @click="power_off" title="OFF" v-html="$options.filters.p_off(act.on,'${c_action.id}')"></span>`);
            parent.append(powerOn);
            parent.append(powerOff);
        }
    }
    if (c_action['count']){
        let count = c_action.count();
        if (count > 0 && (id !== 'city-gift' || count > 1)){
            element.append($(`<span class="count">${count}</span>`));
        }
    }
    else if (action !== 'tech' && global[action] && global[action][type] && global[action][type].count >= 0){
        element.append($(`<span class="count" v-html="$options.filters.count(act.count,'${type}')"></span>`));
    }
    else if (action === 'blood' && global[action] && global[action][c_action.grant[0]] && global[action][c_action.grant[0]] > 0 && c_action.grant[1] === '*'){
        element.append($(`<span class="count"> ${global[action][c_action.grant[0]]} </span>`));
    }
    if (action !== 'tech' && global[action] && global[action][type] && typeof(global[action][type]['repair']) !== 'undefined'){
        element.append($(`<div class="repair"><progress class="progress" :value="repair()" :max="repairMax()"></progress></div>`));
    }
    if (old){
        let completedRoot = null;
        if (action === 'tech' && techRenderTarget && techRenderTarget.length){
            completedRoot = techRenderTarget.find('#techCompleted');
        }
        if (!completedRoot || !completedRoot.length){
            completedRoot = $('#techCompleted');
        }
        if (completedRoot.length){
            completedRoot.append(parent);
        }
        else {
            $('#oldTech').append(parent);
        }
    }
    else {
        if (action === 'tech' && techRenderTarget && techRenderTarget.length){
            techRenderTarget.append(parent);
        }
        else {
            $('#'+tab).append(parent);
        }
    }
    updateQueueBadges(id);
    playNewActionSound(id, old, prediction);
    if (action !== 'tech' && global[action] && global[action][type] && global[action][type].count === 0){
        $(`#${id} .count`).css('display','none');
        $(`#${id} .special`).css('display','none');
        $(`#${id} .on`).css('display','none');
        $(`#${id} .off`).css('display','none');
    }

    if (c_action['emblem']){
        let emblem = c_action.emblem();
        parent.append($(emblem));
    }

    let modal = {
        template: '<div id="modalBox" class="modalBox"></div>'
    };

    vBind({
        el: '#'+id,
        data: {
            title: typeof c_action.title === 'string' ? c_action.title : c_action.title(),
            act: global[action][type]
        },
        methods: {
            action(args){
                if ('ontouchstart' in document.documentElement && navigator.userAgent.match(/Mobi/ && global.settings.touch) ? true : false){
                    return;
                }
                else {
                    runAction(c_action,action,type);
                }
            },
            describe(){
                srSpeak(srDesc(c_action,old));
            },
            trigModal(){
                if (c_action['sAction'] && typeof c_action['sAction'] === 'function'){
                    c_action.sAction()
                }
                else {
                    this.$buefy.modal.open({
                        parent: this,
                        component: modal
                    });

                    let checkExist = setInterval(function(){
                        if ($('#modalBox').length > 0) {
                            clearInterval(checkExist);
                            drawModal(c_action,type);
                        }
                    }, 50);
                }
            },
            on_label(){
                return `on: ${global[action][type].on}`;
            },
            off_label(){
                return `off: ${global[action][type].count - global[action][type].on}`;
            },
            power_on(){
                let keyMult = keyMultiplier();
                for (let i=0; i<keyMult; i++){
                    if (global[action][type].on < global[action][type].count){
                        global[action][type].on++;
                    }
                    else {
                        break;
                    }
                }
                if (c_action['postPower']){
                    callback_queue.set([c_action, 'postPower'], [true]);
                }
            },
            power_off(){
                let keyMult = keyMultiplier();
                for (let i=0; i<keyMult; i++){
                    if (global[action][type].on > 0){
                        global[action][type].on--;
                    }
                    else {
                        break;
                    }
                }
                if (c_action['postPower']){
                    callback_queue.set([c_action, 'postPower'], [false]);
                }
            },
            repair(){
                return global[action][type].repair;
            },
            repairMax(){
                return c_action.repair();
            }
        },
        filters: {
            val(v){
                switch(v){
                    case 'on':
                        return c_action.on();
                    case 'off':
                        return c_action.off();
                }
            },
            p_off(p,id){
                let value = global[action][type].count - p;
                if (
                    (id === 'city-casino' && !global.race['cataclysm'] && !global.race['orbit_decayed']) || 
                    (id === 'space-spc_casino' && (global.race['cataclysm'] || global.race['orbit_decayed'])) || 
                    (id === 'tauceti-tauceti_casino' && global.tech['isolation']) ||
                    (id === 'portal-hell_casino' && global.race['warlord'])
                ){
                    let egg = easterEgg(5,12);
                    if (value === 0 && egg.length > 0){
                        return egg;
                    }
                }
                return value;
            },
            p_on(p,id){
                if (
                    (id === 'city-biolab' && !global.race['cataclysm'] && !global.race['orbit_decayed']) || 
                    ((global.race['cataclysm'] || global.race['orbit_decayed']) && id === 'space-exotic_lab') ||
                    (global.tech['isolation'] && id === 'tauceti-infectious_disease_lab') ||
                    (global.race['warlord'] && id === 'portal-twisted_lab')
                ){
                    let egg = easterEgg(12,12);
                    if (p === 0 && egg.length > 0){
                        return egg;
                    }
                }
                else if (id === 'city-garrison' || id === 'space-space_barracks' || id === 'portal-brute'){
                    let trick = trickOrTreat(1,14,true);
                    let num = id === 'city-garrison' || id === 'portal-brute' ? 13 : 0;
                    if (p === num && trick.length > 0){
                        return trick;
                    }
                }
                return p;
            },
            title(t){
                return t;
            },
            options(t){
                return loc(`action_options`,[t]);
            },
            count(v,t){
                if (['temple','ziggurat'].includes(t)){
                    return templeCount(t === 'temple' ? false : true);
                }
                return v;
            }
        }
    });

    popover(id,function(){ return undefined; },{
        in: function(obj){
            actionDesc(obj.popper,c_action,global[action][type],old,action,type);
        },
        out: function(){
            vBind({el: `#popTimer`},'destroy');
        },
        attach: action === 'starDock' ? 'body .modal' : '#main',
        wide: c_action['wide'],
        classes: c_action.hasOwnProperty('class') ? c_action.class : false,
    });
}

function recordEvolutionRoute(action, type, c_action){
    if (action !== 'evolution' || !c_action || !c_action.grant || !c_action.class){
        return;
    }
    if (!global.evolution){
        return;
    }
    if (!Array.isArray(global.evolution.route)){
        global.evolution.route = [];
    }
    if (!global.evolution.route.includes(type)){
        global.evolution.route.push(type);
    }
}

function snapshotPopulationState(){
    const species = global?.race?.species;
    const popRes = species ? global.resource?.[species] : null;
    if (!popRes){
        return null;
    }
    return {
        amount: popRes.amount,
        max: popRes.max,
        display: popRes.display
    };
}

function formatPopulationValue(value){
    return value ? sizeApproximation(value,0) : value;
}

export function updatePopulationCounters(popRes){
    const species = global?.race?.species;
    if (!species || !popRes){
        return;
    }
    const amountText = formatPopulationValue(popRes.amount);
    const maxText = formatPopulationValue(popRes.max);
    const text = `${amountText} / ${maxText}`;
    [`#cnt${species}`, `#cnt${species}Residential`].forEach((selector) => {
        const el = document.querySelector(selector);
        if (el){
            el.textContent = text;
        }
    });
}

function forcePopulationBindings(){
    const species = global?.race?.species;
    const popRes = species ? global.resource?.[species] : null;
    if (!popRes){
        return;
    }
    [`#res${species}`, `#res${species}Residential`].forEach((selector) => {
        vBind({ el: selector }, 'update');
    });
    updatePopulationCounters(popRes);
}

function refreshPopulationBindings(previous){
    if (!previous){
        return;
    }
    const species = global?.race?.species;
    const popRes = species ? global.resource?.[species] : null;
    if (!popRes){
        return;
    }
    if (popRes.amount === previous.amount && popRes.max === previous.max && popRes.display === previous.display){
        return;
    }
    [`#res${species}`, `#res${species}Residential`].forEach((selector) => {
        vBind({ el: selector }, 'update');
    });
    updatePopulationCounters(popRes);
}

function scheduleResearchRefresh(techId){
    if (typeof window === 'undefined'){
        return;
    }
    const canRefreshAll = typeof window.refreshAllResearchTabs === 'function';
    const canForce = typeof window.forceRefreshResearchViews === 'function';
    const canRefresh = typeof window.refreshResearchTab === 'function';
    const maxAttempts = 4;
    let attempts = 0;
    const refresh = () => {
        attempts += 1;
        if (canRefreshAll){
            window.refreshAllResearchTabs();
        }
        else if (canForce){
            window.forceRefreshResearchViews();
        }
        else if (canRefresh){
            window.refreshResearchTab();
        }
        if (typeof document !== 'undefined'){
            const stillVisible = techId ? document.querySelector(`[id="${techId}"]`) : null;
            if (stillVisible || !canRefresh){
                drawTech(true);
            }
            if (stillVisible && attempts < maxAttempts){
                setTimeout(refresh, 50);
            }
        }
        else if (!canRefresh){
            drawTech(true);
        }
    };
    if (typeof requestAnimationFrame === 'function'){
        requestAnimationFrame(() => requestAnimationFrame(refresh));
    }
    else {
        setTimeout(refresh, 0);
    }
}

function runAction(c_action,action,type){
    const popSnapshot = snapshotPopulationState();
    if (c_action.id === 'spcdock-launch_ship'){
        c_action.action({isQueue: false});
    }
    else {
        switch (action){
            case 'tech':
                if (!(global.settings.qKey && keyMap.q) && checkTechRequirements(type,false) && c_action.action({isQueue: false})){
                    gainTech(type);
                    const techId = actions?.tech?.[type]?.id;
                    if (techId){
                        removeAction(techId);
                        if ($('#techCompleted').length){
                            addAction('tech', type, true, false);
                        }
                    }
                    scheduleResearchRefresh(techId);
                    if (c_action['post']){
                        callback_queue.set([c_action, 'post'], []);
                    }
                }
                else {
                    if (!(c_action['no_queue'] && c_action['no_queue']()) && global.tech['r_queue']){
                        if (global.r_queue.queue.length < global.r_queue.max){
                            let queued = false;
                            for (let tech in global.r_queue.queue){
                                if (global.r_queue.queue[tech].id === c_action.id){
                                    queued = true;
                                    break;
                                }
                            }
                            if (!queued){
                                global.r_queue.queue.push({ id: c_action.id, action: action, type: type, label: typeof c_action.title === 'string' ? c_action.title : c_action.title(), cna: false, time: 0, bres: false, req: true });
                                resQueue();
                                drawTech();
                                updateQueueBadges(c_action.id);
                            }
                        }
                    }
                }
                break;
            case 'genes':
            case 'blood':
                if (c_action.action({isQueue: false})){
                    if (action === 'genes'){
                        gainGene(type);
                    }
                    else {
                        gainBlood(type);
                    }
                    if (c_action['post']){
                        callback_queue.set([c_action, 'post'], []);
                    }
                }
                break;
            default:
                {
                    let keyMult = c_action['no_multi'] ? 1 : keyMultiplier();
                    if (c_action['grant']){
                        keyMult = 1;
                    }
                    let grant = false;
                    let add_queue = false;
                    let loopNum = global.settings.qKey && keyMap.q ? 1 : keyMult;
                    for (let i=0; i<loopNum; i++){
                        let res = false;
                        if ((global.settings.qKey && keyMap.q) || (!(res = c_action.action({isQueue: false})))){
                            if (!(global.settings.qKey && keyMap.q)){
                                showResourceFullBadge(c_action);
                            }
                            if (res !== 0 && global.tech['queue'] && (keyMult === 1 || (global.settings.qKey && keyMap.q))){
                                let used = 0;
                                let buid_max = c_action['queue_complete'] ? c_action.queue_complete() : Number.MAX_SAFE_INTEGER;
                                for (let j=0; j<global.queue.queue.length; j++){
                                    used += Math.ceil(global.queue.queue[j].q / global.queue.queue[j].qs);
                                    if (global.queue.queue[j].id === c_action.id) {
                                        buid_max -= global.queue.queue[j].q;
                                    }
                                }
                                if (used < global.queue.max && buid_max > 0){
                                    let repeat = global.settings.qKey ? keyMult : 1;
                                    if (repeat > global.queue.max - used){
                                        repeat = global.queue.max - used;
                                    }
                                    let q_size = c_action['queue_size'] ? c_action['queue_size'] : 1;
                                    if (c_action['region']){
                                        action = c_action.id.split("-")[0];
                                    }
                                    if (global.settings.q_merge !== 'merge_never'){
                                        if (global.queue.queue.length > 0 && global.queue.queue[global.queue.queue.length-1].id === c_action.id){
                                            global.queue.queue[global.queue.queue.length-1].q += Math.min(buid_max, q_size * repeat);
                                        }
                                        else {
                                            global.queue.queue.push({ id: c_action.id, action: action, type: type, label: typeof c_action.title === 'string' ? c_action.title : c_action.title(), cna: false, time: 0, q: Math.min(buid_max, q_size * repeat), qs: q_size, t_max: 0, bres: false });
                                        }
                                    }
                                    else {
                                        for (let k=0; k<repeat && buid_max > 0; k++){
                                            global.queue.queue.push({ id: c_action.id, action: action, type: type, label: typeof c_action.title === 'string' ? c_action.title : c_action.title(), cna: false, time: 0, q: Math.min(buid_max, q_size), qs: q_size, t_max: 0, bres: false });
                                            buid_max -= q_size;
                                        }
                                    }
                                    add_queue = true;
                                }
                            }
                            break;
                        }
                        else {
                            if (global.race['inflation'] && global.tech['primitive']){
                                if (!c_action.hasOwnProperty('inflation') || c_action.inflation){
                                    global.race.inflation++;
                                }
                            }
                            recordEvolutionRoute(action, type, c_action);
                        }
                        grant = true;
                    }
                    if (grant){
                        postBuild(c_action,action,type);
                        if (global.tech['queue'] && c_action['queue_complete']) {
                            let buid_max = c_action.queue_complete();
                            for (let i=0, j=0; j<global.queue.queue.length; i++, j++){
                                let item = global.queue.queue[j];
                                if (item.id === c_action.id) {
                                    if (buid_max < 1) {
                                        clearPopper(`q${item.id}${i}`);
                                        global.queue.queue.splice(j--,1);
                                        add_queue = true;
                                    }
                                    else if (item.q > buid_max) {
                                        item.q = buid_max;
                                        buid_max = 0;
                                    }
                                    else {
                                        buid_max -= item.q;
                                    }
                                }
                            }
                        }
                    }
                    if (add_queue){
                        buildQueue();
                    }
                    break;
                }
        }
    }
    refreshPopulationBindings(popSnapshot);
}

export function postBuild(c_action,action,type){
    if (!checkAffordable(c_action)){
        let id = c_action.id;
        $(`#${id}`).addClass('cna');
    }
    if (c_action['grant']){
        let tech = c_action.grant[0];
        if (!global.tech[tech] || global.tech[tech] < c_action.grant[1]){
            global.tech[tech] = c_action.grant[1];
        }
    }
    if (c_action['grant'] || c_action['refresh']){
        removeAction(c_action.id);
        if (global.race.species === 'protoplasm'){
            drawEvolution();
        }
        else {
            drawCity();
            drawTech();
            renderSpace();
            renderFortress();
            renderTauCeti();
            renderEdenic();
        }
    }
    if (c_action['post']){
        callback_queue.set([c_action, 'post'], []);
    }
    forcePopulationBindings();
    updateDesc(c_action,action,type);
}

// 设置星球
export function setPlanet(opt){
    var biome = 'grassland';
    let trait = [];
    var orbit = 365;
    let geology = {};
    let custom = false;

    if (global.stats.achieve['lamentis'] && global.stats.achieve.lamentis.l >= 4 && global.custom['planet'] && opt.custom && opt.custom.length > 0 && Math.floor(seededRandom(0,10)) === 0){
        custom = opt.custom[Math.floor(seededRandom(0,opt.custom.length))];
        let target = custom.split(':');

        if (global.custom.planet[target[0]] && global.custom.planet[target[0]][target[1]]){
            let p = deepClone(global.custom.planet[target[0]][target[1]]);
            biome = p.biome;
            trait = p.traitlist;
            orbit = p.orbit;
            geology = p.geology;
            trait.sort();
        }
        else {
            custom = false;
        }
    }
    if (!custom){
        biome = buildPlanet('biome',opt);
        trait = buildPlanet('trait',opt,{biome: biome});
        trait.sort();

        let max = Math.floor(seededRandom(0,3));
        let top = 30;
        if (global.stats.achieve['whitehole']){
            top += global.stats.achieve['whitehole'].l * 5;
            max += global.stats.achieve['whitehole'].l;
        }
        if (biome === 'eden'){
            top += 5;
        }

        for (let i=0; i<max; i++){
            switch (Math.floor(seededRandom(0,10))){
                case 0:
                    geology['Copper'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    break;
                case 1:
                    geology['Iron'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    break;
                case 2:
                    geology['Aluminium'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    break;
                case 3:
                    geology['Coal'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    break;
                case 4:
                    geology['Oil'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    break;
                case 5:
                    geology['Titanium'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    break;
                case 6:
                    geology['Uranium'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    break;
                case 7:
                    if (global.stats.achieve['whitehole']){
                        geology['Iridium'] = ((Math.floor(seededRandom(0,top)) - 10) / 100);
                    }
                    break;
                default:
                    break;
            }
        }
        switch (biome){
            case 'hellscape':
                orbit = 666;
                break;
            case 'eden':
                orbit = 777;
                break;
            default:
                {
                    let maxOrbit = 600;
                    if (trait.includes('elliptical')){
                        maxOrbit += 200;
                    }
                    if (trait.includes('kamikaze')){
                        maxOrbit += 100;
                    }
                    orbit = Math.floor(seededRandom(200,maxOrbit));
                }
                break;
        }
    }

    let num = Math.floor(seededRandom(0,10000));
    var id = biome+num;
    id = id.charAt(0).toUpperCase() + id.slice(1);

    let traits = '';
    trait.forEach(function(t){
        if (planetTraits.hasOwnProperty(t)){
            traits += `${planetTraits[t].label} `;
        }
    });

    let title = `${traits}${biomes[biome].label} ${num}`;
    var parent = $(`<div id="${id}" class="action"></div>`);
    var element = $(`<a class="button is-dark" v-on:click="action" role="link"><span class="aTitle">${title}</span></a>`);
    parent.append(element);

    $('#evolution').append(parent);

    let popper = false;
    let gecked = 0;
    popover(id,function(obj){
        popper = obj;
        planetDesc(obj,title,biome,orbit,trait,geology,gecked);
        return undefined;
    },{
        classes: `has-background-light has-text-dark`
    });

    $('#'+id).on('click',function(){
        if (global.stats.achieve['lamentis'] && global.stats.achieve.lamentis.l >= 5 && global.race.hasOwnProperty('geck') && global.race.geck > 0){
            Object.keys(geology).forEach(function (g){
                geology[g] += Math.floor(seededRandom(0,7)) / 100;
            });
            if (gecked > 0){
                let odds = 8 - gecked;
                if (odds < 1){ odds = 1; }
                if (Math.floor(seededRandom(0,odds)) === 0){
                    biome = buildPlanet('biome',opt);
                }
            }
            if (Math.floor(seededRandom(0,2)) === 0){
                let pT = buildPlanet('trait',opt,{biome: biome, cap: 1});
                if (pT.length > 0){
                    if (trait.includes(pT[0])){
                        let idx = trait.indexOf(pT[0]);
                        trait.splice(idx, 1);
                    }
                    else if (pT[0] !== undefined){
                        trait.push(pT[0]);
                    }
                    traits = '';
                    trait.forEach(function(t){
                        if (planetTraits.hasOwnProperty(t)){
                            traits += `${planetTraits[t].label} `;
                        }
                    });
                }
            }
            title = `${traits}${biomes[biome].label} ${num}`;
            $(`#${id} .aTitle`).html(title);
            gecked++;
            global.race.geck--;
            if (!global.race.hasOwnProperty('gecked')){
                global.race['gecked'] = 0;
            }
            global.race.gecked++;
            clearElement(popper.popper);
            planetDesc(popper,title,biome,orbit,trait,geology,gecked);
        }
        else {
            delete global.race['geck'];
            if (global.race['gecked']){
                global.stats.geck += global.race.gecked;
            }
            global.race['chose'] = id;
            global.city.biome = biome;
            global.city.calendar.orbit = orbit;
            global.city.geology = geology;
            global.city.ptrait = trait;
            if (gecked > 0){
                global.race['rejuvenated'] = true;
            }
            clearElement($('#evolution'));
            clearPopper();
            drawEvolution();
        }
    });

    return custom ? custom : (biome === 'eden' ? 'hellscape' : biome);
}

function planetDesc(obj,title,biome,orbit,trait,geology,gecked){
    obj.popper.append($(`<div>${loc('set_planet',[title,biomes[biome].label,orbit])}</div>`));
    obj.popper.append($(`<div>${biomes[biome].desc}</div>`));
    if (trait.length > 0){
        trait.forEach(function(t){
            obj.popper.append($(`<div>${planetTraits[t].desc}</div>`));
        });
    }

    let pg = planetGeology(geology);
    if (pg.length > 0){
        obj.popper.append($(`<div>${pg}</div>`));
    }
    if (gecked && gecked > 0){
        obj.popper.append($(`<div class="has-text-special">${loc(`rejuvenated`)}</div>`));
    }
    return undefined;
}

function buildPlanet(aspect,opt,args){
    args = args || {};
    if (aspect === 'biome'){
        let biome = 'grassland';
        let max_bound = !opt.hell && global.stats.portals >= 1 ? 7 : 6;
        let subbiome = Math.floor(seededRandom(0,3)) === 0 ? true : false;
        let uAffix = universeAffix();
        switch (Math.floor(seededRandom(0,max_bound))){
            case 0:
                {
                    let sb = subbiome && global.stats.achieve['biome_grassland'] && global.stats.achieve.biome_grassland[uAffix] && global.stats.achieve.biome_grassland[uAffix] > 0;
                    biome = sb ? 'savanna' : 'grassland';
                }
                break;
            case 1:
                {
                    let sb = subbiome && global.stats.achieve['biome_oceanic'] && global.stats.achieve.biome_oceanic[uAffix] && global.stats.achieve.biome_oceanic[uAffix] > 0;
                    biome = sb ? 'swamp' : 'oceanic';
                }
                break;
            case 2:
                {
                    let sb = subbiome && global.stats.achieve['biome_forest'] && global.stats.achieve.biome_forest[uAffix] && global.stats.achieve.biome_forest[uAffix] > 0;
                    biome = sb ? (Math.floor(seededRandom(0,2)) === 0 ? 'taiga' : 'swamp') : 'forest';
                }
                break;
            case 3:
                {
                    let sb = subbiome && global.stats.achieve['biome_desert'] && global.stats.achieve.biome_desert[uAffix] && global.stats.achieve.biome_desert[uAffix] > 0;
                    biome = sb ? 'ashland' : 'desert';
                }
                break;
            case 4:
                {
                    let sb = subbiome && global.stats.achieve['biome_volcanic'] && global.stats.achieve.biome_volcanic[uAffix] && global.stats.achieve.biome_volcanic[uAffix] > 0;
                    biome = sb ? 'ashland' : 'volcanic';
                }
                break;
            case 5:
                {
                    let sb = subbiome && global.stats.achieve['biome_tundra'] && global.stats.achieve.biome_tundra[uAffix] && global.stats.achieve.biome_tundra[uAffix] > 0;
                    biome = sb ? 'taiga' : 'tundra';
                }
                break;
            case 6:
                biome = global.race.universe === 'evil' ? 'eden' : 'hellscape';
                break;
            default:
                biome = 'grassland';
                break;
        }
        return biome;
    }
    else if (aspect === 'trait'){
        let trait = [];
        let cap = args['cap'] || 2;
        for (let i=0; i<cap; i++){
            let top = 18 + (9 * i);
            switch (Math.floor(seededRandom(0,top))){
                case 0:
                    if (!trait.includes('toxic')){
                        trait.push('toxic');
                    }
                    break;
                case 1:
                    if (!trait.includes('mellow')){
                        trait.push('mellow');
                    }
                    break;
                case 2:
                    if (!trait.includes('rage')){
                        trait.push('rage');
                    }
                    break;
                case 3:
                    if (!trait.includes('stormy')){
                        trait.push('stormy');
                    }
                    break;
                case 4:
                    if (!trait.includes('ozone')){
                        trait.push('ozone');
                    }
                    break;
                case 5:
                    if (!trait.includes('magnetic')){
                        trait.push('magnetic');
                    }
                    break;
                case 6:
                    if (!trait.includes('trashed')){
                        trait.push('trashed');
                    }
                    break;
                case 7:
                    if (!trait.includes('elliptical')){
                        trait.push('elliptical');
                    }
                    break;
                case 8:
                    if (!trait.includes('flare')){
                        trait.push('flare');
                    }
                    break;
                case 9:
                    if (!trait.includes('dense')){
                        trait.push('dense');
                    }
                    break;
                case 10:
                    if (!trait.includes('unstable')){
                        trait.push('unstable');
                    }
                    break;
                case 11:
                    if (!trait.includes('permafrost') && !['volcanic','ashland','hellscape'].includes(args['biome'])){
                        trait.push('permafrost');
                    }
                    break;
                case 12:
                    if (!trait.includes('retrograde')){
                        trait.push('retrograde');
                    }
                    break;
                case 13:
                    if (!trait.includes('kamikaze')){
                        trait.push('kamikaze');
                    }
                    break;
                default:
                    break;
            }
        }
        return trait;
    }
}

// Returns true when side effects associated with the new structure being powered on should occur. Can return false even when alwaysPowered is enabled.
export function powerOnNewStruct(c_action){
    let parts = c_action.id.split('-');
    if (!global.hasOwnProperty(parts[0]) || !global[parts[0]].hasOwnProperty(parts[1])){
        return false;
    }

    // Electricity: production is negative, consumption is positive
    let need_p = c_action.hasOwnProperty('powered') && c_action.powered() > 0;
    let can_p = !need_p;
    let gov_replicator = global.race.hasOwnProperty('governor') && global.race.governor.hasOwnProperty('tasks') && global.race.hasOwnProperty('replicator') && Object.values(global.race.governor.tasks).includes('replicate') && global.race.governor.config.replicate.pow.on && global.race.replicator.pow > 0;
    if (need_p && global.city.hasOwnProperty('powered') && checkPowerRequirements(c_action)){
        let power = global.city.power;
        if (gov_replicator){
            power += global.race.replicator.pow;
        }
        can_p = c_action.powered() <= power;
    }

    // Support: production is positive, consumption is negative
    let need_s = c_action.hasOwnProperty('s_type') && c_action.hasOwnProperty('support') && c_action.support() < 0;
    let can_s = !need_s;
    if (need_s){
        let grids = gridDefs();
        let s_r = grids[c_action.s_type].r;
        let s_rs = grids[c_action.s_type].rs;
        can_s = global[s_r][s_rs].support - c_action.support() <= global[s_r][s_rs].s_max;
    }

    if (can_p && can_s || global.settings.alwaysPower){
        global[parts[0]][parts[1]].on++;
        if (need_p){
            global.city.power -= c_action.powered();
            if (gov_replicator){
                gov_tasks.replicate.task();
            }
        }
        if (c_action['postPower']){
            callback_queue.set([c_action, 'postPower'], [true]);
        }
        return true;
    }
    return false;
}

// Return the powered/supported/enabled quantity of a struct.
// When called from the wiki, assume that "enough" support is available, because this information is not in the save.
// For structs that cannot be enabled, powered, or supported, always return 0.
export function getStructNumActive(c_action,wiki){
    let parts = c_action.id.split('-');
    if (!global.hasOwnProperty(parts[0]) || !global[parts[0]].hasOwnProperty(parts[1])){
        return 0;
    }

    // For all 3 struct types (switchable, powered, support), the "on" field is named in the same way
    let num_on = global[parts[0]][parts[1]].on;
    if (!num_on){ // This is also a null check
        return 0;
    }

    // Electricity: production is negative, consumption is positive
    if (c_action.hasOwnProperty('powered') && c_action.powered() > 0) {
        if (global.city.hasOwnProperty('powered') && checkPowerRequirements(c_action)){
            // The p_on struct is empty in the wiki view and right when the page has been reloaded
            if (p_on.hasOwnProperty(parts[1])){
                num_on = Math.min(num_on, p_on[parts[1]]);
            }
        }
        else {
            num_on = 0;
        }
    }

    // Support: production is positive, consumption is negative
    if (c_action.hasOwnProperty('s_type') && c_action.hasOwnProperty('support') && c_action.support() < 0){
        let found_support = false;
        if (support_on.hasOwnProperty(parts[1])){
            found_support = true;
            num_on = Math.min(num_on, support_on[parts[1]]);
        }
        if (int_on.hasOwnProperty(parts[1])){
            found_support = true;
            num_on = Math.min(num_on, int_on[parts[1]]);
        }
        if (gal_on.hasOwnProperty(parts[1])){
            found_support = true;
            num_on = isStargateOn(wiki) ? Math.min(num_on, gal_on[parts[1]]) : 0;
        }
        if (spire_on.hasOwnProperty(parts[1])){
            found_support = true;
            num_on = Math.min(num_on, spire_on[parts[1]]);
        }

        // The support_on structs are empty in the wiki view and right when the page has been reloaded
        // This means that the wiki can be wrong, but we can at least check "max" support
        if (!found_support) {
            let grids = gridDefs();
            let s_r = grids[c_action.s_type].r;
            if (s_r === 'galaxy' && !isStargateOn(wiki)){
                num_on = 0;
            }
            else {
                let s_rs = grids[c_action.s_type].rs;
                let max_s = Math.floor(global[s_r][s_rs].s_max / -c_action.support());
                num_on = Math.min(num_on, max_s);
            }
        }
    }

    return num_on;
}

export function planetGeology(geology){
    let geo_traits = ``;
    if (Object.keys(geology).length > 0){
        let good = ``;
        let bad = ``;
        let numShow = global.stats.achieve['miners_dream'] ? (global.stats.achieve['miners_dream'].l >= 4 ? global.stats.achieve['miners_dream'].l * 2 - 3 : global.stats.achieve['miners_dream'].l) : 0;
        if (global.stats.achieve['lamentis'] && global.stats.achieve.lamentis.l >= 0){ numShow++; }
        for (let key in geology){
            if (key !== 0){
                if (geology[key] > 0) {
                    let res_val = `<div class="has-text-advanced pGeo">${loc(`resource_${key}_name`)}`;
                    if (numShow > 0) {
                        res_val += `: <span class="has-text-success">+${Math.round((geology[key] + 1) * 100 - 100)}%</span>`;
                        numShow--;
                    }
                    else {
                        res_val += `: <span class="has-text-success">${loc('bonus')}</span>`;
                    }
                    res_val += `</div>`;
                    good = good + res_val;
                }
                else if (geology[key] < 0){
                    let res_val = `<div class="has-text-caution pGeo">${loc(`resource_${key}_name`)}`;
                    if (numShow > 0) {
                        res_val += `: <span class="has-text-danger">${Math.round((geology[key] + 1) * 100 - 100)}%</span>`;
                        numShow--;
                    }
                    else {
                        res_val += `: <span class="has-text-danger">${loc('malus')}</span>`;
                    }
                    res_val += `</div>`;
                    bad = bad + res_val
                }
            }
        }
        geo_traits = `<div class="pGeoList flexAround">${good}${bad}</div>`;
    }
    return geo_traits;
}

function srDesc(c_action,old){
    let desc = typeof c_action.desc === 'string' ? c_action.desc : c_action.desc();
    desc = desc + '. ';
    if (c_action.cost && !old){
        if (checkAffordable(c_action)){
            desc = desc + loc('affordable') + '. ';
        }
        else {
            desc = desc + loc('not_affordable') + '. ';
        }
        desc = desc + 'Costs: ';
        let type = c_action.id.split('-')[0];
        var costs = type !== 'genes' && type !== 'blood' ? adjustCosts(c_action) : c_action.cost;
        Object.keys(costs).forEach(function (res){
            if (res === 'Custom'){
                let custom = costs[res]();
                desc = desc + custom.label;
            }
            else if (res === 'Structs'){
                let structs = costs[res]();
                Object.keys(structs).forEach(function (region){
                    Object.keys(structs[region]).forEach(function (struct){
                        let label = '';
                        const check_on = structs[region][struct].hasOwnProperty('on');
                        let num_on;
                        if (structs[region][struct].hasOwnProperty('s')){
                            let sector = structs[region][struct].s;
                            label = typeof actions[region][sector][struct].title === 'string' ? actions[region][sector][struct].title : actions[region][sector][struct].title();
                            if (check_on){
                                num_on = getStructNumActive(actions[region][sector][struct]);
                            }
                        }
                        else {
                            label = typeof actions[region][struct].title === 'string' ? actions[region][struct].title : actions[region][struct].title();
                            if (check_on){
                                num_on = getStructNumActive(actions[region][struct]);
                            }
                        }
                        desc = desc + `${label}. `;

                        if (!global[region][struct]){
                            desc = desc + `${loc('insufficient')} ${label}. `;
                        }
                        else if (structs[region][struct].count > global[region][struct].count){
                            desc = desc + `${loc('insufficient')} ${label}. `;
                        }
                        else if (check_on && structs[region][struct].on > num_on){
                            desc = desc + `${loc('insufficient')} ${label} enabled. `;
                        }
                    });
                });
            }
            else if (global.prestige.hasOwnProperty(res)){
                let res_cost = costs[res]();
                if (res_cost > 0){
                    if (res === 'Plasmid' && global.race.universe === 'antimatter'){
                        res = 'AntiPlasmid';
                    }
                    let label = loc(`resource_${res}_name`);
                    desc = desc + `${label}: ${res_cost}. `;
                    if (global.prestige[res].count < res_cost){
                        desc = desc + `${loc('insufficient')} ${label}. `;
                    }
                }
            }
            else if (res === 'Supply'){
                let res_cost = costs[res]();
                if (res_cost > 0){
                    let label = loc(`resource_${res}_name`);
                    desc = desc + `${label}: ${res_cost}. `;
                    if (global.portal.purifier.supply < res_cost){
                        desc = desc + `${loc('insufficient')} ${label}. `;
                    }
                }
            }
            else if (res !== 'Morale' && res !== 'Army' && res !== 'Bool'){
                let res_cost = costs[res]();
                let f_res = res === 'Species' ? global.race.species : res;
                if (res_cost > 0){
                    let label = f_res === 'Money' ? '$' : global.resource[f_res].name+': ';
                    label = label.replace("_", " ");

                    let display_cost = sizeApproximation(res_cost,1);
                    desc = desc + `${label}${display_cost}. `;
                    if (global.resource[f_res].amount < res_cost){
                        desc = desc + `${loc('insufficient')} ${global.resource[f_res].name}. `;
                    }
                }
            }
        });
    }

    if (c_action.effect){
        let effect = typeof c_action.effect === 'string' ? c_action.effect : c_action.effect();
        if (effect){
            desc = desc + effect + '. ';
        }
    }
    if (c_action.flair){
        let flair = typeof c_action.flair === 'string' ? c_action.flair : c_action.flair();
        if (flair){
            desc = desc + flair + '.';
        }
    }

    return desc.replace("..",".");
}

export function actionDesc(parent,c_action,obj,old,action,a_type,bres){
    clearElement(parent);
    var desc = typeof c_action.desc === 'string' ? c_action.desc : c_action.desc();
    bres = bres || false;
    
    let touch = false;
    if (action && a_type && 'ontouchstart' in document.documentElement && navigator.userAgent.match(/Mobi/) && global.settings.touch ? true : false){
        touch = $(`<a id="touchButton" class="button is-dark touchButton">${c_action.hasOwnProperty('touchlabel') ? c_action.touchlabel : loc('construct')}</a>`);
        parent.append(touch);

        $('#touchButton').on('touchstart', function(){
            runAction(c_action,action,a_type);
        });
    }

    parent.append($(`<div>${desc}</div>`));

    let type = c_action.id.split('-')[0];
    if (c_action['category'] && type === 'tech' && !old){
        parent.append($(`<div class="has-text-flair">${loc('tech_dist_category')}: ${loc(`tech_dist_${c_action.category}`)}</div>`));
    }

    let tc = timeCheck(c_action,false,true);
    if (c_action.cost && !old){
        let empty = true;
        var cost = $('<div class="costList"></div>');

        var costs = type !== 'genes' && type !== 'blood' ? adjustCosts(c_action) : c_action.cost;
        Object.keys(costs).forEach(function (res){
            if (res === 'Custom'){
                let custom = costs[res]();
                cost.append($(`<div>${custom.label}</div>`));
                empty = false;
            }
            else if (res === 'Structs'){
                let structs = costs[res]();
                Object.keys(structs).forEach(function (region){
                    Object.keys(structs[region]).forEach(function (struct){
                        let label = '';
                        const check_on = structs[region][struct].hasOwnProperty('on');
                        let num_on;
                        let res_cost = check_on ? structs[region][struct].on : structs[region][struct].count;
                        let color = 'has-text-dark';
                        let aria = '';

                        if (structs[region][struct].hasOwnProperty('s')){
                            const sector = structs[region][struct].s;
                            label = typeof actions[region][sector][struct].title === 'string' ? actions[region][sector][struct].title : actions[region][sector][struct].title();
                            if (check_on){
                                num_on = getStructNumActive(actions[region][sector][struct]);
                            }
                        }
                        else {
                            label = typeof actions[region][struct].title === 'string' ? actions[region][struct].title : actions[region][struct].title();
                            if (check_on){
                                num_on = getStructNumActive(actions[region][struct]);
                            }
                        }

                        if (!global[region][struct]){
                            color = 'has-text-danger';
                            aria = ' <span class="is-sr-only">(blocking resource)</span>';
                        }
                        else if (structs[region][struct].count > global[region][struct].count){
                            color = 'has-text-danger';
                            aria = ' <span class="is-sr-only">(blocking resource)</span>';
                        }
                        else if (check_on && structs[region][struct].on > num_on){
                            color = 'has-text-alert';
                        }

                        empty = false;
                        cost.append($(`<div class="${color}">${label}: ${res_cost}${aria}</div>`));
                    });
                });
            }
            else if (global.prestige.hasOwnProperty(res)){
                let res_cost = costs[res]();
                if (res_cost > 0){
                    if (res === 'Plasmid' && global.race.universe === 'antimatter'){
                        res = 'AntiPlasmid';
                    }
                    let label = loc(`resource_${res}_name`);
                    let color = 'has-text-dark';
                    let aria = '';
                    if (global.prestige[res].count < res_cost){
                        color = 'has-text-danger';
                        aria = ' <span class="is-sr-only">(blocking resource)</span>';
                    }
                    empty = false;
                    cost.append($(`<div class="${color} res-${res}" data-${res}="${res_cost}">${label}: ${res_cost}${aria}</div>`));
                }
            }
            else if (res === 'Supply'){
                let res_cost = costs[res]();
                if (res_cost > 0){
                    let label = loc(`resource_${res}_name`);
                    let color = 'has-text-dark';
                    let aria = '';
                    if (global.portal.purifier.supply < res_cost){
                        color = 'has-text-danger';
                        aria = ' <span class="is-sr-only">(blocking resource)</span>';
                    }
                    empty = false;
                    cost.append($(`<div class="${color} res-${res}" data-${res}="${res_cost}">${label}: ${res_cost}${aria}</div>`));
                }
            }
            else if (res !== 'Morale' && res !== 'Army' && res !== 'Bool'){
                let res_cost = costs[res]();
                if (res_cost > 0){
                    let aria = '';
                    let f_res = res === 'Species' ? global.race.species : res;
                    if (res === 'HellArmy'){
                        let label = loc('fortress_troops');
                        let color = 'has-text-dark';
                        if (global.portal.fortress.garrison - (global.portal.fortress.patrols * global.portal.fortress.patrol_size) < res_cost){
                            if (tc.r === f_res){
                                color = 'has-text-danger';
                                aria = ' <span class="is-sr-only">(blocking resource)</span>';
                            }
                            else {
                                color = 'has-text-alert';
                            }
                        }
                        empty = false;
                        cost.append($(`<div class="${color}" data-${res}="${res_cost}">${label}: ${res_cost}${aria}</div>`));
                    }
                    else if (res === 'Troops'){
                        let label = global.tech['world_control'] && !global.race['truepath'] ? loc('civics_garrison_peacekeepers') : loc('civics_garrison_soldiers');
                        let color = 'has-text-dark';
                        if (garrisonSize() < res_cost){
                            if (tc.r === f_res){
                                color = 'has-text-danger';
                                aria = ' <span class="is-sr-only">(blocking resource)</span>';
                            }
                            else {
                                color = 'has-text-alert';
                            }
                        }
                        empty = false;
                        cost.append($(`<div class="${color}" data-${res}="${res_cost}">${label}: ${res_cost}${aria}</div>`));
                    }
                    else {
                        let label = f_res === 'Money' ? '$' : global.resource[f_res].name+': ';
                        label = label.replace("_", " ");
                        let color = 'has-text-dark';
                        let aria = '';
                        if (global.resource[f_res].amount < res_cost){
                            if (tc.r === f_res){
                                color = 'has-text-danger';
                                aria = ' <span class="is-sr-only">(blocking resource)</span>';
                            }
                            else {
                                color = 'has-text-alert';
                            }
                            if (bres && bres !== res && tc.r === f_res){
                                color += ' grad-from-left';
                                aria = ' <span class="is-sr-only">(first blocking resource)</span>';
                            }
                            else if (bres && bres === res && tc.r !== f_res){
                                color += ' grad-from-left-warn';
                            }
                        }
                        else if (bres && bres === res){
                            color += ' grad-from-right';
                            aria = ' <span class="is-sr-only">(last blocking resource)</span>';
                        }
                        let display_cost = sizeApproximation(res_cost,1);
                        empty = false;
                        cost.append($(`<div class="${color} res-${res}" data-${f_res}="${res_cost}">${label}${display_cost}${aria}</div>`));
                    }
                }
            }
        });
        if (!empty){
            parent.append(cost);
        }
    }
    if (c_action.effect){
        var effect = typeof c_action.effect === 'string' ? c_action.effect : c_action.effect();
        if (effect){
            parent.append($(`<div>${effect}</div>`));
        }
    }
    if (c_action.flair){
        var flair = typeof c_action.flair === 'string' ? c_action.flair : c_action.flair();
        parent.append($(`<div class="flair has-text-flair">${flair}</div>`));
        parent.addClass('flair');
    }

    if (c_action['reqs']){
        let reqList = [];
        Object.keys(c_action.reqs).forEach(function(r){
            let req = $(`#${c_action.id}`).attr(`data-req-${r}`);
            if (req){
                reqList.push(typeof actions.tech[req].title === 'string' ? actions.tech[req].title : actions.tech[req].title());
            }
        });
        if (reqList.length > 0){
            let listing = reqList.join(', ');
            parent.append($(`<div class="has-text-caution">${loc('requires_tech',[listing])}</div>`));
        }
    }

    if (!old && c_action.id.substring(0,5) !== 'blood' && !checkAffordable(c_action) && checkAffordable(c_action,true)){
        if (typeof obj === 'string' && obj === 'notimer'){
            return;
        }
        if (obj && obj['time']){
            parent.append($(`<div id="popTimer" class="flair has-text-advanced">{{ time | timer }}</div>`));
            vBind({
                el: '#popTimer',
                data: obj,
                filters: {
                    timer(t){
                        return loc('action_ready',[t]);
                    }
                }
            });
        }
        else {
            let time = timeFormat(tc.t);
            parent.append($(`<div class="flair has-text-advanced">${loc('action_ready',[time])}</div>`));
        }
    }
    if (c_action.id === 'portal-spire' || (c_action.id === 'portal-waygate' && global.tech.waygate >= 2)){
        if (obj && obj['time']){
            parent.append($(`<div id="popTimer" class="flair has-text-advanced">{{ time | timer }}</div>`));
            vBind({
                el: '#popTimer',
                data: obj,
                filters: {
                    timer(t){
                        let time = !c_action.hasOwnProperty('mscan') || (c_action.hasOwnProperty('mscan') && c_action.mscan() > 0) ? t : '???';
                        return loc('floor_clearing',[time]);
                    }
                }
            });
        }
    }
    if(c_action.id === "portal-devilish_dish"){
        if (obj && obj['time']){
            parent.append($(`<div id="popTimer" class="flair has-text-advanced">{{ time | timer }}</div>`));
            vBind({
                el: '#popTimer',
                data: obj,
                filters: {
                    timer(t){
                        let time = !c_action.hasOwnProperty('mscan') || (c_action.hasOwnProperty('mscan') && c_action.mscan() > 0) ? t : '???';
                        return loc('action_done',[time]);
                    }
                }
            });
        }
    }
}

export function removeAction(id){
    const nodes = $(`[id="${id}"]`);
    if (nodes.length){
        nodes.each((_, el) => clearElement($(el), true));
    }
    clearPopper(id);
}

export function updateDesc(c_action,category,action){
    var id = c_action.id;
    if (global[category] && global[category][action] && global[category][action]['count']){
        if(!c_action.hasOwnProperty('count')){
            $(`#${id} .count`).html(global[category][action].count);
        }
        if (global[category][action] && global[category][action].count > 0){
            $(`#${id} .count`).css('display','inline-block');
            $(`#${id} .special`).css('display','block');
            $(`#${id} .on`).css('display','block');
            $(`#${id} .off`).css('display','block');
        }
    }
    const popper = $('#popper');
    const popId = popper.data('id');
    if (popId === id || (action && popId === `${action}-build-tooltip`)){
        actionDesc(popper,c_action,global[category][action],false,category,action);
    }
}

export function payCosts(c_action, costs){
    costs = costs || adjustCosts(c_action);
    if (checkCosts(costs)){
        Object.keys(costs).forEach(function (res){
            if (global.prestige.hasOwnProperty(res)){
                let cost = costs[res]();
                if (res === 'Plasmid' && global.race.universe === 'antimatter'){
                    res = 'AntiPlasmid';
                }
                global.prestige[res].count -= cost;
            }
            else if (res === 'Supply'){
                let cost = costs[res]();
                global.portal.purifier.supply -= cost;
            }
            else if (res === 'Species'){
                let cost = costs[res]();
                global.resource[global.race.species].amount -= cost;
                // If the default job does not have enough workers, then the main game loop will deplete some other job
                global.civic[global.civic.d_job].workers = Math.max(0, global.civic[global.civic.d_job].workers - cost);
            }
            else if (res !== 'Morale' && res !== 'Army' && res !== 'HellArmy' && res !== 'Troops' && res !== 'Structs' && res !== 'Bool' && res !== 'Custom'){
                let cost = costs[res]();
                global.resource[res].amount -= cost;
                if (res === 'Knowledge'){
                    global.stats.know += cost;
                }
            }
        });
        return true;
    }
    const actionId = getActionId(c_action);
    if (actionId){
        showInsufficientBadge(actionId);
    }
    return false;
}

export function checkAffordable(c_action,max,raw){
    if (c_action.cost){
        let cost = raw ? c_action.cost : adjustCosts(c_action);
        if (max){
            return checkMaxCosts(cost);
        }
        else {
            return checkCosts(cost);
        }
    }
    return true;
}

export function templeCount(zig){
    if (!zig && global.city['temple']){
        let count = global.city.temple.count;
        if (!global.race['cataclysm'] && !global.race['orbit_decayed'] && !global.race['lone_survivor'] && !global.race['warlord']){
            if (global.race['wish'] && global.race['wishStats'] && global.race.wishStats.temple){
                count++;
            }
            if (global.genes.hasOwnProperty('ancients') && global.genes.ancients >= 6){
                count++;
            }
        }
        return count;
    }
    else if (zig && global.space['ziggurat']){
        let count = global.space.ziggurat.count;
        if (!global.race['lone_survivor'] && !global.race['warlord']){
            if (global.race['wish'] && global.race['wishStats'] && global.race.wishStats.zigg){
                count++;
            }
            if (global.genes.hasOwnProperty('ancients') && global.genes.ancients >= 7){
                count++;
            }
        }
        return count;
    }
    return 0;
} 

function checkMaxCosts(costs){
    var test = true;
    Object.keys(costs).forEach(function (res){
        if (res === 'Custom'){
            // Do Nothing
        }
        else if (res === 'Structs'){
            if (!checkStructs(costs[res]())){
                test = false;
                return;
            }
        }
        else if (global.prestige.hasOwnProperty(res)){
            let oRes = res;
            if (res === 'Plasmid' && global.race.universe === 'antimatter'){
                res = 'AntiPlasmid';
            }
            if (global.prestige[res].count < Number(costs[oRes]())){
                test = false;
                return;
            }
        }
        else if (res === 'Bool'){
            if (!costs[res]()){
                test = false;
                return;
            }
        }
        else if (res === 'Morale'){
            if (global.city.morale.current < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'Army'){
            if (armyRating(global.civic.garrison.raid,'army') < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'HellArmy'){
            if (typeof global.portal['fortress'] === 'undefined' || global.portal.fortress.garrison - (global.portal.fortress.patrols * global.portal.fortress.patrol_size) < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'Troops'){
            if (garrisonSize() < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'Supply'){
            if (!global.portal.hasOwnProperty('purifier') || global.portal.purifier.sup_max < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else {
            var testCost = Number(costs[res]()) || 0;
            let f_res = res === 'Species' ? global.race.species : res;
            if ((!global.resource[f_res].display && testCost > 0) || (global.resource[f_res].max >= 0 && testCost > Number(global.resource[f_res].max) && Number(global.resource[f_res].max) !== -1)){
                test = false;
                return;
            }
        }
    });
    return test;
}

export function checkCosts(costs){
    var test = true;
    Object.keys(costs).forEach(function (res){
        if (res === 'Custom'){
            let custom = costs[res]();
            if (!custom.met){
                test = false;
                return;
            }
        }
        else if (res === 'Structs'){
            if (!checkStructs(costs[res]())){
                test = false;
                return;
            }
        }
        else if (global.prestige.hasOwnProperty(res)){
            let oRes = res;
            if (res === 'Plasmid' && global.race.universe === 'antimatter'){
                res = 'AntiPlasmid';
            }
            if (global.prestige[res].count < Number(costs[oRes]())){
                test = false;
                return;
            }
        }
        else if (res === 'Bool'){
            if (!costs[res]()){
                test = false;
                return;
            }
        }
        else if (res === 'Morale'){
            if (global.city.morale.current < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'Army'){
            if (armyRating(global.civic.garrison.raid,'army') < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'HellArmy'){
            if (typeof global.portal['fortress'] === 'undefined' || global.portal.fortress.garrison - (global.portal.fortress.patrols * global.portal.fortress.patrol_size) < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'Troops'){
            if (garrisonSize() < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else if (res === 'Supply'){
            if (!global.portal.hasOwnProperty('purifier') || global.portal.purifier.supply < Number(costs[res]())){
                test = false;
                return;
            }
        }
        else {
            var testCost = Number(costs[res]()) || 0;
            if (testCost === 0){
                return;
            }
            let f_res = res === 'Species' ? global.race.species : res;
            if (testCost > Number(global.resource[f_res].amount) || (global.resource[f_res].max >= 0 && testCost > global.resource[f_res].max)){
                test = false;
                return;
            }
        }
    });
    return test;
}

function checkStructs(structs){
    let test = true;
    Object.keys(structs).forEach(function (region){
        if (global.hasOwnProperty(region)){
            Object.keys(structs[region]).forEach(function (struct){
                if (global[region].hasOwnProperty(struct)){
                    if (global[region][struct].count < structs[region][struct].count){
                        test = false;
                        return;
                    }
                    if (structs[region][struct].hasOwnProperty('on')){
                        let num_on;
                        if (structs[region][struct].hasOwnProperty('s')){
                            const sector = structs[region][struct].s;
                            num_on = getStructNumActive(actions[region][sector][struct]);
                        } else {
                            num_on = getStructNumActive(actions[region][struct]);
                        }
                        if (num_on < structs[region][struct].on){
                            test = false;
                            return;
                        }
                    }
                }
                else {
                    test = false;
                    return;
                }
            });
        }
        else {
            test = false;
            return;
        }
    });
    return test;
}

function conceal_adjust(mana){
    if (global.tech['nexus'] && global.tech['roguemagic'] && global.tech.roguemagic >= 7){
        mana *= 0.96 ** global.tech.nexus;
    }
    return mana;
}

function dirt_adjust(creep){
    let dirtVal = govActive('dirty_jobs',0);
    if (dirtVal){
        creep -= dirtVal;
    }
    return creep;
}

function challengeGeneHeader(){
    let challenge = $(`<div class="challenge"></div>`);
    $('#evolution').append(challenge);
    challenge.append($(`<div class="divider has-text-warning"><h2 class="has-text-danger">${loc('evo_challenge_genes')}</h2></div>`));
    challenge.append($(`<div class="has-text-advanced">${loc('evo_challenge_genes_desc')}</div>`));
    if (global.genes['challenge'] && global.genes['challenge'] >= 2){
        challenge.append($(`<div class="has-text-advanced">${loc('evo_challenge_genes_mastery')}</div>`));
    }
}

function challengeActionHeader(){
    let challenge = $(`<div class="challenge"></div>`);
    $('#evolution').append(challenge);
    challenge.append($(`<div class="divider has-text-warning"><h2 class="has-text-danger">${loc('evo_challenge_run')}</h2></div>`));
    challenge.append($(`<div class="has-text-advanced">${loc('evo_challenge_run_desc')}</div>`));
}

function scenarioActionHeader(){
    let challenge = $(`<div class="challenge"></div>`);
    $('#evolution').append(challenge);
    challenge.append($(`<div class="divider has-text-warning"><h2 class="has-text-danger">${loc('evo_scenario')}</h2></div>`));
    challenge.append($(`<div class="has-text-advanced">${loc('evo_scenario_desc')}</div>`));
}

function exitSimulation(){
    let challenge = $(`<div id="simSection" class="challenge"></div>`);
    $('#evolution').append(challenge);
    challenge.append($(`<div class="divider has-text-warning"><h2 class="has-text-danger">${loc('evo_challenge_simulation')}</h2></div>`));
    challenge.append($(`<div class="has-text-advanced">${loc('evo_challenge_simulation_desc')}</div>`));
    challenge.append($(`<button class="button simButton" @click="exitsim()">${loc(`evo_challenge_end_sim`)}</button>`));

    vBind({
        el: '#simSection',
        data: {},
        methods: {
            exitsim(){
                exitSim();
            }
        }
    });
}

function configSimulation(){
    let challenge = $(`<div id="simSection" class="challenge"></div>`);
    $('#evolution').append(challenge);
    challenge.append($(`<div class="divider has-text-warning"><h2 class="has-text-danger">${loc('evo_challenge_simulation')}</h2></div>`));
    challenge.append($(`<div class="has-text-advanced">${loc('evo_challenge_simulation_desc')}</div>`));

    let config = $($(`<div class="configList"></div>`));
    challenge.append(config);

    if (!global.race['simConfig']){
        global.race['simConfig'] = {};
    }
    ['Plasmid','AntiPlasmid','Phage','Dark','Harmony','AICore','Artifact','Blood_Stone'].forEach(function (res){
        global.race.simConfig[res] = global.race.simConfig[res] || 0;
        config.append($(`<div><span class="has-text-warning">${loc(`resource_${res}_name`)}</span><input type="number" min="0" class="input" v-model="${res}"></div>`));
    });

    vBind({
        el: '#simSection',
        data: global.race.simConfig
    });
}

function drawModal(c_action,type){
    let title = typeof c_action.title === 'string' ? c_action.title : c_action.title();
    $('#modalBox').append($(`<p id="modalBoxTitle" class="has-text-warning modalTitle">${title}</p>`));

    var body = $('<div id="specialModal" class="modalBody"></div>');
    $('#modalBox').append(body);

    switch(type){
        case 'smelter':
        case 'hell_smelter':
        case 'stellar_forge':
        case 'hell_forge':
        case 'demon_forge':
        case 'sacred_smelter':
        case 'geothermal':
        case 'ore_refinery':
            loadIndustry('smelter',body);
            break;
        case 'factory':
        case 'red_factory':
        case 'int_factory':
        case 'tau_factory':
        case 'hell_factory':
            loadIndustry('factory',body);
            break;
        case 'star_dock':
            starDockModal(body);
            break;
        case 'mining_droid':
            loadIndustry('droid',body);
            break;
        case 'g_factory':
        case 'refueling_station':
        case 'twisted_lab':
            loadIndustry('graphene',body);
            break;
        case 'freighter':
        case 'super_freighter':
            galacticTrade(body);
            break;
        case 'pylon':
            loadIndustry('pylon',body);
            break;
        case 'rock_quarry':
            loadIndustry('rock_quarry',body);
            break;
        case 'titan_mine':
            loadIndustry('titan_mine',body);
            break;
        case 'mining_ship':
            loadIndustry('mining_ship',body);
            break;
        case 'alien_space_station':
            loadIndustry('alien_space_station',body);
            break;
        case 'nanite_factory':
            loadIndustry('nanite_factory',body);
            break;
        case 'alien_outpost':
            loadIndustry('replicator',body);
            break;
        case 'mech_station':
            loadIndustry('mech_station',body);
            break;
    }
}

function starDockModal(modal){
    if (global.tech['genesis'] < 4){
        let warn = $(`<div><span class="has-text-warning">${loc('stardock_warn')}</span></div>`);
        modal.append(warn);
        return;
    }

    let dock = $(`<div id="starDock" class="actionSpace"></div>`);
    modal.append(dock);

    let c_action = actions.starDock.probes;
    setAction(c_action,'starDock','probes');

    if (global.tech['geck'] && global.stats.achieve['lamentis'] && global.stats.achieve.lamentis.l >= 5){
        let c_action = actions.starDock.geck;
        setAction(c_action,'starDock','geck');
    }

    if (global.tech['genesis'] >= 5){
        let c_action = actions.starDock.seeder;
        setAction(c_action,'starDock','seeder');
    }

    if (global.tech['genesis'] === 6){
        let c_action = actions.starDock.prep_ship;
        setAction(c_action,'starDock','prep_ship');
    }

    if (global.tech['genesis'] >= 7){
        let c_action = actions.starDock.launch_ship;
        setAction(c_action,'starDock','launch_ship');
    }
}

export function orbitDecayed(){
    if (global.race['orbit_decay'] && global.stats.hasOwnProperty('days') && global.stats.days >= global.race['orbit_decay'] && !global.race['orbit_decayed']){
        global.race['orbit_decayed'] = true;

        if (global.race['tidal_decay']){
            messageQueue(loc('planet_kamikaze_msg'),'info',false,['progress']);
        }
        else {
            messageQueue(loc('evo_challenge_orbit_decayed_msg',[races[global.race.species].home]),'info',false,['progress']);
        }

        if (global.race.universe === 'magic'){
            if (global.city['pylon']){
                global.space['pylon'] = { count: Math.ceil(global.city.pylon.count / 2) };
            }
            cancelRituals();
        }

        Object.keys(actions.city).forEach(function (k){
            if (global.city.hasOwnProperty(k) && global.city[k].hasOwnProperty('count')){
                if (global.race['hooved']){
                    if (actions.city[k].cost.hasOwnProperty('Horseshoe')){
                        global.race['shoecnt'] -= actions.city[k].cost.Horseshoe() * global.city[k].count;
                    }
                }
                global.city[k].count = 0;
                if (global.city[k].hasOwnProperty('on')){
                    global.city[k].on = 0;
                }
            }
        });

        if (global.race['hooved'] && global.race['shoecnt'] < 5){
            global.race.shoecnt = 5;
        }
        if (global.resource.Zen.display){
            global.resource.Zen.display = false;
        }
        if (global.resource.Slave.display){
            global.resource.Slave.display = false;
            global.resource.Slave.amount = 0;
            removeTask('slave');
            defineGovernor();
        }
        if (global.race['deconstructor']){
            nf_resources.forEach(function (res){
                global.city.nanite_factory[res] = 0;
            });
        }
        Object.keys(global.resource).forEach(function (res){
            if (global.resource[res].hasOwnProperty('trade')){
                global.resource[res].trade = 0;
            }
        });

        global.space['red_university'] = { count: 0 };

        Object.keys(actions.space.spc_moon).forEach(function (k){
            if (global.space.hasOwnProperty(k) && global.space[k].hasOwnProperty('count')){
                global.space[k].count = 0;
                if (global.space[k].hasOwnProperty('on')){
                    global.space[k].on = 0;
                }
            }
        });

        Object.keys(job_desc).forEach(function (job){
            if (job !== 'colonist'){
                global.civic[job].workers = 0;
                global.civic[job].assigned = 0;
            }
        });

        ['bolognium_ship','scout_ship','corvette_ship','frigate_ship','cruiser_ship','dreadnought','freighter','super_freighter','armed_miner','scavenger'].forEach(function(ship){
            if (global.galaxy[ship]){
                global.galaxy[ship].on = 0;
            }
        });
        if (global.portal['transport']){
            global.portal.transport.on = 0;
        }

        ['forager','farmer','lumberjack','quarry_worker'].forEach(function (job){
            global.civic[job].display = false;
        });

        if (global.civic.hunter.display){
            global.civic.d_job = 'hunter';
        }
        else {
            global.civic.d_job = 'unemployed';
        }

        for (let building of Object.values(global.race.purgatory.city)){
            if (building.hasOwnProperty('count')){
                building.count = 0;
            }
            if (building.hasOwnProperty('on')){
                building.on = 0;
            }
        }
        if (global.queue.hasOwnProperty('queue')){
            for (let i = global.queue.queue.length-1; i >= 0; i--){
                let item = global.queue.queue[i];
                if (item.action === 'city' || (item.action === 'space' && actions.space.spc_moon[item.type])){
                    global.queue.queue.splice(i,1);
                }
            }
        }

        if (global.arpa['sequence']){
            global.arpa.sequence.on = false;
            global.arpa.sequence.boost = false;
        }

        global.city.calendar.moon = 0;
        document.getElementById('moon').removeAttribute('class');
        $('#moon').addClass('moon wi wi-moon-new');

        global.settings.spaceTabs = 1;
        global.settings.space.moon = false;
        global.settings.showCity = false;

        clearElement($(`#infoTimer`));

        renderSpace();
    }
}

function resolveEvolutionStepIcon(stepKey){
    const step = actions.evolution[stepKey];
    if (!step || !step.class){
        return '';
    }
    const className = typeof step.class === 'function' ? step.class() : step.class;
    if (!className || !global.evolution){
        return '';
    }
    if (!global.evolution.iconCache){
        global.evolution.iconCache = {};
    }
    if (global.evolution.iconCache[className]){
        return global.evolution.iconCache[className];
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'action';
    wrapper.style.position = 'absolute';
    wrapper.style.visibility = 'hidden';
    wrapper.style.pointerEvents = 'none';
    const probe = document.createElement('a');
    probe.className = `button is-dark ${className}`;
    wrapper.appendChild(probe);
    const mount = document.querySelector('#evolution') || document.body;
    mount.appendChild(wrapper);
    const backgroundImage = window.getComputedStyle(probe).backgroundImage || '';
    wrapper.remove();
    const match = /url\(["']?(.*?)["']?\)/.exec(backgroundImage);
    if (match && match[1]){
        global.evolution.iconCache[className] = match[1];
        return match[1];
    }
    if (!global.evolution.iconMissing){
        global.evolution.iconMissing = {};
    }
    if (!global.evolution.iconMissing[className]){
        global.evolution.iconMissing[className] = true;
        console.warn(`Missing evolution icon for ${className}`);
    }
    return '';
}

function buildEvolutionStepTooltip(stepKey){
    const step = actions.evolution[stepKey];
    if (!step){
        return '';
    }
    const title = typeof step.title === 'function' ? step.title() : step.title;
    const desc = typeof step.desc === 'function' ? step.desc() : step.desc;
    const effect = step.effect ? (typeof step.effect === 'function' ? step.effect() : step.effect) : '';
    const tooltip = $('<div class="evo-step-tooltip"></div>');
    if (title){
        tooltip.append(`<div class="evo-step-tooltip-title">${title}</div>`);
    }
    if (desc){
        tooltip.append(`<div class="evo-step-tooltip-desc">${desc}</div>`);
    }
    if (effect){
        tooltip.append(`<div class="evo-step-tooltip-effect">${effect}</div>`);
    }
    return tooltip;
}

export function evoProgress(){
    clearElement($('#evolution .evolving'),true);
    const evoProgress = global.evolution.final || 0;
    const stepKeys = [];
    const routeSteps = Array.isArray(global.evolution.route) ? global.evolution.route : [];
    const pushUniqueStep = (key) => {
        if (!stepKeys.includes(key)){
            stepKeys.push(key);
        }
    };
    if (global.tech['evo'] && global.tech.evo >= 2){
        pushUniqueStep('sexual_reproduction');
    }
    if (global.tech['evo_animal']){
        pushUniqueStep('phagocytosis');
    }
    if (global.tech['evo_plant']){
        pushUniqueStep('chloroplasts');
    }
    if (global.tech['evo_fungi']){
        pushUniqueStep('chitin');
    }
    routeSteps.forEach(pushUniqueStep);
    const stepMarkup = stepKeys
        .map((stepKey) => {
            const step = actions.evolution[stepKey];
            if (!step){
                return '';
            }
            const icon = resolveEvolutionStepIcon(stepKey);
            if (!icon){
                return '';
            }
            const label = typeof step.title === 'function'
                ? step.title()
                : step.title;
            const stepId = `evo-route-${stepKey}`;
            return `
                <div class="evolving-step-image" id="${stepId}" aria-label="${label}">
                    <img src="${icon}" alt="${label}">
                </div>
            `;
        })
        .join('');
    const stepWrap = stepMarkup ? `<div class="evolving-step-wrap">${stepMarkup}</div>` : '';
    let progress = $(`
        <div class="evolving" style="--evo-progress: ${Math.min(Math.max(evoProgress / 100, 0), 1)}">
            <div class="evolving-frame" aria-hidden="true">
                <div class="evolving-fill"></div>
                <div class="evolving-grid"></div>
                <div class="evolving-label">
                    <div class="evolving-title">${loc('evo_progress_protocol',[evoProgress])}</div>
                </div>
            </div>
            ${stepWrap}
            <progress class="progress" value="${evoProgress}" max="100">${evoProgress}%</progress>
        </div>
    `);
    $('#evolution').append(progress);

    stepKeys.forEach((stepKey) => {
        const stepId = `#evo-route-${stepKey}`;
        if (!$(stepId).length){
            return;
        }
        popover(`evoRoute-${stepKey}`, () => buildEvolutionStepTooltip(stepKey), {
            elm: stepId,
            placement: 'top',
            bind_mouse_enter: true,
            self: true
        });
    });
}

export function wardenLabel(){
    if (global.race.universe === 'magic'){
        return loc('city_wizard_tower_title');
    }
    else {
        return global.race['evil'] ? loc('city_babel_title') : loc('city_wardenclyffe');
    }
}

function basicHousingLabel(){
    let halloween = eventActive('halloween');
    if (halloween.active){
        return loc(`events_halloween_basic_house`);
    }

    switch (global.race.species){
        case 'orc':
            return loc('city_basic_housing_orc_title');
        case 'wolven':
            return loc('city_basic_housing_wolven_title');
        case 'sporgar':
            return loc('city_basic_housing_sporgar_title');
        case 'dracnid':
            return loc('city_basic_housing_title7');
        case 'balorg':
            return loc('city_basic_housing_title7');
        case 'imp':
            return loc('city_basic_housing_title8');
        case 'seraph':
            return loc('city_basic_housing_seraph_title');
        case 'unicorn':
            return loc('city_basic_housing_unicorn_title');
    }

    switch (global.race.maintype || races[global.race.species].type){
        case 'avian':
            return loc('city_basic_housing_nest_title');
        case 'plant':
            return loc('city_basic_housing_entish_title');
        case 'sand':
            return loc('city_basic_housing_sand_title');
        case 'polar':
            return loc('city_basic_housing_polar_title');
        case 'eldritch':
            return loc('city_basic_housing_eldritch_title');
    }

    return global.city.ptrait.includes('trashed') ? loc('city_basic_housing_trash_title') : loc('city_basic_housing_title');
}

function mediumHousingLabel(){
    let halloween = eventActive('halloween');
    if (halloween.active){
        return loc(`events_halloween_medium_house`);
    }

    switch (global.race.species){
        case 'sporgar':
            return loc('city_cottage_title2');
        case 'balorg':
            return loc('city_cottage_title3');
        case 'imp':
            return loc('city_basic_housing_title7');
        case 'seraph':
            return loc('city_cottage_title4');
        case 'unicorn':
            return loc('city_cottage_title5');
        case 'dracnid':
            return loc('city_cottage_title7');
    }

    switch (global.race.maintype || races[global.race.species].type){
        case 'avian':
            return loc('city_cottage_title6');
        case 'eldritch':
            return loc('city_cottage_title8');
    }

    return loc('city_cottage_title1');
}

function largeHousingLabel(basic){
    let halloween = eventActive('halloween');
    if (halloween.active){
        return loc(`events_halloween_large_house`);
    }

    if (!basic && govActive('extravagant',0)){
        return loc(`city_mansion`);
    }

    switch (global.race.species){
        case 'sporgar':
            return loc('city_apartment_title2');
    }

    switch (global.race.maintype || races[global.race.species].type){
        case 'avian':
            return loc('city_apartment_title5');
        case 'sand':
            return loc('city_apartment_title6');
        case 'demonic':
            return loc('city_apartment_title3');
        case 'angelic':
            return loc('city_apartment_title4');
        case 'giant':
            return loc('city_apartment_title7');
        case 'eldritch':
            return loc('city_apartment_title8');
    }

    return loc('city_apartment_title1');
}

export function housingLabel(type,flag){
    switch (type){
        case 'small':
            return basicHousingLabel();
        case 'medium':
            return mediumHousingLabel();
        case 'large':
            return largeHousingLabel(flag);
    }
}

export function structName(type){
    let halloween = eventActive('halloween');

    switch (type){
        case 'casino':
        {
            return halloween.active ? loc(`events_halloween_casino`) : (global.race['warlord'] ? loc(`portal_casino`) : loc(`city_casino`));
        }
        case 'farm':
        {
            return halloween.active ? loc(`events_halloween_farm`) : loc(`city_farm`);
        }
        case 'dormitory':
        {
            return halloween.active ? loc(`events_halloween_dorm`) : loc(`galaxy_dormitory`);
        }
        case 'mine':
        {
            return halloween.active ? loc(`events_halloween_mine`) : loc('city_mine');
        }
        case 'coal_mine':
        {
            return halloween.active ? loc(`events_halloween_coal_mine`) : loc('city_coal_mine');
        }
        case 'lumberyard':
        {
            return halloween.active ? loc(`events_halloween_lumberyard`) : loc('city_lumber_yard');
        }
        case 'sawmill':
        {
            return halloween.active ? loc(`events_halloween_sawmill`) : loc('city_sawmill');
        }
        case 'hospital':
        {
            return halloween.active ? loc(`events_halloween_hospital`) : loc('city_hospital');
        }
        case 'windmill':
        {
            return halloween.active ? loc(`events_halloween_windmill`) : loc('city_mill_title2');
        }
        case 'factory':
        {
            return halloween.active ? loc(`events_halloween_factory`) : loc('city_factory');
        }
        case 'storage_yard':
        {
            return halloween.active ? loc(`events_halloween_storage_yard`) : loc('city_storage_yard');
        }
        case 'temple':
        {
            return halloween.active ? loc(`events_halloween_temple`) : (global.race.universe === 'evil' && global.civic.govern.type != 'theocracy' ? loc('city_propaganda') : loc('city_temple'));
        }
    }
}

export function updateQueueNames(both, items){
    if (global.tech['queue'] && global.queue.display){
        let deepScan = ['space','interstellar','galaxy','portal','tauceti'];
        for (let i=0; i<global.queue.queue.length; i++){
            let currItem = global.queue.queue[i];
            if (!items || items.indexOf(currItem.id) > -1){
                if (deepScan.includes(currItem.action)){
                    let scan = true; Object.keys(actions[currItem.action]).forEach(function (region){
                        if (actions[currItem.action][region][currItem.type] && scan){
                            global.queue.queue[i].label = 
                                typeof actions[currItem.action][region][currItem.type].title === 'string' ? 
                                actions[currItem.action][region][currItem.type].title : 
                                actions[currItem.action][region][currItem.type].title();
                            scan = false;
                        }
                    });
                }
                else if (actions[currItem.action]?.[currItem.type]){
                    global.queue.queue[i].label = 
                        typeof actions[currItem.action][currItem.type].title === 'string' ? 
                        actions[currItem.action][currItem.type].title : 
                        actions[currItem.action][currItem.type].title();
                }
            }
        }
    }
    if (both && global.tech['r_queue'] && global.r_queue.display){
        for (let i=0; i<global.r_queue.queue.length; i++){
            global.r_queue.queue[i].label = 
                typeof actions.tech[global.r_queue.queue[i].type].title === 'string' ? 
                actions.tech[global.r_queue.queue[i].type].title : 
                actions.tech[global.r_queue.queue[i].type].title();
        }
    }
}

export function initStruct(c_action){
    let path = c_action.struct().p;
    if (!global[path[1]].hasOwnProperty(path[0])){
        global[path[1]][path[0]] = deepClone(c_action.struct().d);
    }
}

function evoExtraState(race){
    if ((race === 'synth' || (race === 'custom' && global.custom.race0.traits.includes('imitation')) || (race === 'hybrid' && global.custom.race1.traits.includes('imitation'))) && Object.keys(global.stats.synth).length > 1){
        global.race['evoFinalMenu'] = race;
        drawEvolution();
        return true;
    }
    else {
        global.race.species = race;
        sentience();
    }
}

function getSentienceAllowedRaces(){
    if (evolutionBranchLock && evolutionBranchLock.species){
        return [evolutionBranchLock.species];
    }
    let allowed = [];
    let type = 'humanoid';
    for (let genus in genus_def){
        if (global.tech[`evo_${genus}`] && global.tech[`evo_${genus}`] >= 2){
            type = genus;
            break;
        }
    }

    if (global.race['junker'] || global.race['sludge'] || global.race['ultra_sludge']){
        let race = global.race['sludge'] ? 'sludge' : (global.race['ultra_sludge'] ? 'ultra_sludge' : 'junker');
        global.race['jtype'] = type;
        allowed.push(race);
        return allowed;
    }

    for (let idx in raceList){
        let id = raceList[idx];
        if (races[id] && races[id].type === type){
            allowed.push(id);
        }
    }

    return allowed;
}

function pickSentienceRandomRace(allowed){
    if (!allowed.length){
        return null;
    }
    let choice = allowed[Math.floor(seededRandom(0, allowed.length))];
    if (global.stats.achieve[`extinct_${choice}`] && global.stats.achieve[`extinct_${choice}`].l >= 1){
        choice = allowed[Math.floor(seededRandom(0, allowed.length))];
    }
    return choice;
}

function getSentienceRaceName(race){
    const entry = races[race];
    if (!entry){
        return race;
    }
    return typeof entry.name === 'string' ? entry.name : entry.name();
}

function getSentienceRaceImage(race){
    const explicitPaths = {
        human: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/humanoids/human.webp',
        orc: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/humanoids/orc.webp',
        elven: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/humanoids/elf.webp',
        troll: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/gigantism/troll.webp',
        ogre: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/gigantism/ogre.webp',
        cyclops: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/gigantism/cyclops.webp',
        kobold: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/dwarfism/kobold.webp',
        goblin: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/dwarfism/goblin.webp',
        gnome: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/dwarfism/gnome.webp',
        carnivore: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/carnivore.webp',
        herbivore: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/herbivore.webp',
        cath: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/carnivore/cath.webp',
        wolven: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/carnivore/wolven.webp',
        vulpine: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/carnivore/vulpine.webp',
        centaur: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/herbivore/centaur.webp',
        rhinotaur: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/herbivore/rhinotaur.webp',
        capybara: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/mammals/mammals/beast/herbivore/capybara.webp',
        mantis: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/arthropods/athropods/mantis.webp',
        scorpid: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/arthropods/athropods/scorpid.webp',
        antid: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/arthropods/athropods/antid.webp',
        arraak: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/eggshell/eggshell/endothermic/arraak.webp',
        pterodacti: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/eggshell/eggshell/endothermic/pterodacti.webp',
        dracnid: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/eggshell/eggshell/endothermic/dracnid.webp',
        sporgar: '/photo/sexual-reproduction/multicellular/spores/bryophyte/bryophyte/sporgar.webp',
        shroomi: '/photo/sexual-reproduction/multicellular/spores/bryophyte/bryophyte/shroomi.webp',
        moldling: '/photo/sexual-reproduction/multicellular/spores/bryophyte/bryophyte/moldling.webp',
        tortoisan: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/eggshell/eggshell/ectothermic/tortoisan.webp',
        gecko: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/eggshell/eggshell/ectothermic/gecko.webp',
        slitheryn: '/photo/sexual-reproduction/multicellular/bilateral-symmetry/eggshell/eggshell/ectothermic/slitheryn.webp'
    };
    if (explicitPaths[race]){
        return explicitPaths[race];
    }
    const slugMap = {
        random: 'ramdom-race',
        entish: 'ent',
        cacti: 'cacti',
        pinguicula: 'pinguicula'
    };
    const slug = slugMap[race];
    if (!slug){
        return null;
    }
    return `/photo/sexual-reproduction/multicellular/poikilohydric/pinguicla/${slug}.webp`;
}

function buildSentienceButton(label, imagePath, clickHandler, extraClass, id){
    const btn = $(`<button class="button is-small${extraClass ? ` ${extraClass}` : ''}"></button>`);
    if (id){
        btn.attr('id', id);
    }
    btn.attr('@click', clickHandler);
    btn.attr('aria-label', label);
    if (imagePath){
        const img = $(`<img class="sentience-icon" src="${imagePath}" alt="${label}" loading="eager" decoding="async">`);
        let resolved = false;
        const markLoaded = () => {
            if (resolved){
                return;
            }
            resolved = true;
            btn.removeClass('sentience-image-loading');
            img.removeClass('is-loading');
        };
        const markError = () => {
            if (resolved){
                return;
            }
            resolved = true;
            btn.removeClass('sentience-image-loading');
            img.removeClass('is-loading');
            btn.addClass('sentience-image-error');
        };
        btn.addClass('sentience-image-loading');
        img.addClass('is-loading');
        img.on('load', markLoaded);
        img.on('error', markError);
        btn.append(img);
        const imgEl = img[0];
        if (imgEl && imgEl.complete){
            if (imgEl.naturalWidth > 0){
                markLoaded();
            }
            else {
                markError();
            }
        }
        else if (imgEl && typeof imgEl.decode === 'function'){
            imgEl.decode().then(markLoaded).catch(markError);
        }
        btn.append($(`<span class="sentience-label" aria-hidden="true">${label}</span>`));
    }
    else {
        btn.text(label);
    }
    return btn;
}

function getSentienceRaceTypeLabel(race){
    if (race === 'random'){
        return loc('race_random_type');
    }
    const entry = races[race];
    if (!entry || !entry.type){
        return '';
    }
    const key = `genelab_genus_${entry.type}`;
    const label = loc(key);
    return label === key ? entry.type : label;
}

function getSentienceRaceDescription(race, allowed){
    if (race === 'random'){
        if (Array.isArray(allowed) && allowed.length === 3 && allowed.includes('entish') && allowed.includes('cacti') && allowed.includes('pinguicula')){
            return loc('race_random_desc', [
                loc('race_entish'),
                loc('race_cacti'),
                loc('race_pinguicula')
            ]);
        }
        return loc('race_random_desc_generic');
    }
    const key = `race_${race}_desc`;
    const desc = loc(key);
    if (desc !== key){
        return desc;
    }
    const entry = races[race];
    if (entry && entry.desc){
        return typeof entry.desc === 'string' ? entry.desc : entry.desc();
    }
    return '';
}

function buildSentienceTooltip(race, allowed){
    const name = race === 'random' ? loc('random_race') : getSentienceRaceName(race);
    const type = getSentienceRaceTypeLabel(race);
    const desc = getSentienceRaceDescription(race, allowed);
    const tooltip = $('<div class="sentience-tooltip"></div>');
    tooltip.append(`<div class="sentience-tooltip-name">${name}</div>`);
    if (type){
        tooltip.append(`<div class="sentience-tooltip-type has-text-warning">${type}</div>`);
    }
    if (desc){
        tooltip.append(`<div class="sentience-tooltip-desc">${desc}</div>`);
    }
    return tooltip;
}

function attachSentienceTooltip(race, allowed){
    const id = `sentience-race-${race}`;
    const popId = `sentience-tooltip-${race}`;
    popover(popId, () => buildSentienceTooltip(race, allowed), {
        elm: `#${id}`,
        placement: 'bottom',
        bind_mouse_enter: true,
        self: true
    });
}

function clearSentienceSelector(){
    clearPopper();
    clearElement($('#evolution-sentience-select'), true);
}

function resetSentienceSelection(){
    sentienceSelecting = false;
    sentiencePendingCosts = null;
    sentiencePendingAllowed = null;
    sentienceAutoScroll = false;
    clearSentienceSelector();
}

function finalizeSentienceChoice(race){
    if (!race){
        resetSentienceSelection();
        drawEvolution();
        return;
    }
    const costs = sentiencePendingCosts || adjustCosts(actions.evolution.sentience);
    if (!payCosts(false, costs)){
        showInsufficientBadge('evolution-sentience');
        resetSentienceSelection();
        drawEvolution();
        return;
    }
    global.race.species = race;
    resetSentienceSelection();
    sentience();
}

function maybeScrollSentienceSelector(container){
    if (sentienceAutoScroll){
        return;
    }
    const element = container && container.length ? container[0] : null;
    if (!element || typeof element.scrollIntoView !== 'function'){
        return;
    }
    const isTouch = 'ontouchstart' in document.documentElement;
    const isSmallViewport = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    if (!isTouch && !isSmallViewport){
        return;
    }
    sentienceAutoScroll = true;
    element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
}

function renderSentienceSelector(){
    clearSentienceSelector();
    if (!sentienceSelecting){
        return;
    }
    const allowed = sentiencePendingAllowed || getSentienceAllowedRaces();
    if (!allowed.length){
        resetSentienceSelection();
        drawEvolution();
        return;
    }

    const container = $(`<div id="evolution-sentience-select" class="action"></div>`);
    container.append($(`<div class="header has-text-warning">${loc('select_race')}</div>`));
    const list = $('<div class="sentience-selection"></div>');
    const allowRandom = !evolutionBranchLock?.species && allowed.length > 1;
    if (allowRandom){
        const randomLabel = loc('random_race');
        list.append(buildSentienceButton(
            randomLabel,
            getSentienceRaceImage('random'),
            'pickRandom',
            'is-warning',
            'sentience-race-random'
        ));
    }

    allowed.forEach(function (race){
        const label = getSentienceRaceName(race);
        list.append(buildSentienceButton(
            label,
            getSentienceRaceImage(race),
            `pick('${race}')`,
            '',
            `sentience-race-${race}`
        ));
    });

    container.append(list);

    const evolution = $('#evolution');
    const progress = evolution.find('.evolving').last();
    if (progress.length){
        progress.before(container);
    }
    else {
        evolution.append(container);
    }

    maybeScrollSentienceSelector(container);

    vBind({
        el: '#evolution-sentience-select',
        methods: {
            pick(race){
                finalizeSentienceChoice(race);
            },
            pickRandom(){
                finalizeSentienceChoice(pickSentienceRandomRace(allowed));
            }
        }
    });

    if (allowRandom){
        attachSentienceTooltip('random', allowed);
    }
    allowed.forEach(function (race){
        attachSentienceTooltip(race, allowed);
    });
}

function resetCivicJobsForSentience(){
    Object.keys(job_desc).forEach(function(job){
        const entry = global.civic?.[job];
        if (!entry){
            return;
        }
        entry.display = false;
        entry.workers = 0;
        if (Object.prototype.hasOwnProperty.call(entry, 'assigned')){
            entry.assigned = 0;
        }
    });
}

function sentience(){
    playEvolutionCompleteSfx();
    if (global.race['simulation']){
        simulation();
    }
    if (global['sim']){
        global.settings.showGenetics = true;
        global.settings.arpa.physics = false;
        global.settings.arpa.crispr = true;
        global.settings.arpa.arpaTabs = 2;
    }

    if (global.resource.hasOwnProperty('RNA')){
        global.resource.RNA.display = false;
    }
    if (global.resource.hasOwnProperty('DNA')){
        global.resource.DNA.display = false;
    }

    if (global.race.species === 'junker' || global.race.species === 'sludge' || global.race.species === 'ultra_sludge'){
        setJType();
    }
    if (global.race.species !== 'junker'){
        delete global.race['junker'];
    }
    if (global.race.species !== 'sludge'){
        delete global.race['sludge'];
    }
    if (global.race.species !== 'ultra_sludge'){
        delete global.race['ultra_sludge'];
    }

    var evolve_actions = ['rna','dna','membrane','organelles','nucleus','eukaryotic_cell','mitochondria'];
    for (var i = 0; i < evolve_actions.length; i++) {
        if (global.race[evolve_actions[i]]){
            clearElement($('#'+actions.evolution[evolve_actions[i]].id),true);
            clearPopper(actions.evolution[evolve_actions[i]].id);
        }
    }

    if (global.race['warlord']){
        let trait = races[global.race.species].fanaticism;
        global.race['absorbed'] = [global.race.species];
        global.race['origin'] = global.race.species;
        global.race.species = 'hellspawn';
        if (trait === 'kindling_kindred'){ trait = 'iron_wood'; }
        setTraitRank(trait, { set: 0.5 });
    }
    else {
        let typeList = global.stats.achieve['godslayer'] && races[global.race.species].type === 'hybrid' ? races[global.race.species].hybrid : [races[global.race.species].type];
        typeList.forEach(function(type){
            Object.keys(genus_def[type].traits).forEach(function (trait) {
                let mainspec = global.tech[`evo_${type}`] >= 2 ? true : false;
                if (mainspec){
                    global.race['maintype'] = type;
                    setTraitRank(trait,{ set: genus_def[type].traits[trait] });
                    if (global.stats.achieve['pathfinder'] && global.stats.achieve.pathfinder.l >= 4){
                        setTraitRank(trait);
                    }
                }
                else {
                    setTraitRank(trait,{ set: genus_def[type].traits[trait] });
                    setTraitRank(trait, {down:true});
                }
            });
        });

        Object.keys(races[global.race.species].traits).forEach(function (trait) {
            setTraitRank(trait,{ set: races[global.race.species].traits[trait] });
        });

        if (global.race['evil'] && global.race['maintype'] && global.race.maintype === 'angelic'){
            delete global.race['evil'];
        }

        if (global.race['imitation'] && global.race['srace']){
            setImitation(false);
        }
    }
    if(!global.race.inactiveTraits){
        global.race.inactiveTraits = {};
    }
    combineTraits();

    Object.keys(global.tech).forEach(function (tech){
        if (tech.substring(0,4) === 'evo_'){
            delete global.tech[tech];
        }
    });
    delete global.tech['evo'];
    global.evolution = {};

    if (global.race['ocular_power']){
        global.settings.showWish = true;
        global.race['ocularPowerConfig'] = {
            d: false, p: false, w: false, t: false, f: false, c: false, ds: 0
        };
        renderSupernatural();
    }

    const date = new Date();
    if (!global.settings.boring && date.getMonth() === 11 && date.getDate() >= 17){
        if (global.race.species === 'elven'){
            setTraitRank('slaver',{ set: 2 });
            setTraitRank('resourceful',{ set: 0.5 });
            setTraitRank('small',{ set: 0.25 });
        }
        else if (global.race.species === 'capybara'){
            setTraitRank('beast_of_burden',{ set: 1 });
            setTraitRank('pack_rat',{ set: 0.5 });
            setTraitRank('musical',{ set: 0.25 });
        }
        else if (global.race.species === 'centaur'){
            setTraitRank('beast_of_burden',{ set: 1 });
            setTraitRank('curious',{ set: 0.5 });
            setTraitRank('blissful',{ set: 0.25 });
        }
        else if (global.race.species === 'wendigo'){
            setTraitRank('immoral',{ set: 3 });
            setTraitRank('cannibalize',{ set: 0.5 });
            setTraitRank('claws',{ set: 0.25 });
        }
        else if (global.race.species === 'yeti'){
            setTraitRank('scavenger',{ set: 3 });
            setTraitRank('regenerative',{ set: 0.5 });
            setTraitRank('musical',{ set: 0.25 });
        }
        else if (global.race.species === 'entish'){
            setTraitRank('photosynth',{ set: 3 });
            setTraitRank('optimistic',{ set: 0.5 });
            setTraitRank('armored',{ set: 0.25 });
        }
    }

    const easter = eventActive('easter');
    if (global.race.species === 'wolven' && easter.active){
        setTraitRank('hyper',{ set: 1 });
        setTraitRank('fast_growth',{ set: 1 });
        setTraitRank('rainbow',{ set: 1 });
        setTraitRank('optimistic',{ set: 1 });
    }
    else if (global.race.species === 'vulpine' && easter.active){
        setTraitRank('cannibalize',{ set: 2 });
        setTraitRank('rage',{ set: 1 });
        setTraitRank('blood_thirst',{ set: 1 });
        setTraitRank('sticky',{ set: 1 });
    }

    const hallowed = getHalloween();
    if (global.race.species === 'unicorn' && hallowed.active){
        setTraitRank('gloomy',{ set: 1 });
        setTraitRank('darkness',{ set: 1 });
        delete global.race['rainbow'];
    }
    else if (global.race.species === 'human' && hallowed.active){
        setTraitRank('anthropophagite',{ set: 1 });
        setTraitRank('cannibalize',{ set: 2 });
        setTraitRank('infectious',{ set: 3 });
    }
    else if (global.race.species === 'tortoisan' && hallowed.active){   
        setTraitRank('hyper',{ set: 0.25 });
        setTraitRank('swift',{ set: 0.5 });
        setTraitRank('infiltrator',{ set: 1 });
        delete global.race['slow'];
    }

    if (global.race['no_crispr'] || global.race['badgenes']){
        let repeat = global.race['badgenes'] ? 3 : 1;
        for (let j=0; j<repeat; j++){
            for (let i=0; i<10; i++){
                let trait = neg_roll_traits[Math.rand(0,neg_roll_traits.length)];
                if (global.race[trait]){
                    if (global.race[trait] == 0.25){
                        continue;
                    }
                    setTraitRank(trait,{down:true});
                    if (j === 0 && global.race['badgenes']){
                        setTraitRank(trait,{down:true});
                    }
                    break;
                }
                else if ((global.race['smart'] && trait === 'dumb')) {
                    continue;
                }
                if (!global.race[trait]){
                    let rank = 1;
                    if (global.race['badgenes']){
                        rank = j === 0 ? 0.5 : 2;
                    }
                    global.race[trait] = rank;
                    break;
                }
            }
        }
    }

    if (global.race.universe === 'evil'){
        if (global.race['evil']){
            delete global.race['evil'];
        }
        else if (races[global.race.species].type !== 'angelic'){
            global.race['evil'] = 1;
        }
    }
    else if (global.race.universe === 'antimatter' && (!global.stats.feat['annihilation'] || global.stats.feat['annihilation'] < alevel())){
        global.race['amexplode'] = 1;
    }

    if (global.race['unified']){
        global.tech['world_control'] = 1;
        global.tech['unify'] = 2;
    }

    if (global.race['orbit_decay']){
        global.race['orbit_decay'] = 5000;

        popover(`infoTimer`, function(){
            return global.race['orbit_decayed'] ? '' : loc('evo_challenge_orbit_decay_impact',[global.race['orbit_decay'] - global.stats.days]);
        },
        {
            elm: `#infoTimer`,
            classes: `has-background-light has-text-dark`
        });
    }

    clearElement($('#resources'));
    defineResources();
    global.resource.Food.display = true;
    if (!global.race['kindling_kindred'] && !global.race['smoldering']){
        global.resource.Lumber.display = true;
    }
    else {
        global.resource.Stone.display = true;
    }
    registerTech('club');

    global.city.calendar.day = 0;

    var city_actions = global.race['kindling_kindred'] || global.race['smoldering'] ? ['food','stone'] : ['food','lumber','stone'];
    if (global.race['smoldering']){
        city_actions.push('chrysotile');
    }
    if (global.race['evil'] && !global.race['kindling_kindred'] && !global.race['smoldering']){
        global.city['slaughter'] = 1;
        city_actions = ['slaughter'];
    }
    for (var i = 0; i < city_actions.length; i++) {
        if (global.city[city_actions[i]]){
            addAction('city',city_actions[i]);
        }
    }

    if (global.race.species === 'custom' && global.custom.hasOwnProperty('race0')){
        global.race['untapped'] = calcGenomeScore({
            name: global.custom.race0.name,
            desc: global.custom.race0.desc,
            entity: global.custom.race0.entity,
            home: global.custom.race0.home,
            red: global.custom.race0.red,
            hell: global.custom.race0.hell,
            gas: global.custom.race0.gas,
            gas_moon: global.custom.race0.gas_moon,
            dwarf: global.custom.race0.dwarf,
            genes: 0,
            genus: global.custom.race0.genus,
            traitlist: global.custom.race0.traits,
            ranks: global.custom.race0?.ranks || {} 
        });
    }

    if (global.race.species === 'hybrid' && global.custom.hasOwnProperty('race1')){
        global.race['untapped'] = calcGenomeScore({
            name: global.custom.race1.name,
            desc: global.custom.race1.desc,
            entity: global.custom.race1.entity,
            home: global.custom.race1.home,
            red: global.custom.race1.red,
            hell: global.custom.race1.hell,
            gas: global.custom.race1.gas,
            gas_moon: global.custom.race1.gas_moon,
            dwarf: global.custom.race1.dwarf,
            genes: 0,
            genus: global.custom.race1.genus,
            hybrid: global.custom.race1.hybrid,
            traitlist: global.custom.race1.traits,
            ranks: global.custom.race1?.ranks || {} 
        });
    }

    if (global.race.unfathomable){
        global.city['surfaceDwellers'] = [];
        while (global.city.surfaceDwellers.length < traits.unfathomable.vars()[0]){
            global.city.surfaceDwellers.push(basicRace(global.city.surfaceDwellers));
        }
    }

    global.settings.showEvolve = false;
    global.settings.showCiv = true;
    global.settings.showCity = true;
    global.settings.showResearch = false;
    global.settings.researchUnlocked = false;
    global.settings.showResources = true;
    global.settings.hideResourcesPanel = false;
    global.settings.leftColumnCollapsed = false;
    const civTabIndex = getMainTabIndex('civ');
    if (civTabIndex >= 0){
        global.settings.civTabs = civTabIndex;
        global.settings.lastCivTab = civTabIndex;
    }
    if (global.race?.species === 'pinguicula'){
        global.settings.spaceTabs = 0;
    }
    updateEvolutionBgm();
    refreshTopBarAndResearchToggle();

    global.civic.govern.type = 'anarchy';
    global.civic.govern.rev = 0;
    global.civic.govern.fr = 0;
    
    if (global.genes['queue']){
        global.tech['queue'] = 1;
        global.tech['r_queue'] = 1;
        global.queue.display = true;
        global.r_queue.display = true;
        if (!global.settings.msgFilters.queue.unlocked){
            global.settings.msgFilters.queue.unlocked = true;
            global.settings.msgFilters.queue.vis = true;
        }
        if (!global.settings.msgFilters.building_queue.unlocked){
            global.settings.msgFilters.building_queue.unlocked = true;
            global.settings.msgFilters.building_queue.vis = true;
            global.settings.msgFilters.research_queue.unlocked = true;
            global.settings.msgFilters.research_queue.vis = true;
        }
        // No need to check for civTab setting because it was set to another tab above
        if (global.settings.tabLoad){
            $(`#resQueue`).removeAttr('style');
        }
    }

    Object.keys(global.genes.minor).forEach(function (trait){
        global.race[trait] = trait === 'mastery' ? global.genes.minor[trait] : global.genes.minor[trait] * 2;
    });
    
    let tempMTOrder = [];
    global.settings.mtorder.forEach(function(trait){
       if (global.genes.minor[trait] || trait === 'mastery'){
           tempMTOrder.push(trait);
       }
    });
    global.settings.mtorder = tempMTOrder;

    if (global.genes['evolve'] && global.genes['evolve'] >= 2){
        for (let i=1; i<8; i++){
            if (global.genes['evolve'] >= i+1){
                randomMinorTrait(i);
            }
        }
    }

    let civ0name = genCivName();
    global.civic.foreign.gov0['name'] = {
        s0: civ0name.s0,
        s1: civ0name.s1
    };
    let civ1name = genCivName();
    while (civ0name.s0 === civ1name.s0 && civ0name.s1 === civ1name.s1){
        civ1name = genCivName();
    }
    global.civic.foreign.gov1['name'] = {
        s0: civ1name.s0,
        s1: civ1name.s1
    };
    let civ2name = genCivName();
    while ((civ0name.s0 === civ2name.s0 && civ0name.s1 === civ2name.s1) || (civ1name.s0 === civ2name.s0 && civ1name.s1 === civ2name.s1)){
        civ2name = genCivName();
    }
    global.civic.foreign.gov2['name'] = {
        s0: civ2name.s0,
        s1: civ2name.s1
    };

    if (global.race['truepath'] || global.race['lone_survivor']){
        global.civic.foreign.gov0.mil = Math.round(global.civic.foreign.gov0.mil * 1.5);
        global.civic.foreign.gov1.mil = Math.round(global.civic.foreign.gov1.mil * 1.4);
        global.civic.foreign.gov2.mil = Math.round(global.civic.foreign.gov2.mil * 1.25);
    
        global.civic.foreign['gov3'] = {
            unrest: 0,
            hstl: Math.floor(seededRandom(20,40)),
            mil: Math.floor(seededRandom(650,750)),
            eco: Math.floor(seededRandom(250,300)),
            spy: 0,
            esp: 0,
            trn: 0,
            sab: 0,
            act: 'none'
        };

        let civAltName = genCivName(true);
        global.civic.foreign.gov3['name'] = {
            s0: civAltName.s0,
            s1: civAltName.s1
        };

        global.civic.foreign['gov4'] = {
            unrest: 0,
            hstl: 100,
            mil: 300,
            eco: 100,
            spy: 0,
            esp: 0,
            trn: 0,
            sab: 0,
            act: 'none'
        };

        let civAltName2 = genCivName(true);
        while (civAltName2.s1 === civAltName.s1){
            civAltName2 = genCivName(true);
        }
        global.civic.foreign.gov4['name'] = {
            s0: 99,
            s1: civAltName2.s1
        };
    }

    if (global.race['cataclysm']){
        messageQueue(loc('cataclysm_sentience',[races[global.race.species].home,flib('name')]),'info',false,['progress']);
    }
    else {
        messageQueue(loc('sentience',[loc('genelab_genus_' + (global.race.maintype || races[global.race.species].type)),races[global.race.species].entity,flib('name')]),'info',false,['progress']);
    }

    if (global.stats.achieve['technophobe'] && global.stats.achieve.technophobe.l >= 1){
        global.resource.Steel.display = true;
        global.resource.Steel.amount = 25;
        if (global.stats.achieve.technophobe.l >= 3){
            if (!global.race['truepath'] && !global.race['lone_survivor']){
                global.resource.Soul_Gem.display = true;
            }
            let gems = 1;
            for (let i=1; i<universe_affixes.length; i++){
                if (global.stats.achieve.technophobe[universe_affixes[i]] && global.stats.achieve.technophobe[universe_affixes[i]] >= 5){
                    gems++;
                }
            }
            global.resource.Soul_Gem.amount = gems;
        }
    }

    if (global.race.species === 'tortoisan'){
        let color = Math.floor(seededRandom(100));
        if (color === 99){
            global.race['shell_color'] = 'rainbow';
        }
        else if (color >= 97 && color <= 98){
            global.race['shell_color'] = 'white';
        }
        else if (color >= 93 && color <= 96){
            global.race['shell_color'] = 'red';
        }
        else if (color >= 89 && color <= 92){
            global.race['shell_color'] = 'orange';
        }
        else if (color >= 85 && color <= 88){
            global.race['shell_color'] = 'yellow';
        }
        else if (color >= 75 && color <= 84){
            global.race['shell_color'] = 'purple';
        }
        else if (color >= 65 && color <= 74){
            global.race['shell_color'] = 'blue';
        }
        else {
            global.race['shell_color'] = 'green';
        }
    }

    if (global.race.species === 'vulpine'){
        let color = Math.floor(seededRandom(100));
        if (color >= 85){
            global.race['fox_color'] = 'white';
        }
        else if (color >= 70 && color <= 84){
            global.race['fox_color'] = 'tan';
        }
        else if (color >= 55 && color <= 69){
            global.race['fox_color'] = 'silver';
        }
        else if (color >= 35 && color <= 54){
            global.race['fox_color'] = 'grey';
        }
        else {
            global.race['fox_color'] = 'red';
        }
    }
    
    calcPillar(true);

    if (global.blood['aware']){
        global.settings.arpa['blood'] = true;
        global.tech['b_stone'] = 2;
    }

    defineJobs(true);
    resetCivicJobsForSentience();
    commisionGarrison();
    defineGovernment(true);

    if (global.race['shapeshifter']){
        shapeShift(false,true);
    }

    if (global.race['carnivore'] || global.race['soul_eater'] || global.race['unfathomable']){
        global.civic.d_job = 'hunter';
        global.civic.hunter.display = true;
    }
    else if (global.race['forager']){
        global.civic.d_job = 'forager';
        global.civic.forager.display = true;
    }
    else {
        global.civic.d_job = 'unemployed';
        global.civic.unemployed.display = true;
    }

    if (global.race['hooved']){
        global.resource.Horseshoe.display = true;
        global.resource.Horseshoe.amount = 5;
        global.race['shoecnt'] = 5;
    }

    if (global.race['deconstructor']){
        global.resource.Nanite.display = true;
        global.city['nanite_factory'] = { count: 1,
            Lumber: 0, Chrysotile: 0, Stone: 0, Crystal: 0, 
            Furs: 0, Copper: 0, Iron: 0, Aluminium: 0,
            Cement: 0, Coal: 0, Oil: 0, Uranium: 0,
            Steel: 0, Titanium: 0, Alloy: 0, Polymer: 0,
            Iridium: 0, Helium_3: 0, Water: 0, Deuterium: 0,
            Neutronium: 0, Adamantite: 0, Bolognium: 0, Orichalcum: 0,
        };
        global.settings.showIndustry = true;
    }

    calc_mastery(true);

    if (global.race['truepath'] || global.race['lone_survivor']){
        Object.keys(resource_values).forEach(function(res){
            if (global.resource.hasOwnProperty(res)){
                global.resource[res].value = resource_values[res] * 2;
            }
        });
    }

    altRace(global.race.species,true);

    tagEvent('sentience',{
        'species': global.race.species,
        'challenge': alevel() - 1
    });

    if (global.stats.feat['adept']){
        let rank = checkAdept();
        global.resource.Food.amount += rank * 100;
        global.resource.Stone.max += rank * 60;
        global.resource.Stone.amount += rank * 100;
        if (global.race['smoldering']){
            global.resource.Chrysotile.max += rank * 60;
            global.resource.Chrysotile.amount += rank * 100;
        }
        else {
            global.resource.Lumber.max += rank * 60;
            global.resource.Lumber.amount += rank * 100;
        }
    }

    if(global.race['fasting']){
        global.resource.Food.amount = 0;
    }
    if (global.race['cataclysm']){
        cataclysm();
    }
    else if (global.race['lone_survivor']){
        loneSurvivor();
    }
    else if (global.race['warlord']){
        warlordSetup();
    }
    else if (global.race['artifical']){
        aiStart();
    }

    if (global.settings.tabLoad){
        drawCity();
        clearElement($(`#r_civics`));
        defineGovernment();
        defineGarrison();
        buildGarrison($('#c_garrison'),false);
        foreignGov();
        defineIndustry();
        initResourceTabs('market');
        initResourceTabs('storage');

        if (tmp_vars.hasOwnProperty('resource')){
            Object.keys(tmp_vars.resource).forEach(function(name){
                let color = tmp_vars.resource[name].color;
                let tradable = tmp_vars.resource[name].tradable;
                let stackable = tmp_vars.resource[name].stackable;
                if (stackable){
                    var market_item = $(`<div id="stack-${name}" class="market-item" v-show="display"></div>`);
                    $('#resStorage').append(market_item);
                    containerItem(`#stack-${name}`,market_item,name,color,true);
                }
                if (tradable){
                    var market_item = $(`<div id="market-${name}" class="market-item" v-show="r.display"></div>`);
                    $('#market').append(market_item);
                    marketItem(`#market-${name}`,market_item,name,color,true);
                }
            });
        }
        tradeSummery();

        arpa('Genetics');
        arpa('Crispr');
        arpa('Blood');
    }
    const mainVueInstance = $('#mainColumn div:first-child')[0]?.__vue__;
    if (mainVueInstance && mainVueInstance.$nextTick){
        mainVueInstance.$nextTick(initTabs);
    }
    else {
        setTimeout(initTabs, 0);
    }

    if (global.queue.hasOwnProperty('queue')){
        global.queue.queue = [];
    }

    if (global.race['slow'] || global.race['hyper'] || global.race.species === 'junker'){
        save.setItem('evolved',LZString.compressToUTF16(JSON.stringify(global)));
        if (webWorker.w){
            webWorker.w.terminate();
        }
        window.location.reload();
    }
}

function simulation(){
    if (global.race['simulation']){
        if (!global.hasOwnProperty('sim')){
            global['sim'] = {
                stats: deepClone(global.stats),
                prestige: deepClone(global.prestige),
                genes: deepClone(global.genes),
                blood: deepClone(global.blood),
                pillars: deepClone(global.pillars),
                race: deepClone(global.race)
            };

            global.stats = {
                start: Date.now(),
                days: 0,
                tdays: 0
            };
            setupStats();

            global.genes = { minor: {}, challenge: 1 };
            global.blood = { aware: 1 };
            global.pillars = {};
            delete global.race['ancient_ruins'];
            delete global.race['rapid_mutation'];
            delete global.race['corruption'];
            delete global.race['rejuvenated'];
            global.race.ascended = false;
            global.race.gods = 'none';
            global.race.old_gods = 'none';
            
            ['Plasmid','AntiPlasmid','Phage','Dark','Harmony','AICore','Artifact','Blood_Stone'].forEach(function (res){
                global.prestige[res] = { count: Number(global.race.simConfig[res]) };
            });
        }
    }
}

function exitSim(){
    if (global.hasOwnProperty('sim')){
        global.stats = deepClone(global.sim.stats);
        global.prestige = deepClone(global.sim.prestige);
        global.genes = deepClone(global.sim.genes);
        global.blood = deepClone(global.sim.blood);
        global.pillars = deepClone(global.sim.pillars);
        global.race = deepClone(global.sim.race);
        delete global['sim'];
        
        global.race.species = 'protoplasm';
        delete global.race['simulation'];

        save.setItem('evolved',LZString.compressToUTF16(JSON.stringify(global)));
        if (webWorker.w){
            webWorker.w.terminate();
        }
        window.location.reload();
    }
}

function aiStart(){
    if (global.race['artifical']){
        global.tech['spy'] = 5;
        global.tech['primitive'] = 3;
        global.tech['currency'] = 6;
        global.tech['govern'] = 3;
        global.tech['boot_camp'] = 1;
        global.tech['medic'] = 1;
        global.tech['military'] = 5;
        global.tech['explosives'] = 3;
        global.tech['trade'] = 3;
        global.tech['banking'] = 6;
        global.tech['home_safe'] = 1;
        global.tech['housing'] = 3;
        global.tech['smelting'] = 3;
        global.tech['copper'] = 1;
        global.tech['storage'] = 5;
        global.tech['container'] = 4;
        global.tech['steel_container'] = 3;
        global.tech['mining'] = 4;
        global.tech['pickaxe'] = 2;
        global.tech['hammer'] = 2;
        global.tech['oil'] = 3;
        global.tech['alumina'] = 1;
        global.tech['titanium'] = 1;
        global.tech['foundry'] = 7;
        global.tech['factory'] = 1;
        global.tech['science'] = 7;
        global.tech['high_tech'] = 4;
        global.tech['theology'] = 2;

        if (!global.race['joyless']){
            global.tech['theatre'] = 3;
            global.tech['broadcast'] = 1;
        }

        global.settings.showPowerGrid = true;
        global.settings.showResearch = true;
        global.settings.researchUnlocked = true;
        global.settings.showCivic = true;
        global.settings.showResources = true;
        global.settings.showMarket = true;
        global.settings.showStorage = true;

        global.resource[global.race.species].display = true;
        global.resource.Knowledge.display = true;
        global.resource.Money.display = true;
        global.resource.Food.display = true;

        global.resource.Money.amount = 1000;

        global.resource.Stone.display = true;
        global.resource.Furs.display = true;
        global.resource.Copper.display = true;
        global.resource.Iron.display = true;
        global.resource.Aluminium.display = true;
        global.resource.Coal.display = true;
        global.resource.Oil.display = true;
        global.resource.Steel.display = true;
        global.resource.Titanium.display = true;
        global.resource.Brick.display = true;
        global.resource.Wrought_Iron.display = true;
        global.resource.Sheet_Metal.display = true;
        global.resource.Crates.display = true;
        global.resource.Containers.display = true;

        if (!global.race['flier']){
            global.tech['cement'] = 5;
            global.resource.Cement.display = true;
        }

        if (!global.race['kindling_kindred'] && !global.race['smoldering']){
            if (global.race['evil']){
                global.tech['reclaimer'] = 3;
                initStruct(actions.city.graveyard); global.city.graveyard.count = 1;
            }
            else {
                global.tech['axe'] = 3;
                global.tech['saw'] = 2;
                initStruct(actions.city.lumber_yard); global.city.lumber_yard.count = 1;
                initStruct(actions.city.sawmill);
            }
            global.resource.Lumber.display = true;
            global.resource.Plywood.display = true;
            global.civic.lumberjack.display = true;
        }
        if (global.race['smoldering']){
            global.resource.Chrysotile.display = true;
        }

        global.resource[global.race.species].max = 0;
        global.resource[global.race.species].amount = 0;
        global.resource.Crates.amount = 10;
        global.resource.Containers.amount = 10;

        global.civic.taxes.display = true;

        global.civic.miner.display = true;
        global.civic.coal_miner.display = true;
        if (!global.race['sappy']){
            global.civic.quarry_worker.display = true;
        }
        global.civic.professor.display = true;
        global.civic.scientist.display = true;
        if (!global.race['flier']){
            global.civic.cement_worker.display = true;
        }
        global.civic.banker.display = true;

        global.city.calendar.day++;
        global.city.market.active = true;
        global.city['power'] = 7.5;
        global.city['powered'] = true;

        initStruct(actions.city.factory);
        initStruct(actions.city.foundry);
        initStruct(actions.city.smelter); addSmelter(1, 'Iron');
        initStruct(actions.city.oil_power); global.city.oil_power.count = 1; global.city.oil_power.on = 1; 
        initStruct(actions.city.coal_power);
        initStruct(actions.city.transmitter); global.city.transmitter.count = 1; global.city.transmitter.on = 1;
        initStruct(actions.city.mine); global.city.mine.count = 1;
        initStruct(actions.city.coal_mine); global.city.coal_mine.count = 1;
        initStruct(actions.city.oil_well); global.city.oil_well.count = 1;
        initStruct(actions.city.oil_depot); global.city.oil_depot.count = 1;
        initStruct(actions.city.cement_plant);  global.city.cement_plant.count = 1;
        initStruct(actions.city.garrison);
        initStruct(actions.city.boot_camp);
        initStruct(actions.city.basic_housing);
        initStruct(actions.city.cottage);
        initStruct(actions.city.apartment);
        initStruct(actions.city.amphitheatre);
        initStruct(actions.city.rock_quarry); global.city.rock_quarry.count = 1;
        initStruct(actions.city.metal_refinery); global.city.metal_refinery.count = 1;
        initStruct(actions.city.shed); global.city.shed.count = 2;
        initStruct(actions.city.storage_yard); global.city.storage_yard.count = 1;
        initStruct(actions.city.warehouse); global.city.warehouse.count = 1;
        initStruct(actions.city.trade);
        initStruct(actions.city.wharf);
        initStruct(actions.city.bank); global.city.bank.count = 1;
        initStruct(actions.city.university); global.city.university.count = 1;
        initStruct(actions.city.library); global.city.library.count = 1;
        initStruct(actions.city.wardenclyffe);
        initStruct(actions.city.temple);

        if (global.race['calm']){
            global.resource.Zen.display = true;
            initStruct(actions.city.meditation);
        }
        if (global.race['cannibalize']){
            initStruct(actions.city.s_alter);
        }
        if (global.race['magnificent']){
            initStruct(actions.city.shrine);
        }

        global.civic.govern.type = 'technocracy';
        drawCity();
        drawTech();
    }
}

function cataclysm(){
    if (global.race['cataclysm']){
        global.tech['unify'] = 2;
        global.tech['spy'] = 5;
        global.tech['primitive'] = 3;
        global.tech['currency'] = 6;
        global.tech['govern'] = 3;
        global.tech['boot_camp'] = 1;
        global.tech['medic'] = 1;
        global.tech['military'] = 5;
        global.tech['marines'] = 1;
        global.tech['explosives'] = 3;
        global.tech['trade'] = 3;
        global.tech['wharf'] = 1;
        global.tech['banking'] = 6;
        global.tech['gambling'] = 1;
        global.tech['home_safe'] = 1;
        global.tech['housing'] = 3;
        global.tech['smelting'] = 3;
        global.tech['copper'] = 1;
        global.tech['storage'] = 5;
        global.tech['container'] = 4;
        global.tech['steel_container'] = 3;
        global.tech['mining'] = 4;
        global.tech['oil'] = 7;
        global.tech['mass'] = 1;
        global.tech['alumina'] = 1;
        global.tech['titanium'] = 2;
        global.tech['polymer'] = 2;
        global.tech['uranium'] = 4;
        global.tech['foundry'] = 7;
        global.tech['factory'] = 1;
        global.tech['theatre'] = 3;
        global.tech['broadcast'] = 2;
        global.tech['mine_conveyor'] = 1;
        global.tech['science'] = 9;
        global.tech['high_tech'] = 7;
        global.tech['genetics'] = 1;
        global.tech['theology'] = 2;
        global.tech['space'] = 6;
        global.tech['solar'] = 3;
        global.tech['luna'] = 2;
        global.tech['hell'] = 1;
        global.tech['mars'] = 5;
        global.tech['gas_giant'] = 1;
        global.tech['gas_moon'] = 2;
        global.tech['asteroid'] = 3;
        global.tech['satellite'] = 1;
        global.tech['space_explore'] = 4;
        global.tech['genesis'] = 2;

        // Begin with a biodome: joyless is incompatible with Cataclysm
        if (global.race['joyless']) {
            delete global.race['joyless'];
        }

        global.settings.showSpace = true;
        global.settings.space.home = true;
        global.settings.space.moon = true;
        global.settings.space.red = true;
        global.settings.space.hell = true;
        global.settings.space.sun = true;
        global.settings.space.gas = true;
        global.settings.space.gas_moon = true;
        global.settings.space.belt = true;
        global.settings.space.dwarf = true;

        global.settings.showCity = false;
        global.settings.showIndustry = true;
        global.settings.showPowerGrid = true;
        global.settings.showResearch = true;
        global.settings.researchUnlocked = true;
        global.settings.showCivic = true;
        global.settings.showMil = true;
        global.settings.showResources = true;
        global.settings.showMarket = true;
        global.settings.showStorage = true;
        const civTabIndex = getMainTabIndex('civ');
        if (civTabIndex >= 0){
            global.settings.civTabs = civTabIndex;
        }
        global.settings.spaceTabs = 1;
        global.settings.showGenetics = true;
        global.settings.arpa.physics = true;

        global.resource[global.race.species].display = true;
        global.resource.Knowledge.display = true;
        global.resource.Money.display = true;
        global.resource.Food.display = true;

        global.resource.Stone.display = true;
        global.resource.Furs.display = true;
        global.resource.Copper.display = true;
        global.resource.Iron.display = true;
        global.resource.Aluminium.display = true;
        global.resource.Coal.display = true;
        global.resource.Oil.display = true;
        global.resource.Uranium.display = true;
        global.resource.Steel.display = true;
        global.resource.Titanium.display = true;
        global.resource.Alloy.display = true;
        global.resource.Polymer.display = true;
        global.resource.Iridium.display = true;
        global.resource.Helium_3.display = true;
        global.resource.Brick.display = true;
        global.resource.Wrought_Iron.display = true;
        global.resource.Sheet_Metal.display = true;
        global.resource.Mythril.display = true;
        global.resource.Crates.display = true;
        global.resource.Containers.display = true;

        if (!global.race['flier']){
            global.resource.Cement.display = true;
            global.resource.Cement.max = 75000;
            global.resource.Cement.amount = 75000;
        }
        if (!global.race['kindling_kindred'] && !global.race['smoldering']){
            global.resource.Lumber.display = true;
            global.resource.Plywood.display = true;
            global.resource.Lumber.max = 90000;
            global.resource.Lumber.amount = 90000;
            global.resource.Plywood.amount = 50000;
        }
        if (global.race['smoldering']){
            global.resource.Chrysotile.display = true;
            global.resource.Chrysotile.max = 90000;
            global.resource.Chrysotile.amount = 90000;
        }

        global.resource[global.race.species].max = 8;
        global.resource[global.race.species].amount = 8;
        global.resource.Crates.amount = 20;
        global.resource.Containers.amount = 20;
        global.resource.Money.max = 225000;
        global.resource.Money.amount = 225000;
        global.resource.Food.max = 1000;
        global.resource.Food.amount = 1000;
        global.resource.Oil.max = 1000;
        global.resource.Oil.amount = 1000;
        global.resource.Helium_3.max = 1000;
        global.resource.Helium_3.amount = 1000;
        global.resource.Uranium.max = 1000;
        global.resource.Uranium.amount = 1000;
        global.resource.Stone.max = 90000;
        global.resource.Stone.amount = 90000;
        global.resource.Furs.max = 40000;
        global.resource.Furs.amount = 40000;
        global.resource.Copper.max = 75000;
        global.resource.Copper.amount = 75000;
        global.resource.Iron.max = 75000;
        global.resource.Iron.amount = 75000;
        global.resource.Steel.max = 75000;
        global.resource.Steel.amount = 75000;
        global.resource.Aluminium.max = 75000;
        global.resource.Aluminium.amount = 75000;
        global.resource.Titanium.max = 75000;
        global.resource.Titanium.amount = 75000;
        global.resource.Coal.max = 10000;
        global.resource.Coal.amount = 10000;
        global.resource.Alloy.max = 20000;
        global.resource.Alloy.amount = 20000;
        global.resource.Polymer.max = 20000;
        global.resource.Polymer.amount = 20000;
        global.resource.Iridium.max = 1000;
        global.resource.Iridium.amount = 1000;
        global.resource.Brick.amount = 50000;
        global.resource.Wrought_Iron.amount = 50000;
        global.resource.Sheet_Metal.amount = 50000;
        global.resource.Mythril.amount = 8000;

        global.resource.Iridium.crates = 5;
        global.resource.Iridium.containers = 5;

        global.civic.taxes.display = true;

        global.civic.professor.display = true;
        global.civic.scientist.display = true;
        global.civic.colonist.display = true;
        global.civic.space_miner.display = true;
        global.civic.craftsman.display = true;

        if (!global.race['flier']){
            global.tech['cement'] = 5;
            global.civic.cement_worker.display = true;
            global.civic.cement_worker.max = jobScale(1);
            global.civic.cement_worker.workers = jobScale(1);
        }

        global.civic.colonist.max = jobScale(4);
        global.civic.colonist.workers = jobScale(4);
        global.civic.space_miner.max = jobScale(3);
        global.civic.space_miner.workers = jobScale(2);
        global.civic.professor.max = jobScale(1);
        global.civic.professor.workers = jobScale(1);

        global.city.calendar.day++;
        global.city.market.active = true;
        global.city['power'] = 0;
        global.city['powered'] = true;

        if (global.race['artifical']){
            initStruct(actions.city.transmitter);
        }
        initStruct(actions.city.factory);
        initStruct(actions.city.foundry);
        initStruct(actions.city.smelter); addSmelter(1, 'Iron'); addSmelter(1, 'Steel');
        initStruct(actions.city.fission_power);
        initStruct(actions.city.oil_power);
        initStruct(actions.city.coal_power);
        initStruct(actions.city.mass_driver);
        initStruct(actions.city.mine);
        initStruct(actions.city.coal_mine);
        initStruct(actions.city.oil_well);
        initStruct(actions.city.oil_depot);
        initStruct(actions.city.garrison);
        initStruct(actions.city.basic_housing);
        initStruct(actions.city.cottage);
        initStruct(actions.city.apartment);
        initStruct(actions.city.amphitheatre);
        initStruct(actions.city.casino);
        initStruct(actions.city.rock_quarry);
        initStruct(actions.city.metal_refinery);
        initStruct(actions.city.storage_yard);
        initStruct(actions.city.warehouse);
        initStruct(actions.city.trade);
        initStruct(actions.city.wharf);
        initStruct(actions.city.bank);
        initStruct(actions.city.tourist_center);
        initStruct(actions.city.university);
        initStruct(actions.city.library);
        initStruct(actions.city.wardenclyffe);
        initStruct(actions.city.biolab);
        initStruct(actions.city.lumber_yard);
        initStruct(actions.city.sawmill);
        initStruct(actions.city.temple);

        initStruct(actions.space.spc_home.satellite); global.space.satellite.count = 1;
        initStruct(actions.space.spc_home.propellant_depot); global.space.propellant_depot.count = 1;
        initStruct(actions.space.spc_home.gps); global.space.gps.count = 4;
        initStruct(actions.space.spc_home.nav_beacon); global.space.nav_beacon.count = 1; global.space.nav_beacon.on = 1;
        initStruct(actions.space.spc_moon.moon_base); global.space.moon_base.count = 1; global.space.moon_base.on = 1; global.space.moon_base.support = 3; global.space.moon_base.s_max = 3;
        initStruct(actions.space.spc_moon.iridium_mine); global.space.iridium_mine.count = 1; global.space.iridium_mine.on = 1;
        initStruct(actions.space.spc_moon.helium_mine); global.space.helium_mine.count = 1; global.space.helium_mine.on = 1;
        initStruct(actions.space.spc_moon.observatory); global.space.observatory.count = 1; global.space.observatory.on = 1;
        initStruct(actions.space.spc_red.spaceport); global.space.spaceport.count = 2; global.space.spaceport.on = 2; global.space.spaceport.support = 8; global.space.spaceport.s_max = 10;
        initStruct(actions.space.spc_red.red_tower); global.space.red_tower.count = 1; global.space.red_tower.on = 1;
        initStruct(actions.space.spc_red.living_quarters); global.space.living_quarters.count = 4; global.space.living_quarters.on = 4;
        initStruct(actions.space.spc_red.vr_center);
        initStruct(actions.space.spc_red.garage); global.space.garage.count = 1;
        initStruct(actions.space.spc_red.red_mine); global.space.red_mine.count = 1; global.space.red_mine.on = 1;
        initStruct(actions.space.spc_red.fabrication); global.space.fabrication.count = 1; global.space.fabrication.on = 1;
        initStruct(actions.space.spc_red.red_factory); global.space.red_factory.count = 1; global.space.red_factory.on = 1;
        initStruct(actions.space.spc_red.exotic_lab); global.space.exotic_lab.count = 1; global.space.exotic_lab.on = 1;
        initStruct(actions.space.spc_red.ziggurat);
        initStruct(actions.space.spc_red.space_barracks); global.space.space_barracks.count = 1; global.space.space_barracks.on = 1;
        initStruct(actions.space.spc_red.biodome); global.space.biodome.count = 2; global.space.biodome.on = 2;
        initStruct(actions.space.spc_hell.geothermal); global.space.geothermal.count = 2; global.space.geothermal.on = 2;
        initStruct(actions.space.spc_hell.spc_casino);
        initStruct(actions.space.spc_hell.swarm_plant);
        initStruct(actions.space.spc_sun.swarm_control); global.space.swarm_control.count = 5; global.space.swarm_control.support = 40; global.space.swarm_control.s_max = 50;
        initStruct(actions.space.spc_sun.swarm_satellite); global.space.swarm_satellite.count = 40;
        initStruct(actions.space.spc_gas.gas_mining); global.space.gas_mining.count = 2; global.space.gas_mining.on = 2;
        initStruct(actions.space.spc_gas.gas_storage); global.space.gas_storage.count = 1;
        initStruct(actions.space.spc_gas_moon.outpost);
        initStruct(actions.space.spc_gas_moon.drone);
        initStruct(actions.space.spc_gas_moon.oil_extractor); global.space.oil_extractor.count = 2; global.space.oil_extractor.on = 2;
        initStruct(actions.space.spc_belt.space_station); global.space.space_station.count = 1; global.space.space_station.on = 1; global.space.space_station.s_max = 3;
        initStruct(actions.space.spc_belt.iridium_ship); global.space.iridium_ship.count = 1; global.space.iridium_ship.on = 1;
        initStruct(actions.space.spc_belt.elerium_ship);
        initStruct(actions.space.spc_belt.iron_ship); global.space.iron_ship.count = 1; global.space.iron_ship.on = 1;
        initStruct(actions.space.spc_dwarf.elerium_contain);

        global.civic['garrison'] = {
            display: true,
            disabled: false,
            progress: 0,
            tactic: 0,
            workers: 2,
            wounded: 0,
            raid: 0,
            max: 2
        };

        drawCity();
        drawTech();
        renderSpace();
        arpa('Physics');
        loadFoundry();
    }
}

export function fanaticism(god){
    if (['custom','hybrid','nano'].includes(god) && global.race['warlord']){
        randomMinorTrait(5);
        arpa('Genetics');
    }
    else {
        switch (races[god].fanaticism){
            case 'smart':
                if (global.race['dumb']){
                    randomMinorTrait(5);
                    arpa('Genetics');
                }
                else {
                    fanaticTrait('smart');
                }
                break;
            case 'infectious':
                fanaticTrait('infectious');
                if (global.race.species === 'human'){
                    unlockAchieve(`infested`);
                }
                break;
            case 'blood_thirst':
                fanaticTrait('blood_thirst');
                if (global.race.species === 'entish'){
                    unlockAchieve(`madagascar_tree`);
                }
                break;
            case 'none':
                randomMinorTrait(5);
                arpa('Genetics');
                break;
            case 'kindling_kindred':
                fanaticTrait(races[god].fanaticism);
                break;
            default:
                fanaticTrait(races[god].fanaticism);
                break;
        }
    }
    if (global.race['warlord']){
        global.race.absorbed.push(god);
    }
}

export function absorbRace(race){
    if (global.race['warlord']){
        fanaticTrait(races[race].fanaticism, 0.25);
        if (!global.race.absorbed.includes(race)){
            global.race.absorbed.push(race);
        }
    }
}

function fanaticTrait(trait,rank){
    if (global.race['warlord'] && trait === 'kindling_kindred'){ trait = 'iron_wood'; }
    else if (global.race['warlord'] && trait === 'spiritual'){ trait = 'unified'; }
    else if (global.race['warlord'] && trait === 'blood_thirst'){ trait = 'apex_predator'; }
    if (global.race[trait]){
        if (!setTraitRank(trait)){
            randomMinorTrait(5);
        }
        else if (trait === 'imitation'){
            setImitation(true);
        }
        else if (trait === 'shapeshifter'){
            shapeShift(global.race['ss_genus']);
        }
    }
    else {
        if (global.race['warlord']){
            global.race[trait] = rank ?? 0.5;
        }
        else {
            global.race[trait] = rank ?? 1;
        }
        cleanAddTrait(trait);
    }
    arpa('Genetics');
}

export function resQueue(){
    if (!global.settings.tabLoad && !isMainTabActive('research') && !global.settings.researchEmbedded){
        return;
    }
    clearResDrag();
    clearElement($('#resQueue'));
    $('#resQueue').append($(`
        <h2 class="has-text-success">${loc('research_queue')} ({{ queue.length }}/{{ max }})</h2>
        <span id="pauserqueue" class="${global.r_queue.pause ? 'pause' : 'play'}" role="button" @click="pauseRQueue()" :aria-label="pausedesc()"></span>
    `));

    if (global.settings.queuestyle){
        $('#resQueue').addClass(global.settings.queuestyle);
    }

    let queue = $(`<ul class="buildList"></ul>`);
    $('#resQueue').append(queue);

    queue.append($(`<li v-for="(item, index) in queue"><a v-bind:id="setID(index)" class="has-text-warning queued" v-bind:class="{ 'qany': item.qa }" @click="remove(index)" role="link"><span>{{ item.label }}</span> [<span v-bind:class="{ 'has-text-danger': item.cna, 'has-text-success': !item.cna && item.req, 'has-text-caution': !item.req && !item.cna }">{{ item.time | time }}</span>]</a></li>`));

    try {
        vBind({
            el: '#resQueue',
            data: global.r_queue,
            methods: {
                remove(index){
                    clearPopper(`rq${global.r_queue.queue[index].id}`);
                    global.r_queue.queue.splice(index,1);
                    resQueue();
                    drawTech();
                },
                setID(index){
                    return `rq${global.r_queue.queue[index].id}`;
                },
                pauseRQueue(){
                    $(`#pauserqueue`).removeClass('play');
                    $(`#pauserqueue`).removeClass('pause');
                    if (global.r_queue.pause){
                        global.r_queue.pause = false;
                        $(`#pauserqueue`).addClass('play');
                    }
                    else {
                        global.r_queue.pause = true;
                        $(`#pauserqueue`).addClass('pause');
                    }
                },
                pausedesc(){
                    return global.r_queue.pause ? loc('r_queue_play') : loc('r_queue_pause');
                }
            },
            filters: {
                time(time){
                    return timeFormat(time);
                }
            }
        });
        resDragQueue();
    }
    catch {
        global.r_queue.queue = [];
    }
}

export function clearResDrag(){
    let el = $('#resQueue .buildList')[0];
    if (el){
        let sort = Sortable.get(el);
        if (sort){
            sort.destroy();
        }
    }
}

function resDragQueue(){
    let el = $('#resQueue .buildList')[0];
    Sortable.create(el,{
        onEnd(e){
            let order = global.r_queue.queue;
            order.splice(e.newDraggableIndex, 0, order.splice(e.oldDraggableIndex, 1)[0]);
            global.r_queue.queue = order;
            resQueue();
        }
    });
    attachQueuePopovers();
}

function attachQueuePopovers(){
    for (let i=0; i<global.r_queue.queue.length; i++){
        let id = `rq${global.r_queue.queue[i].id}`;
        clearPopper(id);

        let c_action;
        let segments = global.r_queue.queue[i].id.split("-");
        c_action = actions[segments[0]][segments[1]];

        popover(id,function(){ return undefined; },{
            in: function(obj){
                actionDesc(obj.popper,c_action,global[segments[0]][segments[1]],false);
            },
            out: function(){
                clearPopper(id);
            },
            wide: c_action['wide']
        });
    }
}

function bananaPerk(val){
    if (global.stats.achieve['banana'] && global.stats.achieve.banana.l >= 5){
        return val - 0.01;
    }
    return val;
}

export function bank_vault(){
    let vault = 1800;
    if (global.tech['vault'] >= 1){
        vault = (global.tech['vault'] + 1) * 7500;
    }
    else if (global.tech['banking'] >= 5){
        vault = 9000;
    }
    else if (global.tech['banking'] >= 3){
        vault = 4000;
    }
    if (global.race['paranoid']){
        vault *= 1 - (traits.paranoid.vars()[0] / 100);
    }
    if (global.race['hoarder']){
        vault *= 1 + (traits.hoarder.vars()[0] / 100);
    }
    let fathom = fathomCheck('dracnid');
    if (fathom > 0){
        vault *= 1 + (traits.hoarder.vars(1)[0] / 100 * fathom);
    }
    if (global.tech.banking >= 7){
        vault *= 1 + highPopAdjust(workerScale(global.civic.banker.workers,'banker') * 0.05);
    }
    if (global.tech.banking >= 8){
        vault += highPopAdjust(25 * global.resource[global.race.species].amount);
    }
    if (global.tech['stock_exchange']){
        vault *= 1 + (global.tech['stock_exchange'] * 0.1);
    }
    if (global.tech['world_control']){
        vault *= 1.25;
    }
    if (global.race['truepath']){
        vault *= 1.25;
    }
    if (global.blood['greed']){
        vault *= 1 + (global.blood.greed / 100);
    }
    if (global.stats.achieve['wheelbarrow']){
        vault *= 1 + (global.stats.achieve.wheelbarrow.l / 50);
    }
    if (global.race['inflation']){
        vault *= 1 + (global.race.inflation / 125);
    }
    if (global.tech['ai_core'] && global.tech.ai_core >= 4){
        let citadel = p_on['citadel'] || 0;
        vault *= 1 + (citadel / 100);
    }
    let rskVal = govActive('risktaker',0);
    if (rskVal){
        vault *= 1 + (rskVal / 100);
    }
    return vault;
}

export function start_cataclysm(){
    if (global.race['start_cataclysm']){
        delete global.race['start_cataclysm'];
        sentience();
    }
}

function forceRace(raceId){
    if (!raceId || !races[raceId]){
        console.warn(`forceRace: unknown race "${raceId}"`);
        return false;
    }
    const raceType = races[raceId].type;
    if (raceType && genus_def[raceType] && (!global.tech[`evo_${raceType}`] || global.tech[`evo_${raceType}`] < 2)){
        global.tech[`evo_${raceType}`] = 2;
    }
    if (global.race['evoFinalMenu']){
        delete global.race['evoFinalMenu'];
    }
    global.race.species = raceId;
    sentience();
    return true;
}

if (typeof window !== 'undefined'){
    window.forceRace = forceRace;
}

var callback_repeat = new Map();
export function doCallbacks(){
    for (const [[c_action, func], args] of callback_queue){
        // If the function returns true, then it wants to be called again in the future
        if (c_action[func](...args)){
            callback_repeat.set([c_action, func], args);
        }
    }
    // Remove all registered callbacks, then reinsert any callbacks that want to be repeated
    callback_queue.clear();
    for (const [[c_action, func], args] of callback_repeat){
        callback_queue.set([c_action, func], args);
    }
    callback_repeat.clear();
}
