/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

{
_menu = {
	isBottom: false,
	selectedMenu: 'RightBar',
	MenuScrollTop: 0,
	MenuScrollLeft: 0,
	SlideParts: 0,
	ActiveSlide: 1,
	HudCount: 0,
	HudLength: 0,
	HudHeight: 0,
	HudWidth: 0,
	TopOffset: 0,

	MenuOptions: ['BottomBar', 'RightBar', 'Box'],
	
	Items: [
		'partCalc',
		'outpost',
		'productions',
		'productionsRating',
		'hiddenRewards',
		'negotiation',
		'infobox',
		'notice',
		'technologies',
		'cityMap',
		'settings',
		'stats',
		'kits',
		'greatBuildings',
		'market',
		'blueGalaxy',
		'moppelHelper',
		'fpCollector',
		'gildFight',
		'investment',
		'alerts',
		'guildMemberstat',
		'gexStat',
		'castle',
		'music',
		'musicControl',
		'minigame_aztecs',
		'recurringQuests',
		'compare_friends_threads',
		'discord',
		'findGB',
		'playerProfile',
		'unit',
		'shopAssist',
		'allies',
		'notes'
	],
	HiddenItems: [],


	/**
	 * Create the div holders and put them to the DOM
	 */
	CallSelectedMenu: (selMenu = 'RightBar') => {
	
		window.onresize = (function(event){
			if (event.target == window) _menu.OverflowCheck()
		})

		if (selMenu === 'RightBar') {
			_menu.selectedMenu = 'RightBar';
			_menu_right.BuildOverlayMenu();
		}
		else if (selMenu === 'BottomBar') {
			_menu.selectedMenu = 'BottomBar';
			_menu_bottom.BuildOverlayMenu();
		}
		else if (selMenu === 'Box') {
			_menu.selectedMenu = 'Box';
			_menu_box.BuildBoxMenu();
        }

		if(Settings.GetSetting('AutoOpenInfoBox')){
			Infoboard.Show();
		}

		if(Settings.GetSetting('AutoOpenNotes')){
			Notes.Show();
		}

		if (Settings.GetSetting('AutoOpenCloseBox')) {
			CloseBox.BuildBox();
		}
		
		_menu.OverflowCheck(_menu.selectedMenu, true);
	},

	OverflowCheck: (selMenu='Box', flag) => {
		if (window.innerHeight >= 600 && window.innerWidth >= 950 && (!flag && selMenu != FH.Main.SelectedMenu)) {			
			$('#menu_box').remove();
			$('.tooltip').remove();
			_menu.CallSelectedMenu(FH.Main.SelectedMenu);
		}
	},

	/**
	 * Hides a button. The HUD slider must already be filled for this.
	 */
	HideButton: (buttonId) => {
		if ($('#forgehammer-hud-slider').has(`div#${buttonId}`).length > 0)
		{
			$($('#forgehammer-hud-slider').children(`div#${buttonId}`)[0]).hide();
		}
	},


	/**
	 * Shows a hidden button again
	 */
	ShowButton: (buttonId) => {
		if ($('#forgehammer-hud-slider').has(`div#${buttonId}`))
		{
			$($('#forgehammer-hud-slider').children(`div#${buttonId}`)[0]).show();
		}
	},

	
	toolTipp: (btn, title, desc) => {
		$(btn).attr('title', desc);
		let pos = (_menu.selectedMenu === 'RightBar' ? 'left' : 'top');

		// fix the tooltip position when menu is box and at the top border
		if(_menu.selectedMenu === 'Box' && _menu.TopOffset < 120){
			pos = 'bottom';
		}

		return $(btn).tooltip({
			useFoEHelperSkin: true,
			headLine: title,
			content: desc,
			container: 'body',
			placement: pos
		});
	},


	/**
	* Integrates all required buttons
	*/
	ListLinks: (InsertMenuFunction) => {
		let StorgedItems = FH.Storage.getItem('MenuSort');
		let HiddenItems = FH.Storage.getItem('MenuHiddenItems');

		// Beta-Funktionen
		if (FH.Beta.active) {
			_menu.Items.unshift(...FH.Beta.menu);
		}

		if (StorgedItems !== null) {
			let storedItems = JSON.parse(StorgedItems);

			let missingMenu = storedItems.filter(function (sI) {
				return !_menu.Items.some(function (mI) {
					return sI === mI;
				});
			});

			let missingStored = _menu.Items.filter(function (mI) {
				return !storedItems.some(function (sI) {
					return sI === mI;
				});
			});

			_menu.Items = JSON.parse(StorgedItems);

			let items = missingMenu.concat(missingStored);

			// there is indeed something new...
			if (items.length > 0) {
				for (let i in items) {
					if (!items.hasOwnProperty(i)) {
						break;
					}

					// ... new comes in front ;-)
					_menu.Items.unshift(items[i]);
				}
			}
		}

		// Filter out beta functions
		_menu.Items = _menu.Items.filter(e => {
			if (FH.Beta.active) return true;
			return !FH.Beta.menu.includes(e);
		});

		// Filter out duplicates
		function unique(arr) {
			return arr.filter(function (value, index, self) {
				return self.indexOf(value) === index;
			});
		}

		_menu.Items = unique(_menu.Items);

		// remove all hidden items
		if(HiddenItems !== null)
		{
			let hiddenItems = JSON.parse(HiddenItems);
			_menu.HiddenItems = hiddenItems;
			_menu.Items = _menu.Items.filter(val => !hiddenItems.includes(val));
		}

		// Menüpunkte einbinden
		for (let i in _menu.Items)
		{
			if (!_menu.Items.hasOwnProperty(i)) {
				break;
			}

			const name = _menu.Items[i] + '_Btn';

			// gibt es eine Funktion?
			if (_menu[name] !== undefined) {
				InsertMenuFunction(_menu[name]());
			}
		}

		_menu.Items = _menu.Items.filter(e => e);
	},


	/**
	 * Toggle a menu buttons' visibility, update HiddenItems and corresponding settings button
	 */
	ToggleItemVisibility: (name) => {
		if(_menu.HiddenItems.includes(name)) {
			$('#' + name + '-Btn').removeClass('btn-hidden');
			$('#setting-' + name + '-Btn').removeClass('hud-btn-red');

			_menu.HiddenItems = _menu.HiddenItems.filter(e => {
				return e !== name;
			});
			if (_menu.Items.indexOf(name) == -1) _menu.Items.push(name);
		}
		else {
			$('#' + name + '-Btn').addClass('btn-hidden');
			$('#setting-' + name + '-Btn').addClass('hud-btn-red');

			_menu.HiddenItems.push(name);
		}
		
		FH.Storage.setItem('MenuHiddenItems', JSON.stringify(_menu.HiddenItems));

		// refresh the Menü after setting-toggle
		setTimeout(()=> {
			$('#forgehammer-hud, #menu_box').remove();
			_menu.CallSelectedMenu(FH.Main.SelectedMenu);
		}, 100);

	},


	/**
	 * Checks whether anything has changed in the sorting of the items.
	 */
	equalTo: (storedItems) => {
		for (let i = 0; i < storedItems.length; i++) {
			// Es hat sich etwas an der Sortierung verändert
			if (storedItems[i] !== _menu.Items[i]) return false;
		}

		return true;
	},


	MakeButton: (slug, red = false)=> {
		let btnData = _menu.ItemsData.find(x => x.id === slug);
		let btn = _menu.toolTipp(
			$('<div />').attr({
				id: `${slug}-Btn`,
				'data-slug': slug
			}).addClass('hud-btn'),
			btnData?.title,
			(btnData?.warning||"") + btnData?.description,
			`${slug}-btn`
		);

		if (red) 
			btn.addClass('hud-btn-red');

		return btn;
	},

	/*----------------------------------------------------------------------------------------------------------------*/
	
	ItemsData: [
		{ id: 'partCalc', title: FH.t('Menu.OwnpartCalculator.Title'), description: FH.t('Menu.OwnpartCalculator.Desc'), warning: '<em id="partCalc-Btn-closed" class="tooltip-error">' + FH.t('Menu.OwnpartCalculator.Warning') + '<br></em>'},
		{ id: 'unit', title: FH.t('Menu.Unit.Title'), description: FH.t('Menu.Unit.Desc'), warning: '<em id="unit-Btn-closed" class="tooltip-error">' + FH.t('Menu.Unit.Warning') + '<br></em>'},
		{ id: 'outpost', title: FH.t('Menu.OutP.Title'), description: FH.t('Menu.OutP.Desc'), warning: FH.t('Menu.OutP.DescWarningOutpostData') },
		{ id: 'shopAssist', title: FH.t('Menu.ShopAssist.Title'), description: FH.t('Menu.ShopAssist.Desc'), warning: '<i id="shopAssist-Btn-closed" class="tooltip-error">' + FH.t('Menu.ShopAssist.DescWarning') + '</i>' },
		{ id: 'productionsRating', title: FH.t('Menu.ProductionsRating.Title'), description: FH.t('Menu.ProductionsRating.Desc') },
		{ id: 'negotiation', title: FH.t('Menu.Negotiation.Title'), description: FH.t('Menu.Negotiation.Desc'), warning: '<em id="negotiation-Btn-closed" class="tooltip-error">' + FH.t('Menu.Negotiation.Warning') + '<br></em>' },
		{ id: 'playerProfile', title: FH.t('Menu.PlayerProfile.Title'), description: FH.t('Menu.PlayerProfile.Desc'), warning: '<em id="PlayerProfile-Btn-closed" class="tooltip-error">' + FH.t('Menu.PlayerProfile.Warning') + '<br></em>' },
		{ id: 'guildMemberstat', title: FH.t('Menu.GuildMemberStat.Title'), description: FH.t('Menu.GuildMemberStat.Desc'), warning: '<em id="guildmemberstat-Btn-closed" class="tooltip-error">' + FH.t('Menu.GuildMemberStat.Warning') + '<br></em>' },
		{ id: 'gildFight', title: FH.t('Menu.Gildfight.Title'), description: FH.t('Menu.Gildfight.Desc'), warning: FH.t('Menu.Gildfight.Warning') },
		{ id: 'market', title: FH.t('Menu.Market.Title'), description: FH.t('Menu.Market.Desc'), warning: '<em id="market-Btn-closed" class="tooltip-error">' + FH.t('Menu.Market.Warning') + '<br></em>' },
		{ id: 'allies', title: FH.t('Menu.Allies.Title'), description: FH.t('Menu.Allies.Desc') },
		{ id: 'productions', title: FH.t('Menu.Productions.Title'), description: FH.t('Menu.Productions.Desc') },
		{ id: 'minigame_aztecs', title: FH.t('Menu.AztecMiniGame.Title'), description: FH.t('Menu.AztecMiniGame.Desc') },
		{ id: 'infobox', title: FH.t('Menu.Info.Title'), description: FH.t('Menu.Info.Desc') },
		{ id: 'findGB', title: FH.t('Boxes.findGB.Title'), description: FH.t('Menu.findGB.Desc') },
		{ id: 'technologies', title: FH.t('Menu.Technologies.Title'), description: FH.t('Menu.Technologies.Desc') },
		{ id: 'musicControl', title: FH.t('Menu.MusicControl.Title'), description: FH.t('Menu.MusicControl.Desc') },
		{ id: 'music', title: FH.t('Menu.Music.Title'), description: FH.t('Menu.Music.Desc') },
		{ id: 'discord', title: FH.t('Menu.Discord.Title'), description: FH.t('Menu.Discord.Desc') },
		{ id: 'compare_friends_threads', title: FH.t('Menu.CompareFriendsThreads.Title'), description: FH.t('Menu.CompareFriendsThreads.Desc') },
		{ id: 'castle', title: FH.t('Menu.Castle.Title'), description: FH.t('Menu.Castle.Desc') },
		{ id: 'gexStat', title: FH.t('Menu.GexStat.Title'), description: FH.t('Menu.GexStat.Desc') },
		{ id: 'investment', title: FH.t('Menu.Investment.Title'), description: FH.t('Menu.Investment.Desc') },
		{ id: 'alerts', title: FH.t('Menu.Alerts.Title'), description: FH.t('Menu.Alerts.Desc') },
		{ id: 'fpCollector', title: FH.t('Menu.fpCollector.Title'), description: FH.t('Menu.fpCollector.Desc') },
		{ id: 'moppelHelper', title: FH.t('Menu.Moppelhelper.Title'), description: FH.t('Menu.Moppelhelper.Desc') },
		{ id: 'blueGalaxy', title: FH.t('Menu.Bluegalaxy.Title'), description: FH.t('Menu.Bluegalaxy.Desc') },
		{ id: 'greatBuildings', title: FH.t('Menu.greatbuildings.Title'), description: FH.t('Menu.greatbuildings.Desc') },
		{ id: 'kits', title: FH.t('Menu.Kits.Title'), description: FH.t('Menu.Kits.Desc') },
		{ id: 'stats', title: FH.t('Menu.Stats.Title'), description: FH.t('Menu.Stats.Desc') },
		{ id: 'settings', title: FH.t('Menu.Settings.Title'), description: FH.t('Menu.Settings.Desc') },
		{ id: 'notes', title: FH.t('Menu.Notes.Title'), description: FH.t('Menu.Notes.Desc') },
		{ id: 'recurringQuests', title: FH.t('Menu.recurringQuests.Title'), description: FH.t('Menu.recurringQuests.Desc') },
		{ id: 'hiddenRewards', title: FH.t('Menu.HiddenRewards.Title'), description: FH.t('Menu.HiddenRewards.Desc') },
		{ id: 'cityMap', title: FH.t('Menu.Citymap.Title'), description: FH.t('Menu.Citymap.Desc') },
	],

	/**
	 * Armies
	 */
	unit_Btn: () => {
		let btn = _menu.MakeButton('unit',true);
		let btnEl = $('<span />');

		btnEl.on('click', function () {
			if (Unit.Cache !== null) {
				Unit.Show();
			}
		});

		return btn.append(btnEl);
	},

	/**
	 * Own contribution calculator button
	 */
	partCalc_Btn: () => {
		let btn = _menu.MakeButton('partCalc',true);

		let btn_Own = $('<span />').on('click', function () {
			Parts.Show();
		});

		btn.append(btn_Own);

		return btn;
	},

	/**
	 * Outpost Button
	 */
	outpost_Btn: () => {
		let red = false;
		if (Outposts.OutpostData === null || FH.Storage.getItem('OutpostBuildings') === null) 
			red = true;

		let btn = _menu.MakeButton('outpost', red);

		let btnEl = $('<span />').bind('click', function () {
			let OutpostBuildings = FH.Storage.getItem('OutpostBuildings');

			if (OutpostBuildings !== null) {
				Outposts.BuildInfoBox();
			}
		});

		return btn.append(btnEl);
	},

	/**
	 * Shop Assistant Button
	 */
	shopAssist_Btn: () => {
		let red = true;
		if (shopAssist.storeId !== null) 
			red = false;

		let btn = _menu.MakeButton('shopAssist', red);

		let btnEl = $('<span />').bind('click', function () {
			if (shopAssist.storeId !== null) {
				shopAssist.Show();
			}
		});

		return btn.append(btnEl);
	},

	/**
	 * Ally PopUp Button
	 */
	allies_Btn: () => {
		let btn = _menu.MakeButton('allies');

		let btnEl = $('<span />').bind('click', function () {
			FH.Main.Allies.showAllyList(true);
		});

		return btn.append(btnEl);
	},

	/**
	 * Product overview button
	 */
	productions_Btn: () => {
		let pB = _menu.MakeButton('productions');

		let btnSpan = $('<span />').on('click', function() {
			Productions.init();
		});

		return pB.append(btnSpan);
	},

	/**
	 * Aztec Minigame
	 */
	minigame_aztecs_Btn: () => {
		let btn = _menu.MakeButton('minigame_aztecs');

		let btnEl = $('<span />').on('click', function () {
			if ($('#minigame_aztecs-Btn').hasClass('hud-btn-red') === false) {
				AztecsHelper.Show();
			}
		});

		return btn.append(btnEl);
	},

	/**
	 * Efficiency Button
	 */
	productionsRating_Btn: () => {
		let btn_prodratBG = _menu.MakeButton('productionsRating');

		let btn_prodrat = $('<span />').bind('click', function () {
			Productions.ShowRating();
		});

		return btn_prodratBG.append(btn_prodrat);
	},

	/**
	 * Negotiation
	 */
	negotiation_Btn: () => {
		let btn = _menu.MakeButton('negotiation',true);

		let btn_Negotiation = $('<span />').bind('click', function () {
			if ($('#negotiation-Btn').hasClass('hud-btn-red') === false) {
				Negotiation.Show();
			}
		});

		return btn.append(btn_Negotiation);
	},

	/**
	 * Profile
	 */
	playerProfile_Btn: () => {
		let btn_playerProfileBG = _menu.MakeButton('playerProfile',true);

		let btn_playerProfile = $('<span />').bind('click', function () {
			if ($('#playerProfile-Btn').hasClass('hud-btn-red') === false) {
				Profile.show();
			}
		});

		btn_playerProfile.append('<img src="'+srcLinks.GetPortrait(FH.Player.Avatar)+'" />');

		return btn_playerProfileBG.append(btn_playerProfile);
	},

	/**
	 * InfoBox 
	 */
	infobox_Btn: () => {
		let btn = _menu.MakeButton('infobox');

		let btn_Inf = $('<span />').on('click', function () {
			Infoboard.Show();
		});

		return btn.append(btn_Inf);
	},

	/**
	 * tracked GB nach Filterbedingung
	 */
	findGB_Btn: () => {
		let btn_ = _menu.MakeButton('findGB');

		let btn = $('<span />').on('click', function () {
			findGB.ShowDialog();
		});

		return btn_.append(btn);
	},

	/**
	 * Technologien
	 */
	technologies_Btn: () => {
		let btn_TechBG = _menu.MakeButton('technologies');

		let btn_Tech = $('<span />').on('click', function () {
			if (Technologies.AllTechnologies !== null) {
				Technologies.Show();
			}
		});

		return btn_TechBG.append(btn_Tech);
	},

	/**
	 * citymap
	 */
	cityMap_Btn: () => {
		let btn_CityBG = _menu.MakeButton('cityMap');

		let btn_City = $('<span />').on('click', function () {
			CityMap.init(false);
		});

		return btn_CityBG.append(btn_City);
	},

	/**
	 * Events in the city and the surrounding area
	 */
	hiddenRewards_Btn: () => {
		let btn_RewardsBG = _menu.MakeButton('hiddenRewards');

		let btn_Rewards = $('<span />').on('click', function () {
			HiddenRewards.init();
		})

		return btn_RewardsBG.append(btn_Rewards, $('<span id="hidden-reward-count" class="hud-counter">0</span>'));
	},

	recurringQuests_Btn: () => {
		let btn = _menu.MakeButton('recurringQuests');

		let btn_Rewards = $('<span />').on('click', function () {
			Recurring.init();
		})

		return btn.append(btn_Rewards, $(`<span id="recurring-count" class="hud-counter" style="${!Recurring.data.count || !Recurring.data.showCounter?"display:none;":""}">${Recurring.data.count || 0}</span>`));
	},

	/**
	 * Note function
	notice_Btn: () => {
		let btn = _menu.MakeButton('notice');

		let btn_Notice = $('<span />').on('click', function () {
			Notice.init();
		});

		return btn.append(btn_Notice);
	},
	 */

	/**
	 * Settings
	 *
	 */
	settings_Btn: () => {
		let btn = _menu.MakeButton('settings');

		let btn_Set = $('<span />').on('click', function () {
			Settings.BuildBox();
		});

		return btn.append(btn_Set);
	},

	/**
	 * Statistic
	 * @returns {*|jQuery}
	 */
	stats_Btn: () => {
		let btn = _menu.MakeButton('stats');

		let btn_Stats = $('<span />').on('click', function() {
			Stats.page = 1;
			Stats.filterByPlayerId = null;
			Stats.Show(false);
		});

		return btn.append(btn_Stats);
	},

	kits_Btn: ()=> {
		let btn = _menu.MakeButton('kits');

		let btn_sp = $('<span />').on('click', function(){
			Kits.init();
		});

		return btn.append(btn_sp);
	},

	notes_Btn: ()=> {
		let btn = _menu.MakeButton('notes');

		let btn_sp = $('<span />').on('click', function(){
			Notes.Show();
		});

		return btn.append(btn_sp);
	},

	greatBuildings_Btn: () => {
		let btn = _menu.MakeButton('greatBuildings');

		let btn_sp = $('<span />').on('click', function () {
			GreatBuildings.Show();
		});

		return btn.append(btn_sp);
	},

	market_Btn: () => {
		let btn = _menu.MakeButton('market',true);

		let btn_Market = $('<span />').bind('click', function () {
			if ($('#market-Btn').hasClass('hud-btn-red') === false) {
				Market.Show(false);
			}
		});

		return btn.append(btn_Market);
	},

	blueGalaxy_Btn: () => {
		let OwnGalaxy = Object.values(FH.Main.CityMapData).find(obj => (obj['cityentity_id'] === 'X_OceanicFuture_Landmark3'));;

		// no BG => display none
		if (!OwnGalaxy) {
			let index = _menu.Items.indexOf('bluegalaxy');
			delete _menu.Items[index];
			return;
		}

		let btn = _menu.MakeButton('blueGalaxy');

		let btn_sp = $('<span />').on('click', function () {
			FH.BlueGalaxy.Show();
		});

		return btn.append(btn_sp, $('<span id="hidden-blue-galaxy-count" class="hud-counter">0</span>'));
	},
	
	moppelHelper_Btn: () => {
		let btn = _menu.MakeButton('moppelHelper');

		let btn_sp = $('<span />').on('click', function () {
			EventHandler.ShowMoppelHelper();
		});

		return btn.append(btn_sp);
    },

	fpCollector_Btn: () => {
		let btn = _menu.MakeButton('fpCollector');

		let btn_sp = $('<span />').on('click', function () {
			FPCollector.ShowFPCollectorBox();
		});

		return btn.append(btn_sp);
	},

	alerts_Btn: () => {
		let btn = _menu.MakeButton('alerts');

		let btn_sp = $('<span />').on('click', function () {
			FH.Alerts.show();
		});

		return btn.append(btn_sp);
	},

	gildFight_Btn: () => {
		let btn = _menu.MakeButton('gildFight',true);

		let btn_sp = $('<span />').on('click', function (){
			if(GuildFights.MapData) {
				GuildFights.ShowGuildBox();
			}
		});

		return btn.append(btn_sp);
	},

	investment_Btn: () => {
		let btn = _menu.MakeButton('investment');

		let btn_sp = $('<span />').on('click', function () {
			Investment.BuildBox(false);
		});

		return btn.append(btn_sp);
	},

	guildMemberstat_Btn: () => {
		let btn = _menu.MakeButton('guildMemberstat',true);

		let btn_sp = $('<span />').bind('click', function () {
			if ($('#guildmemberstat-Btn').hasClass('hud-btn-red') === false) {
				GuildMemberStat.BuildBox(false);
			}
		});

		return btn.append(btn_sp);
	},

	gexStat_Btn: () => {
		let btn = _menu.MakeButton('gexStat');

		let btn_sp = $('<span />').bind('click', function () {
			if ($('#gexstat-Btn').hasClass('hud-btn-red') === false) {
				GexStat.BuildBox(false);
			}
		});
		return btn.append(btn_sp, $(`<span id="gex-attempt-count" class="hud-counter">${GExAttempts.count||0}</span>`)).ready(GExAttempts.refreshGUI);
	},

	castle_Btn: () => {
		let btn = _menu.MakeButton('castle');

		let btn_sp = $('<span />').bind('click', function () {
			if ($('#castle-Btn').hasClass('hud-btn-red') === false) {
				Castle.BuildBox();
			}
		});

		return btn.append(btn_sp);
	},

	/**
	 * Compare friends and threads
	 */
	compare_friends_threads_Btn: () => {
		let btn = _menu.MakeButton('compare_friends_threads');

		let btn_sp = $('<span />').bind('click', function () {
			CompareFriendsThreads.BuildBody();
		});

		return btn.append(btn_sp);
	},

	discord_Btn: () => {
		let btn = _menu.MakeButton('discord');

		let btn_sp = $('<span />').bind('click', function () {
			Discord.BuildBox();
		});

		return btn.append(btn_sp);
	},

	music_Btn: () => {
		let btn = _menu.MakeButton('music');

		let btn_sp = $('<span />').bind('click', function () {
			if ($('#betterMusicDialog').length > 0) {
				FH.betterMusic.CloseBox();
			} else {
				FH.betterMusic.ShowDialog();
			}		

		});

		return btn.append(btn_sp);
	},

	musicControl_Btn: () => {
		let btn = _menu.MakeButton('musicControl');

		let btn_sp = $('<span />').bind('click', function () {
			if ($('#musicControl-Btn').hasClass('hud-btn-red') === false) {
				$('#musicControl-Btn').toggleClass('musicmuted');
				if ($('#musicControl-Btn').hasClass('musicmuted')) {
					FH.betterMusic.pause();
				} else {
					FH.betterMusic.playStatus = true;
					FH.betterMusic.TrackSelector();
				}
			}
		});

		return btn.append(btn_sp);
	}
}
let _menu_bottom = {

	btnSize: 42,

	/**
	 * Create the div holders and put them to the DOM
	 *
	 * @constructor
	 */

	BuildOverlayMenu: () => {

		let hud = $('<div />').attr({'id': 'forgehammer-hud','class': 'hud-bottom'}).addClass('game-cursor'),
			hudWrapper = $('<div />').attr('id', 'forgehammer-hud-wrapper'),
			hudInner = $('<div />').attr('id', 'forgehammer-hud-slider');

		hudWrapper.append(hudInner);

		let btnUp = $('<span />').addClass('hud-btn-left'),
			btnDown = $('<span />').addClass('hud-btn-right hud-btn-right-active');

		hud.append(btnUp);
		hud.append(hudWrapper)
		hud.append(btnDown);
		
		// If the window size changes, recalculate
		window.onresize = function(event) {
			if (event.target == window) _menu_bottom.SetMenuWidth(true);
		};
		
		$('body').append(hud).promise().done(async function(){

			// Insert buttons
			_menu.ListLinks(_menu_bottom.InsertMenuItem);
			await _menu_bottom.CheckButtons();

			// Determine the correct place for the menu
			_menu_bottom.SetMenuWidth();

			window.dispatchEvent(new CustomEvent('forgehammer#menu_loaded'));
		});
	},


	/**
	* Fügt ein MenüItem ein
	*
	* @param MenuItem
	*/
	InsertMenuItem: (MenuItem) => {
		$('#forgehammer-hud-slider').append(MenuItem);
	},


	/**
	* Fügt ein MenüItem ein
	*
	* @param MenuItem
	*/
	InsertMenuItem: (MenuItem) => {
		$('#forgehammer-hud-slider').append(MenuItem);
	},



	/**
	 * Sammelfunktion
	 *
	 * @param reset
	 */
	SetMenuWidth: (reset = true) => {
		// Breite ermitteln und setzten
		_menu_bottom.Prepare();

		if (reset) {
			// Slider nach links resetten
			$('#forgehammer-hud-slider').css({ 
				left: 0
			});

			_menu.MenuScrollLeft = 0;
			_menu.ActiveSlide = 1;

			$('.hud-btn-left').removeClass('hud-btn-left-active');

			if (_menu.SlideParts > 1) {
				$('.hud-btn-right').addClass('hud-btn-right-active');
			}
			else { //Gesamtes Menü passt auf 1 Seite => Kein Scrollbutton nach unten
				$('.hud-btn-right').removeClass('hud-btn-right-active');
			}
		}
	},


	/**
	 * Ermittelt die Fensterhöhe und ermittelt die passende Höhe
	 *
	 */
	Prepare: () => {
		let MenuItemCount = $("#forgehammer-hud-slider").children().length;

		_menu.HudCount = Math.floor((($(window).outerWidth() - 50) - $('#forgehammer-hud').offset().left) / _menu_bottom.btnSize);
		_menu.HudCount = Math.min(_menu.HudCount, MenuItemCount);
		if (_menu.HudCount <= 0) {
			$('#forgehammer-hud').remove();
			$('.tooltip').remove();
			window.onresize = function(){};
			_menu.CallSelectedMenu('Box');
			return;
		} 
			
		// hat der Spieler eine Länge vorgebeben?
		let MenuLength = FH.Storage.getItem('MenuLength');

		if (MenuLength !== null && MenuLength < _menu.HudCount)
		{
			_menu.HudCount = _menu.HudLength = parseInt(MenuLength);
		}

		_menu.HudWidth = (_menu.HudCount * _menu_bottom.btnSize);
		_menu.SlideParts = Math.ceil(MenuItemCount / _menu.HudCount);

		$('#forgehammer-hud').width(_menu.HudWidth);
		$('#forgehammer-hud-wrapper').width(_menu.HudWidth);
		$('#forgehammer-hud-slider').width( ($("#forgehammer-hud-slider").children().length * _menu_bottom.btnSize));
	},
	

	/**
	 * Panel scrollbar machen
	 *
	 */
	CheckButtons: async () => {
		let activeIdx = 0;
		await FH.ExistenceConfirmed("jQuery._data($('body').get(0), 'events' ).click||$('.hud-btn')");
		$('.hud-btn').click(function () {
			activeIdx = $(this).index('.hud-btn');
		});

		if (jQuery._data($('body').get(0), 'events' ).click.filter((elem) => elem.selector == ".hud-btn-right-active").length == 0) {
			// Klick auf Pfeil nach rechts
			$('body').on('click', '.hud-btn-right-active', function () {
				_menu_bottom.ClickButtonRight();
			});
		};

		if (jQuery._data($('body').get(0), 'events' ).click.filter((elem) => elem.selector == ".hud-btn-left-active").length == 0) {
			// Klick auf Pfeil nach links
			$('body').on('click', '.hud-btn-left-active', function () {
				_menu_bottom.ClickButtonLeft();
			});
		};


		// Tooltipp top ermitteln und einblenden
		$('.hud-btn').stop().hover(function(){
			let $this = $(this),
				id = $this.attr('id'),
				x = ($this.offset().left + 30);

			$('[data-btn="' + id + '"]').css({ left: x + 'px' }).show();

		}, function(){
			let id = $(this).attr('id');

			$('[data-btn="' + id + '"]').hide();
		});

		// Sortierfunktion der Menü-items
		$('#forgehammer-hud-slider').sortable({
			placeholder: 'menu-placeholder',
			axis: 'x',
			distance: 22,
			start: function () {
				$('#forgehammer-hud').addClass('is--sorting');
			},
			sort: function () {

				$('.is--sorting .hud-btn-left-active').mouseenter(function (e) {
					$('.hud-btn-left-active').stop().addClass('hasFocus');

					setTimeout(() => {
						if ($('.is--sorting .hud-btn-left-active').hasClass('hasFocus')) {
							_menu_bottom.ClickButtonLeft();
						}
					}, 1000);

				}).mouseleave(function () {
					$('.is--sorting .hud-btn-left-active').removeClass('hasFocus');
				});

				$('.is--sorting .hud-btn-right-active').mouseenter(function (e) {
					$('.is--sorting .hud-btn-right-active').stop().addClass('hasFocus');

					setTimeout(() => {
						if ($('.is--sorting .hud-btn-right-active').hasClass('hasFocus')) {
							_menu_bottom.ClickButtonRight();
						}
					}, 1000);

				}).mouseleave(function () {
					$('.is--sorting .hud-btn-right-active').removeClass('hasFocus');
				});
			},
			stop: function () {
				// Sortierung zwischenspeichern
				let storedItems = _menu.Items;
				_menu.Items = [];

				$('.hud-btn').each(function () {
					_menu.Items.push($(this).data('slug'));
				});

				FH.Storage.setItem('MenuSort', JSON.stringify(_menu.Items));

				$('#forgehammer-hud').removeClass('is--sorting');
				if (_menu.equalTo(storedItems)) return;

				FH.HTML.ShowToastMsg({
					show: 'force',
					head: FH.t('Menu.SaveMessage.Title'),
					text: FH.t('Menu.SaveMessage.Desc'),
					type: 'success',
					hideAfter: 5000
				});
			}
		});

		HiddenRewards.SetCounter();
		FH.BlueGalaxy.SetCounter();
	},

	/**
	 * Klick Funktion
	 */
	ClickButtonRight: () => {
		$('.hud-btn-right').removeClass('hasFocus');

		_menu.ActiveSlide++;

		_menu.MenuScrollLeft -= _menu.HudWidth;
		if (_menu.ActiveSlide * _menu.HudWidth > $('#forgehammer-hud-slider').width())
			_menu.MenuScrollLeft = - (($('#forgehammer-hud-slider').width()/_menu.HudWidth) - 1) *_menu.HudWidth;


		$('#forgehammer-hud-slider').css({
			left: _menu.MenuScrollLeft + 'px'
		});

		if (_menu.ActiveSlide > 1) {
			$('.hud-btn-left').addClass('hud-btn-left-active');
		}

		if (_menu.ActiveSlide === _menu.SlideParts) {
			$('.hud-btn-right').removeClass('hud-btn-right-active');

		} else if (_menu.ActiveSlide < _menu.SlideParts) {
			$('.hud-btn-right').addClass('hud-btn-right-active');
		}
	},

	/**
	 * Klick Funktion
	 */
	ClickButtonLeft: () => {
		$('.hud-btn-left').removeClass('hasFocus');

		_menu.ActiveSlide--;
		
		if (_menu.ActiveSlide == 1) 
			_menu.MenuScrollLeft = 0;
		else
			_menu.MenuScrollLeft += _menu.HudWidth;

		$('#forgehammer-hud-slider').css({
			left: _menu.MenuScrollLeft + 'px'
		});

		if (_menu.ActiveSlide === 1){
			$('.hud-btn-left').removeClass('hud-btn-left-active');
		}

		if (_menu.ActiveSlide < _menu.SlideParts){
			$('.hud-btn-right').addClass('hud-btn-right-active');

		} else if (_menu.ActiveSlide === _menu.SlideParts){
			$('.hud-btn-right').removeClass('hud-btn-right-active');
		}
	},
};


let _menu_box = {

	/**
	 * Create the div holders and put them to the DOM
	 */
	BuildBoxMenu: () => {
		_menu_box.Show();
	},


	/**
	 * Create a html box and put it into the DOM
	 */
	Show: () => {
        //moment.locale(18n('Local'));

		FH.HTML.Box({
			id: 'menu_box',
			title: FH.t('Global.BoxTitle'),
			onlyTitle: true,
			dragdrop: _menu_box.CheckButtons,
			minimize: true,
			resize: true,
			auto_close: false
		});
		_menu_box.CalcBody();

		window.dispatchEvent(new CustomEvent('forgehammer#menu_loaded'));
	},


	CalcBody: () => {
		_menu.TopOffset = $('#menu_box').offset().top;
		_menu.ListLinks(_menu_box.InsertMenuItem);
		_menu_box.CheckButtons();
	},


	/**
	* Fügt ein MenüItem ein
	*
	* @param MenuItem
	*/
	InsertMenuItem: (MenuItem) => {
		$('#menu_boxBody').append(MenuItem);
	},
		

	/**
	 * Tooltips etc
	 *
	 */
	CheckButtons: () => {

		let activeIdx = 0,
			top = $('#menu_box').offset().top < 90;

		$('.hud-btn').click(function () {
			activeIdx = $(this).index('.hud-btn');
		});

		$('.hud-btn').stop().hover(function(){
			let $this = $(this),
				id = $this.attr('id'),
				y = ($this.offset().top - $('[data-btn="' + id + '"]').height()-30),
				x = ($this.offset().left + 23);

			$('[data-btn="' + id + '"]').removeClass('isOnTop');

			// not enougth space to top viewport
			if(top)
			{
				y = ($this.offset().top + 50);
				$('[data-btn="' + id + '"]').addClass('isOnTop');
			}

			$('[data-btn="' + id + '"]').css({ left: x, top: y}).show();

		}, function(){
			let id = $(this).attr('id');

			$('[data-btn="' + id + '"]').hide();
		});

		// Sorting function of the menu items
		$('#menu_boxBody').sortable({
			placeholder: 'menu-placeholder',
			distance: 15,
			start: function () {
				$('#menu_box').addClass('is--sorting');
			},
			sort: function () {
				$('.is--sorting .hud-btn-up-active').mouseenter(function (e) {
					$('.hud-btn-up-active').stop().addClass('hasFocus');
				}).mouseleave(function () {
					$('.is--sorting .hud-btn-up-active').removeClass('hasFocus');
				});

				$('.is--sorting .hud-btn-down-active').mouseenter(function (e) {
					$('.is--sorting .hud-btn-down-active').stop().addClass('hasFocus');
				}).mouseleave(function () {
					$('.is--sorting .hud-btn-down-active').removeClass('hasFocus');
				});
			},
			stop: function () {
				_menu.Items = [];
				$('.hud-btn').each(function () {
					_menu.Items.push($(this).data('slug'));
				});
				FH.Storage.setItem('MenuSort', JSON.stringify(_menu.Items));

				$('#menu_box').removeClass('is--sorting');

				FH.HTML.ShowToastMsg({
					show: 'force',
					head: FH.t('Menu.SaveMessage.Title'),
					text: FH.t('Menu.SaveMessage.Desc'),
					type: 'success',
					hideAfter: 5000
				});
			}
		});

		HiddenRewards.SetCounter();
		FH.BlueGalaxy.SetCounter();
	},


	/**
	 * Hides a button. The HUD slider must already be filled for this.
	 *
	 * @param buttonId
	 * @constructor
	 */
	HideButton: (buttonId) => {
		if ($('#menu_boxBody').has(`div#${buttonId}`).length > 0)
			$($('#menu_boxBody').children(`div#${buttonId}`)[0]).hide();

	},


	/**
	 * Shows a hidden button again
	 */
	ShowButton: (buttonId) => {
		if ($('#menu_boxBody').has(`div#${buttonId}`))
			$($('#menu_boxBody').children(`div#${buttonId}`)[0]).show();
	},
};

let _menu_right = {

	/**
	 *
	 */
	BuildOverlayMenu: () => {
		let hud = $('<div />').attr({'id': 'forgehammer-hud','class': 'hud-right'}).addClass('game-cursor'),
			hudWrapper = $('<div />').attr('id', 'forgehammer-hud-wrapper'),
			hudInner = $('<div />').attr('id', 'forgehammer-hud-slider');

		hudWrapper.append(hudInner);

		let btnUp = $('<span />').addClass('hud-btn-up'),
			btnDown = $('<span />').addClass('hud-btn-down hud-btn-down-active');

		hud.append(btnUp);
		hud.append(hudWrapper)
		hud.append(btnDown);

		window.onresize = function (event) {
			if (event.target == window) _menu_right.SetMenuHeight(true);
		};

		$('body').append(hud).ready(async function () {

			_menu.ListLinks(_menu_right.InsertMenuItem);
			await _menu_right.CheckButtons();

			_menu_right.SetMenuHeight();

			window.dispatchEvent(new CustomEvent('forgehammer#menu_loaded'));
		});

	},


	/**
	* Fügt ein MenüItem ein
	*
	* @param MenuItem
	*/
	InsertMenuItem: (MenuItem) => {
		$('#forgehammer-hud-slider').append(MenuItem);
    },


	/**
	 * Collective function
	 */
	SetMenuHeight: (reset = true) => {
		// calibrate height
		_menu_right.Prepare();

		if (reset) {
			// Slider nach oben resetten
			$('#forgehammer-hud-slider').css({
				'top': '0'
			});

			_menu.MenuScrollTop = 0;
			_menu.ActiveSlide = 1;

			$('.hud-btn-up').removeClass('hud-btn-up-active');

			if (_menu.SlideParts > 1) 
				$('.hud-btn-down').addClass('hud-btn-down-active');
			else // button not needed
				$('.hud-btn-down').removeClass('hud-btn-down-active');	
		}
	},


	/**
	 * Determines the window height and determines the appropriate height
	 *
	 */
	Prepare: () => {
		let MenuItemCount = $("#forgehammer-hud-slider").children().length;

		_menu.HudCount = Math.floor((($(window).outerHeight() - 20) - $('#forgehammer-hud').offset().top) / 48);
		_menu.HudCount = Math.min(_menu.HudCount, MenuItemCount);

		if (_menu.HudCount <= 0) {
			$('#forgehammer-hud').remove();
			_menu.CallSelectedMenu('Box')
		}
			
		// has a length been set manually?
		let MenuLength = FH.Storage.getItem('MenuLength');

		if (MenuLength !== null && MenuLength < _menu.HudCount) {
			_menu.HudCount = _menu.HudLength = parseInt(MenuLength);
		}

		_menu.HudHeight = (_menu.HudCount * 47);
		_menu.SlideParts = Math.ceil(MenuItemCount / _menu.HudCount);

		$('#forgehammer-hud').height(_menu.HudHeight + 2);
		$('#forgehammer-hud-wrapper').height(_menu.HudHeight);
	},


	/**
	 * Make panel scrollable
	 */
	CheckButtons: async () => {
		let activeIdx = 0;

		await FH.ExistenceConfirmed("jQuery._data($('body').get(0), 'events' ).click||$('.hud-btn')");

		$('.hud-btn').click(function () {
			activeIdx = $(this).index('.hud-btn');
		});

		if (jQuery._data($('body').get(0), 'events' ).click.filter((elem) => elem.selector == ".hud-btn-down-active").length == 0) {
			// Klick auf Pfeil nach unten
			$('body').on('click', '.hud-btn-down-active', function () {
				_menu_right.ClickButtonDown();
			});
		};

		if (jQuery._data($('body').get(0), 'events' ).click.filter((elem) => elem.selector == ".hud-btn-up-active").length == 0) {
			// Klick auf Pfeil nach oben
			$('body').on('click', '.hud-btn-up-active', function () {
				_menu_right.ClickButtonUp();
			});
		};

		// Tooltipp top ermitteln und einblenden
		$('.hud-btn').stop().hover(function () {
			let $this = $(this),
				id = $this.attr('id'),
				y = ($this.offset().top + 30);

			$('[data-btn="' + id + '"]').css({ 'top': y + 'px' }).show();

		}, function () {
			let id = $(this).attr('id');

			$('[data-btn="' + id + '"]').hide();
		});

		// Sortierfunktion der Menü-items
		$('#forgehammer-hud-slider').sortable({
			placeholder: 'menu-placeholder',
			axis: 'y',
			distance: 22,
			start: function () {
				$('#forgehammer-hud').addClass('is--sorting');
			},
			sort: function () {

				$('.is--sorting .hud-btn-up-active').mouseenter(function (e) {
					$('.hud-btn-up-active').stop().addClass('hasFocus');

					setTimeout(() => {
						if ($('.is--sorting .hud-btn-up-active').hasClass('hasFocus')) {
							_menu_right.ClickButtonUp();
						}
					}, 1000);

				}).mouseleave(function () {
					$('.is--sorting .hud-btn-up-active').removeClass('hasFocus');
				});

				$('.is--sorting .hud-btn-down-active').mouseenter(function (e) {
					$('.is--sorting .hud-btn-down-active').stop().addClass('hasFocus');

					setTimeout(() => {
						if ($('.is--sorting .hud-btn-down-active').hasClass('hasFocus')) {
							_menu_right.ClickButtonDown();
						}
					}, 1000);

				}).mouseleave(function () {
					$('.is--sorting .hud-btn-down-active').removeClass('hasFocus');
				});
			},
			stop: function () {
				_menu.Items = [];

				$('.hud-btn').each(function () {
					_menu.Items.push($(this).data('slug'));
				});

				FH.Storage.setItem('MenuSort', JSON.stringify(_menu.Items));

				$('#forgehammer-hud').removeClass('is--sorting');

				FH.HTML.ShowToastMsg({
					show: 'force',
					head: FH.t('Menu.SaveMessage.Title'),
					text: FH.t('Menu.SaveMessage.Desc'),
					type: 'success',
					hideAfter: 5000
				});
			}
		});

		HiddenRewards.SetCounter();
		FH.BlueGalaxy.SetCounter();
	},


	/**
	 * Click function
	 */
	ClickButtonDown: () => {
		$('.hud-btn-down').removeClass('hasFocus');

		_menu.ActiveSlide++;

		_menu.MenuScrollTop -= _menu.HudHeight;
		if (_menu.ActiveSlide * _menu.HudHeight > $('#forgehammer-hud-slider').height())
			_menu.MenuScrollTop = - (($('#forgehammer-hud-slider').height()/_menu.HudHeight) - 1) *_menu.HudHeight;

		$('#forgehammer-hud-slider').css({
			'top': _menu.MenuScrollTop + 'px'
		});

		if (_menu.ActiveSlide > 1) {
			$('.hud-btn-up').addClass('hud-btn-up-active');
		}

		if (_menu.ActiveSlide === _menu.SlideParts) {
			$('.hud-btn-down').removeClass('hud-btn-down-active');

		} else if (_menu.ActiveSlide < _menu.SlideParts) {
			$('.hud-btn-down').addClass('hud-btn-down-active');
		}
	},


	/**
	 * Click function
	 */
	ClickButtonUp: () => {
		$('.hud-btn-up').removeClass('hasFocus');

		_menu.ActiveSlide--;
		
		if (_menu.ActiveSlide == 1) 
			_menu.MenuScrollTop = 0;
		else
			_menu.MenuScrollTop += _menu.HudHeight;

		$('#forgehammer-hud-slider').css({
			'top': _menu.MenuScrollTop + 'px'
		});

		if (_menu.ActiveSlide === 1){
			$('.hud-btn-up').removeClass('hud-btn-up-active');
		}

		if (_menu.ActiveSlide < _menu.SlideParts){
			$('.hud-btn-down').addClass('hud-btn-down-active');

		} else if (_menu.ActiveSlide === _menu.SlideParts){
			$('.hud-btn-down').removeClass('hud-btn-down-active');
		}
	},
};

FH.menu = _menu;
};



