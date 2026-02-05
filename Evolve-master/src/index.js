import { global, tmp_vars, save, message_logs, message_filters, webWorker, resizeGame } from './vars.js';
import { loc, locales } from './locale.js';
import { setupStats, alevel } from './achieve.js';
import { vBind, initMessageQueue, clearElement, flib, tagEvent, gameLoop, popover, clearPopper, powerGrid, easterEgg, trickOrTreat, drawIcon } from './functions.js';
import { tradeRatio, atomic_mass, supplyValue, marketItem, containerItem, loadEjector, loadSupply, loadAlchemy, initResourceTabs, drawResourceTab, tradeSummery } from './resources.js';
import { defineJobs, } from './jobs.js';
import { clearSpyopDrag } from './governor.js';
import { defineIndustry, setPowerGrid, gridDefs, clearGrids, loadIndustry, smelterUnlocked } from './industry.js';
import { defineGovernment, defineGarrison, buildGarrison, commisionGarrison, foreignGov, setupGovernmentFloatingPanel } from './civics.js';
import { races, shapeShift, renderPsychicPowers, renderSupernatural } from './races.js';
import { drawEvolution, drawCity, drawTech, resQueue, clearResDrag, setupResourceDrag, countAvailableResearchTechs } from './actions.js';
import { renderSpace, ascendLab, terraformLab } from './space.js';
import { renderFortress, buildFortress, drawMechLab, clearMechDrag, drawHellObservations } from './portal.js';
import { renderEdenic } from './edenic.js';
import { drawShipYard, clearShipDrag, renderTauCeti } from './truepath.js';
import { arpa, clearGeneticsDrag } from './arpa.js';

let lastLocale = global.settings?.locale;

const themeClasses = [
    'dark',
    'light',
    'night',
    'darkNight',
    'redgreen',
    'gruvboxLight',
    'gruvboxDark',
    'gruvboxDarkRG',
    'orangeSoda',
    'dracula'
];

const evolutionBgm = {
    audio: null,
    active: false,
    enabled: true,
    primer: null,
    volume: 0.35,
    track: null
};

const evolutionBgmEnabledKey = 'evolve.evolutionBgmEnabled';

function restoreEvolutionBgmSetting(){
    if (!(save && save.getItem)){
        return;
    }
    const stored = save.getItem(evolutionBgmEnabledKey);
    if (stored === '0' || stored === '1'){
        evolutionBgm.enabled = stored === '1';
    }
}

function persistEvolutionBgmSetting(){
    if (save && save.setItem){
        save.setItem(evolutionBgmEnabledKey, evolutionBgm.enabled ? '1' : '0');
    }
}

restoreEvolutionBgmSetting();

function ensureEvolutionBgm(track){
    if (!track){
        return;
    }
    if (evolutionBgm.audio){
        evolutionBgm.audio.volume = evolutionBgm.volume;
        if (evolutionBgm.track !== track){
            evolutionBgm.audio.src = track;
            evolutionBgm.audio.load();
            evolutionBgm.track = track;
            evolutionBgm.active = false;
        }
        return;
    }
    const audio = new Audio(track);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = evolutionBgm.volume;
    audio.setAttribute('playsinline', '');
    evolutionBgm.audio = audio;
    evolutionBgm.track = track;
}

function attachEvolutionBgmPrimer(){
    if (evolutionBgm.primer){
        return;
    }
    const handler = () => {
        detachEvolutionBgmPrimer();
        updateEvolutionBgm();
    };
    evolutionBgm.primer = handler;
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('keydown', handler, true);
}

function detachEvolutionBgmPrimer(){
    if (!evolutionBgm.primer){
        return;
    }
    document.removeEventListener('pointerdown', evolutionBgm.primer, true);
    document.removeEventListener('keydown', evolutionBgm.primer, true);
    evolutionBgm.primer = null;
}

function getRaceBgmTrack(){
    const species = global.race?.species;
    if (species === 'entish'){
        return '/voice/plant/ent.m4a';
    }
    if (species === 'pinguicula'){
        return '/voice/plant/pinguicula.m4a';
    }
    if (species === 'cacti'){
        return '/voice/plant/catic.m4a';
    }
    return null;
}

function getActiveBgmTrack(){
    if (global.settings.showEvolve && getMainTabKey(global.settings.civTabs) === 'evolution'){
        return '/voice/begain/daybreak.m4a';
    }
    return getRaceBgmTrack();
}

export function updateEvolutionBgm(){
    const track = getActiveBgmTrack();
    const shouldPlay = evolutionBgm.enabled && !!track;
    if (evolutionBgm.audio){
        evolutionBgm.audio.muted = !evolutionBgm.enabled;
        evolutionBgm.audio.volume = evolutionBgm.volume;
    }
    if (shouldPlay){
        ensureEvolutionBgm(track);
        if (!evolutionBgm.active){
            evolutionBgm.active = true;
            let playResult;
            try {
                playResult = evolutionBgm.audio.play();
            }
            catch {
                evolutionBgm.active = false;
                attachEvolutionBgmPrimer();
                playResult = null;
            }
            if (playResult && typeof playResult.then === 'function'){
                playResult.then(() => {
                    detachEvolutionBgmPrimer();
                }).catch(() => {
                    evolutionBgm.active = false;
                    attachEvolutionBgmPrimer();
                });
            }
            else if (playResult !== null){
                detachEvolutionBgmPrimer();
            }
        }
    }
    else if (evolutionBgm.audio){
        evolutionBgm.active = false;
        evolutionBgm.audio.pause();
        detachEvolutionBgmPrimer();
    }
    else {
        detachEvolutionBgmPrimer();
    }
    updateEvolutionBgmButton();
    updateEvolutionBgmVolumeControl();
}

function updateEvolutionBgmButton(){
    const toggle = $('#evolution-bgm-toggle');
    if (!toggle.length){
        return;
    }
    toggle.toggleClass('is-muted', !evolutionBgm.enabled);
    toggle.attr('aria-pressed', evolutionBgm.enabled ? 'true' : 'false');
    toggle.attr('title', evolutionBgm.enabled ? 'BGM on' : 'BGM off');
    toggle.attr('aria-label', evolutionBgm.enabled ? 'BGM on' : 'BGM off');
}

function setEvolutionBgmVolume(value){
    const volume = Math.max(0, Math.min(1, value));
    evolutionBgm.volume = volume;
    if (evolutionBgm.audio){
        evolutionBgm.audio.volume = volume;
    }
    updateEvolutionBgmVolumeControl();
}

function updateEvolutionBgmVolumeControl(){
    const slider = $('#evolution-bgm-volume');
    if (!slider.length){
        return;
    }
    const nextValue = Math.round(evolutionBgm.volume * 100);
    slider.val(nextValue);
    slider.attr('aria-valuenow', String(nextValue));
}

function getMainTabKeys(){
    const tabs = [];
    if (global.settings.showEvolve){
        tabs.push('evolution');
    }
    if (global.settings.showCiv){
        tabs.push('civ');
    }
    if (global.settings.showCivic){
        tabs.push('civic');
    }
    if (global.settings.showResearch && !global.settings.researchFloatingOnly){
        tabs.push('research');
    }
    if (global.settings.showResources){
        tabs.push('resources');
    }
    if (global.settings.showGenetics){
        tabs.push('arpa');
    }
    if (global.settings.showAchieve){
        tabs.push('stats');
    }
    return tabs;
}

function getMainTabKey(tab){
    const keys = getMainTabKeys();
    const index = Number.isFinite(tab) ? tab : global.settings.civTabs;
    if (!Number.isFinite(index) || index < 0 || index >= keys.length){
        return keys[0];
    }
    return keys[index];
}

function syncResourcesPanelHiddenState(){
    if (typeof document === 'undefined'){
        return false;
    }
    const hide = Boolean(global.settings?.hideResourcesPanel);
    const forceHide = global.race?.species === 'protoplasm';
    const activeTabKey = getMainTabKey(global.settings?.civTabs);
    const forceHideEvolution = activeTabKey === 'evolution';
    const effectiveHide = hide || forceHide || forceHideEvolution;
    $('body').toggleClass('hide-resources-panel', effectiveHide);
    const resources = $('#resources');
    if (resources.length){
        resources.toggleClass('resources-panel-hidden', effectiveHide);
        resources.attr('aria-hidden', String(effectiveHide));
        if (forceHide){
            resources.removeClass('resources-floating resources-top resources-camp resources-civics');
            resources.css({ left: '', top: '', right: '', bottom: '', transform: '', height: '' });
        }
    }
    syncResourcesColumnLayout();
    return effectiveHide;
}

function syncResourcesColumnLayout(){
    const resources = $('#resources');
    if (!resources.length){
        return;
    }
    const hidden = $('body').hasClass('hide-resources-panel')
        || resources.hasClass('resources-panel-hidden')
        || resources.hasClass('resources-mobile-hidden');
    if (hidden){
        resources.css({ display: '', flexDirection: '', gap: '' });
        return;
    }
    const singleColumn = !resources.hasClass('resources-top')
        && !resources.hasClass('resources-camp')
        && !resources.hasClass('resources-civics');
    if (singleColumn){
        resources.css({ display: 'flex', flexDirection: 'column', gap: '0.2rem' });
    }
    else {
        resources.css({ display: '', flexDirection: '', gap: '' });
    }
}

function updateResourcesPanelToggle(){
    const toggle = $('#resources-panel-toggle');
    if (!toggle.length){
        return;
    }
    const hidden = Boolean(global.settings?.hideResourcesPanel);
    toggle.toggleClass('is-active', !hidden);
    toggle.attr('aria-pressed', String(!hidden));
}

function syncPinguiculaPortraitPanelPlacement(){
    const racePanel = $('#race');
    if (!racePanel.length){
        return;
    }
    const civilDock = $('#civilRaceDock:visible').first();
    if (civilDock.length){
        racePanel.removeClass('pinguicula-portrait-host');
        if (!racePanel.parent().is(civilDock)){
            racePanel.detach().appendTo(civilDock);
        }
        if (global.race?.species === 'pinguicula'){
            setupPinguiculaPortraitDrag();
        }
        return;
    }
    const leftColumn = $('.leftColumn').first();
    if (global.race?.species !== 'pinguicula'){
        racePanel.removeClass('pinguicula-portrait-host');
        if (leftColumn.length && !racePanel.parent().is(leftColumn)){
            leftColumn.prepend(racePanel);
        }
        return;
    }
    const collapsed = Boolean(global.settings?.leftColumnCollapsed);
    if (collapsed){
        racePanel.addClass('pinguicula-portrait-host');
        if (!racePanel.parent().is('body')){
            racePanel.detach().appendTo('body');
        }
    }
    else {
        racePanel.removeClass('pinguicula-portrait-host');
        if (leftColumn.length && !racePanel.parent().is(leftColumn)){
            leftColumn.prepend(racePanel);
        }
    }
    setupPinguiculaPortraitDrag();
}

function ensurePinguiculaResourcesPanelVisible(){
    if (global.race?.species !== 'pinguicula'){
        return;
    }
    const resources = $('#resources');
    if (!resources.length){
        return;
    }
    const rect = resources[0]?.getBoundingClientRect?.();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isOnScreen = rect
        && rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.left < viewportWidth
        && rect.top < viewportHeight;
    if (resources.is(':visible') && isOnScreen){
        return;
    }
    if (global.settings){
        global.settings.hideResourcesPanel = false;
        global.settings.resourcesFloating = false;
    }
    syncResourcesPanelHiddenState();
    if (save && save.removeItem){
        save.removeItem(resourcesFloatingKey);
        save.removeItem(resourcesPanelKey);
    }
    dockResourcesForTab(global.settings?.civTabs);
    resources.removeClass('resources-panel-hidden resources-mobile-hidden resources-civics resources-camp resources-floating');
    resources.css({ left: '', top: '', right: '', bottom: '', transform: '' });
    const topMount = $('#topResourcesMount').first();
    if (topMount.length){
        if (!topMount.find('#topResourcesHeader').length){
            topMount.prepend(`<div id="topResourcesHeader" class="top-resources-header"><span>${loc('tab_resources')}</span></div>`);
        }
        if (!resources.parent().length || resources.parent()[0] !== topMount[0]){
            resources.detach().appendTo(topMount);
        }
        resources
            .addClass('resources-top')
            .css({ left: '', top: '', right: '', bottom: '', transform: '' })
            .show();
        topMount.addClass('top-resources-floating');
        setupTopResourcesDrag();
    }
    else if (!resources.parent().length){
        $('body').append(resources);
    }
    resources.show();
    syncResourcesColumnLayout();
}

function syncLeftColumnCollapsedState(){
    if (typeof document === 'undefined'){
        return false;
    }
    if (global.settings){
        global.settings.leftColumnCollapsed = false;
    }
    const collapsed = false;
    $('body').addClass('left-column-floating');
    $('body').toggleClass('left-column-collapsed', collapsed);
    syncPinguiculaPortraitPanelPlacement();
    resizeGame();
    return collapsed;
}

function updateLeftColumnToggle(){
    const toggle = $('#left-column-toggle');
    if (!toggle.length){
        return;
    }
    if (global.race?.species === 'protoplasm'){
        toggle.hide();
        toggle.attr('aria-pressed', 'false');
        return;
    }
    toggle.show();
    const collapsed = Boolean(global.settings?.leftColumnCollapsed);
    toggle.toggleClass('is-active', !collapsed);
    toggle.attr('aria-pressed', String(!collapsed));
    toggle.attr('title', collapsed ? '显示侧栏' : '隐藏侧栏');
}

const MAIN_TAB_HEADER_CLASSES = {
    civic: 'main-tab-civic',
    research: 'main-tab-research',
    resources: 'main-tab-resources'
};

function isMainTabHeaderHidden(tabKey){
    const className = MAIN_TAB_HEADER_CLASSES[tabKey];
    if (!className){
        return false;
    }
    const tabHeader = $(`#mainTabs .tabs li.${className}, #mainTabs > nav.tabs li.${className}`);
    if (!tabHeader.length){
        return false;
    }
    return !tabHeader.is(':visible');
}

function ensureVisibleMainTab(){
    if (!global.settings){
        return false;
    }
    const keys = getMainTabKeys();
    if (!keys.length){
        return false;
    }
    const activeIndex = Number.isFinite(global.settings.civTabs) ? global.settings.civTabs : 0;
    const activeKey = keys[Math.min(Math.max(activeIndex, 0), keys.length - 1)];
    if (!activeKey || !isMainTabHeaderHidden(activeKey)){
        return false;
    }
    let fallbackIndex = Number.isFinite(global.settings.lastCivTab) ? global.settings.lastCivTab : -1;
    if (fallbackIndex < 0 || fallbackIndex >= keys.length || isMainTabHeaderHidden(keys[fallbackIndex])){
        fallbackIndex = keys.findIndex((key) => !isMainTabHeaderHidden(key));
    }
    if (fallbackIndex < 0){
        fallbackIndex = 0;
    }
    if (fallbackIndex === activeIndex){
        return false;
    }
    global.settings.civTabs = fallbackIndex;
    global.settings.lastCivTab = fallbackIndex;
    return true;
}

function mapTabIdToKey(tab){
    switch (tab){
        case 'mTabCivil':
            return 'civ';
        case 'mTabCivic':
            return 'civic';
        case 'mTabResearch':
            return 'research';
        case 'mTabResource':
            return 'resources';
        case 'mTabArpa':
            return 'arpa';
        case 'mTabStats':
            return 'stats';
        case 'mTabObserve':
            return 'observe';
        default:
            return null;
    }
}

function resolveMainTabKey(tab){
    if (typeof tab === 'number'){
        return getMainTabKey(tab);
    }
    return mapTabIdToKey(tab) || tab;
}

const resourcesFloatingKey = 'evolve.resourcesFloatingPos';
const resourcesPanelKey = 'evolve.resourcesPanelPos';
const resourcePanelFloatingKey = 'evolve.resourcePanelFloatingPos';
const resourcePanelToggleKey = 'evolve.resourcePanelTogglePos';
const militaryTabToggleKey = 'evolve.militaryTabTogglePos';
const smelterFloatingKey = 'evolve.smelterPanelPos';
const powerGridFloatingKey = 'evolve.powerGridPanelPos';
const smelterToggleKey = 'evolve.smelterTogglePos';
const researchFloatingKey = 'evolve.researchPanelPos';
const researchFloatingPinnedKey = 'evolve.researchPanelPinned';

function isResearchFloatingPinned(){
    if (!(save && save.getItem)){
        return false;
    }
    return save.getItem(researchFloatingPinnedKey) === '1';
}

function markResearchFloatingPinned(){
    if (save && save.setItem){
        save.setItem(researchFloatingPinnedKey, '1');
    }
}
const civicMilitaryFloatingKey = 'evolve.civicMilitaryPanelPos';
const topResourcesFloatingKey = 'evolve.topResourcesPos';
const pinguiculaPortraitKey = 'evolve.pinguiculaPortraitPos';

function applyResourcesFloatingPosition(panel, left, top){
    const rect = panel[0].getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const nextLeft = Math.min(Math.max(left, 0), maxLeft);
    const nextTop = Math.min(Math.max(top, 0), maxTop);
    panel.css({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    return { left: nextLeft, top: nextTop };
}

function restoreResourcesFloatingPosition(){
    const panel = $('#resources');
    if (!panel.length || !panel.hasClass('resources-floating') || !(save && save.getItem)){
        return;
    }
    const raw = save.getItem(resourcesFloatingKey);
    if (!raw){
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applyResourcesFloatingPosition(panel, parsed.x, parsed.y);
        }
    }
    catch {
        // Ignore malformed saved positions.
    }
}

function restoreResourcesPanelPosition(){
    const panel = $('#resources');
    if (!panel.length || panel.hasClass('resources-floating') || panel.hasClass('resources-fixed') || !(save && save.getItem)){
        return;
    }
    const raw = save.getItem(resourcesPanelKey);
    if (!raw){
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            panel.css('transform', `translate(${parsed.x}px, ${parsed.y}px)`);
            const rect = panel[0]?.getBoundingClientRect?.();
            if (rect){
                const viewport = window.visualViewport;
                const viewportWidth = viewport?.width || window.innerWidth;
                const viewportHeight = viewport?.height || window.innerHeight;
                const offsetLeft = viewport?.offsetLeft || 0;
                const offsetTop = viewport?.offsetTop || 0;
                const left = rect.left - offsetLeft;
                const right = rect.right - offsetLeft;
                const top = rect.top - offsetTop;
                const bottom = rect.bottom - offsetTop;
                if (right <= 0 || left >= viewportWidth || bottom <= 0 || top >= viewportHeight){
                    panel.css('transform', '');
                    if (save && save.removeItem){
                        save.removeItem(resourcesPanelKey);
                    }
                }
            }
        }
    }
    catch {
        // Ignore malformed saved positions.
    }
}

function applyTopResourcesPosition(panel, left, top){
    const rect = panel[0].getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const nextLeft = Math.min(Math.max(left, 0), maxLeft);
    const nextTop = Math.min(Math.max(top, 0), maxTop);
    panel.css({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    return { left: nextLeft, top: nextTop };
}

function restoreTopResourcesPosition(panel){
    if (!panel.length || !(save && save.getItem)){
        return false;
    }
    const raw = save.getItem(topResourcesFloatingKey);
    if (!raw){
        return false;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applyTopResourcesPosition(panel, parsed.x, parsed.y);
            return true;
        }
    }
    catch (err){
        // Ignore malformed saved positions.
    }
    return false;
}

function setupTopResourcesDrag(){
    const panel = $('#topResourcesMount');
    if (!panel.length || !panel.hasClass('top-resources-floating')){
        return;
    }
    if (!panel.data('floatingInitialized')){
        restoreTopResourcesPosition(panel);
        panel.data('floatingInitialized', true);
    }

    const doc = $(document);
    if (doc.data('topResourcesDragBound')){
        return;
    }
    doc.data('topResourcesDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        const panel = $('#topResourcesMount');
        panel.removeClass('is-dragging');
        $(document).off('pointermove.topResourcesDrag pointerup.topResourcesDrag pointercancel.topResourcesDrag');
        if (panel.length && save && save.setItem){
            const rect = panel[0].getBoundingClientRect();
            save.setItem(topResourcesFloatingKey, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
        }
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        const panel = $('#topResourcesMount');
        if (!panel.length){
            stopDrag();
            return;
        }
        applyTopResourcesPosition(panel, startLeft + (event.clientX - startX), startTop + (event.clientY - startY));
    };

    doc.on('pointerdown.topResourcesDrag', '#topResourcesHeader', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const panel = $('#topResourcesMount');
        if (!panel.length || !panel.hasClass('top-resources-floating')){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        panel.css({
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            right: 'auto',
            bottom: 'auto'
        });
        dragging = true;
        panel.addClass('is-dragging');
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.topResourcesDrag', moveDrag);
        $(document).on('pointerup.topResourcesDrag pointercancel.topResourcesDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    });

    $(window).on('resize.topResourcesDrag', () => {
        const panel = $('#topResourcesMount');
        if (!panel.length || !panel.hasClass('top-resources-floating')){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        applyTopResourcesPosition(panel, rect.left, rect.top);
    });
}

function applyPinguiculaPortraitPosition(panel, left, top){
    const rect = panel[0].getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const nextLeft = Math.min(Math.max(left, 0), maxLeft);
    const nextTop = Math.min(Math.max(top, 0), maxTop);
    panel.css({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    return { left: nextLeft, top: nextTop };
}

function restorePinguiculaPortraitPosition(panel){
    if (!panel.length || !(save && save.getItem)){
        return false;
    }
    const raw = save.getItem(pinguiculaPortraitKey);
    if (!raw){
        return false;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applyPinguiculaPortraitPosition(panel, parsed.x, parsed.y);
            return true;
        }
    }
    catch (err){
        // Ignore malformed saved positions.
    }
    return false;
}

function setupPinguiculaPortraitDrag(){
    if (global.race.species !== 'pinguicula'){
        return;
    }
    const panel = $('#pinguiculaPortraitPanel');
    if (!panel.length){
        return;
    }
    if (!panel.data('floatingInitialized')){
        const rect = panel[0].getBoundingClientRect();
        panel.addClass('pinguicula-portrait-floating');
        if (!restorePinguiculaPortraitPosition(panel) && rect.width > 0 && rect.height > 0){
            applyPinguiculaPortraitPosition(panel, rect.left, rect.top);
        }
        panel.data('floatingInitialized', true);
    }

    const doc = $(document);
    if (doc.data('pinguiculaPortraitDragBound')){
        return;
    }
    doc.data('pinguiculaPortraitDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        const panel = $('#pinguiculaPortraitPanel');
        panel.removeClass('is-dragging');
        $(document).off('pointermove.pinguiculaPortraitDrag pointerup.pinguiculaPortraitDrag pointercancel.pinguiculaPortraitDrag');
        if (panel.length && save && save.setItem){
            const rect = panel[0].getBoundingClientRect();
            save.setItem(pinguiculaPortraitKey, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
        }
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        const panel = $('#pinguiculaPortraitPanel');
        if (!panel.length){
            stopDrag();
            return;
        }
        applyPinguiculaPortraitPosition(panel, startLeft + (event.clientX - startX), startTop + (event.clientY - startY));
    };

    doc.on('pointerdown.pinguiculaPortraitDrag', '#pinguiculaPortraitPanel', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const panel = $('#pinguiculaPortraitPanel');
        if (!panel.length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        panel.css({
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            right: 'auto',
            bottom: 'auto'
        });
        dragging = true;
        panel.addClass('is-dragging');
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.pinguiculaPortraitDrag', moveDrag);
        $(document).on('pointerup.pinguiculaPortraitDrag pointercancel.pinguiculaPortraitDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    });

    $(window).on('resize.pinguiculaPortraitDrag', () => {
        const panel = $('#pinguiculaPortraitPanel');
        if (!panel.length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        applyPinguiculaPortraitPosition(panel, rect.left, rect.top);
    });
}

function ensureResourcePanelFloating(){
    const shouldShow = shouldShowResourcePanelFloating();
    if (global.settings){
        global.settings.resourcePanelFloating = true;
    }
    let panel = $('#resourcePanelFloating');
    if (!panel.length){
        panel = $(`
            <div id="resourcePanelFloating" class="resource-panel-floating">
                <div id="resourcePanelFloatingHeader" class="resource-panel-header">
                    <span>${loc('tab_resources')}</span>
                    <button id="resourcePanelFloatingClose" class="resource-panel-close" type="button" aria-label="Close">×</button>
                </div>
                <div id="resourcePanelFloatingBody" class="resource-panel-body"></div>
            </div>
        `);
        $('body').append(panel);
    }
    panel.css({
        background: '#141414',
        borderColor: 'rgba(255, 255, 255, 0.18)'
    });
    panel.addClass('warehouse-only');
    panel.find('#resourcePanelFloatingHeader').css({
        background: '#1b1b1b',
        borderBottomColor: 'rgba(255, 255, 255, 0.18)'
    });
    const toggle = ensureResourcePanelFloatingToggle();
    if (!shouldShow){
        panel.hide();
        toggle.hide();
        ensureCivicMarketEmbed();
        return panel;
    }
    toggle.show();
    if (!isResourcePanelFloatingOpen()){
        panel.hide();
        ensureCivicMarketEmbed();
        return panel;
    }
    panel.show();
    const body = panel.find('#resourcePanelFloatingBody');
    const resourcesTab = $('#mTabResource');
    if (resourcesTab.length && body.length){
        if (!resourcesTab.children().length){
            renderResourceTabContent(`#mTabResource`, { force: true });
        }
        if (!resourcesTab.parent().length || resourcesTab.parent()[0] !== body[0]){
            resourcesTab.detach().appendTo(body);
        }
        resourcesTab.removeClass('market-embedded');
    }
    $('#job-market').hide();
    if (!panel.data('floatingInitialized')){
        setupResourcePanelFloatingDrag(panel);
        panel.data('floatingInitialized', true);
    }
    if (!panel.data('floatingPositionPinned')){
        positionResourcePanelFromToggle(panel, toggle);
    }
    panel.off('click.resourcePanelFloatingClose').on('click.resourcePanelFloatingClose', '#resourcePanelFloatingClose', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (global.settings){
            global.settings.resourcePanelFloatingOpen = false;
        }
        ensureResourcePanelFloating();
    });
    const rect = panel[0]?.getBoundingClientRect?.();
    if (rect){
        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width || window.innerWidth;
        const viewportHeight = viewport?.height || window.innerHeight;
        const offsetLeft = viewport?.offsetLeft || 0;
        const offsetTop = viewport?.offsetTop || 0;
        const left = rect.left - offsetLeft;
        const right = rect.right - offsetLeft;
        const top = rect.top - offsetTop;
        const bottom = rect.bottom - offsetTop;
        if (right <= 0 || left >= viewportWidth || bottom <= 0 || top >= viewportHeight){
            resetResourcePanelFloatingPosition(panel);
        }
    }
    return panel;
}

function positionMarketEmbed(host){
    const foundry = $('#foundry');
    const industrialFoundry = $('#industrial-foundry');
    const targetFoundry = industrialFoundry.length ? industrialFoundry : foundry;
    if (!targetFoundry.length){
        return;
    }
    const sheetLabel = targetFoundry.find('#craftSheet_Metal, #scraftSheet_Metal').first();
    if (sheetLabel.length){
        const sheetJob = sheetLabel.closest('.job');
        if (sheetJob.length){
            if (!host.parent().is(targetFoundry) || host.prev()[0] !== sheetJob[0]){
                host.detach();
                sheetJob.after(host);
            }
            return;
        }
    }
    if (!host.parent().is(targetFoundry)){
        host.detach().appendTo(targetFoundry);
    }
}

function ensureCivicMarketEmbed(){
    const host = $('#job-market');
    if (!host.length){
        return;
    }
    if (global.settings){
        global.settings.marketEmbedded = false;
    }
    host.hide();
}

function shouldShowResourcePanelFloating(){
    if (!global.settings){
        return false;
    }
    return Boolean(global.settings.showStorage);
}

function isResourcePanelFloatingOpen(){
    if (!global.settings){
        return false;
    }
    if (!global.settings.hasOwnProperty('resourcePanelFloatingOpen')){
        global.settings.resourcePanelFloatingOpen = false;
    }
    return Boolean(global.settings.resourcePanelFloatingOpen);
}

function ensureResourcePanelFloatingToggle(){
    if (global.settings && !global.settings.hasOwnProperty('resourcePanelFloatingOpen')){
        global.settings.resourcePanelFloatingOpen = false;
    }
    let toggle = $('#resourcePanelFloatingToggle');
    if (!toggle.length){
        toggle = $(`<button id="resourcePanelFloatingToggle" class="resource-panel-toggle" type="button" aria-label="${loc('tab_resources')}"></button>`);
    }
    const root = getFloatingToggleRoot();
    if (!toggle.parent().is(root)){
        toggle.detach().appendTo(root);
    }
    const docked = syncFloatingToggleDocking(toggle, root);
    if (docked){
        const militaryToggle = $('#militaryTabFloatingToggle');
        if (militaryToggle.length){
            toggle.insertBefore(militaryToggle);
        }
    }
    toggle.attr('title', loc('tab_resources'));
    const warehouseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-warehouse-icon lucide-warehouse"><path d="M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11"/><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z"/><path d="M6 13h12"/><path d="M6 17h12"/></svg>`;
    const shouldShow = shouldShowResourcePanelFloating();
    if (!shouldShow){
        if (global.settings){
            global.settings.resourcePanelFloatingOpen = false;
        }
        toggle.hide();
        return toggle;
    }
    toggle.html(warehouseIcon);
    toggle.css({
        background: '#f5c542',
        borderColor: '#f5c542',
        color: '#1a1a1a'
    });
    toggle.off('click.resourcePanelFloatingToggle').on('click.resourcePanelFloatingToggle', (event) => {
        event.preventDefault();
        if (global.settings){
            const nextOpen = !isResourcePanelFloatingOpen();
            if (nextOpen){
                global.settings.marketTabs = 1;
                closeOtherFloatingPanels('resource');
            }
            global.settings.resourcePanelFloatingOpen = nextOpen;
        }
        ensureResourcePanelFloating();
    });
    if (!toggle.data('toggleInitialized')){
        toggle.data('toggleInitialized', true);
    }
    if (!docked){
        const fixedPosition = getFloatingToggleFixedPosition(toggle, 5);
        applyResourcePanelTogglePosition(toggle, fixedPosition);
    }
    toggle.show();
    return toggle;
}

function ensureResourcesPanelToggle(){
    let toggle = $('#resources-panel-toggle');
    if (!toggle.length){
        toggle = $(`<button id="resources-panel-toggle" class="resources-panel-toggle" type="button" aria-label="${loc('tab_resources')}"></button>`);
    }
    const root = getFloatingUiRoot();
    if (!toggle.parent().is(root)){
        toggle.detach().appendTo(root);
    }
    if (!shouldShowResourcesPanelToggle()){
        toggle.hide();
        return toggle;
    }
    toggle.removeClass('settings-button is-small button');
    toggle.attr('title', loc('tab_resources'));
    toggle.attr('aria-label', loc('tab_resources'));
    toggle.html(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-icon lucide-list"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`);
    const positionToggle = () => {
        if (toggle.data('togglePositionPinned')){
            return;
        }
        const target = getResourcePanelToggleDefaultPosition(toggle);
        applyResourcePanelTogglePosition(toggle, target);
    };
    if (!toggle.data('resourcesPanelToggleResizeBound')){
        toggle.data('resourcesPanelToggleResizeBound', true);
        $(window).on('resize.resourcesPanelToggle', () => {
            positionToggle();
        });
    }
    toggle.show();
    setupResourcePanelToggleDrag(toggle);
    positionToggle();
    syncResourcesPanelHiddenState();
    updateResourcesPanelToggle();
    return toggle;
}

function resetResourcePanelFloatingPosition(panel){
    if (!panel || !panel.length){
        return;
    }
    applyResourcePanelFloatingPosition(panel, getResourcePanelDefaultPosition());
}

function getResourcePanelDefaultPosition(){
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return {
        left: baseFontSize,
        top: baseFontSize * 7.5
    };
}

function applyResourcePanelFloatingPosition(panel, left, top){
    if (!panel || !panel.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = panel[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    panel.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto',
        transform: 'none'
    });
    if (save && save.setItem){
        save.setItem(resourcePanelFloatingKey, JSON.stringify({ x: Math.round(nextLeft), y: Math.round(nextTop) }));
    }
    return { left: nextLeft, top: nextTop };
}

function getResourcePanelToggleDefaultPosition(toggle){
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const researchToggle = $('#researchFloatingToggle:visible').first();
    if (researchToggle.length && toggle?.length){
        const researchRect = researchToggle[0].getBoundingClientRect();
        const toggleRect = toggle[0].getBoundingClientRect();
        const gap = baseFontSize * 0.5;
        const left = Math.max(0, researchRect.right + gap);
        const top = Math.max(0, researchRect.top + (researchRect.height - toggleRect.height) / 2);
        return { left, top };
    }
    const moneyPanel = $('#moneyFloating:visible').first();
    if (moneyPanel.length && toggle?.length){
        const moneyRect = moneyPanel[0].getBoundingClientRect();
        const toggleRect = toggle[0].getBoundingClientRect();
        const gap = baseFontSize * 0.25;
        const left = Math.max(0, moneyRect.left - toggleRect.width - gap);
        const top = Math.max(0, moneyRect.top + (moneyRect.height - toggleRect.height) / 2);
        return { left, top };
    }
    const moneyResource = $('#resMoney:visible').first();
    if (moneyResource.length && toggle?.length){
        const moneyRect = moneyResource[0].getBoundingClientRect();
        const toggleRect = toggle[0].getBoundingClientRect();
        const gap = baseFontSize * 0.25;
        const left = Math.max(0, moneyRect.left - toggleRect.width - gap);
        const top = Math.max(0, moneyRect.top + (moneyRect.height - toggleRect.height) / 2);
        return { left, top };
    }
    const target = $('#topResourcesMount.top-resources-floating').first();
    const resources = $('#resources.resources-floating').first();
    const anchor = target.length ? target : resources.length ? resources : $('#resources').first();
    if (anchor.length && toggle?.length){
        const anchorRect = anchor[0].getBoundingClientRect();
        const toggleRect = toggle[0].getBoundingClientRect();
        const left = Math.max(0, anchorRect.right - toggleRect.width - baseFontSize * 0.25);
        const top = Math.max(0, anchorRect.top + baseFontSize * 0.15);
        return { left, top };
    }
    return { left: baseFontSize, top: baseFontSize * 1.5 };
}

function applyResourcePanelTogglePosition(toggle, left, top){
    if (!toggle || !toggle.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = toggle[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    toggle.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    if (save && save.setItem){
        save.setItem(resourcePanelToggleKey, JSON.stringify({ x: Math.round(nextLeft), y: Math.round(nextTop) }));
    }
    return { left: nextLeft, top: nextTop };
}

function shouldShowMilitaryTabToggle(){
    return Boolean(global.settings?.showMil);
}

function shouldShowSmelterFloatingToggle(){
    return Boolean(global.settings) && smelterUnlocked();
}

function shouldShowPowerGridToggle(){
    return Boolean(global.settings?.showPowerGrid);
}

function shouldShowGovernmentFloatingToggle(){
    return Boolean(global.settings) && Boolean(global.tech?.govern);
}

function shouldShowResearchFloatingToggle(){
    return Boolean(global.settings?.showResearch) && !global.settings?.showEvolve;
}

export function updateResearchFloatingToggleBadge(){
    const toggle = $('#researchFloatingToggle');
    if (!toggle.length){
        return;
    }
    let badge = toggle.find('.research-badge');
    if (!badge.length){
        badge = $('<span class="research-badge" aria-hidden="true"></span>');
        toggle.append(badge);
    }
    if (!shouldShowResearchFloatingToggle()){
        badge.text('');
        toggle.removeClass('has-research-badge');
        return;
    }
    const count = countAvailableResearchTechs();
    if (count > 0){
        badge.text(count);
        toggle.addClass('has-research-badge');
    }
    else {
        badge.text('');
        toggle.removeClass('has-research-badge');
    }
}

function shouldShowResourcesPanelToggle(){
    return false;
}

function closeOtherFloatingPanels(exceptKey){
    if (!global.settings){
        return;
    }
    if (exceptKey !== 'resource' && global.settings.resourcePanelFloatingOpen){
        global.settings.resourcePanelFloatingOpen = false;
        ensureResourcePanelFloating();
    }
    if (exceptKey !== 'smelter' && global.settings.smelterFloatingOpen){
        global.settings.smelterFloatingOpen = false;
        ensureSmelterFloatingPanelVisibility();
    }
    if (exceptKey !== 'powerGrid' && global.settings.powerGridFloatingOpen){
        global.settings.powerGridFloatingOpen = false;
        ensurePowerGridFloatingPanelVisibility();
    }
    if (exceptKey !== 'military' && global.settings.militaryFloatingOpen){
        global.settings.militaryFloatingOpen = false;
        ensureMilitaryFloatingPanelVisibility();
    }
    if (exceptKey !== 'government' && global.settings.governmentFloatingOpen){
        global.settings.governmentFloatingOpen = false;
        ensureGovernmentFloatingPanelVisibility();
    }
    if (exceptKey !== 'research' && global.settings.researchFloatingOpen){
        global.settings.researchFloatingOpen = false;
        ensureResearchFloatingPanelVisibility();
    }
}

function getFloatingUiRoot(){
    const main = $('#main');
    return main.length ? main : $('body');
}

function getFloatingToggleRoot(){
    const dock = $('#topBarFloatingToggles');
    if (dock.length){
        return dock;
    }
    return getFloatingUiRoot();
}

function syncFloatingToggleDocking(toggle, root){
    if (!toggle?.length || !root?.length){
        return false;
    }
    const docked = root.is('#topBarFloatingToggles');
    toggle.toggleClass('topbar-docked', docked);
    if (docked){
        toggle.css({
            position: '',
            left: '',
            top: '',
            right: '',
            bottom: ''
        });
    }
    return docked;
}

function getSmelterToggleFixedPosition(toggle){
    return getFloatingToggleFixedPosition(toggle, 0);
}

function getMilitaryTabToggleFixedPosition(toggle){
    return getFloatingToggleFixedPosition(toggle, 2);
}

function getGovernmentToggleFixedPosition(toggle){
    return getFloatingToggleFixedPosition(toggle, 3);
}

function getPowerGridToggleFixedPosition(toggle){
    return getFloatingToggleFixedPosition(toggle, 1);
}

function getResearchToggleFixedPosition(toggle){
    return { left: 500, top: 100 };
}

function getFloatingToggleFixedPosition(toggle, offsetIndex){
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const fallback = {
        left: baseFontSize * (0.5 + 3 * offsetIndex),
        top: baseFontSize * 0.5
    };
    const anchor = $('#mainTabs').first();
    const rightAnchor = $('#mainColumn').first();
    if (!toggle?.length){
        return fallback;
    }
    const toggleRect = toggle[0].getBoundingClientRect();
    const gap = baseFontSize * 0.5;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    let rightEdge = viewportWidth - gap;
    if (rightAnchor.length){
        const rightRect = rightAnchor[0].getBoundingClientRect();
        rightEdge = Math.min(rightEdge, rightRect.right - gap);
    }
    const left = rightEdge - toggleRect.width - offsetIndex * (toggleRect.width + gap);
    let top = baseFontSize * 0.5;
    if (anchor.length){
        const anchorRect = anchor[0].getBoundingClientRect();
        top = anchorRect.top + (anchorRect.height - toggleRect.height) / 2;
    }
    return {
        left: Math.max(0, left),
        top: Math.max(0, top)
    };
}

let calendarDockRetryId = null;
let moraleDockRetryId = null;

function scheduleCivilCalendarDockRetry(){
    if (calendarDockRetryId){
        return;
    }
    calendarDockRetryId = setTimeout(() => {
        calendarDockRetryId = null;
        ensureCivilCalendarDock();
    }, 200);
}

function scheduleMoraleDockRetry(){
    if (moraleDockRetryId){
        return;
    }
    moraleDockRetryId = setTimeout(() => {
        moraleDockRetryId = null;
        ensureMoraleDock();
    }, 200);
}

function ensureCivilCalendarDock(){
    const calendar = $('#topBar .calendar');
    if (!calendar.length){
        return;
    }
    calendar.css({ transform: '', zIndex: '' }).removeClass('calendar-docked');
    return;
    const anchor = $('#mainTabs .main-tab-civil').first();
    if (!anchor.length){
        scheduleCivilCalendarDockRetry();
        return;
    }
    const calendarRect = calendar[0].getBoundingClientRect();
    if (!calendarRect.width || !calendarRect.height){
        scheduleCivilCalendarDockRetry();
        return;
    }
    if (calendarDockRetryId){
        clearTimeout(calendarDockRetryId);
        calendarDockRetryId = null;
    }
    const anchorRect = anchor[0].getBoundingClientRect();
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = baseFontSize * 0.5;
    let targetLeft = anchorRect.left - calendarRect.width - gap;
    let targetTop = anchorRect.top + (anchorRect.height - calendarRect.height) / 2;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    targetLeft = Math.min(Math.max(0, targetLeft), Math.max(0, viewportWidth - calendarRect.width));
    targetTop = Math.min(Math.max(0, targetTop), Math.max(0, viewportHeight - calendarRect.height));
    const dx = targetLeft - calendarRect.left;
    const dy = targetTop - calendarRect.top;
    calendar.addClass('calendar-docked').css({
        transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`,
        zIndex: 12
    });
}

function ensureMoraleDock(){
    const morale = $('#race .morale-contain').first();
    if (!morale.length){
        return;
    }
    morale.removeClass('morale-docked').css({
        left: '',
        top: '',
        right: '',
        bottom: '',
        transform: ''
    });
    const anchor = $('#mainTabs .main-tab-civil').first();
    if (!anchor.length){
        scheduleMoraleDockRetry();
        return;
    }
    const moraleRect = morale[0].getBoundingClientRect();
    if (!moraleRect.width || !moraleRect.height){
        scheduleMoraleDockRetry();
        return;
    }
    if (moraleDockRetryId){
        clearTimeout(moraleDockRetryId);
        moraleDockRetryId = null;
    }
    const anchorRect = anchor[0].getBoundingClientRect();
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = baseFontSize * 0.5;
    let targetLeft = anchorRect.left - moraleRect.width - gap;
    let targetTop = anchorRect.top + (anchorRect.height - moraleRect.height) / 2;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    targetLeft = Math.min(Math.max(0, targetLeft), Math.max(0, viewportWidth - moraleRect.width));
    targetTop = Math.min(Math.max(0, targetTop), Math.max(0, viewportHeight - moraleRect.height));
    morale.addClass('morale-docked').css({
        left: `${Math.round(targetLeft)}px`,
        top: `${Math.round(targetTop)}px`
    });
}

function ensureSmelterFloatingToggle(){
    let toggle = $('#smelterFloatingToggle');
    if (!toggle.length){
        toggle = $(`<button id="smelterFloatingToggle" class="smelter-floating-toggle" type="button" aria-label="${loc('city_smelter')}"></button>`);
    }
    const root = getFloatingToggleRoot();
    if (!toggle.parent().is(root)){
        root.append(toggle);
    }
    const docked = syncFloatingToggleDocking(toggle, root);
    if (!shouldShowSmelterFloatingToggle()){
        toggle.hide();
        return toggle;
    }
    toggle.attr('title', loc('city_smelter'));
    toggle.html(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-anvil-icon lucide-anvil"><path d="M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4"/><path d="M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z"/><path d="M9 12v5"/><path d="M15 12v5"/><path d="M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1"/></svg>`);
    toggle.off('click.smelterFloatingToggle').on('click.smelterFloatingToggle', (event) => {
        if (toggle.data('justDragged')){
            toggle.data('justDragged', false);
            return;
        }
        event.preventDefault();
        if (global.settings){
            if (!global.settings.hasOwnProperty('smelterFloatingOpen')){
                global.settings.smelterFloatingOpen = false;
            }
            const nextOpen = !global.settings.smelterFloatingOpen;
            if (nextOpen){
                closeOtherFloatingPanels('smelter');
            }
            global.settings.smelterFloatingOpen = nextOpen;
        }
        ensureSmelterFloatingPanelVisibility();
    });
    if (!docked){
        const fixedPosition = getSmelterToggleFixedPosition(toggle);
        applySmelterTogglePosition(toggle, fixedPosition);
    }
    toggle.show();
    ensureSmelterFloatingPanelVisibility();
    return toggle;
}

function openPowerGridTab(){
    if (!global.settings?.showPowerGrid){
        return;
    }
    global.settings.govTabs = 2;
    const embedded = $('#civilTripleCivic:visible, #civilSplitCivic:visible').first();
    if (embedded.length){
        renderCivicTab(`#${embedded.attr('id')}`);
        return;
    }
    const civicTab = $('#mTabCivic');
    if (civicTab.length){
        renderCivicTab('#mTabCivic');
        return;
    }
    loadTab('civic');
}

function ensurePowerGridFloatingToggle(){
    let toggle = $('#powerGridFloatingToggle');
    if (!toggle.length){
        toggle = $(`<button id="powerGridFloatingToggle" class="power-grid-toggle" type="button" aria-label="${loc('tab_power_grid')}"></button>`);
    }
    const root = getFloatingToggleRoot();
    if (!toggle.parent().is(root)){
        root.append(toggle);
    }
    const docked = syncFloatingToggleDocking(toggle, root);
    if (!shouldShowPowerGridToggle()){
        if (global.settings){
            global.settings.powerGridFloatingOpen = false;
        }
        ensurePowerGridFloatingPanelVisibility();
        toggle.hide();
        return toggle;
    }
    toggle.attr('title', loc('tab_power_grid'));
    toggle.html(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap-icon lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`);
    toggle.off('click.powerGridFloatingToggle').on('click.powerGridFloatingToggle', (event) => {
        if (toggle.data('justDragged')){
            toggle.data('justDragged', false);
            return;
        }
        event.preventDefault();
        let nextOpen = false;
        if (global.settings){
            if (!global.settings.hasOwnProperty('powerGridFloatingOpen')){
                global.settings.powerGridFloatingOpen = false;
            }
            nextOpen = !global.settings.powerGridFloatingOpen;
            if (nextOpen){
                closeOtherFloatingPanels('powerGrid');
            }
            global.settings.powerGridFloatingOpen = nextOpen;
        }
        ensurePowerGridFloatingPanelVisibility();
        if (nextOpen && global.settings?.govTabs === 2){
            global.settings.govTabs = 0;
            const embedded = $('#civilTripleCivic:visible, #civilSplitCivic:visible').first();
            if (embedded.length){
                renderCivicTab(`#${embedded.attr('id')}`);
            }
            else if ($('#mTabCivic').length){
                renderCivicTab('#mTabCivic');
            }
        }
    });
    if (!docked){
        const fixedPosition = getPowerGridToggleFixedPosition(toggle);
        applyPowerGridTogglePosition(toggle, fixedPosition);
    }
    toggle.show();
    ensurePowerGridFloatingPanelVisibility();
    return toggle;
}

function ensureGovernmentFloatingToggle(){
    let toggle = $('#governmentFloatingToggle');
    if (!toggle.length){
        toggle = $(`<button id="governmentFloatingToggle" class="government-floating-toggle" type="button" aria-label="${loc('tab_gov')}"></button>`);
    }
    const root = getFloatingToggleRoot();
    if (!toggle.parent().is(root)){
        root.append(toggle);
    }
    const docked = syncFloatingToggleDocking(toggle, root);
    if (!shouldShowGovernmentFloatingToggle()){
        toggle.hide();
        return toggle;
    }
    toggle.attr('title', loc('tab_gov'));
    toggle.html(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-landmark-icon lucide-landmark"><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></svg>`);
    toggle.off('click.governmentFloatingToggle').on('click.governmentFloatingToggle', (event) => {
        if (toggle.data('justDragged')){
            toggle.data('justDragged', false);
            return;
        }
        event.preventDefault();
        if (global.settings){
            if (!global.settings.hasOwnProperty('governmentFloatingOpen')){
                global.settings.governmentFloatingOpen = false;
            }
            const nextOpen = !global.settings.governmentFloatingOpen;
            if (nextOpen){
                closeOtherFloatingPanels('government');
            }
            global.settings.governmentFloatingOpen = nextOpen;
        }
        ensureGovernmentFloatingPanelVisibility();
    });
    if (!docked){
        const fixedPosition = getGovernmentToggleFixedPosition(toggle);
        applyGovernmentTogglePosition(toggle, fixedPosition);
    }
    toggle.show();
    ensureGovernmentFloatingPanelVisibility();
    return toggle;
}

function ensureResearchFloatingToggle(){
    let toggle = $('#researchFloatingToggle');
    if (!toggle.length){
        toggle = $(`<button id="researchFloatingToggle" class="research-floating-toggle" type="button" aria-label="${loc('tab_research')}"></button>`);
    }
    const cityAnchorVisible = $('#cityDistrictGrid:visible').length > 0;
    const root = cityAnchorVisible ? getFloatingUiRoot() : getFloatingToggleRoot();
    if (!toggle.parent().is(root)){
        toggle.detach().appendTo(root);
    }
    const docked = syncFloatingToggleDocking(toggle, root);
    if (!shouldShowResearchFloatingToggle()){
        if (global.settings){
            global.settings.researchFloatingOpen = false;
        }
        ensureResearchFloatingPanelVisibility();
        toggle.hide();
        return toggle;
    }
    toggle.attr('title', loc('tab_research'));
    toggle.html(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flask-conical-icon lucide-flask-conical"><path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/></svg><span class="research-badge" aria-hidden="true"></span>`);
    toggle.off('click.researchFloatingToggle').on('click.researchFloatingToggle', (event) => {
        if (toggle.data('justDragged')){
            toggle.data('justDragged', false);
            return;
        }
        event.preventDefault();
        if (global.settings){
            if (!global.settings.hasOwnProperty('researchFloatingOpen')){
                global.settings.researchFloatingOpen = false;
            }
            const nextOpen = !global.settings.researchFloatingOpen;
            if (nextOpen){
                closeOtherFloatingPanels('research');
            }
            global.settings.researchFloatingOpen = nextOpen;
        }
        ensureResearchFloatingPanelVisibility();
    });
    if (!docked || cityAnchorVisible){
        const fixedPosition = getResearchToggleFixedPosition(toggle);
        applyResearchTogglePosition(toggle, fixedPosition);
    }
    ensureResearchFloatingPanelVisibility();
    const isOpen = Boolean(global.settings?.researchFloatingOpen);
    if (isOpen){
        toggle.hide();
    }
    else {
        toggle.show();
    }
    updateResearchFloatingToggleBadge();
    return toggle;
}

export function syncTopBarOffset(){
    const main = document.getElementById('main');
    if (!main){
        return;
    }
    const topBar = document.getElementById('topBar');
    const height = topBar ? topBar.getBoundingClientRect().height : 0;
    if (height > 0){
        const value = `${height}px`;
        document.documentElement.style.setProperty('--topbar-height', value);
        main.style.marginTop = value;
    }
    else {
        main.style.marginTop = '';
    }
}

export function refreshTopBarAndResearchToggle(){
    $('body').toggleClass('race-pinguicula', global.race?.species === 'pinguicula');
    $('body').toggleClass('race-protoplasm', global.race?.species === 'protoplasm');
    $('body').toggleClass('race-sappy', Boolean(global.race?.sappy));
    const topBar = $('#topBar');
    if (topBar.length){
        vBind({ el: '#topBar' }, 'update');
    }
    ensureCivilCalendarDock();
    ensureMoraleDock();
    ensureResearchFloatingToggle();
    ensureResourcesPanelToggle();
    syncLeftColumnCollapsedState();
    updateLeftColumnToggle();
    if (global.settings){
        dockResourcesForTab(global.settings.civTabs);
    }
    ensurePinguiculaResourcesPanelVisible();
    syncPinguiculaPortraitPanelPlacement();
    syncTopBarOffset();
}

function ensureSmelterFloatingPanelVisibility(){
    if (!global.settings){
        return;
    }
    const open = Boolean(global.settings.smelterFloatingOpen);
    if (open){
        closeOtherFloatingPanels('smelter');
    }
    let panel = $('#smelterFloatingPanel');
    const root = getFloatingUiRoot();
    if (!panel.length && open){
        panel = $(`
            <div id="smelterFloatingPanel" class="smelter-floating-panel">
                <div id="smelterFloatingHeader" class="smelter-floating-header">
                    <span class="name has-text-warning">${loc('city_smelter')}</span>
                </div>
                <div id="smelterFloatingContent" class="smelter-floating-content"></div>
            </div>
        `);
        root.append(panel);
    }
    if (panel.length && !panel.parent().is(root)){
        root.append(panel);
    }
    if (!panel.length){
        return;
    }
    if (open){
        panel.addClass('smelter-floating');
        panel.show();
        renderSmelterFloatingContent(panel);
        if (!panel.data('floatingInitialized')){
            setupSmelterFloatingDrag(panel);
            panel.data('floatingInitialized', true);
        }
        const toggle = $('#smelterFloatingToggle');
        if (!panel.data('floatingPositionPinned') && toggle.length){
            positionSmelterPanelFromToggle(panel, toggle);
        }
        const rect = panel[0]?.getBoundingClientRect?.();
        if (rect){
            const viewport = window.visualViewport;
            const viewportWidth = viewport?.width || window.innerWidth;
            const viewportHeight = viewport?.height || window.innerHeight;
            const offsetLeft = viewport?.offsetLeft || 0;
            const offsetTop = viewport?.offsetTop || 0;
            const left = rect.left - offsetLeft;
            const right = rect.right - offsetLeft;
            const top = rect.top - offsetTop;
            const bottom = rect.bottom - offsetTop;
            if (right <= 0 || left >= viewportWidth || bottom <= 0 || top >= viewportHeight){
                positionSmelterPanelFromToggle(panel, toggle);
            }
        }
    }
    else {
        panel.hide();
    }
}

function positionPowerGridPanelFromToggle(panel, toggle){
    if (!panel?.length || !toggle?.length){
        return;
    }
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const toggleRect = toggle[0].getBoundingClientRect();
    const panelRect = panel[0].getBoundingClientRect();
    const gap = baseFontSize * 0.5;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - panelRect.width);
    const maxTop = Math.max(0, viewportHeight - panelRect.height);
    const nextLeft = Math.min(Math.max(0, viewportWidth - panelRect.width - gap), maxLeft);
    const nextTop = Math.min(Math.max(0, toggleRect.top), maxTop);
    applyPowerGridFloatingPosition(panel, nextLeft, nextTop);
}

function ensurePowerGridFloatingPanelVisibility(){
    if (!global.settings){
        return;
    }
    const open = Boolean(global.settings.powerGridFloatingOpen);
    if (open){
        closeOtherFloatingPanels('powerGrid');
    }
    let panel = $('#powerGridFloatingPanel');
    const root = $('body');
    if (!panel.length && open){
        panel = $(`
            <div id="powerGridFloatingPanel" class="power-grid-floating-panel">
                <div id="powerGridFloatingHeader" class="power-grid-floating-header">
                    <span class="name has-text-warning">${loc('tab_power_grid')}</span>
                </div>
                <div id="powerGridFloatingContent" class="power-grid-floating-content"></div>
            </div>
        `);
        root.append(panel);
    }
    if (panel.length && !panel.parent().is(root)){
        panel.detach().appendTo(root);
    }
    if (!panel.length){
        return;
    }
    if (open){
        panel.addClass('power-grid-floating');
        panel.show();
        renderPowerGridFloatingContent(panel);
        if (!panel.data('floatingInitialized')){
            setupPowerGridFloatingDrag(panel);
            panel.data('floatingInitialized', true);
        }
        if (!panel.data('floatingPositionPinned')){
            const restored = restorePowerGridFloatingPosition(panel);
            if (restored){
                panel.data('floatingPositionPinned', true);
            }
            else {
                positionPowerGridPanelFromToggle(panel, $('#powerGridFloatingToggle'));
            }
        }
    }
    else {
        const content = panel.find('#powerGridFloatingContent');
        if (content.length){
            clearElement(content);
        }
        panel.hide();
        if (global.settings?.govTabs === 2 && $('#powerGrid').length){
            setPowerGrid();
        }
    }
}

function positionGovernmentPanelFromToggle(panel, toggle){
    if (!panel?.length || !toggle?.length){
        return;
    }
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const toggleRect = toggle[0].getBoundingClientRect();
    const panelRect = panel[0].getBoundingClientRect();
    const gap = baseFontSize * 0.5;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - panelRect.width);
    const maxTop = Math.max(0, viewportHeight - panelRect.height);
    const nextLeft = Math.min(Math.max(0, viewportWidth - panelRect.width - gap), maxLeft);
    const nextTop = Math.min(Math.max(0, toggleRect.top), maxTop);
    panel.css({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
}

function ensureGovernmentFloatingPanelVisibility(){
    if (!global.settings){
        return;
    }
    const open = Boolean(global.settings.governmentFloatingOpen);
    if (open){
        closeOtherFloatingPanels('government');
    }
    let panel = $('#governmentFloatingPanel');
    if (!panel.length && open){
        if ($('#r_civics').length){
            defineGovernment();
            panel = $('#governmentFloatingPanel');
        }
    }
    if (!panel.length){
        return;
    }
    if (open){
        panel.addClass('government-floating');
        const panelRoot = $('body');
        if (!panel.parent().is(panelRoot)){
            panel.detach().appendTo(panelRoot);
        }
        if (!panel.find('#governmentFloatingHeader').length){
            panel.prepend(`
                <div id="governmentFloatingHeader" class="government-floating-header">
                    <span class="name has-text-warning">${loc('tab_gov')}</span>
                </div>
            `);
        }
        panel.show();
        setupGovernmentFloatingPanel();
        if (!panel.data('floatingPositionPinned')){
            positionGovernmentPanelFromToggle(panel, $('#governmentFloatingToggle'));
        }
    }
    else {
        panel.find('#governmentFloatingHeader').remove();
        panel.hide();
    }
    resizeGame();
}

function positionResearchPanelFromToggle(panel, toggle){
    if (!panel?.length || !toggle?.length){
        return;
    }
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const toggleRect = toggle[0].getBoundingClientRect();
    const panelRect = panel[0].getBoundingClientRect();
    const gap = baseFontSize * 0.5;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - panelRect.width);
    const maxTop = Math.max(0, viewportHeight - panelRect.height);
    const nextLeft = Math.min(Math.max(0, toggleRect.left), maxLeft);
    const nextTop = Math.min(Math.max(0, toggleRect.bottom + gap), maxTop);
    applyResearchFloatingPosition(panel, nextLeft, nextTop);
}

function renderResearchFloatingContent(panel){
    const content = panel.find('#researchFloatingContent');
    if (!content.length){
        return;
    }
    clearElement(content);
    renderResearchTab('#researchFloatingContent');
}

function applyResearchFloatingPosition(panel, left, top){
    if (!panel || !panel.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = panel[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    panel.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    if (save && save.setItem){
        save.setItem(researchFloatingKey, JSON.stringify({ x: Math.round(nextLeft), y: Math.round(nextTop) }));
    }
    return { left: nextLeft, top: nextTop };
}

function restoreResearchFloatingPosition(panel){
    if (!panel.length || !(save && save.getItem)){
        return false;
    }
    const raw = save.getItem(researchFloatingKey);
    if (!raw){
        return false;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applyResearchFloatingPosition(panel, parsed.x, parsed.y);
            return true;
        }
    }
    catch {
        // Ignore malformed stored positions.
    }
    return false;
}

function setupResearchFloatingDrag(panel){
    if (!panel || !panel.length){
        return;
    }
    if (panel.data('researchDragBound')){
        return;
    }
    panel.data('researchDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        panel.removeClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        $(document).off('pointermove.researchDrag pointerup.researchDrag pointercancel.researchDrag');
        const rect = panel[0].getBoundingClientRect();
        applyResearchFloatingPosition(panel, rect.left, rect.top);
        markResearchFloatingPinned();
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        applyResearchFloatingPosition(panel, baseLeft + (event.clientX - startX), baseTop + (event.clientY - startY));
    };

    panel.on('pointerdown.researchDrag', '#researchFloatingHeader', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        baseLeft = rect.left;
        baseTop = rect.top;
        dragging = true;
        panel.addClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.researchDrag', moveDrag);
        $(document).on('pointerup.researchDrag pointercancel.researchDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    });

    const rect = panel[0].getBoundingClientRect();
    if (!restoreResearchFloatingPosition(panel) && rect.width > 0 && rect.height > 0){
        applyResearchFloatingPosition(panel, rect.left, rect.top);
    }
}

function ensureInlineResearchContent(){
    if (global.settings?.researchFloatingOnly){
        return;
    }
    const civil = $('#civilTripleResearch');
    if (civil.length && !civil.children().length){
        renderResearchTab('#civilTripleResearch');
        return;
    }
    const main = $('#mTabResearch');
    if (main.length && !main.children().length){
        renderResearchTab('#mTabResearch');
    }
}

function bindResearchFloatingOutsideClose(){
    $(document).off('click.researchFloatingOutside').on('click.researchFloatingOutside', (event) => {
        if (!global.settings?.researchFloatingOpen){
            return;
        }
        const nativeEvent = event?.originalEvent || event;
        const panel = document.getElementById('researchFloatingPanel');
        const toggle = document.getElementById('researchFloatingToggle');
        const path = typeof nativeEvent?.composedPath === 'function' ? nativeEvent.composedPath() : null;
        if (path && ((panel && path.includes(panel)) || (toggle && path.includes(toggle)))){
            return;
        }
        const target = event.target;
        if (!target){
            return;
        }
        if ($(target).closest('#researchFloatingPanel').length){
            return;
        }
        if ($(target).closest('#researchFloatingToggle').length){
            return;
        }
        if (global.settings){
            global.settings.researchFloatingOpen = false;
        }
        ensureResearchFloatingPanelVisibility();
        ensureResearchFloatingToggle();
    });
}

function ensureResearchFloatingPanelVisibility(){
    if (!global.settings){
        return;
    }
    const open = Boolean(global.settings.researchFloatingOpen) && shouldShowResearchFloatingToggle();
    $('body').toggleClass('research-floating-open', open);
    if (open){
        closeOtherFloatingPanels('research');
    }
    let panel = $('#researchFloatingPanel');
    const panelRoot = getFloatingUiRoot();
    if (!panel.length && open){
        panel = $(`
            <div id="researchFloatingPanel" class="research-floating-panel main">
                <div id="researchFloatingHeader" class="research-floating-header">
                    <span class="name has-text-warning">${loc('tab_research')}</span>
                    <button id="researchFloatingClose" class="research-floating-close" type="button" aria-label="Close">×</button>
                </div>
                <div id="researchFloatingContent" class="research-floating-content content"></div>
            </div>
        `);
        panelRoot.append(panel);
    }
    if (panel.length && !panel.parent().is(panelRoot)){
        panel.detach().appendTo(panelRoot);
    }
    if (!panel.length){
        return;
    }
    if (open){
        panel.addClass('research-floating');
        panel.show();
        renderResearchFloatingContent(panel);
        if (!panel.data('floatingInitialized')){
            setupResearchFloatingDrag(panel);
            panel.data('floatingInitialized', true);
        }
        const hasContent = panel.find('#tech').length > 0;
        if (!hasContent){
            global.settings.researchFloatingOpen = false;
            panel.hide();
            ensureInlineResearchContent();
            return;
        }
        clearElement($('#mTabResearch'));
        clearElement($('#civilTripleResearch'));
        panel.off('pointerdown.researchFloatingClose').on('pointerdown.researchFloatingClose', '#researchFloatingClose', (event) => {
            event.stopPropagation();
        });
        panel.off('click.researchFloatingClose').on('click.researchFloatingClose', '#researchFloatingClose', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (global.settings){
                global.settings.researchFloatingOpen = false;
            }
            ensureResearchFloatingPanelVisibility();
            ensureResearchFloatingToggle();
        });
        if (!panel.data('floatingPositionPinned')){
            const restored = isResearchFloatingPinned() && restoreResearchFloatingPosition(panel);
            if (!restored){
                positionResearchPanelFromToggle(panel, $('#researchFloatingToggle'));
            }
        }
        bindResearchFloatingOutsideClose();
    }
    else {
        const content = panel.find('#researchFloatingContent');
        if (content.length){
            clearElement(content);
        }
        panel.hide();
        $(document).off('click.researchFloatingOutside');
        ensureInlineResearchContent();
    }
}

function renderPowerGridFloatingContent(panel){
    const content = panel.find('#powerGridFloatingContent');
    if (!content.length){
        return;
    }
    setPowerGrid();
}

function renderSmelterFloatingContent(panel){
    const content = panel.find('#smelterFloatingContent');
    if (!content.length){
        return;
    }
    clearElement(content);
    if (!smelterUnlocked()){
        return;
    }
    const smelter = $(`<div id="smelterFloatingInner" class="industry"><h2 class="header has-text-advanced">${loc('city_smelter')}</h2></div>`);
    content.append(smelter);
    loadIndustry('smelter', smelter, '#smelterFloatingInner');
}

function getSmelterToggleStoredPosition(){
    if (!(save && save.getItem)){
        return null;
    }
    const raw = save.getItem(smelterToggleKey);
    if (!raw){
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            return { left: parsed.x, top: parsed.y };
        }
    }
    catch {
        // Ignore malformed stored positions.
    }
    return null;
}

function getSmelterToggleDefaultPosition(toggle){
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const anchor = $('#smelterFloatingPanel:visible').first();
    if (anchor.length && toggle?.length){
        const anchorRect = anchor[0].getBoundingClientRect();
        const toggleRect = toggle[0].getBoundingClientRect();
        const gap = baseFontSize * 0.5;
        const left = Math.max(0, anchorRect.left - toggleRect.width - gap);
        const top = Math.max(0, anchorRect.top + baseFontSize);
        return { left, top };
    }
    return { left: baseFontSize, top: baseFontSize * 14 };
}

function applySmelterTogglePosition(toggle, left, top){
    if (!toggle || !toggle.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = toggle[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    toggle.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    if (save && save.setItem){
        save.setItem(smelterToggleKey, JSON.stringify({ x: Math.round(nextLeft), y: Math.round(nextTop) }));
    }
    return { left: nextLeft, top: nextTop };
}

function setupSmelterFloatingToggleDrag(toggle){
    if (!toggle || !toggle.length){
        return;
    }
    if (toggle.data('smelterToggleDragBound')){
        return;
    }
    toggle.data('smelterToggleDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;
    const threshold = 4;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        toggle.removeClass('is-dragging');
        toggle.data('justDragged', true);
        $(document).off('pointermove.smelterToggleDrag pointerup.smelterToggleDrag pointercancel.smelterToggleDrag');
    };

    const moveDrag = (event) => {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragging){
            if (Math.abs(dx) < threshold && Math.abs(dy) < threshold){
                return;
            }
            dragging = true;
            toggle.addClass('is-dragging');
        }
        applySmelterTogglePosition(toggle, baseLeft + dx, baseTop + dy);
        event.preventDefault();
    };

    const startDrag = (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const rect = toggle[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        baseLeft = rect.left;
        baseTop = rect.top;
        $(document).on('pointermove.smelterToggleDrag', moveDrag);
        $(document).on('pointerup.smelterToggleDrag pointercancel.smelterToggleDrag', stopDrag);
    };

    toggle.on('pointerdown.smelterToggleDrag', startDrag);

    $(window).on('resize.smelterToggleDrag', () => {
        const rect = toggle[0].getBoundingClientRect();
        applySmelterTogglePosition(toggle, rect.left, rect.top);
    });
}

function applySmelterFloatingPosition(panel, left, top){
    if (!panel || !panel.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = panel[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    panel.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    if (save && save.setItem){
        save.setItem(smelterFloatingKey, JSON.stringify({ x: Math.round(nextLeft), y: Math.round(nextTop) }));
    }
    return { left: nextLeft, top: nextTop };
}

function positionSmelterPanelFromToggle(panel, toggle){
    if (!panel || !panel.length || !toggle || !toggle.length){
        return;
    }
    const panelRect = panel[0].getBoundingClientRect();
    const toggleRect = toggle[0].getBoundingClientRect();
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = baseFontSize * 0.5;
    const left = toggleRect.left;
    const top = toggleRect.bottom + gap;
    applySmelterFloatingPosition(panel, left, top);
}

function restoreSmelterFloatingPosition(panel){
    if (!panel.length || !(save && save.getItem)){
        return false;
    }
    const raw = save.getItem(smelterFloatingKey);
    if (!raw){
        return false;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applySmelterFloatingPosition(panel, parsed.x, parsed.y);
            return true;
        }
    }
    catch {
        // Ignore malformed stored positions.
    }
    return false;
}

function setupSmelterFloatingDrag(panel){
    if (!panel || !panel.length){
        return;
    }
    if (panel.data('smelterDragBound')){
        return;
    }
    panel.data('smelterDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        panel.removeClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        $(document).off('pointermove.smelterDrag pointerup.smelterDrag pointercancel.smelterDrag');
        const rect = panel[0].getBoundingClientRect();
        applySmelterFloatingPosition(panel, rect.left, rect.top);
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        applySmelterFloatingPosition(panel, baseLeft + (event.clientX - startX), baseTop + (event.clientY - startY));
    };

    panel.on('pointerdown.smelterDrag', '#smelterFloatingHeader', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        baseLeft = rect.left;
        baseTop = rect.top;
        dragging = true;
        panel.addClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.smelterDrag', moveDrag);
        $(document).on('pointerup.smelterDrag pointercancel.smelterDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    });

    const rect = panel[0].getBoundingClientRect();
    if (!restoreSmelterFloatingPosition(panel) && rect.width > 0 && rect.height > 0){
        applySmelterFloatingPosition(panel, rect.left, rect.top);
    }
}

function applyPowerGridFloatingPosition(panel, left, top){
    if (!panel || !panel.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = panel[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    panel.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    if (save && save.setItem){
        save.setItem(powerGridFloatingKey, JSON.stringify({ x: Math.round(nextLeft), y: Math.round(nextTop) }));
    }
    return { left: nextLeft, top: nextTop };
}

function restorePowerGridFloatingPosition(panel){
    if (!panel.length || !(save && save.getItem)){
        return false;
    }
    const raw = save.getItem(powerGridFloatingKey);
    if (!raw){
        return false;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applyPowerGridFloatingPosition(panel, parsed.x, parsed.y);
            return true;
        }
    }
    catch {
        // Ignore malformed stored positions.
    }
    return false;
}

function setupPowerGridFloatingDrag(panel){
    if (!panel || !panel.length){
        return;
    }
    if (panel.data('powerGridDragBound')){
        return;
    }
    panel.data('powerGridDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        panel.removeClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        $(document).off('pointermove.powerGridDrag pointerup.powerGridDrag pointercancel.powerGridDrag');
        const rect = panel[0].getBoundingClientRect();
        applyPowerGridFloatingPosition(panel, rect.left, rect.top);
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        applyPowerGridFloatingPosition(panel, baseLeft + (event.clientX - startX), baseTop + (event.clientY - startY));
    };

    panel.on('pointerdown.powerGridDrag', '#powerGridFloatingHeader', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        baseLeft = rect.left;
        baseTop = rect.top;
        dragging = true;
        panel.addClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.powerGridDrag', moveDrag);
        $(document).on('pointerup.powerGridDrag pointercancel.powerGridDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    });
}

function ensureMilitaryTabFloatingToggle(){
    let toggle = $('#militaryTabFloatingToggle');
    if (!toggle.length){
        toggle = $(`<button id="militaryTabFloatingToggle" class="military-tab-toggle" type="button" aria-label="${loc('tab_military')}"></button>`);
    }
    const root = getFloatingToggleRoot();
    if (!toggle.parent().is(root)){
        root.append(toggle);
    }
    const docked = syncFloatingToggleDocking(toggle, root);
    if (!shouldShowMilitaryTabToggle()){
        toggle.hide();
        return toggle;
    }
    toggle.attr('title', loc('tab_military'));
    toggle.html(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag-icon lucide-flag"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/></svg>`);
    toggle.off('click.militaryTabToggle').on('click.militaryTabToggle', (event) => {
        if (toggle.data('justDragged')){
            toggle.data('justDragged', false);
            return;
        }
        event.preventDefault();
        if (global.settings){
            if (!global.settings.hasOwnProperty('militaryFloatingOpen')){
                global.settings.militaryFloatingOpen = false;
            }
            const nextOpen = !global.settings.militaryFloatingOpen;
            if (nextOpen){
                closeOtherFloatingPanels('military');
            }
            global.settings.militaryFloatingOpen = nextOpen;
        }
        ensureMilitaryFloatingPanelVisibility();
    });
    if (!docked){
        const fixedPosition = getMilitaryTabToggleFixedPosition(toggle);
        applyMilitaryTabTogglePosition(toggle, fixedPosition);
    }
    toggle.show();
    ensureMilitaryFloatingPanelVisibility();
    return toggle;
}

function positionMilitaryPanelFromToggle(panel, toggle){
    if (!panel?.length || !toggle?.length){
        return;
    }
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const toggleRect = toggle[0].getBoundingClientRect();
    const panelRect = panel[0].getBoundingClientRect();
    const gap = baseFontSize * 0.5;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - panelRect.width);
    const maxTop = Math.max(0, viewportHeight - panelRect.height);
    const nextLeft = Math.min(Math.max(0, viewportWidth - panelRect.width - gap), maxLeft);
    const nextTop = Math.min(Math.max(0, toggleRect.top), maxTop);
    panel.css({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
}

function ensureMilitaryFloatingPanelVisibility(){
    if (!global.settings){
        return;
    }
    const open = Boolean(global.settings.militaryFloatingOpen);
    if (open){
        closeOtherFloatingPanels('military');
    }
    let panel = $('#militaryFloatingPanel');
    const root = getFloatingUiRoot();
    if (!panel.length && open){
        if (!$('#military').length){
            const civicRoots = ['#civilSplitCivic', '#civilTripleCivic', '#mTabCivic'];
            civicRoots.some((selector) => {
                const civicRoot = $(selector);
                if (!civicRoot.length){
                    return false;
                }
                if (!civicRoot.find('.resTabs').length){
                    renderCivicTab(selector);
                }
                return true;
            });
        }
        defineGarrison(true);
        panel = $('#militaryFloatingPanel');
    }
    if (open){
        defineGarrison(true);
        panel = $('#militaryFloatingPanel');
    }
    if (!panel.length){
        return;
    }
    if (open){
        panel.addClass('military-floating');
        const panelRoot = $('body');
        if (!panel.parent().is(panelRoot)){
            panel.detach().appendTo(panelRoot);
        }
        panel.show();
        if (!panel.data('floatingPositionPinned')){
            positionMilitaryPanelFromToggle(panel, $('#militaryTabFloatingToggle'));
        }
    }
    else {
        const military = $('#military');
        if (military.length){
            if (!panel.parent().is(military)){
                panel.detach().appendTo(military);
            }
            panel.show();
        }
        else {
            panel.hide();
        }
    }
    resizeGame();
}

function getMilitaryTabToggleStoredPosition(){
    if (!(save && save.getItem)){
        return null;
    }
    const raw = save.getItem(militaryTabToggleKey);
    if (!raw){
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            return { left: parsed.x, top: parsed.y };
        }
    }
    catch {
        // Ignore malformed stored positions.
    }
    return null;
}

function getMilitaryTabToggleDefaultPosition(toggle){
    const baseFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const anchor = $('#militaryFloatingPanel:visible').first();
    if (anchor.length && toggle?.length){
        const anchorRect = anchor[0].getBoundingClientRect();
        const toggleRect = toggle[0].getBoundingClientRect();
        const gap = baseFontSize * 0.5;
        const left = Math.max(0, anchorRect.left - toggleRect.width - gap);
        const top = Math.max(0, anchorRect.top + baseFontSize);
        return { left, top };
    }
    return { left: baseFontSize, top: baseFontSize * 12 };
}

function applyMilitaryTabTogglePosition(toggle, left, top){
    if (!toggle || !toggle.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = toggle[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    toggle.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    if (save && save.setItem){
        save.setItem(militaryTabToggleKey, JSON.stringify({ x: Math.round(nextLeft), y: Math.round(nextTop) }));
    }
    return { left: nextLeft, top: nextTop };
}

function applyGovernmentTogglePosition(toggle, left, top){
    if (!toggle || !toggle.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = toggle[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    toggle.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    return { left: nextLeft, top: nextTop };
}

function applyResearchTogglePosition(toggle, left, top){
    if (!toggle || !toggle.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = toggle[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    toggle.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    return { left: nextLeft, top: nextTop };
}

function setupMilitaryTabToggleDrag(toggle){
    if (!toggle || !toggle.length){
        return;
    }
    if (toggle.data('militaryToggleDragBound')){
        return;
    }
    toggle.data('militaryToggleDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;
    const threshold = 4;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        toggle.removeClass('is-dragging');
        toggle.data('justDragged', true);
        $(document).off('pointermove.militaryTabToggleDrag pointerup.militaryTabToggleDrag pointercancel.militaryTabToggleDrag');
    };

    const moveDrag = (event) => {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragging){
            if (Math.abs(dx) < threshold && Math.abs(dy) < threshold){
                return;
            }
            dragging = true;
            toggle.addClass('is-dragging');
        }
        applyMilitaryTabTogglePosition(toggle, baseLeft + dx, baseTop + dy);
        event.preventDefault();
    };

    const startDrag = (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const rect = toggle[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        baseLeft = rect.left;
        baseTop = rect.top;
        $(document).on('pointermove.militaryTabToggleDrag', moveDrag);
        $(document).on('pointerup.militaryTabToggleDrag pointercancel.militaryTabToggleDrag', stopDrag);
    };

    toggle.on('pointerdown.militaryTabToggleDrag', startDrag);

    $(window).on('resize.militaryTabToggleDrag', () => {
        const rect = toggle[0].getBoundingClientRect();
    applyMilitaryTabTogglePosition(toggle, rect.left, rect.top);
});
}

function applyPowerGridTogglePosition(toggle, left, top){
    if (!toggle || !toggle.length){
        return null;
    }
    let targetLeft = left;
    let targetTop = top;
    if (typeof left === 'object' && left !== null){
        targetLeft = left.left;
        targetTop = left.top;
    }
    const rect = toggle[0].getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const maxLeft = Math.max(0, viewportWidth - rect.width);
    const maxTop = Math.max(0, viewportHeight - rect.height);
    const nextLeft = Math.min(Math.max(0, Number(targetLeft) || 0), maxLeft);
    const nextTop = Math.min(Math.max(0, Number(targetTop) || 0), maxTop);
    toggle.css({
        position: 'fixed',
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    return { left: nextLeft, top: nextTop };
}

function positionResourcePanelFromToggle(panel, toggle){
    if (!panel || !panel.length || !toggle || !toggle.length){
        return;
    }
    const panelRect = panel[0].getBoundingClientRect();
    const toggleRect = toggle[0].getBoundingClientRect();
    const left = toggleRect.right - panelRect.width;
    const top = toggleRect.top;
    applyResourcePanelFloatingPosition(panel, left, top);
}

function setupResourcePanelToggleDrag(toggle){
    if (!toggle || !toggle.length){
        return;
    }
    if (toggle.data('resourcePanelToggleDragBound')){
        return;
    }
    toggle.data('resourcePanelToggleDragBound', true);
    toggle.off('pointerdown.resourcePanelToggleDrag mousedown.resourcePanelToggleDrag touchstart.resourcePanelToggleDrag');

    let stored = null;
    if (save && save.getItem){
        const raw = save.getItem(resourcePanelToggleKey);
        if (raw){
            try {
                const parsed = JSON.parse(raw);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
                    stored = { left: parsed.x, top: parsed.y };
                }
            }
            catch {
                // Ignore malformed stored positions.
            }
        }
    }
    const fallback = getResourcePanelToggleDefaultPosition(toggle);
    applyResourcePanelTogglePosition(toggle, stored || fallback);

    let dragging = false;
    let dragType = null;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;
    const threshold = 4;

    const getPoint = (event) => {
        if (event.touches && event.touches[0]){
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        return { x: event.clientX, y: event.clientY };
    };

    const stopDrag = () => {
        if (!dragType){
            return;
        }
        if (dragging){
            toggle.removeClass('is-dragging');
            toggle.data('justDragged', true);
            toggle.data('togglePositionPinned', true);
        }
        dragging = false;
        dragType = null;
        $(document).off('pointermove.resourcePanelToggleDrag pointerup.resourcePanelToggleDrag pointercancel.resourcePanelToggleDrag mousemove.resourcePanelToggleDrag mouseup.resourcePanelToggleDrag touchmove.resourcePanelToggleDrag touchend.resourcePanelToggleDrag touchcancel.resourcePanelToggleDrag');
    };

    const moveDrag = (event) => {
        if (!dragType){
            return;
        }
        const type = event.type.startsWith('pointer') ? 'pointer' : event.type.startsWith('mouse') ? 'mouse' : 'touch';
        if (dragType && type !== dragType){
            return;
        }
        const point = getPoint(event);
        const dx = point.x - startX;
        const dy = point.y - startY;
        if (!dragging){
            if (Math.abs(dx) < threshold && Math.abs(dy) < threshold){
                return;
            }
            dragging = true;
            toggle.addClass('is-dragging');
            toggle.data('togglePositionPinned', true);
        }
        applyResourcePanelTogglePosition(toggle, baseLeft + dx, baseTop + dy);
        event.preventDefault();
    };

    const startDrag = (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        if (dragType){
            return;
        }
        const type = event.type.startsWith('pointer') ? 'pointer' : event.type.startsWith('mouse') ? 'mouse' : 'touch';
        const rect = toggle[0].getBoundingClientRect();
        const point = getPoint(event);
        startX = point.x;
        startY = point.y;
        baseLeft = rect.left;
        baseTop = rect.top;
        dragType = type;
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.resourcePanelToggleDrag mousemove.resourcePanelToggleDrag touchmove.resourcePanelToggleDrag', moveDrag);
        $(document).on('pointerup.resourcePanelToggleDrag pointercancel.resourcePanelToggleDrag mouseup.resourcePanelToggleDrag touchend.resourcePanelToggleDrag touchcancel.resourcePanelToggleDrag', stopDrag);
    };

    toggle.on('pointerdown.resourcePanelToggleDrag mousedown.resourcePanelToggleDrag touchstart.resourcePanelToggleDrag', startDrag);

    $(window).on('resize.resourcePanelToggleDrag', () => {
        const rect = toggle[0].getBoundingClientRect();
        applyResourcePanelTogglePosition(toggle, rect.left, rect.top);
    });
}

function setupResourcePanelFloatingDrag(panel){
    if (!panel || !panel.length){
        return;
    }
    if (panel.data('resourcePanelDragBound')){
        return;
    }
    panel.data('resourcePanelDragBound', true);
    panel.off('pointerdown.resourcePanelDrag mousedown.resourcePanelDrag touchstart.resourcePanelDrag');

    let stored = null;
    if (save && save.getItem){
        const raw = save.getItem(resourcePanelFloatingKey);
        if (raw){
            try {
                const parsed = JSON.parse(raw);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
                    stored = { left: parsed.x, top: parsed.y };
                }
            }
            catch {
                // Ignore malformed stored positions.
            }
        }
    }
    const fallback = getResourcePanelDefaultPosition();
    applyResourcePanelFloatingPosition(panel, stored || fallback);

    let dragging = false;
    let dragType = null;
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;

    const getPoint = (event) => {
        if (event.touches && event.touches[0]){
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        return { x: event.clientX, y: event.clientY };
    };

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        dragType = null;
        panel.removeClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        $(document).off('pointermove.resourcePanelDrag pointerup.resourcePanelDrag pointercancel.resourcePanelDrag mousemove.resourcePanelDrag mouseup.resourcePanelDrag touchmove.resourcePanelDrag touchend.resourcePanelDrag touchcancel.resourcePanelDrag');
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        const type = event.type.startsWith('pointer') ? 'pointer' : event.type.startsWith('mouse') ? 'mouse' : 'touch';
        if (dragType && type !== dragType){
            return;
        }
        const point = getPoint(event);
        const nextLeft = baseLeft + (point.x - startX);
        const nextTop = baseTop + (point.y - startY);
        applyResourcePanelFloatingPosition(panel, nextLeft, nextTop);
    };

    const startDrag = (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        if ($(event.target).closest('#resourcePanelFloatingClose').length){
            return;
        }
        const type = event.type.startsWith('pointer') ? 'pointer' : event.type.startsWith('mouse') ? 'mouse' : 'touch';
        if (dragging){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        const point = getPoint(event);
        startX = point.x;
        startY = point.y;
        baseLeft = rect.left;
        baseTop = rect.top;
        dragging = true;
        dragType = type;
        panel.addClass('is-dragging');
        panel.data('floatingPositionPinned', true);
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.resourcePanelDrag mousemove.resourcePanelDrag touchmove.resourcePanelDrag', moveDrag);
        $(document).on('pointerup.resourcePanelDrag pointercancel.resourcePanelDrag mouseup.resourcePanelDrag touchend.resourcePanelDrag touchcancel.resourcePanelDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    };

    panel.on('pointerdown.resourcePanelDrag mousedown.resourcePanelDrag touchstart.resourcePanelDrag', '#resourcePanelFloatingHeader', startDrag);

    $(window).on('resize.resourcePanelDrag', () => {
        const rect = panel[0].getBoundingClientRect();
        applyResourcePanelFloatingPosition(panel, rect.left, rect.top);
    });
}

function dockResourcesForTab(tab){
    const resources = $('#resources');
    if (!resources.length){
        return;
    }
    if (syncResourcesPanelHiddenState()){
        return;
    }
    if (global.race?.species === 'pinguicula'){
        if (global.settings){
            global.settings.resourcesFloating = false;
            global.settings.hideResourcesPanel = false;
        }
        resources.removeClass('resources-floating');
        if (save && save.removeItem){
            save.removeItem(resourcesFloatingKey);
            save.removeItem(resourcesPanelKey);
        }
    }
    const tabKey = getMainTabKey(tab);
    resources.removeClass('resources-civics resources-fixed');
    const topMount = $('#topResourcesMount').first();
    const leftColumn = $('.leftColumn').first();
    const isMobileViewport = typeof window !== 'undefined'
        && (window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : window.innerWidth <= 768);
    const hasResourcesTab = getMainTabKeys().includes('resources');
    if (isMobileViewport){
        if (topMount.length){
            topMount.removeClass('top-resources-floating is-dragging');
        }
        resources
            .removeClass('resources-floating resources-top resources-camp')
            .css({ left: '', top: '', right: '', bottom: '', transform: '', height: '' });
        resources.removeClass('resources-fixed');
        if (tabKey === 'resources' && hasResourcesTab){
            resources.removeClass('resources-mobile-hidden');
            if (topMount.length){
                if (!resources.parent().length || resources.parent()[0] !== topMount[0]){
                    resources.detach().prependTo(topMount);
                }
                else {
                    topMount.prepend(resources);
                }
                topMount.addClass('top-resources-inline');
            }
            else if (leftColumn.length){
                if (!resources.parent().length || resources.parent()[0] !== leftColumn[0]){
                    resources.detach().prependTo(leftColumn);
                }
                else {
                    leftColumn.prepend(resources);
                }
            }
        }
        else {
            if (hasResourcesTab){
                resources.addClass('resources-mobile-hidden');
                if (topMount.length){
                    topMount.removeClass('top-resources-inline');
                }
            }
            else {
                resources.removeClass('resources-mobile-hidden');
                if (topMount.length){
                    topMount.removeClass('top-resources-inline');
                }
                if (leftColumn.length){
                    if (!resources.parent().length || resources.parent()[0] !== leftColumn[0]){
                        resources.detach().prependTo(leftColumn);
                    }
                    else {
                        leftColumn.prepend(resources);
                    }
                }
            }
        }
        syncResourcesColumnLayout();
        return;
    }
    resources.removeClass('resources-mobile-hidden');
    if (topMount.length){
        topMount.removeClass('top-resources-inline');
    }
    const leftVisible = leftColumn.length && leftColumn.is(':visible');
    if (leftVisible && global.settings?.resourcesFloating){
        global.settings.resourcesFloating = false;
        if (save && save.removeItem){
            save.removeItem(resourcesFloatingKey);
        }
    }
    if (global.settings?.resourcesFloating){
        if (topMount.length){
            topMount.removeClass('top-resources-floating is-dragging');
        }
        const body = $('body').first();
        if (body.length && (!resources.parent().length || resources.parent()[0] !== body[0])){
            resources.detach().appendTo(body);
        }
        resources
            .removeClass('resources-top resources-camp')
            .removeClass('resources-fixed')
            .addClass('resources-floating')
            .css({
                transform: '',
                left: '',
                top: '',
                right: '',
                bottom: ''
            });
        restoreResourcesFloatingPosition();
        syncResourcesColumnLayout();
        return;
    }
    if (leftVisible){
        if (!resources.parent().length || resources.parent()[0] !== leftColumn[0]){
            resources.detach().prependTo(leftColumn);
        }
        else {
            leftColumn.prepend(resources);
        }
        resources.removeClass('resources-top');
        resources.addClass('resources-fixed');
        resources.css({ transform: '' });
        if (save && save.removeItem){
            save.removeItem(resourcesPanelKey);
        }
        topMount.removeClass('top-resources-floating is-dragging');
    }
    else if (topMount.length){
        if (!topMount.find('#topResourcesHeader').length){
            topMount.prepend(`<div id="topResourcesHeader" class="top-resources-header"><span>${loc('tab_resources')}</span></div>`);
        }
        const header = topMount.find('#topResourcesHeader').first();
        const placeResourcesInTop = () => {
            if (header.length){
                header.after(resources);
            }
            else {
                topMount.prepend(resources);
            }
        };
        if (!resources.parent().length || resources.parent()[0] !== topMount[0]){
            resources.detach();
            placeResourcesInTop();
        }
        else {
            placeResourcesInTop();
        }
        resources.addClass('resources-top');
        resources.removeClass('resources-fixed');
        topMount.addClass('top-resources-floating');
        setupTopResourcesDrag();
    }
    resources.removeClass('resources-floating resources-camp');
    resources.css({ left: '', top: '', right: '', bottom: '' });
    if (!resources.hasClass('resources-fixed')){
        restoreResourcesPanelPosition();
    }
    syncResourcesColumnLayout();
}

export function mainVue(){
    lastLocale = global.settings.locale;
    if (typeof global.settings.settingsModal === 'undefined'){
        global.settings.settingsModal = false;
    }
    else if (global.settings.settingsModal){
        global.settings.settingsModal = false;
    }
    if (global.race?.species === 'pinguicula'){
        global.settings.showEvolve = false;
        global.settings.showCiv = true;
        global.settings.showCity = true;
        global.settings.spaceTabs = 0;
        const civTabIndex = getMainTabKeys().indexOf('civ');
        if (civTabIndex >= 0){
            global.settings.civTabs = civTabIndex;
            global.settings.lastCivTab = civTabIndex;
        }
    }
    const maxTabIndex = getMainTabKeys().length - 1;
    if (!Number.isFinite(global.settings.civTabs) || global.settings.civTabs < 0 || global.settings.civTabs > maxTabIndex){
        global.settings.civTabs = 0;
    }
    if (!Number.isFinite(global.settings.lastCivTab)){
        global.settings.lastCivTab = Number.isFinite(global.settings.civTabs) ? global.settings.civTabs : 0;
    }
    if (global.settings.lastCivTab < 0 || global.settings.lastCivTab > maxTabIndex){
        global.settings.lastCivTab = global.settings.civTabs;
    }
    vBind({
        el: '#mainColumn div:first-child',
        data: {
            s: global.settings,
            race: global.race
        },
        methods: {
            swapTab(tab){
                global.settings.lastCivTab = tab;
                dockResourcesForTab(tab);
                if (!global.settings.tabLoad){
                    loadTab(tab);
                }
                ensureMilitaryTabFloatingToggle();
                ensureSmelterFloatingToggle();
                ensurePowerGridFloatingToggle();
                ensureGovernmentFloatingToggle();
                ensureResearchFloatingToggle();
                ensureResourcesPanelToggle();
                updateEvolutionBgm();
                ensureCivilCalendarDock();
                ensureMoraleDock();
                return tab;
            },
            openSettingsModal(){
                global.settings.settingsModal = true;
                dockResourcesForTab(global.settings.civTabs);
            },
            closeSettingsModal(){
                global.settings.settingsModal = false;
                dockResourcesForTab(global.settings.civTabs);
            },
            saveImport(){
                if ($('#importExport').val().length > 0){
                    importGame($('#importExport').val());
                }
            },
            saveExport(){
                $('#importExport').val(window.exportGame());
                $('#importExport').select();
                document.execCommand('copy');
            },
            saveExportFile(){
                const downloadToFile = (content, filename, contentType) => {
                    const a = document.createElement('a');
                    const file = new Blob([content], {type: contentType});
                    a.href= URL.createObjectURL(file);
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(a.href);
                };
                const date = new Date();
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toFixed(0).padStart(2, '0');
                const day = date.getDate().toFixed(0).padStart(2, '0');
                const hour = date.getHours().toFixed(0).padStart(2, '0');
                const minute = date.getMinutes().toFixed(0).padStart(2, '0');
                downloadToFile(window.exportGame(), `evolve-${year}-${month}-${day}-${hour}-${minute}.txt`, 'text/plain');
            },
            importStringFile(){ 
                let file = document.getElementById("stringPackFile").files[0];
                if (file) {
                    let reader = new FileReader();
                    let fileName = document.getElementById("stringPackFile").files[0].name;
                    reader.readAsText(file, "UTF-8");
                    reader.onload = function (evt) {
                        try {
                            JSON.parse(evt.target.result);
                        }
                        catch {
                            global.settings.sPackMsg = loc(`string_pack_error`,[fileName]);
                            return;
                        }
                       
                        global.settings.sPackMsg = loc(`string_pack_using`,[fileName]);
                        save.setItem('string_pack_name',fileName); save.setItem('string_pack',LZString.compressToUTF16(evt.target.result));
                        if (global.settings.sPackOn){
                            global.queue.rename = true;
                            save.setItem('evolved',LZString.compressToUTF16(JSON.stringify(global)));
                            if (webWorker.w){
                                webWorker.w.terminate();
                            }
                            window.location.reload();
                        }
                       
                    }
                    reader.onerror = function (evt) {
                        console.error("error reading file");
                    }
                }
            },
            clearStringFile(){
                if (save.getItem('string_pack')){
                    global.settings.sPackMsg = loc(`string_pack_none`);
                    save.removeItem('string_pack_name');
                    save.removeItem('string_pack');
                    if (global.settings.sPackOn){
                        global.queue.rename = true;
                        save.setItem('evolved',LZString.compressToUTF16(JSON.stringify(global)));
                        if (webWorker.w){
                            webWorker.w.terminate();
                        }
                        window.location.reload();
                    }
                }
            },
            stringPackOn(){
                if (save.getItem('string_pack')){
                    global.queue.rename = true;
                    save.setItem('evolved',LZString.compressToUTF16(JSON.stringify(global)));
                    if (webWorker.w){
                        webWorker.w.terminate();
                    }
                    window.location.reload();
                }
            },
            restoreGame(){
                let restore_data = save.getItem('evolveBak') || false;
                this.$buefy.dialog.confirm({
                    title: loc('restore'),
                    message: loc('restore_warning'),
                    ariaModal: true,
                    confirmText: loc('restore'),
                    onConfirm() {
                        if (restore_data){
                            importGame(restore_data,true);
                        }
                    }
                });
            },
            lChange(locale){
                const nextLocale = typeof locale === 'string' ? locale : this?.s?.locale;
                if (!nextLocale || lastLocale === nextLocale){
                    return;
                }
                lastLocale = nextLocale;
                global.settings.locale = nextLocale;
                global.queue.rename = true;
                save.setItem('evolved',LZString.compressToUTF16(JSON.stringify(global)));
                if (webWorker.w){
                    webWorker.w.terminate();
                }
                window.location.reload();
            },
            setTheme(theme){
                const nextTheme = typeof theme === 'string' ? theme : this?.s?.theme;
                if (!nextTheme){
                    return;
                }
                global.settings.theme = nextTheme;
                const html = $('html');
                html.removeClass(themeClasses.join(' '));
                html.addClass(nextTheme);
                html.addClass(global.settings.font);
            },
            numNotation(notation){
                global.settings.affix = notation;
            },
            setQueueStyle(style){
                global.settings.queuestyle = style;
                updateQueueStyle();
            },
            setQueueResize(mode) {
                global.settings.q_resize = mode;
            },
            icon(icon){
                global.settings.icon = icon;
                save.setItem('evolved',LZString.compressToUTF16(JSON.stringify(global)));
                if (webWorker.w){
                    webWorker.w.terminate();
                }
                window.location.reload();
            },
            remove(index){
                global.r_queue.queue.splice(index,1);
            },
            font(f){
                global.settings.font = f;
                $(`html`).removeClass('standard');
                $(`html`).removeClass('large_log');
                $(`html`).removeClass('large_all');
                $('html').addClass(f);
            },
            q_merge(merge){
                global.settings.q_merge = merge;
            },
            toggleTabLoad(){
                initTabs();
            },
            unpause(){
                $(`#pausegame`).removeClass('play');
                $(`#pausegame`).removeClass('pause');
                if (global.settings.pause){
                    $(`#pausegame`).addClass('pause');
                }
                else {
                    $(`#pausegame`).addClass('play');
                }
                if (!global.settings.pause && !webWorker.s){
                    gameLoop('start');
                }
            }
        },
        filters: {
            namecase(name){
                return name.replace(/(?:^|\s)\w/g, function(match) {
                    return match.toUpperCase();
                });
            },
            label(lbl){
                return tabLabel(lbl);
            },
            sPack(){
                return global.settings.sPackMsg;
            },
            notation(n){
                switch (n){
                    case 'si':
                        return loc(`metric`);
                    case 'sci':
                        return loc(`scientific`);
                    case 'eng':
                        return loc(`engineering`);
                    case 'sln':
                        return loc(`sln`);
                }
            }
        }
    });

    ['1','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17'].forEach(function(k){
        popover(`settings${k}`, function(){
                return loc(`settings${k}`);
            },
            {
                elm: `#settings span.settings${k}`
            }
        );
    });

    let example = `<div class="example">{
  "year": "Galactic Standard Year",
  "resource_Food_name": "Nom Noms"
}</div>`;

    popover(`stringPack`, function(){
            return loc(`string_example`,[example]);
        }
    );
}

function tabLabel(lbl){
    switch (lbl){
        case 'city':
            if (global.resource[global.race.species]){
                if (global.resource[global.race.species].amount <= 5){
                    return loc('tab_city1');
                }
                else if (global.resource[global.race.species].amount <= 20){
                    return loc('tab_city2');
                }
                else if (global.resource[global.race.species].amount <= 75){
                    return loc('tab_city3');
                }
                else if (global.resource[global.race.species].amount <= 250){
                    return loc('tab_city4');
                }
                else if (global.resource[global.race.species].amount <= 600){
                    return loc('tab_city5');
                }
                else if (global.resource[global.race.species].amount <= 1200){
                    return loc('tab_city6');
                }
                else if (global.resource[global.race.species].amount <= 2500){
                    return loc('tab_city7');
                }
                else {
                    return loc('tab_city8');
                }
            }
            else {
                return loc('tab_city1');
            }
        case 'local_space':
            return loc('sol_system',[global.race['truepath'] ? races[global.race.species].home : flib('name')]);
        case 'outer_local_space':
            return loc('outer_sol_system',[global.race['truepath'] ? races[global.race.species].home : flib('name')])
        case 'old':
            return loc('tab_old_res');
        case 'new':
            return loc('tab_new_res');
        case 'old_sr':
            return loc('tab_old_sr_res');
        case 'new_sr':
            return loc('tab_new_sr_res');
        case 'tab_mech':
            return global.race['warlord'] ? loc('tab_artificer')  : loc(lbl);
        default:
            return loc(lbl);
    }
}

function updateQueueStyle(){
    const queueTargets = $('#buildQueue, #resQueue');
    ['standardqueuestyle', 'listqueuestyle', 'bulletlistqueuestyle', 'numberedlistqueuestyle']
        .forEach(qstyle => {
            if (global.settings.queuestyle === qstyle) {
                queueTargets.addClass(qstyle);
            } else {
                queueTargets.removeClass(qstyle);
            }
        });
}

function ensureOuterMilitaryPanel(){
    if (!global.settings.showMil){
        return null;
    }
    $('#civic-military').remove();
    const queueColumn = $('#queueColumn');
    if (!queueColumn.length){
        return null;
    }
    let panel = queueColumn.find('#civic-military-panel');
    if (!panel.length){
        panel = $('<div id="civic-military-panel" class="civic-military-panel"></div>');
        panel.append(`<div id="civicMilitaryHeader" class="civic-military-header" aria-label="${loc('tab_military')}"></div>`);
        panel.append('<div id="civic-military-content" class="civic-military-content"></div>');
        queueColumn.append(panel);
    }
    queueColumn.addClass('has-civic-military');
    setupCivicMilitaryDrag();
    return panel.find('#civic-military-content');
}

function dockMilitaryToQueueColumn(){
    if (!global.settings.showMil){
        return;
    }
    const target = ensureOuterMilitaryPanel();
    const military = $('#military');
    if (!target || !target.length || !military.length){
        return;
    }
    if (!military.children().length){
        return;
    }
    clearElement(target);
    target.append(military.children());
}

function clearQueueMilitaryContent(){
    const queueColumn = $('#queueColumn');
    const target = $('#civic-military-content');
    if (target.length){
        clearElement(target);
    }
    if (queueColumn.length){
        queueColumn.removeClass('has-civic-military');
    }
}

function renderResourceTabContent(containerSelector, options = {}){
    const container = $(containerSelector);
    if (!container.length){
        return;
    }
    const force = options.force !== false;
    if (!force && container.children().length){
        return;
    }
    clearElement(container);
    container.append(`<b-tabs class="resTabs" v-model="s.marketTabs" :animated="s.animated" @input="swapTab">
        <b-tab-item id="market" :visible="s.showMarket">
            <template slot="header">
                {{ 'tab_market' | label }}
            </template>
        </b-tab-item>
        <b-tab-item id="resStorage" :visible="s.showStorage">
            <template slot="header">
                {{ 'tab_storage' | label }}
            </template>
        </b-tab-item>
        <b-tab-item id="resEjector" :visible="s.showEjector">
            <template slot="header">
                {{ 'tab_ejector' | label }}
            </template>
        </b-tab-item>
        <b-tab-item id="resCargo" :visible="s.showCargo">
            <template slot="header">
                {{ 'tab_cargo' | label }}
            </template>
        </b-tab-item>
        <b-tab-item id="resAlchemy" :visible="s.showAlchemy">
            <template slot="header">
                {{ 'tab_alchemy' | label }}
            </template>
        </b-tab-item>
    </b-tabs>`);
    vBind({
        el: containerSelector,
        data: {
            s: global.settings
        },
        methods: {
            swapTab(tab){
                if (tab === 0){
                    closeOtherFloatingPanels('resource');
                }
                if (!global.settings.tabLoad){
                    clearElement($(`#market`));
                    clearElement($(`#resStorage`));
                    clearElement($(`#resEjector`));
                    clearElement($(`#resCargo`));
                    clearElement($(`#resAlchemy`));
                    switch (tab){
                        case 0:
                            {
                                drawResourceTab('market');
                            }
                            break;
                        case 1:
                            {
                                drawResourceTab('storage');
                            }
                            break;
                        case 2:
                            {
                                drawResourceTab('ejector');
                            }
                            break;
                        case 3:
                            {
                                drawResourceTab('supply');
                            }
                            break;
                        case 4:
                            {
                                drawResourceTab('alchemy');
                            }
                            break;
                    }
                }
                return tab;
            }
        },
        filters: {
            label(lbl){
                return tabLabel(lbl);
            },
            planet(species){
                return races[species].home;
            }
        }
    });
    const mainVueInstance = $('#mainColumn div:first-child')[0]?.__vue__;
    const afterMainVue = () => {
        ensureCivilCalendarDock();
        ensureMoraleDock();
    };
    if (mainVueInstance && mainVueInstance.$nextTick){
        mainVueInstance.$nextTick(afterMainVue);
    }
    else {
        setTimeout(afterMainVue, 0);
    }
    $(window).off('resize.calendarDock').on('resize.calendarDock', () => {
        ensureCivilCalendarDock();
        ensureMoraleDock();
    });

    const populateResourceTabs = () => {
        initResourceTabs();
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
            
                if (atomic_mass[name]){
                    loadEjector(name,color);
                }
            
                if (supplyValue[name]){
                    loadSupply(name,color);
                }
            
                if (tradeRatio[name] && global.race.universe === 'magic'){
                    global['resource'][name]['basic'] = tradable;
                    loadAlchemy(name,color,tradable);
                }
            });
        }
        tradeSummery();
    };
    const containerVue = container[0]?.__vue__;
    if (containerVue && containerVue.$nextTick){
        containerVue.$nextTick(populateResourceTabs);
    }
    else {
        setTimeout(populateResourceTabs, 0);
    }
}

export function initTabs(){
    ensureVisibleMainTab();
    if (global.race?.species === 'pinguicula'){
        global.settings.showEvolve = false;
        global.settings.showCiv = true;
        global.settings.showCity = true;
        global.settings.spaceTabs = 0;
        const civTabIndex = getMainTabKeys().indexOf('civ');
        if (civTabIndex >= 0){
            global.settings.civTabs = civTabIndex;
            global.settings.lastCivTab = civTabIndex;
        }
    }
    if (global.settings.tabLoad){
        loadTab(`mTabCivil`);
        loadTab(`mTabCivic`);
        if (!global.settings.researchFloatingOnly){
            loadTab(`mTabResearch`);
        }
        loadTab(`mTabResource`);
        loadTab(`mTabArpa`);
        loadTab(`mTabStats`);
        loadTab(`mTabObserve`);
    }
    else {
        loadTab(global.settings.civTabs);
    }
    setTimeout(() => {
        const changed = ensureVisibleMainTab();
        if (changed && !global.settings.tabLoad){
            loadTab(global.settings.civTabs);
        }
        if (global.race?.species === 'pinguicula'){
            global.settings.showEvolve = false;
            global.settings.showCiv = true;
            global.settings.showCity = true;
            global.settings.spaceTabs = 0;
            const civTabIndex = getMainTabKeys().indexOf('civ');
            if (civTabIndex >= 0 && global.settings.civTabs !== civTabIndex){
                global.settings.civTabs = civTabIndex;
                global.settings.lastCivTab = civTabIndex;
                if (!global.settings.tabLoad){
                    loadTab(global.settings.civTabs);
                }
            }
            const civPanel = $('#mTabCivil').closest('.tab-item');
            if (civPanel.length){
                civPanel.css('display', 'block');
            }
        }
    }, 0);
    if (global.settings){
        global.settings.resourcePanelFloating = true;
        global.settings.researchFloatingOpen = false;
    }
    if (shouldShowResourcePanelFloating()){
        renderResourceTabContent(`#mTabResource`, { force: false });
    }
    ensureResourcePanelFloating();
    ensureMilitaryTabFloatingToggle();
    ensureSmelterFloatingToggle();
    ensurePowerGridFloatingToggle();
    ensureGovernmentFloatingToggle();
    ensureResearchFloatingToggle();
    ensureResourcesPanelToggle();
    setTimeout(() => {
        ensureResourcePanelFloating();
        ensureMilitaryTabFloatingToggle();
        ensureSmelterFloatingToggle();
        ensurePowerGridFloatingToggle();
        ensureGovernmentFloatingToggle();
        ensureResearchFloatingToggle();
        ensureResourcesPanelToggle();
    }, 200);
    updateEvolutionBgm();
}

function renderCivicTab(containerSelector){
    const container = $(containerSelector);
    if (containerSelector === '#civilSplitCivic' || containerSelector === '#civilTripleCivic'){
        global.settings.civicEmbedded = true;
    }
    clearElement(container);
    container.append(`<b-tabs class="resTabs civicTabs" v-model="s.govTabs" :animated="s.animated" @input="swapTab">
        <b-tab-item id="civic">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_gov' | label }}</h2>
                <span aria-hidden="true">{{ 'tab_gov' | label }}</span>
            </template>
        </b-tab-item>
        <b-tab-item id="industry" class="industryTab" :visible="s.showIndustry">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_industry' | label }}</h2>
                <span aria-hidden="true">{{ 'tab_industry' | label }}</span>
            </template>
        </b-tab-item>
        <b-tab-item id="powerGrid" class="powerGridTab" :visible="s.showPowerGrid">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_power_grid' | label }}</h2>
                <span aria-hidden="true">{{ 'tab_power_grid' | label }}</span>
            </template>
        </b-tab-item>
        <b-tab-item id="military" class="militaryTab" :visible="s.showMil">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_military' | label }}</h2>
                <span aria-hidden="true" class="military-tab-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag-icon lucide-flag"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/></svg></span>
            </template>
        </b-tab-item>
        <b-tab-item id="mechLab" class="mechTab" :visible="s.showMechLab">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_mech' | label }}</h2>
                <span aria-hidden="true">{{ 'tab_mech' | label }}</span>
            </template>
        </b-tab-item>
        <b-tab-item id="dwarfShipYard" class="ShipYardTab" :visible="s.showShipYard">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_shipyard' | label }}</h2>
                <span aria-hidden="true">{{ 'tab_shipyard' | label }}</span>
            </template>
        </b-tab-item>
        <b-tab-item id="psychicPowers" class="psychicTab" :visible="s.showPsychic">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_psychic' | label }}</h2>
                <span aria-hidden="true">{{ 'tab_psychic' | label }}</span>
            </template>
        </b-tab-item>
        <b-tab-item id="supernatural" class="supernaturalTab" :visible="s.showWish">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'tab_supernatural' | label }}</h2>
                <span aria-hidden="true">{{ 'tab_supernatural' | label }}</span>
            </template>
        </b-tab-item>
    </b-tabs>`);
    vBind({
        el: containerSelector,
        data: {
            s: global.settings
        },
        methods: {
            swapTab(tab){
                if (!global.settings.tabLoad){
                    clearGrids();
                    clearSpyopDrag();
                    clearMechDrag();
                    clearShipDrag();
                    clearElement($(`#civic`));
                    clearElement($(`#industry`));
                    clearElement($(`#powerGrid`));
                    clearElement($(`#military`));
                    clearElement($(`#mechLab`));
                    clearElement($(`#dwarfShipYard`));
                    clearElement($(`#psychicPowers`));
                    clearElement($(`#supernatural`));
                    switch (tab){
                        case 0:
                            {
                                $('#civic').append($('<div id="civics" class="tile is-parent"></div>'));
                                defineJobs();
                                $('#civics').append($('<div id="r_civics" class="tile is-vertical is-parent civics"></div>'));
                                defineGovernment();
                                if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                    commisionGarrison();
                                    buildGarrison($('#c_garrison'),false);
                                    foreignGov();
                                    if (global.settings.showMil){
                                        defineGarrison(true);
                                        if (!global.race['warlord']){
                                            buildFortress($('#fortress'),false);
                                        }
                                        dockMilitaryToQueueColumn();
                                    }
                                }
                                if (global.race['shapeshifter']){
                                    shapeShift(false,true);
                                }
                                ensureCivicMarketEmbed();
                            }
                            break;
                        case 1:
                            defineIndustry();
                            break;
                        case 2:
                            {
                                Object.keys(gridDefs()).forEach(function(gridtype){
                                    powerGrid(gridtype);
                                });
                                setPowerGrid();
                            }
                            break;
                        case 3:
                            if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                clearQueueMilitaryContent();
                                defineGarrison();
                                if (!global.race['warlord']){
                                    buildFortress($('#fortress'),false);
                                }
                            }
                            break;
                        case 4:
                            if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                drawMechLab();
                            }
                            break;
                        case 5:
                            if (global.race['truepath'] && global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                drawShipYard();
                            }
                            break;
                        case 6:
                            if (global.race['psychic'] && global.tech['psychic'] && global.race.species !== 'protoplasm'){
                                renderPsychicPowers();
                            }
                            break;
                case 7:
                            if (((global.race['wish'] && global.tech['wish']) || global.race['ocular_power']) && global.race.species !== 'protoplasm'){
                                renderSupernatural();
                            }
                            break;
                    }
                }
                ensureMilitaryTabFloatingToggle();
                ensureSmelterFloatingToggle();
                ensurePowerGridFloatingToggle();
                ensureGovernmentFloatingToggle();
                ensureResearchFloatingToggle();
                ensureResourcesPanelToggle();
                return tab;
            }
        },
        filters: {
            label(lbl){
                return tabLabel(lbl);
            }
        }
    });

    Object.keys(gridDefs()).forEach(function(gridtype){
        powerGrid(gridtype);
    });
    setPowerGrid();

    $('#civic').append($('<div id="civics" class="tile is-parent"></div>'));
    defineJobs();
    $('#civics').append($('<div id="r_civics" class="tile is-vertical is-parent civics"></div>'));
    defineGovernment();
    if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
        buildGarrison($('#c_garrison'),false);
        foreignGov();
        if (global.settings.showMil){
            defineGarrison(true);
            if (!global.race['warlord']){
                buildFortress($('#fortress'),false);
            }
            dockMilitaryToQueueColumn();
        }
        drawMechLab();
        if (global.race['truepath']){
            drawShipYard();
        }
        if (global.race['psychic'] && global.tech['psychic']){
            renderPsychicPowers();
        }
        if ((global.race['wish'] && global.tech['wish']) || global.race['ocular_power']){
            renderSupernatural();
        }
    }
    if (global.race['shapeshifter']){
        shapeShift(false,true);
    }
    ensureCivicMarketEmbed();
    defineIndustry();
}

export function loadTab(tab){
    if (typeof tab === 'number'){
        global.settings.lastCivTab = tab;
    }
    const tabKey = resolveMainTabKey(tab);
    if (!global.settings.tabLoad){
        const resources = $('#resources');
        if (resources.length && resources.closest('#mTabCivic').length){
            const leftColumn = $('.leftColumn').first();
            if (leftColumn.length){
                resources.detach().prependTo(leftColumn);
            }
            else {
                $('body').append(resources);
            }
            resources.removeClass('resources-civics');
        }
        clearResDrag();
        clearGrids();
        clearMechDrag();
        clearGeneticsDrag();
        clearSpyopDrag();
        clearShipDrag();
        const racePanel = $('#race');
        if (racePanel.length && racePanel.closest('#mTabCivil').length){
            const leftColumn = $('.leftColumn').first();
            if (leftColumn.length){
                leftColumn.prepend(racePanel);
            }
        }
        clearElement($(`#mTabCivil`));
        clearElement($(`#mTabCivic`));
        clearElement($(`#mTabResearch`));
        if (!global.settings?.resourcePanelFloating){
            clearElement($(`#mTabResource`));
        }
        clearElement($(`#mTabArpa`));
        clearElement($(`#mTabStats`));
        clearElement($(`#mTabObserve`));
    }
    else {
        tagEvent('page_view',{ page_title: `Evolve - All Tabs` });
    }
    switch (tabKey){
        case 0:
        case 'evolution':
            if (!global.settings.tabLoad){
                tagEvent('page_view',{ page_title: `Evolve - Evolution` });
                drawEvolution();
            }
            break;
        case 1:
        case 'mTabCivil':
        case 'civ':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Civilization` });
                }
                const showResearchColumn = !global.settings?.researchFloatingOnly;
                const hideSidePanels = true;
                $(`#mTabCivil`).append(`
                    <div id="civilTriple" class="columns is-gapless civil-triple">
                        ${showResearchColumn
                            ? `<div id="civilTripleCity" class="column is-4"></div>
                               <div id="civilTripleResearch" class="column is-4"></div>
                               <div id="civilTripleCivic" class="column is-4"></div>`
                            : `<div id="civilTripleCity" class="column is-6"></div>
                               <div id="civilTripleCivic" class="column is-6"></div>`
                        }
                    </div>
                `);
                const civilMain = $(`#civilTripleCity`);
                let raceDock = $('#civilRaceDock');
                if (!raceDock.length){
                    raceDock = $(`<div id="civilRaceDock" class="civil-race-dock"></div>`);
                    civilMain.prepend(raceDock);
                }
                else if (!raceDock.parent().is(civilMain)){
                    raceDock.detach().prependTo(civilMain);
                }
                const racePanel = $('#race');
                if (racePanel.length && !racePanel.parent().is(raceDock)){
                    racePanel.detach().appendTo(raceDock);
                }
                civilMain.append(`<div id="civilSplitMain" class="civil-split-main"></div>`);
                const cityMain = $(`#civilSplitMain`);
                cityMain.append(`<b-tabs class="resTabs" v-model="s.spaceTabs" :animated="s.animated" @input="swapTab">
                    <b-tab-item id="city" :visible="s.showCity">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'city' | label }}</h2>
                            <span aria-hidden="true">{{ 'city' | label }}</span>
                        </template>
                    </b-tab-item>
                    <b-tab-item id="space" :visible="s.showSpace">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'local_space' | label }}</h2>
                            <span aria-hidden="true">{{ 'local_space' | label }}</span>
                        </template>
                    </b-tab-item>
                    <b-tab-item id="interstellar" :visible="s.showDeep">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'tab_interstellar' | label }}</h2>
                            <span aria-hidden="true">{{ 'tab_interstellar' | label }}</span>
                        </template>
                    </b-tab-item>
                    <b-tab-item id="galaxy" :visible="s.showGalactic">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'tab_galactic' | label }}</h2>
                            <span aria-hidden="true">{{ 'tab_galactic' | label }}</span>
                        </template>
                    </b-tab-item>
                    <b-tab-item id="portal" :visible="s.showPortal">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'tab_portal' | label }}</h2>
                            <span aria-hidden="true">{{ 'tab_portal' | label }}</span>
                        </template>
                    </b-tab-item>
                    <b-tab-item id="outerSol" :visible="s.showOuter">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'outer_local_space' | label }}</h2>
                            <span aria-hidden="true">{{ 'outer_local_space' | label }}</span>
                        </template>
                    </b-tab-item>
                    <b-tab-item id="tauceti" :visible="s.showTau">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'tab_tauceti' | label }}</h2>
                            <span aria-hidden="true">{{ 'tab_tauceti' | label }}</span>
                        </template>
                    </b-tab-item>
                    <b-tab-item id="eden" :visible="s.showEden">
                        <template slot="header">
                            <h2 class="is-sr-only">{{ 'tab_eden' | label }}</h2>
                            <span aria-hidden="true">{{ 'tab_eden' | label }}</span>
                        </template>
                    </b-tab-item>
                </b-tabs>`);
                vBind({
                    el: `#civilSplitMain`,
                    data: {
                        s: global.settings
                    },
                    methods: {
                        swapTab(tab){
                            if (!global.settings.tabLoad){
                                clearElement($(`#city`));
                                clearElement($(`#space`));
                                clearElement($(`#interstellar`));
                                clearElement($(`#galaxy`));
                                clearElement($(`#portal`));
                                clearElement($(`#outerSol`));
                                clearElement($(`#tauCeti`));
                                clearElement($(`#eden`));
                                switch (tab){
                                    case 0:
                                        drawCity(true);
                                        break;
                                    case 1:
                                    case 2:
                                    case 3:
                                    case 5:
                                        renderSpace();
                                        break;
                                    case 4:
                                        renderFortress();
                                        break;
                                    case 6:
                                        renderTauCeti();
                                        break;
                                    case 7:
                                        renderEdenic();
                                        break;
                                }
                            }
                            return tab;
                        }
                    },
                    filters: {
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });
                if (global.race.species !== 'protoplasm'){
                    drawCity(true);
                    renderSpace();
                    renderFortress();
                    renderTauCeti();
                    renderEdenic();
                }
                if (global.race['noexport']){
                    if (global.race['noexport'] === 'Race'){
                        clearElement($(`#city`));
                        ascendLab();
                    }
                    else if (global.race['noexport'] === 'Hybrid'){
                        clearElement($(`#city`));
                        ascendLab(true);
                    }
                    else if (global.race['noexport'] === 'Planet'){
                        clearElement($(`#city`));
                        terraformLab();
                    }
                }
                if (!global.settings.tabLoad){
                    if (hideSidePanels){
                        clearElement($('#civilTripleResearch'));
                        clearElement($('#civilTripleCivic'));
                        if (global.settings){
                            global.settings.researchEmbedded = false;
                            global.settings.civicEmbedded = false;
                        }
                    }
                    else {
                        if (showResearchColumn){
                            if (global.settings?.researchFloatingOpen){
                                clearElement($('#civilTripleResearch'));
                                ensureResearchFloatingPanelVisibility();
                            }
                            else {
                                renderResearchTab('#civilTripleResearch');
                            }
                        }
                        renderCivicTab('#civilTripleCivic');
                    }
                }
            }
            break;
        case 2:
        case 'mTabCivic':
        case 'civic':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Civics` });
                }
                renderCivicTab('#mTabCivic');
            }
            break;
        case 3:
        case 'mTabResearch':
        case 'research':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Research` });
                }
                if (global.settings?.researchFloatingOnly){
                    ensureResearchFloatingPanelVisibility();
                    break;
                }
                if (global.settings?.researchFloatingOpen){
                    clearElement($('#mTabResearch'));
                    ensureResearchFloatingPanelVisibility();
                }
                else {
                    renderResearchTab('#mTabResearch');
                }
            }
            break;
        case 4:
        case 'mTabResource':
        case 'resources':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Resources` });
                    const shouldRender = !global.settings?.resourcePanelFloating || !$('#mTabResource').children().length;
                    if (shouldRender){
                        renderResourceTabContent(`#mTabResource`, { force: true });
                    }
                }
                ensureResourcePanelFloating();
            }
            break;
        case 5:
        case 'mTabArpa':
        case 'arpa':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Arpa` });
                }
                $(`#mTabArpa`).append(`<div id="apra" class="arpa">
                    <b-tabs class="resTabs" v-model="s.arpa.arpaTabs" :animated="s.animated">
                        <b-tab-item id="arpaPhysics" :visible="s.arpa.physics" label="${loc('tab_arpa_projects')}"></b-tab-item>
                        <b-tab-item id="arpaGenetics" :visible="s.arpa.genetics" label="${loc(global.race['artifical'] ? 'tab_arpa_machine' : 'tab_arpa_genetics')}"></b-tab-item>
                        <b-tab-item id="arpaCrispr" :visible="s.arpa.crispr" label="${loc('tab_arpa_crispr')}"></b-tab-item>
                        <b-tab-item id="arpaBlood" :visible="s.arpa.blood" label="${loc('tab_arpa_blood')}"></b-tab-item>
                    </b-tabs>
                </div>`);
                vBind({
                    el: `#mTabArpa`,
                    data: {
                        s: global.settings
                    },
                    filters: {
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });
                arpa('Physics');
                arpa('Genetics');
                arpa('Crispr');
                arpa('Blood');
            }
            break;
        case 6:
        case 'mTabStats':
        case 'stats':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Stats` });
                }
                $(`#mTabStats`).append(`<b-tabs class="resTabs" v-model="s.statsTabs" :animated="s.animated">
                    <b-tab-item id="stats">
                        <template slot="header">
                            {{ 'tab_stats' | label }}
                        </template>
                    </b-tab-item>
                    <b-tab-item id="achieve">
                        <template slot="header">
                            {{ 'tab_achieve' | label }}
                        </template>
                    </b-tab-item>
                    <b-tab-item id="perks">
                        <template slot="header">
                            {{ 'tab_perks' | label }}
                        </template>
                    </b-tab-item>
                </b-tabs>`);
                vBind({
                    el: `#mTabStats`,
                    data: {
                        s: global.settings
                    },
                    filters: {
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });
                setupStats();
            }
            break;
        case 7:
            if (!global.settings.tabLoad){
                tagEvent('page_view',{ page_title: `Evolve - Settings` });
            }
            break;
        case 'mTabObserve':
        case 'observe':
    default:
        if (!global.settings.tabLoad){
            tagEvent('page_view',{ page_title: `Evolve - Hell Observation` });
        }
        if (global.portal.observe){
            drawHellObservations(true);
        }
        break;
    }
    dockResourcesForTab(typeof tab === 'number' ? tab : global.settings.civTabs);
    if (global.settings?.resourcePanelFloating){
        ensureResourcePanelFloating();
    }
    if ($(`#popper`).length > 0 && $(`#${$(`#popper`).data('id')}`).length === 0){
        clearPopper();
    }
}

function setupMsgQueueDrag(){
    const msgQueue = $('#msgQueue');
    if (!msgQueue.length || !msgQueue.hasClass('msgQueue-floating')){
        return;
    }
    const doc = $(document);
    if (doc.data('msgQueueDragBound')){
        return;
    }
    doc.data('msgQueueDragBound', true);

    const key = 'evolve.msgQueuePanelPos';
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const applyPosition = (panel, left, top) => {
        const rect = panel[0].getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);
        const nextLeft = clamp(left, 0, maxLeft);
        const nextTop = clamp(top, 0, maxTop);
        panel.css({
            left: `${nextLeft}px`,
            top: `${nextTop}px`,
            right: 'auto',
            bottom: 'auto'
        });
        return { left: nextLeft, top: nextTop };
    };

    const restorePosition = () => {
        const panel = $('#msgQueuePanel');
        if (!panel.length || !(save && save.getItem)){
            return;
        }
        const raw = save.getItem(key);
        if (!raw){
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
                applyPosition(panel, parsed.x, parsed.y);
            }
        }
        catch (err){
            // Ignore malformed saved positions.
        }
    };

    restorePosition();

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        const panel = $('#msgQueuePanel');
        panel.removeClass('is-dragging');
        $(document).off('pointermove.msgQueueDrag pointerup.msgQueueDrag pointercancel.msgQueueDrag');
        if (panel.length && save && save.setItem){
            const rect = panel[0].getBoundingClientRect();
            save.setItem(key, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
        }
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        const panel = $('#msgQueuePanel');
        if (!panel.length){
            stopDrag();
            return;
        }
        applyPosition(panel, startLeft + (event.clientX - startX), startTop + (event.clientY - startY));
    };

    doc.on('pointerdown.msgQueueDrag', '#msgQueueHeader', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        if ($(event.target).closest('.special, .zero, .msgQueueToggle').length){
            return;
        }
        const panel = $('#msgQueuePanel');
        if (!panel.length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        panel.css({
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            right: 'auto',
            bottom: 'auto'
        });
        dragging = true;
        panel.addClass('is-dragging');
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.msgQueueDrag', moveDrag);
        $(document).on('pointerup.msgQueueDrag pointercancel.msgQueueDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    });

    $(window).on('resize.msgQueueDrag', () => {
        const panel = $('#msgQueuePanel');
        if (!panel.length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        applyPosition(panel, rect.left, rect.top);
    });
}

function setupResourcesFloatingDrag(){
    const doc = $(document);
    if (doc.data('resourcesFloatingDragBound')){
        return;
    }
    doc.data('resourcesFloatingDragBound', true);

    let dragging = false;
    let pending = false;
    let dragType = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const dragThreshold = 4;

    const isTouchPointer = (event) => event.pointerType === 'touch' || event.type.startsWith('touch');
    const getPoint = (event) => {
        if (event?.touches?.length){
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        if (event?.changedTouches?.length){
            return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        }
        return { x: event.clientX, y: event.clientY };
    };
    const getEventType = (event) => event.type.startsWith('pointer') ? 'pointer' : event.type.startsWith('mouse') ? 'mouse' : 'touch';

    const stopDrag = () => {
        if (!dragType){
            return;
        }
        const wasDragging = dragging;
        dragging = false;
        pending = false;
        dragType = null;
        const panel = $('#resources');
        if (panel.length){
            panel.removeClass('is-dragging');
            if (wasDragging){
                panel.data('justDragged', true);
            }
        }
        $(document).off('pointermove.resourcesDrag pointerup.resourcesDrag pointercancel.resourcesDrag mousemove.resourcesDrag mouseup.resourcesDrag touchmove.resourcesDrag touchend.resourcesDrag touchcancel.resourcesDrag');
        if (panel.length && wasDragging && save && save.setItem){
            const rect = panel[0].getBoundingClientRect();
            save.setItem(resourcesFloatingKey, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
        }
    };

    const moveDrag = (event) => {
        if (!dragType){
            return;
        }
        const type = getEventType(event);
        if (dragType && type !== dragType){
            return;
        }
        const panel = $('#resources');
        if (!panel.length){
            stopDrag();
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
            panel.addClass('is-dragging');
            panel.css({
                left: `${startLeft}px`,
                top: `${startTop}px`,
                right: 'auto',
                bottom: 'auto'
            });
            if (event.pointerId !== undefined && panel[0]?.setPointerCapture){
                panel[0].setPointerCapture(event.pointerId);
            }
        }
        applyResourcesFloatingPosition(panel, startLeft + dx, startTop + dy);
        if (event.cancelable){
            event.preventDefault();
        }
    };

    const startDrag = (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        if (dragType){
            return;
        }
        const panel = $('#resources');
        if (!panel.length || !panel.hasClass('resources-floating')){
            return;
        }
        const isHeader = $(event.target).closest('#resourcesFloatingHeader').length > 0;
        if (isTouchPointer(event) && !isHeader){
            return;
        }
        if (!isHeader && $(event.target).closest('button, a, input, textarea, select, [role="button"], .job-avatar-control, .resource-job-panel, .resource-job-controls, .resource-resize-handle').length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        const point = getPoint(event);
        startX = point.x;
        startY = point.y;
        startLeft = rect.left;
        startTop = rect.top;
        dragType = getEventType(event);
        if (isHeader){
            panel.css({
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                right: 'auto',
                bottom: 'auto'
            });
            dragging = true;
            panel.addClass('is-dragging');
            if (event.pointerId !== undefined && panel[0]?.setPointerCapture){
                panel[0].setPointerCapture(event.pointerId);
            }
        }
        else {
            pending = true;
        }
        $(document).on('pointermove.resourcesDrag mousemove.resourcesDrag touchmove.resourcesDrag', moveDrag);
        $(document).on('pointerup.resourcesDrag pointercancel.resourcesDrag mouseup.resourcesDrag touchend.resourcesDrag touchcancel.resourcesDrag', stopDrag);
        if (isHeader){
            event.preventDefault();
            event.stopPropagation();
        }
    };

    doc.on('pointerdown.resourcesDrag mousedown.resourcesDrag touchstart.resourcesDrag', '#resources', startDrag);

    doc.on('click.resourcesDrag', '#resources', (event) => {
        const panel = $('#resources');
        if (!panel.length){
            return;
        }
        if (panel.data('justDragged')){
            panel.data('justDragged', false);
            event.preventDefault();
            event.stopPropagation();
        }
    });

    $(window).on('resize.resourcesDrag', () => {
        const panel = $('#resources');
        if (!panel.length || !panel.hasClass('resources-floating')){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        applyResourcesFloatingPosition(panel, rect.left, rect.top);
    });
}

function applyCivicMilitaryFloatingPosition(panel, left, top){
    const rect = panel[0].getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const nextLeft = Math.min(Math.max(left, 0), maxLeft);
    const nextTop = Math.min(Math.max(top, 0), maxTop);
    panel.css({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        right: 'auto',
        bottom: 'auto'
    });
    return { left: nextLeft, top: nextTop };
}

function restoreCivicMilitaryPosition(panel){
    if (!panel.length || !(save && save.getItem)){
        return false;
    }
    const raw = save.getItem(civicMilitaryFloatingKey);
    if (!raw){
        return false;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applyCivicMilitaryFloatingPosition(panel, parsed.x, parsed.y);
            return true;
        }
    }
    catch (err){
        // Ignore malformed saved positions.
    }
    return false;
}

function setupCivicMilitaryDrag(){
    const panel = $('#civic-military-panel');
    if (!panel.length){
        return;
    }

    if (!panel.data('floatingInitialized')){
        const rect = panel[0].getBoundingClientRect();
        panel.addClass('civic-military-floating');
        if (!restoreCivicMilitaryPosition(panel) && rect.width > 0 && rect.height > 0){
            applyCivicMilitaryFloatingPosition(panel, rect.left, rect.top);
        }
        panel.data('floatingInitialized', true);
    }

    const doc = $(document);
    if (doc.data('civicMilitaryDragBound')){
        return;
    }
    doc.data('civicMilitaryDragBound', true);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        const panel = $('#civic-military-panel');
        panel.removeClass('is-dragging');
        $(document).off('pointermove.civicMilitaryDrag pointerup.civicMilitaryDrag pointercancel.civicMilitaryDrag');
        if (panel.length && save && save.setItem){
            const rect = panel[0].getBoundingClientRect();
            save.setItem(civicMilitaryFloatingKey, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
        }
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        const panel = $('#civic-military-panel');
        if (!panel.length){
            stopDrag();
            return;
        }
        applyCivicMilitaryFloatingPosition(panel, startLeft + (event.clientX - startX), startTop + (event.clientY - startY));
    };

    doc.on('pointerdown.civicMilitaryDrag', '#civicMilitaryHeader', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        const panel = $('#civic-military-panel');
        if (!panel.length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        panel.css({
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            right: 'auto',
            bottom: 'auto'
        });
        dragging = true;
        panel.addClass('is-dragging');
        if (event.pointerId !== undefined && event.currentTarget?.setPointerCapture){
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        $(document).on('pointermove.civicMilitaryDrag', moveDrag);
        $(document).on('pointerup.civicMilitaryDrag pointercancel.civicMilitaryDrag', stopDrag);
        event.preventDefault();
        event.stopPropagation();
    });

    $(window).on('resize.civicMilitaryDrag', () => {
        const panel = $('#civic-military-panel');
        if (!panel.length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        applyCivicMilitaryFloatingPosition(panel, rect.left, rect.top);
    });
}

function renderResearchTab(containerSelector){
    const container = $(containerSelector);
    global.settings.researchEmbedded = containerSelector !== '#mTabResearch';
    clearElement(container);
    container.append(`<div id="resQueue" class="resQueue" v-show="rq.display"></div>
    <b-tabs class="resTabs researchTabs" v-model="s.resTabs" :animated="s.animated">
        <b-tab-item id="tech">
            <template slot="header">
                <h2 class="is-sr-only">{{ 'new_sr' | label }}</h2>
                <span aria-hidden="true">{{ 'new' | label }}</span>
            </template>
        </b-tab-item>
    </b-tabs>`);
    const vue = vBind({
        el: containerSelector,
        data: {
            s: global.settings,
            rq: global.r_queue
        },
        filters: {
            label(lbl){
                return tabLabel(lbl);
            }
        }
    });
    resQueue();
    if (global.race.species !== 'protoplasm'){
        // Use $nextTick to ensure Vue has finished rendering the DOM
        if (vue && vue.$nextTick){
            vue.$nextTick(function(){
                drawTech();
            });
        }
        else {
            // Fallback: use setTimeout
            setTimeout(function(){
                drawTech();
            }, 50);
        }
    }
}

function refreshResearchTab(){
    const floatingPanel = $('#researchFloatingPanel');
    const floatingContent = $('#researchFloatingContent');
    const floatingOpen = Boolean(global.settings?.researchFloatingOpen) || $('body').hasClass('research-floating-open') || (floatingPanel.length && floatingPanel.is(':visible'));
    if (floatingContent.length && floatingOpen){
        renderResearchTab('#researchFloatingContent');
        return;
    }
    const main = $('#mTabResearch');
    if (main.length && main.children().length){
        renderResearchTab('#mTabResearch');
        return;
    }
    const civil = $('#civilTripleResearch');
    if (civil.length && civil.children().length){
        renderResearchTab('#civilTripleResearch');
    }
}

function refreshAllResearchTabs(){
    const targets = [];
    const floatingContent = $('#researchFloatingContent');
    if (floatingContent.length){
        targets.push('#researchFloatingContent');
    }
    const main = $('#mTabResearch');
    if (main.length && main.children().length){
        targets.push('#mTabResearch');
    }
    const civil = $('#civilTripleResearch');
    if (civil.length && civil.children().length){
        targets.push('#civilTripleResearch');
    }
    if (!targets.length){
        return false;
    }
    const prevEmbedded = global.settings?.researchEmbedded;
    targets.forEach((selector) => {
        renderResearchTab(selector);
    });
    if (typeof prevEmbedded !== 'undefined'){
        const floatingPanel = $('#researchFloatingPanel');
        const floatingOpen = Boolean(global.settings?.researchFloatingOpen)
            || $('body').hasClass('research-floating-open')
            || (floatingPanel.length && floatingPanel.is(':visible'));
        const embedded = floatingOpen || ($('#civilTripleResearch').length && $('#civilTripleResearch').children().length);
        global.settings.researchEmbedded = embedded;
    }
    return true;
}

if (typeof window !== 'undefined'){
    window.refreshResearchTab = refreshResearchTab;
    window.refreshAllResearchTabs = refreshAllResearchTabs;
    window.forceRefreshResearchViews = function(){
        if (refreshAllResearchTabs()){
            return true;
        }
        return false;
    };
}

export function index(){
    clearElement($('body'));

    $('html').addClass(global.settings.font);
    $('body').toggleClass('race-pinguicula', global.race?.species === 'pinguicula');
    $('body').toggleClass('race-protoplasm', global.race?.species === 'protoplasm');
    $('body').toggleClass('race-sappy', Boolean(global.race?.sappy));

    // Top Bar
    $('body').append(`<div id="topBar" class="topBar">
        <h2 class="is-sr-only">Top Bar</h2>
        <span class="planetWrap">
            <span id="topBarPlanet" class="planet" v-if="race.species !== 'pinguicula'">{{ race.species | planet }}</span>
            <span
                id="topBarPlanet"
                class="planet planet-image"
                v-if="race.species === 'pinguicula'"
                role="img"
                :aria-label="race.species | planet"
                :title="race.species | planet"
            ></span>
            <span class="universe" v-show="showUniverse()">{{ race.universe | universe }}</span>
            <span class="pet" id="playerPet" v-show="showPet()" @click="petPet()"></span>
            <span class="simulation" v-show="showSim()">${loc(`evo_challenge_simulation`)}</span>
        </span>
        <span class="calendar">
            <span class="infoTimer" id="infoTimer"></span>
            <span v-show="city.calendar.day">
                <span class="is-sr-only" v-html="sign()"></span><span id="astroSign" class="astro" v-html="getAstroSign()"></span>
                <b-tooltip :label="moon()" :aria-label="moon()" position="is-bottom" size="is-small" multilined animated><i id="moon" class="moon wi"></i></b-tooltip>
                <span class="year">${loc('year')} <span class="has-text-warning">{{ city.calendar.year }}</span></span>
                <span class="day">${loc('day')} <span class="has-text-warning">{{ city.calendar.day }}</span></span>
                <span class="season">{{ season() }}</span>
                <b-tooltip :label="weather()" :aria-label="weather()" position="is-bottom" size="is-small" multilined animated><i id="weather" class="weather wi"></i></b-tooltip>
                <b-tooltip :label="temp()" :aria-label="temp()" position="is-bottom" size="is-small" multilined animated><i id="temp" class="temp wi"></i></b-tooltip>
                <b-tooltip :label="atRemain()" v-show="s.at" :aria-label="atRemain()" position="is-bottom" size="is-small" multilined animated><span class="atime has-text-caution">{{ s.at | remain }}</span></b-tooltip>
                <span role="button" class="atime" style="padding: 0 0.5rem; margin-left: 0.5rem; cursor: pointer" @click="pause" :aria-label="pausedesc()">
                    <span id="pausegame"></span>
                </span>
            </span>
        </span>
        <span id="topBarFloatingToggles" class="topbar-floating-toggles" aria-label="Quick panels"></span>
        <button id="evolution-bgm-toggle" class="bgm-toggle" type="button" aria-pressed="true" title="BGM on" aria-label="BGM on">
            <span class="bgm-icon bgm-on" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
                    <path d="M19 5a9 9 0 0 1 0 14" />
                </svg>
            </span>
            <span class="bgm-icon bgm-off" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
            </span>
        </button>
        <label class="bgm-volume" aria-label="BGM volume">
            <span class="is-sr-only">BGM volume</span>
            <input id="evolution-bgm-volume" class="bgm-volume-range" type="range" min="0" max="100" step="5" value="35" aria-label="BGM volume" />
        </label>
        <button id="settings-button" class="button is-small settings-button" type="button" aria-label="${loc('tab_settings')}">
            ${loc('tab_settings')}
        </button>
        <button id="resources-panel-toggle" class="button is-small settings-button resources-panel-toggle" type="button" aria-label="${loc('tab_resources')}" aria-pressed="true">
            ${loc('tab_resources')}
        </button>
        <span class="version" id="versionLog"><a href="wiki.html#changelog" target="_blank"></a></span>
    </div>`);

    $(document).off('click.evolutionBgmToggle', '#evolution-bgm-toggle');
    $(document).on('click.evolutionBgmToggle', '#evolution-bgm-toggle', () => {
        evolutionBgm.enabled = !evolutionBgm.enabled;
        persistEvolutionBgmSetting();
        updateEvolutionBgm();
    });
    $(document).off('input.evolutionBgmVolume change.evolutionBgmVolume', '#evolution-bgm-volume');
    $(document).on('input.evolutionBgmVolume change.evolutionBgmVolume', '#evolution-bgm-volume', (event) => {
        const nextValue = Number(event.target.value);
        if (!Number.isNaN(nextValue)){
            setEvolutionBgmVolume(nextValue / 100);
        }
    });
    $(document).off('click.settingsModalTrigger', '#settings-button');
    $(document).on('click.settingsModalTrigger', '#settings-button', (event) => {
        event.preventDefault();
        global.settings.settingsModal = true;
        dockResourcesForTab(global.settings.civTabs);
    });
    $(document).off('click.leftColumnToggle', '#left-column-toggle');
    $(document).off('click.resourcesPanelToggle', '#resources-panel-toggle');
    $(document).on('click.resourcesPanelToggle', '#resources-panel-toggle', (event) => {
        const toggle = $(event.currentTarget);
        if (toggle.data('justDragged')){
            toggle.data('justDragged', false);
            return;
        }
        event.preventDefault();
        if (!global.settings){
            return;
        }
        global.settings.hideResourcesPanel = !global.settings.hideResourcesPanel;
        const hidden = syncResourcesPanelHiddenState();
        updateResourcesPanelToggle();
        if (!hidden){
            dockResourcesForTab(global.settings.civTabs);
        }
    });
    updateEvolutionBgmButton();
    updateEvolutionBgmVolumeControl();
    syncResourcesPanelHiddenState();
    updateResourcesPanelToggle();
    syncLeftColumnCollapsedState();
    updateLeftColumnToggle();

    let main = $(`<div id="main" class="main"></div>`);
    let columns = $(`<div class="columns is-gapless"></div>`);
    $('body').append(main);
    main.append(columns);
    syncTopBarOffset();
    $(window).off('resize.topBarOffset').on('resize.topBarOffset', () => {
        syncTopBarOffset();
    });

    // Left Column
    columns.append(`<div class="column is-one-quarter leftColumn">
        <div id="race" class="race colHeader">
            <h2 class="is-sr-only">Race Info</h2>
            <div class="name" v-show="race.species !== 'pinguicula'">{{ name() }}</div>
            <div class="morale-contain">
                <span id="morale" v-show="city.morale.current" class="morale">${loc('morale')} <span class="has-text-warning">{{ city.morale.current | mRound }}%</span></span>
                <span id="moraleJobControls" class="morale-job-controls"></span>
            </div>
            <div class="power"><span id="powerStatus" class="has-text-warning" v-show="city.powered"><span>MW</span> <span id="powerMeter" class="meter">{{ city.power | replicate | approx }}</span></span></div>
            <div id="pinguiculaPortraitPanel" class="pinguicula-portrait-panel" v-show="race.species === 'pinguicula'">
                <div id="pinguiculaPortrait" class="pinguicula-name">{{ name() }}</div>
                <div id="pinguiculaPopulationMount" class="race-population"></div>
            </div>
        </div>
        <div id="sideQueue">
            <div id="buildQueue" class="bldQueue standardqueuestyle has-text-info" v-show="display"></div>
        </div>
        <div id="resources" class="resources vscroll">
            <h2 class="is-sr-only">${loc('tab_resources')}</h2>
            <div id="resourcesFloatingHeader" class="resources-floating-header"><span>${loc('tab_resources')}</span></div>
        </div>
        <div id="msgQueue" class="msgQueue vscroll has-text-info msgQueue-embedded" aria-live="polite">
            <div id="msgQueuePanel" class="msgQueuePanel" :class="{ 'is-collapsed': !open }">
                <div id="msgQueueHeader">
                    <button id="msgQueueToggle" class="msgQueueToggle" role="button" :aria-expanded="open" aria-controls="msgQueueBody" title="${loc('message_log')}" @click.stop="toggleLog">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-more-icon lucide-message-square-more"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/></svg>
                    </button>
                    <span class="special" role="button" title="message queue options" @click="trigModal" v-show="open">
                        <svg version="1.1" x="0px" y="0px" width="12px" height="12px" viewBox="340 140 280 279.416" enable-background="new 340 140 280 279.416" xml:space="preserve">
                            <path class="gear" d="M620,305.666v-51.333l-31.5-5.25c-2.333-8.75-5.833-16.917-9.917-23.917L597.25,199.5l-36.167-36.75l-26.25,18.083
                            c-7.583-4.083-15.75-7.583-23.916-9.917L505.667,140h-51.334l-5.25,31.5c-8.75,2.333-16.333,5.833-23.916,9.916L399.5,163.333
                            L362.75,199.5l18.667,25.666c-4.083,7.584-7.583,15.75-9.917,24.5l-31.5,4.667v51.333l31.5,5.25
                            c2.333,8.75,5.833,16.334,9.917,23.917l-18.667,26.25l36.167,36.167l26.25-18.667c7.583,4.083,15.75,7.583,24.5,9.917l5.25,30.916
                            h51.333l5.25-31.5c8.167-2.333,16.333-5.833,23.917-9.916l26.25,18.666l36.166-36.166l-18.666-26.25
                            c4.083-7.584,7.583-15.167,9.916-23.917L620,305.666z M480,333.666c-29.75,0-53.667-23.916-53.667-53.666s24.5-53.667,53.667-53.667
                            S533.667,250.25,533.667,280S509.75,333.666,480,333.666z"/>
                        </svg>
                    </span>
                    <span role="button" class="zero has-text-advanced" @click="clearLog(m.view)" v-show="open">${loc('message_log_clear')}</span>
                    <span role="button" class="zero has-text-advanced" @click="clearLog()" v-show="open">${loc('message_log_clear_all')}</span>
                </div>
                <div id="msgQueueBody" v-show="open">
                    <h2 class="is-sr-only">${loc('message_filters')}</h2>
                    <div id="msgQueueFilters" class="hscroll msgQueueFilters"></div>
                    <h2 class="is-sr-only">${loc('messages')}</h2>
                    <div id="msgQueueLog" aria-live="polite"></div>
                </div>
            </div>
        </div>
    </div>`);
    message_filters.forEach(function (filter){
        $(`#msgQueueFilters`).append(`
            <span id="msgQueueFilter-${filter}" class="${filter === 'all' ? 'is-active' : ''}" aria-disabled="${filter === 'all' ? 'true' : 'false'}" @click="swapFilter('${filter}')" v-show="s.${filter}.vis" role="button">${loc('message_log_' + filter)}</span>
        `);
    });
    setupMsgQueueDrag();
    setupResourcesFloatingDrag();
    setupPinguiculaPortraitDrag();
    syncPinguiculaPortraitPanelPlacement();
    const resourcesPanel = $('#resources');
    if (resourcesPanel.length){
        resourcesPanel.addClass('resources-draggable');
        setupResourceDrag(resourcesPanel, resourcesPanelKey, {
            handleSelector: '#resourcesFloatingHeader',
            boundsSelector: 'body',
            disableWhenFloating: true,
            allowBodyDrag: false,
            dragThreshold: 4,
            suppressClick: true
        });
        restoreResourcesPanelPosition();
    }
    vBind({
        el: `#msgQueue`,
        data: {
            m: message_logs,
            s: global.settings.msgFilters,
            open: message_logs.open !== undefined ? message_logs.open : true
        },
        methods: {
            toggleLog(){
                this.open = !this.open;
                message_logs.open = this.open;
            },
            swapFilter(filter){
                if (message_logs.view !== filter){
                    $(`#msgQueueFilter-${message_logs.view}`).removeClass('is-active').attr('aria-disabled', 'false');
                    $(`#msgQueueFilter-${filter}`).addClass('is-active').attr('aria-disabled', 'true');
                    message_logs.view = filter;
                    let queue = $(`#msgQueueLog`);
                    clearElement(queue);
                    message_logs[filter].forEach(function (msg){
                        queue.append($('<p class="has-text-'+msg.color+'"></p>').text(msg.msg));
                    });
                }
            },
            clearLog(filter){
                filter = filter ? [filter] : filter;
                initMessageQueue(filter);
                clearElement($(`#msgQueueLog`));
                if (filter){
                    global.lastMsg[filter] = [];
                }
                else {
                    Object.keys(global.lastMsg).forEach(function (tag){
                        global.lastMsg[tag] = [];
                    });
                }
            },
            trigModal(){
                let modal = {
                    template: '<div id="modalBox" class="modalBox"></div>'
                };
                this.$buefy.modal.open({
                    parent: this,
                    component: modal
                });

                let checkExist = setInterval(function(){
                    if ($('#modalBox').length > 0){
                        clearInterval(checkExist);
                        let egg16 = easterEgg(16,12);
                        $('#modalBox').append($(`<p id="modalBoxTitle" class="has-text-warning modalTitle">${loc('message_log')}${egg16.length > 0 ? egg16 : ''}</p>`));

                        var body = $('<div id="specialModal" class="modalBody vscroll"></div>');
                        $('#modalBox').append(body);
                        
                        let catVis = $(`
                            <div>
                                <div>
                                    <span class="has-text-warning">${loc('message_log_settings_visible')}</span>
                                </div>
                            </div>
                        `);
                        let catMax = $(`
                            <hr>
                            <div>
                                <div>
                                    <span class="has-text-warning">${loc('message_log_settings_length')}</span>
                                </div>
                            </div>
                        `);
                        let catSave = $(`
                            <hr>
                            <div>
                                <div>
                                    <span class="has-text-warning">${loc('message_log_settings_save')}</span>
                                </div>
                            </div>
                        `);
                        body.append(catVis);
                        body.append(catMax);
                        body.append(catSave);
                        
                        let visSet = ``;
                        let maxSet = ``;
                        let saveSet = ``;
                        
                        let maxInputs = {};
                        let saveInputs = {};
                        message_filters.forEach(function (filter){
                            visSet += `<div class="msgInput" v-show="s.${filter}.unlocked"><span>${loc('message_log_' + filter)}</span> <b-checkbox class="patrol" v-model="s.${filter}.vis" :disabled="checkDisabled('${filter}',s.${filter}.vis)" :input="check('${filter}')"></b-checkbox></div>`;
                            maxSet += `<div class="msgInput" v-show="s.${filter}.unlocked"><span>${loc('message_log_' + filter)}</span> <b-numberinput :input="maxVal('${filter}')" min="1" v-model="mi.${filter}" :controls="false"></b-numberinput></div>`;
                            saveSet += `<div class="msgInput" v-show="s.${filter}.unlocked"><span>${loc('message_log_' + filter)}</span> <b-numberinput :input="saveVal('${filter}')" min="0" :max="s.${filter}.max" v-model="si.${filter}" :controls="false"></b-numberinput></div>`;
                            
                            maxInputs[filter] = global.settings.msgFilters[filter].max;
                            saveInputs[filter] = global.settings.msgFilters[filter].save;
                        });
                        catVis.append(visSet);
                        catMax.append(maxSet);
                        catSave.append(saveSet);
                        catMax.append(`
                            <div class="msgInputApply">
                                <button class="button" @click="applyMax()">${loc('message_log_settings_apply')}</button>
                            </div>
                        `);
                        catSave.append(`
                            <div class="msgInputApply">
                                <button class="button" @click="applySave()">${loc('message_log_settings_apply')}</button>
                            </div>
                        `);
                        
                        
                        vBind({
                            el: `#specialModal`,
                            data: {
                                s: global.settings.msgFilters,
                                mi: maxInputs,
                                si: saveInputs
                            },
                            methods: {
                                check(filter){
                                    if (!global.settings.msgFilters[filter].vis && message_logs.view === filter){
                                       let haveVis = false;
                                        Object.keys(global.settings.msgFilters).forEach(function (filt){
                                            if (global.settings.msgFilters[filt].vis && !haveVis){
                                                haveVis = true;
                                                $(`#msgQueueFilter-${message_logs.view}`).removeClass('is-active');
                                                $(`#msgQueueFilter-${filt}`).addClass('is-active');
                                                message_logs.view = filt;
                                                let queue = $(`#msgQueueLog`);
                                                clearElement(queue);
                                                message_logs[filt].forEach(function (msg){
                                                    queue.append($('<p class="has-text-'+msg.color+'"></p>').text(msg.msg));
                                                });
                                            }
                                        });
                                    }
                                },
                                checkDisabled(filter,fill){
                                    if (!global.settings.msgFilters[filter].vis){
                                        return false;
                                    }
                                    let totVis = 0;
                                    Object.keys(global.settings.msgFilters).forEach(function (filt){
                                        if (global.settings.msgFilters[filt].vis){
                                            totVis++;
                                        }
                                    });
                                    
                                    return totVis === 1;
                                },
                                maxVal(filter){
                                    if (maxInputs[filter] < 1){
                                        maxInputs[filter] = 1;
                                    }
                                },
                                saveVal(filter){
                                    if (saveInputs[filter] < 0){
                                        saveInputs[filter] = 0;
                                    }
                                    else if (saveInputs[filter] > global.settings.msgFilters[filter].max){
                                        saveInputs[filter] = global.settings.msgFilters[filter].max;
                                    }
                                },
                                applyMax(){
                                    message_filters.forEach(function (filter){
                                        let max = maxInputs[filter];
                                        global.settings.msgFilters[filter].max = max;
                                        if (max < global.settings.msgFilters[filter].save){
                                            saveInputs[filter] = max;
                                            global.settings.msgFilters[filter].save = max;
                                            global.lastMsg[filter].splice(max);
                                        }
                                        message_logs[filter].splice(max);
                                        if (message_logs.view === filter){
                                            $('#msgQueueLog').children().slice(max).remove();
                                        }
                                    });
                                },
                                applySave(){
                                    message_filters.forEach(function (filter){
                                        global.settings.msgFilters[filter].save = saveInputs[filter];
                                        global.lastMsg[filter].splice(saveInputs[filter]);
                                    });
                                }
                            }
                        });
                    }
                }, 50);
            }
        }
    });

    // Center Column
    let mainColumn = $(`<div id="mainColumn" class="column is-three-quarters"></div>`);
    columns.append(mainColumn);
    let content = $(`<div class="content"></div>`);
    mainColumn.append(content);

    content.append(`<h2 class="is-sr-only">Tab Navigation</h2>`);
    content.append(`<div id="topResourcesMount" class="top-resources"></div>`);
    let tabs = $(`<b-tabs id="mainTabs" v-model="s.civTabs" :animated="s.animated" @input="swapTab" :class="{ 'evolution-stage': s.showEvolve }"></b-tabs>`);
    content.append(tabs);

    // Evolution Tab
    let evolution = $(`<b-tab-item id="evolution" class="tab-item sticky" :visible="s.showEvolve" header-class="main-tab-evolution">
        <template slot="header">
            {{ 'tab_evolve' | label }}
        </template>
    </b-tab-item>`);
    tabs.append(evolution);

    // City Tab
    let city = $(`<b-tab-item :visible="s.showCiv" header-class="main-tab-civil">
        <template slot="header">
            <span class="tab-civil-label" @click.stop>
                {{ 'tab_civil' | label }} <span class="has-text-warning" aria-hidden="true">I</span>
            </span>
        </template>
        <div id="mTabCivil"></div>
    </b-tab-item>`);
    tabs.append(city);

    // Civics Tab
    let civic = $(`<b-tab-item :visible="s.showCivic" header-class="main-tab-civic">
        <template slot="header">
            {{ 'tab_civics' | label }}
        </template>
        <div id="mTabCivic"></div>
    </b-tab-item>`);
    tabs.append(civic);

    // Research Tab
    let research = $(`<b-tab-item :visible="s.showResearch && !s.researchFloatingOnly && !s.showEvolve" header-class="main-tab-research">
        <template slot="header">
            {{ 'tab_research' | label }}
        </template>
        <div id="mTabResearch"></div>
    </b-tab-item>`);
    tabs.append(research);

    // Resources Tab
    let resources = $(`<b-tab-item :visible="s.showResources" header-class="main-tab-resources">
        <template slot="header">
            {{ 'tab_resources' | label }}
        </template>
        <div id="mTabResource"></div>
    </b-tab-item>`);
    tabs.append(resources);

    // ARPA Tab
    let arpa = $(`<b-tab-item :visible="s.showGenetics">
        <template slot="header">
            {{ 'tech_arpa' | label }}
        </template>
        <div id="mTabArpa"></div>
    </b-tab-item>`);
    tabs.append(arpa);

    // Stats Tab
    let stats = $(`<b-tab-item :visible="s.showAchieve">
        <template slot="header">
            {{ 'tab_stats' | label }}
        </template>
        <div id="mTabStats"></div>
    </b-tab-item>`);
    tabs.append(stats);

    let iconlist = '';
    let icons = [
        {i: 'nuclear',      f: 'steelem',               r: 2 },
        {i: 'zombie',       f: 'the_misery',            r: 2 },
        {i: 'fire',         f: 'ill_advised',           r: 2 },
        {i: 'mask',         f: 'friday',                r: 1 },
        {i: 'skull',        f: 'demon_slayer',          r: 2 },
        {i: 'taijitu',      f: 'equilibrium',           r: 2 },
        {i: 'martini',      f: 'utopia',                r: 2 },
        {i: 'lightbulb',    f: 'energetic',             r: 2 },
        {i: 'trash',        f: 'garbage_pie',           r: 2 },
        {i: 'banana',       f: 'banana',                r: 2 },
        {i: 'turtle',       f: 'finish_line',           r: 2 },
        {i: 'floppy',       f: 'digital_ascension',     r: 2 },
        {i: 'slime',        f: 'slime_lord',            r: 2 },
        {i: 'sludge',       f: 'grand_death_tour',      r: 2 },
        {i: 'lightning',    f: 'annihilation',          r: 2 },
        {i: 'trophy',       f: 'wish',                  r: 2 },
        {i: 'robot',        f: 'planned_obsolescence',  r: 2 },
        {i: 'heart',        f: 'valentine',             r: 1 },
        {i: 'clover',       f: 'leprechaun',            r: 1 },
        {i: 'bunny',        f: 'easter',                r: 1 },
        {i: 'egg',          f: 'egghunt',               r: 1 },
        {i: 'rocket',       f: 'launch_day',            r: 1 },
        {i: 'sun',          f: 'solstice',              r: 1 },
        {i: 'firework',     f: 'firework',              r: 1 },
        {i: 'ghost',        f: 'halloween',             r: 1 },
        {i: 'candy',        f: 'trickortreat',          r: 1 },
        {i: 'turkey',       f: 'thanksgiving',          r: 1 },
        {i: 'meat',         f: 'immortal',              r: 1 },
        {i: 'present',      f: 'xmas',                  r: 1 },
    ];

    let irank = alevel();
    if (irank < 2){ irank = 2; }
    for (let i=0; i<icons.length; i++){
        if (global.stats.feat[icons[i].f] && global.stats.feat[icons[i].f] >= icons[i].r){
            iconlist = iconlist + `<b-dropdown-item v-on:click="icon('${icons[i].i}')">${drawIcon(icons[i].i, 16, irank)} {{ '${icons[i].i}' | label }}</b-dropdown-item>`;
        }
        else if (global.settings.icon === icons[i].i){
            global.settings.icon = 'star';
        }
    }

    let egg9 = easterEgg(9,14);
    let hideEgg = '';
    if (egg9.length > 0){
        hideEgg = `<b-dropdown-item>${egg9}</b-dropdown-item>`;
    }

    let trick = trickOrTreat(5,12,true);
    let hideTreat = '';
    if (trick.length > 0){
        hideTreat = `<b-dropdown-item>${trick}</b-dropdown-item>`;
    }

    let localeOptions = '';
    if (Object.keys(locales).length > 1){
        Object.keys(locales).forEach(function (locale){
            localeOptions = localeOptions + `<option value="${locale}">${locales[locale]}</option>`;
        });
    }

    // Settings Tab
    const settingsContent = `
        <div id="settings" class="settings settings-modal-content">
            <div class="theme">
                <span>{{ 'theme' | label }} </span>
                <b-dropdown hoverable>
                    <button class="button is-primary" slot="trigger">
                        <span>{{ 'theme_' + s.theme | label }}</span>
                        <i class="fas fa-sort-down"></i>
                    </button>
                    <b-dropdown-item v-on:click="setTheme('dark')">{{ 'theme_dark' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('light')">{{ 'theme_light' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('night')">{{ 'theme_night' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('darkNight')">{{ 'theme_darkNight' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('redgreen')">{{ 'theme_redgreen' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('gruvboxLight')">{{ 'theme_gruvboxLight' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('gruvboxDark')">{{ 'theme_gruvboxDark' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('gruvboxDarkRG')">{{ 'theme_gruvboxDarkRG' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('orangeSoda')">{{ 'theme_orangeSoda' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setTheme('dracula')">{{ 'theme_dracula' | label }}</b-dropdown-item>
                    ${hideEgg}
                </b-dropdown>

                <span>{{ 'units' | label }} </span>
                <b-dropdown hoverable>
                    <button class="button is-primary" slot="trigger">
                        <span>{{ s.affix | notation }}</span>
                        <i class="fas fa-sort-down"></i>
                    </button>
                    <b-dropdown-item v-on:click="numNotation('si')">{{ 'metric' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="numNotation('sci')">{{ 'scientific' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="numNotation('eng')">{{ 'engineering' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="numNotation('sln')">{{ 'sln' | label }}</b-dropdown-item>
                    ${hideTreat}
                </b-dropdown>

                <span>{{ 'icons' | label }} </span>
                <b-dropdown hoverable>
                    <button class="button is-primary" slot="trigger">
                        <span>{{ s.icon | label }}</span>
                        <i class="fas fa-sort-down"></i>
                    </button>
                    <b-dropdown-item v-on:click="icon('star')">${drawIcon('star',16,irank)} {{ 'star' | label }}</b-dropdown-item>
                    ${iconlist}
                </b-dropdown>
            </div>
            <div id="localization" class="localization">
                <span>{{ 'locale' | label }} </span>
                <b-select v-model="s.locale" @input="lChange($event)">
                    ${localeOptions}
                </b-select>

                <span>{{ 'font' | label }} </span>
                <b-dropdown hoverable>
                    <button class="button is-primary" slot="trigger">
                        <span>{{ s.font | label }}</span>
                        <i class="fas fa-sort-down"></i>
                    </button>
                    <b-dropdown-item v-on:click="font('standard')">{{ 'standard' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="font('large_log')">{{ 'large_log' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="font('large_all')">{{ 'large_all' | label }}</b-dropdown-item>
                </b-dropdown>
            </div>

            <div class="queue">
                <span>{{ 'queuestyle' | label }} </span>
                <b-dropdown hoverable>
                    <button class="button is-primary" slot="trigger">
                        <span>{{ s.queuestyle | label }}</span>
                        <i class="fas fa-sort-down"></i>
                    </button>
                    <b-dropdown-item v-on:click="setQueueStyle('standardqueuestyle')">{{ 'standardqueuestyle' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setQueueStyle('listqueuestyle')">{{ 'listqueuestyle' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setQueueStyle('bulletlistqueuestyle')">{{ 'bulletlistqueuestyle' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setQueueStyle('numberedlistqueuestyle')">{{ 'numberedlistqueuestyle' | label }}</b-dropdown-item>
                </b-dropdown>

                <span class="settings15" aria-label="${loc('settings15')}">{{ 'q_merge' | label }} </span>
                <b-dropdown hoverable>
                    <button class="button is-primary" slot="trigger">
                        <span>{{ s.q_merge | label }}</span>
                        <i class="fas fa-sort-down"></i>
                    </button>
                    <b-dropdown-item v-on:click="q_merge('merge_never')">{{ 'merge_never' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="q_merge('merge_nearby')">{{ 'merge_nearby' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="q_merge('merge_all')">{{ 'merge_all' | label }}</b-dropdown-item>
                </b-dropdown>

                <span>{{ 'q_resize' | label }} </span>
                <b-dropdown hoverable>
                    <button class="button is-primary" slot="trigger">
                        <span>{{ 'q_resize_' + s.q_resize | label }}</span>
                        <i class="fas fa-sort-down"></i>
                    </button>
                    <b-dropdown-item v-on:click="setQueueResize('auto')">{{ 'q_resize_auto' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setQueueResize('grow')">{{ 'q_resize_grow' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setQueueResize('shrink')">{{ 'q_resize_shrink' | label }}</b-dropdown-item>
                    <b-dropdown-item v-on:click="setQueueResize('manual')">{{ 'q_resize_manual' | label }}</b-dropdown-item>
                </b-dropdown>
            </div>

            <b-switch class="setting" v-model="s.pause" @input="unpause"><span class="settings12" aria-label="${loc('settings12')}">{{ 'pause' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.mKeys"><span class="settings1" aria-label="${loc('settings1')}">{{ 'm_keys' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.cLabels"><span class="settings5" aria-label="${loc('settings5')}">{{ 'c_cat' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.alwaysPower"><span class="settings17" aria-label="${loc('settings17')}">{{ 'always_power' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.qKey"><span class="settings6" aria-label="${loc('settings6')}">{{ 'q_key' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.qAny"><span class="settings7" aria-label="${loc('settings7')}">{{ 'q_any' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.qAny_res"><span class="settings14" aria-label="${loc('settings14')}">{{ 'q_any_res' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.sPackOn" @input="stringPackOn"><span class="settings13" aria-label="${loc('settings13')}">{{ 's_pack_on' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.expose"><span class="settings8" aria-label="${loc('settings8')}">{{ 'expose' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.tabLoad" @input="toggleTabLoad"><span class="settings11" aria-label="${loc('settings11')}">{{ 'tabLoad' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.boring"><span class="settings10" aria-label="${loc('settings10')}">{{ 'boring' | label }}</span></b-switch>
            <b-switch class="setting" v-model="s.touch"><span class="settings16" aria-label="${loc('settings16')}">{{ 'touch' | label }}</span></b-switch>
            <div>
                <div>${loc('key_mappings')}</div>
                <div class="keyMap"><span>${loc('multiplier',[10])}</span> <b-input v-model="s.keyMap.x10" id="x10Key"></b-input></div>
                <div class="keyMap"><span>${loc('multiplier',[25])}</span> <b-input class="keyMap" v-model="s.keyMap.x25" id="x25Key"></b-input></div>
                <div class="keyMap"><span>${loc('multiplier',[100])}</span> <b-input class="keyMap" v-model="s.keyMap.x100" id="x100Key"></b-input></div>
                <div class="keyMap"><span>${loc('q_key')}</span> <b-input class="keyMap" v-model="s.keyMap.q" id="queueKey"></b-input></div>
            </div>
            <div class="importExport">
                <div>${loc('tab_mappings')}</div>
                <div class="keyMap"><span>${loc('tab_civil')}</span> <b-input v-model="s.keyMap.showCiv" id="showCivKey"></b-input></div>
                <div class="keyMap"><span>${loc('tab_civics')}</span> <b-input v-model="s.keyMap.showCivic" id="showCivicKey"></b-input></div>
                <div class="keyMap"><span>${loc('tab_research')}</span> <b-input v-model="s.keyMap.showResearch" id="showResearchKey"></b-input></div>
                <div class="keyMap"><span>${loc('tab_resources')}</span> <b-input v-model="s.keyMap.showResources" id="showResourcesKey"></b-input></div>
                <div class="keyMap"><span>${loc('tech_arpa')}</span> <b-input v-model="s.keyMap.showGenetics" id="showGeneticsKey"></b-input></div>
                <div class="keyMap"><span>${loc('tab_stats')}</span> <b-input v-model="s.keyMap.showAchieve" id="showAchieveKey"></b-input></div>
                <div class="keyMap"><span>${loc('tab_settings')}</span> <b-input v-model="s.keyMap.settings" id="settingshKey"></b-input></div>
            </div>
            <div class="stringPack setting">
                <button id="stringPack" class="button" @click="importStringFile">{{ 'load_string_pack' | label }}</button>
                <input type="file" class="fileImport" id="stringPackFile" accept="text/plain, application/json">
                <button class="button right" @click="clearStringFile">{{ 'clear_string_pack' | label }}</button>
            </div>
            <div class="stringPack setting">
                <span>{{  | sPack}}</span>
            </div>
            <div class="importExport">
                <b-field label="${loc('import_export')}">
                    <b-input id="importExport" type="textarea"></b-input>
                </b-field>
                <button class="button" @click="saveImport">{{ 'import' | label }}</button>
                <button class="button" @click="saveExport">{{ 'export' | label }}</button>
                <button class="button" @click="saveExportFile">{{ 'export_file' | label }}</button>
                <button class="button right" @click="restoreGame"><span class="settings9" aria-label="${loc('settings9')}">{{ 'restore' | label }}</span></button>
            </div>
            <div class="reset">
                <b-collapse :open="false">
                    <b-switch v-model="s.disableReset" slot="trigger">{{ 'enable_reset' | label }}</b-switch>
                    <div class="notification">
                        <div class="content">
                            <h4 class="has-text-danger">
                                {{ 'reset_warn' | label }}
                            </h4>
                            <p>
                                <button class="button" :disabled="!s.disableReset" @click="soft_reset()"><span class="settings4" aria-label="${loc('settings4')}">{{ 'reset_soft' | label }}</span></button>
                                <button class="button right" :disabled="!s.disableReset" @click="reset()"><span class="settings3" aria-label="${loc('settings3')}">{{ 'reset_hard' | label }}</span></button>
                            </p>
                        </div>
                    </div>
                </b-collapse>
            </div>
        </div>
    `;

    let settingsModal = $(`
        <div id="settingsModal" class="settings-modal" v-show="s.settingsModal">
            <div class="settings-modal-backdrop" @click="closeSettingsModal"></div>
            <div class="settings-modal-panel">
                <button class="settings-modal-close button is-small" @click="closeSettingsModal">X</button>
                ${settingsContent}
            </div>
        </div>
    `);
    content.append(settingsModal);

    // (Hidden Last Tab) Hell Observation Tab
    let observe = $(`<b-tab-item disabled>
        <template slot="header"></template>
        <div id="mTabObserve"></div>
    </b-tab-item>`);
    tabs.append(observe);

    // Right Column
    columns.append(`<div id="queueColumn" class="queueCol column"></div>`);

    let egg15 = easterEgg(15,8);
    // Bottom Bar
    $('body').append(`
        <div class="promoBar">
            <span class="left">
                <h1>
                    <span class="has-text-warning">${egg15.length > 0 ? `Ev${egg15}lve` : `Evolve`}</span>
                    by
                    <span class="has-text-success">Demagorddon</span>
                </h1>
            </span>
            <span class="right">
                <h2 class="is-sr-only">External Links</h2>
                <ul class="external-links">
                    <li><a href="wiki.html" target="_blank">Wiki</a></li>
                    <li><a href="https://www.reddit.com/r/EvolveIdle/" target="_blank">Reddit</a></li>
                    <li><a href="https://discord.gg/dcwdQEr" target="_blank">Discord</a></li>
                    <li><a href="https://github.com/pmotschmann/Evolve" target="_blank">GitHub</a></li>
                    <li><a href="https://www.patreon.com/demagorddon" target="_blank">Patreon</a></li>
                    <li><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=PTRJZBW9J662C&currency_code=USD&source=url" target="_blank">Donate</a></li>
                </ul>
            </span>
        </div>
    `);
}
