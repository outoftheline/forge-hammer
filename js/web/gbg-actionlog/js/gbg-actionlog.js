/*
 * *************************************************************************************
 *
 * Copyright (C) 2022 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * *************************************************************************************
 */

FoEproxy.addHandler('GuildBattlegroundService', 'getActions', (data, postData) => {
    GBGActionLog.loadActionLog(undefined, data.responseData);
});

let GBGActionLog = {
    windowId: "GBGActionLog",
    db: null, // Indexed database
	dbLoadedFl: new Promise(resolve => window.addEventListener('foe-helper#gbgDBloaded', resolve, {capture: false, once: true, passive: true})),

	/**
	*
	* @returns {Promise<void>}
	*/
	checkForDB: async (playerID) => {
		const DBName = `FoeHelperDB_GBG_${playerID}`;

		GBGActionLog.db = new Dexie(DBName);

		GBGActionLog.db.version(1).stores({
			ActionLog: '++id,mapId,provinceId,actionCode,actionUTCTimestamp,buildingId,actorType,actorName'
		});

		GBGActionLog.db.open();
		window.dispatchEvent(new CustomEvent('foe-helper#gbgDBloaded'))
	},

    /**
     * Loads the "log data". Normally when opening the GBG log window, but as a backup plan, 
     *   user might be able to use this to load logs from saved logs (from file? TODO)
     * @param {string} mapId The map (id/code) for the logs. Defaults to GuildFights.MapData.map['id']
     * @param {Array} actionLogs Array of "action logs" when opening the GBG log window
     */
    loadActionLog: async (mapId = GuildFights.MapData.map['id'], actionLogs) => {
        let lastRowUTCTimestamp = 0,
            lastLoadedUTCTimestamp = 0;

        // Get the last UTC time, only rows higher than this will be inserted
        // TODO: "Edge case"; 2 different actions in the same second, log is opened between the 2, 2nd option will be skipped?
        //       Compare using not ">" but ">=" and check the content? If it's different, it's safe to insert
        await GBGActionLog.db['ActionLog'].orderBy('actionUTCTimestamp').last().then((lastRow) => {
            lastRowUTCTimestamp = lastRow.actionUTCTimestamp || 0;
        }).catch(() => {
    
        });
    
        let loggedActionCnt = 0,
            toastType = 'success'
            toastText = [];

        // Sorting the actions is probably not needed, it *should be* sorted, but...just-to-be-sure.
        for (logItem of actionLogs.sort((i1, i2) => i2["time"] - i1["time"])) {
            if (logItem["time"] > lastRowUTCTimestamp) {
                loggedActionCnt++;
                lastLoadedUTCTimestamp = logItem["time"]
                //#region Handle Actors 
                /* When taking a sector from another guild, actors might have 2 entries:
                *   1) One for from which guild the sector was taken from
                *   2) Who flipped the sector
                * For example:
                * {
                *     "provinceId": 17,
                *     "action": "province_conquered",
                *     "time": 1703850559,
                *     "date": "today at 6:49 am",
                *     "actors": [
                *         {
                *             "type": "guild",
                *             "name": "<Guild Name>",
                *             "__class__": "GuildBattlegroundActionActor"
                *         },
                *         {
                *             "type": "player",
                *             "name": "<Player Name>",
                *             "__class__": "GuildBattlegroundActionActor"
                *         }
                *     ],
                *     "__class__": "GuildBattlegroundActionEntry"
                * }
                * To more easily process the data, what is "1 row" in the game/gbg log, will be 2 rows in the database/table
                */
                //#endregion        
                for (actor of logItem["actors"]) {
                    GBGActionLog.insertIntoActionLog({
                        mapId: mapId,
                        provinceId: logItem["provinceId"] || 0, // id=0 isn't provided (e.g. missing for A1 sector)
                        actionCode: logItem["action"],
                        actionUTCTimestamp: logItem["time"],
                        buildingId: logItem["buildingId"],
                        actorType: actor["type"], // as of now, can be "player" or "guild"
                        actorName: actor["name"],  // only the name is present here, no id
                        // When an event contains multiple actors (who took which guild's sector), it will get the same number/index,
                        //   therefore it can be groupped together later on as needed
                        eventGroupIdx: loggedActionCnt
                    });
                }
            } else {
                // Once we reached an action/item with older timestamp, STOP
                break;
            }
        }

        if (loggedActionCnt == 200) {
            toastType = 'warning';
        }

        toastText.push(`Number of logs loaded: ${loggedActionCnt}.`); // TODO: i18n
        toastText.push(`Previous load end time: ${moment.utc(lastRowUTCTimestamp * 1000).local().format("YYYY.MM.DD HH:mm:ss")}`);

        if (loggedActionCnt > 0) {
            toastText.push(`Current load end time: ${moment.utc(lastLoadedUTCTimestamp * 1000).local().format("YYYY.MM.DD HH:mm:ss")}`);
        }

        toastText.push("**Do not forget to reopen the GBG map to load new logs!**");

        HTML.ShowToastMsg({
            head: "GBG Action Log", // TODO: i18n
            text: toastText,
            type: toastType,
            hideAfter: 12000, // TOOD: For how long this should be displayed? Might be very useful when the loaded cnt = 200...
        });
    },

	/**
	 * @param data the data to add to the ActionLog table
	 */
	insertIntoActionLog: async (data) => {
		await GBGActionLog.dbLoadedFl;
        await GBGActionLog.db.ActionLog.add(data);

	},

    /**
     * Returns the topN amount of rows (ordered by actionUTCTimestamp)
     * @param {*} topN Number of rows to return
     * @returns Array of rows from the ActionLog table
     */
    getLastNActionLog: async (topN = 200) => {
        return GBGActionLog.db.ActionLog.orderBy('actionUTCTimestamp').reverse().limit(topN).toArray();
    },

    /**
     * Shows the ActionLog Window
     */
	showLogWindow: async () => {
		$(`#${GBGActionLog.windowId}`).remove();

		// Don't create a new box while another one is still open
		if ($(`#${GBGActionLog.windowId}`).length === 0) {
			HTML.Box({
				id: GBGActionLog.windowId,
				title: i18n('Boxes.GBGActionLog.title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize : true,
			});
			HTML.AddCssFile('gbg-actionlog');
		}

        let tableColumns = ['Sector', 'ActionCode', 'ActionTime', 'Building', 'ActorType', 'ActorName'];

		let h ='<table class="foe-table">';
        // Header Row
        h += '<tr>'
        for(const col of tableColumns) {
            let i18nKey = `Boxes.GBGActionLog.${col}`;
		    h += `<th>${i18n(i18nKey)}</th>`
        }
        h += '</tr>'

        // Table body
		for (let row of await GBGActionLog.getLastNActionLog()) {
            let sectorName = ProvinceMap.SectorMapping[row["mapId"]][row["provinceId"]]["short"],
                actionTimeStr = moment.utc(row["actionUTCTimestamp"] * 1000).local().format("YYYY.MM.DD HH:mm:ss"),
                buildingName = GBGBuildings.BuildingData[row["buildingId"]]?.name || "";

			h +='<tr>';
            h +=`<td>${sectorName}</td>`;
            h +=`<td>${row["actionCode"]}</td>`;
            h +=`<td>${actionTimeStr}</td>`;
            h +=`<td>${buildingName}</td>`;
            h +=`<td>${row["actorType"]}</td>`;
            h +=`<td>${row["actorName"]}</td>`;
			h +='</tr>';
		}
		h += '</table>';
		$(`#${GBGActionLog.windowId}Body`).html(h);

    }
}