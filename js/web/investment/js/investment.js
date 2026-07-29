/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

// LG Investitionen
FH.proxy.addHandler('GreatBuildingsService', (data) => {

	if(typeof data['requestMethod'] === 'undefined') 
	{
		return;
	}

	if (data['requestMethod'] !== 'getContributions')
	{
		Investment.RequestBlockTime = +FH.Main.getCurrentDate();
	}

	if (data['requestMethod'] === 'getContributions')
	{
		if(!data['responseData'] ){
			return;
		}

		Investment.Data = data['responseData'];

		Investment.UpdateData(Investment.Data, true).then((e) => {
		if (Settings.GetSetting('ShowInvestments') && (+FH.Main.getCurrentDate() - Investment.RequestBlockTime) > 2000)
			{
				Investment.BuildBox(true);
			}
		});
	}
});

// My GBs tab: my own GB progress since the last visit + live contributor capture
FH.proxy.addHandler('StartupService', 'getData', async (data) => {
	Investment.VisitTime = FH.Main.getCurrentDate();
	// GB names + the srcLinks icon list load asynchronously => wait for both,
	// otherwise the table shows code names and the change icon has no image
	await FH.ExistenceConfirmed('Main.CityEntities||srcLinks.FileList');
	Investment.CheckProgress(data.responseData);
});

// Owner donations to own GBs => keep the snapshot in sync so they aren't flagged next load
FH.proxy.addHandler('CityMapService', 'updateEntity', (data) => {
	Investment.UpdateSnapshotEntities(data?.responseData);
	Investment.StashOwnGB(data?.responseData);
});

// Contributor rankings of my own GBs (on open or contribute) => capture for the per-player breakdown
FH.proxy.addHandler('GreatBuildingsService', 'all', (data, postData) => {
	if (data.requestMethod !== 'getConstruction' && data.requestMethod !== 'contributeForgePoints') return;
	let Rankings = data.requestMethod === 'getConstruction' ? data.responseData?.rankings : data.responseData;
	Investment.CaptureContributors(Rankings, postData);
});

let Investment = {
	Data: null,
	Einsatz: 0,
	Ertrag: 0,
	Medals: 0,
	HiddenElements: 0,
	RequestBlockTime: 0,

	// My GBs tab: progress of my own Great Buildings since the last visit
	ProgressList: [],
	ProgressTotal: 0,
	VisitTime: 0,
	LastOwnGBEntity: null,


	BuildBox: (event, activeTab)=> {
		Investment.ProgressTotal = 0; // Reset total progress when clicking on the icon
		Investment.RefreshChangeBar();
		let firstOpen = $('#Investment').length === 0;

		if (firstOpen) {
			FH.HTML.Box({
				id: 'Investment',
				title: FH.t('Boxes.Investment.Title'),
				auto_close: true,
				dragdrop: true,
				resize: true,
				minimize: true,
				settings: Investment.ShowInvestmentSettings
			});

			FH.HTML.AddCssFile('investment');
			Investment.BuildTabs(activeTab === 'mygbs' ? 2 : 1);
		}
		else if(!event || activeTab === 'mygbs') {
			FH.HTML.CloseOpenBox('Investment');
			return;
		}

		Investment.Show();
		Investment.ShowMyGBs();
	},


	/**
	 * Builds the tab skeleton (Contributions + My GBs) inside the box body once.
	 */
	BuildTabs: (activeTab) => {
		let h = [];
		h.push('<div class="tabs investment-tabs">');
		h.push('<ul class="horizontal dark-bg">');
		h.push(`<li class="tab-contributions"><a href="#invest-contributions">${FH.t('Boxes.Investment.Tabs.Contributions')}</a></li>`);
		h.push(`<li class="tab-mygbs"><a href="#invest-mygbs">${FH.t('Boxes.Investment.Tabs.MyGBs')}</a></li>`);
		h.push('</ul>');
		h.push('<div id="invest-contributions"></div>');
		h.push('<div id="invest-mygbs"></div>');
		h.push('</div>');

		$('#InvestmentBody').html(h.join(''));
		$('.investment-tabs').tabslet({ active: activeTab || 1 });
	},


	/**
	 * Calculate investment
	 *
	 * @constructor
	 */
	CalcFPs: async ()=> {

		let sumEinsatz = 0;
		let sumErtrag = 0;
		let	sumMedals = 0;
		let countHiddenElements = 0;

		// save previous values for number animation
		let easy_animate_start_values = {
			investsto: Investment.Einsatz,
			rewardsto: Investment.Ertrag,
			totalsto: (StrategyPoints.AvailableFP + Investment.Ertrag + Investment.Einsatz),
			medalssto: Investment.Medals
		}

		let InvestmentSettings = JSON.parse(FH.Storage.getItem('InvestmentSettings'));
		let removeUnsafeCalc = (InvestmentSettings && InvestmentSettings.removeUnsafeCalc !== undefined) ? InvestmentSettings.removeUnsafeCalc : 0;

		Investment.Einsatz = 0;
		Investment.Ertrag = 0;
		Investment.HiddenElements = 0;

		let AllInvestments = await IndexDB.db.investhistory.reverse().toArray();

		if (AllInvestments === undefined)
			return;

		for (let i in AllInvestments)
		{
			if(AllInvestments.hasOwnProperty(i))
			{
				let ishidden = (typeof AllInvestments[i].ishidden != 'undefined') ? AllInvestments[i].ishidden : 0,
					isNotSafe = AllInvestments[i].currentFp < AllInvestments[i].max_progress - AllInvestments[i].current_progress,
					removeUnsafe = !!(isNotSafe && removeUnsafeCalc);

				countHiddenElements += ishidden ? 1 : 0;
				sumEinsatz += ishidden ? 0 : AllInvestments[i].currentFp;
				sumErtrag += ishidden || removeUnsafe ? 0 : AllInvestments[i].profit - AllInvestments[i].currentFp;
				sumMedals += ishidden || removeUnsafe ? 0 : (AllInvestments[i].medals ? AllInvestments[i].medals : 0);
			}
		}

		Investment.Ertrag = sumErtrag;
		Investment.Einsatz = sumEinsatz;
		Investment.Medals = sumMedals;
		Investment.HiddenElements = countHiddenElements;

		Investment.showFPOverview(easy_animate_start_values);
	},


	Show: async ()=> {

		let b = [],
			h = [];
		let InvestmentSettings = JSON.parse(FH.Storage.getItem('InvestmentSettings'));
		let showEntryDate = (InvestmentSettings && InvestmentSettings.showEntryDate !== undefined) ? InvestmentSettings.showEntryDate : 0;
		let showInvestmentIncreaseDate = (InvestmentSettings && InvestmentSettings.showInvestmentIncreaseDate !== undefined) ? InvestmentSettings.showInvestmentIncreaseDate : 0;
		let showRestFp = (InvestmentSettings && InvestmentSettings.showRestFp !== undefined) ? InvestmentSettings.showRestFp : 0;
		let showMedals = (InvestmentSettings && InvestmentSettings.showMedals !== undefined) ? InvestmentSettings.showMedals : 0;
		let showBlueprints = (InvestmentSettings && InvestmentSettings.showBlueprints !== undefined) ? InvestmentSettings.showBlueprints : 0;
		let showHiddenGb = (InvestmentSettings && InvestmentSettings.showHiddenGb !== undefined) ? InvestmentSettings.showHiddenGb : 0;
		let lastupdate = (InvestmentSettings && InvestmentSettings.lastupdate !== undefined) ? InvestmentSettings.lastupdate : 0;
		let removeUnsafeCalc = (InvestmentSettings && InvestmentSettings.removeUnsafeCalc !== undefined) ? InvestmentSettings.removeUnsafeCalc : 0;

		b.push(`<div class="total-wrapper dark-bg">`);

		b.push(`<div id="invest-bar">${FH.t('Boxes.Investment.InvestBar')} <strong class="invest-storage">0</strong></div>`);
		b.push(`<div id="reward-bar">${FH.t('Boxes.Investment.CurrReward')}<strong class="reward-storage">0</strong>${removeUnsafeCalc ? '<span class="safe">  (' + FH.t('Boxes.Investment.Safe') + ')</span>':''}</div>`);
		b.push(`<div id="total-fp" class="text-center">${FH.t('Boxes.Investment.TotalFP')}<strong class="total-storage-invest">0</strong></div>`);
		
		if (showMedals === 1) {
			b.push('<div id="total-medals" class="text-center"><span class="invest-tooltip icon medal" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.MedalsProfit')) + '"></span><strong class="total-medals-reward">0</strong></div>');
		}
		b.push(`<div id="hidden-bar" class="hide text-center"><img class="invest-tooltip" src="${FH.extUrl}js/web/investment/images/unvisible.png" title="${FH.t('Boxes.Investment.HiddenGB')}" onclick="Investment.ToggleHidden()" /> <strong class="hidden-elements">0</strong></div>`);

		b.push(`</div>`);

		b.push(`<div id="history-wrapper"></div>`);

		$('#invest-contributions').html(b.join('')).promise().done(function(){
			Investment.CalcFPs();
		});

		// Table for history

		h.push('<table id="InvestmentTable" class="foe-table">');
		h.push('<thead class="sticky">' +
			'<tr class="sorter-header">' +
			'<th class="case-sensitive" data-type="invest-group">' + FH.t('Boxes.Investment.Overview.Player') + '</th>' +
			'<th class="case-sensitive" data-type="invest-group">' + FH.t('Boxes.Investment.Overview.Building') + '</th>' +
			'<th class="is-number text-center no-sort" data-type="invest-group"></th>');

		if (showEntryDate)
		{
			h.push('<th class="is-number invest-tooltip" data-type="invest-group" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.EntryTimeDesc')) + '">' + FH.t('Boxes.Investment.Overview.EntryTime') + '</th>');
		}

		if (showInvestmentIncreaseDate)
		{
			h.push('<th class="is-number invest-tooltip" data-type="invest-group" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.DateOfIncreaseDesc')) + '">' + FH.t('Boxes.Investment.Overview.DateOfIncrease') + '</th>');
		}

		h.push('<th class="is-number" data-type="invest-group">' + FH.t('Boxes.Investment.Overview.Progress') + '</th>');

		if (showRestFp)
		{
			h.push('<th class="is-number text-center invest-tooltip" data-type="invest-group" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.RestFPDesc')) + '">' + FH.t('Boxes.Investment.Overview.RestFP') + '</th>');
		}

		h.push('<th class="is-number text-center" data-type="invest-group">&nbsp;</th>' +
			'<th class="is-number text-center invest-tooltip" data-type="invest-group" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.InvestedDesc')) + '">' + FH.t('Boxes.Investment.Overview.Invested') + '</th>' +
			'<th class="is-number text-center invest-tooltip" data-type="invest-group" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.ProfitDesc')) + '" >' + FH.t('Boxes.Investment.Overview.Profit') + '</th>');
		
		if(showMedals)
		{
			h.push('<th class="is-number text-center" data-type="invest-group"><span class="medal" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.Medals')) + '"></span></th>');
		}
		
		if(showBlueprints)
		{
			h.push('<th class="is-number text-center" data-type="invest-group"><span class="blueprints" title="' + FH.HTML.Tooltip(FH.t('Boxes.Investment.Overview.Blueprints')) + '"></span></th>');
		}
		
		h.push('<th class="no-sort"></th></tr></thead><tbody class="invest-group">');

		let CurrentGB = await IndexDB.db.investhistory.reverse().toArray();

		if (CurrentGB === undefined)
			return;

		let data = CurrentGB;

		for (let x = 0; x < data.length; x++)
		{
			const contribution = data[x];
			let Profit = contribution['profit'];
			let RealProfit = Profit - contribution['currentFp'];
			let RealProfitClass = contribution['currentFp'] >= contribution['max_progress'] - contribution['current_progress'] ? 'success' : 'error';

			if (contribution['currentFp'] < contribution['max_progress'] - contribution['current_progress'])
			{
				RealProfitClass = 'warning';
			}
			else if(RealProfit < 0){
				RealProfitClass = 'error';
			}

			let hasFpHistoryClass = '';
			let newerClass = '';
			let DiffText = '';
			let DiffClass = 'error';
			let progressWidth = contribution['current_progress'] / contribution['max_progress'] * 100;
			let restFp = contribution['max_progress'] - contribution['current_progress'];
			let rankImageValue = contribution['rank'] <= 6 ? contribution['rank'] : 6;
			let isHidden = typeof contribution['ishidden'] !== 'undefined' ? contribution['ishidden'] : 0;
			let Blueprints = typeof contribution['blueprints'] !== 'undefined' ? contribution['blueprints'] : 0;
			let Medals = typeof contribution['medals'] !== 'undefined' ? contribution['medals'] : 0;
			let hiddenClass = '';
			let lastInvestmentIncreaseDate = null;
			let history = {};

			if (contribution['fphistory'] !== '[]')
			{
				hasFpHistoryClass = 'fphistory ';
				history = JSON.parse(contribution['fphistory'] || false);
				for (let i in history) {
					if (history.hasOwnProperty(i)) {
						if ((+FH.Main.getCurrentDate() - 300 * 1000) < new Date(history[i].date).getTime())
						{
							newerClass = 'new';
						}

						lastInvestmentIncreaseDate = history[i].date;
					}
				}
			}

			if (contribution['increase'] === 0) {
				DiffText = 0;
			} else {
				DiffText = '+' + contribution['increase'];
				DiffClass = 'success';
			}

			hiddenClass=(showHiddenGb && isHidden) ? ' ishidden' : (isHidden) ? ' ishidden hide' : '';

			h.push(`<tr id="invhist${x}" data-id="${contribution['id']}" data-max-progress="${contribution['max_progress']}" data-detail='${JSON.stringify(history)}' class="${hasFpHistoryClass}${newerClass}${hiddenClass}">` +
				`<td class="case-sensitive" data-text="${FH.helper.str.cleanup(contribution['playerName'])}"><img style="max-width: 18px" src="${srcLinks.GetPortrait(contribution['Avatar'])}" alt="${contribution['playerName']}"> ${FH.Main.GetPlayerLink(contribution['playerId'], contribution['playerName'])}</td>`);
			h.push('<td class="case-sensitive" data-text="' + FH.helper.str.cleanup(contribution['gbname']) + '">' + contribution['gbname'] + ' (' + contribution['level'] + ')</td>');
			h.push(`<td class="is-number text-center invest-tooltip" data-number="${isHidden}" title="${FH.t('Boxes.Investment.Overview.HideGB')}"><span class="hideicon ishidden-${isHidden?'on':'off'}"></span></td>`);
			
			if (showEntryDate) {
				h.push(`<td class="is-numeric" data-number="${moment(contribution['date']).format('YYMMDDHHmm')}">${moment(contribution['date']).format(FH.t('Date'))}</td>`);
			}

			if (showInvestmentIncreaseDate) {
				let increaseSort = lastInvestmentIncreaseDate ? moment(lastInvestmentIncreaseDate).format('YYMMDDHHmm') : 0;
				let increaseDate = lastInvestmentIncreaseDate ? moment(lastInvestmentIncreaseDate).format(FH.t('DateTime')) : '-';
				h.push(`<td class="is-numeric invest-tooltip" data-number="${increaseSort}">${increaseDate}</td>`);
			}

			h.push(`<td class="is-number progress" data-number="${progressWidth}"><div class="progbar" style="width: ${progressWidth}%"></div> ${contribution['current_progress']} / ${contribution['max_progress']}`);

			if (DiffText !== 0)
			{
				h.push(`<div class="diff ${DiffClass}">${DiffText}</div></td>`);
			}

			h.push(`</td>`);

			if (showRestFp)
			{
				h.push(`<td class="is-number text-center" data-number="${restFp}">${restFp}</td>`);
			}

			h.push(`<td class="is-number text-center" data-number="${contribution['rank']}"><img class="rank invest-tooltip" src="${FH.extUrl}js/web/x_img/gb_p${rankImageValue}.png" title="${FH.t('Boxes.Investment.Rank')} ${contribution['rank']}" /></td>`);
			h.push(`<td class="is-number text-center gbinvestment" data-number="${contribution['currentFp']}">${contribution['currentFp']}</td>`);
			h.push(`<td class="is-number text-center gbprofit" data-number="${RealProfit}"><b class="${RealProfitClass}">${RealProfit}</b></td>`);
			
			if(showMedals)
			{
				h.push(`<td class="is-number text-center gbmedals" data-number="${Medals}"><b class="${RealProfitClass === 'error' ? 'success' : RealProfitClass}">${FH.HTML.Format(Medals)}</b></td>`);
			}
			
			if(showBlueprints)
			{
				h.push(`<td class="is-number text-center gbblueprints" data-number="${Blueprints}"><b class="${RealProfitClass === 'error' ? 'success' : RealProfitClass}">${FH.HTML.Format(Blueprints)}</b></td>`);
			}

			h.push('<td></td></tr>');
		}

		h.push('</tbody></table>');

		if (lastupdate)
		{
			let uptodateClass = 'uptodate';

			let date = moment(lastupdate).unix();
			let actdate = moment(FH.Main.getCurrentDate()).unix();
			let datediff = actdate - date;
			let updrequTitle = FH.t('Boxes.Investment.UpToDate');

			// set notification class if last update ist older then 30 minutes
			if(datediff >= 1800)
			{
				uptodateClass='updaterequired';
				updrequTitle = FH.t('Boxes.Investment.UpdateRequired');
			}

			h.push(`<div class="last-update-message invest-tooltip" title="${updrequTitle}"><span class="icon ${uptodateClass}"></span> <span class="${uptodateClass}">${moment(lastupdate).format(FH.t('DateTime'))}</span></div>`);
		}

		$('#history-wrapper').html(h.join('')).promise().done(function(){

			$('#InvestmentTable').tableSorter();

			$('#InvestmentTable tbody tr').on('click', function () {

				if ($(this).next("tr.detailview").length)
				{
					$(this).next("tr.detailview").remove();
					$(this).removeClass('open');
				}
				else {
					if (typeof ($(this).attr("data-detail")) !== 'undefined' && $(this).attr("data-detail") !== '{}')
					{
						$(this).addClass('open');
						let id = $(this).attr("id");
						let detail = JSON.parse($(this).attr("data-detail"));
						let max_progress = $(this).attr("data-max-progress");
						let d = [];
						d.push('<tr class="detailview dark-bg"><td colspan="'+$(this).find("td").length+'"><table>');

						for (let i in detail)
						{
							if (detail.hasOwnProperty(i)) {
								let restFP = (max_progress * 1 - detail[i].current_progress * 1)
								d.push('<tr class="detail"><td>' + moment(detail[i].date).format(FH.t('DateTime')) + ' :</td><td> +' + detail[i].increase + ' </td><td>' + FH.t('Boxes.Investment.Overview.RemainingFP') + ': ' + restFP + '</td></tr>');
							}
						}

						d.push('</table></td></tr>');
						$(d.join('')).insertAfter($('#' + id));
					}
				}
			});

			$("#history-wrapper .hideicon").on('click',function(e){

				e.stopPropagation();

				let otr = $(this).parents("tr");
				let otd = $(this).parent();
				let id = $(otr).attr('data-id');
				let gbstate = parseInt($(otd).attr('data-number'),10);

				//reverse state
				gbstate = (gbstate) ? 0 : 1;

				$(otr).toggleClass('ishidden');
				$(otd).attr('data-number', gbstate);
				$(this).toggleClass('ishidden-on ishidden-off');

				Investment.SwitchGBVisibility(id, gbstate);

				Investment.CalcFPs();
			});

			$('.invest-tooltip').tooltip({
				html: true,
				container: '#history-wrapper'
			});

		});
	},


	/**
	 * Settings gear is tab-aware: render the panel for whichever tab is active.
	 */
	ShowInvestmentSettings: () => {
		if ($('.investment-tabs .horizontal li.active').hasClass('tab-mygbs')) {
			Investment.ShowMyGBsSettings();
		} else {
			Investment.ShowContributionsSettings();
		}
	},


	ShowContributionsSettings: () => {
		let c = [],
			InvestmentSettings = JSON.parse(FH.Storage.getItem('InvestmentSettings')),
			showEntryDate = (InvestmentSettings && InvestmentSettings.showEntryDate !== undefined) ? InvestmentSettings.showEntryDate : 0,
			showInvestmentIncreaseDate = (InvestmentSettings && InvestmentSettings.showInvestmentIncreaseDate !== undefined) ? InvestmentSettings.showInvestmentIncreaseDate : 0,
			showRestFp = (InvestmentSettings && InvestmentSettings.showRestFp !== undefined) ? InvestmentSettings.showRestFp : 0,
			showBlueprints = (InvestmentSettings && InvestmentSettings.showBlueprints !== undefined) ? InvestmentSettings.showBlueprints : 0,
			showMedals = (InvestmentSettings && InvestmentSettings.showMedals !== undefined) ? InvestmentSettings.showMedals : 0,
			showHiddenGb = (InvestmentSettings && InvestmentSettings.showHiddenGb !== undefined) ? InvestmentSettings.showHiddenGb : 0,
			removeUnsafeCalc = (InvestmentSettings && InvestmentSettings.removeUnsafeCalc !== undefined) ? InvestmentSettings.removeUnsafeCalc : 0,
			showinvestmentsautomatically = Settings.GetSetting('ShowInvestments');

		c.push(`<p>${FH.t('Boxes.Investment.Overview.AdditionalColumns')}:</p><input id="showentrydate" name="showentrydate" value="1" type="checkbox" ${(showEntryDate === 1) ? ' checked="checked"':''} /> <label for="showentrydate">${FH.t('Boxes.Investment.Overview.SettingsEntryTime')}</label><br>`);
		c.push(`<input id="showinvestmentincreasedate" name="showinvestmentincreasedate" value="1" type="checkbox" ${(showInvestmentIncreaseDate === 1) ? ' checked="checked"':''} /> <label for="showinvestmentincreasedate">${FH.t('Boxes.Investment.Overview.DateOfIncrease')}</label><br>`);
		c.push(`<input id="showrestfp" name="showrestfp" value="1" type="checkbox" ${(showRestFp === 1) ? ' checked="checked"':''} /> <label for="showrestfp">${FH.t('Boxes.Investment.Overview.SettingsRestFP')}</label><br>`);
		c.push(`<input id="showmedals" name="showmedals" value="1" type="checkbox" ${(showMedals === 1) ? ' checked="checked"':''} /> <label for="showmedals">${FH.t('Boxes.Investment.Overview.Medals')}</label><br>`);
		c.push(`<input id="showblueprints" name="showblueprints" value="1" type="checkbox" ${(showBlueprints === 1) ? ' checked="checked"':''} /> <label for="showblueprints">${FH.t('Boxes.Investment.Overview.Blueprints')}</label><br>`);
		c.push(`<hr /><input id="showhiddengb" name="showhiddengb" value="1" type="checkbox" ${(showHiddenGb === 1) ? ' checked="checked"':''} /> <label for="showhiddengb">${FH.t('Boxes.Investment.Overview.SettingsHiddenGB')}</label><br>`);
		c.push(`<input id="removeunsafecalc" name="removeunsafecalc" value="1" type="checkbox" ${(removeUnsafeCalc === 1) ? ' checked="checked"':''} /> <label for="removeunsafecalc">${FH.t('Boxes.Investment.Overview.SettingsUnsafeCalc')}</label>`);
		c.push(`<hr /><input id="showinvestmentsautomatically" name="showinvestmentsautomatically" value="1" type="checkbox" ${(showinvestmentsautomatically === true) ? ' checked="checked"':''} /> <label for="showinvestmentsautomatically">${FH.t('Boxes.Settings.Autostart')}</label>`);
		c.push(`<p><button id="save-Investment-settings" class="btn saveSettings" onclick="Investment.SettingsSaveValues()">${FH.t('Boxes.Investment.Overview.SettingsSave')}</button></p>`);

		$('#InvestmentSettingsBox').html(c.join(''));
	},


	ShowMyGBsSettings: () => {
		let InvestmentSettings = JSON.parse(FH.Storage.getItem('InvestmentSettings')),
			showChangeBar = (InvestmentSettings && InvestmentSettings.showChangeBar !== undefined) ? InvestmentSettings.showChangeBar : 1;

		let c = [];
		c.push(`<input id="showchangebar" name="showchangebar" value="1" type="checkbox" ${(showChangeBar === 1) ? ' checked="checked"':''} /> <label for="showchangebar">${FH.t('Boxes.GreatBuildingsProgress.SettingsShowIcon')}</label>`);
		c.push(`<p><button id="save-mygbs-settings" class="btn saveSettings" onclick="Investment.SaveMyGBsSettings()">${FH.t('Boxes.Investment.Overview.SettingsSave')}</button></p>`);

		$('#InvestmentSettingsBox').html(c.join(''));
	},


	SaveMyGBsSettings: () => {
		let value = JSON.parse(FH.Storage.getItem('InvestmentSettings') || '{}');

		value['showChangeBar'] = $("#showchangebar").is(':checked') ? 1 : 0;

		FH.Storage.setItem('InvestmentSettings', JSON.stringify(value));

		$(`#InvestmentSettingsBox`).fadeToggle('fast', function () {
			$(this).remove();
			Investment.RefreshChangeBar();
		});
	},


	RefreshInvestmentDB: async (Investment) => {
		await IndexDB.addUserFromPlayerDictIfNotExists(Investment['playerId'], true);

		let CurrentInvest = await IndexDB.db.investhistory
			.where({
				playerId: Investment['playerId'],
				entity_id: Investment['entity_id']
			})
			.first();

		if (CurrentInvest === undefined)
		{
			await IndexDB.db.investhistory.add({
				playerId: Investment['playerId'],
				playerName: Investment['playerName'],
				Avatar: Investment['Avatar'],
				entity_id: Investment['entity_id'],
				gbname: Investment['gbname'],
				level: Investment['level'],
				rank: Investment['rank'],
				currentFp: Investment['currentFp'],
				fphistory: Investment['fphistory'],
				current_progress: Investment['current_progress'],
				max_progress: Investment['max_progress'],
				profit: Investment['profit'],
				medals: Investment['medals'],
				blueprints: Investment['blueprints'],
				increase: Investment['increase'],
				ishidden: Investment['ishidden'],
				date: FH.Main.getCurrentDate()
			});
		}
		else {
			await IndexDB.db.investhistory.update(CurrentInvest.id, {
				currentFp: Investment['currentFp'],
				gbname: Investment['gbname'],
				current_progress: Investment['current_progress'],
				profit: Investment['profit'],
				medals: Investment['medals'],
				blueprints: Investment['blueprints'],
				rank: Investment['rank'],
				fphistory: Investment['fphistory'],
				increase: Investment['increase'],
				ishidden: Investment['ishidden']
			});
		}
	},


	UpdateData: async (LGData, FullSync) => {

		let arc = 1 + (FH.Main.ArkBonus / 100);
		let allGB = await IndexDB.db.investhistory.where('id').above(0).keys();
		let UpdatedList = false;
		let playerSyncGbKeys = null;
		let arcLevelCheck = JSON.parse(FH.Storage.getItem('InvestmentArcBonus'));
		let forceFullUpdate = !arcLevelCheck || arcLevelCheck != FH.Main.ArkBonus ? true : false;

		for (let i in LGData)
		{
			if (LGData.hasOwnProperty(i))
			{
				let PlayerID = LGData[i]['player']['player_id'];
				if (PlayerID === FH.Player.ID) continue;
				// if update started from Player GB Overview
				// get all available investment from Storage to check if already leveled
				if (!FullSync && playerSyncGbKeys === null) {
					playerSyncGbKeys = await IndexDB.db.investhistory
						.filter(function (player) {
							return player.playerId === PlayerID;
						})
						.keys();
				}

				if (LGData[i]['forge_points'] === undefined) {
					continue;
				}

				let PlayerName = LGData[i]['player']['name'],
					Avatar = LGData[i]['player']['avatar'],
					EntityID = LGData[i]['entity_id'],
					GBName = LGData[i]['name'],
					GBLevel = LGData[i]['level'],
					CurrentFP = LGData[i]['forge_points'],
					CurrentProgress = LGData[i]['current_progress'],
					MaxProgress = LGData[i]['max_progress'],
					Rank = LGData[i]['rank'],
					increase = 0;
				let CurrentErtrag = 0.0;
				let Medals = 0;
				let Blueprints = 0;
				let Profit = 0;
				let GbhasUpdate = false;
				let arrfphistory = [];
				let isHidden = 0;

				if (undefined !== LGData[i]['reward']) {
					Medals = FH.Main.round(LGData[i]['reward']['resources'] !== undefined && LGData[i]['reward']['resources']['medals'] !== undefined ?  LGData[i]['reward']['resources']['medals'] * arc : 0);
					Blueprints = FH.Main.round(LGData[i]['reward']['blueprints'] !== undefined ? LGData[i]['reward']['blueprints'] * arc : 0);
					CurrentErtrag = FH.Main.round(LGData[i]['reward']['strategy_point_amount'] !== undefined ? LGData[i]['reward']['strategy_point_amount'] * arc : 0);
					Profit = CurrentErtrag;
				}

				let CurrentGB = await IndexDB.db.investhistory
					.where({
						playerId: PlayerID,
						entity_id: EntityID
					})
					.first();

				// Remove GreatBuilding which has a new reinvestment and wasn't updated before
				if (CurrentGB !== undefined && CurrentGB['level'] !== GBLevel){
					await IndexDB.db.investhistory
						.where({
							playerId: PlayerID,
							entity_id: EntityID
						})
						.delete();
					CurrentGB = undefined;
				}

				// LG gefunden mit investierten FP => Wert bekannt
				if (CurrentGB !== undefined && CurrentGB['current_progress'] < CurrentProgress)
				{
					GbhasUpdate = true;
					increase = CurrentProgress - CurrentGB['current_progress'];

					let data = {
						current_progress: CurrentProgress,
						date: FH.Main.getCurrentDate(),
						increase: increase
					}

					let fphistory = JSON.parse(CurrentGB['fphistory']);
					for (let i in fphistory) {
						if (fphistory.hasOwnProperty(i)) {
							arrfphistory.push(fphistory[i]);
						}
					}

					arrfphistory.push(data);
				}

				if (CurrentGB !== undefined && FullSync)
				{
					allGB = Investment.remove_key_from_array(allGB, CurrentGB.id);
				}

				if (CurrentGB !== undefined && !FullSync && playerSyncGbKeys !== null)
				{
					playerSyncGbKeys = Investment.remove_key_from_array(playerSyncGbKeys, CurrentGB.id);
				}

				if(CurrentGB !== undefined && (CurrentGB['ishidden'] === undefined || CurrentGB['medals'] === undefined || forceFullUpdate))
				{
					GbhasUpdate=true;
					
					if(!arrfphistory.length)
					{
						arrfphistory = JSON.parse(CurrentGB['fphistory']);
					}
					
					if(CurrentGB['ishidden'] !== undefined) 
					{
						isHidden = CurrentGB['ishidden'];
					}
				}

				if (CurrentGB === undefined || GbhasUpdate)
				{
					UpdatedList = true;
					await Investment.RefreshInvestmentDB({
						playerId: PlayerID,
						playerName: PlayerName,
						Avatar: Avatar,
						entity_id: EntityID,
						gbname: GBName,
						level: GBLevel,
						rank: Rank,
						currentFp: CurrentFP,
						fphistory: JSON.stringify(arrfphistory),
						current_progress: CurrentProgress,
						max_progress: MaxProgress,
						profit: Profit,
						medals: Medals,
						blueprints: Blueprints,
						ishidden: isHidden,
						increase: increase
					});
				}
			}
		}

		// Delete leveled GBs in FullSync from GB Overview
		if (FullSync && allGB.length >= 1)
		{
			UpdatedList=true;
			await IndexDB.db.investhistory.where('id').anyOf(allGB).delete();
		}

		// Delete leveled GBs from GB Player Overview
		if (!FullSync && playerSyncGbKeys !== null && playerSyncGbKeys.length >= 1) {
			UpdatedList=true;
			await IndexDB.db.investhistory.where('id').anyOf(playerSyncGbKeys).delete();
		}

		if (UpdatedList && $('#Investment').length !== 0) {
			Investment.Show();
		}

		// Set Update Date + ArcBonus in local Storage
		if(FullSync){
			let InvestmentSettings = JSON.parse(FH.Storage.getItem('InvestmentSettings') || '{}');
			InvestmentSettings['lastupdate'] = FH.Main.getCurrentDate();
			FH.Storage.setItem('InvestmentSettings', JSON.stringify(InvestmentSettings));
			FH.Storage.setItem('InvestmentArcBonus', FH.Main.ArkBonus);
		}
	},


	SwitchGBVisibility: async (id,state) => {

		id = parseInt(id);
		await IndexDB.db.investhistory.update(id, {
			ishidden: parseInt(state)
		});

	},


	ToggleHidden: () => {

		let value = JSON.parse(FH.Storage.getItem('InvestmentSettings') || '{}');

		value['showHiddenGb'] = 1 - value['showHiddenGb'];

		FH.Storage.setItem('InvestmentSettings', JSON.stringify(value));

		Investment.Show();
	},


	SettingsSaveValues: () => {

		let value = JSON.parse(FH.Storage.getItem('InvestmentSettings') || '{}');
		let autoOpen = false;

		value['showEntryDate'] = 0;
		value['showRestFp'] = 0;
		value['showBlueprints'] = 0;
		value['showMedals'] = 0;
		value['showHiddenGb'] = 0;
		value['removeUnsafeCalc'] = 0;
		value['showInvestmentIncreaseDate'] = 0;

		if ($("#showentrydate").is(':checked'))
			value['showEntryDate'] = 1;

		if ($("#showrestfp").is(':checked'))
			value['showRestFp'] = 1;

		if ($("#showmedals").is(':checked'))
			value['showMedals'] = 1;

		if ($("#showblueprints").is(':checked'))
			value['showBlueprints'] = 1;

		if ($("#showhiddengb").is(':checked'))
			value['showHiddenGb'] = 1;

		if ($("#removeunsafecalc").is(':checked'))
			value['removeUnsafeCalc'] = 1;

		if ($("#showinvestmentincreasedate").is(':checked'))
			value['showInvestmentIncreaseDate'] = 1;

		if ($("#showinvestmentsautomatically").is(':checked'))
			autoOpen = true;

		FH.Storage.setItem('ShowInvestments', autoOpen);

		FH.Storage.setItem('InvestmentSettings', JSON.stringify(value));

		$(`#InvestmentSettingsBox`).fadeToggle('fast', function () {
			$(this).remove();
			Investment.Show();
		});
	},


	remove_key_from_array: (arr, value) => {
		return arr.filter(function (ele) {
			return ele !== value;
		});
	},


	showFPOverview: (startvalues) => {

		let Ertrag = Investment.Ertrag;
		let Einsatz = Investment.Einsatz;
		let Medals = Investment.Medals;
		let hiddenElements = Investment.HiddenElements;

		if(hiddenElements > 0)
		{
			$('#hidden-bar').removeClass('hide');
			$('#hidden-bar .hidden-elements').html(hiddenElements);
		}
		else {
			$('#hidden-bar').addClass('hide');
		}

		let investstart = (startvalues.investsto !== Einsatz) ? startvalues.investsto : 0;

		$('.invest-storage').easy_number_animate({
			start_value: investstart,
			end_value: Einsatz,
			duration: 750
		});

		let rewardstart = (startvalues.rewardsto !== Ertrag) ? startvalues.rewardsto : 0;

		$('.reward-storage').easy_number_animate({
			start_value: rewardstart,
			end_value: Ertrag,
			duration: 750
		});

		let sumTotal = (StrategyPoints.AvailableFP + Ertrag + Einsatz);
		let totalstart = (startvalues.totalsto !== sumTotal) ? startvalues.totalsto : 0;

		$('.total-storage-invest').easy_number_animate({
			start_value: totalstart,
			end_value: sumTotal,
			duration: 750
		});

		let medalsstart = (startvalues.medalssto !== Medals) ? startvalues.medalssto : 0;

		if($("#total-medals").length !== 0) 
		{
			$('.total-medals-reward').easy_number_animate({
				start_value: medalsstart,
				end_value: Medals,
				duration: 750
			});

		}
	},


	/**
	 * Compares my own GB progress against the last visit, stores the new state and updates the change icon. 
	 * Owner donations are kept in sync via UpdateSnapshotEntities so they are not flagged as a change on the next load.
	 */
	CheckProgress: (ResponseData) => {
		let Entities = ResponseData?.city_map?.entities;
		if (!Entities) return;

		let StorageKey = 'GreatBuildingsSnapshot.' + (FH.Player?.ID || 'unknown');

		// Current state, keyed by cityentity_id (only one GB per city => unique)
		let Current = {};
		for (let Entity of Entities) {
			if (Entity.type !== 'greatbuilding') continue;
			let State = Entity.state || {};
			Current[Entity.cityentity_id] = {
				name: FH.Main.CityEntities?.[Entity.cityentity_id]?.name || Entity.cityentity_id,
				level: Entity.level,
				invested: State.invested_forge_points || 0,
				needed: State.forge_points_for_level_up || 0
			};
		}

		let Previous = null;
		try {
			Previous = JSON.parse(FH.Storage.getItem(StorageKey));
		} catch (e) { }

		// Save the state for the next visit
		FH.Storage.setItem(StorageKey, JSON.stringify(Current));

		// Full list of GBs; each entry is flagged as changed or not since the last visit
		let List = [];
		for (let ID in Current) {
			let C = Current[ID],
				P = Previous ? Previous[ID] : null;

			if (!P) { // newly built since the last visit (or nothing to compare on the first load)
				let NewlyBuilt = Previous !== null;
				List.push({ CeId: ID, Name: C.name, PrevLevel: NewlyBuilt ? null : C.level, NewLevel: C.level, PrevFP: NewlyBuilt ? 0 : C.invested, PrevNeeded: NewlyBuilt ? null : C.needed, NewFP: C.invested, Needed: C.needed, DeltaFP: NewlyBuilt ? C.invested : 0, Changed: NewlyBuilt });
				continue;
			}

			let LeveledUp = C.level !== P.level,
				HasChange = LeveledUp || C.invested > P.invested,
				// Same level: invested FP. Level-up: remainder to the old level + FP in the new level.
				DeltaFP = !HasChange ? 0 : (LeveledUp ? (P.needed - P.invested) + C.invested : C.invested - P.invested);

			List.push({ CeId: ID, Name: C.name, PrevLevel: P.level, NewLevel: C.level, PrevFP: P.invested, PrevNeeded: P.needed, NewFP: C.invested, Needed: C.needed, DeltaFP: DeltaFP, Changed: HasChange });
		}

		// Changed GBs first, then the rest; each group sorted by name
		List.sort((a, b) => (b.Changed - a.Changed) || a.Name.localeCompare(b.Name));
		Investment.ProgressList = List;
		Investment.ProgressTotal = List.reduce((sum, g) => sum + (g.Changed ? g.DeltaFP : 0), 0);

		Investment.RefreshChangeBar();

		// keep the My GBs tab in sync if the box is already open
		if ($('#invest-mygbs').length !== 0) Investment.ShowMyGBs();
	},


	/**
	 * Small clickable icon on the UI showing the total FP change across my GBs since the last visit. 
	 * Click opens the Investment box on the My GBs tab.
	 */
	RefreshChangeBar: async () => {
		let InvestmentSettings = JSON.parse(FH.Storage.getItem('InvestmentSettings') || '{}');
		let showChangeBar = (InvestmentSettings && InvestmentSettings.showChangeBar !== undefined) ? InvestmentSettings.showChangeBar : 1;

		if (!showChangeBar) {
			$('#gb-change-bar').remove();
			return;
		}

		let Total = Investment.ProgressTotal || 0;

		if ($('#gb-change-bar').length === 0) {
			// wait for hammerBar
			await FH.ExistenceConfirmed(`$('#hammerBar')`);

			if ($('#gb-change-bar').length === 0) { // re-check: another call may have created it while waiting
				FH.HTML.AddCssFile('investment'); // icon can show before the box is ever opened

				let $bar = $('<div id="gb-change-bar" />')
					.attr({ class: 'game-cursor barItem MapActivityHide ActiveOnmain', title: FH.t('Boxes.GreatBuildingsProgress.SubTitle') })
					.append('<img />')
					.append('<span class="gb-change-total"></span>')
					.on('click', () => Investment.BuildBox(true, 'mygbs'));
				$('#hammerBar').append($bar);

				// Main city only; the ActiveMapUpdated handler shows/hides it on later map changes
				if (FH.ActiveMap !== 'main') $('#gb-change-bar').hide();
			}
		}

		$('#gb-change-bar img').attr('src', srcLinks.get('/shared/icons/great_building.png', true));
		$('#gb-change-bar')
			.toggleClass('has-change', Total > 0)
			.find('.gb-change-total').text(Total > 0 ? '+' + FH.HTML.Format(Total) : '');
	},


	/**
	 * Renders the My GBs tab: every GB with changed ones first (see CheckProgress). Click a row to expand the per-player breakdown.
	 */
	ShowMyGBs: () => {
		let List = Investment.ProgressList;

		let h = [];

		h.push('<table class="foe-table">');
		h.push('<thead class="sticky"><tr>');
		h.push('<th>' + FH.t('Boxes.GreatBuildings.GreatBulding') + '</th>');
		h.push('<th>' + FH.t('Boxes.GreatBuildings.Level') + '</th>');
		h.push('<th>' + FH.t('Boxes.GreatBuildingsProgress.Progress') + '</th>');
		h.push('<th>' + FH.t('Boxes.GreatBuildingsProgress.DeltaFP') + '</th>');
		h.push('<th>' + FH.t('Boxes.GreatBuildingsProgress.MyFP') + '</th>');
		h.push('<th>' + FH.t('Boxes.GreatBuildingsProgress.Donators') + '</th>');
		h.push('</tr></thead><tbody>');

		// Per-GB contributor summary (my FP + donator count), only for GBs opened in-game this session
		let ContribStore = {};
		try { ContribStore = JSON.parse(FH.Storage.getItem('GreatBuildingsContributors.' + (FH.Player?.ID || 'unknown'))) || {}; } catch (e) { }

		for (let Entry of List) {
			h.push(`<tr class="gbprow${Entry.Changed ? ' changed' : ''}" data-ceid="${Entry.CeId}">`);
			h.push(Investment.BuildProgressRowCells(Entry, ContribStore[Entry.CeId]));
			h.push('</tr>');
		}

		h.push('</tbody></table>');

		$('#invest-mygbs').html(h.join('')).promise().done(function () {
			$('#invest-mygbs .gbprow').on('click', function () {
				Investment.ToggleContributors($(this));
			});
		});
	},


	/**
	 * Inner cells (name / level / progress bar / delta / my FP / donators) of one My GBs row.
	 * Contrib is this GB's captured contributor entry (or undefined if not opened in-game yet).
	 */
	BuildProgressRowCells: (Entry, Contrib) => {
		let LeveledUp = Entry.PrevLevel !== null && Entry.NewLevel !== Entry.PrevLevel,
			Invested = Entry.NewFP || 0,
			Needed = Entry.Needed || 0,
			Width = Needed > 0 ? Math.min(100, Invested / Needed * 100) : 100,
			LevelHtml = Entry.PrevLevel === null ? ('&ndash; &#129130; ' + Entry.NewLevel) : (LeveledUp ? (Entry.PrevLevel + ' &#129130; ' + Entry.NewLevel) : Entry.NewLevel);

		let Curr = Contrib && Contrib.curr ? Contrib.curr : null,
			MyId = FH.Player?.ID,
			MyFP = Curr ? ((MyId != null && Curr[MyId]) ? Curr[MyId].fp : 0) : null,
			Donators = Curr ? Object.keys(Curr).length : null;

		let c = [];
		c.push('<td>' + Entry.Name + '</td>');
		c.push('<td' + (LeveledUp ? ' class="leveled"' : '') + '>' + LevelHtml + '</td>');
		c.push(`<td class="progress"><div class="progbar" style="width: ${Width}%"></div> ${FH.HTML.Format(Invested)} / ${FH.HTML.Format(Needed)}</td>`);
		c.push('<td>' + (Entry.Changed ? '<strong class="success">' + (Entry.DeltaFP > 0 ? '+' : '') + FH.HTML.Format(Entry.DeltaFP) + '</strong>' : '') + '</td>');
		c.push('<td class="is-number text-center">' + (MyFP !== null ? FH.HTML.Format(MyFP) : '') + '</td>');
		c.push('<td class="is-number text-center">' + (Donators !== null ? Donators : '') + '</td>');
		return c.join('');
	},


	/**
	 * Expands/collapses the per-player contributor breakdown under a GB row.
	 */
	ToggleContributors: ($row) => {
		if ($row.next('tr.gbpdetail').length) {
			$row.next('tr.gbpdetail').remove();
			$row.removeClass('open');
			return;
		}

		$row.addClass('open');
		let ColSpan = $row.find('td').length;
		let d = [];
		d.push(`<tr class="gbpdetail dark-bg"><td colspan="${ColSpan}">`);
		d.push(Investment.BuildContributorsHtml($row.attr('data-ceid')));
		d.push('</td></tr>');
		$(d.join('')).insertAfter($row);
	},


	/**
	 * Builds the per-player contributor table for one GB from the captured rankings.
	 * Contributor data only exists once the GB has been opened in-game.
	 */
	BuildContributorsHtml: (CeId) => {
		let StorageKey = 'GreatBuildingsContributors.' + (FH.Player?.ID || 'unknown');
		let Store = {};
		try { Store = JSON.parse(FH.Storage.getItem(StorageKey)) || {}; } catch (e) { }

		let Entry = Store[CeId];
		if (!Entry || !Entry.curr) {
			return '<div class="gbp-note">' + FH.t('Boxes.GreatBuildingsProgress.NoContributors') + '</div>';
		}

		let Curr = Entry.curr,
			Prev = Entry.prev || {},
			HasBaseline = !!Entry.prevCapturedAt; // no baseline on first capture / after a level-up

		let Rows = Object.keys(Curr).map((Pid) => {
			let C = Curr[Pid],
				P = Prev[Pid];
			return { name: C.name, fp: C.fp, delta: HasBaseline ? C.fp - (P ? P.fp : 0) : 0 };
		});
		Rows.sort((a, b) => b.fp - a.fp);

		let Since = HasBaseline ? moment(Entry.prevCapturedAt).format(FH.t('DateTime')) : FH.t('Boxes.GreatBuildingsProgress.FirstVisit');

		let b = [];
		b.push('<div class="gbp-note">' + FH.t('Boxes.GreatBuildingsProgress.ContributorsSince').replace('__date__', Since) + '</div>');
		b.push('<table class="gbp-contrib">');
		b.push('<tr><th>' + FH.t('General.Player') + '</th><th>' + FH.t('Boxes.GreatBuildingsProgress.NewFP') + '</th><th>' + FH.t('Boxes.GreatBuildingsProgress.DeltaFP') + '</th></tr>');

		for (let R of Rows) {
			b.push('<tr' + (R.delta > 0 ? ' class="gbp-new"' : '') + '><td>' + R.name + '</td><td>' + FH.HTML.Format(R.fp) + '</td><td>' + (R.delta > 0 ? '<strong class="success">+' + FH.HTML.Format(R.delta) + '</strong>' : '') + '</td></tr>');
		}

		b.push('</table>');
		return b.join('');
	},


	/**
	 * Re-renders the expanded contributor breakdown of one GB in the open My GBs tab.
	 */
	RefreshContributors: (CeId) => {
		if ($('#invest-mygbs').length === 0) return; // tab not rendered

		let $detail = $('#invest-mygbs .gbprow[data-ceid="' + CeId + '"]').next('tr.gbpdetail');
		if (!$detail.length) return; // row not expanded => next open reads storage anyway

		$detail.children('td').html(Investment.BuildContributorsHtml(CeId)); // outer cell only, not the nested table's
	},


	/**
	 * Keeps the snapshot in sync with owner donations (CityMapService.updateEntity), so dropping FP on my own GB 
	 * is not reported as a change on the next load.
	 */
	UpdateSnapshotEntities: (Entities) => {
		if (!Array.isArray(Entities)) return;

		let StorageKey = 'GreatBuildingsSnapshot.' + (FH.Player?.ID || 'unknown');
		let Snapshot = null;
		try { Snapshot = JSON.parse(FH.Storage.getItem(StorageKey)); } catch (e) { }
		if (!Snapshot) return; // no baseline yet => CheckProgress seeds it on the next load

		let Changed = false;
		for (let Entity of Entities) {
			if (Entity.type !== 'greatbuilding') continue;
			if (Entity.player_id !== undefined && Entity.player_id !== FH.Player.ID) continue; // another player's GB

			let State = Entity.state || {},
				Invested = State.invested_forge_points || 0,
				Needed = State.forge_points_for_level_up || 0;

			Snapshot[Entity.cityentity_id] = {
				name: FH.Main.CityEntities?.[Entity.cityentity_id]?.name || Entity.cityentity_id,
				level: Entity.level,
				invested: Invested,
				needed: Needed
			};
			Changed = true;
			// Silent: my own donation must not show up in the icon/list. Only the baseline
			// is synced so it also isn't counted as a change on the next load.
		}

		if (Changed) FH.Storage.setItem(StorageKey, JSON.stringify(Snapshot));
	},


	/**
	 * Remembers the own GB entity from a CityMapService.updateEntity within the current
	 * batch, so the contributor rankings that follow can be tied to it. Cleared on the next microtask.
	 */
	StashOwnGB: (Entities) => {
		if (!Array.isArray(Entities)) return;

		for (let Entity of Entities) {
			if (Entity.type !== 'greatbuilding') continue;
			if (Entity.player_id !== undefined && Entity.player_id !== FH.Player.ID) continue;

			Investment.LastOwnGBEntity = { CeId: Entity.cityentity_id, Level: Entity.level };
			Promise.resolve().then(() => { Investment.LastOwnGBEntity = null; });
			break;
		}
	},


	/**
	 * Captures the contributor rankings of one of my own GBs (opened or contributed to in-game). 
	 * Stores current + previous-visit maps per cityentity_id so the breakdown can show 
	 * who contributed since the last visit; the baseline is frozen per visit.
	 */
	CaptureContributors: (Rankings, PostData) => {
		if (!Array.isArray(Rankings)) return;

		let CeId, Level;

		// Primary: the own GB entity from the updateEntity in this same batch
		if (Investment.LastOwnGBEntity) {
			CeId = Investment.LastOwnGBEntity.CeId;
			Level = Investment.LastOwnGBEntity.Level;
		}
		// Fallback: resolve the numeric map entity id carried in the request
		else if (Array.isArray(PostData)) {
			let Req = PostData.find((p) => p && p.requestClass === 'GreatBuildingsService' &&
				(p.requestMethod === 'getConstruction' || p.requestMethod === 'contributeForgePoints'));
			if (Req && Array.isArray(Req.requestData)) {
				for (let v of Req.requestData) {
					let e = FH.Main.CityMapData?.[v];
					if (e && e.type === 'greatbuilding') { CeId = e.cityentity_id; Level = e.level; break; }
				}
			}
		}

		if (CeId === undefined) return; // not one of my own GBs (e.g. another player's)

		let Players = {};
		for (let Row of Rankings) {
			let Pid = Row?.player?.player_id;
			if (Pid === undefined) continue; // "No contributor yet" placeholder slots
			// Own donations are listed here too; only the gb-change-bar ignores them (UpdateSnapshotEntities).
			Players[Pid] = { name: Row.player.name, fp: Row.forge_points || 0 };
		}

		let StorageKey = 'GreatBuildingsContributors.' + (FH.Player?.ID || 'unknown');
		let Store = {};
		try { Store = JSON.parse(FH.Storage.getItem(StorageKey)) || {}; } catch (e) { }

		let Existing = Store[CeId];
		let Prev, PrevAt;
		if (Existing && Existing.level === Level && Existing.visit === Investment.VisitTime) {
			Prev = Existing.prev || {};       // same visit => keep the frozen baseline
			PrevAt = Existing.prevCapturedAt || null;
		} else if (Existing && Existing.level === Level) {
			Prev = Existing.curr || {};       // new visit => last visit's state becomes the baseline
			PrevAt = Existing.capturedAt || null;
		} else {
			Prev = {};                        // first capture or a level-up => fresh baseline
			PrevAt = null;
		}

		Store[CeId] = {
			level: Level,
			visit: Investment.VisitTime,
			capturedAt: FH.Main.getCurrentDate(),
			prevCapturedAt: PrevAt,
			curr: Players,
			prev: Prev
		};

		FH.Storage.setItem(StorageKey, JSON.stringify(Store));

		Investment.RefreshContributors(CeId); // update the open My GBs tab, if any
	}

};