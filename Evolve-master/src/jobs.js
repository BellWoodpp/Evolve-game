import { global, keyMultiplier, p_on, save, support_on, tmp_vars, sizeApproximation } from './vars.js';
import { vBind, clearElement, popover, darkEffect, eventActive, easterEgg, getHalloween } from './functions.js';
import { loc } from './locale.js';
import { highPopAdjust } from './prod.js';
import { racialTrait, servantTrait, races, traits, biomes, planetTraits, fathomCheck } from './races.js';
import { armyRating } from './civics.js';
import { govActive } from './governor.js';
import { craftingRatio, craftCost, craftingPopover, breakdownPopover } from './resources.js';
import { planetName } from './space.js';
import { hellSupression } from './portal.js';
import { asphodelResist } from './edenic.js';
import { actions, getStructNumActive, templeCount } from './actions.js';

function playAvatarControlClickSound(event){
    if (!event){
        return;
    }
    const target = $(event.target).closest('.job-avatar-control');
    if (!target.length){
        return;
    }
    if (typeof window !== 'undefined' && typeof window.playClickSound === 'function'){
        window.playClickSound();
    }
}

function refreshInlineJobControls(){
    if (typeof document === 'undefined'){
        return;
    }
    $('.resource-job-controls').each(function(){
        if (this.id){
            vBind({ el: `#${this.id}` }, 'update');
        }
    });
    if ($('#moraleJobControls').length){
        vBind({ el: '#moraleJobControls' }, 'update');
    }
}

const JOB_COUNT_FLASH_DURATION = 520;

function flashJobCount(jobKey, direction){
    if (!jobKey || typeof document === 'undefined'){
        return;
    }
    const container = document.getElementById(`civ-${jobKey}`);
    if (!container){
        return;
    }
    const countEl = container.querySelector('.job_label .count:not(.count-max)') || container.querySelector('.job_label .count');
    if (!countEl){
        return;
    }
    const incClass = 'job-count-flash-inc';
    const decClass = 'job-count-flash-dec';
    const cls = direction === 'inc' ? incClass : decClass;
    countEl.classList.remove(incClass, decClass);
    void countEl.offsetWidth;
    countEl.classList.add(cls);
    if (countEl._flashTimer){
        clearTimeout(countEl._flashTimer);
    }
    countEl._flashTimer = setTimeout(() => {
        countEl.classList.remove(cls);
        countEl._flashTimer = null;
    }, JOB_COUNT_FLASH_DURATION);
}

function scheduleJobCountFlash(jobKey, delta){
    if (!jobKey || !Number.isFinite(delta) || delta === 0){
        return;
    }
    const direction = delta > 0 ? 'inc' : 'dec';
    if (typeof requestAnimationFrame === 'function'){
        requestAnimationFrame(() => flashJobCount(jobKey, direction));
    }
    else {
        setTimeout(() => flashJobCount(jobKey, direction), 0);
    }
}

export function ensureMoraleJobControls(){
    const host = $('#moraleJobControls');
    if (!host.length || host.data('bound')){
        return;
    }
    host.data('bound', true);
    host.empty().append(`
        <span class="morale-job-control" v-show="showJob('entertainer')">
            <span class="label">{{ civic.entertainer.name }}</span>
            <span class="value">{{ civic.entertainer.workers }}</span>
            <span class="value max">/ {{ jobMax(civic.entertainer.max) }}</span>
            <span role="button" aria-label="${loc('remove')} {{ civic.entertainer.name }}" class="job-avatar-control avatar-control-sub" @click.stop.prevent="subJob('entertainer', $event)">➖</span>
            <span role="button" aria-label="${loc('add')} {{ civic.entertainer.name }}" class="job-avatar-control avatar-control-add" @click.stop.prevent="addJob('entertainer', $event)">➕</span>
            <span role="button" aria-label="Set default {{ civic.entertainer.name }}" class="job-avatar-control avatar-control-default" :class="{ 'is-default': isDefault('entertainer') }" :aria-pressed="isDefault('entertainer')" @click.stop.prevent="setDefault('entertainer', $event)">✔</span>
        </span>
    `);
    vBind({
        el: '#moraleJobControls',
        data: {
            civic: global.civic
        },
        methods: {
            showJob(j){
                const civicJob = global.civic?.[j];
                if (!civicJob){
                    return false;
                }
                const popMax = global.resource?.[global.race?.species]?.max ?? 0;
                if (popMax <= 0){
                    return false;
                }
                if (j === 'entertainer'){
                    if (global.civic?.entertainer?.max > 0){
                        return true;
                    }
                    if (global.city?.amphitheatre?.count > 0){
                        return true;
                    }
                    if (global.city?.casino?.count > 0 && global.tech?.theatre && !global.race?.joyless){
                        return true;
                    }
                }
                return civicJob.display || global.civic.d_job === j;
            },
            addJob(j, event){
                playAvatarControlClickSound(event);
                const poolJob = j !== 'unemployed' ? 'unemployed' : global.civic.d_job;
                const pool = poolJob ? global.civic[poolJob] : null;
                let keyMult = keyMultiplier();
                for (let i=0; i<keyMult; i++){
                    if (pool && poolJob !== j && (global['civic'][j].max === -1 || global.civic[j].workers < global['civic'][j].max) && pool.workers > 0){
                        global.civic[j].workers++;
                        pool.workers--;
                        global.civic[j].assigned = global.civic[j].workers;
                        if (pool.hasOwnProperty('assigned')){
                            pool.assigned = pool.workers;
                        }
                    }
                    else {
                        break;
                    }
                }
                refreshInlineJobControls();
            },
            subJob(j, event){
                playAvatarControlClickSound(event);
                const poolJob = j !== 'unemployed' ? 'unemployed' : global.civic.d_job;
                const pool = poolJob ? global.civic[poolJob] : null;
                let keyMult = keyMultiplier();
                for (let i=0; i<keyMult; i++){
                    if (pool && poolJob !== j && global.civic[j].workers > 0){
                        global.civic[j].workers--;
                        pool.workers++;
                        global.civic[j].assigned = global.civic[j].workers;
                        if (pool.hasOwnProperty('assigned')){
                            pool.assigned = pool.workers;
                        }
                    }
                    else {
                        break;
                    }
                }
                refreshInlineJobControls();
            },
            setDefault(j, event){
                playAvatarControlClickSound(event);
                global.civic.d_job = j;
                if (global.city?.foundry?.d_craft){
                    global.city.foundry.d_craft = null;
                }
                refreshInlineJobControls();
            },
            isDefault(j){
                return global.civic.d_job === j && !global.city?.foundry?.d_craft;
            },
            jobMax(value){
                return value === -1 ? '∞' : value;
            }
        }
    });
}

export const job_desc = {
    unemployed: function(servant){
        let desc = loc('job_unemployed_desc');
        if (global.civic.d_job === 'unemployed' && !servant){
            desc = desc + ' ' + loc('job_default',[loc('job_unemployed')]);
        }
        return desc;
    },
    hunter: function(servant){
        let desc = loc('job_hunter_desc',[global.resource.Food.name]);
        if (global.race['unfathomable']){
            desc = loc('job_eld_hunter_desc');
        }
        if (global.race['artifical']){
            desc = global.race['soul_eater'] ? loc('job_art_demon_hunter_desc',[global.resource.Furs.name, global.resource.Lumber.name]) : loc('job_art_hunter_desc',[global.resource.Furs.name]);
        }
        else if (global.race['soul_eater'] && global.race.species !== 'wendigo'){
            desc = loc(global.race['evil'] ? 'job_evil_hunter_desc' : 'job_not_evil_hunter_desc',[global.resource.Food.name,global.resource.Lumber.name,global.resource.Furs.name]);
        }
        if (global.civic.d_job === 'hunter' && !servant){
            desc = desc + ' ' + loc('job_default',[global.race['unfathomable'] ? loc('job_raider') : jobName('hunter')]);
        }
        return desc;
    },
    forager: function(servant){
        let desc = loc(`job_forager_desc`);
        if (global.civic.d_job === 'forager' && !servant){
            desc = desc + ' ' + loc('job_default',[jobName('forager')]);
        }
        return desc;
    },
    farmer: function(servant){
        let farmer = +farmerValue(true,servant).toFixed(2);
        let farmhand = +farmerValue(false,servant).toFixed(2);
        if (!servant){
            farmer = +workerScale(farmer,'farmer').toFixed(2);
            farmhand = +workerScale(farmhand,'farmer').toFixed(2);
        }
        const farmCount = global.city?.farm?.count ?? 0;
        let desc = global.race['high_pop'] && !servant
            ? loc('job_farmer_desc_hp',[farmer,global.resource.Food.name,jobScale(1),farmhand,jobScale(1) * farmCount])
            : loc('job_farmer_desc',[farmer,global.resource.Food.name,farmCount,farmhand]);
        if (global.civic.d_job === 'farmer' && !servant){
            desc = desc + ' ' + loc('job_default',[jobName('farmer')]);
        }
        return desc;
    },
    lumberjack: function(servant){
        let workers = servant && global.race['servants'] ? global.race.servants.jobs.lumberjack : global.civic.lumberjack.workers;
        let impact = global.civic.lumberjack.impact;
        if (!servant){
            workers = +workerScale(workers,'lumberjack').toFixed(2);
            impact = +workerScale(impact,'lumberjack').toFixed(2);
        }
        if (global.race['evil'] && (!global.race['soul_eater'] || global.race.species === 'wendigo')){
            let multiplier = 1;
            if (!servant){
                multiplier *= racialTrait(workers,'lumberjack');
            }
            let bone = +(impact * multiplier).toFixed(2);
            let flesh = +(impact / 4 * multiplier).toFixed(2);
            let desc = global.race.species === 'wendigo' ? loc('job_reclaimer_desc2',[bone]) : loc('job_reclaimer_desc',[bone,flesh]);
            if (global.civic.d_job === 'lumberjack' && !servant){
                desc = desc + ' ' + loc('job_default',[jobName('reclaimer')]);
            }
            return desc;
        }
        else {
            let multiplier = (global.tech['axe'] && global.tech['axe'] > 0 ? (global.tech['axe'] - 1) * 0.35 : 0) + 1;
            if (!servant){
                multiplier *= racialTrait(workers,'lumberjack');
            }
            if (global.city.biome === 'forest'){
                impact *= biomes.forest.vars()[0];
            }
            if (global.city.biome === 'savanna'){
                impact *= biomes.savanna.vars()[2];
            }
            if (global.city.biome === 'desert'){
                impact *= biomes.desert.vars()[2];
            }
            if (global.city.biome === 'swamp'){
                impact *= biomes.swamp.vars()[2];
            }
            if (global.city.biome === 'taiga'){
                impact *= biomes.taiga.vars()[0];
            }
            let gain = +(impact * multiplier).toFixed(2);
            let desc = loc('job_lumberjack_desc',[gain,global.resource.Lumber.name]);
            if (global.civic.d_job === 'lumberjack' && !servant){
                desc = desc + ' ' + loc('job_default',[jobName('lumberjack')]);
            }
            let hallowed = getHalloween();
            if (hallowed.active){
                desc = desc + ` <span class="has-text-special">${loc('events_halloween_lumberjack')}</span> `;
            }
            return desc;
        }
    },
    quarry_worker: function(servant){
        let workers = servant && global.race['servants'] ? global.race.servants.jobs.quarry_worker : global.civic.quarry_worker.workers;
        let impact = global.civic.quarry_worker.impact;
        if (!servant){
            workers = +workerScale(workers,'quarry_worker').toFixed(2);
            impact = +workerScale(impact,'quarry_worker').toFixed(2);
        }
        let multiplier = (global.tech['hammer'] && global.tech['hammer'] > 0 ? global.tech['hammer'] * 0.4 : 0) + 1;
        if (!servant){
            multiplier *= racialTrait(workers,'miner');
        }
        if (global.city.biome === 'desert'){
            multiplier *= biomes.desert.vars()[0];
        }
        if (global.city.biome === 'swamp'){
            multiplier *= biomes.swamp.vars()[3];
        }
        if (global.tech['explosives'] && global.tech['explosives'] >= 2){
            multiplier *= global.tech['explosives'] >= 3 ? 1.75 : 1.5;
        }
        let gain = +(impact * multiplier).toFixed(1);
        let desc = global.resource.Aluminium.display ? loc('job_quarry_worker_desc2',[gain, global.resource.Stone.name,global.resource.Aluminium.name]) : loc('job_quarry_worker_desc1',[gain,global.resource.Stone.name]);
        if (global.race['smoldering']){
            desc = desc + ' ' + loc('job_quarry_worker_smoldering',[global.resource.Chrysotile.name]);
        }
        if (global.civic.d_job === 'quarry_worker' && !servant){
            desc = desc + ' ' + loc('job_default',[jobName('quarry_worker')]);
        }
        return desc;
    },
    crystal_miner: function(servant){
        let workers = servant && global.race['servants'] ? global.race.servants.jobs.crystal_miner : global.civic.crystal_miner.workers;
        let impact = global.civic.crystal_miner.impact;
        let multiplier = 1;
        if (!servant){
            workers = +workerScale(workers,'crystal_miner').toFixed(2);
            impact = +workerScale(impact,'crystal_miner').toFixed(2);
            multiplier *= racialTrait(workers,'miner');
        }
        let gain = +(impact * multiplier).toFixed(2);
        let desc = loc('job_crystal_miner_desc',[gain,global.resource.Crystal.name]);
        if (global.civic.d_job === 'crystal_miner' && !servant){
            desc = desc + ' ' + loc('job_default',[jobName('crystal_miner')]);
        }
        return desc;
    },
    scavenger: function(servant){
        let scavenger = traits.scavenger.vars()[0];
        if (global.city.ptrait.includes('trashed') && global.race['scavenger']){
            scavenger *= 1 + (traits.scavenger.vars()[1] / 100);
        }
        if (global.race['high_pop'] && !servant){
            scavenger *= traits.high_pop.vars()[1] / 100;
        }
        if (!servant){
            scavenger = +workerScale(scavenger,'scavenger').toFixed(2);
        }
        let desc = loc('job_scavenger_desc',[races[global.race.species].home,scavenger]);
        if (global.civic.d_job === 'scavenger' && !servant){
            desc = desc + ' ' + loc('job_default',[jobName('scavenger')]);
        }
        return desc;
    },
    teamster: function(servant){
        let desc = loc('job_teamster_desc',[teamsterCap()]);
        if (global.civic.d_job === 'teamster' && !servant){
            desc = desc + ' ' + loc('job_default',[jobName('teamster')]);
        }
        return desc;
    },
    meditator: function(servant){
        let desc = loc('job_meditator_desc');
        if (global.civic.d_job === 'meditator' && !servant){
            desc = desc + ' ' + loc('job_default',[jobName('meditator')]);
        }
        return desc;
    },
    torturer: function(){
        return loc('job_torturer_desc');
    },
    miner: function(){
        if (global.race['warlord']){
            return loc('job_dig_demon_desc');
        }
        else if (global.tech['mining'] >= 3){
            return global.race['sappy'] && global.tech['alumina'] ? loc('job_miner_desc2_amber') : loc('job_miner_desc2');
        }
        else {
            return loc('job_miner_desc1');
        }
    },
    coal_miner: function(){
        if (global.tech['uranium']){
            return loc('job_coal_miner_desc2');
        }
        else {
            return loc('job_coal_miner_desc1');
        }
    },
    craftsman: function(){
        return loc('job_craftsman_desc');
    },
    cement_worker: function(){
        let unit_price = global.race['high_pop'] ? 3 / traits.high_pop.vars()[0] : 3;
        if (global.city.biome === 'ashland'){
            unit_price *= biomes.ashland.vars()[1];
        }
        unit_price = +workerScale(unit_price,'cement_worker').toFixed(2);
        let worker_impact = +workerScale(global.civic.cement_worker.impact,'cement_worker').toFixed(2);
        let impact = global.tech['cement'] >= 4 ? (global.tech.cement >= 7 ? 1.45 : 1.2) : 1;
        let cement_multiplier = racialTrait(global.civic.cement_worker.workers,'factory');
        let gain = worker_impact * impact * cement_multiplier;
        if (global.city.biome === 'ashland'){
            gain *= biomes.ashland.vars()[1];
        }
        gain = +(gain).toFixed(2);
        return global.race['sappy'] ? loc('job_cement_worker_amber_desc',[gain]) : loc('job_cement_worker_desc',[gain,unit_price]);
    },
    banker: function(){
        let interest = +workerScale(global.civic.banker.impact,'banker').toFixed(2) * 100;
        if (global.tech['banking'] >= 10){
            interest += 2 * global.tech['stock_exchange'];
        }
        if (global.race['truthful']){
            interest *= 1 - (traits.truthful.vars()[0] / 100);
        }
        if (global.civic.govern.type === 'republic'){
            interest *= 1.25;
        }
        if (global.race['high_pop']){
            interest *= traits.high_pop.vars()[1] / 100;
        }
        interest = +(interest).toFixed(0);
        if(global.race['fasting']){
            return loc('job_banker_desc_fasting');
        }
        return loc('job_banker_desc',[interest]);
    },
    entertainer: function(){
        let morale = global.tech?.['theatre'] ?? 0;
        if (global.race['musical']){
            morale += traits.musical.vars()[0];
        }
        if (global.race['emotionless']){
            morale *= 1 - (traits.emotionless.vars()[0] / 100);
        }
        if (global.race['high_pop']){
            morale *= traits.high_pop.vars()[1] / 100;
        }
        morale = +workerScale(morale,'entertainer').toFixed(2);
        let mcap = global.race['high_pop'] ? (traits.high_pop.vars()[1] / 100) : 1;
        mcap = +workerScale(mcap,'entertainer').toFixed(2);
        return global.tech['superstar'] ? loc('job_entertainer_desc2',[morale,mcap]) : loc('job_entertainer_desc',[+(morale).toFixed(2)]);
    },
    priest: function(){
        let desc = ``;
        if (global.civic.govern.type === 'theocracy' && global.genes['ancients'] && global.genes['ancients'] >= 2 && global.civic.priest.display){
            desc = loc('job_priest_desc2');
        }
        else {
            desc = global.race.universe === 'evil' ? loc('job_pofficer_desc') : loc('job_priest_desc');
        }
        if (global.tech['cleric']){
            desc = desc + ` ${loc('job_priest_desc3')}`;
        }
        return desc;
    },
    professor: function(){
        let professor = +workerScale(1,'professor');
        let impact = +(global.race['studious'] ? global.civic.professor.impact + traits.studious.vars()[0] : global.civic.professor.impact);
        let fathom = fathomCheck('elven');
        if (fathom > 0){
            impact += traits.studious.vars(1)[0] * fathom;
        }
        professor *= impact;
        professor *= global.race['pompous'] ? (1 - traits.pompous.vars()[0] / 100) : 1;
        professor *= racialTrait(global.civic.professor.workers,'science');
        if (global.tech['anthropology'] && global.tech['anthropology'] >= 3){
            professor *= 1 + (templeCount() * 0.05);
        }
        if (global.civic.govern.type === 'theocracy'){
            professor *= 0.75;
        }
        professor = +professor.toFixed(2);
        return loc('job_professor_desc',[professor]);
    },
    scientist: function(){
        let impact = +workerScale(global.civic.scientist.impact,'scientist').toFixed(2);
        impact *= racialTrait(global.civic.scientist.workers,'science');
        if (global.tech['science'] >= 6 && global.city['wardenclyffe']){
            impact *= 1 + (global.civic.professor.workers * global.city['wardenclyffe'].on * 0.01);
        }
        if (global.space['satellite']){
            impact *= 1 + (global.space.satellite.count * 0.01);
        }
        if (global.civic.govern.type === 'theocracy'){
            impact *= global.tech['high_tech'] && global.tech['high_tech'] >= 12 ? ( global.tech['high_tech'] >= 16 ? 0.75 : 0.6 ) : 0.5;
        }
        impact = +impact.toFixed(2);
        return global.race.universe === 'magic' ? loc('job_wizard_desc',[impact,+(0.025 * darkEffect('magic')).toFixed(4)]) : loc('job_scientist_desc',[impact]);
    },
    colonist(){
        return loc(global.race['truepath'] ? 'job_colonist_desc_tp' : 'job_colonist_desc',[planetName().red]);
    },
    titan_colonist(){
        return loc('job_colonist_desc_tp',[planetName().titan]);
    },
    space_miner(){
        return loc('job_space_miner_desc');
    },
    hell_surveyor(){
        return loc('job_hell_surveyor_desc');
    },
    archaeologist(){
        let value = highPopAdjust(250000);
        let sup = hellSupression('ruins');
        let know = Math.round(value * sup.supress);
        return loc('job_archaeologist_desc',[know.toLocaleString()]);
    },
    ghost_trapper(){
        let attact = global.blood['attract'] ? global.blood.attract * 5 : 0;
        let resist = asphodelResist();
        let ascend = 1;
        if (p_on['ascension_trigger'] && global.eden.hasOwnProperty('encampment') && global.eden.encampment.asc){
            let heatSink = actions.interstellar.int_sirius.ascension_trigger.heatSink();
            heatSink = heatSink < 0 ? Math.abs(heatSink) : 0;
            if (heatSink > 0){
                ascend = 1 + (heatSink / 12500);
            }
        }
        if (global.race['warlord'] && global.portal['mortuary'] && global.portal['corpse_pile']){
            let corpse = (global.portal?.corpse_pile?.count || 0) * (p_on['mortuary'] || 0);
            if (corpse > 0){
                ascend = 1 + corpse / 800;
            }
        }
        let min = Math.floor((150 + attact) * resist * ascend);
        let max = Math.floor((250 + attact) * resist * ascend);
        
        return loc('job_ghost_trapper_desc',[loc('portal_soul_forge_title'),global.resource.Soul_Gem.name,min,max]);
    },
    elysium_miner(){
        let desc = loc('job_elysium_miner_desc',[loc('eden_elysium_name')]);
        if (global.tech['elysium'] && global.tech.elysium >= 12){
            desc += ` ${loc('eden_restaurant_effect',[0.15,loc(`eden_restaurant_bd`)])}.`;
        }
        return desc;
    },
    pit_miner(){
        return loc('job_pit_miner_desc',[loc('tau_planet',[races[global.race.species].home])]);
    },
    crew(){
        return loc('job_crew_desc');
    }
}

// Sets up jobs in civics tab
export function defineJobs(define){
    if (!define){
        $('#civics').append($(`<h2 class="is-sr-only">${loc('civics_jobs')}</h2><div class="tile is-child jobList"><div id="sshifter" class="tile sshifter"></div><div id="job-resources" class="tile is-child job-resources"></div><div id="jobs" class="tile is-child"></div><div id="foundry" class="tile is-child"></div><div id="job-army" class="tile is-child job-army"></div><div id="job-market" class="tile is-child job-market"></div><div id="servants" class="tile is-child"></div><div id="skilledServants" class="tile is-child"></div></div>`));
        $('#job-resource-list').remove();
    }
    const showHousingJobsInCivics = true;
    const showIndustrialJobsInCivics = true;
    const showCommercialJobsInCivics = true;
    const showScienceJobsInCivics = true;
    if (showHousingJobsInCivics){
        loadJob('unemployed',define,0,0,'warning');
    }
    loadJob('hunter',define,0,0);
    loadJob('forager',define,0,0);
    if (showHousingJobsInCivics){
        loadJob('farmer',define,0.82,5);
    }
    if (showIndustrialJobsInCivics){
        loadJob('lumberjack',define,1,5);
    }
    loadJob('quarry_worker',define,1,5);
    loadJob('crystal_miner',define,0.1,5);
    loadJob('scavenger',define,0.12,5);
    loadJob('teamster',define,1,global.tech['teamster'] ? 6 : 4);
    loadJob('meditator',define,1,5);
    loadJob('torturer',define,1,3,'advanced');
    if (showIndustrialJobsInCivics){
        loadJob('miner',define,1,4,'advanced');
        loadJob('coal_miner',define,0.2,4,'advanced');
    }
    loadJob('craftsman',define,1,5,'advanced');
    if (showIndustrialJobsInCivics){
        loadJob('cement_worker',define,0.4,5,'advanced');
    }
    if (showCommercialJobsInCivics){
        loadJob('entertainer',define,1,10,'advanced');
    }
    loadJob('priest',define,1,3,'advanced');
    if (showScienceJobsInCivics){
        loadJob('professor',define,0.5,6,'advanced');
        loadJob('scientist',define,1,5,'advanced');
        loadJob('banker',define,0.1,6,'advanced');
    }
    loadJob('colonist',define,1,5,'advanced');
    loadJob('titan_colonist',define,1,5,'advanced');
    loadJob('space_miner',define,1,5,'advanced');
    loadJob('hell_surveyor',define,1,1,'advanced');
    loadJob('archaeologist',define,1,1,'advanced');
    loadJob('ghost_trapper',define,1,3,'advanced');
    loadJob('elysium_miner',define,1,3,'advanced');
    loadJob('pit_miner',define,1,4.5,'advanced');
    loadJob('crew',define,1,4,'alert');
    if (!define){
        const pop = global.resource?.[global.race.species]?.amount || 0;
        if (pop > 0){
            let total = 0;
            Object.keys(job_desc).forEach(function(job){
                if (global.civic[job] && job !== 'crew'){
                    total += global.civic[job].workers || 0;
                }
            });
            if (total === 0 && global.civic[global.civic.d_job]){
                global.civic[global.civic.d_job].workers = pop;
            }
        }
    }
    if (!define && !global.race['start_cataclysm']){
        ['Scarletite','Quantium'].forEach(function (res){
            limitCraftsmen(res, false);
        });
        loadFoundry();
        if (global.race['servants']){
            loadServants();
        }
    }
    if (!define){
        ensureArmyPanel();
        dockArmyPanelToCityDistricts();
    }
}
export function workerScale(num,job){
    if (global.race['strong'] && ['hunter','forager','farmer','lumberjack','quarry_worker','crystal_miner','scavenger'].includes(job)){
        num *= traits.strong.vars()[1];
    }
    if ((global.race['swift'] || global.race['living_tool']) && ['hunter','forager','farmer','lumberjack','quarry_worker','crystal_miner','scavenger'].includes(job)){
        num *= traits.strong.vars(0.25)[1];
    }
    let teacher = govActive('teacher',1);
    if(teacher && ['professor'].includes(job)){
        num *= 1 + (teacher / 100);
    }
    if (global.race['lone_survivor']){
        if (['hunter','forager','farmer','lumberjack','quarry_worker','crystal_miner','scavenger'].includes(job)){
            num *= 80;
        }
        else if (['craftsman'].includes(job)){
            num *= 60;
        }
        else if (['miner','coal_miner','cement_worker','banker','entertainer','priest','pit_miner'].includes(job)){
            num *= 45;
        }
        else if (['professor','scientist'].includes(job)){
            num *= 125;
        }
    }
    return num;
}

export function jobScale(num){
    if (global.race['high_pop']){
        return num * traits.high_pop.vars()[0];
    }
    return num;
}

export function setJobName(job){
    let job_name = '';
    if (global.race['unfathomable'] && job === 'hunter'){
        job_name = loc('job_raider');
    }
    else if (global.race.universe === 'magic' && job === 'scientist'){
        job_name = loc('job_wizard');
    }
    else if (global.race['truepath'] && job === 'colonist'){
        job_name = loc('job_colonist_tp',[planetName().red]);
    }
    else if (job === 'titan_colonist'){
        job_name = loc('job_colonist_tp',[planetName().titan]);
    }
    else if (global.race.universe === 'evil' && job === 'priest' && global.civic.govern.type != 'theocracy'){
        job_name = loc('job_pofficer');
    }
    else if (job === 'lumberjack' && global.race['evil'] && (!global.race['soul_eater'] || global.race.species === 'wendigo')){
        job_name = loc('job_reclaimer');
    }
    else {
        job_name = loc('job_' + job);
    }
    global['civic'][job].name = job_name;
}

export function jobName(job){
    let name = global.civic[job]?.name || loc(`job_${job}`);
    return name;
}

function loadJob(job, define, impact, stress, color, options){
    let servant = false;
    if (define === 'servant'){
        servant = true;
        define = false;
    }
    if (!global['civic'][job]){
        global['civic'][job] = {
            job: job,
            display: false,
            workers: 0,
            max: 0,
            impact: impact
        };
    }

    let noControl = {};
    if (global.race['warlord']){
        noControl['miner'] = true;
    }

    setJobName(job);

    if (!global.civic[job]['assigned']){
        global.civic[job]['assigned'] = job === 'craftsman'? 0 : global.civic[job].workers;
    }

    let resource_panel = null;
    if (!servant){
        global.civic[job]['stress'] = stress;
        global.civic[job].impact = impact;
    }

    if (job === 'craftsman' || define){
        return;
    }

    var id = servant ? 'servant-' + job : 'civ-' + job;

    var civ_container = $(`<div id="${id}" v-show="showJob('${job}')" class="job"></div>`);
    const avatarJobs = ['unemployed','farmer','lumberjack','miner','professor','cement_worker','entertainer','banker'];
    const isAvatarJob = !servant && avatarJobs.includes(job);
    const useAvatarControls = false;
    if (useAvatarControls){
        civ_container.addClass('job-avatar');
    }
    var controls = useAvatarControls ? null : (servant ? $(`<div class="controls"></div>`) : $(`<div v-show="!isDefault('${job}')" class="controls"></div>`));
    if (!color || job === 'unemployed' || isAvatarJob){
        color = color || 'info';
        let job_label = servant
         ? $(`<div class="job_label"><h3 class="has-text-${color}">{{ civic.${job}.name }}</h3><span class="count">{{ sjob.${job} }}</span></div>`)
         : (useAvatarControls
            ? $(`<div class="job_label job-avatar-label job-avatar-${job}">
                    <h3><a class="has-text-${color}" :title="civic.${job}.name" :data-job-name="civic.${job}.name">
                        <span role="button" aria-label="${loc('remove')} ${global['civic'][job].name}" class="job-avatar-control avatar-control-sub" @click.stop.prevent="sub($event)">➖</span>
                        <span role="button" aria-label="${loc('add')} ${global['civic'][job].name}" class="job-avatar-control avatar-control-add" @click.stop.prevent="add($event)">➕</span>
                        <span role="button" aria-label="Set default ${global['civic'][job].name}" class="job-avatar-control avatar-control-default" :class="{ 'is-default': isDefault('${job}') }" :aria-pressed="isDefault('${job}')" @click.stop.prevent="setDefault('${job}', $event)">✔</span>
                        {{ civic.${job}.name }}
                    </a></h3>
                    <span class="count" v-html="$options.filters.event(civic.${job}.workers)">{{ civic.${job}.workers }}</span>
                    <span class="count count-max">{{ $options.filters.jobMax(civic.${job}.max) }}</span>
                </div>`)
            : $(`<div class="job_label"><h3><a class="has-text-${color}" @click="setDefault('${job}', $event)" :title="civic.${job}.name" :data-job-name="civic.${job}.name">{{ civic.${job}.name }}{{ '${job}' | d_state }}</a></h3><span class="count" v-html="$options.filters.event(civic.${job}.workers)">{{ civic.${job}.workers }}</span></div>`));
            if (!servant && useAvatarControls){
                job_label.addClass('job-avatar-label');
                job_label.addClass(`job-avatar-${job}`);
            }
        civ_container.append(job_label);
        if (!servant && (job === 'farmer' || job === 'lumberjack')){
            const resName = job === 'farmer' ? 'Food' : 'Lumber';
            const countId = `job-res-cnt-${resName}`;
            const rateId = `job-res-inc-${resName}`;
            const panelId = `job-resource-${job}`;
            resource_panel = $(
                `<div id="${panelId}" class="job-resource-wrap job-resource-wrap-${job}" v-show="resource.${resName}.display">` +
                    `<div class="job-resource job-resource-${job}">` +
                        `<div class="job-resource-line">` +
                            `<span class="job-resource-name">{{ resource.${resName}.name }}</span>` +
                            `<span id="${countId}" class="job-resource-count">{{ resource.${resName}.amount | resSize }} / {{ resource.${resName}.max | resSize }}</span>` +
                        `</div>` +
                        `<div id="${rateId}" class="job-resource-line job-resource-rate">{{ resource.${resName}.diff | resDiff }} /s</div>` +
                    `</div>` +
                `</div>`
            );
            civ_container.append(resource_panel);
        }
    }
    else {
        let job_label = $(`<div class="job_label"><h3 class="has-text-${color}">{{ civic.${job}.name }}</h3><span :class="level('${job}')">{{ civic.${job}.workers | adjust('${job}') }} / {{ civic.${job}.max | adjust('${job}') }}</span></div>`);
        civ_container.append(job_label);
    }
    if (controls){
        civ_container.append(controls);
    }
    let target = servant ? '#servants' : '#jobs';
    if (options && options.target && $(options.target).length){
        target = options.target;
    }
    $(target).append(civ_container);
    if (resource_panel && target === '#jobs'){
        const resourceList = $('#job-resources');
        if (resourceList.length){
            resourceList.append(resource_panel);
            vBind({
                el: `#job-resource-${job}`,
                data: {
                    resource: global.resource
                },
                filters: {
                    resSize(value){
                        return sizeApproximation(value,0);
                    },
                    resDiff(value){
                        return sizeApproximation(value,2);
                    }
                }
            });
        }
    }
    if (controls && job !== 'crew' && !noControl[job]){
        var sub = $(`<span role="button" aria-label="${loc('remove')} ${global['civic'][job].name}" class="sub has-text-danger" @click="sub"><span>&laquo;</span></span>`);
        var add = $(`<span role="button" aria-label="${loc('add')} ${global['civic'][job].name}" class="add has-text-success" @click="add"><span>&raquo;</span></span>`);
        controls.append(sub);
        controls.append(add);
    }

    if (servant){
        vBind({
            el: `#${id}`,
            data: {
                civic: global.civic,
                sjob: global.race.servants.jobs
            },
            methods: {
                showJob(j){
                    return global.civic[j].display || (j === 'scavenger' && global.race.servants.force_scavenger);
                },
                add(event){
                    playAvatarControlClickSound(event);
                    let keyMult = keyMultiplier();
                    for (let i=0; i<keyMult; i++){
                        if (global.race.servants.max > global.race.servants.used){
                            global.race.servants.jobs[job]++;
                            global.race.servants.used++;
                        }
                        else {
                            break;
                        }
                    }
                },
                sub(event){
                    playAvatarControlClickSound(event);
                    let keyMult = keyMultiplier();
                    for (let i=0; i<keyMult; i++){
                        if (global.race.servants.jobs[job] > 0){
                            global.race.servants.jobs[job]--;
                            global.race.servants.used--;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
        });
    }
    else {
        vBind({
            el: `#${id}`,
            data: {
                civic: global.civic,
                resource: global.resource
            },
            methods: {
                showJob(j){
                    const isDefaultJob = j === 'unemployed' || j === 'hunter' || j === 'forager';
                    if (isDefaultJob){
                        const popMax = global.resource?.[global.race?.species]?.max ?? 0;
                        if (popMax <= 0){
                            return false;
                        }
                    }
                    return global.civic[j].display || global.civic.d_job === j;
                },
                add(event){
                    playAvatarControlClickSound(event);
                    const poolJob = (isAvatarJob && job !== 'unemployed') ? 'unemployed' : global.civic.d_job;
                    const pool = poolJob ? global.civic[poolJob] : null;
                    const startJob = global.civic[job].workers;
                    const startPool = pool ? pool.workers : 0;
                    let keyMult = keyMultiplier();
                    for (let i=0; i<keyMult; i++){
                        if (pool && poolJob !== job && (global['civic'][job].max === -1 || global.civic[job].workers < global['civic'][job].max) && pool.workers > 0){
                            global.civic[job].workers++;
                            pool.workers--;
                            global.civic[job].assigned = global.civic[job].workers;
                            if (pool.hasOwnProperty('assigned')){
                                pool.assigned = pool.workers;
                            }
                        }
                        else {
                            break;
                        }
                    }
                    const deltaJob = global.civic[job].workers - startJob;
                    const deltaPool = pool ? pool.workers - startPool : 0;
                    vBind({ el: `#${id}` }, 'update');
                    if (poolJob && poolJob !== job){
                        vBind({ el: `#civ-${poolJob}` }, 'update');
                    }
                    scheduleJobCountFlash(job, deltaJob);
                    if (poolJob && poolJob !== job){
                        scheduleJobCountFlash(poolJob, deltaPool);
                    }
                },
                sub(event){
                    playAvatarControlClickSound(event);
                    const poolJob = (isAvatarJob && job !== 'unemployed') ? 'unemployed' : global.civic.d_job;
                    const pool = poolJob ? global.civic[poolJob] : null;
                    const startJob = global.civic[job].workers;
                    const startPool = pool ? pool.workers : 0;
                    let keyMult = keyMultiplier();
                    for (let i=0; i<keyMult; i++){
                        if (pool && poolJob !== job && global.civic[job].workers > 0){
                            global.civic[job].workers--;
                            pool.workers++;
                            global.civic[job].assigned = global.civic[job].workers;
                            if (pool.hasOwnProperty('assigned')){
                                pool.assigned = pool.workers;
                            }
                        }
                        else {
                            break;
                        }
                    }
                    const deltaJob = global.civic[job].workers - startJob;
                    const deltaPool = pool ? pool.workers - startPool : 0;
                    vBind({ el: `#${id}` }, 'update');
                    if (poolJob && poolJob !== job){
                        vBind({ el: `#civ-${poolJob}` }, 'update');
                    }
                    scheduleJobCountFlash(job, deltaJob);
                    if (poolJob && poolJob !== job){
                        scheduleJobCountFlash(poolJob, deltaPool);
                    }
                },
                level(job){
                    if (global.civic[job].workers === 0){
                        return 'count has-text-danger';
                    }
                    else if (global.civic[job].workers === global.civic[job].max){
                        return 'count has-text-success';
                    }
                    else if (global.civic[job].workers <= global.civic[job].max / 3){
                        return 'count has-text-caution';
                    }
                    else if (global.civic[job].workers <= global.civic[job].max * 0.66){
                        return 'count has-text-warning';
                    }
                    else if (global.civic[job].workers < global.civic[job].max){
                        return 'count has-text-info';
                    }
                    else {
                        return 'count';
                    }
                },
                setDefault(j, event){
                    playAvatarControlClickSound(event);
                    global.civic.d_job = j;
                    if (global.city?.foundry?.d_craft){
                        global.city.foundry.d_craft = null;
                    }
                },
                isDefault(j){
                    return global.civic.d_job === j && !global.city?.foundry?.d_craft;
                }
            },
            filters: {
                d_state(j){
                    return (global.civic.d_job === j && !global.city?.foundry?.d_craft) ? '*' : '';
                },
                event(c){
                    if ((job === 'unemployed' && global.civic.unemployed.display) || (job === 'hunter' && !global.civic.unemployed.display)){
                        let egg = easterEgg(3,14);
                        if (c === 0 && egg.length > 0){
                            return egg;
                        }
                    }
                    return c;
                },
                jobMax(value){
                    return value === -1 ? '∞' : value;
                },
                adjust(v,j){
                    if (j === 'titan_colonist' && p_on['ai_colonist']){
                        return v + jobScale(p_on['ai_colonist']);
                    }
                    return v;
                },
                resSize(value){
                    return sizeApproximation(value,0);
                },
                resDiff(value){
                    return sizeApproximation(value,2);
                }
            }
        });
    }
    if (!servant && useAvatarControls){
        const initDrag = () => setupAvatarStackDragResize($(`#${id} .job-avatar-label`), job);
        if (typeof requestAnimationFrame === 'function'){
            requestAnimationFrame(initDrag);
        }
        else {
            setTimeout(initDrag, 0);
        }
    }
    if (job === 'farmer' || job === 'lumberjack'){
        const resName = job === 'farmer' ? 'Food' : 'Lumber';
        const bindPopovers = () => {
            const countId = `job-res-cnt-${resName}`;
            const rateId = `job-res-inc-${resName}`;
            const countEl = $(`#${countId}`);
            const rateEl = $(`#${rateId}`);
            if (countEl.length && !countEl.data('popoverBound')){
                countEl.data('popoverBound', true);
                breakdownPopover(countId, resName, 'c');
            }
            if (rateEl.length && !rateEl.data('popoverBound')){
                rateEl.data('popoverBound', true);
                breakdownPopover(rateId, resName, 'p');
            }
        };
        if (typeof requestAnimationFrame === 'function'){
            requestAnimationFrame(bindPopovers);
        }
        else {
            setTimeout(bindPopovers, 0);
        }
    }

    if (job === 'entertainer'){
        ensureMoraleJobControls();
    }

    popover(id, function(){
            return job_desc[job](servant);
        },
        {
            elm: `#${id} .job_label`,
            classes: `has-background-light has-text-dark`
        }
    );
}

function setupAvatarStackDragResize(jobLabel, job){
    if (!jobLabel || !jobLabel.length){
        return;
    }
    const stack = jobLabel.find('.job-avatar-stack').first();
    if (!stack.length || stack.data('dragBound')){
        return;
    }
    stack.data('dragBound', true);
    const offsetKey = `evolve.jobAvatarStackPos.${job}`;
    const sizeKey = `evolve.jobAvatarStackSize.${job}`;
    let offset = { x: 0, y: 0 };
    let size = { w: 0, h: 0 };
    if (save && save.getItem){
        const rawOffset = save.getItem(offsetKey);
        if (rawOffset){
            try {
                const parsed = JSON.parse(rawOffset);
                if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)){
                    offset = { x: parsed.x, y: parsed.y };
                }
            }
            catch {
                // Ignore malformed stored offsets.
            }
        }
        const rawSize = save.getItem(sizeKey);
        if (rawSize){
            try {
                const parsed = JSON.parse(rawSize);
                if (parsed && Number.isFinite(parsed.w) && Number.isFinite(parsed.h)){
                    size = { w: parsed.w, h: parsed.h };
                }
            }
            catch {
                // Ignore malformed stored sizes.
            }
        }
    }
    const applyOffset = (x, y) => {
        stack.css('--stack-offset-x', `${x}px`);
        stack.css('--stack-offset-y', `${y}px`);
    };
    const applySize = (w, h) => {
        if (Number.isFinite(w) && w > 0){
            stack.css('width', `${w}px`);
        }
        else {
            stack.css('width', '');
        }
        if (Number.isFinite(h) && h > 0){
            stack.css('height', `${h}px`);
        }
        else {
            stack.css('height', '');
        }
    };
    applyOffset(offset.x, offset.y);
    applySize(size.w, size.h);

    let dragging = false;
    let start = { x: 0, y: 0 };
    let startOffset = { x: 0, y: 0 };
    const onMove = (event) => {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!dragging && Math.abs(dx) + Math.abs(dy) < 4){
            return;
        }
        dragging = true;
        offset = { x: startOffset.x + dx, y: startOffset.y + dy };
        applyOffset(offset.x, offset.y);
    };
    const onUp = () => {
        $(document).off('pointermove.avatarStack pointerup.avatarStack pointercancel.avatarStack');
        if (dragging && save && save.setItem){
            save.setItem(offsetKey, JSON.stringify(offset));
        }
        stack.removeClass('is-dragging');
    };
    stack.on('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        if ($(event.target).closest('.job-avatar-control, .job-avatar-resizer').length){
            return;
        }
        start = { x: event.clientX, y: event.clientY };
        startOffset = { x: offset.x, y: offset.y };
        dragging = false;
        stack.addClass('is-dragging');
        event.preventDefault();
        $(document).on('pointermove.avatarStack', onMove);
        $(document).on('pointerup.avatarStack pointercancel.avatarStack', onUp);
    });

    const resizer = stack.find('.job-avatar-resizer').first();
    if (resizer.length){
        let resizing = false;
        let startSize = { w: 0, h: 0 };
        const onResizeMove = (event) => {
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (!resizing && Math.abs(dx) + Math.abs(dy) < 4){
                return;
            }
            resizing = true;
            const nextW = Math.max(32, startSize.w + dx);
            const nextH = Math.max(48, startSize.h + dy);
            size = { w: nextW, h: nextH };
            applySize(size.w, size.h);
        };
        const onResizeUp = () => {
            $(document).off('pointermove.avatarResize pointerup.avatarResize pointercancel.avatarResize');
            if (resizing && save && save.setItem){
                save.setItem(sizeKey, JSON.stringify(size));
            }
        };
        resizer.on('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0){
                return;
            }
            const rect = stack[0].getBoundingClientRect();
            start = { x: event.clientX, y: event.clientY };
            startSize = { w: rect.width, h: rect.height };
            resizing = false;
            event.preventDefault();
            $(document).on('pointermove.avatarResize', onResizeMove);
            $(document).on('pointerup.avatarResize pointercancel.avatarResize', onResizeUp);
        });
    }
}

function setupCraftsmanCountDrag(jobLabel, res){
    if (!jobLabel || !jobLabel.length){
        return;
    }
    const current = jobLabel.find('.count').not('.count-max').first();
    const max = jobLabel.find('.count.count-max').first();
    bindCraftsmanCountDrag(current, `${res}.current`, '--count-offset-x', '--count-offset-y');
    bindCraftsmanCountDrag(max, `${res}.max`, '--count-max-offset-x', '--count-max-offset-y');
}

function bindCraftsmanCountDrag(target, keySuffix, varX, varY){
    if (!target.length || target.data('dragBound')){
        return;
    }
    target.data('dragBound', true);
    target.addClass('is-draggable');
    const offsetKey = `evolve.craftsmanCountPos.${keySuffix}`;
    let offset = { x: 0, y: 0 };
    if (save && save.getItem){
        const rawOffset = save.getItem(offsetKey);
        if (rawOffset){
            try {
                const parsed = JSON.parse(rawOffset);
                if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)){
                    offset = { x: parsed.x, y: parsed.y };
                }
            }
            catch {
                // Ignore malformed stored offsets.
            }
        }
    }
    const applyOffset = (x, y) => {
        target.css(varX, `${x}px`);
        target.css(varY, `${y}px`);
    };
    applyOffset(offset.x, offset.y);

    let dragging = false;
    let start = { x: 0, y: 0 };
    let startOffset = { x: 0, y: 0 };
    const eventKey = `craftsmanCountDrag${keySuffix.replace(/[^a-z0-9]/gi, '')}`;
    const onMove = (event) => {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!dragging && Math.abs(dx) + Math.abs(dy) < 4){
            return;
        }
        dragging = true;
        offset = { x: startOffset.x + dx, y: startOffset.y + dy };
        applyOffset(offset.x, offset.y);
    };
    const onUp = () => {
        $(document).off(`pointermove.${eventKey} pointerup.${eventKey} pointercancel.${eventKey}`);
        if (dragging && save && save.setItem){
            save.setItem(offsetKey, JSON.stringify(offset));
        }
        target.removeClass('is-dragging');
    };
    target.on('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        start = { x: event.clientX, y: event.clientY };
        startOffset = { x: offset.x, y: offset.y };
        dragging = false;
        target.addClass('is-dragging');
        event.preventDefault();
        $(document).on(`pointermove.${eventKey}`, onMove);
        $(document).on(`pointerup.${eventKey} pointercancel.${eventKey}`, onUp);
    });
}


export function renderResidentialJobs(){
    if (!global.settings?.showCity){
        return;
    }
    const district = $('#city-dist-residential');
    if (!district.length){
        return;
    }
    let container = district.find('#residential-jobs');
    if (!container.length){
        container = $('<div id="residential-jobs" class="jobList residential-jobs"></div>');
        const header = district.children().first();
        if (header.length){
            header.after(container);
        }
        else {
            district.prepend(container);
        }
    }

    const unemployed = $('#civ-unemployed');
    if (unemployed.length){
        container.append(unemployed);
    }
    else {
        loadJob('unemployed', false, 0, 0, 'warning', { target: '#residential-jobs' });
    }

    const farmer = $('#civ-farmer');
    if (farmer.length){
        container.append(farmer);
    }
    else {
        loadJob('farmer', false, 0.82, 5, null, { target: '#residential-jobs' });
    }
}

export function renderIndustrialJobs(){
    if (!global.settings?.showCity){
        return;
    }
    const district = $('#city-dist-industrial');
    if (!district.length){
        return;
    }
    let container = district.find('#industrial-jobs');
    if (!container.length){
        container = $('<div id="industrial-jobs" class="jobList industrial-jobs"></div>');
        const header = district.children().first();
        if (header.length){
            header.after(container);
        }
        else {
            district.prepend(container);
        }
    }

    const lumberjack = $('#civ-lumberjack');
    if (lumberjack.length){
        container.append(lumberjack);
    }
    else {
        loadJob('lumberjack', false, 1, 5, null, { target: '#industrial-jobs' });
    }

    const miner = $('#civ-miner');
    if (miner.length){
        container.append(miner);
    }
    else {
        loadJob('miner', false, 1, 4, 'advanced', { target: '#industrial-jobs' });
    }

    const coalMiner = $('#civ-coal_miner');
    if (coalMiner.length){
        container.append(coalMiner);
    }
    else {
        loadJob('coal_miner', false, 0.2, 4, 'advanced', { target: '#industrial-jobs' });
    }

    const cementWorker = $('#civ-cement_worker');
    if (cementWorker.length){
        container.append(cementWorker);
    }
    else {
        loadJob('cement_worker', false, 0.4, 5, 'advanced', { target: '#industrial-jobs' });
    }
}

export function renderIndustrialFoundry(){
    if (!global.settings?.showCity){
        return;
    }
    const district = $('#city-dist-industrial');
    if (!district.length){
        return;
    }
    let container = district.find('#industrial-foundry');
    if (!container.length){
        container = $('<div id="industrial-foundry" class="jobList industrial-foundry"></div>');
        const jobs = district.find('#industrial-jobs');
        if (jobs.length){
            jobs.after(container);
        }
        else {
            const header = district.children().first();
            if (header.length){
                header.after(container);
            }
            else {
                district.prepend(container);
            }
        }
    }
    loadFoundry(false, { target: '#industrial-foundry' });
}

export function renderCommercialJobs(){
    if (!global.settings?.showCity){
        return;
    }
    const district = $('#city-dist-commercial');
    if (!district.length){
        return;
    }
    let container = district.find('#commercial-jobs');
    if (!container.length){
        container = $('<div id="commercial-jobs" class="jobList commercial-jobs"></div>');
        const header = district.children().first();
        if (header.length){
            header.after(container);
        }
        else {
            district.prepend(container);
        }
    }

    const entertainer = $('#civ-entertainer');
    if (entertainer.length){
        container.append(entertainer);
    }
    else {
        loadJob('entertainer', false, 1, 10, 'advanced', { target: '#commercial-jobs' });
    }
}

export function renderScienceJobs(){
    if (!global.settings?.showCity){
        return;
    }
    const district = $('#city-dist-science');
    if (!district.length){
        return;
    }
    let container = district.find('#science-jobs');
    if (!container.length){
        container = $('<div id="science-jobs" class="jobList science-jobs"></div>');
        const header = district.children().first();
        if (header.length){
            header.after(container);
        }
        else {
            district.prepend(container);
        }
    }

    const professor = $('#civ-professor');
    if (professor.length){
        container.append(professor);
    }
    else {
        loadJob('professor', false, 0.5, 6, 'advanced', { target: '#science-jobs' });
    }

    const scientist = $('#civ-scientist');
    if (scientist.length){
        container.append(scientist);
    }
    else {
        loadJob('scientist', false, 1, 5, 'advanced', { target: '#science-jobs' });
    }

    const banker = $('#civ-banker');
    if (banker.length){
        container.append(banker);
    }
    else {
        loadJob('banker', false, 0.1, 6, 'advanced', { target: '#science-jobs' });
    }
}

export function loadServants(){
    clearElement($('#servants'));
    if (global.race['servants'] && Object.keys(global.race.servants.jobs).length > 0){
        var servants = $(`<div id="servantList" class="job"><div class="foundry job_label"><h3 class="serveHeader has-text-warning">${loc('civics_servants')}</h3><span :class="level()">{{ s.used }} / {{ s.max }}</span></div></div>`);
        $('#servants').append(servants);

        ['hunter','forager','farmer','lumberjack','quarry_worker','crystal_miner','scavenger'].forEach(function(job){
            loadJob(job,'servant');
        });

        vBind({
            el: `#servantList`,
            data: {
                s: global.race.servants
            },
            methods: {
                level(){
                    if (global.race.servants.used === 0){
                        return 'count has-text-danger';
                    }
                    else if (global.race.servants.used === global.race.servants.max){
                        return 'count has-text-success';
                    }
                    else if (global.race.servants.used <= global.race.servants.max / 3){
                        return 'count has-text-caution';
                    }
                    else if (global.race.servants.used <= global.race.servants.max * 0.66){
                        return 'count has-text-warning';
                    }
                    else if (global.race.servants.used < global.race.servants.max){
                        return 'count has-text-info';
                    }
                    else {
                        return 'count';
                    }
                }
            }
        });

        popover('servants', function(){
                return loc('civics_servants_desc');
            },
            {
                elm: `#servants .serveHeader`
            }
        );
    }
}

export function teamsterCap(){
    let transport = 0;
    if (global.race['gravity_well']){
        transport = global.tech['transport'] ? global.tech.transport : 0;
        transport = Math.round(global.race.teamster / transport * 1.5);
    }
    if (global.tech['railway']){
        transport -= global.tech['railway'] * 2;
    }
    if (transport < 0){ transport = 0; }
    return transport;
}

export function craftsmanCap(res){
    switch (res){
        case 'Scarletite':
            if (global.portal.hasOwnProperty('hell_forge')){
                let cap = getStructNumActive(actions.portal.prtl_ruins.hell_forge);
                return jobScale(cap);
            }
            return 0;

        case 'Quantium':
            let cap = 0;
            if (global.tech['isolation']){
                if (global.tauceti.hasOwnProperty('infectious_disease_lab')){
                    cap = getStructNumActive(actions.tauceti.tau_home.infectious_disease_lab);
                }
            }
            else if (global.space.hasOwnProperty('zero_g_lab')){
                cap = getStructNumActive(actions.space.spc_enceladus.zero_g_lab);
            }
            return jobScale(cap || 0);

        // This function isn't used to limit normal craftsmen
        default:
            return Number.MAX_SAFE_INTEGER;
    }
}

export function limitCraftsmen(res, allow_redraw = true){
    // Ignore undiscovered materials
    if (!global.resource[res].display){
        return;
    }

    // Remember previous crafter limits and refresh UI later on if they change
    if (!tmp_vars.hasOwnProperty('craftsman_cap')){
        tmp_vars.craftsman_cap = {};
    }

    let cap = craftsmanCap(res);
    let refresh = false;
    if (global.city.hasOwnProperty('foundry') && global.city.foundry.hasOwnProperty(res) && cap < global.city.foundry[res]){
        let diff = global.city.foundry[res] - cap;
        global.civic.craftsman.workers -= diff;
        global.city.foundry.crafting -= diff;
        global.city.foundry[res] -= diff;
        refresh = true;
    }
    else if (!tmp_vars['craftsman_cap'].hasOwnProperty(res)){
        refresh = true;
    }
    else if (cap != tmp_vars['craftsman_cap'][res]){
        refresh = true;
    }
    tmp_vars['craftsman_cap'][res] = cap;

    // Refresh UI when the cap changes due to power balancing
    if (allow_redraw && refresh){
        loadFoundry();
    }
}

export function assignDefaultCraftsmen(){
    const canCraft = (global.city?.foundry && global.city.foundry.count > 0)
        || global.race['cataclysm']
        || global.race['orbit_decayed']
        || global.tech['isolation']
        || global.race['warlord'];
    if (!global.city?.foundry || !canCraft){
        return;
    }
    const res = global.city.foundry.d_craft;
    if (!res || !global.resource?.[res]?.display){
        return;
    }
    if (!global.city.foundry.hasOwnProperty(res)){
        global.city.foundry[res] = 0;
    }
    const available = global.civic.craftsman.workers - global.city.foundry.crafting;
    if (available <= 0){
        return;
    }
    let add = available;
    const cap = craftsmanCap(res);
    if (cap !== Number.MAX_SAFE_INTEGER){
        add = Math.min(add, cap - global.city.foundry[res]);
    }
    if (add <= 0){
        return;
    }
    global.city.foundry[res] += add;
    global.city.foundry.crafting += add;
}

export function getDefaultPopulationJob(){
    const canCraft = (global.city?.foundry && global.city.foundry.count > 0)
        || global.race['cataclysm']
        || global.race['orbit_decayed']
        || global.tech['isolation']
        || global.race['warlord'];
    if (!global.city?.foundry || !canCraft){
        return global.civic.d_job;
    }
    const res = global.city.foundry.d_craft;
    if (!res || !global.resource?.[res]?.display){
        return global.civic.d_job;
    }
    return 'craftsman';
}

export function farmerValue(farm,servant){
    let farming = global.civic.farmer.impact;
    if (farm){
        farming += global.tech['agriculture'] && global.tech.agriculture >= 2 ? 1.15 : 0.65;
    }
    if (global.race['living_tool'] && !servant){
        farming *= 1 + traits.living_tool.vars()[0] * (global.tech['science'] && global.tech.science > 0 ? global.tech.science / 5 : 0);
    }
    else {
        farming *= 1 + (global.tech['hoe'] && global.tech.hoe > 0 ? global.tech.hoe / 3 : 0);
    }
    farming *= global.city.biome === 'grassland' ? biomes.grassland.vars()[0] : 1;
    farming *= global.city.biome === 'savanna' ? biomes.savanna.vars()[0] : 1;
    farming *= global.city.biome === 'ashland' ? biomes.ashland.vars()[0] : 1;
    farming *= global.city.biome === 'volcanic' ? biomes.volcanic.vars()[0] : 1;
    farming *= global.city.biome === 'hellscape' ? biomes.hellscape.vars()[0] : 1;
    farming *= global.city.ptrait.includes('trashed') ? planetTraits.trashed.vars()[0] : 1;
    if (servant){
        farming *= servantTrait(global.race.servants.jobs.farmer,'farmer');
    }
    else {
        farming *= racialTrait(global.civic.farmer.workers,'farmer');
    }
    farming *= global.tech['agriculture'] >= 7 ? 1.1 : 1;
    farming *= global.race['low_light'] ? (1 - traits.low_light.vars()[0] / 100) : 1;
    return farming;
}

function resolveFoundryTarget(servants, options){
    if (options && options.target){
        return options.target;
    }
    if (servants){
        return '#skilledServants';
    }
    if ($('#industrial-foundry').length){
        return '#industrial-foundry';
    }
    return '#foundry';
}

export function loadFoundry(servants, options){
    const target = resolveFoundryTarget(servants, options);
    if (!servants && target !== '#foundry' && $('#foundry').length){
        clearElement($('#foundry'));
    }
    clearElement($(target));
    if ((global.city['foundry'] && global.city['foundry'].count > 0) || global.race['cataclysm'] || global.race['orbit_decayed'] || global.tech['isolation'] || global.race['warlord']){
        let element = $(target);
        let track = servants ? `{{ s.sused }} / {{ s.smax }}` : `{{ f.crafting }} / {{ c.max }}`;
        let foundry = $(`<div class="job foundry-header"><div class="foundry job_label"><h3 class="has-text-warning">${loc(servants ? 'civics_skilled_servants' : 'craftsman_assigned')}</h3><span :class="level()">${track}</span></div></div>`);
        element.append(foundry);

        let summer = eventActive('summer');
        let list = ['Plywood','Brick','Wrought_Iron','Sheet_Metal','Mythril','Aerogel','Nanoweave'];
        if (!servants){
            list.push('Scarletite');
            list.push('Quantium');
        }
        if (summer && !servants){
            list.push('Thermite');
        }
        const craftsmanAvatarMap = {};
        for (let i=0; i<list.length; i++){
            let res = list[i];
            if ((servants && !global.race.servants.sjobs.hasOwnProperty(res)) || (!servants && !global.city.foundry.hasOwnProperty(res))){
                if (servants){
                    global.race.servants.sjobs[res] = 0;
                }
                else {
                    global.city.foundry[res] = 0;
                }
            }
            if (global.resource[res].display || (summer && res === 'Thermite')){
                let name = global.resource[res].name;
                const avatarSlug = craftsmanAvatarMap[res];
                let resource = $(`<div class="job"></div>`);
                if (avatarSlug){
                    resource.addClass('craftsman-avatar-job');
                }
                element.append(resource);

                let controls = $('<div class="controls"></div>');
                let job_label;
                if (res === 'Scarletite' && global.portal.hasOwnProperty('hell_forge')){
                    job_label = $(`<div id="craft${res}" class="job_label"><h3 class="has-text-danger">${name}</h3><span class="count">{{ f.${res} }} / {{ p.on | maxScar }}</span></div>`);
                }
                else if (res === 'Quantium' && (global.space.hasOwnProperty('zero_g_lab') || global.tauceti.hasOwnProperty('infectious_disease_lab'))){
                    job_label = $(`<div id="craft${res}" class="job_label"><h3 class="has-text-danger">${name}</h3><span class="count">{{ f.${res} }} / {{ e.on | maxQuantium }}</span></div>`);
                }
                else {
                    let tracker = servants ? `{{ s.sjobs.${res} }}` : `{{ f.${res} }}`;
                    let id = servants ? `scraft${res}` : `craft${res}`;
                    if (avatarSlug){
                        job_label = $(
                            `<div id="${id}" class="job_label job-avatar-label craftsman-avatar craftsman-avatar-${avatarSlug}">` +
                                `<h3><a class="has-text-danger" title="${name}" data-job-name="${name}">` +
                                    `<span role="button" aria-label="remove ${name} crafter" class="job-avatar-control avatar-control-sub" @click.stop.prevent="sub('${res}', $event)">➖</span>` +
                                    `<span role="button" aria-label="add ${name} crafter" class="job-avatar-control avatar-control-add" @click.stop.prevent="add('${res}', $event)">➕</span>` +
                                    `${servants ? '' : `<span role="button" aria-label="Set default ${name} crafter" class="job-avatar-control avatar-control-default" :class="{ 'is-default': isDefaultCraft('${res}') }" :aria-pressed="isDefaultCraft('${res}')" @click.stop.prevent="setDefaultCraft('${res}', $event)">✔</span>`}` +
                                    `${name}` +
                                `</a></h3>` +
                                `<span class="count">${tracker}</span>` +
                                `<span class="count count-max">{{ $options.filters.craftMax('${res}') }}</span>` +
                            `</div>`
                        );
                        controls = null;
                    }
                    else {
                        job_label = $(`<div id="${id}" class="job_label"><h3 class="has-text-danger">${name}</h3><span class="count">${tracker}</span></div>`);
                    }
                }

                resource.append(job_label);
                if (controls){
                    resource.append(controls);
                }
                element.append(resource);

                if (controls){
                    let sub = $(`<span role="button" aria-label="remove ${global.resource[res].name} crafter" class="sub has-text-danger" @click="sub('${res}')"><span>&laquo;</span></span>`);
                    let add = $(`<span role="button" aria-label="add ${global.resource[res].name} crafter" class="add has-text-success" @click="add('${res}')"><span>&raquo;</span></span>`);

                    controls.append(sub);
                    controls.append(add);
                }
            }
        }

        if (!servants && global.city?.foundry && !global.city.foundry.hasOwnProperty('d_craft')){
            global.city.foundry.d_craft = null;
        }
        let bindData = global.portal.hasOwnProperty('hell_forge') ? {
            c: global.civic.craftsman,
            p: global.portal.hell_forge,
        } : {
            c: global.civic.craftsman,
            e: global.space.hasOwnProperty('zero_g_lab') || global.tauceti.hasOwnProperty('infectious_disease_lab') ? (global.tech['isolation'] ? global.tauceti.infectious_disease_lab : global.space.zero_g_lab) : { count: 0, on: 0 },
        };
        if (servants){
            bindData['s'] = global.race.servants;
        }
        else {
            bindData['f'] = global.city.foundry;
        }

        vBind({
            el: target,
            data: bindData,
            methods: {
                add(res, event){
                    playAvatarControlClickSound(event);
                    let keyMult = keyMultiplier();
                    let tMax = -1;
                    if (res === 'Scarletite' || res === 'Quantium'){
                        tMax = craftsmanCap(res);
                    }
                    for (let i=0; i<keyMult; i++){
                        if (servants){
                            if (global.race.servants.sused < global.race.servants.smax){
                                global.race.servants.sjobs[res]++;
                                global.race.servants.sused++;
                            }
                            else {
                                break;
                            }
                        }
                        else {
                            if (global.city.foundry.crafting < global.civic.craftsman.max
                                && (global.civic[global.civic.d_job] && global.civic[global.civic.d_job].workers > 0)
                                && (tMax === -1 || tMax > global.city.foundry[res])
                            ){
                                global.civic.craftsman.workers++;
                                global.city.foundry.crafting++;
                                global.city.foundry[res]++;
                                global.civic[global.civic.d_job].workers--;
                            }
                            else {
                                break;
                            }
                        }
                    }
                },
                sub(res, event){
                    playAvatarControlClickSound(event);
                    let keyMult = keyMultiplier();
                    for (let i=0; i<keyMult; i++){
                        if (servants){
                            if (global.race.servants.sjobs[res] > 0){
                                global.race.servants.sjobs[res]--;
                                global.race.servants.sused--;
                            }
                            else {
                                break;
                            }
                        }
                        else {
                            if (global.city.foundry[res] > 0){
                                global.city.foundry[res]--;
                                global.civic.craftsman.workers--;
                                global.city.foundry.crafting--;
                                global.civic[global.civic.d_job].workers++;
                            }
                            else {
                                break;
                            }
                        }
                    }
                },
                setDefaultCraft(res, event){
                    if (servants){
                        return;
                    }
                    playAvatarControlClickSound(event);
                    if (global.city?.foundry){
                        global.city.foundry.d_craft = global.city.foundry.d_craft === res ? null : res;
                    }
                },
                isDefaultCraft(res){
                    if (servants){
                        return false;
                    }
                    return global.city?.foundry?.d_craft === res;
                },
                level(){
                    let workers = servants ? global.race.servants.sused : global.civic.craftsman.workers;
                    let max = servants ? global.race.servants.smax : global.civic.craftsman.max;
                    if (workers === 0){
                        return 'count has-text-danger';
                    }
                    else if (workers === max){
                        return 'count has-text-success';
                    }
                    else if (workers <= max / 3){
                        return 'count has-text-caution';
                    }
                    else if (workers <= max * 0.66){
                        return 'count has-text-warning';
                    }
                    else if (workers < max){
                        return 'count has-text-info';
                    }
                    else {
                        return 'count';
                    }
                }
            },
            filters: {
                maxScar(v){
                    return craftsmanCap('Scarletite');
                },
                maxQuantium(v){
                    return craftsmanCap('Quantium');
                },
                craftMax(res){
                    const cap = craftsmanCap(res);
                    if (cap !== Number.MAX_SAFE_INTEGER){
                        return cap;
                    }
                    return servants ? global.race.servants.smax : global.civic.craftsman.max;
                }
            }
        });

        const bindCraftsmanCountDrag = () => {
            const labelId = servants ? 'scraftPlywood' : 'craftPlywood';
            const jobLabel = $(`#${labelId}.job_label`);
            if (jobLabel.length){
                setupCraftsmanCountDrag(jobLabel, 'Plywood');
            }
        };
        if (typeof requestAnimationFrame === 'function'){
            requestAnimationFrame(bindCraftsmanCountDrag);
        }
        else {
            setTimeout(bindCraftsmanCountDrag, 0);
        }

        for (let i=0; i<list.length; i++){
            let res = list[i];
            if (global.resource[res].display || (summer && res === 'Thermite')){
                let extra = function(){
                    let total = $(`<div></div>`);
                    let name = global.resource[res].name;
                    let craft_total = craftingRatio(res,'auto');
                    let multiplier = craft_total.multiplier;
                    let speed = global.genes['crafty'] ? 2 : 1;
                    let final = +(global.resource[res].diff).toFixed(2);
                    let bonus = +(multiplier * 100).toFixed(0);

                    total.append($(`<div>${loc('craftsman_hover_bonus', [bonus.toLocaleString(), name])}</div>`));
                    total.append($(`<div>${loc('craftsman_hover_prod', [final.toLocaleString(), name])}</div>`));
                    let craft_cost = craftCost();
                    for (let i=0; i<craft_cost[res].length; i++){
                        let craftCost = 1;
                        if(global.race['resourceful']){
                            craftCost -= traits.resourceful.vars()[0] / 100
                        }
                        let fathom = fathomCheck('arraak');
                        if(fathom > 0){
                            craftCost -= traits.resourceful.vars(1)[0] / 100 * fathom;
                        }
                        let cost = +(craft_cost[res][i].a * global.city.foundry[res] * craftCost * speed / 140).toFixed(2);
                        total.append($(`<div>${loc('craftsman_hover_cost', [cost, global.resource[craft_cost[res][i].r].name])}<div>`));
                    }

                    return total;
                }

                let id = servants ? `scraft${res}` : `craft${res}`;
                craftingPopover(id,res,'auto',extra);
            }
        }

        if (servants){
            popover('servantFoundry', function(){
                    return loc('civics_skilled_servants_desc');
                },
                {
                    elm: `#skilledServants .foundry`,
                    classes: `has-background-light has-text-dark`
                }
            );
        }
        else {
            popover('craftsmenFoundry', function(){
                    return loc('job_craftsman_hover');
                },
                {
                    elm: `${target} .foundry`,
                    classes: `has-background-light has-text-dark`
                }
            );
        }

        if (global.race['servants'] && !servants && global.race.servants.smax > 0){
            loadFoundry(true);
        }
    }
}

const armyIdleAltSfx = (() => {
    if (typeof window === 'undefined'){
        return null;
    }
    if (!window.evolveArmyIdleAltSfx){
        const audio = new Audio('/photo/active-4/拔剑.m4a');
        audio.preload = 'auto';
        audio.volume = 0.6;
        window.evolveArmyIdleAltSfx = { audio };
    }
    return window.evolveArmyIdleAltSfx;
})();

function playArmyIdleAltSfx(){
    if (!armyIdleAltSfx){
        return;
    }
    try {
        armyIdleAltSfx.audio.currentTime = 0;
        armyIdleAltSfx.audio.play();
    }
    catch {
        // Ignore playback errors (e.g. autoplay restrictions).
    }
}

const armyPanelState = {
    units: [],
    rafId: null,
    lastTs: 0,
    runner: null,
    runnerPos: null,
    runnerPosLocked: false,
    runnerAnimTimer: null,
    idleLoopStart: null,
    idleTimer: null,
    idleAltTimer: null,
    idleAltFrameTimer: null,
    idleAltPlaying: false,
    idleAltEl: null,
    idleIntroTimer: null,
    idleIntroDone: false,
    idleSeqTimer: null,
    idleSeqIndex: 0,
    idleSeqPhase: 'intro',
    idleSeqEl: null
};

const ARMY_IDLE_INACTIVITY_MS = 120000;
const ARMY_IDLE_FRAME_MS = 200;
const ARMY_IDLE_INTRO_MS = 12 * ARMY_IDLE_FRAME_MS;
const ARMY_IDLE_LOOP_MS = ARMY_IDLE_INTRO_MS;
const ARMY_IDLE_ALT_FRAME_MS = 200;
const ARMY_STATIC_MODE = false;
const ARMY_IDLE_SEQUENCE_MODE = true;
const ARMY_IDLE_SPRITE_MODE = true;
const ARMY_IDLE_FRAMES_INTRO = [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37];
const ARMY_IDLE_FRAMES_LOOP = [37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26];
const ARMY_IDLE_SHEET = {
    url: '/photo/active-4/active-b-sprite.webp',
    cols: 4,
    rows: 3,
    frameW: 1124,
    frameH: 1009,
    start: 26,
    image: null
};
const ARMY_IDLE_ALT_SHEET = {
    url: '/photo/active-4/active-a-sprite.webp',
    cols: 5,
    rows: 5,
    frameW: 1124,
    frameH: 1009,
    start: 1,
    image: null
};

function getArmySpriteImage(sheet){
    if (!sheet){
        return null;
    }
    if (!sheet.image){
        const img = new Image();
        img.decoding = 'async';
        img.src = sheet.url;
        sheet.image = img;
    }
    return sheet.image;
}

function renderArmySpriteFrame(target, sheet, frameValue){
    if (!target || !sheet){
        return;
    }
    const idx = Number(frameValue) - sheet.start;
    if (!Number.isFinite(idx) || idx < 0){
        return;
    }
    const img = getArmySpriteImage(sheet);
    if (!img || !img.complete){
        if (img && !img._armyFrameHooked){
            img._armyFrameHooked = true;
            img.addEventListener('load', () => {
                if (target.isConnected){
                    renderArmySpriteFrame(target, sheet, frameValue);
                }
            }, { once: true });
        }
        return;
    }
    if (target.tagName === 'CANVAS'){
        if (target.width !== sheet.frameW){
            target.width = sheet.frameW;
        }
        if (target.height !== sheet.frameH){
            target.height = sheet.frameH;
        }
        const ctx = target.getContext('2d');
        if (!ctx){
            return;
        }
        const col = idx % sheet.cols;
        const row = Math.floor(idx / sheet.cols);
        const sx = col * sheet.frameW;
        const sy = row * sheet.frameH;
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(img, sx, sy, sheet.frameW, sheet.frameH, 0, 0, target.width, target.height);
        return;
    }
    if (target.tagName === 'IMG'){
        target.src = `${sheet.url}#frame-${frameValue}`;
        return;
    }
    const col = idx % sheet.cols;
    const row = Math.floor(idx / sheet.cols);
    const bgSize = `${sheet.cols * sheet.frameW}px ${sheet.rows * sheet.frameH}px`;
    if (target.dataset.spriteSheet !== sheet.url){
        target.dataset.spriteSheet = sheet.url;
        target.style.backgroundImage = `url(${sheet.url})`;
        target.style.backgroundRepeat = 'no-repeat';
        target.style.backgroundSize = bgSize;
    }
    target.style.backgroundPosition = `-${col * sheet.frameW}px -${row * sheet.frameH}px`;
}
const ARMY_STATIC_STYLE = [
    'position:absolute',
    'left:50%',
    'top:60%',
    'width:15rem',
    'height:15rem',
    'transform:translate(-50%, -50%)',
    'background-image:url(/photo/active-4/active-b/26.webp)',
    'background-repeat:no-repeat',
    'background-size:contain',
    'background-position:center',
    'filter:drop-shadow(0 0 3px rgba(245, 197, 66, 0.5))',
    'pointer-events:none'
].join(';');

function stopArmyAnimations(){
    if (armyPanelState.runnerAnimTimer){
        clearTimeout(armyPanelState.runnerAnimTimer);
        armyPanelState.runnerAnimTimer = null;
    }
    if (armyPanelState.idleTimer){
        clearTimeout(armyPanelState.idleTimer);
        armyPanelState.idleTimer = null;
    }
    if (armyPanelState.idleAltTimer){
        clearTimeout(armyPanelState.idleAltTimer);
        armyPanelState.idleAltTimer = null;
    }
    if (armyPanelState.idleAltFrameTimer){
        clearTimeout(armyPanelState.idleAltFrameTimer);
        armyPanelState.idleAltFrameTimer = null;
    }
    if (armyPanelState.idleIntroTimer){
        clearTimeout(armyPanelState.idleIntroTimer);
        armyPanelState.idleIntroTimer = null;
    }
    if (armyPanelState.idleSeqTimer){
        clearTimeout(armyPanelState.idleSeqTimer);
        armyPanelState.idleSeqTimer = null;
    }
    if (armyPanelState.rafId !== null){
        cancelAnimationFrame(armyPanelState.rafId);
        armyPanelState.rafId = null;
    }
    armyPanelState.units.forEach((unit) => unit.el?.remove?.());
    armyPanelState.units = [];
    armyPanelState.runner = null;
    armyPanelState.idleAltEl = null;
    armyPanelState.idleAltPlaying = false;
    armyPanelState.idleSeqEl = null;
    armyPanelState.idleSeqIndex = 0;
    armyPanelState.idleSeqPhase = 'intro';
    armyPanelState.runnerPosLocked = false;
}

function ensureArmyPanel(){
    if (typeof document === 'undefined'){
        return;
    }
    const host = $('#job-army');
    if (!host.length){
        return;
    }
    const panel = host.find('.army-panel').first();
    const scene = panel.find('.army-scene').first();
    if (!panel.length || !scene.length){
        host.empty();
        host.append(`
            <div class="army-panel">
                <div class="army-panel-header">
                    <span class="name has-text-warning">${loc('city_garrison')}</span>
                </div>
                <div class="army-scene" aria-hidden="true">
                    <div class="army-barracks" title="${loc('city_garrison')}"></div>
                    <div class="army-gate"></div>
                    <div class="army-unit-layer">
                        <div class="army-unit-static" aria-hidden="true" style="${ARMY_STATIC_STYLE}"></div>
                    </div>
                </div>
            </div>
        `);
    }
    else if (!scene.find('.army-unit-layer').length){
        scene.append('<div class="army-unit-layer"></div>');
    }
    const cityLayer = getCityArmySceneLayer();
    const scheduleCityPosition = (el) => {
        if (!el){
            return;
        }
        let attempts = 0;
        const maxAttempts = 8;
        const tryPosition = () => {
            const sceneData = getArmySceneData(host);
            if (sceneData){
                positionArmyRunner(el, sceneData, cityLayer?.layer?.[0]);
                return true;
            }
            attempts += 1;
            if (attempts < maxAttempts){
                requestAnimationFrame(tryPosition);
            }
            return false;
        };
        tryPosition();
    };
    if (ARMY_STATIC_MODE){
        host.addClass('army-static');
        if (cityLayer){
            cityLayer.scene.addClass('army-static');
            host.find('.army-unit, .army-unit-static, .army-idle-sprite').remove();
            cityLayer.layer.find('.army-unit, .army-idle-sprite').remove();
            let staticUnit = cityLayer.layer.find('.army-unit-static').first();
            if (!staticUnit.length){
                cityLayer.layer.append(`<div class="army-unit-static" aria-hidden="true" style="${ARMY_STATIC_STYLE}"></div>`);
                staticUnit = cityLayer.layer.find('.army-unit-static').first();
            }
            if (staticUnit.length){
                staticUnit.attr('style', ARMY_STATIC_STYLE);
                scheduleCityPosition(staticUnit[0]);
            }
        }
        else {
            host.find('.army-unit').remove();
            let staticUnit = host.find('.army-unit-static').first();
            if (!staticUnit.length){
                let layer = host.find('.army-unit-layer').first();
                if (!layer.length){
                    const scene = host.find('.army-scene').first();
                    if (scene.length){
                        scene.append('<div class="army-unit-layer"></div>');
                        layer = host.find('.army-unit-layer').first();
                    }
                }
                if (layer.length){
                    layer.append(`<div class="army-unit-static" aria-hidden="true" style="${ARMY_STATIC_STYLE}"></div>`);
                    staticUnit = host.find('.army-unit-static').first();
                }
            }
            if (staticUnit.length){
                staticUnit.attr('style', ARMY_STATIC_STYLE);
            }
        }
        stopArmyAnimations();
        return;
    }
    if (ARMY_IDLE_SPRITE_MODE){
        host.removeClass('army-static');
        host.find('.army-unit-static').remove();
        if (cityLayer){
            cityLayer.scene.removeClass('army-static');
            host.find('.army-unit, .army-unit-static, .army-idle-sprite').remove();
            cityLayer.layer.find('.army-unit, .army-unit-static').remove();
            let sprite = cityLayer.layer.find('.army-idle-sprite').first();
            if (!sprite.length){
                sprite = $('<canvas class="army-idle-sprite" aria-hidden="true"></canvas>');
                cityLayer.layer.append(sprite);
            }
            armyPanelState.idleSeqEl = sprite[0];
            armyPanelState.idleSeqIndex = 0;
            armyPanelState.idleSeqPhase = armyPanelState.idleIntroDone ? 'loop' : 'intro';
            startArmyIdleSequence(armyPanelState.idleSeqEl);
            scheduleCityPosition(sprite[0]);
        }
        else {
            let layer = host.find('.army-unit-layer').first();
            if (!layer.length){
                const scene = host.find('.army-scene').first();
                if (scene.length){
                    scene.append('<div class="army-unit-layer"></div>');
                    layer = host.find('.army-unit-layer').first();
                }
            }
            if (layer.length){
                host.find('.army-unit').remove();
                let sprite = layer.find('.army-idle-sprite').first();
                if (!sprite.length){
                    sprite = $('<canvas class="army-idle-sprite" aria-hidden="true"></canvas>');
                    layer.append(sprite);
                }
                armyPanelState.idleSeqEl = sprite[0];
                armyPanelState.idleSeqIndex = 0;
                armyPanelState.idleSeqPhase = armyPanelState.idleIntroDone ? 'loop' : 'intro';
                startArmyIdleSequence(armyPanelState.idleSeqEl);
            }
        }
        return;
    }
    host.removeClass('army-static');
    host.find('.army-unit-static').remove();
    if (cityLayer){
        cityLayer.scene.removeClass('army-static');
        cityLayer.layer.find('.army-unit-static, .army-idle-sprite').remove();
    }
    if (!host.is(':visible') && !cityLayer){
        return;
    }
    const sceneData = getArmySceneData(host);
    ensureArmyRunner(sceneData);
    if (!sceneData){
        if (host.data('armyScenePending')){
            return;
        }
        host.data('armyScenePending', true);
        requestAnimationFrame(() => {
            host.data('armyScenePending', false);
            const laterData = getArmySceneData(host);
            if (laterData){
                ensureArmyRunner(laterData);
            }
        });
    }
}

export function dockArmyPanelToCityDistricts(){
    if (typeof document === 'undefined'){
        return;
    }
    const armies = $('#job-army');
    if (armies.length > 1){
        let keep = armies.filter((_, el) => $(el).find('.army-panel').length).first();
        if (!keep.length){
            keep = armies.first();
        }
        armies.not(keep).remove();
    }
    let army = $('#job-army');
    if (!army.length){
        // Recreate the army container if it was cleared with the city content.
        army = $('<div id="job-army" class="tile is-child job-army"></div>');
    }
    if (!army.length){
        return;
    }
    $('#city-dist-army-panel').remove();
    const city = $('#city');
    if (!city.length){
        const jobList = $('#civics > .jobList').first();
        if (jobList.length){
            army.detach().appendTo(jobList);
        }
        ensureArmyPanel();
        return;
    }
    let wrapper = $('#city-army-panel');
    if (!wrapper.length){
        wrapper = $('<div id="city-army-panel" class="city city-army-panel"></div>');
    }
    const grid = $('#cityDistrictGrid');
    if (grid.length){
        const parent = grid.parent();
        const needsPlacement = !wrapper.parent().is(parent) || wrapper.prev()[0] !== grid[0];
        if (needsPlacement){
            wrapper.detach();
            grid.after(wrapper);
        }
    }
    else {
        if (!wrapper.parent().is(city)){
            wrapper.detach();
            city.append(wrapper);
        }
    }
    if (!army.parent().is(wrapper)){
        wrapper.append(army);
    }
    ensureArmyPanel();
    if (ARMY_IDLE_SPRITE_MODE){
        let layer = army.find('.army-unit-layer').first();
        if (!layer.length){
            const scene = army.find('.army-scene').first();
            if (scene.length){
                scene.append('<div class="army-unit-layer"></div>');
                layer = army.find('.army-unit-layer').first();
            }
        }
        if (layer.length){
            army.find('.army-unit').remove();
            let sprite = layer.find('.army-idle-sprite').first();
            if (!sprite.length){
                sprite = $('<canvas class="army-idle-sprite" aria-hidden="true"></canvas>');
                layer.append(sprite);
            }
        }
    }
}

function getArmyWaveCount(troopCount){
    const troops = Number(troopCount);
    if (!Number.isFinite(troops) || troops <= 0){
        return 0;
    }
    return Math.min(40, Math.max(1, Math.floor(troops)));
}

function getCityArmySceneLayer(){
    const grid = $('#cityDistrictGrid');
    if (!grid.length){
        return null;
    }
    let scene = grid.find('.city-army-scene').first();
    if (!scene.length){
        scene = $('<div class="city-army-scene" aria-hidden="true"><div class="army-unit-layer"></div></div>');
        grid.prepend(scene);
    }
    let layer = scene.find('.army-unit-layer').first();
    if (!layer.length){
        scene.append('<div class="army-unit-layer"></div>');
        layer = scene.find('.army-unit-layer').first();
    }
    return { scene, layer };
}

function getArmySceneData(host){
    const cityLayer = getCityArmySceneLayer();
    if (cityLayer){
        armyPanelState.runnerPos = null;
        armyPanelState.runnerPosLocked = false;
        const grid = $('#cityDistrictGrid');
        let tent = grid.find('.city-bg-prop-jun-ying').first();
        if (!tent.length){
            tent = $('<div class="city-bg-prop city-bg-prop-jun-ying" aria-hidden="true"></div>');
            grid.prepend(tent);
        }
        const sceneEl = cityLayer.scene[0];
        const layerEl = cityLayer.layer[0];
        const tentEl = tent[0];
        const sceneRect = sceneEl?.getBoundingClientRect?.();
        const tentRect = tentEl?.getBoundingClientRect?.();
        if (sceneRect?.width && sceneRect?.height && tentRect?.width && tentRect?.height && layerEl){
            const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
            const startX = tentRect.left - sceneRect.left + tentRect.width * 0.85;
            const startY = sceneRect.height * 0.9;
            const targetX = startX + Math.max(40, tentRect.width * 0.5);
            const targetY = startY;
            return {
                scene: sceneEl,
                layer: layerEl,
                start: {
                    x: clamp(startX, 0, sceneRect.width),
                    y: clamp(startY, 0, sceneRect.height)
                },
                target: {
                    x: clamp(targetX, 0, sceneRect.width),
                    y: clamp(targetY, 0, sceneRect.height)
                }
            };
        }
    }
    const scene = host.find('.army-scene').first()[0];
    const barracks = host.find('.army-barracks').first()[0];
    const gate = host.find('.army-gate').first()[0];
    const layer = host.find('.army-unit-layer').first()[0];
    if (!scene || !barracks || !gate || !layer){
        return null;
    }
    const sceneRect = scene.getBoundingClientRect();
    if (!sceneRect.width || !sceneRect.height){
        return null;
    }
    const barracksRect = barracks.getBoundingClientRect();
    const gateRect = gate.getBoundingClientRect();
    return {
        scene,
        layer,
        start: {
            x: barracksRect.left - sceneRect.left + barracksRect.width / 2,
            y: barracksRect.top - sceneRect.top + barracksRect.height / 2
        },
        target: {
            x: gateRect.left - sceneRect.left + gateRect.width / 2,
            y: gateRect.top - sceneRect.top + gateRect.height / 2
        }
    };
}

function launchArmyWave(host, troopCount){
    const maxUnits = 40;
    const available = maxUnits - armyPanelState.units.length;
    if (available <= 0){
        return;
    }
    const waveCount = Math.min(getArmyWaveCount(troopCount), available);
    if (waveCount <= 0){
        return;
    }
    const spacing = 120;
    for (let i = 0; i < waveCount; i++){
        setTimeout(() => {
            const sceneData = getArmySceneData(host);
            if (!sceneData){
                return;
            }
            spawnArmyUnit(sceneData);
        }, i * spacing);
    }
}

export function triggerGarrisonAttackAnimation(troopCount){
    if (typeof document === 'undefined'){
        return;
    }
    const host = $('#job-army');
    if (!host.length){
        return;
    }
    ensureArmyPanel();
    const sceneData = getArmySceneData(host);
    if (!sceneData){
        return;
    }
    armyPanelState.units.forEach((unit) => unit.el?.remove?.());
    armyPanelState.units = [];
    armyPanelState.rafId = null;
    ensureArmyRunner(sceneData);
}

function ensureArmyRunner(sceneData){
    const layer = sceneData?.layer || $('#job-army .army-unit-layer').first()[0];
    if (!layer){
        return;
    }
    if (!armyPanelState.runner || !layer.contains(armyPanelState.runner)){
        const el = document.createElement('div');
        el.className = 'army-unit army-unit-runner';
        for (let i = 1; i <= 15; i++){
            const frame = document.createElement('div');
            frame.className = `army-unit-frame frame-${String(i).padStart(2, '0')}`;
            el.appendChild(frame);
        }
        for (let i = 1; i <= 15; i++){
            const frame = document.createElement('div');
            frame.className = `army-unit-frame-rev rev-${String(i).padStart(2, '0')}`;
            el.appendChild(frame);
        }
        const idleIntroFrames = [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37];
        const idleLoopFrames = [37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26];
        idleIntroFrames.forEach((num, idx) => {
            const frame = document.createElement('div');
            frame.className = `army-unit-idle-frame intro-${String(idx + 1).padStart(2, '0')}`;
            el.appendChild(frame);
        });
        idleLoopFrames.forEach((num, idx) => {
            const frame = document.createElement('div');
            frame.className = `army-unit-idle-loop-frame loop-${String(idx + 1).padStart(2, '0')}`;
            el.appendChild(frame);
        });
        el.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (el.dataset.dragged === '1'){
                el.dataset.dragged = '0';
                return;
            }
            registerArmyIdleActivity();
            playArmyRunnerAnimation();
        });
        el.addEventListener('animationend', (event) => {
            if (event.animationName !== 'army-unit-frame'){
                return;
            }
            if (!event.target?.classList?.contains('rev-15')){
                return;
            }
            endArmyRunnerAnimation();
        });
        attachRunnerDrag(el);
        layer.appendChild(el);
        armyPanelState.runner = el;
        armyPanelState.idleIntroDone = false;
        armyPanelState.idleSeqEl = el;
        armyPanelState.idleSeqIndex = 0;
        armyPanelState.idleSeqPhase = 'intro';
    }
    const el = armyPanelState.runner;
    positionArmyRunner(el, sceneData, layer);
    ensureArmyIdleAlt(el);
    if (ARMY_IDLE_SEQUENCE_MODE){
        el.classList.remove('idle-intro', 'idle-loop-rev', 'is-idle-alt');
        armyPanelState.idleAltPlaying = false;
        startArmyIdleSequence(el);
    }
    else {
        if (!armyPanelState.idleAltPlaying && !el.classList.contains('idle-intro') && !el.classList.contains('idle-loop-rev')){
            startArmyIdleLoop();
        }
        if (!armyPanelState.idleTimer){
            resetArmyIdleTimer();
        }
    }
}

function ensureArmyIdleAlt(el){
    if (!el){
        return;
    }
    if (!armyPanelState.idleAltEl || !el.contains(armyPanelState.idleAltEl)){
        const alt = document.createElement('div');
        alt.className = 'army-unit-idle-alt';
        el.appendChild(alt);
        armyPanelState.idleAltEl = alt;
    }
}

function startArmyIdleSequence(el){
    if (!ARMY_IDLE_SEQUENCE_MODE || !el){
        return;
    }
    if (armyPanelState.idleSeqEl !== el){
        armyPanelState.idleSeqEl = el;
        armyPanelState.idleSeqIndex = 0;
        armyPanelState.idleSeqPhase = armyPanelState.idleIntroDone ? 'loop' : 'intro';
    }
    if (armyPanelState.idleSeqTimer){
        const target = armyPanelState.idleSeqEl;
        if (!target || !target.isConnected){
            clearTimeout(armyPanelState.idleSeqTimer);
            armyPanelState.idleSeqTimer = null;
        }
        else {
            return;
        }
    }
    const tick = () => {
        const target = armyPanelState.idleSeqEl;
        if (!target || !target.isConnected){
            armyPanelState.idleSeqTimer = null;
            return;
        }
        if (!ARMY_STATIC_MODE){
            const frames = armyPanelState.idleSeqPhase === 'intro'
                ? ARMY_IDLE_FRAMES_INTRO
                : ARMY_IDLE_FRAMES_LOOP;
            const frame = frames[armyPanelState.idleSeqIndex];
            if (frame){
                if (ARMY_IDLE_SPRITE_MODE){
                    renderArmySpriteFrame(target, ARMY_IDLE_SHEET, frame);
                }
                else if (target.tagName === 'IMG'){
                    target.src = `/photo/active-4/active-b/${frame}.webp`;
                }
                else {
                    target.style.backgroundImage = `url(/photo/active-4/active-b/${frame}.webp)`;
                }
            }
            armyPanelState.idleSeqIndex += 1;
            if (armyPanelState.idleSeqIndex >= frames.length){
                if (armyPanelState.idleSeqPhase === 'intro'){
                    armyPanelState.idleSeqPhase = 'loop';
                    armyPanelState.idleSeqIndex = 0;
                    armyPanelState.idleIntroDone = true;
                }
                else {
                    armyPanelState.idleSeqIndex = 0;
                }
            }
        }
        armyPanelState.idleSeqTimer = setTimeout(tick, ARMY_IDLE_FRAME_MS);
    };
    armyPanelState.idleSeqTimer = setTimeout(tick, 0);
    if (!armyPanelState.idleAltPlaying && !armyPanelState.idleTimer){
        resetArmyIdleTimer();
    }
}

function startArmyIdleLoop(){
    const el = armyPanelState.runner;
    if (!el){
        return;
    }
    if (ARMY_IDLE_SEQUENCE_MODE){
        el.classList.remove('is-idle-alt', 'idle-intro', 'idle-loop-rev');
        startArmyIdleSequence(el);
        return;
    }
    el.classList.remove('is-idle-alt', 'idle-intro', 'idle-loop-rev');
    void el.offsetWidth;
    if (armyPanelState.idleIntroDone){
        el.classList.add('idle-loop-rev');
        armyPanelState.idleLoopStart = performance.now();
        return;
    }
    el.classList.add('idle-intro');
    armyPanelState.idleLoopStart = performance.now();
    if (armyPanelState.idleIntroTimer){
        clearTimeout(armyPanelState.idleIntroTimer);
    }
    armyPanelState.idleIntroTimer = setTimeout(() => {
        if (!el.classList.contains('idle-intro')){
            return;
        }
        el.classList.remove('idle-intro');
        void el.offsetWidth;
        el.classList.add('idle-loop-rev');
        armyPanelState.idleLoopStart = performance.now();
        armyPanelState.idleIntroDone = true;
    }, ARMY_IDLE_INTRO_MS);
}

function stopArmyIdleLoop(){
    const el = armyPanelState.runner;
    if (!el){
        return;
    }
    if (ARMY_IDLE_SEQUENCE_MODE){
        return;
    }
    el.classList.remove('idle-intro', 'idle-loop-rev');
    if (armyPanelState.idleIntroTimer){
        clearTimeout(armyPanelState.idleIntroTimer);
        armyPanelState.idleIntroTimer = null;
    }
}

function resetArmyIdleTimer(){
    if (armyPanelState.idleTimer){
        clearTimeout(armyPanelState.idleTimer);
    }
    if (armyPanelState.idleAltTimer){
        clearTimeout(armyPanelState.idleAltTimer);
        armyPanelState.idleAltTimer = null;
    }
    if (ARMY_IDLE_SEQUENCE_MODE){
        armyPanelState.idleTimer = setTimeout(() => {
            startArmyIdleAlt();
        }, ARMY_IDLE_INACTIVITY_MS);
        return;
    }
    armyPanelState.idleTimer = setTimeout(() => {
        scheduleArmyIdleAlt();
    }, ARMY_IDLE_INACTIVITY_MS);
}

function registerArmyIdleActivity(){
    if (armyPanelState.idleAltPlaying){
        finishArmyIdleAlt();
    }
    resetArmyIdleTimer();
}

function scheduleArmyIdleAlt(){
    if (ARMY_IDLE_SEQUENCE_MODE){
        return;
    }
    if (armyPanelState.idleAltPlaying){
        return;
    }
    const loopStart = armyPanelState.idleLoopStart ?? performance.now();
    const now = performance.now();
    const elapsed = now - loopStart;
    const remainder = ARMY_IDLE_LOOP_MS - (elapsed % ARMY_IDLE_LOOP_MS);
    const delay = remainder === ARMY_IDLE_LOOP_MS ? 0 : remainder;
    if (armyPanelState.idleAltTimer){
        clearTimeout(armyPanelState.idleAltTimer);
    }
    armyPanelState.idleAltTimer = setTimeout(() => {
        startArmyIdleAlt();
    }, delay);
}

function startArmyIdleAlt(){
    const el = ARMY_IDLE_SPRITE_MODE ? armyPanelState.idleSeqEl : armyPanelState.runner;
    if (!el || armyPanelState.idleAltPlaying){
        return;
    }
    if (armyPanelState.idleTimer){
        clearTimeout(armyPanelState.idleTimer);
        armyPanelState.idleTimer = null;
    }
    if (armyPanelState.idleAltTimer){
        clearTimeout(armyPanelState.idleAltTimer);
        armyPanelState.idleAltTimer = null;
    }
    if (ARMY_IDLE_SEQUENCE_MODE && armyPanelState.idleSeqTimer){
        clearTimeout(armyPanelState.idleSeqTimer);
        armyPanelState.idleSeqTimer = null;
    }
    if (!ARMY_IDLE_SEQUENCE_MODE){
        stopArmyIdleLoop();
        ensureArmyIdleAlt(el);
    }
    armyPanelState.idleAltPlaying = true;
    if (!ARMY_IDLE_SPRITE_MODE){
        el.classList.add('is-idle-alt');
    }
    playArmyIdleAltSequence();
}

function playArmyIdleAltSequence(){
    const target = ARMY_IDLE_SPRITE_MODE ? armyPanelState.idleSeqEl : armyPanelState.idleAltEl;
    if (!target){
        finishArmyIdleAlt();
        return;
    }
    const frames = [];
    for (let i = 25; i >= 1; i--){
        frames.push(i);
    }
    for (let i = 1; i <= 25; i++){
        frames.push(i);
    }
    let idx = 0;
    const step = () => {
        if (!armyPanelState.idleAltPlaying){
            return;
        }
        const frameValue = frames[idx];
        if (frameValue === 22){
            playArmyIdleAltSfx();
        }
        if (ARMY_IDLE_SPRITE_MODE){
            if (!target.isConnected){
                finishArmyIdleAlt();
                return;
            }
            renderArmySpriteFrame(target, ARMY_IDLE_ALT_SHEET, frameValue);
        }
        else {
            target.style.backgroundImage = `url(/photo/active-4/active-a/${frameValue}.webp)`;
        }
        idx += 1;
        if (idx >= frames.length){
            finishArmyIdleAlt();
            return;
        }
        armyPanelState.idleAltFrameTimer = setTimeout(step, ARMY_IDLE_ALT_FRAME_MS);
    };
    step();
}

function finishArmyIdleAlt(){
    if (!armyPanelState.idleAltPlaying){
        return;
    }
    armyPanelState.idleAltPlaying = false;
    if (armyPanelState.idleAltFrameTimer){
        clearTimeout(armyPanelState.idleAltFrameTimer);
        armyPanelState.idleAltFrameTimer = null;
    }
    const el = ARMY_IDLE_SPRITE_MODE ? armyPanelState.idleSeqEl : armyPanelState.runner;
    if (!ARMY_IDLE_SPRITE_MODE && el){
        el.classList.remove('is-idle-alt');
    }
    if (armyPanelState.idleAltEl){
        armyPanelState.idleAltEl.style.backgroundImage = '';
    }
    if (ARMY_IDLE_SEQUENCE_MODE){
        startArmyIdleSequence(el);
        resetArmyIdleTimer();
        return;
    }
    startArmyIdleLoop();
    resetArmyIdleTimer();
}

function playArmyRunnerAnimation(){
    const el = armyPanelState.runner;
    if (!el){
        return;
    }
    if (armyPanelState.runnerAnimTimer){
        clearTimeout(armyPanelState.runnerAnimTimer);
        armyPanelState.runnerAnimTimer = null;
    }
    if (el.classList.contains('is-animating')){
        el.classList.remove('is-animating');
        void el.offsetWidth;
    }
    el.classList.add('is-animating');
    armyPanelState.runnerAnimTimer = setTimeout(() => {
        endArmyRunnerAnimation();
    }, 1700);
}

function endArmyRunnerAnimation(){
    const el = armyPanelState.runner;
    if (!el || !el.classList.contains('is-animating')){
        return;
    }
    el.classList.remove('is-animating');
    if (armyPanelState.runnerAnimTimer){
        clearTimeout(armyPanelState.runnerAnimTimer);
        armyPanelState.runnerAnimTimer = null;
    }
    if (ARMY_IDLE_SEQUENCE_MODE){
        startArmyIdleSequence(el);
        return;
    }
    if (!armyPanelState.idleAltPlaying){
        startArmyIdleLoop();
        resetArmyIdleTimer();
    }
}

function positionArmyRunner(el, sceneData, layer){
    const scene = sceneData?.scene || layer?.parentElement;
    if (!scene){
        if (!el.style.left){
            el.style.left = '50%';
            el.style.top = '60%';
        }
        return;
    }
    const rect = scene.getBoundingClientRect();
    if (!rect.width || !rect.height){
        return;
    }
    let x;
    let y;
    if (armyPanelState.runnerPos && armyPanelState.runnerPosLocked){
        x = rect.width * armyPanelState.runnerPos.x;
        y = rect.height * armyPanelState.runnerPos.y;
    }
    else if (sceneData?.start && sceneData?.target){
        x = sceneData.start.x + (sceneData.target.x - sceneData.start.x) * 0.45;
        y = sceneData.start.y + (sceneData.target.y - sceneData.start.y) * 0.15;
    }
    else {
        x = rect.width * 0.5;
        y = rect.height * 0.6;
    }
    const elRect = el.getBoundingClientRect();
    const halfW = elRect.width ? elRect.width / 2 : 0;
    const halfH = elRect.height ? elRect.height / 2 : 0;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const clampedX = clamp(x, halfW, rect.width - halfW);
    const clampedY = clamp(y, halfH, rect.height - halfH);
    el.style.left = `${clampedX}px`;
    el.style.top = `${clampedY}px`;
}

function attachRunnerDrag(el){
    if (el.dataset.dragInit === '1'){
        return;
    }
    el.dataset.dragInit = '1';
    el.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        registerArmyIdleActivity();
        const scene = el.closest('.army-scene');
        if (!scene){
            return;
        }
        const rect = scene.getBoundingClientRect();
        if (!rect.width || !rect.height){
            return;
        }
        el.dataset.dragged = '0';
        el.classList.add('is-dragging');
        if (el.setPointerCapture){
            el.setPointerCapture(event.pointerId);
        }
        const elRect = el.getBoundingClientRect();
        const offsetX = event.clientX - (elRect.left + elRect.width / 2);
        const offsetY = event.clientY - (elRect.top + elRect.height / 2);
        const halfW = elRect.width / 2;
        const halfH = elRect.height / 2;
        let moved = false;
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const onMove = (moveEvent) => {
            const dx = moveEvent.clientX - event.clientX;
            const dy = moveEvent.clientY - event.clientY;
            if (!moved && Math.hypot(dx, dy) > 3){
                moved = true;
                el.dataset.dragged = '1';
            }
            let x = moveEvent.clientX - rect.left - offsetX;
            let y = moveEvent.clientY - rect.top - offsetY;
            x = clamp(x, halfW, rect.width - halfW);
            y = clamp(y, halfH, rect.height - halfH);
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            armyPanelState.runnerPos = {
                x: rect.width ? x / rect.width : 0.5,
                y: rect.height ? y / rect.height : 0.6
            };
            armyPanelState.runnerPosLocked = true;
        };
        const stop = () => {
            el.classList.remove('is-dragging');
            if (el.releasePointerCapture && event.pointerId !== undefined){
                el.releasePointerCapture(event.pointerId);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
    });
}

function spawnArmyUnit(sceneData){
    const jitter = () => (Math.random() - 0.5) * 10;
    const startX = sceneData.start.x + jitter();
    const startY = sceneData.start.y + jitter();
    const targetX = sceneData.target.x + jitter();
    const targetY = sceneData.target.y + jitter();
    const el = document.createElement('div');
    el.className = 'army-unit';
    sceneData.layer.appendChild(el);
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    armyPanelState.units.push({
        el,
        x: startX,
        y: startY,
        tx: targetX,
        ty: targetY,
        speed: 70 + Math.random() * 40
    });
    startArmyAnimation();
}

function startArmyAnimation(){
    if (armyPanelState.rafId !== null){
        return;
    }
    armyPanelState.lastTs = performance.now();
    armyPanelState.rafId = requestAnimationFrame(tickArmyAnimation);
}

function tickArmyAnimation(now){
    if (typeof document === 'undefined' || !document.getElementById('job-army')){
        armyPanelState.units.forEach((unit) => unit.el?.remove?.());
        armyPanelState.units = [];
        armyPanelState.rafId = null;
        return;
    }
    const dt = Math.min((now - armyPanelState.lastTs) / 1000, 0.05);
    armyPanelState.lastTs = now;
    const nextUnits = [];
    armyPanelState.units.forEach((unit) => {
        const dx = unit.tx - unit.x;
        const dy = unit.ty - unit.y;
        const dist = Math.hypot(dx, dy);
        if (!Number.isFinite(dist)){
            return;
        }
        const step = unit.speed * dt;
        if (dist <= step || dist === 0){
            unit.x = unit.tx;
            unit.y = unit.ty;
            unit.el.style.left = `${unit.x}px`;
            unit.el.style.top = `${unit.y}px`;
            unit.el.classList.add('army-unit-exit');
            setTimeout(() => unit.el?.remove?.(), 200);
            return;
        }
        unit.x += (dx / dist) * step;
        unit.y += (dy / dist) * step;
        unit.el.style.left = `${unit.x}px`;
        unit.el.style.top = `${unit.y}px`;
        nextUnits.push(unit);
    });
    armyPanelState.units = nextUnits;
    if (armyPanelState.units.length){
        armyPanelState.rafId = requestAnimationFrame(tickArmyAnimation);
    }
    else {
        armyPanelState.rafId = null;
    }
}
