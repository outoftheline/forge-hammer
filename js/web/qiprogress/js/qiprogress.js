/*
 *
 *  * **************************************************************************************
 *  * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 *  * You may use, distribute and modify this code under the
 *  * terms of the AGPL license.
 *  *
 *  * See file LICENSE.md or go to
 *  * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 *  * for full license details.
 *  *
 *  * **************************************************************************************
 *
 */


FH.proxy.addHandler('GuildRaidsService', 'getMemberActivityOverview', (data, postData) => {
    QiProgress.HandleQiProgress(data.responseData.rows);
});

FH.proxy.addHandler('GuildRaidsService', 'getState', (data, postData) => {
	QiProgress.GlobalRankingTimeout = setTimeout(()=>{
		if (data.responseData.__class__ == 'GuildRaidsRunningState') {
			QiProgress.CurrentQISeason = data.responseData.endsAt
		}
		else if (data.responseData.__class__ == 'GuildRaidsPendingState') {
			// 259200 = 3 days
			QiProgress.CurrentQISeason = data.responseData.startsAt - 259200
		}
		else if (data.responseData.__class__ == 'GuildRaidsFinishedState') {
			QiProgress.CurrentQISeason = data.responseData.nextStartsAt - 259200
		}

		if (QiProgress.curDateFilter === null || QiProgress.curDateEndFilter === null) {
			QiProgress.curDateFilter = moment.unix(QiProgress.CurrentQISeason).subtract(11, 'd').format('YYYYMMDD')
			QiProgress.curDateEndFilter = moment.unix(QiProgress.CurrentQISeason).format('YYYYMMDD')
		}
	},500)
});

let QiProgress = {
    ProgressListContent: [],
	PrevAction: null,
	PrevActionTimestamp: null,
	NewAction: null,
	NewActionTimestamp: null,
	CurrentQISeason: null, // timestamp of round end
	AllRounds: null,
	ProgressContent: [],
	curDateFilter: null,
	curDateEndFilter: null,
	GlobalRankingTimeout: null,
    NewActionTimestamp: null,
	HistoryView: false,
	ProgressSettings: {
		showOnlyActivePlayers: 0,
	},
	QiMap: {},

	/**
	 * @returns {Promise<void>}
	 */
	checkForDB: async (playerID) => {
		const DBName = `FoeHelperDB_Qi_${playerID}`;

		QiProgress.db = new Dexie(DBName);

		QiProgress.db.version(1).stores({
			snapshots: '&[player_id+qiround+time],[qiround+player_id], [date+player_id], qiround',
			history: '&qiround'
		});

		QiProgress.db.open();
	},


	/**
	 * Shows the player overview
	 */
	ShowProgressList: () => {
		if ($('#QiProgressList').length === 0) {

			FH.HTML.Box({
				id: 'QiProgressList',
				title: FH.t('Boxes.QiProgress.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true,
				settings: QiProgress.ShowSettings,
			    active_maps:"guild_raids"
			});
			FH.HTML.AddCssFile('qiprogress');
		}
			
		if (Settings.GetSetting('ShowQIPlayerInfo') == false) {
			$('#QiProgressList').css({'display': 'none'})
		}

		QiProgress.BuildProgressList(QiProgress.CurrentQISeason);
	},

	/**
	 * Built the player content content
	 * @param qiRound
	 * @returns {Promise<void>}
	 */
	BuildProgressList: async (qiRound) => {

		let newRound = false;
		let updateDetailView = false;

		await QiProgress.SetBoxNavigation(qiRound);

		let CurrentSnapshot = await QiProgress.db.snapshots
			.where({
				qiround: QiProgress.CurrentQISeason
			})
			.first();

		if (CurrentSnapshot === undefined) {
			newRound = true;
			// if there is a new round delete previous snapshots
			QiProgress.DeleteOldSnapshots(QiProgress.CurrentQISeason);
		}

		let t = [],
			b = [],
			tA = 0,
			tP = 0,
			histView = false;

		QiProgress.ProgressContent = [];

		QiProgress.ProgressContent.push({
			player_id: 'player_id',
			player: 'player',
			actions: 'actions',
			progress: 'progress',
		});

		if (qiRound && qiRound !== null && qiRound !== QiProgress.CurrentQISeason) {
			let d = await QiProgress.db.history.where({ qiround: qiRound }).toArray();
			QiProgress.qiRound = d[0].participation?.sort(function (a, b) {
				return a.rank - b.rank;
			});
			histView = true;
		}
		else {
			QiProgress.qiRound = QiProgress.NewAction;
		}

		for (let i in QiProgress.qiRound) {
			if (!QiProgress.qiRound.hasOwnProperty(i)) break;

			let playerNew = QiProgress.qiRound[i];

			let newActions = '',
                diffActions = 0,
                newProgress = '',
				diffProgress = 0,
				newProgressClass = '',
				change = false;

			// older snapshot available?
			if (QiProgress.PrevAction !== null && histView === false) {
				let playerOld = QiProgress.PrevAction.find(p => (p['player_id'] === playerNew['player_id']));

				// any data on this player?
				if (playerOld !== undefined) {
					if (playerOld.actions < playerNew.actions) {
						diffActions = playerNew.actions - playerOld.actions
						newActions = ' <small class="text-success">&#8593; ' + FH.HTML.Format(diffActions) + '</small>';
						change = true;
					}
					if (playerOld.progress < playerNew.progress) {
						diffProgress = playerNew.progress - playerOld.progress
						newProgress = ' <small class="text-success">&#8593; ' + diffProgress + '</small>';
						change = true;
					}
				}
			}

			if ((change === true || newRound === true) && QiProgress.HistoryView === false) {
				await QiProgress.UpdateDB('player', { 
						qiRound: QiProgress.CurrentQISeason, 
						player_id: playerNew.player_id, 
						name: playerNew.name, 
						actions: playerNew.actions, 
						progress: playerNew.progress, 
						diffActions: diffActions,
						diffProgress: diffProgress,
						time: moment().unix() 
					});
				updateDetailView = true;
			}

			newProgressClass = change && !newRound ? 'new ' : '';

			tA += playerNew.actions;
			tP += playerNew.progress;

			b.push('<tr data-player="' + playerNew['player_id'] + '" data-qiround="' + qiRound + '" class="' + newProgressClass + (!histView ? 'showdetailview ' : '') + (playerNew['player_id'] === FH.Player.ID ? 'mark-player ' : '') + (change === true ? 'bg-green' : '') + '">');
			b.push('<td style="display:none">' + playerNew.player_id + '</td>');
			b.push('<td class="tdmin">' + (parseInt(i) + 1) + '.</td>');
			b.push('<td class="tdmin"><img src="' + srcLinks.GetPortrait(playerNew.avatar) + '"></td>');
			b.push('<td>' + playerNew.name + '</td>');
			b.push('<td class="text-center" data-number="' + playerNew.actions + '">' + FH.HTML.Format(playerNew.actions) + newActions + '</td>');
			b.push('<td class="text-center" data-number="' + playerNew.progress + '">' + FH.HTML.Format(playerNew.progress) + newProgress + '</td>');
			b.push('</tr>');

			QiProgress.ProgressContent.push({
				player_id: playerNew.player_id,
				player: playerNew.name,
				actions: playerNew.actions,
				progress: playerNew.progress
			})
		}

		t.push('<table id="QiProgressTable" class="foe-table' + (histView === false ? ' chevron-right exportable' : '') + '">');
		t.push('<thead class="sticky">');
		t.push('<tr>');
		t.push('<th style="display:none" data-export="Player_ID"></th>');
		t.push('<th colspan="3" data-export3="Player">' + FH.t('General.Player') + '</th>');
		t.push('<th class="text-center" data-export="Actions">' + FH.t('Boxes.QiProgress.Actions') + '<br> <strong class="text-warning">(' + FH.HTML.Format(tA) + ')</strong></th>');
		t.push('<th class="text-center" data-export="Progress">' + FH.t('Boxes.QiProgress.Progress') + '<br> <strong class="text-warning">(' + FH.HTML.Format(tP) + ')</strong></th>');
		t.push('</tr>');
		t.push('</thead>');

		t.push('<tbody>');
		t.push(b.join(''));
		t.push('</tbody>');

		$('#qiContentWrapper').html(t.join('')).promise().done(function () {

			$('#QiProgressListBody tr.showdetailview').off('click').on('click', function () {
				let player_id = $(this).data('player');
				let qiRound = $(this).data('qiround');

				QiProgress.curDetailViewFilter = { content: 'player', player_id: player_id, qiround: qiRound };

				if ($('#QiProgressDetailView').length === 0) {
					QiProgress.ShowPlayerDetailsBox(QiProgress.curDetailViewFilter);
				}
			});

			$("#QiProgress").on("remove", function () {
				if ($('#QiProgressDetailView').length !== 0) {
					$('#QiProgressDetailView').fadeOut(50, function () {
						$(this).remove();
					});
				}
			});

			// check if member has a new progress
			let newPlayerProgress = $('#QiProgressTable tbody').find('tr.new').length;
			if (newPlayerProgress > 0) {
				$('button#qi_filterProgressList').html('&#8593; ' + newPlayerProgress);
				$('button#qi_filterProgressList').attr("disabled", false);
			}
		});

		if ($('#QiProgressHeader .title').find('.time-diff').length === 0) {
			$('#QiProgressHeader .title').append($('<small />').addClass('time-diff'));
		}

		// es gibt schon einen Snapshot vorher
		if (QiProgress.PrevActionTimestamp !== null) {
			let start = moment.unix(QiProgress.PrevActionTimestamp),
				end = moment.unix(QiProgress.NewActionTimestamp),
				duration = moment.duration(end.diff(start));

			let time = duration.humanize();

			$('.time-diff').text(
				FH.helper.str.Replacer(FH.t('Boxes.QiProgress.LastSnapshot'), { time: time })
			);
		}
	},


	/**
	 * Filters the list for players with new progress
	 */
	ToggleProgressList: (id) => {
		let elem = $('#QiProgressTable > tbody');
		let nelem = elem.find('tr.new');
		let act = $('#' + id).hasClass('filtered') ? 'show' : 'hide';

		if (act === 'hide') {
			if (nelem.length !== 0) {
				let oelem = elem.find('tr:not(.new)');
				QiProgress.ProgressSettings.showOnlyActivePlayers = 1;
				$('#QiProgressTable > thead .text-warning').hide();
				oelem.hide();
				$('#' + id).addClass('filtered btn-green');
			}
		}
		else if (act === 'show') {
			elem.find('tr').show();
			QiProgress.ProgressSettings.showOnlyActivePlayers = 0;
			$('#QiProgressTable > thead .text-warning').show();
			$('#' + id).removeClass('filtered btn-green');
		}
	},

    ShowPlayerDetailsBox: (d) => {
		if ($('#QiProgressPlayerDetails').length === 0) {
			let ptop = null,
				pright = null;

			FH.HTML.Box({
				id: 'QiProgressPlayerDetails',
				title: FH.t('Boxes.QiProgress.SnapshotLog'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true,
			    active_maps:"guild_raids"
			});

			if (FH.Storage.getItem('QiProgressPlayerDetailsCords') === null) {
				ptop = $('#QiProgress').length !== 0 ? $('#QiProgress').position().top : 0;
				pright = $('#QiProgress').length !== 0 ? ($('#QiProgress').position().left + $('#QiProgress').width() + 10) : 0;
				$('#QiProgressPlayerDetails').css('top', ptop + 'px').css('left', (pright * 1) + 'px');
			}
		}

		QiProgress.BuildPlayerDetailContent(d);
	},
    
    
    BuildPlayerDetailContent: async (d) => {
		let player_id = d.player_id ? d.player_id : null,
			content = d.content ? d.content : 'player',
			qiround = d.qiround ? d.qiround : QiProgress.CurrentQISeason,
			playerName = null,
			dailyProgress = [],
			detaildata = [],
			h = [];

		if (player_id === null && content === "player") return;

		if (content === "player") {
			detaildata = await QiProgress.db.snapshots.where({ qiround: qiround, player_id: player_id }).toArray();

			playerName = detaildata[0].name;
			dailyProgress = detaildata.reduce(function (res, obj) {
				let date = moment.unix(obj.time).format('YYYYMMDD');

				if (!(date in res)) {
					res.__array.push(res[date] = { date: date, time: obj.time, actions: obj.actions, progress: obj.progress });
				}
				else {
					res[date].actions += +obj.actions;
					res[date].progress += +obj.progress;
				}
				return res;
			}, { __array: [] }).__array.sort(function (a, b) { return b.date - a.date });


			h.push('<div class="pname dark-bg text-center">' + playerName + ': ' + moment.unix(qiround).subtract(11, 'd').format(FH.t('DateShort')) + ` - ` + moment.unix(qiround).format(FH.t('Date')) + '</div>');
			h.push('<p class="dark-bg" style="padding:5px;margin:0;">' + FH.t('Boxes.QiProgress.SnapShotLogDisclaimer') + '</p>')
			h.push('<table id="qiPlayerLogTable" class="foe-table qilog"><thead>');
			h.push('<tr class="sorter-header">');
			h.push('<th class="is-number" data-type="qi-playerlog-group">' + FH.t('General.Date') + '</th>');
			h.push('<th class="is-number text-center" data-type="qi-playerlog-group">' + FH.HTML.Tooltip(FH.t('Boxes.QiProgress.Actions')) + '</th>');
			h.push('<th class="is-number text-center" data-type="qi-playerlog-group">' + FH.HTML.Tooltip(FH.t('Boxes.QiProgress.Progress')) + '</th>');
			h.push('</tr>');
			h.push('</thead><tbody class="qi-playerlog-group">');

			dailyProgress.forEach(day => {
				let id = moment.unix(day.time).format(FH.t('DateTime'));
				h.push('<tr id="qidetail_' + id + '" data-qiround="' + qiround + '" data-player="' + player_id + '" data-id="' + id + '">');
				h.push(`<td class="is-number" data-number="${day.time}">${moment.unix(day.time).format(FH.t('Date'))}</td>`);
				h.push(`<td class="is-number text-center" data-number="${day.actions}">${FH.HTML.Format(day.actions)}</td>`);
				h.push(`<td class="is-number text-center" data-number="${day.progress}">${FH.HTML.Format(day.progress)}</td>`);
				h.push('</tr>');

			});

			h.push('</tbody></table>');
		}
		else if (content === "filter") {
			detaildata = await QiProgress.db.snapshots.where({ qiround: qiround }).and(function (item) {
				return (item.date >= QiProgress.curDateFilter && item.date <= QiProgress.curDateEndFilter)
			}).toArray();

			detaildata.sort(function (a, b) { return b.time - a.time });

			h.push('<div class="datetimepicker"><button id="qiLogDatepicker" class="btn">' + QiProgress.formatRange() + '</button></div>');
			h.push('<table id="QiProgressLogTable" class="foe-table qilog"><thead>');
			h.push('<tr class="sorter-header">');
			h.push('<th class="is-number" data-type="qi-log-group">' + FH.t('Boxes.QiProgress.Date') + '</th>');
			h.push('<th class="case-sensitive" data-type="qi-log-group">' + FH.t('Boxes.QiProgress.Player') + '</th>');
			h.push('<th class="is-number text-center" data-type="qi-log-group">' + FH.HTML.Tooltip(FH.t('Boxes.QiProgress.Actions')) + '</th>');
			h.push('<th class="is-number text-center" data-type="qi-log-group">' + FH.HTML.Tooltip(FH.t('Boxes.QiProgress.Progress')) + '</th>');
			h.push('</tr>');
			h.push('</thead><tbody class="qi-log-group">');

			detaildata.forEach(e => {
				h.push('<tr data-id="' + e.time + '" id="qitime_' + e.time + '">');
				h.push(`<td class="is-number" data-number="${e.time}">${moment.unix(e.time).format(FH.t('DateTime'))}</td>`);
				h.push(`<td class="case-sensitive" data-text="${FH.helper.str.cleanup(e.name)}">${e.name}</td>`);
				h.push(`<td class="is-number text-center" data-number="${e.actions}">${FH.HTML.Format(e.actions)}</td>`);
				h.push(`<td class="is-number text-center" data-number="${e.progress}">${FH.HTML.Format(e.progress)}</td>`);
				h.push('</tr>');
			});

			h.push('</tbody></table>');
		}

		$('#QiProgressPlayerDetailsBody').html(h.join('')).promise().done(function () {

			$('#QiProgressPlayerDetailsBody .qilog').tableSorter();

			if ($('#qiLogDatepicker').length !== 0) {
				QiProgress.intiateDatePicker();
			}
			$('#QiProgressPlayerDetailsBody tr.sorter-header').on('click', function () {
				$(this).parents('.foe-table').find('tr.open').removeClass("open");

			});

			$('#QiProgressPlayerDetailsBody > .foe-table tr').on('click', function () {

				if ($(this).next("tr.detailview").length) {
					$(this).next("tr.detailview").remove();
					$(this).removeClass('open');
				}
				else {
					if (!$(this).hasClass("hasdetail")) return;

					let date = $(this).data("id");
					let player = $(this).data("player");
					let awidth = $(this).find('td:first-child').width();
					let bwidth = $(this).find('td:nth-child(2)').width();
					let cwidth = $(this).find('td:nth-child(3)').width();
					let dwidth = $(this).find('td:nth-child(4)').width();
					let ewidth = $(this).find('td:last-child').width();

					$(this).addClass('open');

					QiProgress.BuildDetailViewLog({ date: date, player: player, width: { a: awidth, b: bwidth, c: cwidth, d: dwidth, e: ewidth } });
				}
			});

		});
	},


	formatRange: () => {
		let text = undefined;
		let dateStart = moment(QiProgress.curDateFilter);
		let dateEnd = moment(QiProgress.curDateEndFilter);

		if (dateStart.isSame(dateEnd)) {
			text = `${dateStart.format(FH.t('Date'))}`;
		}
		else if (dateStart.year() !== (dateEnd.year())) {
			text = `${dateStart.format(FH.t('Date'))}` + ' - ' + `${dateEnd.format(FH.t('Date'))}`;
		}
		else {
			text = `${dateStart.format(FH.t('DateShort'))}` + ' - ' + `${dateEnd.format(FH.t('Date'))}`;
		}

		return text;
	},


	/**
	 * @param qiRound
	 * @returns {Promise<void>}
	 */
	SetBoxNavigation: async (qiRound) => {
		let h = [];
		let i = 0;
		let storageSettings = FH.Storage.getItem('QiProgressProgressSettings')
		let ProgressSettings = (storageSettings != null && storageSettings != 'undefined') ? JSON.parse(FH.Storage.getItem('QiProgressProgressSettings')) : '{}';

		if (QiProgress.AllRounds === undefined || QiProgress.AllRounds === null) {
			// get all available entires
			const qiRounds = await QiProgress.db.history.where('qiround').above(0).keys();
			qiRounds.sort(function (a, b) { return b - a });
			QiProgress.AllRounds = qiRounds;

		}

		//set latest round to show if available and no specific round is set
		if (!qiRound && QiProgress.AllRounds && QiProgress.AllRounds.length) {
			qiRound = QiProgress.AllRounds[i];
		}

		if (qiRound && QiProgress.AllRounds && QiProgress.AllRounds.length) {
			let index = QiProgress.AllRounds.indexOf(qiRound);
			let previousweek = QiProgress.AllRounds[index + 1] || null;
			let nextweek = QiProgress.AllRounds[index - 1] || null;

			h.push(`<div id="qi_roundswitch" class="roundswitch dark-bg">
				${FH.t('Boxes.QiProgress.QiRound')} <button class="btn btn-mid btn-set-week" data-week="${previousweek}"${previousweek === null ? ' disabled' : ''}>&lt;</button> 
				<select id="qi-select-qiRound">`);

				QiProgress.AllRounds.forEach(week => {
					h.push(`<option value="${week}"${qiRound === week ? ' selected="selected"' : ''}>` + moment.unix(week).subtract(11, 'd').format(FH.t('Date')) + ` - ` + moment.unix(week).format(FH.t('Date')) + `</option>`);
				});

				h.push(`</select> 
					<button class="btn btn-mid btn-set-week last" data-week="${nextweek}"${nextweek === null ? ' disabled' : ''}>&gt;</button>`);

			if (qiRound === QiProgress.CurrentQISeason) {
				h.push(`<div id="qiLogFilter" style="float:right">
					<button id="qi_filterProgressList" title="${FH.HTML.Tooltip(FH.t('Boxes.QiProgress.ProgressFilterDesc'))}" class="btn btn-mid" disabled>&#8593;</button>
					</div>`);
			}
			h.push(`</div>`);
		}

		h.push(`<div id="qiContentWrapper"></div>`);

		$('#QiProgressListBody').html(h.join('')).promise().done(function () {

			$('.btn-set-week').off().on('click', function () {
				QiProgress.HistoryView = true;
				let week = $(this).data('week');

				if (!QiProgress.AllRounds.includes(week)) { return }

				QiProgress.BuildProgressList(week);
			});

			$('#qi-select-qiRound').off().on('change', function () {
				QiProgress.HistoryView = true;
				let week = parseInt($(this).val());

				if (!QiProgress.AllRounds.includes(week) || week === QiProgress.CurrentQISeason) { return}

				QiProgress.BuildPlayerContent(week);
			});

			$('button#qi_showLog').off('click').on('click', function () {
				QiProgress.curDetailViewFilter = { content: 'filter', qiRound: QiProgress.CurrentQISeason };
				QiProgress.ShowPlayerDetailsBox(QiProgress.curDetailViewFilter)
			});

			$('button#qi_filterProgressList').on('click', function () {
				QiProgress.ToggleProgressList('qi_filterProgressList');
			});
		});
	},


	ShowSettings: () => {
		let c = [];
		c.push(`<p>${FH.t('Boxes.General.Export')}: <span class="btn-group"><button class="btn" onclick="FH.HTML.ExportTable($('#QiProgressTable'),'csv','QI')" title="${FH.HTML.Tooltip(FH.t('Boxes.General.ExportCSV'))}">CSV</button>`);
		c.push(`<button class="btn" onclick="FH.HTML.ExportTable($('#QiProgressTable'),'json','QI')" title="${FH.HTML.Tooltip(FH.t('Boxes.General.ExportJSON'))}">JSON</button></span></p>`);

		$('#QiProgressListSettingsBox').html(c.join(''));
	},

    /**
	 * @param d
	 * @returns {Promise<void>}
	 */
	HandleQiProgress: async (d) => {
		// immer zwei vorhalten, für Referenz Daten (LiveUpdate)
		if (FH.Storage.getItem('QiProgress.NewAction') !== null) {
			QiProgress.PrevAction = JSON.parse(FH.Storage.getItem('QiProgress.NewAction'));
			QiProgress.PrevActionTimestamp = parseInt(FH.Storage.getItem('QiProgress.NewActionTimestamp'));
		}
		else if (QiProgress.NewAction !== null) {
			QiProgress.PrevAction = QiProgress.NewAction;
			QiProgress.PrevActionTimestamp = QiProgress.NewActionTimestamp;
		}

		let players = []
		let sumActions = 0
		let sumProgress = 0

		for (let i in d) {
			if (!d.hasOwnProperty(i)) { break; }
			sumActions += d[i].actionPoints || 0;
			sumProgress += d[i].progressContribution || 0;

			players.push({
				qiround: QiProgress.CurrentQISeason,
				rank: i * 1 + 1,
				player_id: d[i].player.player_id,
				name: d[i].player.name,
				avatar: d[i].player.avatar,
				actions: d[i].actionPoints || 0,
				progress: d[i].progressContribution || 0
			});
		}

		await QiProgress.UpdateDB('history', { participation: players, actions: sumActions, progress: sumProgress });

		QiProgress.HistoryView = false;
		QiProgress.NewAction = players;
		FH.Storage.setItem('QiProgress.NewAction', JSON.stringify(QiProgress.NewAction));

		QiProgress.NewActionTimestamp = moment().unix();
		FH.Storage.setItem('QiProgress.NewActionTimestamp', QiProgress.NewActionTimestamp);

		if ($('#QiProgress').length > 0) {
			QiProgress.BuildProgressList(QiProgress.CurrentQISeason);
            console.log(1)
		}
		else {
			QiProgress.ShowProgressList();
		}
	},


	/**
	 * @param content
	 * @param data
	 * @returns {Promise<void>}
	 */
	UpdateDB: async (content, data) => {
		if (content === 'history') {
			await QiProgress.db.history.put({ 
                qiround: QiProgress.CurrentQISeason, 
                actions: data.actions, 
                progress: data.progress,
				participation: data.participation
            });
		}

		if (content === 'player') {
			let actions = 0

			let CurrentSnapshot = await QiProgress.db.snapshots
				.where({
					qiround: QiProgress.CurrentQISeason,
					player_id: data.player_id
				})
				.first();

			if (CurrentSnapshot === undefined) {
				actions = data.actions
				progress = data.progress
			}
			else {
				actions = data.diffActions
				progress = data.diffProgress
			}

			await QiProgress.db.snapshots.add({
				qiround: QiProgress.CurrentQISeason,
				player_id: data.player_id,
				name: data.name,
				date: parseInt(moment.unix(data.time).format("YYYYMMDD")),
				time: data.time,
				actions: actions,
				progress: progress
			});
		}

	},

	/**
	 * Filters the list for players with new progress
	 */
	ToggleProgressList: (id) => {
		let elem = $('#QiProgressTable > tbody');
		let nelem = elem.find('tr.new');
		let act = $('#' + id).hasClass('filtered') ? 'show' : 'hide';

		if (act === 'hide') {
			if (nelem.length !== 0) {
				let oelem = elem.find('tr:not(.new)');
				QiProgress.ProgressSettings.showOnlyActivePlayers = 1;
				$('#QiProgressTable > thead .text-warning').hide();
				oelem.hide();
				$('#' + id).addClass('filtered btn-green');
			}
		}

		else if (act === 'show') {
			elem.find('tr').show();
			QiProgress.ProgressSettings.showOnlyActivePlayers = 0;
			$('#QiProgressTable > thead .text-warning').show();
			$('#' + id).removeClass('filtered btn-green');
		}
	},


   DeleteOldSnapshots: async (qiround) => {
       let deleteCount = await QiProgress.db.snapshots.where("qiround").notEqual(qiround).delete();
   },
}