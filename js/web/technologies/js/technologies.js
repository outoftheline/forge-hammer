/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

FH.proxy.addMetaHandler('research', (xhr, postData) => {
	Technologies.AllTechnologies = JSON.parse(xhr.responseText);
	//$('#technologies-Btn').removeClass('hud-btn-red');
	//$('#technologies-Btn-closed').remove();

	//if ($('#PlayerProfileButton')) {
    //    $('#PlayerProfileButton span').attr('class','technologies');
    //}
});

FH.proxy.addHandler('ResearchService', 'getProgress', (data, postData) => {
	Technologies.UnlockedTechnologies = data.responseData;
});

FH.proxy.addHandler('ResearchService', 'payTechnology', (data, postData) => {
	let era = Technologies.AllTechnologies.find(x=>x.id == data.responseData.progress.tech_id).era;
    if (Technologies.Eras[era] > FH.CurrentEraID) {
        FH.CurrentEraID = Technologies.Eras[era];
        FH.CurrentEra = era;
    }
});

FH.proxy.addHandler('ResearchService', 'spendForgePoints', (data, postData) => {
    let CurrentTech = data.responseData['technology'];
    if (CurrentTech === undefined) return;

    let ID = CurrentTech['id']
    if (ID === undefined) return;

    let TechFound = false;
    for (let i in Technologies.UnlockedTechnologies.inProgressTechnologies) {
        if (!Technologies.UnlockedTechnologies.inProgressTechnologies.hasOwnProperty(i)) continue;

        if (Technologies.UnlockedTechnologies.inProgressTechnologies[i]['tech_id'] === ID) {
            TechFound = true;
            Technologies.UnlockedTechnologies.inProgressTechnologies[i]['currentSP'] = CurrentTech['progress']['currentSP'];

            break;
        }
    }

    if (!TechFound) {
        let TechCount = Technologies.UnlockedTechnologies.inProgressTechnologies.length;
        Technologies.UnlockedTechnologies.inProgressTechnologies[TechCount] = CurrentTech['progress'];
    }

    if ($('#technologies').length !== 0) {
        Technologies.CalcBody();
    }
});

FH.proxy.addHandler('ResearchService', 'payTechnology', (data, postData) => {
    let CurrentTech = data.responseData['technology'];
    if (CurrentTech === undefined) return;

    let ID = CurrentTech['id']
    if (ID === undefined) return;

    let TechCount = Technologies.UnlockedTechnologies.unlockedTechnologies.length
    Technologies.UnlockedTechnologies.unlockedTechnologies[TechCount] = ID;

    if ($('#technologies').length !== 0) {
        Technologies.CalcBody();
    }
});

let Technologies = {
    AllTechnologies: null,
    UnlockedTechnologies: false,
    SelectedEraID: undefined,

    IgnorePrevEra: null,
    IgnoreCurrentEraOptional: null,

    Eras: {
        AllAge: 0,
        NoAge: 0,
        StoneAge: 1,
        BronzeAge: 2,
        IronAge: 3,
        EarlyMiddleAge: 4,
        HighMiddleAge: 5,
        LateMiddleAge: 6,
        ColonialAge: 7,
        IndustrialAge: 8,
        ProgressiveEra: 9,
        ModernEra: 10,
        PostModernEra: 11,
        ContemporaryEra: 12,
        TomorrowEra: 13,
        FutureEra: 14,
        ArcticFuture: 15,
        OceanicFuture: 16,
        VirtualFuture: 17,
        SpaceAgeMars: 18,
        SpaceAgeAsteroidBelt: 19,
        SpaceAgeVenus: 20,
        SpaceAgeJupiterMoon: 21,
        SpaceAgeTitan: 22,
        SpaceAgeSpaceHub: 23,
        StellarAgeDiscovery:24,
        NextEra: 25,
    },

    // need this for cityentities
    InnoEras: {
        StoneAge: 0,
        BronzeAge: 1,
        IronAge: 2,
        EarlyMiddleAge: 3,
        HighMiddleAge: 4,
        LateMiddleAge: 5,
        ColonialAge: 6,
        IndustrialAge: 7,
        ProgressiveEra: 8,
        ModernEra: 9,
        PostModernEra: 10,
        ContemporaryEra: 11,
        TomorrowEra: 12,
        FutureEra: 13,
        ArcticFuture: 14,
        OceanicFuture: 15,
        VirtualFuture: 16,
        SpaceAgeMars: 17,
        SpaceAgeAsteroidBelt: 18,
        SpaceAgeVenus: 19,
        SpaceAgeJupiterMoon: 20,
        SpaceAgeTitan: 21,
        SpaceAgeSpaceHub: 22,
        StellarAgeDiscovery: 23,
        NextEra: 24,
    },


    EraNames: {
        0: 'NoAge',
        1: 'StoneAge',
        2: 'BronzeAge',
        3: 'IronAge',
        4: 'EarlyMiddleAge',
        5: 'HighMiddleAge',
        6: 'LateMiddleAge',
        7: 'ColonialAge',
        8: 'IndustrialAge',
        9: 'ProgressiveEra',
        10: 'ModernEra',
        11: 'PostModernEra',
        12: 'ContemporaryEra',
        13: 'TomorrowEra',
        14: 'FutureEra',
        15: 'ArcticFuture',
        16: 'OceanicFuture',
        17: 'VirtualFuture',
        18: 'SpaceAgeMars',
        19: 'SpaceAgeAsteroidBelt',
        20: 'SpaceAgeVenus',
        21: 'SpaceAgeJupiterMoon',
        22: 'SpaceAgeTitan',
        23: 'SpaceAgeSpaceHub',
        24: 'StellarAgeDiscovery',
    },

    // need this for cityentities
    InnoEraNames: {
        0: 'StoneAge',
        1: 'BronzeAge',
        2: 'IronAge',
        3: 'EarlyMiddleAge',
        4: 'HighMiddleAge',
        5: 'LateMiddleAge',
        6: 'ColonialAge',
        7: 'IndustrialAge',
        8: 'ProgressiveEra',
        9: 'ModernEra',
        10: 'PostModernEra',
        11: 'ContemporaryEra',
        12: 'TomorrowEra',
        13: 'FutureEra',
        14: 'ArcticFuture',
        15: 'OceanicFuture',
        16: 'VirtualFuture',
        17: 'SpaceAgeMars',
        18: 'SpaceAgeAsteroidBelt',
        19: 'SpaceAgeVenus',
        20: 'SpaceAgeJupiterMoon',
        21: 'SpaceAgeTitan',
        22: 'SpaceAgeSpaceHub',
        23: 'StellarAgeDiscovery',
    },
    maxEra:null,
    getMaxEra:()=>{ // 1 more than "InnoEra"
        if (!Technologies.maxEra) Technologies.maxEra = Math.max(...Object.values(FH.Main.CityEntities).filter(x=>x.type=="greatbuilding").map(x=>Technologies.Eras[x.requirements.min_era]));
        return Technologies.maxEra;
    },

    getEraName: (entityId, level) => {
        let eraName = entityId.split('_')[1]
        if (eraName == 'MultiAge')
            return Technologies.InnoEraNames[level]
        return eraName
    },

    getPreviousEraIdByCurrentEraName: (eraName) => {
        return parseInt(Technologies.InnoEras[eraName]-1||1)
    },

    getEraIdByCurrentEraName: (eraName) => {
        return parseInt(Technologies.InnoEras[eraName]||1)
    },

    getNextEraIdByCurrentEraName: (eraName) => {
        // if player is in the highest era, return current age number
        let era = (Technologies.InnoEras[eraName] === Technologies.getMaxEra()-1) ? parseInt(Technologies.InnoEras[eraName]) : parseInt(Technologies.InnoEras[eraName]+1)
        return era
    },

    showOnlyMissing:() => {
        if (Technologies.OnlyMissing) {
            $('#technologiesBody tr').not(':has(.text-danger)').hide();
        } else {
            $('#technologiesBody tr').show();
        }
    },

    Show: ()=> {
		if ($('#technologies').length === 0) {

			FH.HTML.Box({
				id: 'technologies',
				title: FH.t('Boxes.Technologies.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
                resize: true,
                settings: Technologies.ShowSettingsButton
			});

			// CSS in den DOM prügeln
			FH.HTML.AddCssFile('technologies');

			Technologies.SelectedEraID = FH.CurrentEraID;

		} else {
			FH.HTML.CloseOpenBox('technologies');
        }

        $('#technologies').on('click', '.ignoreprevera', function () {
            let $this = $(this),
                v = $this.prop('checked');

            Technologies.IgnorePrevEra = v;

            FH.Storage.setItem('TechnologiesIgnorePrevEra', Technologies.IgnorePrevEra);

            Technologies.CalcBody();
        });

        $('#technologies').on('click', '.ignorecurrenteraoptional', function () {
            let $this = $(this),
                v = $this.prop('checked');

            Technologies.IgnoreCurrentEraOptional = v;

            FH.Storage.setItem('TechnologiesIgnoreCurrentEraOptional', Technologies.IgnoreCurrentEraOptional);

            Technologies.CalcBody();
        });

        // Zeitalter vor und zurück schalten
        $('#technologies').on('click', '.btn-switchage', function () {

            $('.btn-switchage').removeClass('btn-active');

            Technologies.SelectedEraID = $(this).data('value');
            Technologies.CalcBody();

            $(this).addClass('btn-active');
        });

        $('#technologies').on('click', '.onlymissing', function () {
            let $this = $(this),
                v = $this.prop('checked');

            Technologies.OnlyMissing = v;
			Technologies.showOnlyMissing();
        });

		Technologies.BuildBox();
    },


    BuildBox: () => {
        Technologies.IgnorePrevEra = (FH.Storage.getItem('TechnologiesIgnorePrevEra') !== 'false' ? 'true' : 'false')
        Technologies.IgnoreCurrentEraOptional = (FH.Storage.getItem('TechnologiesIgnoreCurrentEraOptional') !== 'false' ? 'true' : 'false')

        Technologies.CalcBody();
        
    },


    CalcBody: ()=> {
        let h = [];

        // Count goods
        let RequiredResources = {},
            BranchRessourcesMax = {},
            TechCount = 0,
            Techs = Object.assign({}, ...Technologies.AllTechnologies.map(x => ({[x.id]: x}))),
            children = ['root'],
            i = 0;
            processedTechs = new Set();
            inProgress = Object.assign({}, ...Technologies.UnlockedTechnologies.inProgressTechnologies.map(x => ({[x.tech_id]: x.researchCostPaid})));

        let processTech = (Tech, ressourceObject) => {
            let EraID = Technologies.Eras[Tech.era];

            if (EraID > Technologies.SelectedEraID) return;

            let res = Object.assign({}, Tech.researchCost?.resources || Tech.cost?.resources || {}, Tech.requirements?.resources || Tech.cost?.resources || {});
            for (let [ResourceName,amount] of Object.entries(res)) {
                amount = amount - (inProgress?.[Tech.id]?.[ResourceName] || 0);
                ressourceObject[ResourceName] = (ressourceObject[ResourceName] || 0) + amount;
            }
            TechCount++;
        };

        //add lost children to parents if missing
        for (let Tech of Object.values(Techs)) {
            for (let parent of Tech.parents) {
                if (!Techs[parent].children) Techs[parent].children = [];
                if (!Techs[parent].children.includes(Tech.id)) Techs[parent].children.push(Tech.id);
            }
        }

        if (Technologies.IgnoreCurrentEraOptional || Technologies.IgnorePrevEra) { //prune tech tree to remove optional techs in current era
            
            let removed = 0;
            do {
                removed = 0;
                let deadends = Object.values(Techs).filter(x => x.children?.length == 0).map(x => x.id);
                for (let deadend of deadends) {
                    if (deadend == "the_unknown_teaser") continue;
                    if ((Technologies.Eras[Techs[deadend].era] >= FH.CurrentEraID || !Technologies.IgnorePrevEra) &&
                        (Technologies.Eras[Techs[deadend].era] < FH.CurrentEraID || !Technologies.IgnoreCurrentEraOptional)) continue;

                    delete Techs[deadend];
                    removed++;
                    let parents = Object.values(Techs).filter(x => x.children?.includes(deadend)).map(x => x.id);
                    for (let parent of parents) {
                        let index = Techs[parent].children.indexOf(deadend);
                        if (index > -1) {
                            Techs[parent].children.splice(index, 1);
                        }
                    }
                }
            } while (removed > 0);
        }
        
        while (i < children.length) {
            let techId = children[i];
            let Tech = Techs[techId];
            if (processedTechs.has(Tech.id)) {
                i++;
                continue;
            }
            processedTechs.add(techId);

            children.push(...(Tech.children||[]));
            
            if (!Technologies.UnlockedTechnologies.unlockedNodes.includes(techId) && 
                !Tech.isTeaser && 
                Tech.__class__ !== 'BranchChoiceCompositeNode') {
                processTech(Tech, RequiredResources);
            } else if (Tech.__class__ == 'BranchChoiceCompositeNode') {
                let branchRes = [];
                for (let branch of Tech.branches) {
                    let resSum = {},
                        branchActive = false;
                    for (let tech of branch.nodes) {
                        if (Technologies.UnlockedTechnologies.unlockedNodes.includes(tech.id) ||
                            inProgress?.[tech.id]) 
                            branchActive = true;
                        if (!Technologies.UnlockedTechnologies.unlockedNodes.includes(tech.id) &&
                            !tech['isTeaser'] && 
                            tech.__class__ !== 'BranchChoiceCompositeNode') {
                            processTech(tech, resSum);
                        }
                    }
                    if (branchActive) {
                        branchRes = [];
                        for (let [ResourceName, amount] of Object.entries(resSum)) {
                            RequiredResources[ResourceName] = (RequiredResources[ResourceName] || 0) + amount;
                        }
                        break;
                    }
                    branchRes.push(resSum);
                }
                if (branchRes.length > 0) {
                    let minRes = Object.assign({}, ...branchRes);
                    let maxRes = structuredClone(minRes);
                    for (let ResourceName of Object.keys(minRes)) {
                        for (let branch of branchRes) {
                            minRes[ResourceName] = Math.min(minRes[ResourceName], branch[ResourceName]||0);
                            maxRes[ResourceName] = Math.max(maxRes[ResourceName], branch[ResourceName]||0);
                        }
                    }
                    for (let [ResourceName, amount] of Object.entries(minRes)) {
                        if (amount > 0) {
                            maxRes[ResourceName] -= amount;
                            RequiredResources[ResourceName] = (RequiredResources[ResourceName] || 0) + amount;
                        }
                        BranchRessourcesMax[ResourceName] = (BranchRessourcesMax[ResourceName] || 0) + maxRes[ResourceName];
                    }
                }
            }
            i++;
        }

        let PreviousEraID = Math.max(Technologies.SelectedEraID - 1, FH.CurrentEraID),
            NextEraID = Math.min(Technologies.SelectedEraID + 1, Technologies.getMaxEra());

        h.push(`<div class="dark-bg p5" style="margin-bottom: 3px">
                    <div class="text-center"><strong>${FH.t('Eras.'+Technologies.SelectedEraID)}</strong></div>
                    <div class="flex between">
                        <div>`);
                        if (PreviousEraID !== Technologies.SelectedEraID)
                            h.push(`<button class="btn btn-mid btn-switchage" data-value="${PreviousEraID}">${FH.t('Eras.'+PreviousEraID)}</button>`);

                        h.push(`</div><div>`);

                        if (NextEraID !== Technologies.SelectedEraID)
                            h.push(`<button class="btn btn-mid btn-switchage" data-value="${NextEraID}">${FH.t('Eras.'+NextEraID)}</button>`);
                        h.push(`</div>
                    </div>
                    <div class="text-small">
                        <label for="IgnorePrevEra"><input id="IgnorePrevEra" class="ignoreprevera game-cursor"${(Technologies.IgnorePrevEra ? 'checked' : '')} type="checkbox">${FH.t('Boxes.Technologies.IgnorePrevEra')}</label><br/>
                        <label for="IgnoreCurrentEraOptional"><input id="IgnoreCurrentEraOptional" class="ignorecurrenteraoptional game-cursor" ${(Technologies.IgnoreCurrentEraOptional ? 'checked' : '')} type="checkbox">${FH.t('Boxes.Technologies.IgnoreCurrentEraOptional')}</label><br/>
                        <label for="OnlyMissing"><input id="OnlyMissing" class="onlymissing game-cursor" ${(Technologies.OnlyMissing ? 'checked' : '')} type="checkbox">${FH.t('Boxes.Technologies.OnlyMissing')}</label><br/>
                    </div>
                </div>
            
            <table class="foe-table exportable">`);

        h.push('<thead class="sticky">' +
            '<tr>' +
            '<th colspan="2" data-export2="resource">' + FH.t('Boxes.Technologies.Resource') + '</th>' +
            '<th data-export="required">' + FH.t('Boxes.Technologies.DescRequired') + '</th>' +
            '<th data-export="instock"><span class="text-danger"></span>' + FH.t('Boxes.Technologies.DescInStock') + '</th>' +
            '<th data-export="remaining" class="text-right">' + FH.t('Boxes.Technologies.DescStillMissing') + '</th>' +
            '</tr>' +
            '</thead>');

        if (TechCount > 0) {
            // Reihenfolge der Ausgabe generieren
            let OutputList = ['strategy_points', 'money', 'supplies'];
            for (let i = 0; i < 70; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('promethium');
            for (let i = 70; i < 75; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('orichalcum');
            for (let i = 75; i < 80; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('mars_ore');
            for (let i = 80; i < 85; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('asteroid_ice');
            for (let i = 85; i < 90; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('venus_carbon');
            for (let i = 90; i < 95; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('unknown_dna');
            for (let i = 95; i < 100; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('crystallized_hydrocarbons');
            for (let i = 100; i < 105; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('dark_matter');
            for (let i = 105; i < 110; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }
            OutputList.push('stel_stellar_capacity');
            OutputList.push('stel_void_shard');
            OutputList.push('stel_stellar_points');
            OutputList.push('stel_mission_reward_encoded_tablets');

            for (let i = 110; i < FH.Goods.List.length; i++) {
                OutputList.push(FH.Goods.List[i]['id']);
            }

            for (let i = 0; i < OutputList.length; i++) {
                let ResourceName = OutputList[i];
                if (RequiredResources[ResourceName] !== undefined) {
                    let Required = RequiredResources[ResourceName];
                    let Stock = (ResourceName === 'strategy_points' ? StrategyPoints.AvailableFP : FH.RessourceStock[ResourceName]);
                    if (Stock === undefined) Stock = 0;
                    let Diff = Stock - Required;
                    let DiffMax = Stock - (Required + (BranchRessourcesMax[ResourceName] || 0));

                    h.push('<tr>');
                    h.push('<td class="goods-image" style="width:25px"><span class="goods-sprite sprite-35 '+ FH.Goods.Data[ResourceName]['id'] +'"></span></td>');
                    h.push('<td>' + FH.Goods.Data[ResourceName]['name'] + '</td>');
                    h.push('<td>' + FH.HTML.Format(Required) + (BranchRessourcesMax[ResourceName] ? ' - ' + FH.HTML.Format(Required + BranchRessourcesMax[ResourceName]) : '') + '</td>');
                    h.push('<td>' + FH.HTML.Format(Stock) + '</td>');
                    h.push(`<td class="text-right">
                                ${DiffMax < Diff ? `<span class="text-${DiffMax < 0 ? 'danger' : 'success'}"'>${FH.HTML.Format(DiffMax)}</span> - `:''}
                                <span class="text-${Diff < 0 ? 'danger' : 'success'}"'>${FH.HTML.Format(Diff)}</span>
                            </td>`);
                    h.push('</tr>');
                }
            }
        }
        else {
            h.push('<tr>');
            	h.push('<td colspan="5" class="text-center" style="font-size:110%;height:200px;">' + FH.t('Boxes.Technologies.NoTechs') + '</td>');
            h.push('</tr>');
        }
        h.push('</table');

        $('#technologiesBody').html(h.join(''));

        Technologies.showOnlyMissing();
    },


    ShowSettingsButton: () => {
        let h = [];
        h.push(`<p class="text-left">${FH.t('Boxes.General.Export')}: 
        <span class="btn-group">
        <button class="btn" onclick="FH.HTML.ExportTable($('#technologiesBody').find('.foe-table.exportable'), 'csv', 'technologies')">CSV</button>
        <button class="btn" onclick="FH.HTML.ExportTable($('#technologiesBody').find('.foe-table.exportable'), 'json', 'technologies')">JSON</button>
        </span>
        </p>`);

        $('#technologiesSettingsBox').html(h.join(''));
    },
};
