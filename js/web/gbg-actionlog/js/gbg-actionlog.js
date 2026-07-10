/*
 * Copyright (C) 2026 Forge Hammer & Arklur
 * See LICENSE.md for full license details.
 */

FH.proxy.addHandler('GuildBattlegroundService', 'getActions', (data, postData) => {
    GBGActionLog.loadActionLog(undefined, data.responseData);
    
	let container = $('#GBGActionLogCount');
	if (container.length !== 0)
		container.html(GBGActionLog.refreshMenuBadge(0));
});

let GBGActionLog = {
    windowId: "GBGActionLog",
    Tabs: [],
    TabsContent: [],
    loadedTabs: {}, // tab id -> true once built (lazy per-tab loading; only the active tab loads on open)
    db: null, // Indexed database
	dbLoadedFl: new Promise(resolve => window.addEventListener('foe-helper#gbgDBloaded', resolve, {capture: false, once: true, passive: true})),

	// User settings (persisted in FH.Storage; formats fall back to the language file's Date/DateTime)
	settingKeys: {
		toast:    'GBGActionLogToastSeconds',
		date:     'GBGActionLogDateFormat',
		dateTime: 'GBGActionLogDateTimeFormat',
		redHours: 'GBGActionLogRedAfterHours',   // HUD badge turns red once this many hours pass since the last collection
		collected:'GBGActionLogLastCollected',   // state: unix time of the last log collection (drives the HUD badge)
	},

	/** Default hours after which the HUD badge turns red */
	defaultRedHours: 8,

	/** Seconds the "new entries" toast stays up; 0 => no toast */
	toastSeconds: () => {

		let v = FH.Storage.getItem(GBGActionLog.settingKeys.toast)
           ,defaultToastShowSeconds = 3;

		if (v === null || v === '') return defaultToastShowSeconds;
		let n = parseInt(v, 10);
		return isNaN(n) || n < 0 ? defaultToastShowSeconds : n;
	},

	/** Hours since the last collection after which the HUD badge turns red (default 8) */
	redAfterHours: () => {
		let n = parseInt(FH.Storage.getItem(GBGActionLog.settingKeys.redHours), 10);
		return isNaN(n) || n < 1 ? GBGActionLog.defaultRedHours : n;
	},

	/** Unix time (seconds) of the last log collection, or 0 if never collected */
	lastCollected: () => {
		let n = parseInt(FH.Storage.getItem(GBGActionLog.settingKeys.collected), 10);
		return isNaN(n) ? 0 : n;
	},

	/**
	 * shows the whole hours elapsed since the last collection, coloured red once that
     * reaches the configured threshold. Hidden until the first collection. 
	 */
	refreshMenuBadge: (hours = false) => {
		let last = GBGActionLog.lastCollected();
		if (!last) return '';

        if (hours === false)
		    hours = Math.floor((moment().unix() - last) / 3600);
        if (hours > 0)
		    return `<span data-number="${hours}" class="hammer-counter ${hours >= GBGActionLog.redAfterHours() ? `counter-red` : ``}">
                    ${hours}
                    </span>`;
        return '';
	},

	/** moment format for date columns (default: language file 'Date') */
	dateFormat: () => FH.Storage.getItem(GBGActionLog.settingKeys.date) || FH.t('Date'),

	/** moment format for date+time columns (default: language file 'DateTime') */
	dateTimeFormat: () => FH.Storage.getItem(GBGActionLog.settingKeys.dateTime) || FH.t('DateTime'),

	// Timezone: reuse GuildFights' server-time setting so dates match its display. serverOffset is minutes (local − server).
	/** True when GuildFights' "show server time" toggle is on (LiveFightSettings.showServerTime === 1) */
	useServerTime: () => {
		try { return JSON.parse(FH.Storage.getItem('LiveFightSettings'))?.showServerTime === 1; }
		catch (e) { return false; }
	},

	/** GuildFights' server offset in minutes (local − server); 0 when unset/unknown */
	serverOffset: () => (typeof GuildFights !== 'undefined' && GuildFights.serverOffset) || 0,

	/** moment for an epoch (seconds) in the display timezone: server time when the toggle is on, else local */
	tsMoment: (ts) => {
		let m = moment.utc(ts * 1000).local();
		if (GBGActionLog.useServerTime()) m.subtract(GBGActionLog.serverOffset(), 'minutes');
		return m;
	},

	/** "Now" in the display timezone (see tsMoment); basis for the default date ranges */
	nowMoment: () => {
		let m = moment();
		if (GBGActionLog.useServerTime()) m.subtract(GBGActionLog.serverOffset(), 'minutes');
		return m;
	},

	/** Converts a display-timezone moment back to its absolute epoch (seconds), undoing the server-time shift */
	toEpoch: (m) => (GBGActionLog.useServerTime() ? m.add(GBGActionLog.serverOffset(), 'minutes') : m).unix(),

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

		// v2: per-collection batch log (logCount === 200 => the game's 200-entry cap was hit, so data before firstLogTime may be missing)
		GBGActionLog.db.version(2).stores({
			ActionLog: '++id,mapId,provinceId,actionCode,actionUTCTimestamp,buildingId,actorType,actorName',
			ActionLogBatch: '++id,mapId,logDate,firstLogTime,lastLogTime,logCount,totalReturned'
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
        GBGActionLog.snapshotBuildingNames(); // in GBG now => keep building names for later lookups

        let lastRowUTCTimestamp = 0,
            lastLoadedUTCTimestamp = 0,
            newestLoadedUTCTimestamp = 0;

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
                if (newestLoadedUTCTimestamp === 0) newestLoadedUTCTimestamp = logItem["time"]; // first new item = newest (list is sorted desc)
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

        // Record this collection so missing-data gaps can be spotted later (logCount === 200 => cap was hit)
        if (loggedActionCnt > 0) {
            GBGActionLog.db.ActionLogBatch.add({
                mapId: mapId,
                logDate: moment().unix(),               // when this batch was collected
                firstLogTime: lastLoadedUTCTimestamp,   // oldest new entry in this batch
                lastLogTime: newestLoadedUTCTimestamp,  // newest new entry in this batch
                logCount: loggedActionCnt,
                totalReturned: actionLogs.length
            });
        }

        let toastSeconds = GBGActionLog.toastSeconds();
        if (toastSeconds > 0) {
            let dtFmt = GBGActionLog.dateTimeFormat();
            toastText.push(`${FH.t('Boxes.GBGActionLog.Toast.LogsLoaded')}: ${loggedActionCnt}.`);
            toastText.push(`${FH.t('Boxes.GBGActionLog.Toast.PrevLoadTime')}: ${GBGActionLog.tsMoment(lastRowUTCTimestamp).format(dtFmt)}`);

            if (loggedActionCnt > 0) {
                toastText.push(`${FH.t('Boxes.GBGActionLog.Toast.CurrLoadTime')}: ${GBGActionLog.tsMoment(lastLoadedUTCTimestamp).format(dtFmt)}`);
            }

            toastText.push(FH.t('Boxes.GBGActionLog.Toast.Reopen'));

            FH.HTML.ShowToastMsg({
                head: FH.t('Boxes.GBGActionLog.title'),
                text: toastText,
                type: toastType,
                hideAfter: toastSeconds * 1000,
            });
        }
    },

	/**
	 * @param data the data to add to the ActionLog table
	 */
	insertIntoActionLog: async (data) => {
		await GBGActionLog.dbLoadedFl;
        await GBGActionLog.db.ActionLog.add(data);

	},

    /**
     * Returns the rows whose actionUTCTimestamp is within [startTs, endTs] (epoch seconds, inclusive)
     * @param {number} startTs Range start (epoch seconds)
     * @param {number} endTs Range end (epoch seconds)
     * @returns Array of rows from the ActionLog table, newest first
     */
    getActionLogByDateRange: async (startTs, endTs) => {
        return GBGActionLog.db.ActionLog.where('actionUTCTimestamp').between(startTs, endTs, true, true).reverse().toArray();
    },

    /**
     * Returns the collection batches whose logDate is within [startTs, endTs] (epoch seconds, inclusive), newest first
     * @param {number} startTs Range start (epoch seconds)
     * @param {number} endTs Range end (epoch seconds)
     * @returns Array of rows from the ActionLogBatch table
     */
    getActionLogBatchesByDateRange: async (startTs, endTs) => {
        return GBGActionLog.db.ActionLogBatch.where('logDate').between(startTs, endTs, true, true).reverse().toArray();
    },

    /**
     * Distinct action codes across the whole log (indexed), used to build the Report tab's action filter
     * @returns Array of actionCode strings
     */
    getDistinctActionCodes: async () => {
        return GBGActionLog.db.ActionLog.orderBy('actionCode').uniqueKeys();
    },

    /**
     * Default window shown on open: previous day 00:00 -> current day 23:59 (local),
     * formatted for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
     */
    defaultRange: () => ({
        from: GBGActionLog.nowMoment().subtract(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm'),
        to: GBGActionLog.nowMoment().endOf('day').format('YYYY-MM-DDTHH:mm'),
    }),

    /**
     * Report tab default range: one week before today .. today, formatted for <input type="date"> ("YYYY-MM-DD")
     */
    defaultReportRange: () => ({
        from: GBGActionLog.nowMoment().subtract(1, 'week').format('YYYY-MM-DD'),
        to: GBGActionLog.nowMoment().format('YYYY-MM-DD'),
    }),

    /**
     * Activity tab default range: two weeks before today .. today, formatted for <input type="date"> ("YYYY-MM-DD")
     */
    defaultActivityRange: () => ({
        from: GBGActionLog.nowMoment().subtract(2, 'week').format('YYYY-MM-DD'),
        to: GBGActionLog.nowMoment().format('YYYY-MM-DD'),
    }),

    /**
     * Batches tab default range
     */
    defaultBatchesRange: () => ({
        from: GBGActionLog.nowMoment().subtract(2, 'day').startOf('day').format('YYYY-MM-DDTHH:mm'),
        to: GBGActionLog.nowMoment().endOf('day').format('YYYY-MM-DDTHH:mm'),
    }),

    /**
     * Caps a From/To window to a maximum width (amount, unit), keeping the end the user just
     * edited: anchor 'to' (default) pulls "from" forward to to − cap; anchor 'from' pushes "to"
     * back to from + cap. Only the moved end is reformatted via fmt.
     * @returns {{from:string,to:string,clamped:boolean}}
     */
    clampRange: (from, to, amount, unit, fmt, anchor = 'to') => {
        if (anchor === 'from' && from) {
            let maxTo = moment(from).add(amount, unit),
                effTo = to ? moment(to) : moment(),
                clamped = effTo.isAfter(maxTo);
            if (clamped) to = maxTo.format(fmt);
            return { from, to, clamped };
        }
        let toM = to ? moment(to) : moment(),
            minFrom = toM.clone().subtract(amount, unit),
            clamped = !from || moment(from).isBefore(minFrom);
        if (clamped) from = minFrom.format(fmt);
        return { from, to, clamped };
    },

    /**
     * After clampRange flags an over-wide window, snap it to exactly 14 full days from the kept end
     * (start 00:00, end 23:59). Shared by the Details and Batches tabs so both 2-week caps match.
     * @returns {{from:string,to:string}} in "YYYY-MM-DDTHH:mm"
     */
    snapTwoWeeks: (from, to, fromAnchored) => {
        if (fromAnchored) {
            from = moment(from).startOf('day').format('YYYY-MM-DDTHH:mm');
            to = moment(from).add(13, 'day').endOf('day').format('YYYY-MM-DDTHH:mm');
        } else {
            to = (to ? moment(to) : moment()).endOf('day').format('YYYY-MM-DDTHH:mm');
            from = moment(to).subtract(13, 'day').startOf('day').format('YYYY-MM-DDTHH:mm');
        }
        return { from, to };
    },

    /** Warns (toast) that a selected range was too wide, showing the corrected window */
    notifyRangeCapped: (msg, from, to) => {
        FH.HTML.ShowToastMsg({
            head: FH.t('Boxes.GBGActionLog.RangeCapTitle'),
            text: [msg, `${from} - ${to}`],
            type: 'warning',
            hideAfter: 5000,
        });
    },

    /** Action codes hidden from the Report tab's action filter (not player-related) */
    reportExcludedActions: ['province_lost'],

    /** Report action dropdown button label: the single action's name, else "Action (N)" */
    reportActionLabel: (actions) =>
        actions.length === 1 ? GBGActionLog.actionName(actions[0])
                             : `${FH.t('Boxes.GBGActionLog.ActionCode')} (${actions.length})`,

    /** i18n with an explicit fallback, since FH.t() echoes the key back when it's missing */
    i18nOr: (key, fallback) => {
        let t = FH.t(key);
        return t === key ? fallback : t;
    },

    actionName:    (code) => GBGActionLog.i18nOr(`Boxes.GBGActionLog.Action.${code}`, code),
    mapName:       (id)   => GBGActionLog.i18nOr(`Boxes.GBGActionLog.Map.${id}`, id),
    actorTypeName: (type) => GBGActionLog.i18nOr(`Boxes.GBGActionLog.ActorType.${type}`, type),

    /** <img> marking an actor as player vs. guild (empty for any other actor type) */
    actorIconImg: (type, name) => {
        let link = type === 'player' ? srcLinks.get("/guild_battlegrounds/log/log_player_icon.png", true)
                 : type === 'guild'  ? srcLinks.get("/shared/icons/event_window/eventwindow_guild_b.png", true)
                 : '';
        return link ? `<img class="gbgal-cell-icon" src="${link}" title="${name}">` : '';
    },

    /** localStorage key for the GBGBuildings id->name snapshot */
    buildingNamesKey: 'GBGActionLogBuildingNames',

    /**
     * Snapshots GBGBuildings.BuildingData (id -> name) into storage, merging with what's already there.
     * BuildingData is only populated while in GBG, so this keeps names resolvable later (e.g. window opened outside GBG).
     */
    snapshotBuildingNames: () => {
        if (typeof GBGBuildings === 'undefined' || !GBGBuildings.BuildingData) return;
        let store = GBGActionLog.loadBuildingNames();
        for (let id in GBGBuildings.BuildingData) {
            let name = GBGBuildings.BuildingData[id] && GBGBuildings.BuildingData[id].name;
            if (name) store[id] = name;
        }
        FH.Storage.setItem(GBGActionLog.buildingNamesKey, JSON.stringify(store));
    },

    /** The stored id->name snapshot (see snapshotBuildingNames) */
    loadBuildingNames: () => {
        try { return JSON.parse(FH.Storage.getItem(GBGActionLog.buildingNamesKey) || '{}'); }
        catch (e) { return {}; }
    },

    /** Building display name: live GBGBuildings first, else the stored snapshot */
    buildingName: (id, snapshot) => {
        let data = typeof GBGBuildings !== 'undefined' && GBGBuildings.BuildingData,
            live = data && data[id] && data[id].name;
        return live || (snapshot && snapshot[id]) || '';
    },

    /** Colour class for the Building cell by type (barracks/outpost/camp share one colour each, regardless of tier); '' for the rest */
    buildingTypeClass: (id) => {
        if (!id) return '';
        if (id.includes('barracks'))     return 'gbgal-bld-barracks';
        if (id.includes('outpost'))      return 'gbgal-bld-outpost';
        if (id.includes('command_post')) return 'gbgal-bld-camp';
        return 'gbgal-bld-other';
    },

    /** Colour class for the Action cell: good (green), bad (red), neutral (amber); '' => swatch falls back to the font colour */
    actionCodeClass: (code) => {
        switch (code) {
            case 'building_placed':      return 'gbgal-act-bld-placed';
            case 'building_destroyed':   return 'gbgal-act-bld-dstr';
            case 'province_conquered':   return 'gbgal-act-prov-conq';
            case 'province_lost':        return 'gbgal-act-prov-lost';
            case 'attacked_ignored':     return 'gbgal-act-att-ign';
            default:                     return 'gbgal-act-other';
        }
    },

    /**
     * Excel-style column filter: a button that opens a popup holding the control(s).
     * type: 'select' (exact dropdown) | 'text' (substring) | 'between' (client datetime range) | 'query' (datetime range that re-queries the DB)
     * @param {number} idx column index, matched by filterTable against the row cells
     * @param {object} opts { options:[], fromVal, toVal, active }
     */
    filterControl: (idx, type, opts = {}) => {
        if (!type) return '';

        let inner = '';
        if (type === 'select') {
            inner = '<select class="gbg-log-filter"><option value=""></option>';
            for (let v of opts.options) inner += `<option value="${v}">${v}</option>`;
            inner += '</select>';
        } else if (type === 'multiselect') {
            // Checkbox list; a row matches when its cell value is among the checked ones (none checked => no filter)
            for (let v of opts.options) inner += `<label><input type="checkbox" class="gbg-log-filter" value="${v}"> ${v}</label>`;
        } else if (type === 'text') {
            inner = '<input type="text" class="gbg-log-filter">';
        } else if (type === 'between') {
            inner = `<label>${FH.t('Boxes.GBGActionLog.From')}: <input type="datetime-local" class="gbg-log-filter gbg-flt-from"></label>`
                  + `<label>${FH.t('Boxes.GBGActionLog.To')}: <input type="datetime-local" class="gbg-log-filter gbg-flt-to"></label>`;
        } else if (type === 'numrange') {
            inner = `<label>${FH.t('Boxes.GBGActionLog.From')}: <input type="number" class="gbg-log-filter gbg-flt-from"></label>`
                  + `<label>${FH.t('Boxes.GBGActionLog.To')}: <input type="number" class="gbg-log-filter gbg-flt-to"></label>`;
        } else if (type === 'query') {
            // Class pair defaults to the Details tab's; the Batches tab passes its own so the two query popups don't clash
            let fromCls = opts.fromClass || 'gbg-log-from',
                toCls = opts.toClass || 'gbg-log-to';
            inner = `<label>${FH.t('Boxes.GBGActionLog.From')}: <input type="datetime-local" class="${fromCls}" value="${opts.fromVal || ''}"></label>`
                  + `<label>${FH.t('Boxes.GBGActionLog.To')}: <input type="datetime-local" class="${toCls}" value="${opts.toVal || ''}"></label>`;
        }

        let match = type === 'select' ? 'exact' : type,
            active = opts.active ? ' gbg-flt-on' : '';
        return `<button type="button" class="gbg-log-filterbtn${active}" title="${FH.t('Boxes.GBGActionLog.Filter')}">▾</button>`
             + `<div class="gbg-log-popup" data-col="${idx}" data-match="${match}" style="display:none">${inner}</div>`;
    },

    /** Wires sorting + the filter-popup/reset clicks onto a freshly built table */
    initTable: ($table) => {
        // These run before tableSorter's header-click handler (they match closer to the target),
        // so clicking a filter button / popup never triggers a column sort.
        $table.on('click', '.gbg-log-filterbtn', GBGActionLog.onFilterBtnClick);
        $table.on('click', '.gbg-log-popup', function (e) { e.stopImmediatePropagation(); });
        $table.tableSorter();
    },

    /** Toggles the clicked column's filter popup (one open at a time) */
    onFilterBtnClick: function (e) {
        e.stopImmediatePropagation();
        let $popup = $(this).siblings('.gbg-log-popup'),
            wasOpen = $popup.is(':visible'),
            reloaded = GBGActionLog.hideAllPopups();
        if (!wasOpen && !reloaded) $popup.show();
    },

    /** Hides every open popup; applies the date-range (query) popup if one was open. Returns true if that triggered a reload. */
    hideAllPopups: () => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (!box) return false; // window already closed
        // At most one popup is open at a time; find the open query popup (Details or Batches) before hiding
        let openQuery = [...box.querySelectorAll('.gbg-log-popup[data-match="query"]')].find(p => $(p).is(':visible'));

        $(box).find('.gbg-log-popup').hide();
        if (!openQuery) return false;
        return openQuery.querySelector('.gbg-batch-from')
            ? GBGActionLog.applyBatchesTimeRange()
            : GBGActionLog.applyTimeRange();
    },

    /** Menu button handler: open the window, or close it if it's already open */
    toggleWindow: () => {
        if ($(`#${GBGActionLog.windowId}`).length > 0) return FH.HTML.CloseOpenBox(GBGActionLog.windowId);
        GBGActionLog.showLogWindow();
    },

    /** Full-body spinner overlay (reuses the global .loading-data / .loadericon) shown during the initial load */
    showLoading: () => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (box && !document.getElementById('gbgalLoading')) {
            $(box).append('<div id="gbgalLoading" class="loading-data"><div class="loadericon"></div></div>');
        }
    },

    /** Removes the loading overlay (fades out) */
    hideLoading: () => {
        $('#gbgalLoading').fadeOut(300, function () { $(this).remove(); });
    },

    /**
     * Shows the ActionLog Window
     */
	showLogWindow: async () => {
		$(`#${GBGActionLog.windowId}`).remove();

		// Don't create a new box while another one is still open
		if ($(`#${GBGActionLog.windowId}`).length === 0) {
			FH.HTML.Box({
				id: GBGActionLog.windowId,
				title: FH.t('Boxes.GBGActionLog.title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize : true,
				settings: GBGActionLog.showSettings,
			});
			FH.HTML.AddCssFile('gbg-actionlog');
		}

        GBGActionLog.Tabs = [];
        GBGActionLog.TabsContent = [];
        GBGActionLog.loadedTabs = {};
        GBGActionLog.SetTabs('gbgalDetails', FH.t('Boxes.GBGActionLog.TabDetails'));
        GBGActionLog.SetTabs('gbgalReport', FH.t('Boxes.GBGActionLog.TabPlayerDailyReport'));
        GBGActionLog.SetTabs('gbgalBatches', FH.t('Boxes.GBGActionLog.TabBatches'));
        GBGActionLog.SetTabs('gbgalActivity', FH.t('Boxes.GBGActionLog.TabActivity'));
        // Tab bodies are filled lazily by loadTab() (Details on open, the rest when first selected)
        GBGActionLog.SetTabContent('gbgalDetails', '<div id="gbgalDetailsTable"></div>');
        GBGActionLog.SetTabContent('gbgalReport', '');
        GBGActionLog.SetTabContent('gbgalBatches', '');
        GBGActionLog.SetTabContent('gbgalActivity', '');

        let h = '<div class="gbgal-tabs tabs">' + GBGActionLog.GetTabs() + GBGActionLog.GetTabContent() + '</div>';
        let $body = $(`#${GBGActionLog.windowId}Body`);
        $body.html(h);

        // Client-side column filters (delegated, survive rebuilds); filter-button/sort clicks are wired per-table in initTable()
        $body.on('input change', '.gbg-log-filter', function () { GBGActionLog.filterTable(this); });
        // Report tab: own date range + action filter, re-query the DB independently of the Details tab
        $body.on('change', '.gbg-report-from, .gbg-report-to, .gbg-report-action', function () {
            let anchor = this.classList.contains('gbg-report-from') ? 'from'
                       : this.classList.contains('gbg-report-to')   ? 'to' : undefined;
            GBGActionLog.reloadReport(anchor);
        });
        // Activity tab: own date range + action filter + metric selector, re-query independently
        $body.on('change', '.gbg-activity-from, .gbg-activity-to, .gbg-activity-action, .gbg-activity-metric', function () {
            let anchor = this.classList.contains('gbg-activity-from') ? 'from'
                       : this.classList.contains('gbg-activity-to')   ? 'to' : undefined;
            // Metric is single-select: close its dropdown after choosing (like the old native select)
            if (this.classList.contains('gbg-activity-metric')) {
                let dd = this.closest('.dropdown'),
                    cb = dd && dd.querySelector('.dropdown-checkbox');
                if (cb) cb.checked = false;
            }
            GBGActionLog.reloadActivity(anchor);
        });
        $body.on('click', '.gbg-log-export', function () { GBGActionLog.exportCsv(this.dataset.table, this.dataset.file); });
        $body.on('click', '.gbg-log-reset', function () { GBGActionLog.reset(); });
        $(document).off('click.gbgal').on('click.gbgal', (e) => {
            // Window closed → unbind this leaked global handler
            if (!document.getElementById(`${GBGActionLog.windowId}Body`)) {
                $(document).off('click.gbgal');
                return;
            }
            let $t = $(e.target);
            // Action dropdown (.dropdown component, Report + Activity tabs): stays open while interacting inside it; outside click unchecks it
            if ($t.closest('.gbgal-action-dd').length) return;
            document.querySelectorAll(`#${GBGActionLog.windowId}Body .gbgal-action-dd .dropdown-checkbox`).forEach(cb => cb.checked = false);
            if ($t.closest('.gbg-log-popup, .gbg-log-filterbtn, .gbg-log-reset').length) return;
            GBGActionLog.hideAllPopups();
        });

        // Init tabs first so the active tab highlights immediately; the tables fill in once the DB loads
        $body.find('.gbgal-tabs').tabslet({ active: 1 });

        // Lazy-load each tab the first time it's shown, so expensive tabs don't slow down opening the window
        $body.find('.gbgal-tabs > ul > li').on('_before', function () {
            GBGActionLog.loadTab($(this).find('a').attr('href').slice(1));
        });

        // Only the active Details tab builds on open; the rest build when first selected
        await GBGActionLog.loadTab('gbgalDetails');
    },

    /**
     * Builds a tab's content the first time it's shown (lazy). Details builds when the window opens;
     * Report / Batches / Activity build only when first selected, keeping the window fast to open.
     * The full-body spinner plays while the tab builds.
     */
    loadTab: async (tabId) => {
        if (GBGActionLog.loadedTabs[tabId]) return;
        GBGActionLog.loadedTabs[tabId] = true; // mark up front so a re-click won't build it twice

        GBGActionLog.showLoading();
        try {
            if (tabId === 'gbgalDetails') {
                let d = GBGActionLog.defaultRange();
                await GBGActionLog.reload(d.from, d.to);
            } else if (tabId === 'gbgalReport') {
                await GBGActionLog.initReport();
            } else if (tabId === 'gbgalBatches') {
                let bd = GBGActionLog.defaultBatchesRange();
                await GBGActionLog.reloadBatches(bd.from, bd.to);
            } else if (tabId === 'gbgalActivity') {
                await GBGActionLog.initActivity();
            }
        } catch (e) {
            GBGActionLog.loadedTabs[tabId] = false; // let a later click retry a failed build
            throw e;
        } finally {
            GBGActionLog.hideLoading();
        }
    },

    /** Settings popup (wrench icon): toast duration + the date / date-time formats used in the tables */
    showSettings: () => {
        let seconds = GBGActionLog.toastSeconds(),
            redHours = GBGActionLog.redAfterHours(),
            dateFmt = FH.Storage.getItem(GBGActionLog.settingKeys.date) || '',
            dateTimeFmt = FH.Storage.getItem(GBGActionLog.settingKeys.dateTime) || '';

        let h = `<p><label for="gbgalToastSeconds">${FH.t('Boxes.GBGActionLog.ToastDuration')}</label>`
              +   `<input type="number" id="gbgalToastSeconds" min="0" value="${seconds}"></p>`
              + `<p class="gbgal-set-hint">${FH.t('Boxes.GBGActionLog.ToastDurationHint')}</p>`
              + '<hr>'
              + `<p><label for="gbgalRedAfterHours">${FH.t('Boxes.GBGActionLog.RedAfterHours')}</label>`
              +   `<input type="number" id="gbgalRedAfterHours" min="1" value="${redHours}"></p>`
              + `<p class="gbgal-set-hint">${FH.t('Boxes.GBGActionLog.RedAfterHoursHint')}</p>`
              + '<hr>'
              + `<p><label for="gbgalDateFormat">${FH.t('Boxes.GBGActionLog.DateFormat')}</label>`
              +   `<input type="text" id="gbgalDateFormat" placeholder="${FH.t('Date')}" value="${dateFmt}"></p>`
              + `<p><label for="gbgalDateTimeFormat">${FH.t('Boxes.GBGActionLog.DateTimeFormat')}</label>`
              +   `<input type="text" id="gbgalDateTimeFormat" placeholder="${FH.t('DateTime')}" value="${dateTimeFmt}"></p>`
              + `<p class="gbgal-set-hint">${FH.t('Boxes.GBGActionLog.FormatHint')}</p>`
              + `<button onclick="GBGActionLog.saveSettings()" class="btn saveSettings">${FH.t('General.Save')}</button>`;

        $(`#${GBGActionLog.windowId}SettingsBox`).html(h);
    },

    /** Persists the settings and re-renders the tables so a format change is applied at once */
    saveSettings: () => {
        let seconds = parseInt($('#gbgalToastSeconds').val(), 10),
            redHours = parseInt($('#gbgalRedAfterHours').val(), 10);

        FH.Storage.setItem(GBGActionLog.settingKeys.toast, isNaN(seconds) || seconds < 0 ? 12 : seconds);
        FH.Storage.setItem(GBGActionLog.settingKeys.redHours, isNaN(redHours) || redHours < 1 ? GBGActionLog.defaultRedHours : redHours);
        FH.Storage.setItem(GBGActionLog.settingKeys.date, $('#gbgalDateFormat').val().trim());
        FH.Storage.setItem(GBGActionLog.settingKeys.dateTime, $('#gbgalDateTimeFormat').val().trim());

        $(`#${GBGActionLog.windowId}SettingsBox`).remove();

        // Apply the new red threshold to the HUD badge at once
        GBGActionLog.refreshMenuBadge();

        // Re-render the already-built tabs with the new formats (unbuilt tabs pick them up when first opened)
        if (GBGActionLog.loadedTabs['gbgalDetails']) GBGActionLog.reload();
        if (GBGActionLog.loadedTabs['gbgalReport']) GBGActionLog.reloadReport();
        if (GBGActionLog.loadedTabs['gbgalBatches']) GBGActionLog.reloadBatches();
        if (GBGActionLog.loadedTabs['gbgalActivity']) GBGActionLog.reloadActivity();
    },

    /**
     * Re-queries the DB for the current From/To window and rebuilds the Details tab.
     * The Report and Batches tabs have their own range/filters (see reloadReport / reloadBatches).
     * Pass from/to ("YYYY-MM-DDTHH:mm") to set the window; omit to read the inputs.
     */
    reload: async (from, to, anchor = 'to') => {
        GBGActionLog.snapshotBuildingNames(); // refresh the snapshot if BuildingData is currently populated

        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (from === undefined) from = box.querySelector('.gbg-log-from').value;
        if (to === undefined) to = box.querySelector('.gbg-log-to').value;

        // Cap the Details window at 2 weeks, keeping whichever end the user just edited (anchor)
        let fromAnchored = anchor === 'from' && !!from,
            cap = GBGActionLog.clampRange(from, to, 2, 'week', 'YYYY-MM-DDTHH:mm', anchor);
        from = cap.from;
        to = cap.to;
        if (cap.clamped) {
            ({ from, to } = GBGActionLog.snapTwoWeeks(from, to, fromAnchored));
            GBGActionLog.notifyRangeCapped(FH.t('Boxes.GBGActionLog.RangeCapDetails'), from.replace('T', ' '), to.replace('T', ' '));
        }

        let startTs = from ? GBGActionLog.toEpoch(moment(from)) : 0,
            endTs = to ? GBGActionLog.toEpoch(moment(to)) : moment().unix(),
            rows = await GBGActionLog.getActionLogByDateRange(startTs, endTs);

        GBGActionLog.appliedFrom = from;
        GBGActionLog.appliedTo = to;

        box.querySelector('#gbgalDetailsTable').innerHTML = GBGActionLog.buildDetailsTable(rows, from, to);
        GBGActionLog.initTable($('#gbgalDetailsTable table'));
    },

    /**
     * Restores both tabs' default time windows; the rebuild also drops any active column filters
     */
    reset: () => {
        let d = GBGActionLog.defaultRange();
        GBGActionLog.reload(d.from, d.to);
        // Batches has its own range; only reset it if it's already been built
        if (GBGActionLog.loadedTabs['gbgalBatches']) {
            let bd = GBGActionLog.defaultBatchesRange();
            GBGActionLog.reloadBatches(bd.from, bd.to);
        }
    },

    /**
     * Reloads for the popup's From/To range, but only when it actually changed since the last load
     */
    applyTimeRange: () => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`),
            fromEl = box.querySelector('.gbg-log-from'),
            toEl = box.querySelector('.gbg-log-to');

        if (!fromEl || !toEl) return false;
        let fromChanged = fromEl.value !== GBGActionLog.appliedFrom,
            toChanged = toEl.value !== GBGActionLog.appliedTo;
        if (!fromChanged && !toChanged) return false;

        // Anchor on the field the user actually edited so their edit is kept and the other end moves
        GBGActionLog.reload(fromEl.value, toEl.value, fromChanged && !toChanged ? 'from' : 'to');
        return true;
    },

    /**
     * Batches-tab counterpart of applyTimeRange: reloads for the Collected-at popup's From/To range,
     * but only when it actually changed since the last load
     */
    applyBatchesTimeRange: () => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`),
            fromEl = box.querySelector('.gbg-batch-from'),
            toEl = box.querySelector('.gbg-batch-to');

        if (!fromEl || !toEl) return false;
        let fromChanged = fromEl.value !== GBGActionLog.batchAppliedFrom,
            toChanged = toEl.value !== GBGActionLog.batchAppliedTo;
        if (!fromChanged && !toChanged) return false;

        GBGActionLog.reloadBatches(fromEl.value, toEl.value, fromChanged && !toChanged ? 'from' : 'to');
        return true;
    },

    /**
     * Re-queries the DB for the Batches tab's own Collected-at window and rebuilds the tab.
     * Capped to 2 weeks like the Details tab. Pass from/to ("YYYY-MM-DDTHH:mm"); omit to read the popup inputs.
     */
    reloadBatches: async (from, to, anchor = 'to') => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (!box) return;
        if (from === undefined) { let el = box.querySelector('.gbg-batch-from'); from = el ? el.value : ''; }
        if (to === undefined) { let el = box.querySelector('.gbg-batch-to'); to = el ? el.value : ''; }

        // Cap the Batches window at 2 weeks, keeping whichever end the user just edited (anchor)
        let fromAnchored = anchor === 'from' && !!from,
            cap = GBGActionLog.clampRange(from, to, 2, 'week', 'YYYY-MM-DDTHH:mm', anchor);
        from = cap.from;
        to = cap.to;
        if (cap.clamped) {
            ({ from, to } = GBGActionLog.snapTwoWeeks(from, to, fromAnchored));
            GBGActionLog.notifyRangeCapped(FH.t('Boxes.GBGActionLog.RangeCapBatches'), from.replace('T', ' '), to.replace('T', ' '));
        }

        let startTs = from ? GBGActionLog.toEpoch(moment(from)) : 0,
            endTs = to ? GBGActionLog.toEpoch(moment(to)) : moment().unix(),
            batches = await GBGActionLog.getActionLogBatchesByDateRange(startTs, endTs);

        GBGActionLog.batchAppliedFrom = from;
        GBGActionLog.batchAppliedTo = to;

        box.querySelector('#gbgalBatches').innerHTML = GBGActionLog.buildBatchesTab(batches, from, to);
        GBGActionLog.initTable($('#gbgalBatches table'));
    },

    /**
     * Builds the Report tab's control bar (date range + action checkboxes) once, then renders its table.
     * The control bar persists across reloadReport() calls; only the table below it is rebuilt.
     */
    initReport: async () => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (!box) return;
        box.querySelector('#gbgalReport').innerHTML = await GBGActionLog.buildReportControls() + '<div id="gbgalReportTable"></div>';
        await GBGActionLog.reloadReport();
    },

    /**
     * Re-queries the DB for the Report tab's own date range + selected actions, then rebuilds its table.
     * Dates are date-only ("YYYY-MM-DD"); the range spans start-of-from-day .. end-of-to-day.
     */
    reloadReport: async (anchor) => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (!box) return;
        let fromEl = box.querySelector('.gbg-report-from'),
            toEl = box.querySelector('.gbg-report-to');
        if (!fromEl || !toEl) return;

        // Cap the Report window at 1 month, keeping whichever date the user just edited (anchor)
        let cap = GBGActionLog.clampRange(fromEl.value, toEl.value, 1, 'month', 'YYYY-MM-DD', anchor),
            from = cap.from,
            to = cap.to;
        fromEl.value = from;
        if (to) toEl.value = to;
        if (cap.clamped) GBGActionLog.notifyRangeCapped(FH.t('Boxes.GBGActionLog.RangeCapReport'), from, to || moment().format('YYYY-MM-DD'));

        let startTs = from ? GBGActionLog.toEpoch(moment(from, 'YYYY-MM-DD').startOf('day')) : 0,
            endTs = to ? GBGActionLog.toEpoch(moment(to, 'YYYY-MM-DD').endOf('day')) : moment().unix(),
            actions = [...box.querySelectorAll('.gbg-report-action:checked')].map(c => c.value),
            rows = await GBGActionLog.getActionLogByDateRange(startTs, endTs);

        let label = box.querySelector('.gbg-report-action-dd .dropdown-label');
        if (label) label.textContent = GBGActionLog.reportActionLabel(actions);

        box.querySelector('#gbgalReportTable').innerHTML = GBGActionLog.buildReportTable(rows, actions);
        GBGActionLog.initTable($('#gbgalReportTable table'));
    },

    SetTabs: (id, label) => {
        GBGActionLog.Tabs.push(`<li class="${id} game-cursor"><a href="#${id}" class="game-cursor">${label}</a></li>`);
    },

    GetTabs: () => '<ul class="horizontal dark-bg">' + GBGActionLog.Tabs.join('') + '</ul>',

    SetTabContent: (id, content) => {
        let cls = GBGActionLog.TabsContent.length > 0 ? ' class="hidden-tab"' : '';
        GBGActionLog.TabsContent.push(`<div id="${id}"${cls}>${content}</div>`);
    },

    GetTabContent: () => GBGActionLog.TabsContent.join(''),

    /** Toolbar with a CSV export button for a tab's table (see exportCsv); extra = optional HTML appended to the bar */
    exportBar: (tableSel, fileName, extra = '') =>
        `<div class="gbgal-toolbar"><button type="button" class="btn gbg-log-export" data-table="${tableSel}" data-file="${fileName}">${FH.t('Boxes.General.Export')} CSV</button>${extra}</div>`,

    /**
     * Exports a table to a semicolon-CSV (UTF-8 BOM, Excel-friendly), honouring active column filters:
     * column names come from th[data-export], rows hidden by filterTable are skipped, and each cell's
     * value is exportvalue ?? data-number ?? text (so dates stay readable and counts stay numeric).
     * @param {string} tableSel CSS selector for the table
     * @param {string} fileName base name; the current date and .csv are appended
     */
    exportCsv: (tableSel, fileName) => {
        let table = document.querySelector(tableSel);
        if (!table) return;

        let esc = (v) => /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v,
            cellValue = (td) => td.getAttribute('exportvalue') ?? td.dataset.number ?? td.textContent,
            lines = [[...table.querySelectorAll('thead th[data-export]')].map(th => esc(th.dataset.export)).join(';')];

        for (let tr of table.querySelectorAll('tbody tr')) {
            if (tr.style.display === 'none') continue; // hidden by a column filter
            lines.push([...tr.children].map(td => esc(String(cellValue(td)))).join(';'));
        }

        let blob = new Blob([String.fromCharCode(0xFEFF) + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        FH.Main.ExportFile(blob, `${fileName}-${moment().format('YYYY-MM-DD')}.csv`);
    },

    /**
     * Details tab table: log rows, each column header carrying an Excel-style filter button.
     * The Time column's popup is a date range that re-queries the DB (drives reload).
     * @param {Array} rows ActionLog rows (already limited to the selected range)
     * @param {string} fromVal current "from" value for the date-range filter
     * @param {string} toVal current "to" value for the date-range filter
     */
    buildDetailsTable: (rows, fromVal, toVal) => {
        // filter: 'multiselect' => checkbox list (match any), 'select' => exact dropdown, 'query' => date range that re-queries the DB
        let tableColumns = [
            { key: 'Sector',     filter: 'multiselect' },
            { key: 'ActionCode', filter: 'multiselect' },
            { key: 'ActionTime', filter: 'query'       },
            { key: 'Building',   filter: 'multiselect' },
            { key: 'ActorType',  filter: 'multiselect' },
            { key: 'ActorName',  filter: 'multiselect' },
        ];

        // Distinct values per dropdown/checkbox column, collected while building the rows
        let distinct = {};
        tableColumns.forEach((col, idx) => { if (col.filter === 'select' || col.filter === 'multiselect') distinct[idx] = new Set(); });

        // Action and Actor type are shown / filtered / sorted by their i18n names; Time sorts numerically by timestamp
        let buildingSnapshot = GBGActionLog.loadBuildingNames(),
            dtFmt = GBGActionLog.dateTimeFormat(),
            body = '';
        for (let row of rows) {
            let sectorName = ProvinceMap.SectorMapping[row["mapId"]][row["provinceId"]]["short"],
                actionTimeStr = GBGActionLog.tsMoment(row["actionUTCTimestamp"]).format(dtFmt),
                buildingName = GBGActionLog.buildingName(row["buildingId"], buildingSnapshot),
                actorType = row["actorType"],
                actorTypeName = GBGActionLog.actorTypeName(actorType),
                cells = [sectorName, GBGActionLog.actionName(row["actionCode"]), actionTimeStr, buildingName, actorTypeName, FH.HTML.escapeHtml(row["actorName"])];

            cells.forEach((val, idx) => { if (distinct[idx] && val !== "") distinct[idx].add(val); });

            // Leading markers: Action (idx 1) + Building (idx 3) = colour swatches; Actor type + Actor name (idx 4/5) = icons.
            // Prepended to the cell HTML only — kept out of textContent/data-text so column filter, sort and CSV export stay text-only.
            let actorIcon = GBGActionLog.actorIconImg(actorType, actorTypeName),
                actClass = GBGActionLog.actionCodeClass(row["actionCode"]),
                bldClass = GBGActionLog.buildingTypeClass(row["buildingId"]),
                icons = [];
            icons[1] = `<span class="gbgal-act-rect${actClass ? ' ' + actClass : ''}"></span>`;
            icons[3] = buildingName ? `<span class="gbgal-bld-rect${bldClass ? ' ' + bldClass : ''}"></span>` : '';
            icons[4] = icons[5] = actorIcon;

            body += '<tr>';
            cells.forEach((val, idx) => {
                if (idx === 2) {
                    body += `<td data-number="${row["actionUTCTimestamp"]}" exportvalue="${val}">${val}</td>`;
                } else {
                    body += `<td data-text="${FH.helper.str.cleanup(String(val))}">${icons[idx] || ''}${val}</td>`;
                }
            });
            body += '</tr>';
        }

        let head = '<tr class="sorter-header" data-type="gbgalDetailsBody">';
        tableColumns.forEach((col, idx) => {
            let numeric = col.filter === 'query' ? ' class="is-number"' : '',
                label = FH.t(`Boxes.GBGActionLog.${col.key}`),
                opts = { options: distinct[idx] ? [...distinct[idx]].sort() : [] };

            if (col.filter === 'query') {
                opts.fromVal = fromVal;
                opts.toVal = toVal;
                opts.active = !!(fromVal || toVal);
            }

            head += `<th data-type="gbgalDetailsBody"${numeric} data-export="${label}">${label}${GBGActionLog.filterControl(idx, col.filter, opts)}</th>`;
        });
        head += '</tr>';

        let fmtRange = (v) => v ? moment(v).format(dtFmt) : '',
            tableKpiRowContent = `${FH.t('Boxes.GBGActionLog.FilteredTimeRange')}: ${fmtRange(fromVal)} - ${fmtRange(toVal)}, ${FH.t('Boxes.GBGActionLog.RowCount')}: ${rows.length}`,
            tableKpiRow = `<span class="gbgal-detail-table-kpi">${tableKpiRowContent}</span>`,
            reset = `<button type="button" class="btn gbg-log-reset">${FH.t('Boxes.GBGActionLog.Reset')}</button>`;
        return GBGActionLog.exportBar('#gbgalDetailsTable table', 'GBGActionLog-Details', reset + tableKpiRow)
             + `<table class="foe-table sortable-table"><thead>${head}</thead><tbody class="gbgalDetailsBody">${body}</tbody></table>`;
    },

    /**
     * Report tab control bar: date range (date-only) + a multi-select action dropdown (checkbox popup).
     * "Building placed" is ticked by default; changing any control re-queries via reloadReport().
     */
    buildReportControls: async () => {
        let d = GBGActionLog.defaultReportRange(),
            codes = (await GBGActionLog.getDistinctActionCodes()).filter(c => !GBGActionLog.reportExcludedActions.includes(c)),
            checked = codes.filter(c => c === 'building_placed'),
            items = '';

        // Reuses the shared .dropdown component (see css/boxes.css), same as the Stats era selector
        for (let code of codes) {
            let on = code === 'building_placed' ? ' checked' : '';
            items += `<li><label class="game-cursor"><input type="checkbox" class="gbg-report-action" value="${code}"${on}> ${GBGActionLog.actionName(code)}</label></li>`;
        }

        return '<div class="gbgal-report-controls">'
             + `<label>${FH.t('Boxes.GBGActionLog.From')}: <input type="date" class="gbg-report-from" value="${d.from}"></label>`
             + `<label>${FH.t('Boxes.GBGActionLog.To')}: <input type="date" class="gbg-report-to" value="${d.to}"></label>`
             + `<span class="gbgal-report-actions"><span class="gbgal-report-actions-label">${FH.t('Boxes.GBGActionLog.ActionCode')}:</span>`
             +   '<div class="dropdown gbg-report-action-dd gbgal-action-dd">'
             +     '<input type="checkbox" class="dropdown-checkbox" id="gbgalReportActionDd">'
             +     `<label class="dropdown-label game-cursor" for="gbgalReportActionDd">${GBGActionLog.reportActionLabel(checked)}</label>`
             +     '<span class="arrow"></span>'
             +     `<ul>${items}</ul>`
             +   '</div></span>'
             + '</div>';
    },

    /**
     * Report tab table: per player, the summed count of the selected actions broken down by day (pivot).
     * @param {Array} rows ActionLog rows (already limited to the Report tab's date range)
     * @param {Array} actions selected action codes; a row counts only if its actionCode is among these
     */
    buildReportTable: (rows, actions) => {
        let actionSet = new Set(actions),
            counts = {}, // playerName => { day => count }
            days = new Set();

        for (let row of rows) {
            if (row["actorType"] !== 'player' || !actionSet.has(row["actionCode"])) continue;

            // Key by an ISO day so columns sort chronologically regardless of the display format
            let day = GBGActionLog.tsMoment(row["actionUTCTimestamp"]).format('YYYY-MM-DD'),
                name = row["actorName"];

            days.add(day);
            counts[name] = counts[name] || {};
            counts[name][day] = (counts[name][day] || 0) + 1;
        }

        let players = Object.keys(counts);
        if (players.length === 0) return `<div class="gbgal-empty">${FH.t('Boxes.GBGActionLog.ReportEmpty')}</div>`;

        let dayList = [...days].sort(),
            dateFmt = GBGActionLog.dateFormat();

        // Default order: Total desc (Player asc on ties), matching the Total column's default sort
        let totals = {};
        for (let p of players) totals[p] = dayList.reduce((s, d) => s + (counts[p][d] || 0), 0);
        players.sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));

        // Single sortable header row; only the Player column carries a filter
        let h = '<table class="foe-table sortable-table"><thead>';
        h += '<tr class="sorter-header" data-type="gbgalReportBody">';
        h += `<th data-type="gbgalReportBody" data-export="${FH.t('Boxes.GBGActionLog.Player')}">${FH.t('Boxes.GBGActionLog.Player')}${GBGActionLog.filterControl(0, 'multiselect', { options: players.map(p => FH.HTML.escapeHtml(p)) })}</th>`;
        for (let d of dayList) {
            let dayLabel = moment(d, 'YYYY-MM-DD').format(dateFmt);
            h += `<th class="is-number" data-type="gbgalReportBody" data-export="${dayLabel}">${dayLabel}</th>`;
        }
        h += `<th class="is-number descending" data-type="gbgalReportBody" data-export="${FH.t('Boxes.GBGActionLog.Total')}">${FH.t('Boxes.GBGActionLog.Total')}</th>`;
        h += '</tr></thead><tbody class="gbgalReportBody">';

        for (let p of players) {
            let cells = '';
            for (let d of dayList) {
                let c = counts[p][d] || 0;
                cells += `<td data-number="${c}">${c || ''}</td>`;
            }
            h += `<tr><td data-text="${FH.helper.str.cleanup(p)}">${p}</td>${cells}<td data-number="${totals[p]}">${totals[p]}</td></tr>`;
        }
        h += '</tbody></table>';

        return GBGActionLog.exportBar('#gbgalReportTable table', 'GBGActionLog-Report') + h;
    },

    /**
     * Builds the Activity tab's control bar (date range + action checkboxes + metric selector) once,
     * then renders its heatmap. The control bar persists across reloadActivity() calls; only the table is rebuilt.
     */
    initActivity: async () => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (!box) return;
        box.querySelector('#gbgalActivity').innerHTML = await GBGActionLog.buildActivityControls() + '<div id="gbgalActivityTable"></div>';
        await GBGActionLog.reloadActivity();
    },

    /**
     * Re-queries the DB for the Activity tab's own date range + selected actions, then rebuilds its heatmap.
     * Dates are date-only ("YYYY-MM-DD"); the range spans start-of-from-day .. end-of-to-day (capped to 1 month).
     */
    reloadActivity: async (anchor) => {
        let box = document.getElementById(`${GBGActionLog.windowId}Body`);
        if (!box) return;
        let fromEl = box.querySelector('.gbg-activity-from'),
            toEl = box.querySelector('.gbg-activity-to');
        if (!fromEl || !toEl) return;

        // Cap the Activity window at 1 month, keeping whichever date the user just edited (anchor)
        let cap = GBGActionLog.clampRange(fromEl.value, toEl.value, 1, 'month', 'YYYY-MM-DD', anchor),
            from = cap.from,
            to = cap.to;
        fromEl.value = from;
        if (to) toEl.value = to;
        if (cap.clamped) GBGActionLog.notifyRangeCapped(FH.t('Boxes.GBGActionLog.RangeCapActivity'), from, to || moment().format('YYYY-MM-DD'));

        let startTs = from ? GBGActionLog.toEpoch(moment(from, 'YYYY-MM-DD').startOf('day')) : 0,
            endTs = to ? GBGActionLog.toEpoch(moment(to, 'YYYY-MM-DD').endOf('day')) : moment().unix(),
            actions = [...box.querySelectorAll('.gbg-activity-action:checked')].map(c => c.value),
            metricEl = box.querySelector('.gbg-activity-metric:checked'),
            metric = metricEl ? metricEl.value : 'count',
            rows = await GBGActionLog.getActionLogByDateRange(startTs, endTs);

        let label = box.querySelector('.gbg-activity-action-dd .dropdown-label');
        if (label) label.textContent = GBGActionLog.reportActionLabel(actions);
        let mLabel = box.querySelector('.gbg-activity-metric-dd .dropdown-label');
        if (mLabel && metricEl) mLabel.textContent = metricEl.parentElement.textContent.trim();

        box.querySelector('#gbgalActivityTable').innerHTML = GBGActionLog.buildActivityTable(rows, actions, metric);
        GBGActionLog.initTable($('#gbgalActivityTable table'));
    },

    /**
     * Activity tab control bar: date range (date-only) + a multi-select action dropdown (all ticked by
     * default) + a metric selector. Changing any control re-queries via reloadActivity().
     */
    buildActivityControls: async () => {
        let d = GBGActionLog.defaultActivityRange(),
            codes = (await GBGActionLog.getDistinctActionCodes()).filter(c => !GBGActionLog.reportExcludedActions.includes(c)),
            items = '';

        // Reuses the shared .dropdown component (see css/boxes.css); all actions ticked so the tab opens on overall activity
        for (let code of codes) {
            items += `<li><label class="game-cursor"><input type="checkbox" class="gbg-activity-action" value="${code}" checked> ${GBGActionLog.actionName(code)}</label></li>`;
        }

        return '<div class="gbgal-report-controls">'
             + `<label>${FH.t('Boxes.GBGActionLog.From')}: <input type="date" class="gbg-activity-from" value="${d.from}"></label>`
             + `<label>${FH.t('Boxes.GBGActionLog.To')}: <input type="date" class="gbg-activity-to" value="${d.to}"></label>`
             + `<span class="gbgal-report-actions"><span class="gbgal-report-actions-label">${FH.t('Boxes.GBGActionLog.ActionCode')}:</span>`
             +   '<div class="dropdown gbg-activity-action-dd gbgal-action-dd">'
             +     '<input type="checkbox" class="dropdown-checkbox" id="gbgalActivityActionDd">'
             +     `<label class="dropdown-label game-cursor" for="gbgalActivityActionDd">${GBGActionLog.reportActionLabel(codes)}</label>`
             +     '<span class="arrow"></span>'
             +     `<ul>${items}</ul>`
             +   '</div></span>'
             + `<span class="gbgal-report-actions"><span class="gbgal-report-actions-label">${FH.t('Boxes.GBGActionLog.Metric')}:</span>`
             +   '<div class="dropdown gbg-activity-metric-dd gbgal-action-dd">'
             +     '<input type="checkbox" class="dropdown-checkbox" id="gbgalActivityMetricDd">'
             +     `<label class="dropdown-label game-cursor" for="gbgalActivityMetricDd">${FH.t('Boxes.GBGActionLog.MetricCount')}</label>`
             +     '<span class="arrow"></span>'
             +     '<ul>'
             +       `<li><label class="game-cursor"><input type="radio" name="gbgalActivityMetric" class="gbg-activity-metric" value="count" checked> ${FH.t('Boxes.GBGActionLog.MetricCount')}</label></li>`
             +       `<li><label class="game-cursor"><input type="radio" name="gbgalActivityMetric" class="gbg-activity-metric" value="days"> ${FH.t('Boxes.GBGActionLog.MetricDays')}</label></li>`
             +     '</ul>'
             +   '</div></span>'
             + '</div>';
    },

    /** Heatmap bucket (1..5) for a cell value relative to the busiest cell; '' when empty (no shading) */
    heatClass: (value, max) => (!value || max <= 0) ? '' : ` gbgal-heat-${Math.ceil(value / max * 5)}`,

    /**
     * Activity tab heatmap: per player, matching-action activity bucketed by hour of day (0-23, local),
     * summed over the selected date range. Cells shade darker with more activity (relative to the busiest
     * cell). A per-player Total column and a guild-total footer row summarise the picture.
     * @param {Array} rows ActionLog rows (already limited to the Activity tab's date range)
     * @param {Array} actions selected action codes; a row counts only if its actionCode is among these
     * @param {string} metric 'count' => number of actions; 'days' => number of distinct days active that hour
     */
    buildActivityTable: (rows, actions, metric) => {
        let actionSet = new Set(actions),
            byDays = metric === 'days',
            data = {}; // playerName => { hour => count | Set<dayStr> }

        for (let row of rows) {
            if (row["actorType"] !== 'player' || !actionSet.has(row["actionCode"])) continue;

            let m = GBGActionLog.tsMoment(row["actionUTCTimestamp"]),
                hour = m.hour(),
                name = row["actorName"];

            data[name] = data[name] || {};
            if (byDays) {
                (data[name][hour] = data[name][hour] || new Set()).add(m.format('YYYY-MM-DD'));
            } else {
                data[name][hour] = (data[name][hour] || 0) + 1;
            }
        }

        let players = Object.keys(data);
        if (players.length === 0) return `<div class="gbgal-empty">${FH.t('Boxes.GBGActionLog.ActivityEmpty')}</div>`;

        // Resolve a stored cell to its number (Set size for the 'days' metric)
        let cellVal = (p, h) => {
            let v = data[p][h];
            return v == null ? 0 : (byDays ? v.size : v);
        };

        // Per-player totals, per-hour (guild) totals, and the busiest player cell (drives the heat scale)
        let totals = {},
            hourTotals = new Array(24).fill(0),
            maxCell = 0;
        for (let p of players) {
            let t = 0;
            for (let h = 0; h < 24; h++) {
                let v = cellVal(p, h);
                t += v;
                hourTotals[h] += v;
                if (v > maxCell) maxCell = v;
            }
            totals[p] = t;
        }
        let maxHourTotal = Math.max(...hourTotals);

        // Default order: Total desc (Player asc on ties), matching the Total column's default sort
        players.sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));

        let hourLabel = (h) => String(h).padStart(2, '0');

        // Single sortable header row; only the Player column carries a filter
        let head = '<tr class="sorter-header sort2" data-type="gbgalActivityBody">';
        head += `<th data-type="gbgalActivityBody" data-export="${FH.t('Boxes.GBGActionLog.Player')}">${FH.t('Boxes.GBGActionLog.Player')}${GBGActionLog.filterControl(0, 'multiselect', { options: players.map(p => FH.HTML.escapeHtml(p)) })}</th>`;
        for (let h = 0; h < 24; h++) {
            head += `<th class="is-number gbgal-hourcol" data-type="gbgalActivityBody" data-export="${hourLabel(h)}">${hourLabel(h)}</th>`;
        }
        head += `<th class="is-number descending" data-type="gbgalActivityBody" data-export="${FH.t('Boxes.GBGActionLog.Total')}">${FH.t('Boxes.GBGActionLog.Total')}</th>`;
        head += '</tr>';

        let body = '';
        for (let p of players) {
            let cells = '';
            for (let h = 0; h < 24; h++) {
                let v = cellVal(p, h);
                cells += `<td class="gbgal-hourcol${GBGActionLog.heatClass(v, maxCell)}" data-number="${v}">${v || ''}</td>`;
            }
            body += `<tr><td data-text="${FH.helper.str.cleanup(p)}">${FH.HTML.escapeHtml(p)}</td>${cells}<td class="is-number" data-number="${totals[p]}">${totals[p]}</td></tr>`;
        }

        // Guild-total footer row: kept in <tfoot> so tableSorter (tbody-only) leaves it pinned; shaded by its own peak hour
        let grand = 0,
            foot = `<tr class="gbgal-activity-total"><td>${FH.t('Boxes.GBGActionLog.Total')}</td>`;
        for (let h = 0; h < 24; h++) {
            foot += `<td class="gbgal-hourcol${GBGActionLog.heatClass(hourTotals[h], maxHourTotal)}">${hourTotals[h] || ''}</td>`;
            grand += hourTotals[h];
        }
        foot += `<td>${grand}</td></tr>`;

        return GBGActionLog.exportBar('#gbgalActivityTable table', 'GBGActionLog-Activity')
             + `<table class="foe-table sortable-table"><thead>${head}</thead>`
             + `<tbody class="gbgalActivityBody">${body}</tbody>`
             + `<tfoot>${foot}</tfoot></table>`;
    },

    /**
     * Batches tab: the logged data collections (ActionLogBatch) within the Collected-at window.
     * Rows where logCount hit the 200-entry cap are flagged, since entries before firstLogTime may be missing.
     * The Collected-at column's popup is a date range that re-queries the DB (drives reloadBatches).
     * @param {Array} batches ActionLogBatch rows (already limited to the selected range)
     * @param {string} fromVal current "from" value for the date-range filter
     * @param {string} toVal current "to" value for the date-range filter
     */
    buildBatchesTab: (batches, fromVal, toVal) => {
        // type: 'time' => epoch shown as datetime (numeric sort), 'number' => numeric, 'text' => string
        // filter: 'query' => date range that re-queries the DB, 'multiselect' => checkbox list, 'numrange' => numeric range
        let columns = [
            { key: 'LogDate',       field: 'logDate',       type: 'time',   filter: 'query'       },
            { key: 'Map',           field: 'mapId',         type: 'text',   filter: 'multiselect', name: GBGActionLog.mapName },
            { key: 'FirstLogTime',  field: 'firstLogTime',  type: 'time',   filter: 'between' },
            { key: 'LastLogTime',   field: 'lastLogTime',   type: 'time',   filter: 'between' },
            { key: 'LogCount',      field: 'logCount',      type: 'number', filter: 'numrange' },
            { key: 'TotalReturned', field: 'totalReturned', type: 'number', filter: 'numrange' },
        ];

        let distinct = {};
        columns.forEach((col, idx) => { if (col.filter === 'select' || col.filter === 'multiselect') distinct[idx] = new Set(); });

        let dtFmt = GBGActionLog.dateTimeFormat(),
            body = '';
        for (let b of batches) {
            // logCount === 200 means the page was full and all-new => older entries may be missing
            body += b.logCount === 200 ? '<tr class="gbgal-cap-hit">' : '<tr>';
            columns.forEach((col, idx) => {
                let raw = b[col.field];
                if (col.type === 'time') {
                    let t = GBGActionLog.tsMoment(raw).format(dtFmt);
                    body += `<td data-number="${raw}" exportvalue="${t}">${t}</td>`;
                } else if (col.type === 'number') {
                    body += `<td data-number="${raw}">${raw}</td>`;
                } else {
                    let disp = col.name ? col.name(raw) : raw;
                    if (distinct[idx]) distinct[idx].add(disp);
                    body += `<td data-text="${FH.helper.str.cleanup(String(disp))}">${disp}</td>`;
                }
            });
            body += '</tr>';
        }

        // Empty body but keep the header so the Collected-at range filter stays reachable
        if (batches.length === 0) body = `<tr><td class="gbgal-empty" colspan="${columns.length}">${FH.t('Boxes.GBGActionLog.BatchesEmpty')}</td></tr>`;

        let head = '<tr class="sorter-header" data-type="gbgalBatchesBody">';
        columns.forEach((col, idx) => {
            let numeric = col.type !== 'text' ? ' class="is-number"' : '',
                label = FH.t(`Boxes.GBGActionLog.${col.key}`),
                opts = { options: distinct[idx] ? [...distinct[idx]].sort() : [] };

            if (col.filter === 'query') {
                opts.fromVal = fromVal;
                opts.toVal = toVal;
                opts.active = !!(fromVal || toVal);
                opts.fromClass = 'gbg-batch-from';
                opts.toClass = 'gbg-batch-to';
            }

            head += `<th data-type="gbgalBatchesBody"${numeric} data-export="${label}">${label}${GBGActionLog.filterControl(idx, col.filter, opts)}</th>`;
        });
        head += '</tr>';

        return GBGActionLog.exportBar('#gbgalBatches table', 'GBGActionLog-Batches')
             + `<table class="foe-table sortable-table"><thead>${head}</thead><tbody class="gbgalBatchesBody">${body}</tbody></table>`;
    },

    /**
     * Re-applies a table's filters from its popups: hides non-matching rows and marks each
     * column's filter button active when it holds a value.
     * @param {HTMLElement} el the filter control that changed; its table is the one filtered
     */
    filterTable: (el) => {
        let table = el.closest('table'),
            popups = table.querySelectorAll('thead .gbg-log-popup'),
            rows = table.querySelectorAll('tbody tr'),
            active = [];

        for (let p of popups) {
            let match = p.dataset.match;
            if (match === 'query') continue; // date-range query is handled by reload(); button state set at build time

            let col = +p.dataset.col,
                btn = p.parentNode.querySelector('.gbg-log-filterbtn'),
                on = false;

            if (match === 'between' || match === 'numrange') {
                let from = p.querySelector('.gbg-flt-from').value,
                    to = p.querySelector('.gbg-flt-to').value,
                    parse = match === 'between' ? (v) => GBGActionLog.toEpoch(moment(v)) : (v) => Number(v);
                on = !!(from || to);
                if (on) active.push({ col, match: 'range', fromTs: from ? parse(from) : null, toTs: to ? parse(to) : null });
            } else if (match === 'multiselect') {
                let vals = [...p.querySelectorAll('.gbg-log-filter:checked')].map(c => c.value);
                on = vals.length > 0;
                if (on) active.push({ col, match, vals: new Set(vals) });
            } else {
                let val = p.querySelector('.gbg-log-filter').value;
                on = !!val;
                if (on) active.push({ col, match, val });
            }
            if (btn) btn.classList.toggle('gbg-flt-on', on);
        }

        for (let row of rows) {
            let cells = row.getElementsByTagName('td'),
                show = true;

            for (let f of active) {
                if (f.match === 'range') {
                    let ts = Number(cells[f.col].dataset.number);
                    if ((f.fromTs !== null && ts < f.fromTs) || (f.toTs !== null && ts > f.toTs)) { show = false; break; }
                } else if (f.match === 'multiselect') {
                    if (!f.vals.has(cells[f.col].textContent)) { show = false; break; }
                } else {
                    let cell = cells[f.col].textContent;
                    if (f.match === 'exact' ? cell !== f.val : cell.toUpperCase().indexOf(f.val.toUpperCase()) === -1) { show = false; break; }
                }
            }
            row.style.display = show ? '' : 'none';
        }

        GBGActionLog.updateRowCount(table);
    },

    /**
     * Refreshes a table's row counter: shows the visible count, adding the total when a filter hides some.
     * No-op for tables without a counter element (only the Details tab has one).
     * @param {HTMLElement} table the table whose counter to refresh
     */
    updateRowCount: (table) => {
        let countEl = table.parentElement && table.parentElement.querySelector('.gbgal-detail-table-kpi');
        if (!countEl) return;
        let rows = table.querySelectorAll('tbody tr'),
            visible = [...rows].filter(r => r.style.display !== 'none').length,
            label = FH.t('Boxes.GBGActionLog.RowCount');
        countEl.textContent = visible === rows.length ? `${label}: ${rows.length}` : `${label}: ${visible} / ${rows.length}`;
    }
}