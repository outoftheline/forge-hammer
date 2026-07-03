
/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

FH.proxy.addHandler('RankingService', 'getRanking', (data, postData) => {
    if (data.responseData.category.value != "great_building" || $('#findGBDialog').length === 0) return;
    findGB.check(data.responseData.rankings);
});
FH.proxy.addHandler('GreatBuildingsService', 'getOtherPlayerOverview', (data, postData) => {
    if ($('#findGBDialog').length === 0) return;
    findGB.check(data.responseData);
});

let findGB = {
    list:[],
    found:[],

    init: async () => {
        await FH.ExistenceConfirmed("FH.Main.CityEntities")
        for (let building of Object.values(FH.Main.CityEntities)) {
            if(building.type != "greatbuilding") continue;
            findGB.list.push(building.name);
        }
        findGB.list.sort()
    },

    ShowDialog: () => {
        
		if ($('#findGBDialog').length > 0){
			FH.HTML.CloseOpenBox('findGBDialog');

			return;
		}

        if ($('#findGBDialog').length === 0) {
            FH.HTML.AddCssFile('findGB');

            FH.HTML.Box({
                id: 'findGBDialog',
                title: FH.t('Boxes.findGB.Title'),
                auto_close: true,
                dragdrop: true,
                minimize: true,
                resize: true,
            });
        }
        
        html = ``;
        html += `<table class="dark-bg w-full"><tr>`;
        html += `<td><select id="GBselect">`;
        html += `<option value="" disabled selected>${FH.t("Boxes.findGB.selectGB")}</option>`
        for (i of findGB.list) {
            html += `<option value="${i}">${i}</option>`
        }
        html += `</select></td>`;
        html += `<td><input type="number" id="GBminLevel" min="0" max ="998" placeholder="${FH.t("Boxes.findGB.minLvl")}"></td>`;
        html += `<td><input type="number" id="GBmaxLevel" min="1" max ="999" placeholder="${FH.t("Boxes.findGB.maxLvl")}"></td></tr><tr>`;
        html += `<td><input type="checkbox" id="GBhasProgress"><label for="GBhasProress">${FH.t("Boxes.findGB.hasProgress")}</label></td>`;
        html += `<td colspan="2"><input type="button" id="findGBreset" class="btn" value="${FH.t("General.Reset")}"></input></td>`;
        html += `</tr></table>`;
        html += `<table id="foundGB" class="foe-table"><thead class="sticky"><tr><th>${FH.t("General.Player")}</th><th>${FH.t("General.GB")}</th><th>${FH.t("General.Level")}</th></tr></thead>`
        
        for (i of findGB.found) {
            html += findGB.row(i)
        }
        html += `</table>`
        
        $('#findGBDialogBody').html(html);
        $('#findGBreset').click(() => {
            findGB.found=[];
            findGB.ShowDialog();
        });
    },

    check: (data) => {
        let name = $('#GBselect option:selected')[0].value;
        if (name == "") return;
        let min = $('#GBminLevel')[0].value;
        let max = $('#GBmaxLevel')[0].value;
        let p = $('#GBhasProgress')[0].checked;
        if (min =='') min=0;
        if (max =='') max=1000;
        if (min > max) [min,max]=[max, min];
        for (let GB of data) {
            let progress = Math.round((((GB.points || 0) + (GB.current_progress || 0))/((GB.requiredPoints || 0) + (GB.max_progress || 0)) || 0)*100);
            if (GB.name == name && GB.level>=min && GB.level<=max && ((p && progress > 0) || !p)) {
                let testGB = {player: GB.player.name, GB: GB.name, level: GB.level, playerID:GB.player.player_id, progress:progress}
                if (!findGB.found.find(obj => obj.player==testGB.player && obj.GB==testGB.GB && obj.level==testGB.level)) {
                    findGB.found.push(testGB);
                    $('#foundGB').append(findGB.row(testGB));
                }
            }   
        }
    },

    row: (i) => {
        return `<tr><td>${FH.Main.GetPlayerLink(i.playerID,i.player)}</td><td>${i.GB}</td><td class="progress" style="--p:${i.progress}%">${i.level}</td></tr>`
    }
};

findGB.init();
