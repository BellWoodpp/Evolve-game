import { global, tmp_vars, keyMultiplier, breakdown, sizeApproximation, p_on, support_on, active_rituals, save, isMainTabActive } from './vars.js';
import { vBind, clearElement, modRes, flib, calc_mastery, calcPillar, eventActive, easterEgg, trickOrTreat, popover, harmonyEffect, darkEffect, hoovedRename, messageQueue } from './functions.js';
import { traits, fathomCheck } from './races.js';
import { templeCount, actions } from './actions.js';
import { workerScale, craftsmanCap } from './jobs.js';
import { hellSupression } from './portal.js';
import { syndicate } from './truepath.js';
import { govActive, defineGovernor } from './governor.js';
import { govEffect } from './civics.js';
import { highPopAdjust, production, teamster } from './prod.js';
import { loc } from './locale.js';

function shouldRenderResourceTab(tabIndex){
    if (global.settings.tabLoad || global.settings?.resourcePanelFloating || global.settings?.marketEmbedded){
        return true;
    }
    return isMainTabActive('resources') && global.settings.marketTabs === tabIndex;
}

const resourceJobMap = {
    Food: ['unemployed','farmer'],
    Lumber: ['lumberjack'],
    Copper: ['miner'],
    Cement: ['cement_worker'],
    Knowledge: ['professor','scientist'],
    Money: ['banker'],
    Coal: ['coal_miner']
};

const craftsmanResourceList = [
    'Plywood','Brick','Wrought_Iron','Sheet_Metal','Mythril','Aerogel','Nanoweave','Scarletite','Quantium','Thermite'
];

const resourceJobTopTargets = new Set([
    'Food','Knowledge','Money',
    'Lumber','Copper','Cement','Coal',
    ...craftsmanResourceList
]);

const resourceAvatarJobs = new Set([
    'unemployed','farmer','lumberjack','miner','professor','cement_worker','entertainer','banker'
]);

const INLINE_JOB_FLASH_DURATION = 520;

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

export const resource_values = {
    Food: 5,
    Lumber: 5,
    Chrysotile: 5,
    Stone: 5,
    Crystal: 6,
    Furs: 8,
    Copper: 25,
    Iron: 40,
    Aluminium: 50,
    Cement: 15,
    Coal: 20,
    Oil: 75,
    Uranium: 550,
    Steel: 100,
    Titanium: 150,
    Alloy: 350,
    Polymer: 250,
    Iridium: 420,
    Helium_3: 620,
    Deuterium: 950,
    Elerium: 2000,
    Water: 2,
    Neutronium: 1500,
    Adamantite: 2250,
    Infernite: 2750,
    Nano_Tube: 750,
    Graphene: 3000,
    Stanene: 3600,
    Bolognium: 9000,
    Vitreloy: 10200,
    Orichalcum: 99000,
    Asphodel_Powder: 249000,
    Horseshoe: 0,
    Nanite: 0,
    Genes: 0,
    Soul_Gem: 0,
    Corrupt_Gem: 0,
    Codex: 0,
    Cipher: 0,
    Demonic_Essence: 0,
    Blessed_Essence: 0
};

export const tradeRatio = {
    Food: 2,
    Lumber: 2,
    Chrysotile: 1,
    Stone: 2,
    Crystal: 0.4,
    Furs: 1,
    Copper: 1,
    Iron: 1,
    Aluminium: 1,
    Cement: 1,
    Coal: 1,
    Oil: 0.5,
    Uranium: 0.12,
    Steel: 0.5,
    Titanium: 0.25,
    Alloy: 0.2,
    Polymer: 0.2,
    Iridium: 0.1,
    Helium_3: 0.1,
    Deuterium: 0.1,
    Elerium: 0.02,
    Water: 2,
    Neutronium: 0.05,
    Adamantite: 0.05,
    Infernite: 0.01,
    Nano_Tube: 0.1,
    Graphene: 0.1,
    Stanene: 0.1,
    Bolognium: 0.12,
    Vitreloy: 0.12,
    Orichalcum: 0.05
}

export const atomic_mass = {
    Food: 4.355,
    Lumber: 7.668,
    Chrysotile: 15.395,
    Stone: 20.017,
    Crystal: 5.062,
    Furs: 13.009,
    Copper: 63.546,
    Iron: 55.845,
    Aluminium: 26.9815,
    Cement: 20.009,
    Coal: 12.0107,
    Oil: 5.342,
    Uranium: 238.0289,
    Steel: 55.9,
    Titanium: 47.867,
    Alloy: 45.264,
    Polymer: 120.054,
    Iridium: 192.217,
    Helium_3: 3.0026,
    Deuterium: 2.014,
    Neutronium: 248.74,
    Adamantite: 178.803,
    Infernite: 222.666,
    Elerium: 297.115,
    Nano_Tube: 15.083,
    Graphene: 26.9615,
    Stanene: 33.9615,
    Bolognium: 75.898,
    Unobtainium: 168.59,
    Vitreloy: 41.08,
    Orichalcum: 237.8,
    Asphodel_Powder: 0.01,
    Elysanite: 13.666,
    Water: 18.01,
    Plywood: 7.666,
    Brick: 20.009,
    Wrought_Iron: 55.845,
    Sheet_Metal: 26.9815,
    Mythril: 94.239,
    Aerogel: 7.84,
    Nanoweave: 23.71,
    Scarletite: 188.6,
    Quantium: 241.35
};

export const supplyValue = {
    Lumber: { in: 0.5, out: 25000 },
    Chrysotile: { in: 0.5, out: 25000 },
    Stone: { in: 0.5, out: 25000 },
    Crystal: { in: 3, out: 25000 },
    Furs: { in: 3, out: 25000 },
    Copper: { in: 1.5, out: 25000 },
    Iron: { in: 1.5, out: 25000 },
    Aluminium: { in: 2.5, out: 25000 },
    Cement: { in: 3, out: 25000 },
    Coal: { in: 1.5, out: 25000 },
    Oil: { in: 2.5, out: 12000 },
    Uranium: { in: 5, out: 300 },
    Steel: { in: 3, out: 25000 },
    Titanium: { in: 3, out: 25000 },
    Alloy: { in: 6, out: 25000 },
    Polymer: { in: 6, out: 25000 },
    Iridium: { in: 8, out: 25000 },
    Helium_3: { in: 4.5, out: 12000 },
    Deuterium: { in: 4, out: 1000 },
    Neutronium: { in: 15, out: 1000 },
    Adamantite: { in: 12.5, out: 1000 },
    Infernite: { in: 25, out: 250 },
    Elerium: { in: 30, out: 250 },
    Nano_Tube: { in: 6.5, out: 1000 },
    Graphene: { in: 5, out: 1000 },
    Stanene: { in: 4.5, out: 1000 },
    Bolognium: { in: 18, out: 1000 },
    Vitreloy: { in: 14, out: 1000 },
    Orichalcum: { in: 10, out: 1000 },
    Plywood: { in: 10, out: 250 },
    Brick: { in: 10, out: 250 },
    Wrought_Iron: { in: 10, out: 250 },
    Sheet_Metal: { in: 10, out: 250 },
    Mythril: { in: 12.5, out: 250 },
    Aerogel: { in: 16.5, out: 250 },
    Nanoweave: { in: 18, out: 250 },
    Scarletite: { in: 35, out: 250 }
};

export function craftCost(manual=false){
    let costs = {
        Plywood: [{ r: 'Lumber', a: 100 }],
        Brick: global.race['flier'] ? [{ r: 'Stone', a: 60 }] : [{ r: 'Cement', a: 40 }],
        Wrought_Iron: [{ r: 'Iron', a: 80 }],
        Sheet_Metal: [{ r: 'Aluminium', a: 120 }],
        Mythril: [{ r: 'Iridium', a: 100 },{ r: 'Alloy', a: 250 }],
        Aerogel: [{ r: 'Graphene', a: 2500 },{ r: 'Infernite', a: 50 }],
        Nanoweave: [{ r: 'Nano_Tube', a: 1000 },{ r: 'Vitreloy', a: 40 }],
        Scarletite: [{ r: 'Iron', a: 250000 },{ r: 'Adamantite', a: 7500 },{ r: 'Orichalcum', a: 500 }],
        Quantium: [{ r: 'Nano_Tube', a: 1000 },{ r: 'Graphene', a: 1000 },{ r: 'Elerium', a: 25 }],
        Thermite: [{ r: 'Iron', a: 180 },{ r: 'Aluminium', a: 60 }],
    };
    if (global.race['wasteful']){
        let rate = 1 + traits.wasteful.vars()[0] / 100;
        Object.keys(costs).forEach(function(res){
            for (let i=0; i<costs[res].length; i++){
                costs[res][i].a = Math.round(costs[res][i].a * rate);
            }
        });
    }
    if (global.race['high_pop'] && !manual){
        let rate = 1 / traits.high_pop.vars()[0];
        Object.keys(costs).forEach(function(res){
            for (let i=0; i<costs[res].length; i++){
                costs[res][i].a = Math.round(costs[res][i].a * rate);
            }
        });
    }
    return costs;
}

export const craftingRatio = (function(){
    var crafting = {};
    
    return function (res,type,recalc){
        if (recalc){
            let noEarth = global.race['cataclysm'] || global.race['orbit_decayed'] ? true : false;
            crafting = {
                general: {
                    add: [],
                    multi: []
                },
                Plywood: {
                    add: [],
                    multi: []
                },
                Brick: {
                    add: [],
                    multi: []
                },
                Wrought_Iron: {
                    add: [],
                    multi: []
                },
                Sheet_Metal: {
                    add: [],
                    multi: []
                },
                Mythril: {
                    add: [],
                    multi: []
                },
                Aerogel: {
                    add: [],
                    multi: []
                },
                Nanoweave: {
                    add: [],
                    multi: []
                },
                Scarletite: {
                    add: [],
                    multi: []
                },
                Quantium: {
                    add: [],
                    multi: []
                },
                Thermite: {
                    add: [],
                    multi: []
                }
            };
            if (global.tech['foundry'] >= 2){
                let skill = global.tech['foundry'] >= 5 ? (global.tech['foundry'] >= 8 ? 0.08 : 0.05) : 0.03;
                crafting.general.add.push({
                    name: loc(`city_foundry`),
                    manual: global.city.foundry.count * skill,
                    auto: global.city.foundry.count * skill
                });
            }
            if (global.tech['foundry'] >= 3){
                Object.keys(crafting).forEach(function(resource){
                    if (global.city.foundry[resource] && global.city.foundry[resource] > 1){
                        crafting[resource].add.push({
                            name: loc(`tech_apprentices`),
                            manual: (global.city.foundry[resource] - 1) * highPopAdjust(0.03),
                            auto: (global.city.foundry[resource] - 1) * highPopAdjust(0.03)
                        });
                    }
                });
            }
            if (global.tech['foundry'] >= 4 && global.city['sawmill']){
                crafting.Plywood.add.push({
                    name: loc(`city_sawmill`),
                    manual: global.city['sawmill'].count * 0.02,
                    auto: global.city['sawmill'].count * 0.02
                });
            }
            if (global.tech['foundry'] >= 6){
                crafting.Brick.add.push({
                    name: loc(`city_foundry`),
                    manual: global.city['foundry'].count * 0.02,
                    auto: global.city['foundry'].count * 0.02
                });
            }
            if (global.tech['foundry'] >= 7){
                crafting.general.add.push({
                    name: loc(`city_factory`) + ` (${loc(`tab_city5`)})`,
                    manual: p_on['factory'] * 0.05,
                    auto: p_on['factory'] * 0.05
                });
                if (global.tech['mars'] >= 4){
                    crafting.general.add.push({
                        name: loc(`city_factory`) + ` (${loc(`tab_space`)})`,
                        manual: p_on['red_factory'] * 0.05,
                        auto: p_on['red_factory'] * 0.05
                    });
                }
                if (global.interstellar['int_factory'] && p_on['int_factory']){
                    crafting.general.add.push({
                        name: loc(`interstellar_int_factory_title`),
                        manual: p_on['int_factory'] * 0.1,
                        auto: p_on['int_factory'] * 0.1
                    });
                }
            }
            if (global.portal['demon_forge'] && p_on['demon_forge']){
                crafting.general.add.push({
                    name: loc(`portal_demon_forge_title`),
                    manual: 0,
                    auto: p_on['demon_forge'] * actions.portal.prtl_wasteland.demon_forge.crafting() / 100
                });
            }
            if (global.portal['hell_factory'] && p_on['hell_factory']){
                crafting.general.add.push({
                    name: loc(`portal_factory_title`),
                    manual: p_on['hell_factory'] * 0.25,
                    auto: p_on['hell_factory'] * 0.25
                });
            }
            if (global.space['fabrication'] && support_on['fabrication']){
                crafting.general.add.push({
                    name: loc(`space_red_fabrication_title`),
                    manual: support_on['fabrication'] * global.civic.colonist.workers * (noEarth ? highPopAdjust(0.05) : highPopAdjust(0.02)),
                    auto: support_on['fabrication'] * global.civic.colonist.workers * (noEarth ? highPopAdjust(0.05) : highPopAdjust(0.02))
                });
            }
            if (global.race['artisan']){
                crafting.general.multi.push({
                    name: loc(`trait_artisan_name`),
                    manual: 1,
                    auto: 1 + (traits.artisan.vars()[0] / 100)
                });
            }
            if (p_on['stellar_forge']){
                crafting.Mythril.add.push({
                    name: loc(`interstellar_stellar_forge_title`),
                    manual: p_on['stellar_forge'] * 0.05,
                    auto: p_on['stellar_forge'] * 0.05
                });
                crafting.general.add.push({
                    name: loc(`interstellar_stellar_forge_title`),
                    manual: 0,
                    auto: p_on['stellar_forge'] * 0.1
                });
            }
            if (p_on['hell_forge']){
                let sup = hellSupression('ruins');
                crafting.general.add.push({
                    name: loc(`portal_hell_forge_title`),
                    manual: 0,
                    auto: p_on['hell_forge'] * 0.75 * sup.supress
                });
                crafting.Scarletite.multi.push({
                    name: loc(`portal_ruins_supressed`),
                    manual: 1,
                    auto: sup.supress
                });
            }
            if (global.tauceti['tau_factory'] && support_on['tau_factory']){
                crafting.general.add.push({
                    name: loc(`tau_home_tau_factory`),
                    manual: 0,
                    auto: (support_on['tau_factory'] * (global.tech['isolation'] ? 2.75 : 0.9))
                });
            }
            if (global.tech['isolation'] && global.tauceti['colony'] && support_on['colony']){
                crafting.general.add.push({
                    name: loc(`tau_home_colony`),
                    manual: support_on['colony'] * 0.5,
                    auto: support_on['colony'] * 0.5
                });
            }
            if ((support_on['zero_g_lab'] && p_on['zero_g_lab']) || (support_on['infectious_disease_lab'] && p_on['infectious_disease_lab'])){
                let synd = syndicate('spc_enceladus');
                crafting.Quantium.multi.push({
                    name: loc(`space_syndicate`),
                    manual: 1,
                    auto: synd
                });
            }
            if (global.tech['alien_crafting'] && support_on['infectious_disease_lab'] && p_on['infectious_disease_lab']){
                let qCraft = 1 + (0.65 * Math.min(support_on['infectious_disease_lab'],p_on['infectious_disease_lab']));
                crafting.Quantium.multi.push({
                    name: loc(`tech_infectious_disease_lab_alt`),
                    manual: 1,
                    auto: qCraft
                });
            }
            if (global.race['crafty']){
                crafting.general.add.push({
                    name: loc(`wiki_arpa_crispr_crafty`),
                    manual: 0.03,
                    auto: 0.03
                });
            }
            if (global.race['ambidextrous']){
                crafting.general.add.push({
                    name: loc(`trait_ambidextrous_name`),
                    manual: traits.ambidextrous.vars()[0] * global.race['ambidextrous'] / 100,
                    auto: traits.ambidextrous.vars()[0] * global.race['ambidextrous'] / 100
                });
            }
            if (global.race['rigid']){
                crafting.general.add.push({
                    name: loc(`trait_rigid_name`),
                    manual: -(traits.rigid.vars()[0] / 100),
                    auto: -(traits.rigid.vars()[0] / 100)
                });
            }
            if (global.civic.govern.type === 'socialist'){
                crafting.general.multi.push({
                    name: loc(`govern_socialist`),
                    manual: 1 + (govEffect.socialist()[0] / 100),
                    auto: 1 + (govEffect.socialist()[0] / 100)
                });
            }
            if (global.race['casting'] && active_rituals['crafting']){
                let num_rituals = active_rituals['crafting'];
                let boost_m = 1 + (num_rituals / (num_rituals + 75));
                let boost_a = 1 + (2 * num_rituals / (2 * num_rituals + 75));
                crafting.general.multi.push({
                    name: loc(`modal_pylon_casting`),
                    manual: boost_m,
                    auto: boost_a
                });
            }
            if (global.race['universe'] === 'magic'){
                crafting.general.multi.push({
                    name: loc(`universe_magic`),
                    manual: 0.8,
                    auto: 0.8
                });
            }
            if (global.tech['v_train']){
                crafting.general.multi.push({
                    name: loc(`tech_vocational_training`),
                    manual: 1,
                    auto: 2
                });
            }
            if (global.genes['crafty']){
                crafting.general.multi.push({
                    name: loc(`tab_arpa_crispr`) + ' ' + loc(`wiki_arpa_crispr_crafty`),
                    manual: 1,
                    auto: 1 + ((global.genes.crafty - 1) * 0.5)
                });
            }
            if (global.race['living_tool']){
                crafting.general.multi.push({
                    name: loc(`trait_living_tool_name`),
                    manual: 1,
                    auto: 1 + (traits.living_tool.vars()[1] / 100)
                });
            }
            if (global.stats.achieve['lamentis'] && global.stats.achieve.lamentis.l >= 1){
                crafting.general.multi.push({
                    name: loc(`evo_challenge_orbit_decay`),
                    manual: 1,
                    auto: 1.1
                });
            }
            if (global.race['ambidextrous']){
                crafting.general.multi.push({
                    name: loc(`trait_ambidextrous_name`),
                    manual: 1,
                    auto: 1 + (traits.ambidextrous.vars()[1] * global.race['ambidextrous'] / 100)
                });
            }
            if (global.blood['artisan']){
                crafting.general.multi.push({
                    name: loc(`tab_arpa_blood`) + ' ' + loc(`arpa_blood_artisan_title`),
                    manual: 1,
                    auto: 1 + (global.blood.artisan / 100)
                });
            }
            let faith = faithBonus();
            if (faith > 0){
                crafting.general.multi.push({
                    name: loc(`faith`),
                    manual: 1,
                    auto: 1 + (faith / (global.race.universe === 'antimatter' ? 1.5 : 3))
                });
            }
            if (global.prestige.Plasmid.count > 0){
                crafting.general.multi.push({
                    name: loc(`resource_Plasmid_plural_name`),
                    manual: plasmidBonus() / 8 + 1,
                    auto: plasmidBonus() / 8 + 1
                });
            }
            if (global.genes['challenge'] && global.genes['challenge'] >= 2){
                crafting.general.multi.push({
                    name: loc(`mastery`),
                    manual: 1 + (calc_mastery() / (global.race['weak_mastery'] ? 50 : 100)),
                    auto: 1 + (calc_mastery() / (global.race['weak_mastery'] ? 50 : 100))
                });
            }
            if (global.race['gravity_well']){
                crafting.general.multi.push({
                    name: loc(`evo_challenge_gravity_well`),
                    manual: teamster(1),
                    auto: teamster(1)
                });
            }
        }
        else {
            let multiplier = 1;
            let add_bd = {};
            let multi_bd = {};
            if (crafting['general']){
                for (let i=0; i<crafting.general.add.length; i++){
                    let curr = crafting.general.add[i];
                    add_bd[curr.name] = curr[type];
                    multiplier += curr[type];
                }
                for (let i=0; i<crafting[res].add.length; i++){
                    let curr = crafting[res].add[i];
                    add_bd[curr.name] = curr[type] + (add_bd[curr.name] ? add_bd[curr.name] : 0);
                    multiplier += curr[type];
                }
                multi_bd[loc(`craft_tools`)] = multiplier - 1;
                for (let i=0; i<crafting.general.multi.length; i++){
                    let curr = crafting.general.multi[i];
                    multi_bd[curr.name] = +(curr[type]) - 1;
                    multiplier *= curr[type];
                }
                for (let i=0; i<crafting[res].multi.length; i++){
                    let curr = crafting[res].multi[i];
                    multi_bd[curr.name] = (curr[type] * (1 + (multi_bd[curr.name] ? +(multi_bd[curr.name]) : 0))) - 1;
                    multiplier *= curr[type];
                }
            }

            Object.keys(add_bd).forEach(function(add){
                add_bd[add] = (+(add_bd[add]) * 100).toFixed(2) + '%';
            });
            Object.keys(multi_bd).forEach(function(multi){
                multi_bd[multi] = (+(multi_bd[multi]) * 100).toFixed(2) + '%';
            });

            let craft_total = {
                multiplier: multiplier,
                add_bd: add_bd,
                multi_bd: multi_bd
                
            }
            return craft_total;
        }
    }
})();

export function initResourceTabs(tab){
    if (tab){
        switch (tab){
            case 'market':
                initMarket();
                break;
            case 'storage':
                initStorage();
                break;
            case 'ejector':
                initEjector();
                break;
            case 'supply':
                initSupply();
                break;
            case 'alchemy':
                initAlchemy();
                break;
        }
    }
    else {
        initMarket();
        initStorage();
        initEjector();
        initSupply();
        initAlchemy();
    }
}

export function drawResourceTab(tab){
    if (tab === 'market'){
        if (!shouldRenderResourceTab(0)){
            return;
        }
        initResourceTabs('market');
        if (tmp_vars.hasOwnProperty('resource')){
            Object.keys(tmp_vars.resource).forEach(function(name){
                let color = tmp_vars.resource[name].color;
                let tradable = tmp_vars.resource[name].tradable;
                if (tradable){
                    var market_item = $(`<div id="market-${name}" class="market-item" v-show="r.display"></div>`);
                    $('#market').append(market_item);
                    marketItem(`#market-${name}`,market_item,name,color,true);
                }
            });
        }
        tradeSummery();
    }
    else if (tab === 'storage'){
        if (!shouldRenderResourceTab(1)){
            return;
        }
        initResourceTabs('storage');
        if (tmp_vars.hasOwnProperty('resource')){
            Object.keys(tmp_vars.resource).forEach(function(name){
                let color = tmp_vars.resource[name].color;
                let stackable = tmp_vars.resource[name].stackable;
                if (stackable){
                    var market_item = $(`<div id="stack-${name}" class="market-item" v-show="display"></div>`);
                    $('#resStorage').append(market_item);
                    containerItem(`#stack-${name}`,market_item,name,color,true);
                }
            });
        }
        tradeSummery();
    }
    else if (tab === 'ejector'){
        if (!shouldRenderResourceTab(2)){
            return;
        }
        initResourceTabs('ejector');
        if (tmp_vars.hasOwnProperty('resource')){
            Object.keys(tmp_vars.resource).forEach(function(name){
                let color = tmp_vars.resource[name].color;
                if (atomic_mass[name]){
                    loadEjector(name,color);
                }
            });
        }
    }
    else if (tab === 'supply'){
        if (!shouldRenderResourceTab(3)){
            return;
        }
        initResourceTabs('supply');
        if (tmp_vars.hasOwnProperty('resource')){
            Object.keys(tmp_vars.resource).forEach(function(name){
                let color = tmp_vars.resource[name].color;
                if (supplyValue[name]){
                    loadSupply(name,color);
                }
            });
        }
    }
    else if (tab === 'alchemy'){
        if (!shouldRenderResourceTab(4)){
            return;
        }
        initResourceTabs('alchemy');
        if (tmp_vars.hasOwnProperty('resource')){
            Object.keys(tmp_vars.resource).forEach(function(name){
                let color = tmp_vars.resource[name].color;
                let tradable = tmp_vars.resource[name].tradable;
                if (tradeRatio[name] && global.race.universe === 'magic'){
                    global['resource'][name]['basic'] = tradable;
                    loadAlchemy(name,color,tradable);
                }
            });
        }
    }
}

// Sets up resource definitions
export function defineResources(wiki){
    if (!wiki){
        ensureResourcesHeader();
        $('#moneyFloating, #knowledgeFloating').remove();
    }
    if (global.race.species === 'protoplasm'){
        let base = 100;
        if (global.stats.achieve['mass_extinction'] && global.stats.achieve['mass_extinction'].l > 1){
            base += 50 * (global.stats.achieve['mass_extinction'].l - 1);
        }
        loadResource('RNA',wiki,base,1,false);
        loadResource('DNA',wiki,base,1,false);
    }
    
    loadResource('Money',wiki,1000,1,false,false,'success');
    loadResource(global.race.species,wiki,0,0,false,false,'warning');
    loadResource('Slave',wiki,0,0,false,false,'warning');
    loadResource('Authority',wiki,0,0,false,false,'warning');
    loadResource('Mana',wiki,0,1,false,false,'warning');
    loadResource('Energy',wiki,0,0,false,false,'warning');
    loadResource('Sus',wiki,0,0,false,false,'warning');
    loadResource('Knowledge',wiki,100,1,false,false,'warning');
    loadResource('Omniscience',wiki,100,1,false,false,'warning');
    loadResource('Zen',wiki,0,0,false,false,'warning');
    loadResource('Crates',wiki,0,0,false,false,'warning');
    loadResource('Containers',wiki,0,0,false,false,'warning');
    if (!wiki){
        const ensureStorageTab = () => {
            if (!global.settings.showResources) {
                global.settings.marketTabs = 1;
            }
            global.settings.showResources = true;
            global.settings.showStorage = true;
        };
        if (global.tech?.container >= 1 && !global.resource.Crates.display){
            global.resource.Crates.display = true;
            ensureStorageTab();
        }
        if (global.tech?.steel_container >= 1 && !global.resource.Containers.display){
            global.resource.Containers.display = true;
            ensureStorageTab();
        }
    }
    loadResource('Food',wiki,250,1,true,true);
    loadResource('Lumber',wiki,200,1,true,true);
    loadResource('Chrysotile',wiki,200,1,true,true);
    loadResource('Stone',wiki,200,1,true,true);
    loadResource('Crystal',wiki,200,1,true,true);
    loadResource('Useless',wiki,-2,0,false,false);
    loadResource('Furs',wiki,100,1,true,true);
    loadResource('Copper',wiki,100,1,true,true);
    loadResource('Iron',wiki,100,1,true,true);
    loadResource('Aluminium',wiki,50,1,true,true);
    loadResource('Cement',wiki,100,1,true,true);
    loadResource('Coal',wiki,50,1,true,true);
    loadResource('Oil',wiki,0,1,true,false);
    loadResource('Uranium',wiki,10,1,true,false);
    loadResource('Steel',wiki,50,1,true,true);
    loadResource('Titanium',wiki,50,1,true,true);
    loadResource('Alloy',wiki,50,1,true,true);
    loadResource('Polymer',wiki,50,1,true,true);
    loadResource('Iridium',wiki,0,1,true,true);
    loadResource('Helium_3',wiki,0,1,true,false);
    loadResource('Water',wiki,0,1,false,false,'advanced');
    loadResource('Deuterium',wiki,0,1,false,false,'advanced');
    loadResource('Neutronium',wiki,0,1,false,false,'advanced');
    loadResource('Adamantite',wiki,0,1,false,true,'advanced');
    loadResource('Infernite',wiki,0,1,false,false,'advanced');
    loadResource('Elerium',wiki,1,1,false,false,'advanced');
    loadResource('Nano_Tube',wiki,0,1,false,false,'advanced');
    loadResource('Graphene',wiki,0,1,false,true,'advanced');
    loadResource('Stanene',wiki,0,1,false,true,'advanced');
    loadResource('Bolognium',wiki,0,1,false,true,'advanced');
    loadResource('Vitreloy',wiki,0,1,false,true,'advanced');
    loadResource('Orichalcum',wiki,0,1,false,true,'advanced');
    loadResource('Asphodel_Powder',wiki,0,1,false,false,'advanced');
    loadResource('Elysanite',wiki,0,1,false,true,'advanced');
    loadResource('Unobtainium',wiki,0,1,false,false,'advanced');
    loadResource('Materials',wiki,0,1,false,false,'advanced');
    loadResource('Horseshoe',wiki,-2,0,false,false,'advanced');
    loadResource('Nanite',wiki,0,1,false,false,'advanced');
    loadResource('Genes',wiki,-2,0,false,false,'advanced');
    loadResource('Soul_Gem',wiki,-2,0,false,false,'advanced');
    loadResource('Plywood',wiki,-1,0,false,false,'danger');
    loadResource('Brick',wiki,-1,0,false,false,'danger');
    loadResource('Wrought_Iron',wiki,-1,0,false,false,'danger');
    loadResource('Sheet_Metal',wiki,-1,0,false,false,'danger');
    loadResource('Mythril',wiki,-1,0,false,false,'danger');
    loadResource('Aerogel',wiki,-1,0,false,false,'danger');
    loadResource('Nanoweave',wiki,-1,0,false,false,'danger');
    loadResource('Scarletite',wiki,-1,0,false,false,'danger');
    loadResource('Quantium',wiki,-1,0,false,false,'danger');
    loadResource('Corrupt_Gem',wiki,-2,0,false,false,'caution');
    loadResource('Codex',wiki,-2,0,false,false,'caution');
    loadResource('Cipher',wiki,0,1,false,false,'caution');
    loadResource('Demonic_Essence',wiki,-2,0,false,false,'caution');
    loadResource('Blessed_Essence',wiki,-2,0,false,false,'caution');
    if (!wiki){
        if (global.resource?.Money && (global.tech?.currency >= 1 || global.tech?.banking >= 1 || global.city?.bank?.count > 0)){
            global.resource.Money.display = true;
        }
        if (global.resource?.Knowledge && (global.tech?.primitive >= 3 || global.tech?.science >= 1 || global.city?.university?.count > 0)){
            global.resource.Knowledge.display = true;
        }
    }
    if (wiki){ return; }
    loadSpecialResource('Blood_Stone','caution');
    loadSpecialResource('Artifact','caution');
    loadResource('Knockoff',wiki,-2,0,false,false,'special');
    loadSpecialResource('Plasmid');
    loadSpecialResource('AntiPlasmid');
    loadSpecialResource('Supercoiled');
    loadSpecialResource('Phage');
    loadSpecialResource('Dark');
    loadSpecialResource('Harmony');
    loadSpecialResource('AICore');
    if (typeof requestAnimationFrame === 'function'){
        requestAnimationFrame(forceShowResourcesPanel);
    }
    else {
        setTimeout(forceShowResourcesPanel, 0);
    }
}

export function tradeSummery(){
    if (global.race.species !== 'protoplasm'){
        loadRouteCounter();
        initGalaxyTrade();
        loadContainerCounter();
    }
}

function ensureProtoplasmLabel(evoResources){
    if (global.race.species !== 'protoplasm'){
        return;
    }
    const labelId = 'evolution-protoplasm-label';
    const labelTextId = `${labelId}-text`;
    let label = evoResources.find(`#${labelId}`);
    if (!label.length){
        label = $(`<div id="${labelId}" class="evolution-resources-title res has-text-warning"><span id="${labelTextId}">${loc('race_protoplasm')}</span></div>`);
        evoResources.prepend(label);
    }
    else if (!label.find(`#${labelTextId}`).length){
        label.empty();
        label.append(`<span id="${labelTextId}">${loc('race_protoplasm')}</span>`);
        label.data('popover', false);
    }
    if (!label.data('popover')){
        popover(labelId, function(){
            return `<div>${loc('race_protoplasm_desc')}</div>`;
        },{
            elm: `#${labelTextId}`,
            placement: 'bottom-start',
            offset: [0, 6]
        });
        label.data('popover', true);
    }
}

function ensureResourcesHeader(){
    const resources = $('#resources');
    if (!resources.length){
        return;
    }

    const title = resources.find('> h2.is-sr-only').first();
    const header = resources.find('> #resourcesFloatingHeader').first();

    if (!title.length){
        if (header.length){
            header.before(`<h2 class="is-sr-only">${loc('tab_resources')}</h2>`);
        }
        else {
            resources.prepend(`<h2 class="is-sr-only">${loc('tab_resources')}</h2>`);
        }
    }

    if (!header.length){
        const headerMarkup = `<div id="resourcesFloatingHeader" class="resources-floating-header"><span>${loc('tab_resources')}</span></div>`;
        const currentTitle = resources.find('> h2.is-sr-only').first();
        if (currentTitle.length){
            currentTitle.after(headerMarkup);
        }
        else {
            resources.prepend(headerMarkup);
        }
    }
    ensureResourcesPopulationHeader(resources);
    ensureResourcesTradeSummary(resources);
}

function ensureResourcesPopulationHeader(resources){
    const header = resources.find('> #resourcesFloatingHeader').first();
    if (!header.length){
        return;
    }
    const popKey = global.race?.species;
    const popRes = popKey ? global.resource?.[popKey] : null;
    let population = header.find('#resourcesPopulationHeader');
    if (!population.length){
        population = $(`
            <span id="resourcesPopulationHeader" class="resources-population-header" v-show="display">
                <span class="label">人口</span>
                <span class="value">{{ amount | size }} / {{ max | size }}</span>
            </span>
        `);
        const title = header.find('> span').first();
        if (title.length){
            title.after(population);
        }
        else {
            header.prepend(population);
        }
    }
    if (popRes){
        vBind({
            el: '#resourcesPopulationHeader',
            data: popRes,
            filters: {
                size(value){
                    return value ? sizeApproximation(value,0) : value;
                }
            }
        });
    }
}

function ensureResourcesTradeSummary(resources){
    const header = resources.find('> #resourcesFloatingHeader').first();
    if (!header.length){
        return;
    }
    let summary = header.find('#resourcesTradeSummary');
    if (!summary.length){
        summary = $(`
            <span id="resourcesTradeSummary" class="resources-trade-summary" v-show="active">
                <span class="label has-text-caution">${loc('resource_market_trade_routes')}</span>
                <span class="value"><span v-html="$options.filters.tdeCnt(trade)"></span> / {{ mtrade }}</span>
            </span>
        `);
        header.append(summary);
    }
    vBind({
        el: '#resourcesTradeSummary',
        data: global.city.market,
        filters: {
            tdeCnt(ct){
                let egg17 = easterEgg(17,11);
                if (((ct === 100 && !global.tech['isolation'] && !global.race['cataclysm']) || (ct === 10 && (global.tech['isolation'] || global.race['cataclysm']))) && egg17.length > 0){
                    return '10'+egg17;
                }
                return ct;
            }
        }
    });
}

function appendResourceElement(target, element){
    if (!element){
        return;
    }
    const container = $(target);
    if (!container.length){
        return;
    }
    if (target === '#resources'){
        const msgQueue = container.children('#msgQueue');
        if (msgQueue.length){
            msgQueue.before(element);
            return;
        }
    }
    container.append(element);
}

function forceShowResourcesPanel(){
    const resources = $('#resources');
    if (!resources.length){
        return;
    }
    const visibleResources = resources.find('.resource').filter(function(){
        return $(this).css('display') !== 'none';
    });
    if (visibleResources.length === 0){
        resources.addClass('resources-force-show');
    }
    else {
        resources.removeClass('resources-force-show');
    }
}

const moneyFloatingKey = 'evolve.moneyFloatingPos';
const knowledgeFloatingKey = 'evolve.knowledgeFloatingPos';

function ensureFloatingPanel(id, className){
    let panel = $(`#${id}`);
    if (!panel.length){
        panel = $(`<div id="${id}" class="${className}"></div>`);
        $('body').append(panel);
    }
    return panel;
}

function applyFloatingPosition(panel, left, top){
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

function restoreFloatingPosition(panel, storageKey){
    if (!panel.length || !(save && save.getItem)){
        return;
    }
    const raw = save.getItem(storageKey);
    if (!raw){
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)){
            applyFloatingPosition(panel, parsed.x, parsed.y);
        }
    }
    catch {
        // Ignore malformed saved positions.
    }
}

function setupFloatingDrag(panel, storageKey, namespace){
    const dataKey = `${namespace}DragBound`;
    if (!panel.length || panel.data(dataKey)){
        return;
    }
    panel.data(dataKey, true);
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let currentX = 0;
    let currentY = 0;

    const moveEvent = `pointermove.${namespace}Drag`;
    const upEvent = `pointerup.${namespace}Drag pointercancel.${namespace}Drag`;
    const downEvent = `pointerdown.${namespace}Drag`;
    const resizeEvent = `resize.${namespace}Drag`;

    const stopDrag = () => {
        if (!dragging){
            return;
        }
        dragging = false;
        if (save && save.setItem){
            save.setItem(storageKey, JSON.stringify({ x: Math.round(currentX), y: Math.round(currentY) }));
        }
        $(document).off(`${moveEvent} ${upEvent}`);
    };

    const moveDrag = (event) => {
        if (!dragging){
            return;
        }
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const next = applyFloatingPosition(panel, baseX + dx, baseY + dy);
        currentX = next.left;
        currentY = next.top;
    };

    panel.on(downEvent, (event) => {
        if (event.button !== undefined && event.button !== 0){
            return;
        }
        dragging = true;
        const rect = panel[0].getBoundingClientRect();
        baseX = rect.left;
        baseY = rect.top;
        currentX = baseX;
        currentY = baseY;
        startX = event.clientX;
        startY = event.clientY;
        event.preventDefault();
        $(document).on(moveEvent, moveDrag);
        $(document).on(upEvent, stopDrag);
    });

    $(window).on(resizeEvent, () => {
        if (!panel.length){
            return;
        }
        const rect = panel[0].getBoundingClientRect();
        applyFloatingPosition(panel, rect.left, rect.top);
    });
}

function ensureMoneyFloatingPanel(){
    return ensureFloatingPanel('moneyFloating', 'money-floating');
}

function ensureKnowledgeFloatingPanel(){
    return ensureFloatingPanel('knowledgeFloating', 'knowledge-floating');
}

// Load resource function
// This function defines each resource, loads saved values from localStorage
// And it creates Vue binds for various resource values
function loadResource(name,wiki,max,rate,tradable,stackable,color){
    color = color || 'info';
    if (!global.resource[name]){
        global.resource[name] = {};
    }

    setResourceName(name);

    if (global.race['artifical']){
        if (name === 'Food'){
            stackable = false;
        }
    }

    if (wiki){ return; }

    if (!global.resource[name].hasOwnProperty('display')){
        global.resource[name]['display'] = false;
    }
    if (!global.resource[name].hasOwnProperty('value')){
        global.resource[name]['value'] = global.race['truepath'] ? resource_values[name] * 2 : resource_values[name];
    }
    if (!global.resource[name].hasOwnProperty('amount')){
        global.resource[name]['amount'] = 0;
    }
    if (!global.resource[name].hasOwnProperty('max')){
        global.resource[name]['max'] = max;
    }
    if (!global.resource[name].hasOwnProperty('diff')){
        global.resource[name]['diff'] = 0;
    }
    if (!global.resource[name].hasOwnProperty('delta')){
        global.resource[name]['delta'] = 0;
    }
    if (!global.resource[name].hasOwnProperty('rate')){
        global.resource[name]['rate'] = rate;
    }
    if (!global.settings.resBar.hasOwnProperty(name)){
        global.settings.resBar[name] = false;
    }
    if (!global.resource[name].hasOwnProperty('bar')){
        global.resource[name]['bar'] = global.settings.resBar[name];
    }

    if (name === 'Mana'){
        global['resource'][name]['gen'] = 0;
        global['resource'][name]['gen_d'] = 0;
    }  

    global['resource'][name]['stackable'] = stackable;
    if (!global['resource'][name]['crates']){
        global['resource'][name]['crates'] = 0;
    }
    if (!global['resource'][name]['containers']){
        global['resource'][name]['containers'] = 0;
    }
    if (!global['resource'][name]['trade'] && tradable){
        global['resource'][name]['trade'] = 0;
    }
    if (tradable && !global.resource[name].hasOwnProperty('tradeQty')){
        const baseQty = global.city?.market?.qty ?? 1;
        global.resource[name].tradeQty = baseQty;
    }

    var res_container;
    const foodIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bug-icon lucide-bug"><path d="M12 20v-9"/><path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z"/><path d="M14.12 3.88 16 2"/><path d="M21 21a4 4 0 0 0-3.81-4"/><path d="M21 5a4 4 0 0 1-3.55 3.97"/><path d="M22 13h-4"/><path d="M3 21a4 4 0 0 1 3.81-4"/><path d="M3 5a4 4 0 0 0 3.55 3.97"/><path d="M6 13H2"/><path d="m8 2 1.88 1.88"/><path d="M9 7.13V6a3 3 0 1 1 6 0v1.13"/></svg>';
    const moneyIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-dollar-sign-icon lucide-circle-dollar-sign"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>';
    const isMoney = name === 'Money';
    const moneyLabel = isMoney ? loc('resource_Money_name') : '';
    const resLabel = isMoney
        ? `<span class="res-icon res-icon-money" aria-hidden="true">${moneyIcon}</span><span class="is-sr-only">${moneyLabel}</span>`
        : name === 'Food'
            ? `<span class="res-icon res-icon-food" aria-hidden="true">${foodIcon}</span><span class="res-label">{{ name | namespace }}</span>`
            : `{{ name | namespace }}`;
    const resLabelAttrs = isMoney
        ? ` title="${moneyLabel}" aria-label="${moneyLabel}"`
        : name === 'Food'
            ? ' :aria-label="name"'
            : '';

    const isEvolutionProgress = name === 'RNA' || name === 'DNA';
    const isPopulation = name === global.race?.species;
    const isPinguiculaPopulation = global.race?.species === 'pinguicula' && isPopulation;
    const resolveTradeQty = () => {
        const limit = tradeMax();
        let qty = Number(global.resource[name].tradeQty);
        if (!Number.isFinite(qty)){
            qty = Number(global.city?.market?.qty ?? 1);
        }
        if (!Number.isFinite(qty)){
            qty = 1;
        }
        qty = Math.floor(qty);
        if (qty < 1){
            qty = 1;
        }
        if (qty > limit){
            qty = limit;
        }
        if (global.resource[name].tradeQty !== qty){
            global.resource[name].tradeQty = qty;
        }
        return qty;
    };
    if (tradable){
        resolveTradeQty();
    }

    let jobControls = null;
    const jobControlsId = `resJobControls${name}`;

    if (isPinguiculaPopulation){
        res_container = $(`<div id="res${name}" class="resource race-population-resource" data-res-color="${color}" v-show="display" :class="{ 'resource-full': max > 0 && amount >= max }"><div><span class="res has-text-${color}">人口:</span><span id="cnt${name}" class="count">{{ amount | size }} / {{ max | size }}</span></div></div>`);
    }
    else if (global.resource[name].max === -1 || global.resource[name].max === -2){
        res_container = $(`<div id="res${name}" class="resource crafted" data-res-color="${color}" v-show="display" :class="{ 'resource-full': max > 0 && amount >= max }"><div><h3 class="res has-text-${color}"${resLabelAttrs}>${resLabel}</h3><span id="cnt${name}" class="count">{{ amount | diffSize }}</span></div></div>`);
    }
    else if (isEvolutionProgress) {
        res_container = $(`
            <div id="res${name}" class="resource evolution-progress" v-show="display"
                :style="{ '--percent-full': (max > 0 ? Math.min(amount / max, 1) : 0) }"
                :class="{ 'evolution-progress-full': max > 0 && amount >= max }">
                <div class="evolution-progress-text">
                    <span class="res-label">${resLabel}</span>
                    <span id="cnt${name}" class="count"><span class="current">{{ amount | size }}</span> / <span class="max">{{ max | size }}</span></span>
                    <span id="inc${name}" class="diff">{{ diff | diffSize }} /s</span>
                </div>
                <div class="evolution-progress-bar" aria-hidden="true"></div>
            </div>
        `);
    }
    else {
        const countMarkup = isMoney
            ? `<span class="current">{{ amount | size }}</span> / <span class="max">{{ max | size }}</span>`
            : `{{ amount | size }} / {{ max | size }}`;
        res_container = $(`<div id="res${name}" class="resource${global.settings.resBar[name] ? ` showBar` : ``}" data-res-color="${color}" v-show="display" :class="{ 'resource-full': max > 0 && amount >= max }" :style="{ '--percent-full': (bar && max > 0 ? (amount/max)*100 : 0) + '%', '--percent-full-ratio': (bar && max > 0 ? Math.min(amount / max, 1) : 0) }"><div><h3 class="res has-text-${color} bar"${resLabelAttrs} @click="toggle('${name}')">${resLabel}</h3><span id="cnt${name}" class="count">${countMarkup}</span></div></div>`);
    }

    if (isPopulation){
        res_container.addClass('resource-population');
    }

    const hideLeftNumberResources = [
        'Furs','Copper','Iron','Aluminium','Cement','Coal','Steel','Plywood','Brick','Wrought_Iron','Sheet_Metal',
        'Crates','Containers','Knowledge','Money'
    ];
    if (global.race?.species === 'pinguicula'){
        hideLeftNumberResources.push(global.race.species);
    }
    if (hideLeftNumberResources.includes(name)){
        res_container.addClass('hide-left-numbers hide-left-resource');
    }

    if (isEvolutionProgress){
        // Progress bar includes its own inline status text.
    }
    else if (isPinguiculaPopulation){
        // No extra controls for the portrait population display.
    }
    else if (stackable){
        res_container.append($(`<span><span id="con${name}" v-if="showTrigger()" class="interact has-text-success" @click="trigModal" role="button" aria-label="Open crate management for ${global.resource[name].name}">+</span></span>`));
    }
    else if (max !== -1 || (max === -1 && rate === 0 && global.race['no_craft']) || name === 'Scarletite' || name === 'Quantium'){
        res_container.append($('<span></span>'));
    }
    
    let infopops = false;
    if (isEvolutionProgress){
        // Inline diff already rendered inside the bar.
    }
    else if (isPinguiculaPopulation){
        // Skip diff display for portrait population.
    }
    else if (rate !== 0 || (max === -1 && rate === 0 && global.race['no_craft']) || name === 'Scarletite' || name === 'Quantium'){
        res_container.append($(`<span id="inc${name}" class="diff" :aria-label="resRate('${name}')">{{ diff | diffSize }} /s</span>`));
    }
    else if (max === -1 && !global.race['no_craft'] && name !== 'Scarletite' && name !== 'Quantium'){
        let craft = $('<span class="craftable"></span>');
        res_container.append(craft);

        let inc = [1,5];
        for (let i=0; i<inc.length; i++){
            craft.append($(`<span id="inc${name}${inc[i]}"><a @click="craft('${name}',${inc[i]})" aria-label="craft ${inc[i]} ${global.resource[name].name}" role="button">+<span class="craft" data-val="${inc[i]}">${inc[i]}</span></a></span>`));
        }
        craft.append($(`<span id="inc${name}A"><a @click="craft('${name}','A')" aria-label="craft max ${global.resource[name].name}" role="button">+<span class="craft" data-val="${'A'}">A</span></a></span>`));
        infopops = true;
    }
    else if(global.race['fasting'] && name === global.race.species){
        res_container.append($(`<span id="inc${name}" class="diff" :aria-label="resRate('${name}')">{{ diff | diffSize }}</span>`));
    }
    else {
        res_container.append($(`<span></span>`));
    }

    const mappedJobs = resourceJobMap[name] || [];
    const hasCraftControls = craftsmanResourceList.includes(name);
    if (mappedJobs.length || hasCraftControls){
        jobControls = $(`<span id="${jobControlsId}" class="resource-job-controls" v-show="res.display"></span>`);
        mappedJobs.forEach((job) => {
            jobControls.append(`
                <span class="resource-job-control" data-job="${job}" :class="{ 'is-full': isJobFull('${job}') }" v-show="showJob('${job}')">
                    <span class="label">{{ civic.${job}.name }}</span>
                    <span class="value">{{ civic.${job}.workers }}</span>
                    <span class="value max">/ {{ jobMax(civic.${job}.max) }}</span>
                    <span role="button" aria-label="${loc('remove')} {{ civic.${job}.name }}" class="job-avatar-control avatar-control-sub" @click.stop.prevent="subJob('${job}', $event)">➖</span>
                    <span role="button" aria-label="${loc('add')} {{ civic.${job}.name }}" class="job-avatar-control avatar-control-add" @click.stop.prevent="addJob('${job}', $event)">➕</span>
                    <span role="button" aria-label="Set default {{ civic.${job}.name }}" class="job-avatar-control avatar-control-default" :class="{ 'is-default': isDefault('${job}') }" :aria-pressed="isDefault('${job}')" @click.stop.prevent="setDefault('${job}', $event)">✔</span>
                </span>
            `);
        });
        if (hasCraftControls){
            jobControls.append(`
                <span class="resource-job-control resource-craftsman-control" data-craft="${name}" :class="{ 'is-full': isCraftFull('${name}') }" v-show="showCraft('${name}')">
                    <span class="label">{{ civic.craftsman.name }}</span>
                    <span class="value">{{ foundry.${name} }}</span>
                    <span class="value max">/ {{ craftMax('${name}') }}</span>
                    <span role="button" aria-label="remove ${name} crafter" class="job-avatar-control avatar-control-sub" @click.stop.prevent="subCraft('${name}', $event)">➖</span>
                    <span role="button" aria-label="add ${name} crafter" class="job-avatar-control avatar-control-add" @click.stop.prevent="addCraft('${name}', $event)">➕</span>
                    <span role="button" aria-label="Set default ${name} crafter" class="job-avatar-control avatar-control-default" :class="{ 'is-default': isDefaultCraft('${name}') }" :aria-pressed="isDefaultCraft('${name}')" @click.stop.prevent="setDefaultCraft('${name}', $event)">✔</span>
                </span>
            `);
        }
        res_container.addClass('resource-has-job-controls');
    }

    const inlineMarketEnabled = tradable && tradeRatio[name];
    const marketRow = inlineMarketEnabled ? $(`
        <div id="res${name}Market" class="resource-market-row" v-show="display && showMarketInline()">
            <b-field class="resource-market-qty" v-show="showMarketQty()">
                <span class="resource-market-qty-label">x</span>
                <span class="button has-text-danger" role="button" @click="tradeQtyLess">-</span>
                <b-numberinput :input="tradeQtyVal()" min="1" :max="tradeQtyLimit()" v-model="tradeQty" :controls="false"></b-numberinput>
                <span class="button has-text-success" role="button" @click="tradeQtyMore">+</span>
            </b-field>
            <span class="resource-market-order market-buy">
                <span class="label has-text-success">${loc('resource_market_buy')}</span>
                <span role="button" class="value has-text-success" @click="purchase()">\${{ value | buy }}</span>
            </span>
            <span class="resource-market-order market-sell">
                <span class="label has-text-danger">${loc('resource_market_sell')}</span>
                <span role="button" class="value has-text-danger" @click="sell()">\${{ value | sell }}</span>
            </span>
            <span class="resource-market-routes" v-show="showMarketRoutes()">
                <span role="button" class="sub has-text-danger" @click="autoSell()"><span>-</span></span>
                <span class="current" :class="routeClass(trade)">{{ trade | trade }}</span>
                <span role="button" class="add has-text-success" @click="autoBuy()"><span>+</span></span>
                <span role="button" class="zero has-text-advanced" @click="zeroRoutes()">${loc('cancel_routes')}</span>
            </span>
        </div>
    `) : null;
    
    let target = '#resources';
    let floatingPanel = null;
    let floatingKey = null;
    let floatingNamespace = null;
    if (name === 'RNA' || name === 'DNA'){
        const evolution = $('#evolution');
        if (evolution.length){
            let evoResources = $('#evolution-resources');
            if (!evoResources.length){
                evoResources = $('<div id="evolution-resources" class="resources evolution-resources"></div>');
                evolution.prepend(evoResources);
            }
            ensureProtoplasmLabel(evoResources);
            target = '#evolution-resources';
        }
    }
    if (isPinguiculaPopulation){
        if ($('#pinguiculaPopulationMount').length){
            target = '#pinguiculaPopulationMount';
        }
    }
    const isMainResources = target === '#resources';
    const moveJobControlsAbove = isMainResources && resourceJobTopTargets.has(name);
    if (jobControls && moveJobControlsAbove){
        jobControls.addClass('resource-job-controls-top');
        appendResourceElement(target, jobControls);
    }
    else if (jobControls){
        res_container.append(jobControls);
    }
    appendResourceElement(target, res_container);
    if (marketRow){
        appendResourceElement(target, marketRow);
    }
    if (jobControls){
        vBind({
            el: `#${jobControlsId}`,
            data: {
                civic: global.civic,
                foundry: global.city?.foundry || {},
                res: global.resource[name]
            },
            methods: {
                showJob(j){
                    const civicJob = global.civic?.[j];
                    if (!civicJob){
                        return false;
                    }
                    const isDefaultJob = j === 'unemployed' || j === 'hunter' || j === 'forager';
                    if (isDefaultJob){
                        const popMax = global.resource?.[global.race?.species]?.max ?? 0;
                        if (popMax <= 0){
                            return false;
                        }
                    }
                    return civicJob.display || global.civic.d_job === j;
                },
                isJobFull(j){
                    const civicJob = global.civic?.[j];
                    if (!civicJob){
                        return false;
                    }
                    const max = Number.isFinite(civicJob.max) ? civicJob.max : 0;
                    if (max <= 0 || max === -1){
                        return false;
                    }
                    return civicJob.workers >= max;
                },
                flashInlineControl(target, direction){
                    if (!target){
                        return;
                    }
                    const incClass = 'flash-inc';
                    const decClass = 'flash-dec';
                    const cls = direction === 'inc' ? incClass : decClass;
                    target.classList.remove(incClass, decClass);
                    void target.offsetWidth;
                    target.classList.add(cls);
                    if (target._flashTimer){
                        clearTimeout(target._flashTimer);
                    }
                    target._flashTimer = setTimeout(() => {
                        target.classList.remove(cls);
                        target._flashTimer = null;
                    }, INLINE_JOB_FLASH_DURATION);
                },
                flashJobControl(jobKey, direction){
                    if (!jobKey || typeof document === 'undefined'){
                        return;
                    }
                    const root = document.getElementById(jobControlsId);
                    if (!root){
                        return;
                    }
                    const target = root.querySelector(`[data-job="${jobKey}"]`);
                    if (!target){
                        return;
                    }
                    this.flashInlineControl(target, direction);
                },
                flashCraftControl(resKey, direction){
                    if (!resKey || typeof document === 'undefined'){
                        return;
                    }
                    const root = document.getElementById(jobControlsId);
                    if (!root){
                        return;
                    }
                    const target = root.querySelector(`[data-craft="${resKey}"]`);
                    if (!target){
                        return;
                    }
                    this.flashInlineControl(target, direction);
                },
                addJob(j, event){
                    if (event && typeof window !== 'undefined' && typeof window.playClickSound === 'function'){
                        window.playClickSound();
                    }
                    const poolJob = (resourceAvatarJobs.has(j) && j !== 'unemployed') ? 'unemployed' : global.civic.d_job;
                    const pool = poolJob ? global.civic[poolJob] : null;
                    const startJob = global.civic[j].workers;
                    const startPool = pool ? pool.workers : 0;
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
                    const deltaJob = global.civic[j].workers - startJob;
                    const deltaPool = pool ? pool.workers - startPool : 0;
                    refreshInlineJobControls();
                    if (deltaJob !== 0){
                        this.flashJobControl(j, deltaJob > 0 ? 'inc' : 'dec');
                    }
                    if (poolJob && poolJob !== j && deltaPool !== 0){
                        this.flashJobControl(poolJob, deltaPool > 0 ? 'inc' : 'dec');
                    }
                },
                subJob(j, event){
                    if (event && typeof window !== 'undefined' && typeof window.playClickSound === 'function'){
                        window.playClickSound();
                    }
                    const poolJob = (resourceAvatarJobs.has(j) && j !== 'unemployed') ? 'unemployed' : global.civic.d_job;
                    const pool = poolJob ? global.civic[poolJob] : null;
                    const startJob = global.civic[j].workers;
                    const startPool = pool ? pool.workers : 0;
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
                    const deltaJob = global.civic[j].workers - startJob;
                    const deltaPool = pool ? pool.workers - startPool : 0;
                    refreshInlineJobControls();
                    if (deltaJob !== 0){
                        this.flashJobControl(j, deltaJob > 0 ? 'inc' : 'dec');
                    }
                    if (poolJob && poolJob !== j && deltaPool !== 0){
                        this.flashJobControl(poolJob, deltaPool > 0 ? 'inc' : 'dec');
                    }
                },
                setDefault(j, event){
                    if (event && typeof window !== 'undefined' && typeof window.playClickSound === 'function'){
                        window.playClickSound();
                    }
                    global.civic.d_job = j;
                    if (global.city?.foundry?.d_craft){
                        global.city.foundry.d_craft = null;
                    }
                    refreshInlineJobControls();
                },
                isDefault(j){
                    return global.civic.d_job === j && !global.city?.foundry?.d_craft;
                },
                showCraft(res){
                    if (!global.city?.foundry || !global.city.foundry.hasOwnProperty(res)){
                        return false;
                    }
                    if (res === 'Thermite' && !eventActive('summer')){
                        return false;
                    }
                    return true;
                },
                isCraftFull(res){
                    if (!global.city?.foundry || !global.city.foundry.hasOwnProperty(res)){
                        return false;
                    }
                    const max = this.craftMax(res);
                    if (!Number.isFinite(max) || max <= 0){
                        return false;
                    }
                    return global.city.foundry[res] >= max;
                },
                addCraft(res, event){
                    if (event && typeof window !== 'undefined' && typeof window.playClickSound === 'function'){
                        window.playClickSound();
                    }
                    if (!global.city?.foundry || !global.civic?.craftsman){
                        return;
                    }
                    const startCraft = global.city.foundry[res];
                    let keyMult = keyMultiplier();
                    let tMax = -1;
                    if (res === 'Scarletite' || res === 'Quantium'){
                        tMax = craftsmanCap(res);
                    }
                    for (let i=0; i<keyMult; i++){
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
                    const deltaCraft = global.city.foundry[res] - startCraft;
                    refreshInlineJobControls();
                    if (deltaCraft !== 0){
                        this.flashCraftControl(res, deltaCraft > 0 ? 'inc' : 'dec');
                    }
                },
                subCraft(res, event){
                    if (event && typeof window !== 'undefined' && typeof window.playClickSound === 'function'){
                        window.playClickSound();
                    }
                    if (!global.city?.foundry || !global.civic?.craftsman){
                        return;
                    }
                    const startCraft = global.city.foundry[res];
                    let keyMult = keyMultiplier();
                    for (let i=0; i<keyMult; i++){
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
                    const deltaCraft = global.city.foundry[res] - startCraft;
                    refreshInlineJobControls();
                    if (deltaCraft !== 0){
                        this.flashCraftControl(res, deltaCraft > 0 ? 'inc' : 'dec');
                    }
                },
                setDefaultCraft(res, event){
                    if (event && typeof window !== 'undefined' && typeof window.playClickSound === 'function'){
                        window.playClickSound();
                    }
                    if (global.city?.foundry){
                        global.city.foundry.d_craft = global.city.foundry.d_craft === res ? null : res;
                    }
                    refreshInlineJobControls();
                },
                isDefaultCraft(res){
                    return global.city?.foundry?.d_craft === res;
                },
                jobMax(value){
                    return value === -1 ? '∞' : value;
                },
                craftMax(res){
                    const cap = craftsmanCap(res);
                    if (cap !== Number.MAX_SAFE_INTEGER){
                        return cap;
                    }
                    return global.civic?.craftsman?.max ?? 0;
                }
            }
        });
    }
    if (floatingPanel){
        if (typeof requestAnimationFrame === 'function'){
            requestAnimationFrame(() => {
                restoreFloatingPosition(floatingPanel, floatingKey);
                setupFloatingDrag(floatingPanel, floatingKey, floatingNamespace);
            });
        }
        else {
            setTimeout(() => {
                restoreFloatingPosition(floatingPanel, floatingKey);
                setupFloatingDrag(floatingPanel, floatingKey, floatingNamespace);
            }, 0);
        }
    }

    var modal = {
            template: '<div id="modalBox" class="modalBox"></div>'
        };
    
    const resourceFilters = {
        size: function (value){
            return value ? sizeApproximation(value,0) : value;
        },
        diffSize: function (value){
            if (name === 'Horseshoe' && !global.race['hooved'] && eventActive('fool',2023)){
                value = 5;
            }
            return sizeApproximation(value,2);
        },
        namespace(val){
            return val.replace("_", " ");
        },
        buy(value){
            if (global.race['arrogant']){
                value *= 1 + (traits.arrogant.vars()[0] / 100);
            }
            const qty = resolveTradeQty();
            return sizeApproximation(value * qty,0);
        },
        sell(value){
            let divide = 4;
            if (global.race['merchant']){
                divide *= 1 - (traits.merchant.vars()[0] / 100);
            }
            let fathom = fathomCheck('goblin');
            if (fathom > 0){
                divide *= 1 - (traits.merchant.vars(1)[0] / 100 * fathom);
            }
            if (global.race['devious']){
                divide *= 1 - (traits.devious.vars()[0] / 100);
            }
            if (global.race['asymmetrical']){
                divide *= 1 + (traits.asymmetrical.vars()[0] / 100);
            }
            const qty = resolveTradeQty();
            return sizeApproximation(value * qty / divide,0);
        },
        trade(val){
            if (name === 'Stone' && (val === 31 || val === -31)){
                let trick = trickOrTreat(3,12,false);
                if (trick.length > 0){
                    return trick;
                }
            }
            if (val < 0){
                val = 0 - val;
                return `-${val}`;
            }
            else if (val > 0){
                return `+${val}`;
            }
            else {
                return 0;
            }
        }
    };

    const resourceMethods = {
        resRate(n){
            let diff = sizeApproximation(global.resource[n].diff,2);
            return `${global.resource[name].name} ${diff} per second`;
        },
        trigModal(){
            this.$buefy.modal.open({
                parent: this,
                component: modal
            });

            var checkExist = setInterval(function(){
               if ($('#modalBox').length > 0) {
                  clearInterval(checkExist);
                  drawModal(name,color);
               }
            }, 50);
        },
        showTrigger(){
            return global.resource.Crates.display;
        },
        craft(res,vol){
            if (!global.race['no_craft']){
                let craft_bonus = craftingRatio(res,'manual').multiplier;
                let craft_costs = craftCost(true);
                let volume = Math.floor(global.resource[craft_costs[res][0].r].amount / craft_costs[res][0].a);
                for (let i=1; i<craft_costs[res].length; i++){
                    let temp = Math.floor(global.resource[craft_costs[res][i].r].amount / craft_costs[res][i].a);
                    if (temp < volume){
                        volume = temp;
                    }
                }
                if (vol !== 'A'){
                    let total = vol * keyMultiplier();
                    if (total < volume){
                        volume = total;
                    }
                }
                for (let i=0; i<craft_costs[res].length; i++){
                    let num = volume * craft_costs[res][i].a;
                    global.resource[craft_costs[res][i].r].amount -= num;
                }
                global.resource[res].amount += volume * craft_bonus;
            }
        },
        craftCost(res,vol){
            let costs = '';
            let craft_costs = craftCost(true);
            for (let i=0; i<craft_costs[res].length; i++){
                let num = vol * craft_costs[res][i].a * keyMultiplier();
                costs = costs + `<div>${global.resource[craft_costs[res][i].r].name} ${num}</div>`;
            }
            return costs;
        },
        toggle(res){
            if (global.settings.resBar[res]){
                global.settings.resBar[res] = false;
                $(`#res${name}`).removeClass('showBar');
            }
            else {
                global.settings.resBar[res] = true;
                $(`#res${name}`).addClass('showBar');
            }
            global.resource[name]['bar'] = global.settings.resBar[name];
        },
        showMarketInline(){
            if (!global.city?.market?.active){
                return false;
            }
            if (global.race['no_trade']){
                return false;
            }
            if (!tradeRatio[name] || !global.resource[name].hasOwnProperty('trade')){
                return false;
            }
            if ((global.race['artifical'] || global.race['fasting']) && name === 'Food'){
                return false;
            }
            return true;
        },
        showMarketQty(){
            return this.showMarketInline();
        },
        tradeQtyVal(){
            resolveTradeQty();
        },
        tradeQtyLimit(){
            return tradeMax();
        },
        tradeQtyLess(){
            this.tradeQty = Math.max(1, resolveTradeQty() - keyMultiplier());
        },
        tradeQtyMore(){
            this.tradeQty = Math.min(tradeMax(), resolveTradeQty() + keyMultiplier());
        },
        marketQty(){
            return sizeApproximation(resolveTradeQty(),0);
        },
        showMarketRoutes(){
            if (!this.showMarketInline()){
                return false;
            }
            if (global.race['banana'] && name === 'Food'){
                return true;
            }
            return Boolean(global.tech['trade']) && !global.race['terrifying'];
        },
        routeClass(val){
            if (val > 0){
                return 'has-text-success';
            }
            if (val < 0){
                return 'has-text-danger';
            }
            return 'has-text-warning';
        },
        purchase(){
            if (!this.showMarketInline() || global.settings.pause){
                return;
            }
            let qty = resolveTradeQty();
            let value = global.resource[name].value;
            if (global.race['arrogant']){
                value *= 1 + (traits.arrogant.vars()[0] / 100);
            }
            if (global.race['conniving']){
                value *= 1 - (traits.conniving.vars()[0] / 100);
            }
            let fathom = fathomCheck('imp');
            if (fathom > 0){
                value *= 1 - (traits.conniving.vars(1)[0] / 100 * fathom);
            }
            let amount = Math.floor(Math.min(qty, global.resource.Money.amount / value,
              global.resource[name].max - global.resource[name].amount));
            if (amount > 0){
                global.resource[name].amount += amount;
                global.resource.Money.amount -= Math.round(value * amount);
                global.resource[name].value += Number((amount / Math.rand(1000,10000)).toFixed(2));
            }
        },
        sell(){
            if (!this.showMarketInline() || global.settings.pause){
                return;
            }
            let qty = resolveTradeQty();
            let divide = 4;
            if (global.race['merchant']){
                divide *= 1 - (traits.merchant.vars()[0] / 100);
            }
            let gobFathom = fathomCheck('goblin');
            if (gobFathom > 0){
                divide *= 1 - (traits.merchant.vars(1)[0] / 100 * gobFathom);
            }
            if (global.race['asymmetrical']){
                divide *= 1 + (traits.asymmetrical.vars()[0] / 100);
            }
            if (global.race['conniving']){
                divide *= 1 - (traits.conniving.vars()[1] / 100);
            }
            let impFathom = fathomCheck('imp');
            if (impFathom > 0){
                divide *= 1 - (traits.conniving.vars(1)[1] / 100 * impFathom);
            }
            let price = global.resource[name].value / divide;
            let amount = Math.floor(Math.min(qty, global.resource[name].amount,
              (global.resource.Money.max - global.resource.Money.amount) / price));
            if (amount > 0) {
                global.resource[name].amount -= amount;
                global.resource.Money.amount += Math.round(price * amount);
                global.resource[name].value -= Number((amount / Math.rand(1000,10000)).toFixed(2));
                if (global.resource[name].value < Number(resource_values[name] / 2)){
                    global.resource[name].value = Number(resource_values[name] / 2);
                }
            }
        },
        autoBuy(keyMult = keyMultiplier()){
            for (let i=0; i<keyMult; i++){
                if (govActive('dealmaker',0)){
                    let exporting = 0;
                    let importing = 0;
                    Object.keys(global.resource).forEach(function(res){
                        if (global.resource[res].hasOwnProperty('trade') && global.resource[res].trade < 0){
                            exporting -= global.resource[res].trade;
                        }
                        if (global.resource[res].hasOwnProperty('trade') && global.resource[res].trade > 0){
                            importing += global.resource[res].trade;
                        }
                    });
                    if (exporting <= importing){
                        break;
                    }
                }
                if (global.resource[name].trade >= 0){
                    if (importRouteEnabled(name) && global.city.market.trade < global.city.market.mtrade){
                        global.city.market.trade++;
                        global.resource[name].trade++;
                    }
                    else {
                        break;
                    }
                }
                else {
                    global.city.market.trade--;
                    global.resource[name].trade++;
                }
            }
            tradeRouteColor(name);
        },
        autoSell(keyMult = keyMultiplier()){
            for (let i=0; i<keyMult; i++){
                if (global.resource[name].trade <= 0){
                    if (exportRouteEnabled(name) && global.city.market.trade < global.city.market.mtrade){
                        global.city.market.trade++;
                        global.resource[name].trade--;
                    }
                    else {
                        break;
                    }
                }
                else {
                    global.city.market.trade--;
                    global.resource[name].trade--;
                }
            }
            tradeRouteColor(name);
        },
        zeroRoutes(){
            const current = global.resource[name].trade;
            if (current > 0){
                this.autoSell(current);
            }
            else if (current < 0){
                this.autoBuy(-current);
            }
        }
    };

    vBind({
        el: `#res${name}`,
        data: global['resource'][name],
        filters: resourceFilters,
        methods: resourceMethods
    });
    if (marketRow){
        vBind({
            el: `#res${name}Market`,
            data: global['resource'][name],
            filters: resourceFilters,
            methods: resourceMethods
        });
    }
    if (!wiki && isPopulation){
        ensureResourcesPopulationHeader($('#resources'));
    }

    breakdownPopover(`cnt${name}`,name,'c');

    if (infopops){
        let inc = [1,5,'A'];
        for (let i=0; i<inc.length; i++){
            let extra = function(){
                let popper = $(`<div></div>`);
                let res = name;
                let vol = inc[i];
                let bonus = +(craftingRatio(res,'manual').multiplier * 100).toFixed(0);
                popper.append($(`<div class="has-text-info">${loc('manual_crafting_hover_bonus',[bonus.toLocaleString(),global.resource[res].name])}</div>`));
                
                let craft_costs = craftCost(true);
                let crafts = $(`<div><span class="has-text-success">${loc('manual_crafting_hover_craft')} </span></div>`);
                let num_crafted = 0;
                if (typeof vol !== 'number'){
                    num_crafted = global.resource[craft_costs[res][0].r].amount / craft_costs[res][0].a;
                    if (craft_costs[res].length > 1){
                        for (let i=1; i<craft_costs[res].length; i++){
                            let curr_max = global.resource[craft_costs[res][i].r].amount / craft_costs[res][i].a;
                            if (curr_max < num_crafted){
                                num_crafted = curr_max;
                            }
                        }
                    }
                    crafts.append($(`<span class="has-text-advanced">${sizeApproximation((bonus / 100) * num_crafted,1)} ${global.resource[res].name}</span>`));
                }
                else {
                    num_crafted = keyMultiplier() * vol;
                    let total_crafted = sizeApproximation((bonus / 100) * num_crafted,1);
                    crafts.append($(`<span class="has-text-advanced"><span class="craft" data-val="${(sizeApproximation((bonus / 100) * vol))}">${total_crafted}</span> ${global.resource[res].name}</span>`));
                }
                let costs = $(`<div><span class="has-text-danger">${loc('manual_crafting_hover_use')} </span></div>`);
                for (let i=0; i<craft_costs[res].length; i++){
                    costs.append($(`<span class="craft-elm has-text-caution">${sizeApproximation(num_crafted * craft_costs[res][i].a,1)} ${global.resource[craft_costs[res][i].r].name}</span>`));
                    if (i + 1 < craft_costs[res].length){
                        costs.append($(`<span>, </span>`));
                    }
                }
                popper.append(crafts);
                popper.append(costs);
                
                return popper;
            }
            
            craftingPopover(`inc${name}${inc[i]}`,name,'manual',extra);
        }
    }

    if (stackable){
        popover(`con${name}`,function(){
            var popper = $(`<div>${loc('resource_Crates_plural')} ${global.resource[name].crates}</div>`);
            if (global.tech['steel_container']){
                popper.append($(`<div>${loc('resource_Containers_plural')} ${global.resource[name].containers}</div>`));
            }
            return popper;
        });
    }

    if ((name !== global.race.species || global.race['fasting']) && name !== 'Crates' && name !== 'Containers' && max !== -1){
        breakdownPopover(`inc${name}`,name,'p');
    }
    else if (max === -1){
        craftingPopover(`inc${name}`,name,'auto');
    }

    $(`#res${name}`).on('mouseover',function(){
        $(`.res-${name}`).each(function(){
            if (global.resource[name].amount >= $(this).attr(`data-${name}`)){
                $(this).addClass('hl-ca');
            }
            else {
                $(this).addClass('hl-cna');
            }
        });
    });
    $(`#res${name}`).on('mouseout',function(){
        $(`.res-${name}`).each(function(){
            $(this).removeClass('hl-ca');
            $(this).removeClass('hl-cna');
        });
    });

    if (typeof tmp_vars['resource'] === 'undefined'){
        tmp_vars['resource'] = {};
    }

    tmp_vars.resource[name] = {
        color: color,
        tradable: tradable,
        stackable: stackable,
        temp_max: 0
    };
}

export function setResourceName(name){
    if (name === global.race.species){
        global.resource[name].name = flib('name');
    }
    else {
        global.resource[name].name = name === 'Money' ? '$' : loc(`resource_${name}_name`);
    }

    if (name === 'Useless'){
        if (!global.resource.Lumber.display){
            global.resource.Useless.name = loc('resource_Lumber_name');
        }
        else if (!global.resource.Chrysotile.display){
            global.resource.Useless.name = loc('resource_Chrysotile_name');
        }
        else if (!global.resource.Crystal.display){
            global.resource.Useless.name = loc('resource_Crystal_name');
        }
        else {
            global.resource.Useless.name = loc('resource_Bronze_name');
        }
    }
    
    if (eventActive('fool',2022)){
        switch(name){
            case 'Lumber':
                global['resource'][name].name = loc('resource_Stone_name');
                break;
            case 'Stone':
                global['resource'][name].name = loc('resource_Lumber_name');
                break;
            case 'Copper':
                global['resource'][name].name = loc('resource_Iron_name');
                break;
            case 'Iron':
                global['resource'][name].name = loc('resource_Copper_name');
                break;
            case 'Steel':
                global['resource'][name].name = loc('resource_Titanium_name');
                break;
            case 'Titanium':
                global['resource'][name].name = loc('resource_Steel_name');
                break;
            case 'Coal':
                global['resource'][name].name = loc('resource_Oil_name');
                break;
            case 'Oil':
                global['resource'][name].name = loc('resource_Coal_name');
                break;
            case 'Alloy':
                global['resource'][name].name = loc('resource_Polymer_name');
                break;
            case 'Polymer':
                global['resource'][name].name = loc('resource_Alloy_name');
                break;
            case 'Graphene':
                global['resource'][name].name = loc('resource_Stanene_name');
                break;
            case 'Stanene':
                global['resource'][name].name = loc('resource_Graphene_name');
                break;
            case 'Plywood':
                global['resource'][name].name = loc('resource_Brick_name');
                break;
            case 'Brick':
                global['resource'][name].name = loc('resource_Plywood_name');
                break;
            case 'Genes':
                global['resource'][name].name = loc('resource_Soul_Gem_name');
                break;
            case 'Soul_Gem':
                global['resource'][name].name = loc('resource_Genes_name');
                break;
            case 'Slave':
                global['resource'][name].name = loc('resource_Peon_name');
                break;
        }
    }

    if (name === 'Horseshoe'){
        global.resource[name].name = hoovedRename();
    }

    if (global.race['artifical']){
        if (name === 'Genes'){
            global.resource[name].name = loc(`resource_Program_name`);
        }
    }

    if (global.race['sappy']){
        switch(name){
            case 'Stone':
                global['resource'][name].name = loc('resource_Amber_name');
                break;
        }
    }
    else if (global.race['flier']){
        switch(name){
            case 'Stone':
                global['resource'][name].name = loc('resource_Clay_name');
                break;
            case 'Brick':
                global['resource'][name].name = loc('resource_Mud_Brick_name');
                break;
        }
    }

    if (global.race['soul_eater']){
        switch(name){
            case 'Food':
                global['resource'][name].name = loc('resource_Souls_name');
                break;
        }
    }

    if (global.race['evil']){
        switch(name){
            case 'Lumber':
                global['resource'][name].name = loc('resource_Bones_name');
                break;
            case 'Furs':
                global['resource'][name].name = loc('resource_Flesh_name');
                break;
            case 'Plywood':
                global['resource'][name].name = loc('resource_Boneweave_name');
                break;
        }
    }

    if (global.race['artifical']){
        switch(name){
            case 'Food':
                global['resource'][name].name = loc('resource_Signal_name');
                break;
        }
    }

    /* Too many hard coded string references to cement, maybe some other day
    if (global.city.biome === 'ashland'){
        switch(name){
            case 'Cement':
                global['resource'][name].name = loc('resource_Ashcrete_name');
                break;
        }
    }*/

    let hallowed = eventActive('halloween');
    if (hallowed.active){
        switch(name){
            case 'Food':
                global['resource'][name].name = loc('resource_Candy_name');
                break;
            case 'Lumber':
                global['resource'][name].name = loc('resource_Bones_name');
                break;
            case 'Stone':
                global['resource'][name].name = loc('resource_RockCandy_name');
                break;
            case 'Furs':
                global['resource'][name].name = loc('resource_Webs_name');
                break;
            case 'Plywood':
                global['resource'][name].name = loc('resource_Boneweave_name');
                break;
            case 'Brick':
                global['resource'][name].name = loc('resource_Tombstone_name');
                break;
            case 'Soul_Gem':
                global['resource'][name].name = loc('resource_CandyCorn_name');
                break;
            case 'Slave':
                global['resource'][name].name = loc('events_halloween_ghoul');
                break;
        }
    }
}

function loadSpecialResource(name,color) {
    if ($(`#res${name}`).length){
        let bind = $(`#res${name}`);
        bind.detach();
        appendResourceElement('#resources', bind);
        return;
    }
    color = color || 'special';

    var res_container = $(`<div id="res${name}" class="resource" v-show="count"><div><span class="res has-text-${color}">${loc(`resource_${name}_name`)}</span><span class="count">{{ count | round }}</span></div></div>`);
    appendResourceElement('#resources', res_container);

    vBind({
        el: `#res${name}`,
        data: global.prestige[name],
        filters: {
            round(n){ return n ? sizeApproximation(n, 3, false, true) : n; }
        }
    });

    if (name === "Artifact" || name === "Blood_Stone"){
        return;
    }

    popover(`res${name}`, function(){
        let desc = $(`<div></div>`);
        switch (name){
            case 'Plasmid':
                {
                    let potential = global.race.p_mutation + (global.race['wish'] && global.race['wishStats'] ? global.race.wishStats.plas : 0);
                    let active = global.race['no_plasmid'] ? Math.min(potential, global.prestige.Plasmid.count) : global.prestige.Plasmid.count;
                    desc.append($(`<span>${loc(`resource_${name}_desc`,[active, +(plasmidBonus('plasmid') * 100).toFixed(2)])}</span>`));
                    if (global.genes['store'] && (global.race.universe !== 'antimatter' || global.genes['bleed'] >= 3)){
                        let plasmidSpatial = spatialReasoning(1,'plasmid');
                        if (plasmidSpatial > 1){
                            desc.append($(`<span> ${loc(`resource_Plasmid_desc2`,[+((plasmidSpatial - 1) * 100).toFixed(2)])}</span>`));
                        }   
                    }
                }
                break;
    
            case 'AntiPlasmid':
                {
                    desc.append($(`<span>${loc(`resource_${name}_desc`,[global.prestige.AntiPlasmid.count, +(plasmidBonus('antiplasmid') * 100).toFixed(2)])}</span>`));
                    let antiSpatial = spatialReasoning(1,'anti');
                    if (global.genes['store'] && (global.race.universe === 'antimatter' || global.genes['bleed'] >= 3)){
                        if (antiSpatial > 1){
                            desc.append($(`<span> ${loc(`resource_Plasmid_desc2`,[+((antiSpatial - 1) * 100).toFixed(2)])}</span>`));
                        }
                    }
                }
                break;
    
            case 'Phage':
                {
                    desc.append($(`<span>${loc(global.prestige.AntiPlasmid.count > 0 ? `resource_Phage_desc2` : `resource_Phage_desc`,[250 + global.prestige.Phage.count])}</span>`));
                    let phageSpatial = spatialReasoning(1,'phage');
                    if (global.genes['store'] && global.genes['store'] >= 4){
                        if (phageSpatial > 1){
                            desc.append($(`<span> ${loc(`resource_Plasmid_desc2`,[+((phageSpatial - 1) * 100).toFixed(2)])}</span>`));
                        }
                    }
                }
                break;
    
            case 'Dark':
                {
                    switch (global.race.universe){
                        case 'standard':
                            desc.append($(`<span>${loc(`resource_${name}_desc_s`,[+((darkEffect('standard') - 1) * 100).toFixed(2)])}</span>`));
                            break;
        
                        case 'evil':
                            desc.append($(`<span>${loc(`resource_${name}_desc_e`,[+((darkEffect('evil') - 1) * 100).toFixed(2),+((darkEffect('evil',true) - 1) * 100).toFixed(2)])}</span>`));
                            break;
        
                        case 'micro':
                            desc.append($(`<span>${loc(`resource_${name}_desc_m`,[darkEffect('micro',false),darkEffect('micro',true)])}</span>`));
                            break;
        
                        case 'heavy':
                            let hDE = darkEffect('heavy');
                            let space = 0.25 + (0.5 * hDE);
                            let int = 0.2 + (0.3 * hDE);
                            desc.append($(`<span>${loc(`resource_${name}_desc_h`,[+(space * 100).toFixed(4),+(int * 100).toFixed(4)])}</span>`));
                            break;
        
                        case 'antimatter':
                            desc.append($(`<span>${loc(`resource_${name}_desc_a`,[+((darkEffect('antimatter') - 1) * 100).toFixed(2)])}</span>`));
                            break;

                        case 'magic':
                            desc.append($(`<span>${loc(`resource_${name}_desc_mg`,[loc('resource_Mana_name'),+((darkEffect('magic') - 1) * 100).toFixed(2)])}</span>`));
                            break;
                    }
                }
                break;
    
            case 'Harmony':
                desc.append($(`<span>${loc(`resource_${name}_desc`,[global.race.universe === 'standard' ? 0.1 : 1, harmonyEffect()])}</span>`));
                break;

            case 'AICore':
                {
                    let bonus = +((1 - (0.99 ** global.prestige.AICore.count)) * 100).toFixed(2);
                    desc.append($(`<span>${loc(`resource_${name}_desc`,[bonus])}</span>`));
                }
                break;

            case 'Supercoiled':
                {
                    let coiled = global.prestige.Supercoiled.count;
                    let bonus = (coiled / (coiled + 5000)) * 100;
                    desc.append($(`<span>${loc(`resource_${name}_desc`,[+bonus.toFixed(2)])}</span>`));
                    if (global.genes.hasOwnProperty('trader') && global.genes.trader >= 2){
                        let trade = (coiled / (coiled + 500)) * 100;
                        desc.append($(`<span> ${loc(`resource_${name}_trade_desc`,[+trade.toFixed(2)])}</span>`));
                    }
                }
                break;
        }
        return desc;
    });
}

function exportRouteEnabled(route){
    let routeCap = global.tech.currency >= 6 ? -1000000 : (global.tech.currency >= 4 ? -100 : -25);
    if (global.race['banana']){
        let exporting = false;
        Object.keys(global.resource).forEach(function(res){
            if (global.resource[res].hasOwnProperty('trade') && global.resource[res].trade < 0){
                exporting = res;
            }
        });
        if (exporting && exporting !== route){
            return false;
        }
        routeCap = global.tech.currency >= 6 ? -1000000 : (global.tech.currency >= 4 ? -25 : -10);
    }
    if (global.resource[route].trade <= routeCap){
        return false;
    }
    return true;
}

function importRouteEnabled(route){
    let routeCap = global.tech.currency >= 6 ? 1000000 : (global.tech.currency >= 4 ? 100 : 25);
    if (global.resource[route].trade >= routeCap){
        return false;
    }
    return true;
}

export function marketItem(mount,market_item,name,color,full){
    if (!shouldRenderResourceTab(0)){
        return;
    }

    if ((global.race['artifical'] || global.race['fasting']) && name === 'Food'){
        return;
    }

    if (full){
        market_item.append($(`<h3 class="res has-text-${color}">{{ r.name | namespace }}</h3>`));
    }

    if (!global.race['no_trade']){
        market_item.append($(`<span class="buy"><span class="has-text-success">${loc('resource_market_buy')}</span></span>`));
        market_item.append($(`<span role="button" class="order" @click="purchase('${name}')">\${{ r.value | buy }}</span>`));
        
        market_item.append($(`<span class="sell"><span class="has-text-danger">${loc('resource_market_sell')}</span></span>`));
        market_item.append($(`<span role="button" class="order" @click="sell('${name}')">\${{ r.value | sell }}</span>`));
    }

    if (full && ((global.race['banana'] && name === 'Food') || (global.tech['trade'] && !global.race['terrifying']))){
        let trade = $(`<span class="trade" v-show="m.active"><span class="has-text-warning">${loc('resource_market_routes')}</span></span>`);
        market_item.append(trade);
        trade.append($(`<b-tooltip :label="aSell('${name}')" position="is-bottom" size="is-small" multilined animated><span role="button" aria-label="export ${global.resource[name].name}" class="sub has-text-danger" @click="autoSell('${name}')"><span>-</span></span></b-tooltip>`));
        trade.append($(`<span class="current" v-html="$options.filters.trade(r.trade)"></span>`));
        trade.append($(`<b-tooltip :label="aBuy('${name}')" position="is-bottom" size="is-small" multilined animated><span role="button" aria-label="import ${global.resource[name].name}" class="add has-text-success" @click="autoBuy('${name}')"><span>+</span></span></b-tooltip>`));
        trade.append($(`<span role="button" class="zero has-text-advanced" @click="zero('${name}')">${loc('cancel_routes')}</span>`));
        tradeRouteColor(name);
    }
    
    vBind({
        el: mount,
        data: { 
            r: global.resource[name],
            m: global.city.market
        },
        methods: {
            aSell(res){
                let unit = tradeRatio[res] === 1 ? loc('resource_market_unit') : loc('resource_market_units');
                let price = tradeSellPrice(res);
                let rate = tradeRatio[res];
                if (global.stats.achieve.hasOwnProperty('trade')){
                    let rank = global.stats.achieve.trade.l;
                    if (rank > 5){ rank = 5; }
                    rate *= 1 - (rank / 100);
                }
                rate = +(rate).toFixed(3);
                return loc('resource_market_auto_sell_desc',[rate,unit,price]);
            },
            aBuy(res){
                let rate = tradeRatio[res];
                let dealVal = govActive('dealmaker',0);
                if (dealVal){
                    rate *= 1 + (dealVal / 100);
                }
                if (global.race['persuasive']){
                    rate *= 1 + (global.race['persuasive'] / 100);
                }
                if (astroSign === 'capricorn'){
                    rate *= 1 + (astroVal('capricorn')[0] / 100);
                }
                if (global.race['ocular_power'] && global.race['ocularPowerConfig'] && global.race.ocularPowerConfig.c){
                    let trade = 70 * (traits.ocular_power.vars()[1] / 100);
                    rate *= 1 + (trade / 100);
                }
                if (global.race['devious']){
                    rate *= 1 - (traits.devious.vars()[0] / 100);
                }
                if (global.race['merchant']){
                    rate *= 1 + (traits.merchant.vars()[1] / 100);
                }
                let fathom = fathomCheck('goblin');
                if (fathom > 0){
                    rate *= 1 + (traits.merchant.vars(1)[1] / 100 * fathom);
                }
                if (global.genes['trader']){
                    let mastery = calc_mastery();
                    rate *= 1 + (mastery / 100);
                }
                if (global.stats.achieve.hasOwnProperty('trade')){
                    let rank = global.stats.achieve.trade.l;
                    if (rank > 5){ rank = 5; }
                    rate *= 1 + (rank / 50);
                }
                if (global.race['truepath']){
                    rate *= 1 - (global.civic.foreign.gov3.hstl / 101);
                }
                rate = +(rate).toFixed(3);
                let unit = rate === 1 ? loc('resource_market_unit') : loc('resource_market_units');
                let price = tradeBuyPrice(res);
                return loc('resource_market_auto_buy_desc',[rate,unit,price]);
            },
            purchase(res){
                if (!global.race['no_trade'] && !global.settings.pause){
                    let qty = global.city.market.qty;
                    let value = global.resource[res].value;
                    if (global.race['arrogant']){
                        value *= 1 + (traits.arrogant.vars()[0] / 100);
                    }
                    if (global.race['conniving']){
                        value *= 1 - (traits.conniving.vars()[0] / 100);
                    }
                    let fathom = fathomCheck('imp');
                    if (fathom > 0){
                        value *= 1 - (traits.conniving.vars(1)[0] / 100 * fathom);
                    }
                    let amount = Math.floor(Math.min(qty, global.resource.Money.amount / value,
                      global.resource[res].max - global.resource[res].amount));
                    if (amount > 0){
                        global.resource[res].amount += amount;
                        global.resource.Money.amount -= Math.round(value * amount);

                        global.resource[res].value += Number((amount / Math.rand(1000,10000)).toFixed(2));
                    }
                }
            },
            sell(res){
                if (!global.race['no_trade'] && !global.settings.pause){
                    let qty = global.city.market.qty;
                    let divide = 4;
                    if (global.race['merchant']){
                        divide *= 1 - (traits.merchant.vars()[0] / 100);
                    }
                    let gobFathom = fathomCheck('goblin');
                    if (gobFathom > 0){
                        divide *= 1 - (traits.merchant.vars(1)[0] / 100 * gobFathom);
                    }
                    if (global.race['asymmetrical']){
                        divide *= 1 + (traits.asymmetrical.vars()[0] / 100);
                    }
                    if (global.race['conniving']){
                        divide *= 1 - (traits.conniving.vars()[1] / 100);
                    }
                    let impFathom = fathomCheck('imp');
                    if (impFathom > 0){
                        divide *= 1 - (traits.conniving.vars(1)[1] / 100 * impFathom);
                    }
                    let price = global.resource[res].value / divide;
                    let amount = Math.floor(Math.min(qty, global.resource[res].amount,
                      (global.resource.Money.max - global.resource.Money.amount) / price));
                    if (amount > 0) {
                        global.resource[res].amount -= amount;
                        global.resource.Money.amount += Math.round(price * amount);

                        global.resource[res].value -= Number((amount / Math.rand(1000,10000)).toFixed(2));
                        if (global.resource[res].value < Number(resource_values[res] / 2)){
                            global.resource[res].value = Number(resource_values[res] / 2);
                        }
                    }
                }
            },
            autoBuy(res, keyMult = keyMultiplier()){
                for (let i=0; i<keyMult; i++){
                    if (govActive('dealmaker',0)){
                        let exporting = 0;
                        let importing = 0;
                        Object.keys(global.resource).forEach(function(res){
                            if (global.resource[res].hasOwnProperty('trade') && global.resource[res].trade < 0){
                                exporting -= global.resource[res].trade;
                            }
                            if (global.resource[res].hasOwnProperty('trade') && global.resource[res].trade > 0){
                                importing += global.resource[res].trade;
                            }
                        });
                        if (exporting <= importing){
                            break;
                        }
                    }
                    if (global.resource[res].trade >= 0){
                        if (importRouteEnabled(res) && global.city.market.trade < global.city.market.mtrade){
                            global.city.market.trade++;
                            global.resource[res].trade++;
                        }
                        else {
                            break;
                        }
                    }
                    else {
                        global.city.market.trade--;
                        global.resource[res].trade++;
                    }
                }
                tradeRouteColor(res);
            },
            autoSell(res, keyMult = keyMultiplier()){
                for (let i=0; i<keyMult; i++){
                    if (global.resource[res].trade <= 0){
                        if (exportRouteEnabled(res) && global.city.market.trade < global.city.market.mtrade){
                            global.city.market.trade++;
                            global.resource[res].trade--;
                        }
                        else {
                            break;
                        }
                    }
                    else {
                        global.city.market.trade--;
                        global.resource[res].trade--;
                    }
                }
                tradeRouteColor(res);
            },
            zero(res){
                if (global.resource[res].trade > 0){
                    this.autoSell(res, global.resource[res].trade);
                }
                else if (global.resource[res].trade < 0){
                    this.autoBuy(res, -global.resource[res].trade);
                }
            }
        },
        filters: {
            buy(value){
                if (global.race['arrogant']){
                    value *= 1 + (traits.arrogant.vars()[0] / 100);
                }
                return sizeApproximation(value * global.city.market.qty,0);
            },
            sell(value){
                let divide = 4;
                if (global.race['merchant']){
                    divide *= 1 - (traits.merchant.vars()[0] / 100);
                }
                let fathom = fathomCheck('goblin');
                if (fathom > 0){
                    divide *= 1 - (traits.merchant.vars(1)[0] / 100 * fathom);
                }
                if (global.race['devious']){
                    divide *= 1 - (traits.devious.vars()[0] / 100);
                }
                if (global.race['asymmetrical']){
                    divide *= 1 + (traits.asymmetrical.vars()[0] / 100);
                }
                return sizeApproximation(value * global.city.market.qty / divide,0);
            },
            trade(val){
                if (name === 'Stone' && (val === 31 || val === -31)){
                    let trick = trickOrTreat(3,12,false);
                    if (trick.length > 0){
                        return trick;
                    }
                }
                if (val < 0){
                    val = 0 - val;
                    return `-${val}`;
                }
                else if (val > 0){
                    return `+${val}`;
                }
                else {
                    return 0;
                }
            },
            namespace(val){
                return val.replace("_", " ");
            }
        }
    });
}

function initGalaxyTrade(){
    if (!shouldRenderResourceTab(0)){
        return;
    }
    $('#market').append($(`<div id="galaxyTrade" v-show="t.xeno && t.xeno >= 5" class="market-header galaxyTrade"><h2 class="is-sr-only">${loc('galaxy_trade')}</h2></div>`));
    galacticTrade();
}

export function galaxyOffers(){
    let offers = [
        {
            buy: { res: 'Deuterium', vol: 5 },
            sell: { res: 'Helium_3', vol: 25 }
        },
        {
            buy: { res: 'Neutronium', vol: 2.5 },
            sell: { res: 'Copper', vol: 200 }
        },
        {
            buy: { res: 'Adamantite', vol: 3 },
            sell: { res: 'Iron', vol: 300 }
        },
        {
            buy: { res: 'Elerium', vol: 1 },
            sell: { res: 'Oil', vol: 125 }
        },
        {
            buy: { res: 'Nano_Tube', vol: 10 },
            sell: { res: 'Titanium', vol: 20 }
        },
        {
            buy: { res: 'Graphene', vol: 25 },
            sell: { res: global.race['kindling_kindred'] || global.race['smoldering'] ? (global.race['smoldering'] ? 'Chrysotile' : 'Stone') : 'Lumber', vol: 1000 }
        },
        {
            buy: { res: 'Stanene', vol: 40 },
            sell: { res: 'Aluminium', vol: 800 }
        },
        {
            buy: { res: 'Bolognium', vol: 0.75 },
            sell: { res: 'Uranium', vol: 4 }
        },
        {
            buy: { res: 'Vitreloy', vol: 1 },
            sell: { res: 'Infernite', vol: 1 }
        }
    ];
    return offers;
}

export function galacticTrade(modal){
    let galaxyTrade = modal ? modal : $(`#galaxyTrade`);
    if (!modal){
        clearElement($(`#galaxyTrade`));
    }

    if (global.galaxy['trade']){
        galaxyTrade.append($(`<div class="market-item trade-header"><span class="has-text-special">${loc('galaxy_trade')}</span></div>`));

        let offers = galaxyOffers();
        for (let i=0; i<offers.length; i++){
            let offer = $(`<div class="market-item trade-offer"></div>`);
            galaxyTrade.append(offer);

            offer.append($(`<span class="offer-item has-text-success">${global.resource[offers[i].buy.res].name}</span>`));
            offer.append($(`<span class="offer-vol has-text-advanced">+{{ '${i}' | t_vol }}/s</span>`));
            
            offer.append($(`<span class="offer-item has-text-danger">${global.resource[offers[i].sell.res].name}</span>`));
            offer.append($(`<span class="offer-vol has-text-caution">-{{ '${i}' | s_vol }}/s</span>`));

            let trade = $(`<span class="trade"><span class="has-text-warning">${loc('resource_market_routes')}</span></span>`);
            offer.append(trade);
            
            let assign = loc('galaxy_freighter_assign',[global.resource[offers[i].buy.res].name,global.resource[offers[i].sell.res].name]);
            let unassign = loc('galaxy_freighter_unassign',[global.resource[offers[i].buy.res].name,global.resource[offers[i].sell.res].name]);
            trade.append($(`<b-tooltip :label="desc('${unassign}')" position="is-bottom" size="is-small" multilined animated><span role="button" aria-label="${unassign}" class="sub has-text-danger" @click="less('${i}')"><span>-</span></span></b-tooltip>`));
            trade.append($(`<span class="current">{{ g.f${i} }}</span>`));
            trade.append($(`<b-tooltip :label="desc('${assign}')" position="is-bottom" size="is-small" multilined animated><span role="button" aria-label="${assign}" class="add has-text-success" @click="more('${i}')"><span>+</span></span></b-tooltip>`));
            trade.append($(`<span role="button" class="zero has-text-advanced" @click="zero('${i}')">${loc('cancel_routes')}</span>`));
        }

        let totals = $(`<div class="market-item trade-offer"><div id="galacticTradeTotal"><span class="tradeTotal"><span class="has-text-caution">${loc('resource_market_galactic_trade_routes')}</span> {{ g.cur }} / {{ g.max }}</span></div></div>`);
        totals.append($(`<span role="button" class="zero has-text-advanced" @click="zero()">${loc('cancel_all_routes')}</span>`));
        galaxyTrade.append(totals);
    }

    vBind({
        el: modal ? '#specialModal' : '#galaxyTrade',
        data: {
            g: global.galaxy.trade,
            t: global.tech
        },
        methods: {
            less(idx){
                let keyMutipler = keyMultiplier();
                if (global.galaxy.trade[`f${idx}`] >= keyMutipler){
                    global.galaxy.trade[`f${idx}`] -= keyMutipler;
                    global.galaxy.trade.cur -= keyMutipler;
                }
                else {
                    global.galaxy.trade.cur -= global.galaxy.trade[`f${idx}`];
                    global.galaxy.trade[`f${idx}`] = 0;
                }
            },
            more(idx){
                let keyMutipler = keyMultiplier();
                if (global.galaxy.trade.cur < global.galaxy.trade.max){
                    if (keyMutipler > global.galaxy.trade.max - global.galaxy.trade.cur){
                        keyMutipler = global.galaxy.trade.max - global.galaxy.trade.cur;
                    }
                    global.galaxy.trade[`f${idx}`] += keyMutipler;
                    global.galaxy.trade.cur += keyMutipler;
                }
            },
            zero(idx){
                if (idx){
                    global.galaxy.trade.cur -= global.galaxy.trade[`f${idx}`];
                    global.galaxy.trade[`f${idx}`] = 0;
                }
                else {
                    let offers = galaxyOffers();
                    for (let i=0; i<offers.length; i++){
                        global.galaxy.trade.cur -= global.galaxy.trade[`f${i}`];
                        global.galaxy.trade[`f${i}`] = 0;
                    }
                }
            },
            desc(s){
                return s; 
            }
        },
        filters: {
            t_vol(idx){
                let offers = galaxyOffers();
                let buy_vol = offers[idx].buy.vol;
                if (global.race['persuasive']){
                    buy_vol *= 1 + (global.race['persuasive'] / 100);
                }
                if (global.race['devious']){
                    buy_vol *= 1 - (traits.devious.vars()[0] / 100);
                }
                if (global.race['merchant']){
                    buy_vol *= 1 + (traits.merchant.vars()[1] / 100);
                }
                let fathom = fathomCheck('goblin');
                if (fathom > 0){
                    buy_vol *= 1 + (traits.merchant.vars(1)[1] / 100 * fathom);
                }
                if (global.genes['trader']){
                    let mastery = calc_mastery();
                    buy_vol *= 1 + (mastery / 100);
                }
                if (global.stats.achieve.hasOwnProperty('trade')){
                    let rank = global.stats.achieve.trade.l;
                    if (rank > 5){ rank = 5; }
                    buy_vol *= 1 + (rank / 50);
                }
                buy_vol = +(buy_vol).toFixed(2);
                return buy_vol;
            },
            s_vol(idx){
                let offers = galaxyOffers();
                let sell_vol = offers[idx].sell.vol;
                if (global.stats.achieve.hasOwnProperty('trade')){
                    let rank = global.stats.achieve.trade.l;
                    if (rank > 5){ rank = 5; }
                    sell_vol *= 1 - (rank / 100);
                }
                sell_vol = +(sell_vol).toFixed(2);
                return sell_vol;
            }
        }
    });

    popover(`galacticTradeTotal`,function(){
        let bd = $(`<div class="resBreakdown"></div>`);
        if (breakdown.hasOwnProperty('gt_route')){
            Object.keys(breakdown.gt_route).forEach(function(k){
                if (breakdown.gt_route[k] > 0){
                    bd.append(`<div class="modal_bd"><span class="has-text-warning">${k}</span> <span>+${breakdown.gt_route[k]}</span></div>`);
                }
            });
        }
        bd.append(`<div class="modal_bd ${global.galaxy.trade.max > 0 ? 'sum' : ''}"><span class="has-text-caution">${loc('resource_market_galactic_trade_routes')}</span> <span>${global.galaxy.trade.max}</span></div>`);
        return bd;
    },{
        elm: `#galacticTradeTotal > span`
    });
}

function unassignCrate(res){
    let keyMutipler = keyMultiplier();
    let cap = crateValue();
    if (keyMutipler > global.resource[res].crates){
        keyMutipler = global.resource[res].crates;
    }
    if (keyMutipler > 0){
        global.resource.Crates.amount += keyMutipler;
        global.resource.Crates.max += keyMutipler;
        global.resource[res].crates -= keyMutipler;
        global.resource[res].max -= (cap * keyMutipler);
    }
}

function assignCrate(res){
    let keyMutipler = keyMultiplier();
    let cap = crateValue();
    if (keyMutipler > global.resource.Crates.amount){
        keyMutipler = global.resource.Crates.amount;
    }
    if (keyMutipler > 0){
        global.resource.Crates.amount -= keyMutipler;
        global.resource.Crates.max -= keyMutipler;
        global.resource[res].crates += keyMutipler;
        global.resource[res].max += (cap * keyMutipler);
    }
}

function unassignContainer(res){
    let keyMutipler = keyMultiplier();
    let cap = containerValue();
    if (keyMutipler > global.resource[res].containers){
        keyMutipler = global.resource[res].containers;
    }
    if (keyMutipler > 0){
        global.resource.Containers.amount += keyMutipler;
        global.resource.Containers.max += keyMutipler;
        global.resource[res].containers -= keyMutipler;
        global.resource[res].max -= (cap * keyMutipler);
    }
}

function assignContainer(res){
    let keyMutipler = keyMultiplier();
    let cap = containerValue();
    if (keyMutipler > global.resource.Containers.amount){
        keyMutipler = global.resource.Containers.amount;
    }
    if (keyMutipler > 0){
        global.resource.Containers.amount -= keyMutipler;
        global.resource.Containers.max -= keyMutipler;
        global.resource[res].containers += keyMutipler;
        global.resource[res].max += (cap * keyMutipler);
    }
}

export function containerItem(mount,market_item,name,color){
    if (!shouldRenderResourceTab(1)){
        return;
    }

    market_item.append($(`<h3 class="res has-text-${color}">{{ name }}</h3>`));

    if (global.resource.Crates.display){
        let crate = $(`<span class="trade"><span class="has-text-warning">${global.resource.Crates.name}</span></span>`);
        market_item.append(crate);

        crate.append($(`<span role="button" aria-label="remove ${global.resource[name].name} ${global.resource.Crates.name}" class="sub has-text-danger" @click="subCrate('${name}')"><span>&laquo;</span></span>`));
        crate.append($(`<span class="current" v-html="$options.filters.cCnt(crates,'${name}')"></span>`));
        crate.append($(`<span role="button" aria-label="add ${global.resource[name].name} ${global.resource.Crates.name}" class="add has-text-success" @click="addCrate('${name}')"><span>&raquo;</span></span>`));
    }

    if (global.resource.Containers.display){
        let container = $(`<span class="trade"><span class="has-text-warning">${global.resource.Containers.name}</span></span>`);
        market_item.append(container);

        container.append($(`<span role="button" aria-label="remove ${global.resource[name].name} ${global.resource.Containers.name}" class="sub has-text-danger" @click="subCon('${name}')"><span>&laquo;</span></span>`));
        container.append($(`<span class="current" v-html="$options.filters.trick(containers)"></span>`));
        container.append($(`<span role="button" aria-label="add ${global.resource[name].name} ${global.resource.Containers.name}" class="add has-text-success" @click="addCon('${name}')"><span>&raquo;</span></span>`));
    }

    vBind({
        el: mount,
        data: global.resource[name],
        methods: {
            addCrate(res){
                assignCrate(res);
            },
            subCrate(res){
                unassignCrate(res);
            },
            addCon(res){
                assignContainer(res);
            },
            subCon(res){
                unassignContainer(res);
            }
        },
        filters: {
            trick(v){
                if (name === 'Stone' && global.resource[name].crates === 10 && global.resource[name].containers === 31){
                    let trick = trickOrTreat(4,13,true);
                    if (trick.length > 0){
                        return trick;
                    }
                }
                return v;
            },
            cCnt(ct,res){
                if ((res === 'Food' && !global.race['artifical']) || (global.race['artifical'] && res === 'Coal') || res === 'Souls'){
                    let egg = easterEgg(13,10);
                    if (ct === 10 && egg.length > 0){
                        return '1'+egg;
                    }
                }
                return ct;
            }
        }
    });
}

export function tradeSellPrice(res){
    let divide = 4;
    if (global.race['merchant']){
        divide *= 1 - (traits.merchant.vars()[0] / 100);
    }
    let fathom = fathomCheck('goblin');
    if (fathom > 0){
        divide *= 1 - (traits.merchant.vars(1)[0] / 100 * fathom);
    }
    if (global.race['asymmetrical']){
        divide *= 1 + (traits.asymmetrical.vars()[0] / 100);
    }
    if (global.race['devious']){
        divide *= 1 + (traits.devious.vars()[0] / 100);
    }
    if (global.race['conniving']){
        divide--;
    }
    let price = global.resource[res].value * tradeRatio[res] / divide;
    if (global.city['wharf']){
        price = price * (1 + (global.city['wharf'].count * 0.01));
    }
    if (global.space['gps'] && global.space['gps'].count > 3){
        price = price * (1 + (global.space['gps'].count * 0.01));
    }
    if (global.tech['railway']){
        let boost = global.stats.achieve['banana'] && global.stats.achieve.banana.l >= 1 ? 0.03 : 0.02;
        price = price * (1 + (global.tech['railway'] * boost));
    }
    if (global.race['truepath'] && !global.race['lone_survivor']){
        price *= 1 - (global.civic.foreign.gov3.hstl / 101);
    }
    if (global.race['inflation']){
        price *= 1 + (global.race.inflation / 500);
    }
    if (global.race['witch_hunter'] && global.resource.Sus.amount > 50){
        let wariness = (global.resource.Sus.amount - 50) / 52;
        price *= 1 - wariness;
    }
    price *= production('psychic_cash');
    price = +(price).toFixed(1);
    return price;
}

export function tradeBuyPrice(res){
    let rate = global.resource[res].value;
    if (global.race['arrogant']){
        rate *= 1 + (traits.arrogant.vars()[0] / 100);
    }
    if (global.race['conniving']){
        rate *= 1 - (traits.conniving.vars()[0] / 100);
    }
    let impFathom = fathomCheck('imp');
    if (impFathom > 0){
        rate *= 1 - (traits.conniving.vars(1)[0] / 100 * impFathom);
    }
    let price = rate * tradeRatio[res];
    if (global.city['wharf']){
        price = price * (0.99 ** global.city['wharf'].count);
    }
    if (global.space['gps'] && global.space['gps'].count > 3){
        price = price * (0.99 ** global.space['gps'].count);
    }
    if (global.tech['railway']){
        let boost = global.stats.achieve['banana'] && global.stats.achieve.banana.l >= 1 ? 0.97 : 0.98;
        price = price * (boost ** global.tech['railway']);
    }
    if (global.race['truepath'] && !global.race['lone_survivor']){
        price *= 1 + (global.civic.foreign.gov3.hstl / 101);
    }
    if (global.race['inflation']){
        price *= 1 + (global.race.inflation / 300);
    }
    if (global.race['quarantine']){
        price *= 1 + Math.round(global.race.quarantine ** 3.5);
    }
    if (global.race['witch_hunter'] && global.resource.Sus.amount > 50){
        let wariness = (global.resource.Sus.amount - 50) / 8;
        price *= 1 + wariness;
    }
    price = +(price).toFixed(1);
    return price;
}

export function craftingPopover(id,res,type,extra){
    popover(`${id}`,function(){
        let bd = $(`<div class="resBreakdown"><div class="has-text-info">{{ res.name | namespace }}</div></div>`);
        let table = $(`<div class="parent"></div>`);
        bd.append(table);
        
        let craft_total = craftingRatio(res,type);

        let col1 = $(`<div></div>`);
        table.append(col1);
        if (type === 'auto' && breakdown.p[res]){
            Object.keys(breakdown.p[res]).forEach(function (mod){
                let raw = breakdown.p[res][mod];
                let val = parseFloat(raw.slice(0,-1));
                if (val != 0 && !isNaN(val)){
                    let type = val > 0 ? 'success' : 'danger';
                    let label = mod.replace(/\+.+$/,"");
                    mod = mod.replace(/'/g, "\\'");
                    col1.append(`<div class="modal_bd"><span>${label}</span><span class="has-text-${type}">{{ ${[res]}['${mod}'] | translate }}</span></div>`);
                }
            });
        }
        Object.keys(craft_total.multi_bd).forEach(function (mod){
            let raw = craft_total.multi_bd[mod];
            let val = parseFloat(raw.slice(0,-1));
            if (val != 0 && !isNaN(val)){
                let type = val > 0 ? 'success' : 'danger';
                let label = mod.replace(/\+.+$/,"");
                mod = mod.replace(/'/g, "\\'");
                col1.append(`<div class="modal_bd"><span>${label}</span><span class="has-text-${type}">{{ craft.multi_bd['${mod}'] | translate }}</span></div>`);
            }
        });
        
        let col2 = $(`<div class="col"></div>`);
        let title = $(`<div class="has-text-info">${loc(`craft_tools_multi`)}</div>`);
        col2.append(title);
        let count = 0;
        Object.keys(craft_total.add_bd).forEach(function (mod){
            let raw = craft_total.add_bd[mod];
            let val = parseFloat(raw.slice(0,-1));
            if (val != 0 && !isNaN(val)){
                count++;
                let type = val > 0 ? 'success' : 'danger';
                let label = mod.replace(/\+.+$/,"");
                mod = mod.replace(/'/g, "\\'");
                col2.append(`<div class="modal_bd"><span>${label}</span><span class="has-text-${type}">{{ craft.add_bd['${mod}'] | translate }}</span></div>`);
            }
        });
        if (count > 0){
            table.append(col2);
        }

        if (breakdown.p.consume && breakdown.p.consume[res]){
            let col3 = $(`<div class="col"></div>`);
            let count = 0;
            Object.keys(breakdown.p.consume[res]).forEach(function (mod){                
                let val = breakdown.p.consume[res][mod];
                if (val != 0 && !isNaN(val)){
                    count++;
                    let type = val > 0 ? 'success' : 'danger';
                    let label = mod.replace(/\+.+$/,"");
                    mod = mod.replace(/'/g, "\\'");
                    col3.append(`<div class="modal_bd"><span>${label}</span><span class="has-text-${type}">{{ consume.${res}['${mod}'] | fix | translate }}</span></div>`);
                }
            });
            if (count > 0){
                table.append(col3);
            }
        }
        
        if (global['resource'][res].diff < 0 && global['resource'][res].amount > 0){
            bd.append(`<div class="modal_bd sum"><span>${loc('to_empty')}</span><span class="has-text-danger">{{ res.amount | counter }}</span></div>`);
        }
        
        if (extra){
            bd.append(`<div class="modal_bd sum"></div>`);
            bd.append(extra);
        }
        return bd;
    },{
        in: function(){
            vBind({
                el: `#popper > div`,
                data: {
                    [res]: breakdown.p[res],
                    res: global['resource'][res],
                    'consume': breakdown.p['consume'],
                    craft: craftingRatio(res,type)
                }, 
                filters: {
                    translate(raw){
                        let type = raw[raw.length -1];
                        let val = parseFloat(raw.slice(0,-1));
                        let precision = (val > 0 && val < 1) || (val < 0 && val > -1) ? 4 
                            : ((val > 0 && val < 10) || (val < 0 && val > -10) ? 3 : 2);
                        val = +(val).toFixed(precision);
                        let suffix = type === '%' ? '%' : '';
                        if (val > 0){
                            return '+' + sizeApproximation(val,precision) + suffix;
                        }
                        else if (val < 0){
                            return sizeApproximation(val,precision) + suffix;
                        }
                    },
                    fix(val){
                        return val + 'v';
                    },
                    counter(val){
                        let rate = -global['resource'][res].diff;
                        let time = +(val / rate).toFixed(0);
                        
                        if (time > 60){
                            let secs = time % 60;
                            let mins = (time - secs) / 60;
                            if (mins >= 60){
                                let r = mins % 60;
                                let hours = (mins - r) / 60;
                                return `${hours}h ${r}m`;
                            }
                            else {
                                return `${mins}m ${secs}s`;
                            }
                        }
                        else {
                            return `${time}s`;
                        }
                    },
                    namespace(name){
                        return name.replace("_"," ");
                    }
                }
            });
        },
        out: function(){
            vBind({el: `#popper > div`},'destroy');
        },
        classes: `breakdown has-background-light has-text-dark`,
        prop: {
            modifiers: {
                preventOverflow: { enabled: false },
                hide: { enabled: false }
            }
        }
    });
}

export function breakdownPopover(id,name,type){
    popover(`${id}`,function(){
        let bd = $(`<div class="resBreakdown"><div class="has-text-info">{{ res.name | namespace }}</div></div>`);
        if(type === 'p' && name === global.race.species){
            bd = $(`<div class="resBreakdown"><div class="has-text-info">${loc('starvation_resist')}</div></div>`);
        }
        let table = $(`<div class="parent"></div>`);
        bd.append(table);
        let prevCol = false;
        
        if (breakdown[type][name] && !(global.race.species === name && type === 'p')){
            let col1 = $(`<div></div>`);
            table.append(col1);
            let types = [name];
            types.push('Global');
            for (var i = 0; i < types.length; i++){
                let t = types[i];
                if (breakdown[type][t]){
                    Object.keys(breakdown[type][t]).forEach(function (mod){
                        let raw = breakdown[type][t][mod];
                        let val = parseFloat(raw.slice(0,-1));
                        if (val != 0 && !isNaN(val)){
                            prevCol = true;
                            let type = val > 0 ? 'success' : 'danger';
                            let label = mod.replace(/\+.+$/,"");
                            mod = mod.replace(/'/g, "\\'");
                            col1.append(`<div class="modal_bd"><span>${label}</span><span class="has-text-${type}">{{ ${t}['${mod}'] | translate }}</span></div>`);
                        }
                    });
                }
            }
        }

        if (breakdown[type].consume && breakdown[type].consume[name]){
            let col2 = $(`<div class="${prevCol ? 'col' : ''}"></div>`);
            let count = 0;
            Object.keys(breakdown[type].consume[name]).forEach(function (mod){                
                let val = breakdown[type].consume[name][mod];
                if (val != 0 && !isNaN(val)){
                    count++;
                    let type = val > 0 ? 'success' : 'danger';
                    let label = mod.replace(/\+.+$/,"");
                    mod = mod.replace(/'/g, "\\'");
                    col2.append(`<div class="modal_bd"><span>${label}</span><span class="has-text-${type}">{{ consume.${name}['${mod}'] | fix | translate }}</span></div>`);
                }
            });
            if (count > 0){
                table.append(col2);
            }
        }

        if (type === 'p' && name !== global.race.species){
            let dir = global['resource'][name].diff > 0 ? 'success' : 'danger';
            bd.append(`<div class="modal_bd sum"><span>{{ res.diff | direction }}</span><span class="has-text-${dir}">{{ res.amount | counter }}</span></div>`);
        }

        return bd;
    },{
        in: function(){
            vBind({
                el: `#popper > div`,
                data: {
                    'Global': breakdown[type]['Global'],
                    [name]: breakdown[type][name],
                    'consume': breakdown[type]['consume'],
                    res: global['resource'][name]
                }, 
                filters: {
                    translate(raw){
                        let type = raw[raw.length -1];
                        let val = parseFloat(raw.slice(0,-1));
                        let precision = (val > 0 && val < 1) || (val < 0 && val > -1) ? 4 
                            : ((val > 0 && val < 10) || (val < 0 && val > -10) ? 3 : 2);
                        let suffix = type === '%' ? '%' : '';
                        if (val > 0){
                            return '+' + sizeApproximation(val,precision) + suffix;
                        }
                        else if (val < 0){
                            return sizeApproximation(val,precision) + suffix;
                        }
                    },
                    fix(val){
                        return val + 'v';
                    },
                    counter(val){
                        let rate = global['resource'][name].diff;
                        let time = 0;
                        if (rate < 0){
                            rate *= -1;
                            time = +(val / rate).toFixed(0);
                        }
                        else {
                            let gap = global['resource'][name].max - val;
                            time = +(gap / rate).toFixed(0);
                        }
    
                        if (time === Infinity || Number.isNaN(time)){
                            return 'Never';
                        }
                        
                        if (time > 60){
                            let secs = time % 60;
                            let mins = (time - secs) / 60;
                            if (mins >= 60){
                                let r = mins % 60;
                                let hours = (mins - r) / 60;
                                return `${hours}h ${r}m`;
                            }
                            else {
                                return `${mins}m ${secs}s`;
                            }
                        }
                        else {
                            return `${time}s`;
                        }
                    },
                    direction(val){
                        return val >= 0 ? loc('to_full') : loc('to_empty');
                    },
                    namespace(name){
                        return name.replace("_"," ");
                    }
                }
            });
        },
        out: function(){
            vBind({el: `#popper > div`},'destroy');
        },
        classes: `breakdown has-background-light has-text-dark`,
        prop: {
            modifiers: {
                preventOverflow: { enabled: false },
                hide: { enabled: false }
            }
        }
    });
}

function loadRouteCounter(){
    if (!shouldRenderResourceTab(0)){
        return;
    }

    let no_market = global.race['no_trade'] ? ' nt' : '';
    var market_item = $(`<div id="tradeTotal" v-show="active" class="market-item"><div id="tradeTotalPopover"><span class="tradeTotal${no_market}"><span class="has-text-caution">${loc('resource_market_trade_routes')}</span> <span v-html="$options.filters.tdeCnt(trade)"></span> / {{ mtrade }}</span></div></div>`);
    market_item.append($(`<span role="button" class="zero has-text-advanced" @click="zero()">${loc('cancel_all_routes')}</span>`));
    $('#market').append(market_item);
    vBind({
        el: '#tradeTotal',
        data: global.city.market,
        methods: {
            zero(){
                Object.keys(global.resource).forEach(function(res){
                    if (global.resource[res]['trade']){
                        global.city.market.trade -= Math.abs(global.resource[res].trade);
                        global.resource[res].trade = 0;
                        tradeRouteColor(res);
                    }
                });
            }
        },
        filters: {
            tdeCnt(ct){
                let egg17 = easterEgg(17,11);
                if (((ct === 100 && !global.tech['isolation'] && !global.race['cataclysm']) || (ct === 10 && (global.tech['isolation'] || global.race['cataclysm']))) && egg17.length > 0){
                    return '10'+egg17;
                }
                return ct;
            }
        }
    });

    popover(`tradeTotalPopover`,function(){
        let bd = $(`<div class="resBreakdown"></div>`);
        if (breakdown.hasOwnProperty('t_route')){
            Object.keys(breakdown.t_route).forEach(function(k){
                if (breakdown.t_route[k] > 0){
                    bd.append(`<div class="modal_bd"><span class="has-text-warning">${k}</span> <span>+${breakdown.t_route[k]}</span></div>`);
                }
            });
        }
        bd.append(`<div class="modal_bd ${global.city.market.mtrade > 0 ? 'sum' : ''}"><span class="has-text-caution">${loc('resource_market_trade_routes')}</span> <span>${global.city.market.mtrade}</span></div>`);
        return bd;
    },{
        elm: `#tradeTotalPopover > span`
    });
}

function loadContainerCounter(){
    if (!shouldRenderResourceTab(1)){
        return;
    }

    var market_item = $(`<div id="crateTotal" class="market-item"><span v-show="cr.display" class="crtTotal"><span class="has-text-warning">${global.resource.Crates.name}</span><span>{{ cr.amount }} / {{ cr.max }}</span></span><span v-show="cn.display" class="cntTotal"><span class="has-text-warning">${global.resource.Containers.name}</span><span>{{ cn.amount }} / {{ cn.max }}</span></span></div>`);
    $('#resStorage').append(market_item);

    vBind({
        el: '#crateTotal',
        data: {
            cr: global.resource.Crates,
            cn: global.resource.Containers
        }
    });
}

function tradeRouteColor(res){
    $(`#market-${res} .trade .current`).removeClass('has-text-warning');
    $(`#market-${res} .trade .current`).removeClass('has-text-danger');
    $(`#market-${res} .trade .current`).removeClass('has-text-success');
    if (global.resource[res].trade > 0){
        $(`#market-${res} .trade .current`).addClass('has-text-success');
    }
    else if (global.resource[res].trade < 0){
        $(`#market-${res} .trade .current`).addClass('has-text-danger');
    }
    else {
        $(`#market-${res} .trade .current`).addClass('has-text-warning');
    }
}

function buildCrateLabel(){
    let material = global.race['kindling_kindred'] || global.race['smoldering'] ? (global.race['smoldering'] ? global.resource.Chrysotile.name : global.resource.Stone.name) : (global.resource['Plywood'] ? global.resource.Plywood.name : global.resource.Plywood.name);
    if (global.race['iron_wood']){ material = global.resource.Lumber.name; }
    let cost = global.race['kindling_kindred'] || global.race['smoldering'] || global.race['iron_wood'] ? 200 : 10
    return loc('resource_modal_crate_construct_desc',[cost,material,crateValue()]);
}

function buildContainerLabel(){
    return loc('resource_modal_container_construct_desc',[125,containerValue()]);
}

export function crateGovHook(type,num){
    switch (type){
        case 'crate':
            buildCrate(num);
            break;
        case 'container':
            buildContainer(num);
            break;
    }
}

function buildCrate(num){
    let keyMutipler = num || keyMultiplier();
    let material = global.race['kindling_kindred'] || global.race['smoldering'] ? (global.race['smoldering'] ? 'Chrysotile' : 'Stone') : 'Plywood';
    if (global.race['iron_wood']){ material = 'Lumber'; }
    let cost = global.race['kindling_kindred'] || global.race['smoldering'] || global.race['iron_wood'] ? 200 : 10;
    if (keyMutipler + global.resource.Crates.amount > global.resource.Crates.max){
        keyMutipler = global.resource.Crates.max - global.resource.Crates.amount;
    }
    if (global.resource[material].amount < cost * keyMutipler){
        keyMutipler = Math.floor(global.resource[material].amount / cost);
    }
    if (global.resource[material].amount >= (cost * keyMutipler) && global.resource.Crates.amount < global.resource.Crates.max){
        modRes(material, -(cost * keyMutipler), true);
        global.resource.Crates.amount += keyMutipler;
    }
}

function buildContainer(num){
    let keyMutipler = num || keyMultiplier();
    if (keyMutipler + global.resource.Containers.amount > global.resource.Containers.max){
        keyMutipler = global.resource.Containers.max - global.resource.Containers.amount;
    }
    if (global.resource['Steel'].amount < 125 * keyMutipler){
        keyMutipler = Math.floor(global.resource['Steel'].amount / 125);
    }
    if (global.resource['Steel'].amount >= (125 * keyMutipler) && global.resource.Containers.amount < global.resource.Containers.max){
        modRes('Steel', -(125 * keyMutipler), true);
        global.resource.Containers.amount += keyMutipler;
    }
}

function drawModal(name){
    $('#modalBox').append($('<p id="modalBoxTitle" class="has-text-warning modalTitle">{{ name }} - {{ amount | size }}/{{ max | size }}</p>'));
    
    let body = $('<div class="modalBody crateModal"></div>');
    $('#modalBox').append(body);

    if ((name === 'Food' && !global.race['artifical']) || (global.race['artifical'] && name === 'Coal') || name === 'Souls'){
        let egg = easterEgg(7,10);
        if (egg.length > 0){
            $('#modalBoxTitle').prepend(egg);
        }
    }

    if (name === 'Stone'){
        let trick = trickOrTreat(1,12,false);
        if (trick.length > 0){
            $('#modalBoxTitle').prepend(trick);
        }
    }
    
    let crates = $('<div id="modalCrates" class="crates"></div>');
    body.append(crates);
    
    crates.append($(`<div class="crateHead"><span>${loc('resource_modal_crate_owned')} {{ crates.amount }}/{{ crates.max }}</span><span>${loc('resource_modal_crate_assigned')} {{ res.crates }}</span></div>`));
    
    let buildCr = $(`<button class="button construct" @click="buildCrate()">${loc('resource_modal_crate_construct')}</button>`);
    let removeCr = $(`<button class="button unassign" @click="subCrate('${name}')">${loc('resource_modal_crate_unassign')}</button>`);
    let addCr = $(`<button class="button assign" @click="addCrate('${name}')">${loc('resource_modal_crate_assign')}</button>`);
    
    crates.append(buildCr);
    crates.append(removeCr);
    crates.append(addCr);
    
    vBind({
        el: `#modalCrates`,
        data: { 
            crates: global['resource']['Crates'],
            res: global['resource'][name],
        },
        methods: {
            buildCrate(){
                buildCrate();
            },
            subCrate(res){
                unassignCrate(res);
            },
            addCrate(res){
                assignCrate(res);
            }
        }
    });
    
    if (global.resource.Containers.display){
        let containers = $('<div id="modalContainers" class="crates divide"></div>');
        body.append(containers);
        
        containers.append($(`<div class="crateHead"><span>${loc('resource_modal_container_owned')} {{ containers.amount }}/{{ containers.max }}</span><span>${loc('resource_modal_container_assigned')} {{ res.containers }}</span></div>`));

        let buildCon = $(`<button class="button construct" @click="buildContainer()">${loc('resource_modal_container_construct')}</button>`);
        let removeCon = $(`<button class="button unassign" @click="removeContainer('${name}')">${loc('resource_modal_container_unassign')}</button>`);
        let addCon = $(`<button class="button assign" @click="addContainer('${name}')">${loc('resource_modal_container_assign')}</button>`);
        
        containers.append(buildCon);
        containers.append(removeCon);
        containers.append(addCon);
        
        vBind({
            el: `#modalContainers`,
            data: { 
                containers: global['resource']['Containers'],
                res: global['resource'][name],
            },
            methods: {
                buildContainer(){
                    buildContainer();
                },
                removeContainer(res){
                    unassignContainer(res);
                },
                addContainer(res){
                    assignContainer(res);
                }
            }
        });
    }

    vBind({
        el: `#modalBoxTitle`,
        data: global['resource'][name], 
        filters: {
            size: function (value){
                return sizeApproximation(value,0);
            },
            diffSize: function (value){
                return sizeApproximation(value,2);
            }
        }
    });

    function tooltip(type,subtype){
        if (type === 'modalContainers'){
            let cap = containerValue();
            switch (subtype){
                case 'assign':
                    return loc('resource_modal_container_assign_desc',[cap]);
                case 'unassign':
                    return loc('resource_modal_container_unassign_desc',[cap]);
                case 'construct':
                    return buildContainerLabel();
            }
        }
        else {
            let cap = crateValue();
            switch (subtype){
                case 'assign':
                    return loc('resource_modal_crate_assign_desc',[cap]);
                case 'unassign':
                    return loc('resource_modal_crate_unassign_desc',[cap]);
                case 'construct':
                    return buildCrateLabel();
            }
        }
    }

    ['modalCrates','modalContainers'].forEach(function(type){
        ['assign','unassign','construct'].forEach(function(subtype){
            popover(`${type}${subtype}`,tooltip(type,subtype), {
                elm: $(`#${type} > .${subtype}`),
                attach: '#main',
            });
        });
    });
}

function unlockStorage(){
    // If this is the first resource subtab to unlock, then mark it as the visible subtab
    if (!global.settings.showResources) {
        global.settings.marketTabs = 1;
    }

    // Enable display for resource tab and storage subtab
    global.settings.showResources = true;
    global.settings.showStorage = true;

    // Possibly draw or redraw the storage subtab
    drawResourceTab('storage');

    // Redraw the governor, who has actions to build and manage storage
    defineGovernor();
}

// Crates are always initially unlocked by the Freight Yard building.
// Other buildings that provide crates do not need to call this function.
export function unlockCrates(){
    if (!global.resource.Crates.display){
        // Message about unlocking crates for the first time
        messageQueue(loc('city_storage_yard_msg'),'info',false,['progress']);

        // Enable display for crates
        global.resource.Crates.display = true;

        // Unlock the storage tab
        unlockStorage();
    }
}

// Containers are optional to clear the game, so every building that provides Containers might be the very first one.
// All buildings that provide containers, not just the Container Port, should call this function.
export function unlockContainers(){
    if (!global.resource.Containers.display){
        // Message about unlocking containers for the first time
        messageQueue(loc('city_warehouse_msg'),'info',false,['progress']);

        // Enable display for containers
        global.resource.Containers.display = true;

        // Unlock the storage tab
        unlockStorage();
    }
}

export function crateValue(){
    let create_value = global.tech['container'] && global.tech['container'] >= 2 ? 500 : 350;
    if (global.tech['container'] && global.tech['container'] >= 4){
        create_value += global.tech['container'] >= 5 ? 500 : 250;
    }
    if (global.tech['container'] && global.tech['container'] >= 6){
        create_value += global.tech['container'] >= 7 ? 1200 : 500;
    }
    if (global.tech['container'] && global.tech['container'] >= 8){
        create_value += global.tech['container'] >= 9 ? 7800 : 4000;
    }
    if (global.race['pack_rat']){
        create_value *= 1 + (traits.pack_rat.vars()[0] / 100);
    }
    let fathom = fathomCheck('kobold');
    if (fathom > 0){
        create_value *= 1 + (traits.pack_rat.vars(1)[0] / 100 * fathom);
    }
    if (global.stats.achieve['banana'] && global.stats.achieve.banana.l >= 3){
        create_value *= 1.1;
    }
    create_value *= global.stats.achieve['blackhole'] ? 1 + (global.stats.achieve.blackhole.l * 0.05) : 1;
    return Math.round(spatialReasoning(create_value));
}

export function containerValue(){
    let container_value = global.tech['steel_container'] && global.tech['steel_container'] >= 3 ? 1200 : 800;
    if (global.tech['steel_container'] && global.tech['steel_container'] >= 4){
        container_value += global.tech['steel_container'] >= 5 ? 1000 : 400;
    }
    if (global.tech['steel_container'] && global.tech['steel_container'] >= 6){
        container_value += global.tech['steel_container'] >= 7 ? 7500 : 1000;
    }
    if (global.tech['steel_container'] && global.tech['steel_container'] >= 8){
        container_value += global.tech['steel_container'] >= 9 ? 15300 : 8000;
    }
    if (global.race['pack_rat']){
        container_value *= 1 + (traits.pack_rat.vars()[0] / 100);
    }
    let fathom = fathomCheck('kobold');
    if (fathom > 0){
        container_value *= 1 + (traits.pack_rat.vars(1)[0] / 100 * fathom);
    }
    container_value *= global.stats.achieve['blackhole'] ? 1 + (global.stats.achieve.blackhole.l * 0.05) : 1;
    return Math.round(spatialReasoning(container_value));
}

function initMarket(){
    if (!shouldRenderResourceTab(0)){
        return;
    }
    let market = $(`<div id="market-qty" class="market-header"><h2 class="is-sr-only">${loc('resource_market')}</h2></div>`);
    clearElement($('#market'));
    $('#market').append(market);
    loadMarket();
}

function initStorage(){
    if (!shouldRenderResourceTab(1)){
        return;
    }
    let store = $(`<div id="createHead" class="storage-header"><h2 class="is-sr-only">${loc('tab_storage')}</h2></div>`);
    clearElement($('#resStorage'));
    $('#resStorage').append(store);
    
    if (global.resource['Crates'] && global.resource['Containers']){
        store.append($(`<b-tooltip :label="buildCrateDesc()" position="is-bottom" class="crate" animated multilined><button :aria-label="buildCrateDesc()" v-show="cr.display" class="button" @click="crate">${loc('resource_modal_crate_construct')}</button></b-tooltip>`));
        store.append($(`<b-tooltip :label="buildContainerDesc()" position="is-bottom" class="container" animated multilined><button :aria-label="buildContainerDesc()" v-show="cn.display" class="button" @click="container">${loc('resource_modal_container_construct')}</button></b-tooltip>`));

        vBind({
            el: '#createHead',
            data: {
                cr: global.resource.Crates,
                cn: global.resource.Containers
            },
            methods: {
                crate(){
                    buildCrate();
                },
                container(){
                    buildContainer();
                },
                buildCrateDesc(){
                    return buildCrateLabel();
                },
                buildContainerDesc(){
                    return buildContainerLabel();
                },
            }
        });
    }
}

function loadMarket(){
    if (!shouldRenderResourceTab(0)){
        return;
    }

    let market = $('#market-qty');
    clearElement(market);

    if (!global.race['no_trade']){
        market.append($(`<h3 class="is-sr-only">${loc('resource_trade_qty')}</h3>`));
        market.append($(`<b-field class="market"><span class="button has-text-danger" role="button" @click="less">-</span><b-numberinput :input="val()" min="1" :max="limit()" v-model="qty" :controls="false"></b-numberinput><span class="button has-text-success" role="button" @click="more">+</span></b-field>`));
    }

    vBind({
        el: `#market-qty`,
        data: global.city.market,
        methods: {
            val(){
                if (global.city.market.qty < 1){
                    global.city.market.qty = 1;
                }
                else if (global.city.market.qty > tradeMax()){
                    global.city.market.qty = tradeMax();
                }
            },
            limit(){
                return tradeMax();
            },
            less(){
                global.city.market.qty -= keyMultiplier();
            },
            more(){
                global.city.market.qty += keyMultiplier();
            }
        }
    });
}

function tradeMax(){
    if (global.tech['currency'] >= 6){
        return 1000000;
    }
    else if (global.tech['currency'] >= 4){
        return 5000;
    }
    else {
        return 100;
    }
}

function initEjector(){
    if (!shouldRenderResourceTab(2)){
        return;
    }
    clearElement($('#resEjector'));
    if (global.interstellar['mass_ejector']){
        let ejector = $(`<div id="eject" class="market-item"><h3 class="res has-text-warning">${loc('interstellar_mass_ejector_vol')}</h3></div>`);
        $('#resEjector').append(ejector);

        let eject = $(`<span class="trade"></span>`);
        ejector.append(eject);

        eject.append($(`<span>{{ total }} / {{ on | max }}{{ on | real }}</span><span class="mass">${loc('interstellar_mass_ejector_mass')}: {{ mass | approx }} kt/s</span>`));

        vBind({
            el: `#eject`,
            data: global.interstellar.mass_ejector,
            filters: {
                max(num){
                    return num * 1000;
                },
                real(num){
                    if (p_on['mass_ejector'] < num){
                        return ` (${loc('interstellar_mass_ejector_active',[p_on['mass_ejector'] * 1000])})`;
                    }
                    return '';
                },
                approx(tons){
                    return sizeApproximation(tons,2);
                }
            }
        });
    }
}

export function loadEjector(name,color){
    if (!shouldRenderResourceTab(2)){
        return;
    }
    else if (global.race['artifical'] && name === 'Food'){
        return;
    }
    if (atomic_mass[name] && global.interstellar['mass_ejector']){
        if (global.race.universe !== 'magic' && (name === 'Elerium' || name === 'Infernite')){
            color = 'caution';
        }
        let ejector = $(`<div id="eject${name}" class="market-item" v-show="r.display"><h3 class="res has-text-${color}">${global.resource[name].name}</h3></div>`);
        $('#resEjector').append(ejector);

        let res = $(`<span class="trade"></span>`);
        ejector.append(res);

        res.append($(`<span role="button" aria-label="eject less ${global.resource[name].name}" class="sub has-text-danger" @click="ejectLess('${name}')"><span>&laquo;</span></span>`));
        res.append($(`<span class="current">{{ e.${name} }}</span>`));
        res.append($(`<span role="button" aria-label="eject more ${global.resource[name].name}" class="add has-text-success" @click="ejectMore('${name}')"><span>&raquo;</span></span>`));

        res.append($(`<span class="mass">${loc('interstellar_mass_ejector_per')}: <span class="has-text-warning">${atomic_mass[name]}</span> kt</span>`));

        if (!global.interstellar.mass_ejector.hasOwnProperty(name)){
            global.interstellar.mass_ejector[name] = 0;
        }

        vBind({
            el: `#eject${name}`,
            data: {
                r: global.resource[name],
                e: global.interstellar.mass_ejector
            },
            methods: {
                ejectMore(r){
                    let keyMutipler = keyMultiplier();
                    if (keyMutipler + global.interstellar.mass_ejector.total > p_on['mass_ejector'] * 1000){
                        keyMutipler = p_on['mass_ejector'] * 1000 - global.interstellar.mass_ejector.total;
                    }
                    global.interstellar.mass_ejector[r] += keyMutipler;
                    global.interstellar.mass_ejector.total += keyMutipler;
                },
                ejectLess(r){
                    let keyMutipler = keyMultiplier();
                    if (keyMutipler > global.interstellar.mass_ejector[r]){
                        keyMutipler = global.interstellar.mass_ejector[r];
                    }
                    if (global.interstellar.mass_ejector[r] > 0){
                        global.interstellar.mass_ejector[r] -= keyMutipler;
                        global.interstellar.mass_ejector.total -= keyMutipler;
                    }
                },
            }
        });
    }
}

function initSupply(){
    if (!shouldRenderResourceTab(3)){
        return;
    }
    clearElement($('#resCargo'));
    if (global.portal['transport']){
        let supply = $(`<div id="spireSupply"><h3 class="res has-text-warning pad">${loc('portal_transport_supply')}</h3></div>`);
        $('#resCargo').append(supply);

        let cargo = $(`<span class="pad">{{ used }} / {{ max }}</span>`);
        supply.append(cargo);

        vBind({
            el: `#spireSupply`,
            data: global.portal.transport.cargo
        });
    }
}

export function loadSupply(name,color){
    if (!shouldRenderResourceTab(3)){
        return;
    }
    if (supplyValue[name] && global.portal['transport']){
        let ejector = $(`<div id="supply${name}" class="market-item" v-show="r.display"><h3 class="res has-text-${color}">${global.resource[name].name}</h3></div>`);
        $('#resCargo').append(ejector);

        let res = $(`<span class="trade"></span>`);
        ejector.append(res);

        res.append($(`<span role="button" aria-label="eject less ${loc('resource_'+name+'_name')}" class="sub has-text-danger" @click="supplyLess('${name}')"><span>&laquo;</span></span>`));
        res.append($(`<span class="current">{{ e.${name} }}</span>`));
        res.append($(`<span role="button" aria-label="eject more ${loc('resource_'+name+'_name')}" class="add has-text-success" @click="supplyMore('${name}')"><span>&raquo;</span></span>`));

        let volume = sizeApproximation(supplyValue[name].out);
        res.append($(`<span class="mass">${loc('portal_transport_item',[`<span class="has-text-caution">${volume}</span>`,`<span class="has-text-success">${supplyValue[name].in}</span>`])}</span>`));

        if (!global.portal.transport.cargo.hasOwnProperty(name)){
            global.portal.transport.cargo[name] = 0;
        }

        vBind({
            el: `#supply${name}`,
            data: {
                r: global.resource[name],
                e: global.portal.transport.cargo
            },
            methods: {
                supplyMore(r){
                    let keyMutipler = keyMultiplier();
                    if (keyMutipler + global.portal.transport.cargo.used > global.portal.transport.cargo.max){
                        keyMutipler = global.portal.transport.cargo.max - global.portal.transport.cargo.used;
                        if (global.portal.transport.cargo[r] + keyMutipler < 0){
                            keyMutipler = -global.portal.transport.cargo[r];
                        }
                    }
                    global.portal.transport.cargo[r] += keyMutipler;
                    global.portal.transport.cargo.used += keyMutipler;
                },
                supplyLess(r){
                    let keyMutipler = keyMultiplier();
                    if (keyMutipler > global.portal.transport.cargo[r]){
                        keyMutipler = global.portal.transport.cargo[r];
                    }
                    if (global.portal.transport.cargo[r] > 0){
                        global.portal.transport.cargo[r] -= keyMutipler;
                        global.portal.transport.cargo.used -= keyMutipler;
                    }
                },
            }
        });
    }
}

function initAlchemy(){
    if (!shouldRenderResourceTab(4)){
        return;
    }
    clearElement($('#resAlchemy'));
}

export function loadAlchemy(name,color,basic){
    if (!shouldRenderResourceTab(4)){
        return;
    }
    else if (global.race['artifical'] && name === 'Food'){
        return;
    }
    if (global.tech['alchemy'] && (basic || global.tech.alchemy >= 2) && name !== 'Crystal'){
        let alchemy = $(`<div id="alchemy${name}" class="market-item" v-show="r.display"><h3 class="res has-text-${color}">${global.resource[name].name}</h3></div>`);
        $('#resAlchemy').append(alchemy);

        let res = $(`<span class="trade"></span>`);
        alchemy.append(res);

        res.append($(`<span role="button" aria-label="transmute less ${global.resource[name].name}" class="sub has-text-danger" @click="subSpell('${name}')"><span>&laquo;</span></span>`));
        res.append($(`<span class="current">{{ a.${name} }}</span>`));
        res.append($(`<span role="button" aria-label="transmute more ${global.resource[name].name}" class="add has-text-success" @click="addSpell('${name}')"><span>&raquo;</span></span>`));

        if (!global.race.alchemy.hasOwnProperty(name)){
            global.race.alchemy[name] = 0;
        }

        vBind({
            el: `#alchemy${name}`,
            data: {
                r: global.resource[name],
                a: global.race.alchemy
            },
            methods: {
                addSpell(spell){
                    let keyMult = keyMultiplier();
                    let change = Math.min(Math.floor(global.resource.Mana.diff), keyMult);
                    if (change > 0) {
                        global.race.alchemy[spell] += change;
                        global.resource.Mana.diff -= change;
                    }
                },
                subSpell(spell){
                    let keyMult = keyMultiplier();
                    let change = Math.min(global.race.alchemy[spell], keyMult);
                    if (change > 0) {
                        global.race.alchemy[spell] -= change;
                        global.resource.Mana.diff += change;
                    }
                },
            }
        });

        popover(`alchemy${name}`,function(){
            let rate = basic && global.tech.alchemy >= 2 ? tradeRatio[name] * 8 : tradeRatio[name] * 2;
            if (global.race['witch_hunter']){ rate *= 3; }
            if (global.stats.achieve['soul_sponge'] && global.stats.achieve.soul_sponge['mg']){
                rate *= global.stats.achieve.soul_sponge.mg + 1;
            }
            return $(`<div>${loc('resource_alchemy',[1,loc(`resource_Mana_name`),0.15,loc(`resource_Crystal_name`),+rate.toFixed(2), global.resource[name].name])}</div>`);
        },
        {
            elm: `#alchemy${name} h3`
        });
    }
}

export const spatialReasoning = (function(){
    var spatial = {};
    return function (value,type,recalc){
        let tkey = type ? type : 'a';
        let key = [
            global.race.universe,
            global.prestige.Plasmid.count,
            global.prestige.AntiPlasmid.count,
            global.prestige.Phage.count,
            global.race['no_plasmid'] || '0',
            global.race['p_mutation'] || '0',
            global.race['nerfed'] || '0',
            global.genes['store'] || '0',
            global.genes['bleed'] || '0',
            templeCount(false) || '0',
            templeCount(true) || '0',
            global.race['cataclysm'] ? global.race.cataclysm : '0',
            global.race['orbit_decayed'] ? global.race.orbit_decayed : '0',
            global.genes['ancients'] || '0',
            global.civic['priest'] ? global.civic.priest.workers : '0'
        ].join('-');

        if (!spatial[tkey]){
            spatial[tkey] = {};
        }
        if (!spatial[tkey][key] || recalc){            
            let modifier = 1;
            if (global.genes['store']){
                let plasmids = 0;
                if (!type || (type && ((type === 'plasmid' && global.race.universe !== 'antimatter') || (type === 'anti' && global.race.universe === 'antimatter')))){
                    plasmids = global.race.universe === 'antimatter' ? global.prestige.AntiPlasmid.count : global.prestige.Plasmid.count;
                    let raw = plasmids;
                    if (global.race['no_plasmid']){
                        let active = global.race.p_mutation + (global.race['wish'] && global.race['wishStats'] ? global.race.wishStats.plas : 0);
                        raw = Math.min(active, plasmids);
                    }
                    else if (global.race['nerfed']){
                        raw = Math.floor(plasmids / (global.race.universe === 'antimatter' ? 2 : 5));
                    }
                    plasmids = Math.round(raw * (global.race['nerfed'] ? 0.5 : 1));
                }
                if (!type || (type && type === 'phage')){
                    if (global.genes['store'] >= 4){
                        plasmids += Math.round(global.prestige.Phage.count * (global.race['nerfed'] ? (1/3) : 1));
                    }
                }
                let divisor = global.genes.store >= 2 ? (global.genes.store >= 3 ? 1250 : 1666) : 2500;
                if (global.race.universe === 'antimatter'){
                    divisor *= 2;
                }
                if (global.genes['bleed'] && global.genes['bleed'] >= 3){
                    if (!type || (type && ((type === 'plasmid' && global.race.universe === 'antimatter') || (type === 'anti' && global.race.universe !== 'antimatter')))){
                        let raw = global.race.universe === 'antimatter' ? global.prestige.Plasmid.count / 5 : global.prestige.AntiPlasmid.count / 10;
                        plasmids += Math.round(raw * (global.race['nerfed'] ? 0.5 : 1));
                    }
                }
                modifier *= 1 + (plasmids / divisor);
            }
            if (global.race.universe === 'standard'){
                modifier *= darkEffect('standard');
            }
            if (global.race.universe === 'antimatter' && faithTempleCount()){
                let temple = 0.06;
                if (global.genes['ancients'] && global.genes['ancients'] >= 2 && global.civic.priest.display){
                    let priest = global.genes['ancients'] >= 5 ? 0.0012 : (global.genes['ancients'] >= 3 ? 0.001 : 0.0008);
                    if (global.race['high_pop']){
                        priest = highPopAdjust(priest);
                    }
                    temple += priest * global.civic.priest.workers;
                }
                modifier *= 1 + (faithTempleCount() * temple);
            }
            if (!type){
                if (global['pillars']){
                    let harmonic = calcPillar();
                    modifier *= harmonic[1];
                }
            }
            spatial[tkey] = {};
            spatial[tkey][key] = modifier;
        }
        return type ? (spatial[tkey][key] * value) : Math.round(spatial[tkey][key] * value);
    }
})();

export function faithTempleCount(){
    let noEarth = global.race['cataclysm'] || global.race['orbit_decayed'] ? true : false;
    return templeCount(noEarth);
}

export function faithBonus(num_temples = -1){
    if (global.race['no_plasmid'] || global.race.universe === 'antimatter'){
        if (num_temples == -1){
            num_temples = faithTempleCount();
        }

        if (num_temples > 0){
            let temple_bonus = global.tech['anthropology'] && global.tech['anthropology'] >= 1 ? 0.016 : 0.01;
            if (global.tech['fanaticism'] && global.tech['fanaticism'] >= 2){
                let indoc = workerScale(global.civic.professor.workers,'professor') * highPopAdjust(global.race.universe === 'antimatter' ? 0.0002 : 0.0004);
                temple_bonus += indoc;
            }
            if (global.genes['ancients'] && global.genes['ancients'] >= 2 && global.civic.priest.display){
                let priest_bonus = global.genes['ancients'] >= 5 ? 0.00015 : (global.genes['ancients'] >= 3 ? 0.000125 : 0.0001);
                temple_bonus += highPopAdjust(priest_bonus) * workerScale(global.civic.priest.workers,'priest');
            }
            if (global.race.universe === 'antimatter'){
                temple_bonus /= (global.race['nerfed'] ? 3 : 2);
            }
            else if (global.race['nerfed']){
                temple_bonus /= 2;
            }
            if (global.race['spiritual']){
                temple_bonus *= 1 + (traits.spiritual.vars()[0] / 100);
            }
            let fathom = fathomCheck('seraph');
            if (fathom > 0){
                temple_bonus *= 1 + (traits.spiritual.vars(1)[0] / 100 * fathom);
            }
            if (global.race['blasphemous']){
                temple_bonus *= 1 - (traits.blasphemous.vars()[0] / 100);
            }
            if (global.civic.govern.type === 'theocracy'){
                temple_bonus *= 1 + (govEffect.theocracy()[0] / 100);
            }
            if (global.race['ooze']){
                temple_bonus *= 1 - (traits.ooze.vars()[1] / 100);
            }

            return num_temples * temple_bonus;
        }
    }
    return 0;
}

export function templePlasmidBonus(num_temples = -1){
    if (!global.race['no_plasmid'] && global.race.universe !== 'antimatter'){
        if (num_temples == -1){
            num_temples = faithTempleCount();
        }

        if (num_temples > 0){
            let temple_bonus = global.tech['anthropology'] && global.tech['anthropology'] >= 1 ? 0.08 : 0.05;
            if (global.tech['fanaticism'] && global.tech['fanaticism'] >= 2){
                let indoc = workerScale(global.civic.professor.workers,'professor') * highPopAdjust(0.002);
                temple_bonus += indoc;
            }
            if (global.genes['ancients'] && global.genes['ancients'] >= 2 && global.civic.priest.display){
                let priest_bonus = global.genes['ancients'] >= 5 ? 0.0015 : (global.genes['ancients'] >= 3 ? 0.00125 : 0.001);
                temple_bonus += highPopAdjust(priest_bonus) * workerScale(global.civic.priest.workers,'priest');
            }
            if (global.race['spiritual']){
                temple_bonus *= 1 + (traits.spiritual.vars()[0] / 100);
            }
            let fathom = fathomCheck('seraph');
            if (fathom > 0){
                temple_bonus *= 1 + (traits.spiritual.vars(1)[0] / 100 * fathom);
            }
            if (global.race['blasphemous']){
                temple_bonus *= 1 - (traits.blasphemous.vars()[0] / 100);
            }
            if (global.civic.govern.type === 'theocracy'){
                temple_bonus *= 1 + (govEffect.theocracy()[0] / 100);
            }
            if (global.race['ooze']){
                temple_bonus *= 1 - (traits.ooze.vars()[1] / 100);
            }
            if (global.race['orbit_decayed'] && global.race['truepath']){
                temple_bonus *= 0.1;
            }

            return num_temples * temple_bonus;
        }
    }
    return 0;
}

export const plasmidBonus = (function (){
    var plasma = {};
    return function(type){
        let key = [
            global.race.universe,
            global.prestige.Plasmid.count,
            global.prestige.AntiPlasmid.count,
            global.prestige.Phage.count,
            global.civic.govern.type,
            global.civic.professor.assigned,
            global.genes['bleed'] || '0',
            global.race['decayed'] || '0',
            global.race['gene_fortify'] || '0',
            global.tech['anthropology'] || '0',
            global.tech['fanaticism'] || '0',
            global.race['nerfed'] || '0',
            global.race['no_plasmid'] || '0',
            global.genes['ancients'] || '0',
            templeCount(false) || '0',
            templeCount(true) || '0',
            global.civic['priest'] ? global.civic.priest.workers : '0',
            global.race['orbit_decayed'] ? global.race.orbit_decayed : '0',
            global.race['spiritual'] || '0',
            global.tech['outpost_boost'] || '0',
            p_on['alien_outpost'] || '0',
        ].join('-');

        if (!plasma[key]){
            let standard = 0;
            let anti = 0; 
            if (global.race.universe !== 'antimatter' || global.genes['bleed']){
                let active = global.race.p_mutation + (global.race['wish'] && global.race['wishStats'] ? global.race.wishStats.plas : 0);
                let plasmids = global.race['no_plasmid'] ? Math.min(active, global.prestige.Plasmid.count) : global.prestige.Plasmid.count;
                if (global.race.universe === 'antimatter' && global.genes['bleed']){
                    plasmids *= 0.025
                }
                if (global.race['decayed']){
                    plasmids -= Math.round((global.stats.days - global.race.decayed) / (300 + global.race.gene_fortify * 6));
                }
                let p_cap = 250 + global.prestige.Phage.count;
                if (plasmids > p_cap){
                    standard = (+((Math.log(p_cap + 50) - 3.91202)).toFixed(5) / 2.888) + ((Math.log(plasmids + 1 - p_cap) / Math.LN2 / 250));
                }
                else if (plasmids < 0){
                    standard = 0;
                }
                else {
                    standard = +((Math.log(plasmids + 50) - 3.91202)).toFixed(5) / 2.888;
                }
                if (global.tech['outpost_boost'] && global.race['truepath'] && p_on['alien_outpost']){
                    standard *= 2;
                }

                let temple_bonus = templePlasmidBonus();
                standard *= 1 + temple_bonus;
            }

            if (global.race.universe === 'antimatter' || (global.genes['bleed'] && global.genes['bleed'] >= 2)){
                let plasmids = global.prestige.AntiPlasmid.count;
                if (global.race.universe !== 'antimatter' && global.genes['bleed'] && global.genes['bleed'] >= 2){
                    plasmids *= 0.25
                }
                if (global.race['decayed']){
                    plasmids -= Math.round((global.stats.days - global.race.decayed) / (300 + global.race.gene_fortify * 6));
                }
                let p_cap = 250 + global.prestige.Phage.count;
                if (plasmids > p_cap){
                    anti = (+((Math.log(p_cap + 50) - 3.91202)).toFixed(5) / 2.888) + ((Math.log(plasmids + 1 - p_cap) / Math.LN2 / 250));
                }
                else if (plasmids < 0){
                    anti = 0;
                }
                else {
                    anti = +((Math.log(plasmids + 50) - 3.91202)).toFixed(5) / 2.888;
                }
                if (global.tech['outpost_boost'] && global.race['truepath'] && p_on['alien_outpost']){
                    anti *= 2;
                }
                anti /= 3;
            }

            if (global.race['nerfed']){
                if (global.race.universe === 'antimatter'){
                    standard /= 2;
                    anti /= 2;
                }
                else {
                    standard /= 5;
                    anti /= 5;
                }
            }

            plasma = {};
            let final = (1 + standard) * (1 + anti) - 1;            
            plasma[key] = [final,standard,anti];
        }

        if (type && type === 'raw'){
            return plasma[key];
        }
        else if (type && type === 'plasmid'){
            return plasma[key][1];
        }
        else if (type && type === 'antiplasmid'){
            return plasma[key][2];
        }
        else {
            return plasma[key][0];
        }
    }
})();
