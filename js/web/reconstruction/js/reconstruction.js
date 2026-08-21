/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Copyright (C) 2026 Forge Hammer
 * Licensed under AGPL - see LICENSE.md for details.
 */

FH.proxy.addHandler('CityReconstructionService', 'getDraft', (data, postData) => {
    FH.Main.UpdateActiveMap('reconstruction');
    reconstruction.addToHammerBar();
    if (data?.responseData?.length==0) {
        data.responseData = Object.values(FH.Main.CityMapData).map(x=>({
            "entityId": x.id,
            "position": {
                "x": x.x,
                "y": x.y,
                "__class__": "Position"
            },
            "__class__": "ReconstructionDraftEntity"
        }))
    }
    reconstruction.draft = Object.assign({},...data.responseData.map(b=>({[b.entityId]:b})))
    reconstruction.count = {}
    reconstruction.pages = {
                            prod: [],
                            happ: [],
                            street: [],
                            greatbuilding: [],
                        }
    for (let b of data.responseData) {
        let id = FH.Main.CityMapData[b.entityId].cityentity_id + "#" + (FH.Main.CityMapData[b.entityId].level||0)
        if (!reconstruction.count[id]) reconstruction.count[id] = {placed:0,stored:0}
        if (b.position) 
            reconstruction.count[id].placed++
        else {
            reconstruction.count[id].stored++   
            if (reconstruction.count[id].stored == 1) reconstruction.pageUpdate(id)   
        }
    }
    if(!Settings.GetSetting('ShowReconstructionList')) return;
    reconstruction.showTable();
});

FH.proxy.addHandler('AutoAidService', 'getStates', (data, postData) => {
    if (FH.ActiveMap !== 'reconstruction') return;
    
    FH.Main.UpdateActiveMap('main');
    $('#ReconstructionList').remove();
    $('#ReconstructionMap').remove();
    $('#ReconstructionButtons').remove();
    reconstruction.draft = {};
});


FH.proxy.addHandler('InventoryService', 'getGreatBuildings', (data, postData) => {
    if (FH.ActiveMap !== 'reconstruction') return;

    FH.Main.UpdateActiveMap('main');
    $('#ReconstructionList').remove();
    $('#ReconstructionMap').remove();
    $('#ReconstructionButtons').remove();
});

FH.proxy.addRequestHandler('CityReconstructionService', 'saveDraft', (data) => {
    FH.Main.UpdateActiveMap('reconstruction');
    reconstruction.addToHammerBar();
    for (let x of data.requestData[0]) {
        let id = FH.Main.CityMapData[x.entityId].cityentity_id + "#" + (FH.Main.CityMapData[x.entityId].level||0);
        let pagesUpdated=false;
        if (x.position && !reconstruction.draft[x.entityId].position) {
            reconstruction.count[id].placed++;
            reconstruction.count[id].stored--;
            if (reconstruction.count[id].stored==0) {
                reconstruction.pageUpdate(id);
                pagesUpdated=true;
            }
            FH.proxy.triggerCustomHandler('ReconstructionBuildingPlaced',{id:x.entityId,last:(reconstruction.count[id].stored==0)})

            $('#ReconstructionMapBody .map-grid').append(reconstruction.placeBuildingOnMap(x));
        } else if (!x.position) {
            reconstruction.count[id].placed--;
            reconstruction.count[id].stored++;
            if (reconstruction.count[id].stored==1) {
                reconstruction.pageUpdate(id);
                pagesUpdated=true;
            }
            $(`#ReconstructionMapBody [data-id=${x.entityId}]`).remove();
        } else if (x.position && reconstruction.draft[x.entityId].position) {
            $(`#ReconstructionMapBody [data-id=${x.entityId}]`).remove();
            $('#ReconstructionMapBody .map-grid').append(reconstruction.placeBuildingOnMap(x));
        }

        reconstruction.draft[x.entityId] = x
        $('.reconstructionLine[data-page_id="'+id+'"] td:nth-child(2)').html("x"+reconstruction.count[id].stored)
        if (reconstruction.count[id].stored > 0) 
            $('.reconstructionLine[data-page_id="'+id+'"]').show();
        else 
            $('.reconstructionLine[data-page_id="'+id+'"]').hide();
        if (pagesUpdated) reconstruction.updateTable();
    }
    reconstruction.filterBuildings();
});

let reconstruction = {
    draft:null,
    count:null,
    pageMapper:{
        "culture":"happ",
        "cultural_goods_production":"prod",
        "decoration":"happ",
        "diplomacy":"happ",
        "static_provider":"happ",
        "random_production":"prod",
        "military":"prod",
        "goods":"prod",
        "production":"prod",
        "residential":"prod",
        "tower":"prod",
        "clan_power_production":"prod"
    },
    pages: null,
    rcIcons:null,
    roadIcons:null,
    planBuildings:null,
    selectedPlanId:null,
    mapScale: 20,
    filterValue: '',
    sizeTermRegEx: /^\d+x\d*$/,

    parseFilter:(raw)=>{
        return (raw||'').toLowerCase().split('|').map(t => t.trim()).filter(t => t !== '');
    },

    buildingFilterMatch:(el,terms)=>{
        if (terms.length === 0) return false;
        let size = (el.dataset.size || '').toLowerCase();
        let entityId = (el.dataset.meta_id || '').toLowerCase();
        let text = (el.dataset.text || $(el).find('[data-text]').attr('data-text') || '').toLowerCase();

        return terms.some(term => {
            if (term.startsWith('_')) return entityId.includes(term.slice(1));
            if (reconstruction.sizeTermRegEx.test(term)) return size.startsWith(term);
            return new RegExp(term,"i").test(text);
        });
    },

    filterBuildings:()=>{
        let input = $('#reconstructionFilter');
        if (input.length) reconstruction.filterValue = input.val();
        let search = reconstruction.parseFilter(reconstruction.filterValue);

        $('#ReconstructionListBody tbody').toggleClass('filtering', search.length > 0);

        $('.reconstructionLine').each((x,y) => {
            y.classList.toggle('matched', reconstruction.buildingFilterMatch(y, search));
        });

        $('.map-building').each((x,y) => {
            y.classList.toggle('highlight', reconstruction.buildingFilterMatch(y, search));
        });
    },

    pageUpdate:(id)=>{
        let meta = FH.Main.CityEntities[id.split("#")[0]]
        if (["friends_tavern",
            "main_building",
            "impediment",
            "hub_part",
            "off_grid",
            "outpost_ship",
            "hub_main"].includes(meta.type)) return
        let page = id[0]=="W"? "prod" : reconstruction.pageMapper[meta.type]||meta.type
        if (reconstruction.count[id].stored==0) { //remove from pages
            reconstruction.pages[page].splice(reconstruction.pages[page].indexOf(id),1)
        } else { //add to pages
            reconstruction.pages[page].unshift(id)
        }
    },
    updateTable:()=>{
        for (let [page,list] of Object.entries(reconstruction.pages)) {
            for (let i = 0;i<list.length;i++) {
                $('.reconstructionLine[data-page_id="'+list[i]+'"] td:nth-child(3)').html(`<img src="${reconstruction.rcIcons[page]}">`+(Math.floor(i/4)+1))
            }
        }
    },
    showTable:()=>{
        if (!reconstruction.rcIcons) {
            reconstruction.rcIcons = {
                happ:srcLinks.get("/shared/gui/reconstructionmenu/rc_icon_happynessbuildings.png",true),
                prod:srcLinks.get("/shared/gui/reconstructionmenu/rc_icon_productionbuildings.png",true),
                greatbuilding:srcLinks.get("/shared/gui/constructionmenu/icon_greatbuilding.png",true),
                street:srcLinks.get("/shared/gui/constructionmenu/icon_street.png",true),
            }
            reconstruction.roadIcons = {
                0:"",
                1:srcLinks.icons("road_required"),
                2:srcLinks.icons("street_required")
            }
        }             
        
        if ( $('#ReconstructionList').length === 0 ) {
			FH.HTML.AddCssFile('reconstruction');

			FH.HTML.Box({
				id: 'ReconstructionList',
				title: FH.t('Boxes.ReconstructionList.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true,
			    active_maps: "reconstruction"
			});
        } else {
            FH.HTML.CloseOpenBox('ReconstructionList');
            return;
        }
        
        h =`<table class="sortable-table foe-table">
                <thead class="sticky">
                    <tr><th colspan="6"><input name="reconstructionFilter" id="reconstructionFilter" placeholder="${FH.t('Boxes.ProductionsRating.Filter')}: neo|_gbg|4x4" value="" /></th></tr>
                    <tr class="sorter-header">
                        <th data-type="reconstructionSizes">${FH.t('Boxes.CityMap.Building')}</th>
                        <th class="no-sort">#</th>
                        <th class="no-sort text-center">${srcLinks.icons("icon_copy")}</th>
                        <th class="is-number" data-type="reconstructionSizes">${srcLinks.icons("road_required")}</th>
                        <th class="is-number" data-type="reconstructionSizes"></th>
                        <th class="is-number" data-type="reconstructionSizes"></th>
                    </tr>
                </thead><tbody class="reconstructionSizes">`
        for (let [id,b] of Object.entries(reconstruction.count)) {
            let meta=FH.Main.CityEntities[id.split("#")[0]]
            let width = meta.width||meta.components.AllAge.placement.size.x
            let length = meta.length||meta.components.AllAge.placement.size.y
            let road = meta?.components?.AllAge.streetConnectionRequirement?.requiredLevel || meta?.requirements?.street_connection_level || 0
            h+=`<tr class="reconstructionLine helperTT" data-callback_tt="building" data-page_id="${id}" data-meta_id="${id.split("#")[0]}" ${b.stored==0 ? ' style="display:none"' : ""} data-size="${length}x${width}">
                    <td data-text="${FH.helper.str.cleanup(meta.name)}">${meta.name}</td>
                    <td>x${b.stored}</td>
                    <td></td>
                    <td data-number="${road}">${reconstruction.roadIcons[road]}</td>
                    <td data-number="${length*100+width}">${length} x</td>
                    <td data-number="${width*100+length}">${width}</td>
                </tr>`
        }
        h +=`</tbody></table>`


        $('#ReconstructionListBody').html(h);
        $('#reconstructionFilter').val(reconstruction.filterValue).on('input', reconstruction.filterBuildings);
        reconstruction.filterBuildings();
        $('#ReconstructionListBody .sortable-table').tableSorter();
        setTimeout(reconstruction.updateTable,200);

    },
    
    addToHammerBar:()=>{
        if ($('#ReconstructionButtons').length === 0) {
            $('#hammerBar').append(`<div id="ReconstructionButtons">
                <span class="barItem" onclick="reconstruction.showTable();">${FH.t('Boxes.ReconstructionList.Button')}</span>
                <span class="barItem" onclick="reconstruction.showMap();">${FH.t('Boxes.ReconstructionMap.Title')}</span>
                </div>`);
        }
    },

    showMap:(stayOpen = false)=>{
        if ( $('#ReconstructionMap').length === 0 ) {
            FH.HTML.Box({
                id: 'ReconstructionMap',
                title: FH.t('Boxes.ReconstructionMap.Title'),
                auto_close: true,
                dragdrop: true,
                minimize: true,
                resize: true,
			    active_maps: "reconstruction",
                settings: reconstruction.mapSettings
            });
        } else if (stayOpen) {
            FH.HTML.CloseOpenBox('ReconstructionMap');
            return;
        }

        let storedUnit = parseInt(FH.Storage.getItem('ReconstructionMapScale') || 80);

        let c = `<div class="map-grid-wrapper" style="--scale:${storedUnit}">
                <div class="map-grid">`;

        for(let area of CityMap.Main.unlockedAreas) {
            let startArea = area.width === 16 ? ' startarea' : '';
            c += `<span class="map-bg${startArea}" style="left:${area.x*reconstruction.mapScale||0}px;top:${area.y*reconstruction.mapScale||0}px;"></span>`
		}

        if (reconstruction.planBuildings) {
            for (let b of reconstruction.planBuildings) {
                c += reconstruction.placePlanBuildingOnMap(b);
            }
        }

        for (let item of Object.values(reconstruction.draft)) {
            c += reconstruction.placeBuildingOnMap(item);
        }

        c += `</div>
        </div>`;
        $('#ReconstructionMapBody').html(c);
        reconstruction.filterBuildings();
    },
    placeBuildingOnMap:(data)=>{
        let meta = FH.Main.CityEntities[FH.Main.CityMapData[data.entityId].cityentity_id];
        if (meta.type.includes("hub") || meta.type === "off_grid" || meta.type === "outpost_ship" || meta.type === "friends_tavern") return '';

        let width = meta.width||meta.components.AllAge.placement.size.x;
        let height = meta.length||meta.components.AllAge.placement.size.y;
        let needsStreet = meta?.components?.AllAge.streetConnectionRequirement?.requiredLevel || meta?.requirements?.street_connection_level || 0;
        let street = needsStreet === 0 ? ' roadless' : '';
        let type = needsStreet === 0 ? 'roadless' : meta.type;
        let matched = reconstruction.isPlanMatch(data.position?.x||0, data.position?.y||0, width, height, type) ? ' matched' : '';
        let c = '';
        if (data.position !== undefined) {
            c += `<span data-id="${data.entityId}" data-text="${meta.name}" data-size="${height + 'x' + width}" data-meta_id="${meta.id}" class="map-building ${meta.type}${street}${matched}" 
                    style="left:${data.position?.x*reconstruction.mapScale||0}px;top:${data.position?.y*reconstruction.mapScale||0}px;
                        width:${width*reconstruction.mapScale}px;height:${height*reconstruction.mapScale}px;">
                </span>`;
        }
        return c;
    },

    placePlanBuildingOnMap:(b)=>{
        return `<span class="map-building-ghost ${b.type}" 
                style="left:${b.x*reconstruction.mapScale}px;top:${b.y*reconstruction.mapScale}px;
                    width:${b.width*reconstruction.mapScale}px;height:${b.height*reconstruction.mapScale}px;">
            </span>`;
    },

    isPlanMatch:(x,y,width,height,type)=>{
        if (!reconstruction.planBuildings) return false;
        return reconstruction.planBuildings.some(b => (b.x === x||0) && (b.y === y||0) && b.width === width && b.height === height && b.type === type);
    },

    loadPlanOverlay: async (planId) => {
        if (!planId) {
            reconstruction.planBuildings = null;
            reconstruction.showMap(true);
            return;
        }
        try {
            let rows = await FH.Main.sendExtMessage({ type: 'Planner.getBuildingList', planId });
            reconstruction.planBuildings = (rows||[])
                .map(row => {
                    let parsed = {};
                    try { parsed = row.JSON ? JSON.parse(row.JSON) : {}; } 
                    catch(e) { parsed = {}; }
                    if (parsed.stored) return null;

                    let meta = FH.Main.CityEntities[parsed.cityentity_id];
                    if (!meta) return null;

                    if (["friends_tavern","impediment","hub_part","off_grid","outpost_ship","hub_main"].includes(meta.type)) return null;

                    let width = meta.width||meta.components.AllAge.placement.size.x;
                    let height = meta.length||meta.components.AllAge.placement.size.y;
                    let type = CityBuildings.needsStreet(meta) === 0 ? 'roadless' : meta.type;

                    return { x: row.x, y: row.y, width, height, type };
                })
                .filter(Boolean);
        } catch (e) {
            console.error('Reconstruction: failed to load plan overlay', e);
            reconstruction.planBuildings = null;
        }
        reconstruction.showMap();
    },
    mapSettings:()=>{
        let storedUnit = parseFloat(FH.Storage.getItem('ReconstructionMapScale') || 80);
        let c = `<select class="scale-view" name="reconstructionscale">
			<option data-scale="50" ${storedUnit === 50 ? 'selected' : ''}>S</option>
			<option data-scale="80" ${storedUnit === 80 ? 'selected' : ''}>M</option>
			<option data-scale="100" ${storedUnit === 110 ? 'selected' : ''}>L</option>
			<option data-scale="156.1" ${storedUnit === 156.1 ? 'selected' : ''}>XL</option>
            </select>
            <br><input type="range" class="opacity" name="opacity" min="0.01" max="1" step="0.01" value="0.9" />
            <br><select class="plan-overlay" name="planoverlay"><option value="">- ${FH.t('Boxes.ReconstructionMap.LoadPlan')} -</option></select>`;

		$('#ReconstructionMapSettingsBox').html(c).promise().done(function() {

            $('#ReconstructionMapSettingsBox .scale-view').on('change', function(){
                let unit = parseFloat($('.scale-view option:selected').data('scale'));
                FH.Storage.setItem('ReconstructionMapScale', unit);
                $('#ReconstructionMapBody .map-grid-wrapper').css('--scale', unit);
            });

            $('#ReconstructionMapSettingsBox .opacity').on('change', function(){
                let val = parseFloat($('#ReconstructionMapSettingsBox .opacity').val());
                $('#ReconstructionMapBody .map-grid-wrapper').css('opacity', val);
            });

            FH.Main.sendExtMessage({ type: 'Planner.getPlanList' }).then(plans => {
                let options = (plans||[]).map(p => `<option value="${p.id}">${FH.helper.str.cleanup(p.name)}</option>`).join('');
                $('#ReconstructionMapSettingsBox .plan-overlay').append(options);
                if (reconstruction.planBuildings && reconstruction.selectedPlanId) {
                    $('#ReconstructionMapSettingsBox .plan-overlay').val(reconstruction.selectedPlanId);
                }
            }).catch(e => console.error('Reconstruction: failed to load plan list', e));

            $('#ReconstructionMapSettingsBox .plan-overlay').on('change', function(){
                let planId = $(this).val();
                reconstruction.selectedPlanId = planId || null;
                reconstruction.loadPlanOverlay(planId ? parseInt(planId) : null);
            });

        });
    }
}