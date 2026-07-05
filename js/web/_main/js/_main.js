/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

(function () {

let DuplicateWarning = (helperDetected=true) => {
	let div = document.createElement('div');
	div.innerHTML = `<div id="HelperWarning" style="position:fixed;top:0;left:0;width:100%;height:100%;background-color:#000000cc;color:white;z-index:9999999999;display:flex;align-items:center;justify-content:center;font-size:2rem;text-align:center;flex-direction:column;">
		<div><h2>${helperDetected ? 'FoE-Helper' : 'Hammer duplicate'} detected!!! </h2> Please remove or deactivate for proper functionality of Forge Hammer in your extension settings!<br>
		See <a href="https://github.com/outoftheline/forge-hammer/wiki/Switching-from-FoE-Helper-to-Forge-Hammer" target="_blank">here</a> for more information - see below to access extension settings:</div>
		<div style="display: grid;grid-template-columns: 1fr 1fr;grid-gap: 1rem;margin-top: 1rem;">
		<span>Brave </span><span>brave://extensions/</span>
		<span>Chrome </span><span>chrome://extensions/</span>
		<span>Edge </span><span>edge://extensions/</span>
		<span>Opera </span><span>opera://extensions/</span>
		<span>Firefox </span><span>about:addons</span>
		</div></br>
		<button onclick="document.getElementById('HelperWarning').remove()" style="font-size: 2rem;">Close Overlay</button>
	</div>`;
	document.body.appendChild(div);
}

const duplicateDetected = !!(
	window.ExtbaseData ||
	window.FH?.Basedata
);

if (duplicateDetected) {
	DuplicateWarning(!FH?.BaseData?.isHammer || !window.ExtbaseData?.isHammer || !!window.GetFights);
	return;
}

setTimeout(() => {
	if ((typeof i18n != "undefined" || !!(window.GetFights)) && !duplicateDetected) {
		DuplicateWarning();
	}
}, 5000);

FH.BaseData = JSON.parse(FH.Storage.getItem("ExtBaseData")||"{}");
FH.BaseData.isHammer = true;
FH.extUrl = FH.BaseData.extUrl;


let ExistenceConfirmed = async (varlist)=>{
	varlist = varlist.split('||')
	return new Promise((resolve, reject) => {
		let timer = () => {
			let doResolve = true;
			for (let x of varlist ) {
				if (x.substr(0,2) == '$(' && eval(x).length === 0) { // jQuery object
					doResolve = false
					//console.log(x+' not yet defined');
					break;
				}
				if (eval('typeof '+x) === 'undefined' || eval(x) === null || eval(x) === undefined) { // normal var
					doResolve = false
					//console.log(x+' not yet defined');
					break;
				}
			}
			if (doResolve) 
				resolve();
			else 
				setTimeout(timer, 100);
		};
		timer();
	});
};

{
	// jQuery detection
	let intval = -1;
	function checkForJQuery() {
		if (typeof jQuery !== 'undefined') {
			clearInterval(intval);
			window.dispatchEvent(new CustomEvent('forgehammer#jQuery-loaded'));
		}
	}
	intval = setInterval(checkForJQuery, 1);
}

FH.ActiveMap = 'main';
FH.LastMapPlayerID = null;
FH.Player = {
	ID:0,
	Name:null,
	Avatar:null,
}
FH.Guild = {
	ID:0,
	Permission:0,
}
FH.World = window.location.hostname.split('.')[0];
FH.CurrentEra = null;
FH.CurrentEraID = null;
FH.Goods={
	Data: {},
	List:{},
}
FH.Players = {
	Dict: {},
	NeighborsUpdated : false,
	GuildUpdated : false,
	FriendsUpdated : false,
};
FH.RessourceStock = [];
FH.StartUpDone = new Promise(resolve => 
		window.addEventListener('forgehammer#StartUpDone', resolve, {once: true, passive: true}));
FH.possibleMaps = ['main', 'gex', 'gg', 'era_outpost', 'guild_raids', 'cultural_outpost'];

FH.Links = {
	Player:{
		scoredb: 'https://foe.scoredb.io/__world__/Player/__playerid__',
		foestats: 'https://foestats.com/__server__/__world__/players/__playerid__'
	},
	Guild:{
		scoredb: 'https://foe.scoredb.io/__world__/Guild/__guildid__',
		foestats: 'https://foestats.com/__server__/__world__/guilds/__guildid__'
	},
	Building: 'https://forgeofempires.fandom.com/wiki/__buildingid__',
	Icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22pt" height="22pt" viewBox="0 0 22 22"><g><path id="fham-external-link-icon" d="M 13 0 L 13 2 L 18.5625 2 L 6.28125 14.28125 L 7.722656 15.722656 L 20 3.4375 L 20 9 L 22 9 L 22 0 Z M 0 4 L 0 22 L 18 22 L 18 9 L 16 11 L 16 20 L 2 20 L 2 6 L 11 6 L 13 4 Z M 0 4 "/></g></svg>',
	InnoCDN: 'https://foede.innogamescdn.com/',
}

let GameTime = {
	Offset: 0,
	set:(time)=>{
		GameTime.Offset = time-moment().unix();
	},	
	get:()=>{
		return moment().unix()+GameTime.Offset;
	}
}

let TranslationData = null;
let t = (key) => {
	return FH.Translation.tempData?.[key]?.s || FH.Translation.tempData?.[key] || TranslationData[key] || key;
}

(async () => {
	try {
		let languages = [];

		// load english fallback
		let data = await fetch(FH.extUrl + 'js/web/_languages/json/en.json').then(res=>res.json()).catch(()=>({}));
		
		//overload with gui language
		if (FH.BaseData.GuiLng !== 'en') 
			Object.assign(data, await fetch(FH.extUrl + 'js/web/_languages/json/' + FH.BaseData.GuiLng + '.json').then(res=>res.json()).catch(()=>({})));

		TranslationData = data;
	} catch (err) {
		console.error('translation loading error:', err);
	}
})();
FH.t = t;

document.addEventListener("DOMContentLoaded", function () {
	// note current world
	//FH.World = window.location.hostname.split('.')[0];
	FH.Storage.setItem('current_world', FH.World);

	// register resize functions
	window.addEventListener('resize', () => {
		Main.ResizeFunctions();
	});

	// Detect and process fullscreen
	$(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', function () {
		if (!window.screenTop && !window.screenY) {
			FH.HTML.LeaveFullscreen();
		} else {
			FH.HTML.EnterFullscreen();
		}
	});
});

(function () {
	let MainMenuLoaded = false,
		LGCurrentLevelMedals = undefined,
		IsLevelScroll = false;


	// globale Handler
	// die Gebäudenamen übernehmen
	/* removed as inno changed city entity loading
	FH.proxy.addMetaHandler('city_entities', (xhr, postData) => {
		let EntityArray = JSON.parse(xhr.responseText);
		Main.CityEntities = Object.assign({}, ...EntityArray.map((x) => ({ [x.id]: x })));
		Main.correctBuildingType()
		Main.Inactives.check();
	});
	*/
	FH.proxy.addMetaHandler('building_entity_lookup', (xhr, postData) => {
		let buildingUrlsRaw = JSON.parse(xhr.responseText || "[]");
		let buildingUrls = Object.assign({}, ...buildingUrlsRaw.map((x) => ({ [x.identifier.replace("building_entity_","")]: {url: x.url, hash: x.url.replace(/.*?([^-]+$)/gm,"$1")} })));
		const region = String(FH.World).replace(/\d+$/, '') || 'unknown';
		setTimeout(()=>{Main.CityEntityBuilder(buildingUrls, region)},500);
	});

	// Building-Upgrades
	FH.proxy.addMetaHandler('building_upgrades', (xhr, postData) => {
		let BuildingUpgradesArray = JSON.parse(xhr.responseText);
		Main.BuildingUpgrades = Object.assign({}, ...BuildingUpgradesArray.map((x) => ({ [x.upgradeItem.id]: x })));
		if (Main.SelectionKits != null) Kits.CreateUpgradeSchemes();
	});

	// Building-Sets
	FH.proxy.addMetaHandler('building_sets', (xhr, postData) => {
		let BuildingSetsArray = JSON.parse(xhr.responseText);
		Main.BuildingSets = Object.assign({}, ...BuildingSetsArray.map((x) => ({ [x.id]: x })));
	});

	// Building-Chains
	FH.proxy.addMetaHandler('building_chains', (xhr, postData) => {
		let BuildingChainsArray = JSON.parse(xhr.responseText);
		Main.BuildingChains = Object.assign({}, ...BuildingChainsArray.map((x) => ({ [x.id]: x })));
	});

	// Selection-Kits
	FH.proxy.addMetaHandler('selection_kits', (xhr, postData) => {
		let SelectKitsArray = JSON.parse(xhr.responseText);
		Main.SelectionKits = Object.assign({}, ...SelectKitsArray.map((x) => ({ [x.selectionKitId]: x })));
		if (Main.BuildingUpgrades != null) Kits.CreateUpgradeSchemes();
	});
	FH.proxy.addMetaHandler("building_families", (xhr,postData) => {
		Main.BuildingFamilyLimits = JSON.parse(xhr.responseText)?.families;
	})	
	// Allies
	FH.proxy.addMetaHandler('allies', (xhr, postData) => {
		Main.Allies.setMeta(JSON.parse(xhr.responseText));
	});

	FH.proxy.addMetaHandler('ally_rarities', (xhr, postData) => {
		Main.Allies.setRarities(JSON.parse(xhr.responseText));
	});

	FH.proxy.addMetaHandler('ally_types', (xhr, postData) => {
		Main.Allies.setTypes(JSON.parse(xhr.responseText));
	});

	FH.proxy.addHandler('AllyService', 'getAllies', (data, postData) => {
		Main.Allies.getAllies(data.responseData);
		
		if (!Settings.GetSetting('ShowAllyList')) return;
		if (postData[0].requestMethod == 'getAllies') Main.Allies.showAllyList();
	});
	FH.proxy.addHandler('AllyService', 'getAssignedAllies', (data, postData) => {
		Main.Allies.getAllies(data.responseData);
	});
	FH.proxy.addHandler('AllyService', 'updateAlly', (data, postData) => {
		Main.Allies.buildingBoostSums = [];
		Main.Allies.updateAlly(data.responseData);
	});
	FH.proxy.addHandler('AllyService', 'addAlly', (data, postData) => {
		Main.Allies.addAlly(data.responseData);
	});
	FH.proxy.addFoeHelperHandler('InventoryUpdated', () => {
		Main.Allies.updateAllyList();
	});

	// Portrait-Mapping für Spieler Avatare
	FH.proxy.addRawHandler((xhr, requestData) => {
		const idx = requestData.url.indexOf("/assets/shared/avatars/Portraits");

		if (idx !== -1) {
			FH.Links.InnoCDN = requestData.url.substring(0, idx + 1);
			let portraits = {};

			$(xhr.responseText).find('portrait').each(function () {
				portraits[$(this).attr('name')] = $(this).attr('src');
			});

			Main.PlayerPortraits = portraits;
		}
	});

	// --------------------------------------------------------------------------------------------------
	// Player- und Gilden-ID setzen
	FH.proxy.addHandler('StartupService', 'getData', (data, postData) => {
        	
		moment.locale(FH.t('Local'));
		window.addEventListener("error", function (e) {
			console.error(e.error);
			e.preventDefault();
		});

		// Player-ID, Gilden-ID und Name setzen
		Main.StartUp(data.responseData.user_data);

		// check if DB exists
		StrategyPoints.checkForDB(FH.Player.ID);
		EventHandler.checkForDB(FH.Player.ID);
		GuildMemberStat.checkForDB(FH.Player.ID);
		GexStat.checkForDB(FH.Player.ID);
		GuildFights.checkForDB(FH.Player.ID);
		QiProgress.checkForDB(FH.Player.ID);
		Notes.checkForDB(FH.Player.ID);

		// which tab is active in StartUp Object?
		let vals = {
			getNeighborList: 0,
			getFriendsList: 0,
			getClanMemberList: 0,
		}

		for (let i in data.responseData.socialbar_list) {
			vals.getNeighborList += (data.responseData.socialbar_list[i].is_neighbor ? 1 : 0);
			vals.getFriendsList += (data.responseData.socialbar_list[i].is_friend ? 1 : 0);
			vals.getClanMemberList += (data.responseData.socialbar_list[i].is_guild_member ? 1 : 0);
		}

		Main.UpdatePlayerDict(
			data.responseData.socialbar_list,
			'PlayerList',
			Object.keys(vals).reduce((a, b) => vals[a] > vals[b] ? a : b)
		);

		// Alle Gebäude sichern
		FH.LastMapPlayerID = FH.Player.ID;
		Main.CityMapData = Object.assign({}, ...data.responseData.city_map.entities.map((x) => ({ [x.id]: x })));
		Main.SetArkBonus2();
		// Güterliste
		FH.Goods.List = data.responseData.goodsList

		// freigeschaltete Erweiterungen sichern
		CityMap.Main.unlockedAreas = data.responseData.city_map.unlocked_areas;
		CityMap.Main.blockedAreas = data.responseData.city_map.blocked_areas;

		// Unlocked features
		if (data.responseData.unlocked_features) {
			Main.UnlockedFeatures = data.responseData.unlocked_features?.map(function(obj) { return obj.feature; });
		} else {
			$('script').each((i,s)=>{    
				if (!s?.innerHTML.includes("unlockedFeatures")) return
				try {
					let ulf = JSON.parse([...s.innerHTML.matchAll(/(unlockedFeatures:\ )(.*?)(,\n)/gm)][0][2])
					if (Array.isArray(ulf)) Main.UnlockedFeatures = ulf.map(x=>x.feature);
				} catch (e) {

				}
			})
		}

		//A/B Tests
		Main.ABTests=Object.assign({}, ...data.responseData.active_ab_tests.map((x) => ({ [x.test_name]: x })));
	
		Stats.Init();
		FH.Alerts.init();
	});

	//Metadata file links
	FH.proxy.addHandler('StaticDataService', 'getMetadata', (data, postData) => {
		Main.MetaUrls = Object.assign({},...data.responseData.map(x=>( {[x.identifier]: x.url}) ));
	});

	// --------------------------------------------------------------------------------------------------
	// Bonus notieren, enthält tägliche Rathaus FP
	FH.proxy.addHandler('BonusService', 'getBonuses', (data, postData) => {
		Main.BonusService = data.responseData;
	});

	// Limited Bonus (Archenbonus, Kraken etc.)
	FH.proxy.addHandler('BonusService', 'getLimitedBonuses', (data, postData) => {
		Main.SetArkBonus(data.responseData);
	});

	// --------------------------------------------------------------------------------------------------
	// Botschafter notieren, enthält Bonus FPs oder Münzen
	FH.proxy.addHandler('EmissaryService', 'getAssigned', (data, postData) => {
		Main.EmissaryService = data.responseData;
	});

	// QI map
	FH.proxy.addHandler('GuildRaidsMapService', 'getOverview', (data, postData) => {		
		QiProgress.QiMap = data.responseData;
	})

	// --------------------------------------------------------------------------------------------------
	// Karte wird gewechselt zum Außenposten
	FH.proxy.addHandler('CityMapService', 'getCityMap', (data, postData) => {
		Main.UpdateActiveMap(data.responseData.gridId);

		if (FH.ActiveMap === 'era_outpost') {
			CityMap.EraOutpost.data = Object.assign({}, ...data.responseData['entities'].map((x) => ({ [x.id]: x })));
			CityMap.EraOutpost.areas = data.responseData['unlocked_areas'];
		}
		else if (FH.ActiveMap === 'guild_raids') {
			CityMap.QI.data = Object.assign({}, ...data.responseData['entities'].map((x) => ({ [x.id]: x })));
			CityMap.QI.areas = data.responseData['unlocked_areas'];
		}
		else if (FH.ActiveMap === 'cultural_outpost') {
			CityMap.CulturalOutpost.data = Object.assign({}, ...data.responseData['entities'].map((x) => ({ [x.id]: x })));
			CityMap.CulturalOutpost.areas = data.responseData['unlocked_areas'];
		}
	});


	// Stadt wird wieder aufgerufen
	FH.proxy.addHandler('CityMapService', 'getEntities', (data, postData) => {
		if (!postData.map(x=>x.requestData?.[0]).includes('main')) { 
			return;
		}

		FH.LastMapPlayerID = FH.Player.ID;

		Main.CityMapData = Object.assign({}, ...data.responseData.map((x) => ({ [x.id]: x })));
		FH.proxy.triggerFoeHelperHandler('CityMapUpdated');
		Main.SetArkBonus2();

		if (FH.ActiveMap === 'gg') return; // getEntities wurde in den GG ausgelöst => Map nicht ändern
		Main.UpdateActiveMap('main');
		CityMap.OtherPlayer = { mapData: {}, unlockedAreas: null, name: '', eraName: null};
	});


	// main is entered
	FH.proxy.addHandler('AnnouncementsService', 'fetchAllAnnouncements', (data, postData) => {
		Main.UpdateActiveMap('main');
		CityMap.OtherPlayer = { mapData: {}, unlockedAreas: null, name: '', eraName: null};
	});

	// gex is entered
	FH.proxy.addHandler('GuildExpeditionService', 'getOverview', (data, postData) => {
		Main.UpdateActiveMap('gex');
	});

	// GBG is entered
	FH.proxy.addHandler('GuildBattlegroundService', 'getBattleground', (data, postData) => {
		Main.UpdateActiveMap('gg');
	});

	// QI is entered
	FH.proxy.addHandler('GuildRaidsService', 'getState', (data, postData) => {
		if (!data.responseData?.guildRaidsType) return;
		if (data.responseData?.__class__ != "GuildRaidsRunningState") return;
		if (!data.responseData?.endsAt) return;

		Main.UpdateActiveMap('guild_raids');
		CityMap.QI.level = data.responseData.raidInstance?.difficultyLevel;
	});

	// visiting another player
	FH.proxy.addHandler('OtherPlayerService', 'visitPlayer', (data, postData) => {
		Main.UpdateActiveMap('OtherPlayer');
		FH.LastMapPlayerID = data.responseData.other_player.player_id;
		CityMap.OtherPlayer.name = data.responseData.other_player.name;
		CityMap.OtherPlayer.unlockedAreas = data.responseData.city_map.unlocked_areas;
		CityMap.OtherPlayer.mapData = Object.assign({}, ...data.responseData.city_map.entities.map(x => ({ [x.id]: x })));
	});

	// move buildings, use self aid kits
	FH.proxy.addHandler('CityMapService', (data, postData) => {
		if (data.requestMethod === 'moveEntity' || data.requestMethod === 'moveEntities' || data.requestMethod === 'updateEntity') {
			let Buildings = data.responseData;

			if (Buildings[0]?.player_id != FH.Player.ID) return; // opened another players GB
			Main.UpdateCityMap(data.responseData);
		}
		else if (data.requestMethod === 'placeBuilding') {
			let building = data.responseData[0];
			if (building && building.id) {
				if (FH.ActiveMap === "cultural_outpost") {
					CityMap.CulturalOutpost.data[building.id] = building
					return
				}
				else if (FH.ActiveMap === "era_outpost") {
					CityMap.EraOutpost.data[building.id] = building
					return
				}
				else if (FH.ActiveMap === "guild_raids") {
					CityMap.QI.data[building.id] = building
					return
				}

				Main.CityMapData[building.id] = building;
			}
		}
		else if (data.requestMethod === 'removeBuilding') {
			let ID = postData[0].requestData[0];
			if (FH.ActiveMap === "cultural_outpost") {
				delete CityMap.CulturalOutpost.data[ID];
				return
			}
			else if (FH.ActiveMap === "era_outpost") {
				delete CityMap.EraOutpost.data[ID];
				return
			}
			else if (FH.ActiveMap === "guild_raids") {
				delete CityMap.QI.data[ID];
				return
			}
			if (ID && Main.CityMapData[ID]) {
				delete Main.CityMapData[ID];
				if (Main.CityBuildingsData[ID])
					delete Main.CityBuildingsData[ID];
			}
		}
		FH.proxy.triggerFoeHelperHandler('CityMapUpdated');
	});

	// production is started, collected, aborted
	FH.proxy.addHandler('CityProductionService', (data, postData) => {
		if (data.requestMethod === 'pickupProduction' || data.requestMethod === 'pickupAll' || data.requestMethod === 'startProduction' || data.requestMethod === 'cancelProduction') {
			let Buildings = data.responseData['updatedEntities'];
			if (!Buildings) return
			if (FH.ActiveMap != "main") return // do not add outpost buildings
			Main.UpdateCityMap(Buildings)
		}
	});

	// remove a friend
	FH.proxy.addHandler('FriendService', 'deleteFriend', (data, postData) => {
		let FriendID = data.responseData;
		if (FH.Players.Dict[FriendID]) {
			FH.Players.Dict[FriendID]['IsFriend'] = false;
		}

		if ($('#moppelhelper').length === 0) {
			EventHandler.CalcMoppelHelperTable();
		}
	});

	// open a message
	FH.proxy.addHandler('ConversationService', 'getConversation', (data, postData) => {
		Main.UpdatePlayerDict(data.responseData, 'Conversation');
	});

	FH.proxy.addHandler('BattlefieldService', 'startByBattleType', (data, postData) => {

		// battle finished
		if ([901,902].includes(data.responseData.error_code)) {
			return;
		}
		
		// not autobattling in either round 1 or 2
		if (!data.responseData["isAutoBattle"]) {
			FH.HTML.MinimizeBeforeBattle();
		}

		// round was won with autobattle
		// winnerBit==1 round won, winnerBit==2 round lost
		if (data.responseData.state?.winnerBit > 0) {
			FH.HTML.MaximizeAfterBattle();
		}
	});

	FH.proxy.addHandler('BattlefieldService', 'submitMove', (data, postData) => {
		// round was won/lost by auto-complete battle during manual turn
		if (data.responseData['winnerBit'] > 0) {
			FH.HTML.MaximizeAfterBattle();
		}
	});

	// if battle was interrupted by browser refresh/server restart
	FH.proxy.addHandler('BattlefieldService', 'continueBattle', (data, postData) => {
		// round in progress was not auto-battle
		if (!data.responseData["isAutoBattle"]) {
			FH.HTML.MinimizeBeforeBattle();
		}
	});

	// if user surrenders
	FH.proxy.addHandler('BattlefieldService', 'surrender', (data, postData) => {
		if (data.responseData["surrenderBit"] == 1) {
			FH.HTML.MaximizeAfterBattle();
		}
	});

	// Nachbarn/Gildenmitglieder/Freunde Tab geöffnet
	FH.proxy.addHandler('OtherPlayerService', 'all', (data, postData) => {
		if (data.requestMethod === 'getNeighborList' || data.requestMethod === 'getFriendsList' || data.requestMethod === 'getClanMemberList' || data.requestMethod === 'getAwaitingFriendRequestCount') {
			Main.UpdatePlayerDict(data.responseData, 'PlayerList', data.requestMethod);
		}
		if (data.requestMethod === 'getSocialList') {
			if (data.responseData.neighbours) 
				Main.UpdatePlayerDict(data.responseData.neighbours, 'PlayerList', 'getNeighborList');
			if (data.responseData.guildMembers) 
				Main.UpdatePlayerDict(data.responseData.guildMembers, 'PlayerList', 'getClanMemberList');
			if (data.responseData.friends) 
				Main.UpdatePlayerDict(data.responseData.friends, 'PlayerList', 'getFriendsList');
		}
	});


	// --------------------------------------------------------------------------------------------------
	// goods translations
	FH.proxy.addHandler('ResourceService', 'getResourceDefinitions', (data, postData) => {
		FH.Goods.Data = Object.assign({}, ...data.responseData.map((x) => ({ [x.id]: x })));
	});


	// Required by the kits
	FH.proxy.addHandler('InventoryService', 'getItem', (data, postData) => {
		Main.UpdateInventoryItem(data.responseData);
	});


	// Required by the kits
	FH.proxy.addHandler('InventoryService', 'getItems', (data, postData) => {
		Main.UpdateInventory(data.responseData);
	});


	// Required by the kits
	FH.proxy.addHandler('InventoryService', 'getItemsByType', (data, postData) => {
		Main.UpdateInventory(data.responseData);
	});


	// Required by the kits
	FH.proxy.addHandler('InventoryService', 'getItemAmount', (data, postData) => {
		Main.UpdateInventoryAmount(data.responseData);
	});


	// --------------------------------------------------------------------------------------------------
	// --------------------------------------------------------------------------------------------------
	// Es wurde das LG eines Mitspielers angeklickt, bzw davor die Übersicht

	// GB overview of another player
	FH.proxy.addHandler('GreatBuildingsService', 'getOtherPlayerOverview', (data, postData) => {
		Main.UpdatePlayerDict(data.responseData, 'LGOverview');

		// update investments
		if (Investment) {
			Investment.UpdateData(data.responseData, false);
		}

	});

	// es wird ein LG eines Spielers geöffnet

	// gbUpdateData sammelt die informationen aus mehreren Handlern
	let gbUpdateData = null;
	let gbCityMapEntity = null;

	FH.proxy.addHandler('GreatBuildingsService', 'all', (data, postData) => {
		let getConstruction = data.requestMethod === 'getConstruction' ? data : null;
		let getConstructionRanking = data.requestMethod === 'getConstructionRanking' ? data : null;
		let contributeForgePoints = data.requestMethod === 'contributeForgePoints' ? data : null;
		let Rankings, Bonus = {}, Era;

		if (getConstruction != null) {
			Rankings = getConstruction.responseData.rankings;
			Bonus['passive'] = getConstruction.responseData.next_passive_bonus; // GB update to do
			Bonus['production'] = getConstruction.responseData.next_production_bonus; // GB update to do
			let EraName = getConstruction.responseData.ownerEra;
			if (EraName) Era = Technologies.Eras[EraName];
			IsLevelScroll = false;
		}
		else if (getConstructionRanking != null) {
			Rankings = getConstructionRanking.responseData;
			IsLevelScroll = true;
		}
		else if (contributeForgePoints != null) {
			Rankings = contributeForgePoints.responseData;
			IsLevelScroll = false;
		}

		if (Rankings) {
			if (!gbUpdateData || !gbUpdateData.CityMapEntity) {
				gbUpdateData = { Rankings: Rankings, CityMapEntity: gbCityMapEntity, Bonus: null };
			}
			else {
				gbUpdateData.Rankings = Rankings;
				gbUpdateData.Bonus = Bonus;
				gbUpdateData.Era = Era;
			}
		}

		if(gbUpdateData?.Rankings && gbUpdateData?.CityMapEntity){
			lgUpdate();
		}

	});

	FH.proxy.addHandler('GreatBuildingsService', 'getContributions', (data, postData) => {
		Main.UpdatePlayerDict(data.responseData, 'LGContributions');
	});

	// can be removed after game update 1.332
	FH.proxy.addHandler('CityMapService', 'updateEntity', (data, postData) => {
		if (!gbUpdateData || !gbUpdateData.Rankings) {
			gbUpdateData = { Rankings: null, CityMapEntity: data };
			// reset gbUpdateData sobald wie möglich (nachdem alle einzelnen Handler ausgeführt wurden)
			Promise.resolve().then(() => gbUpdateData = null);
		} else {
			gbUpdateData.CityMapEntity = data;
			lgUpdate();
		}
		
		if (data.responseData[0]?.player_id === FH.Player.ID) {
			
			if ($('#OwnPartBox').length > 0) {
				Main.CurrentGB.Entity.max_level = data.responseData[0]?.max_level;
				Parts.CalcBody();
			}
		}
	});

	FH.proxy.addHandler('OtherPlayerService', 'getOtherPlayerCityMapEntity', (data, postData) => {
		let formattedData = { ...data, responseData: [data.responseData] };
		gbCityMapEntity = formattedData;

		if (!gbUpdateData || !gbUpdateData.Rankings) {
			gbUpdateData = { Rankings: null, CityMapEntity: formattedData };
		} else {
			gbUpdateData.CityMapEntity = formattedData;
			lgUpdate();
		}
		
		if (formattedData.responseData[0]?.player_id === FH.Player.ID) {
			if ($('#OwnPartBox').length > 0) {
				Main.CurrentGB.Entity.max_level = formattedData.responseData[0]?.max_level;
				Parts.CalcBody();
			}
		}
	});

	FH.proxy.addWsHandler('CityMapService', 'updateEntity', data => {
		for (let b of data.responseData) {
			Main.CityMapData[b.id]=b;
		}
		FH.proxy.triggerFoeHelperHandler('CityMapUpdated');
	});

	FH.proxy.addWsHandler('CityProductionService', 'pickupProduction', data => {
		for (let b of data.responseData.updatedEntities||[]) {
			Main.CityMapData[b.id]=b;
		}
		FH.proxy.triggerFoeHelperHandler('CityMapUpdated');
	});

	FH.proxy.addRequestHandler('InventoryService', 'useItem', (postData) => {
		if (postData?.requestData?.[0]?.__class__=="UseItemOnBuildingPayload") {
			if (Main.Inventory[postData?.requestData?.[0]?.itemId].itemAssetName =="store_building") {
				let id= postData?.requestData?.[0]?.mapEntityId
				if (Main.CityMapData[id]) delete Main.CityMapData[id]
				if (Main.CityBuildingsData[id]) delete Main.CityBuildingsData[id]
			}
		}
	});

	// Update Funktion, die ausgeführt wird, sobald beide Informationen in gbUpdateData vorhanden sind.
	function lgUpdate() {
		const { CityMapEntity, Rankings, Bonus } = gbUpdateData;
		gbUpdateData = null;
		Main.CurrentGB.isPreviousLevel = false;

		if (!Rankings) return;

		// LG Scrollaktion: Beim ersten mal Öffnen Medals von P1 notieren. Wenn gescrollt wird und P1 weniger Medals hat, dann vorheriges Level, sonst aktuelles Level
		if (IsLevelScroll) {
			let Medals = 0;
			for (let i = 0; i < Rankings.length; i++) {
				if (Rankings[i]['reward'] !== undefined) {
					Medals = Rankings[i]['reward']['resources']['medals'];
					break;
				}
			}

			if (Medals !== LGCurrentLevelMedals) {
				Main.CurrentGB.isPreviousLevel = true;
			}
		}
		else {
			let Medals = 0;
			for (let i = 0; i < Rankings.length; i++) {
				if (Rankings[i]['reward'] !== undefined) {
					Medals = Rankings[i]['reward']['resources']['medals'];
					break;
				}
			}
			LGCurrentLevelMedals = Medals;
		}

		Main.CurrentGB.Entity = CityMapEntity.responseData[0];
		Main.CurrentGB.Rankings = Rankings;
		Parts.IsPreviousLevel = Main.CurrentGB.isPreviousLevel;
		if (!Main.CurrentGB.isPreviousLevel) 
			Parts.View = '';

		// GB was loaded
		$('#partCalc-Btn').removeClass('hud-btn-red');
		$('#partCalc-Btn-closed').remove();

		if ($('#OwnPartBox').length > 0) {
			Parts.CalcBody();
		}
	}


	// player goods
	FH.proxy.addHandler('ResourceService', 'getPlayerResources', (data, postData) => {
		FH.RessourceStock = data.responseData.resources; // Keep this updated
		Outposts.CollectResources();
		FH.proxy.triggerFoeHelperHandler('ResourcesUpdated')
		Castle.UpdateCastlePoints(data['requestId']);
	});
	FH.proxy.addHandler('ResourceService', 'getPlayerResourceBag', (data, postData) => {
		if (data.responseData?.type?.value && data.responseData?.type?.value != 'PlayerMain') return; // for now ignore all other source types
		FH.RessourceStock = data.responseData.resources.resources;
		Outposts.CollectResources();
		FH.proxy.triggerFoeHelperHandler('ResourcesUpdated')
		Castle.UpdateCastlePoints(data['requestId']);
	});


	//--------------------------------------------------------------------------------------------------
	//--------------------------------------------------------------------------------------------------


	// Greatbuildings: LG Belohnungen von Arche in Events zählen
	FH.proxy.addHandler('OtherPlayerService', 'getEventsPaginated', (data, postData) => {
		if (data.responseData['events']) {
			GreatBuildings.HandleEventPage(data.responseData['events']);
		}
	});


	FH.proxy.addHandler('TimeService', 'updateTime', async (data, postData) => {
		GameTime.set(data.responseData.time);
		if (MainMenuLoaded) return;

	
		MainMenuLoaded = true;
		await FH.StartUpDone;	
		let MenuSetting = FH.Storage.getItem('SelectedMenu');
		Main.SelectedMenu = MenuSetting || 'RightBar';
		FH.menu.CallSelectedMenu(Main.SelectedMenu);
		
		Main.setLanguage();
		Main.setGameFilters();
		Quests.init();
	});


	// --------------------------------------------------------------------------------------------------
	FH.proxy.addRawWsHandler((data) => {
		let Msg = data?.[0];
		if (!Msg || !Msg.requestClass || !Msg.responseData) return;

		let requestClass = Msg.requestClass;
		let requestMethod = Msg.requestMethod;
		let responseData = Msg.responseData;

		// Goods Update after accepted Trade
		if (requestMethod === "newEvent" && responseData.type === "trade_accepted") {
			FH.RessourceStock[responseData.need.good_id] += responseData.need.value;
			FH.proxy.triggerFoeHelperHandler("ResourcesUpdated");
		}
		// Inventory Update, e.g. when receiving FP packages from GB leveling	
		if (requestClass === 'InventoryService' && requestMethod === 'getItem') {
			Main.UpdateInventoryItem(responseData);
		}

		if (requestClass === 'InventoryService' && requestMethod === 'getItemAmount') {
			Main.UpdateInventoryAmount(responseData);

		}
	});

	// --------------------------------------------------------------------------------------------------
	// Quests
	FH.proxy.addHandler('QuestService', 'getUpdates', (data, PostData) => {
		if (PostData[0]?.requestClass === 'QuestService' && PostData[0]?.requestMethod === 'advanceQuest') {
			FPCollector.HandleAdvanceQuest(PostData[0]);
		}

		Main.Quests = data.responseData;

		FH.proxy.triggerFoeHelperHandler('QuestsUpdated');
	});

	// Update unlocked features
	FH.proxy.addHandler('UnlockableFeatureService', 'getUnlockedFeatures', (data, postData) => {
		Main.UnlockedFeatures = data.responseData.map(function(obj) { return obj.feature; });
	});

	// Messages: Thread opened
	FH.proxy.addHandler('ConversationService', 'getConversation', (data, postData) => {
		Main.OpenConversation = data.responseData;
		Calculator.ConversationContent = data.responseData.messages[0].text;
	});

	// Messages: Thread closed
	FH.proxy.addHandler('ConversationService', 'markMessageRead', (data, postData) => {
		Main.OpenConversation = null;
		Calculator.ConversationContent = null;
		Calculator.ConversationContentNew = null;
	});

	FH.proxy.addHandler('ConversationService', 'sendMessage', (data, postData) => {
		Calculator.ConversationContentNew = data.responseData.text;
		//	Calculator.showToPay(Calculator.ConversationContent, Calculator.ConversationContentNew)
	});

})();

FH.Beta = {
	load: (active) => {
		if (active !== false) active = true;
		FH.Storage.setItem('BetaActive', active);
		location.reload();
	},
	menu: [
		'unitsGex',
		'marketOffers'
	],
	active: JSON.parse(FH.Storage.getItem('BetaActive')) || FH.BaseData.devMode === 'true'
};

FH.BgApiHandler = /** @type {null|((request: {type: string}&object) => Promise<{ok:true, data: any}|{ok:false, error:string}>)}*/ (null);

let Main = {
	Language: 'en',
	SelectedMenu: 'RightBar',
	BonusService: null,
	EmissaryService: null,
	PlayerPortraits: [],
	Conversations: [],
	MetaIds: {},
	MetaUrls: {},
	CityEntities: null,
	StartUpType: null,
	OpenConversation: null,
	CurrentGB: {
		Entity: undefined,
		Rankings: undefined,
		isPreviousLevel: false
	},

	// all buildings of the player
	CityMapData: {},
	CityBuildingsData: {},

	// Unlocked extensions
	Quests: null,
	ArkBonus: 0,
	Inventory: {},

	// all buildings additional data
	BuildingUpgrades: null,
	BuildingSets: null,
	BuildingChains: null,
	SelectionKits: null,
	
	BuildingFamilyLimits: null,

	/**
	* Version specific StartUp Code
	* Todo: Add code that should be executed only until the next update
	*
	*/
	VersionSpecificStartupCode: () => {
		let LastStartedVersion = FH.Storage.getItem('LastStartedVersion');
		let LastAgreedVersion = FH.Storage.getItem('LastAgreedVersion');

		if (!LastStartedVersion) {
			Main.StartUpType = 'DeletedSettings';
			/* Fresh install or deleted settings */
			/* Attention: If you do stuff here it might be executed every start when surfing in incognito mode */
		}
		else if (LastStartedVersion !== FH.BaseData.extVersion) {
			Main.StartUpType = 'UpdatedVersion';

			FH.HTML.ShowToastMsg({
				show: true,
				head: FH.t('Menu.NewVersion.Title'),
				text: FH.t('Menu.NewVersion.Desc') + ' <a href="https://github.com/outoftheline/forge-hammer/blob/main/changelog-en.md" target="_blank">ChangeLog</a>',
				type: 'success',
				allowToastClose: true,
				hideAfter: 30000,
			});
			/* We have a new version installed and started the first time */
		}
		else if (LastAgreedVersion !== FH.BaseData.extVersion) {
			Main.StartUpType = 'NotAgreed';
			/* This is a second start, but the player has not yet agreed to the new prompt */
		}
		else {
			Main.StartUpType = 'RegularStart';
			/* Normal start */
		}

		FH.Storage.setItem('LastStartedVersion', FH.BaseData.extVersion);
		FH.Storage.setItem('LastAgreedVersion', FH.BaseData.extVersion); //Comment out this line if you have something the player must agree on
	},


	/**
	 * Requests and applies city entity metadata from the background service worker.
	 *
	 * @param {Object} buildingUrls - A mapping where keys represent building IDs and values contain metadata URLs and hashes.
	 * @param {string} [region] - The region code for the current world, e.g. "de".
	 */
	CityEntityBuilder: async (buildingUrls, region = String(FH.World).replace(/\d+$/, '') || 'unknown') => {
		const urlIds = Object.keys(buildingUrls);
		const urlCount = urlIds.length;

		const precheckResponse = await Main.sendExtMessage({
			type: 'buildingMetaPreCheck',
			region,
			timeout: 1000,
		});
		const existingCount = (precheckResponse && typeof precheckResponse.existingCount === 'number') ? precheckResponse.existingCount : 0;

		const missingCount = urlCount - existingCount;
		const useLongTimeout = missingCount > 300;
		const longTimeout = 600000
		const timeout = useLongTimeout ? longTimeout : 30000;

		if (timeout == longTimeout) {
			let div = document.createElement('div');
			div.innerHTML = `<div><div id="DBCreationWarning" style="position:fixed;bottom:0;right:0;min-width:300px;max-width:500px;width:50%;height:max-content;padding:1rem;background-color:#000000cc;color:#eee;z-index:9999999999;display:flex;align-items:center;justify-content:center;font-size:1rem;text-align:center;flex-direction:column;box-shadow:0 0 50px 50px #000c">
				<div style="width:100%;text-align:right"><span style="cursor:pointer" onclick="document.getElementById('DBCreationWarning').remove()">${FH.t("DBCreationWarning.CloseOverlay")} <b>&#10799;</b></span></div>
				<h2>Forge Hammer: ${FH.t("DBCreationWarning.Title")}</h2> </br>
				${FH.t("DBCreationWarning.ExplanationLine1")}<br> 
				${FH.t("DBCreationWarning.ExplanationLine2")}</br></br>
				<div style="position:relative;height:75px;"><div class="loading-data" style="height:0;background:unset;top:30px;"><span class="loadericon" style="zoom:0.5"></span></div></div>
			</div>`;
			document.body.appendChild(div);
		}

		const metadata = await Main.sendExtMessage({
			type: 'buildingMeta',
			buildingUrls,
			region,
			timeout,
		});
		document.getElementById('DBCreationWarning')?.remove()

		Main.CityEntities = metadata || {};
		Main.correctBuildingType();
		Main.Inactives.check();
	},


	/**
	 * Updates the `type` property of each CityEntity in `Main.CityEntities` if it is missing.
	 */
	correctBuildingType: () => {
		for (let i in Main.CityEntities) {
			if (!Main.CityEntities.hasOwnProperty(i)) continue;

			let CityEntity = Main.CityEntities[i];
			if (!CityEntity.type) CityEntity.type = CityEntity?.components?.AllAge?.tags?.tags?.find(value => value.hasOwnProperty('buildingType')).buildingType;
        }
	},


	/**
	 * Etwas zur background.js schicken
	 *
	 * @param {any & {type: string}} data
	 */
	sendExtMessage: async (data) => {
		/** @type {null|Promise<{ok:true,data:any}|{ok:false,error:string}|unknown>} */
		let _responsePromise = null;

		if (typeof chrome !== 'undefined') {
			_responsePromise = new Promise(resolve => chrome.runtime.sendMessage(FH.BaseData.extID, data, resolve));
		}
		else if (FH.bgApiHandler != null) {
			_responsePromise = FH.bgApiHandler(data);

		}
		else {
			throw new Error('No implementation for Extension communication found');
		}

		const responsePromise = _responsePromise;

		const response = await new Promise((resolve, reject) => {
			responsePromise.then(resolve, reject);
			const timeoutMs = Number.isInteger(data.timeout) ? data.timeout : (data.type === 'buildingMeta' ? 120000 : 1000);
			setTimeout(() => resolve({ ok: false, error: "response timeout for: " + JSON.stringify(data) }), timeoutMs);
		});

		if (typeof response !== 'object' || typeof response.ok !== 'boolean') {
			throw new Error('invalid response from Extension-API call');
		}

		if (response.ok === true) {
			return response.data;
		}
		else {
			if (response.error.indexOf('"type":"alerts"')=== -1 && response.error.indexOf('"action":"getAll"') === -1)
				console.warn('EXT-API error: ' + response.error);
		}
	},


	setLanguage: () => {
		Main.Language = FH.BaseData.GuiLng;
	},


	setGameFilters: () => {
		let filters = JSON.parse(FH.Storage.getItem('hammerGameFilters'));
		if (filters)
			$('#game-container').css('filter',
				`brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation}) hue-rotate(${filters.hue}deg)`
			);
	},


	/**
	 * Add x minutes or x hours to the current time
	 *
	 * @param hrs
	 * @param min
	 * @returns {number}
	 */
	getAddedDateTime: (hrs, min = 0) => {
		let time = Main.getCurrentDateTime(),
			h = hrs || 0,
			m = min || 0,

			// Zeit aufschlagen
			newTime = time + (1000 * 60 * m) + (1000 * 60 * 60 * h),

			// daraus neues Datumsobjekt erzeugen
			newDate = new Date(newTime);

		return newDate.getTime();
	},


	/**
	 * @returns {number}
	 */
	getCurrentDateTime: () => {
		return Main.getCurrentDate().getTime();
	},


	/**
	 * @returns {Date}
	 */
	getCurrentDate: () => {
		return new Date(Date.now() + GameTime.Offset*1000);
	},


	round: (value) => {
		let Epsilon = 0.000001;

		if (value >= 0) {
			return Math.round(value + Epsilon);
		}
		else {
			return Math.round(value - Epsilon);
		}
	},


	/**
	 * Storage has always had a time surcharge
	 *
	 * @param {number} actual
	 * @param {number} storage
	 * @returns {string|boolean}
	 */
	compareTime: (actual, storage) => {
		if (storage === null) {
			return true;
		} else if (actual > storage) {
			return true;

			// Zeit Differenz berechnen
		} else if (storage > actual) {

			let diff = Math.abs(actual - storage),
				timeDiff = new Date(diff);

			let hh = Math.floor(timeDiff / 1000 / 60 / 60);
			if (hh < 10) {
				hh = '0' + hh;
			}
			timeDiff -= hh * 1000 * 60 * 60;

			let mm = Math.floor(timeDiff / 1000 / 60);
			if (mm < 10) {
				mm = '0' + mm;
			}
			timeDiff -= mm * 1000 * 60;

			let ss = Math.floor(timeDiff / 1000);
			if (ss < 10) {
				ss = '0' + ss;
			}

			return mm + "min und " + ss + 's';
		}
	},


	/**
	 * Check whether an update is necessary
	 */
	checkNextUpdate: (ep) => {
		let s = FH.Storage.getItem(ep),
			a = Main.getCurrentDateTime();

		return Main.compareTime(a, s);
	},


	/**
	 * @param {string} PlayerID - The unique identifier for the player.
	 * @param {string} PlayerName - The display name of the player.
	 * @returns {string} A hyperlink to the player's profile if links are enabled in settings,
	 * or the player's name as plain text otherwise.
	 */
	GetPlayerLink: (PlayerID, PlayerName) => {
		if (Settings.GetSetting('ShowLinks')) {
			let PlayerLink = FH.helper.str.Replacer(FH.Links.Player.scoredb, { 'world': FH.World.toUpperCase(), 'playerid': PlayerID });
			if (FH.Storage.getItem('linkSite') === 'siteForgedb')
				PlayerLink = FH.helper.str.Replacer(FH.Links.Player.foestats, { 'server': FH.World.toLowerCase().replace(/[0-9]/g, ''), 'world': FH.World.toLowerCase(), 'playerid': PlayerID });

			return `<a class="external-link game-cursor" href="${PlayerLink}" target="_blank">${FH.HTML.escapeHtml(PlayerName)} ${FH.Links.Icon}</a>`;
		}
		else {
			return FH.HTML.escapeHtml(PlayerName);
		}
	},


	/**
	 * @param {string} GuildID - The unique identifier for the guild.
	 * @param {string} GuildName - The name of the guild.
	 * @param {string} [WorldId] - The world identifier. Defaults to `FH.World` when not provided.
	 * @returns {string} - A hyperlink to the guild or the plain text of the guild name, depending on the settings.
	 */
	GetGuildLink: (GuildID, GuildName, WorldId=FH.World) => {
		if (Settings.GetSetting('ShowLinks')) {
			let GuildLink = FH.helper.str.Replacer(FH.Links.Player.scoredb, { 'world': WorldId.toUpperCase(), 'guildid': GuildID });
			if (FH.Storage.getItem('linkSite') === 'siteForgedb')
				GuildLink = FH.helper.str.Replacer(FH.Links.Player.foestats, { 'server': FH.World.toLowerCase().replace(/[0-9]/g, ''), 'world': FH.World.toLowerCase(), 'guildid': GuildID });

			return `<a class="external-link game-cursor" href="${GuildLink}" target="_blank">${FH.HTML.escapeHtml(GuildName)} ${FH.Links.Icon}</a>`;
		}
		else {
			return FH.HTML.escapeHtml(GuildName);
		}
	},


	/**
	 * @param {string} BuildingID - The unique identifier for the building.
	 * @param {string} BuildingName - The name of the building to be displayed.
	 * @returns {string} A string containing either an FH.HTML.link or plain text for the building name.
	 */
	GetBuildingLink: (BuildingID, BuildingName) => {
		if (Settings.GetSetting('ShowLinks')) {
			let BuildingLink = FH.helper.str.Replacer(FH.Links.Building, {'buildingid': BuildingID });

			return `<a class="external-link game-cursor" href="${BuildingLink}" target="_blank">${BuildingName} ${FH.Links.Icon}</a>`;
		}
		else {
			return BuildingName;
		}
	},


	/**
	 * Adds a value to a FormData object under the specified prefix/key, serialising objects/arrays.
	 *
	 * @param {FormData} formData the formdata to add this data to
	 * @param {string} prefix the prefix/key for the value to store
	 * @param {any} value the value to store
	 */
	obj2FormData: (() => {// closure
		// Funktion wird im scope definiert, damit die rekursion direkt darauf zugreifen kann.
		function obj2FormData(formData, prefix, value) {
			if (typeof value === 'object') {
				for (let k in value) {
					if (!value.hasOwnProperty(k)) continue;
					obj2FormData(formData, `${prefix}[${k}]`, value[k]);
				}
			} else {
				formData.append(prefix, '' + value);
			}
		}
		return obj2FormData;
	})(),

	
	/**
	 * Sending data "home"
	 *
	 * @param data
	 * @param ep
	 * @param successCallback
	 */
	send2Server: (data, ep, successCallback) => {

		let req = fetch(
			ApiURL + ep + '/?player_id=' + FH.Player.ID + '&guild_id=' + FH.Guild.ID + '&world=' + FH.World,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data })
			}
		);

		if (successCallback !== undefined) {
			req
				.then(response => {
					if (response.status === 200) {
						response
							.json()
							.then(successCallback)
							;
					}
				});
		}
	},

	/**
	 * Back up player data
	 *
	 * @param d
	 */
	StartUp: async (d) => {
		//console.log("StartUp called");
		Settings.Init(false);

		Main.VersionSpecificStartupCode();
		FH.Guild.ID = d['clan_id'];
		FH.Guild.Permission = d['clan_permissions'];
		//FH.World = window.location.hostname.split('.')[0];
		FH.CurrentEra = d['era'];
		if (FH.CurrentEra['era']) FH.CurrentEra = FH.CurrentEra['era'];
		FH.CurrentEraID = Technologies.Eras[FH.CurrentEra];

		Main.sendExtMessage({
			type: 'storeData',
			key: 'current_guild_id',
			data: FH.Guild.ID
		});
		FH.Storage.setItem('current_guild_id', FH.Guild.ID);

		FH.Player.ID = d['player_id'];
		Main.sendExtMessage({
			type: 'storeData',
			key: 'current_player_id',
			data: FH.Player.ID
		});
		FH.Storage.setItem('current_player_id', FH.Player.ID);

		IndexDB.Init(FH.Player.ID);

		Main.sendExtMessage({
			type: 'storeData',
			key: 'current_world',
			data: FH.World
		});
		FH.Storage.setItem('current_world', FH.World);

		FH.Player.Name = d['user_name'];
		Main.sendExtMessage({
			type: 'storeData',
			key: 'current_player_name',
			data: FH.Player.Name
		});

		FH.Player.Avatar = d.portrait_id;
		await ExistenceConfirmed('Main.CityEntities||srcLinks.FileList||Infoboard||EventHandler||TranslationData');
	
		Infoboard.Init();
		EventHandler.Init();
		
		window.dispatchEvent(new CustomEvent('forgehammer#StartUpDone'))
		
		// remove campagnemap storage - can be removed again at some point
		FH.Storage.removeItem('AllProvinces');
	},


	Allies: {
		buildingList:null,
		allyList:null,
		meta:null,
		rarities:null,
		names:null,
		buildingBoostSums:[],

		getAllies:(allies)=>{
			Main.Allies.allyList = Object.assign({}, ...allies.map(a=>({[a.id]:a})));
			let list = Main.Allies.buildingList = {}
			for (let ally of allies) {
				if (!ally.mapEntityId) continue
				if (list[ally.mapEntityId]) 
					list[ally.mapEntityId][ally.id]=ally.id
				else 
				 	list[ally.mapEntityId] = {[ally.id]:ally.id}
			}
			Main.Allies.updateAllyList()
		},

		updateAlly:(ally)=>{
			if (ally.mapEntityId) {
				let list = Main.Allies.buildingList
				if (list[ally.mapEntityId]) 
					list[ally.mapEntityId][ally.id]=ally.id
				else 
				 	list[ally.mapEntityId] = {[ally.id]:ally.id}
			} else {
				mapID=Main.Allies.allyList[ally.id]?.mapEntityId
				if (mapID) {
					delete Main.Allies.buildingList[mapID][ally.id]
					if (Object.keys(Main.Allies.buildingList[mapID]).length==0) delete Main.Allies.buildingList[mapID]
				}
			}
			Main.Allies.allyList[ally.id] = ally
			Main.Allies.updateAllyList()
		},

		addAlly:(ally)=>{
			Main.Allies.allyList[ally.id]=ally
			Main.Allies.updateAllyList()
		},

		setMeta:(raw)=>{
			let meta = Main.Allies.meta = {} 
			for (ally of raw) {
				meta[ally.id]=ally
			}
		},

		getProd:(CityMapId) => {
			let M = Main.Allies
			if (!M.buildingList?.[CityMapId]) return null
			let prod={}
			Object.values(M.buildingList[CityMapId]).forEach(id=> {
				let a=M.allyList[id]
				if (a.currentLevel?.boosts || a.boosts) prod.boosts = (prod.boosts||[]).concat(a.currentLevel?.boosts || a.boosts)
			})
			return prod
		},

		tooltip:(id)=>{
			if (!Main.Allies.buildingList?.[id]) return ""
			return `data-allies ="${JSON.stringify(Object.values(Main.Allies.buildingList[id]))}"`
		},

		setRarities:(raw)=>{
			Main.Allies.rarities=Object.assign({}, ...raw.map(r=>({[r.id.value]:r})))
		},

		setTypes:(raw)=>{
			Main.Allies.types=Object.assign({}, ...raw.map(t=>({[t.id]:t})))
		},

		getAllieData:(id)=>{
			let ally = structuredClone(Main.Allies.allyList[id])
			ally.rarity=ally.rarity.value
			ally.name=Main.Allies.meta[ally.allyId]?.name
			ally.typeName=Main.Allies.types[ally.type]?.name
			ally.type=Main.Allies.meta[ally.allyId]?.allyType
			return ally
		},

		showAllyList:(closeIfOpen = false)=>{

			if ($('#AllyList').length === 0) {
				FH.HTML.Box({
					id: 'AllyList',
					title: FH.t('Boxes.AllyList.Title'),
					auto_close: true,
					dragdrop: true,
					minimize: true,
					resize: true,
					settings: Main.Allies.ShowSettings,
					active_maps:"main",				
				});
			} else {
				if (closeIfOpen) {
					FH.HTML.CloseOpenBox('AllyList');
					return;
				}
			}
			Main.Allies.updateAllyList()
		},

		updateAllyList:()=>{
			Main.Allies.buildingBoostSums=[]	
			if ($('#AllyList').length === 0) return;
			let buildings = Object.assign({},...Object.values(Main.CityMapData).map(x=>({id:x.id,metaID:x.cityentity_id,rooms:structuredClone(Main.CityEntities[x.cityentity_id]?.components?.AllAge?.ally?.rooms)})).filter(x=>x.rooms!==undefined).map(x=>({[x.id]:x})))
			let rooms = {}
			let unassigned = 0;
			let boostList = [
				{feature:"all",type: "att_boost_attacker"},
				{feature:"all",type: "att_boost_defender"},
				{feature:"battleground",type: "att_boost_attacker"},
				{feature:"battleground",type: "att_boost_defender"},
				{feature:"guild_expedition",type: "att_boost_attacker"},
				{feature:"guild_expedition",type: "att_boost_defender"},
				{feature:"all",type: "def_boost_attacker"},
				{feature:"all",type: "def_boost_defender"},
				{feature:"battleground",type: "def_boost_attacker"},
				{feature:"battleground",type: "def_boost_defender"},
				{feature:"guild_expedition",type: "def_boost_attacker"},
				{feature:"guild_expedition",type: "def_boost_defender"},
			]
			Object.values(Main.Allies.allyList).forEach(x=>{
				if (x.mapEntityId) {
					let rs=buildings[x.mapEntityId].rooms
					for (let r of rs) {
						if (!r.ally && r.rarity?.value == x.rarity.value) {
							r.ally = x
							return
						}
					}
					for (let r of rs) {
						if (!r.ally && !r.rarity) {
							r.ally = x
						}
					}
				} else {
					rooms[0+"#" + unassigned] = {
						allyRarity: x.rarity?.value || "",
						allyLevel: x.level || null,												
						allyBoosts: x.currentLevel?.boosts || x.boosts || null,
						allyName: Main.Allies.meta[x.allyId]?.name || "",
					}
					unassigned++
				}
			})
			Object.values(buildings).forEach(b=>{
				for (let [i,r] of Object.entries(b.rooms)) {
					rooms[b.id+"#" + i] = {
						buildingName: Main.CityEntities[b.metaID].name,
						buildingMeta:b.metaID,
						roomRarity: r.rarity?.value || Object.keys(Main.Allies.rarities).join("#"),
						allyRarity: r.ally?.rarity?.value || "",
						allyLevel: r.ally?.level || null,												
						allyBoosts: r.ally?.currentLevel?.boosts || r.ally?.boosts || null,
						allyName: Main.Allies.meta[r.ally?.allyId]?.name || "",
					}
				}
			})
			Object.values(Main.Inventory).filter(x=>x?.item?.reward?.assembledReward?.type=="ally").forEach(x=>{
				if (!x.inStock) return;
				rooms[0+"#" + unassigned] = {
					fragmentsAmount: x.inStock,
					fragmentsNeeded: x.item.reward.requiredAmount,
					allyRarity: x.item.reward.assembledReward.rarity?.value || "",
					allyLevel: x.item.reward.assembledReward.level || null,												
					allyBoosts: x.item.reward.assembledReward.boosts || null,
					allyName: x.item.reward.assembledReward.name,
				}
				unassigned++
			})

			html=`<div class="dark-bg">
				<select id="AllyFilter"><option value="">${FH.t('Boxes.AllyList.All')}</option>`
				for (let r of Object.values(Main.Allies.rarities)) {
					html+=`<option value="${r.id.value}">${r.name}</option>`
				}
			html+=`</select></div>`
			html+=`<table id="AllyListTable" class="foe-table">`
			html+=`<thead class="sticky"><tr class="sorter-header sort2">
							<th class="no-sort">${FH.t('Boxes.AllyList.Ally')}</th>
							<th class="is-number" data-type="ally-list">${FH.t('Boxes.AllyList.Level')}</th>`;
							for (const b of boostList) {
								html+= `<th class="is-number" data-type="ally-list"><span class="resicon ${b.type}-${b.feature}"></span></th>`
							}
					html+=`<th class="no-sort">${FH.t('Boxes.AllyList.Building')}</th>
					</tr>
				</thead>
				<tbody class="ally-list">`;
			sortedRooms = Object.entries(rooms).sort((a,b)=>{
				f=(r)=>{return Object.keys(Main.Allies.rarities).indexOf(r.allyRarity) + (r.buildingName?10:0) + (r.fragmentsAmount?100:0)}
				return f(a[1])-f(b[1])
			})
				
			for (let [roomId,r] of sortedRooms){
				let buildingId=roomId.split("#")[0]
				let rarities=r.roomRarity?.split("#")||[]
				rarities.push(r.allyRarity)
				rarities=rarities.map(x=>"Rarity-"+x)

				html+=`<tr class="allyRoomRow ${rarities.join(" ")}">
						   	<td style="white-space:nowrap">
								${Main.Allies.rarityStars(r.allyRarity)}
								${r.allyName || ""}${r.fragmentsAmount?srcLinks.icons("icon_tooltip_fragment") + r.fragmentsAmount+"/"+r.fragmentsNeeded:""}
							</td>
						   	<td data-number="${(r.allyLevel || 0)}">${r.allyLevel || ""}</td>`;
							for (let b of boostList) {
								let allyB = Main.Allies.boostsArray(r.allyBoosts);
								let boost = allyB.find(x => x.type == b.type && x.feature == b.feature);
						   		html+=`<td data-number="${(boost ? boost.value : 0)}">${(boost ? boost.value : '-')}</td>`
							}
						html+=`
					   	   	<td ${buildingId!=0?`class="helperTT" 
								data-id="${buildingId}" 
								data-era="${Technologies.InnoEraNames[Main.CityMapData[buildingId].level]}"
								data-callback_tt="Tooltips.buildingTT" 
								`:``}
							>
								${r.buildingName || ""}
								${buildingId!=0?`<img class="show-entity" data-id="${buildingId}" src="${ FH.extUrl + 'images/hud/open-eye.png'}">`:""}
							</td>
							</tr>`;
				
				// gather sums of all boosts
				if (buildingId!=0 && r.allyBoosts !== null) {
					for (let boost of r.allyBoosts) {
						let bBoost = Main.Allies.buildingBoostSums.find(x => x.type === boost.type && x.targetedFeature === boost.targetedFeature);
						if (bBoost)
							bBoost.value += boost.value;
						else
							Main.Allies.buildingBoostSums.push(structuredClone(boost));
					}
				}
			}
			Main.Allies.buildingBoostSums.sort((a, b) => {
				if (a.type < b.type) return -1
				if (a.type > b.type) return 1
				return 0
			});
			Main.Allies.buildingBoostSums.sort((a, b) => {
				if (a.targetedFeature < b.targetedFeature) return -1
				if (a.targetedFeature > b.targetedFeature) return 1
				return 0
			});
			html+=`</tbody><tr><td colspan="19" class="text-center dark-bg">
				${Main.Allies.boosts(Main.Allies.buildingBoostSums)}
				</td></tr></table>`
			
			$('#AllyListBody').html(html).promise().done(function () {
				$('#AllyListTable').tableSorter();
			})

			$('#AllyFilter').on("change",()=>{
				let rarity=$('#AllyFilter option:selected').val()
				$('.allyRoomRow').each((i,e)=>{
					if (rarity=="" || $(e).hasClass("Rarity-"+rarity)) $(e).show()
					else $(e).hide()
				})
			})
			$('#AllyListBody .foe-table .show-entity').on('click', function () {
				Productions.ShowOnMap($(this).data('id'));
			});
			return rooms
		},

		rarityStars: (r) => {
			if (!r || r=="") return ""
			let i = Object.keys(Main.Allies.rarities).indexOf(r)
			if (i==-1) return `<img style="filter: drop-shadow(0px 2px 2px black)"  src="${srcLinks.get(`/shared/icons/when_motivated.png`, true)}">`
			if (i==0) return `<span style="font-size: large; color: transparent; text-shadow: 0px 0px 4px black;" >☆</span>`
			let ret=""					
			let star = `<img style="margin-left:-3px"  src="${srcLinks.get(`/historical_allies/portraits/historical_allies_portrait_rarity_icon.png`, true)}">`
			for (let j = 0; j < i; j++) {
				ret += star
				star = `<img style="margin-left:-15px" src="${srcLinks.get(`/historical_allies/portraits/historical_allies_portrait_rarity_icon.png`, true)}">`
			}
			return ret
		},
				
		boosts: (boosts) => {
			let feature = {
				"all":"",
				"battleground":"_gbg",
				"guild_expedition":"_gex",
				"guild_raids":"_gr"
			}
			let ret=""
			for (b of boosts||[]) {
				ret+=`<span class="${b.targetedFeature}">${srcLinks.icons(b.type+feature[b.targetedFeature])} ${b.value + Boosts.percent(b.type)}</span>`
			}
			return ret
		},

		boostsArray: (boosts) => {
			let ret = [];
			for (b of boosts||[]) {
				let combinedBoosts = Boosts.Mapper[b.type];
				if (combinedBoosts) {
					for (let type of combinedBoosts) {
						let foundBoost = ret.find(x => x.feature === b.targetedFeature && x.type === type);
						if (foundBoost)
							foundBoost.value += b.value;
						else
						ret.push({'feature':b.targetedFeature,'value':b.value,'type':type})
					}
				}
				else {
				let foundBoost = ret.find(x => x.feature === b.targetedFeature && x.type === b.type);
				if (foundBoost)
					foundBoost.value += b.value;
				else
					ret.push({feature:b.targetedFeature,value:b.value,type:b.type});
				}
			}
			return ret;
		},

		ShowSettings: () => {
			let autoOpen = Settings.GetSetting('ShowAllyList');

			let h = [];
			h.push(`<p><label><input id="allyListAutoOpen" type="checkbox" ${(autoOpen === true) ? ' checked="checked"' : ''} />${FH.t('Boxes.Settings.Autostart')}</label></p>`);
			h.push(`<p><button onclick="Main.Allies.SaveSettings()" id="save-bghelper-settings" >${FH.t('Boxes.Settings.Save')}</button></p>`);

			$('#AllyListSettingsBox').html(h.join(''));
		},

		SaveSettings: () => {
			let value = false;
			if ($("#allyListAutoOpen").is(':checked'))
				value = true;
			FH.Storage.setItem('ShowAllyList', value);
			
			$(`#AllyListSettingsBox`).remove();
		},


	},


	/**
	 * Determine ark bonus globally
	 *
	 * @param LimitedBonuses
	 */
	SetArkBonus: (LimitedBonuses) => {
		let ArkBonus = 0;

		for (let i in LimitedBonuses) {

			if (!LimitedBonuses.hasOwnProperty(i)) { break }

			if (LimitedBonuses[i].type === 'contribution_boost') {
				ArkBonus += LimitedBonuses[i].value;
			}
		}

		Main.updateArkBonus(ArkBonus,"Limited Bonuses");
	},


	SetArkBonus2: () => {
		let ArkBonus = 0;

		for (let i of Object.values(Main.CityMapData).filter(x => x?.bonus?.type === "contribution_boost")) {
			ArkBonus += i.bonus.value;
		}

		Main.updateArkBonus(ArkBonus,"City Map");
	},


	/**
	 * Updates the ArkBonus value if the new value is greater than the current value stored
	 * in Main.ArkBonus. If the ArkBonus is updated and the current value was greater than 0,
	 * a developer log is optionally shown as a toast message in developer mode.
	 *
	 * @param {number} ArkBonus - The new ArkBonus value to set.
	 * @param {string} Source - A string representing the source or origin of the update.
	 */
	updateArkBonus:(ArkBonus, Source)=>{
		if (ArkBonus > Main.ArkBonus) {
			if (Main.ArkBonus > 0) {
				const s = `SetArkBonus: updated ArkBonus from ${Main.ArkBonus} to ${ArkBonus} by ${Source}`;
				if (FH.BaseData.devMode === 'true') {
					FH.HTML.ShowToastMsg({
						show: true,
						head: 'Developer log',
						text: s,
						type: 'info',
						hideAfter: 20000,
					});
				}
			}
			Main.ArkBonus = ArkBonus;
		}
	},


	/**
	 * Player information Updating message list & Website data
	 *
	 * @param d
	 * @param Source
	 * @param ListType
	 * @constructor
	 */
	UpdatePlayerDict: (d, Source, ListType = undefined) => {
		if (Source === 'Conversation') {
			for (let i in d['messages']) {
				if (!d['messages'].hasOwnProperty(i))
					continue;

				let Message = d['messages'][i];

				if (Message.sender !== undefined) {
					Main.UpdatePlayerDictCore(Message.sender);
				}
			}
		}

		else if (Source === 'LGOverview' && d[0]) {
			Main.UpdatePlayerDictCore(d[0].player);
		}

		else if (Source === 'LGContributions') {
			for (let i in d) {
				if (!d.hasOwnProperty(i))
					continue;

				Main.UpdatePlayerDictCore(d[i].player);
			}
		}

		else if (Source === 'PlayerList') {
			for (let i in d) {
				if (!d.hasOwnProperty(i))
					continue;

				Main.UpdatePlayerDictCore(d[i]);
			}

			if (ListType === 'getNeighborList') {
				FH.Players.NeighborsUpdated = true;
			}
			else if (ListType === 'getClanMemberList') {
				FH.Players.GuildUpdated = true;
			}
			else if (ListType === 'getFriendsList') {
				FH.Players.FriendsUpdated = true;
			}

			if ($('#moppelhelper').length > 0) {
				EventHandler.CalcMoppelHelperBody();
			}
		}
	},


	/**
	 * Update player information
	 *
	 * @param Player
	 * @constructor
	 */
	UpdatePlayerDictCore: (Player) => {

		let PlayerID = Player['player_id'];
		let HasGuildPermission = ((FH.Guild.Permission & GuildMemberStat.GuildPermission_Leader) > 0 || (FH.Guild.Permission & GuildMemberStat.GuildPermission_Founder) > 0);

		if (PlayerID !== undefined) {
			if (FH.Players.Dict[PlayerID] === undefined) FH.Players.Dict[PlayerID] = {
										Activity: (Player['is_friend'] || (Player['is_guild_member'] && HasGuildPermission)) ? 0 : undefined
									};

			FH.Players.Dict[PlayerID]['PlayerID'] = PlayerID;
			if (Player['name'] !== undefined) FH.Players.Dict[PlayerID]['PlayerName'] = Player['name'];
			if (Player['clan'] !== undefined) FH.Players.Dict[PlayerID]['ClanName'] = Player['clan']['name'];
			if (Player['clan_id'] !== undefined) FH.Players.Dict[PlayerID]['ClanId'] = Player['clan_id'];
			if (Player['avatar'] !== undefined) FH.Players.Dict[PlayerID]['Avatar'] = Player['avatar'];
			if (Player['is_neighbor'] !== undefined) FH.Players.Dict[PlayerID]['IsNeighbor'] = Player['is_neighbor'];
			if (Player['is_guild_member'] !== undefined) FH.Players.Dict[PlayerID]['IsGuildMember'] = Player['is_guild_member'];
			if (Player['is_friend'] !== undefined) FH.Players.Dict[PlayerID]['IsFriend'] = Player['is_friend'];
			if (Player['is_self'] !== undefined) FH.Players.Dict[PlayerID]['IsSelf'] = Player['is_self'];
			if (Player['score'] !== undefined) FH.Players.Dict[PlayerID]['Score'] = Player['score'];
			if (Player['won_battles'] !== undefined) FH.Players.Dict[PlayerID]['WonBattles'] = Player['won_battles'];
			if (Player['activity'] !== undefined) FH.Players.Dict[PlayerID]['Activity'] = Player['activity'];
			if (Player['era'] !== undefined) FH.Players.Dict[PlayerID]['Era'] = Player['era'];
		}
	},

	/**
	 * Updates the inventory
	 *
	 * @param Items
	 */
	UpdateInventory: (Items) => {
		//Main.Inventory = {};
		for (let i = 0; i < Items.length; i++) {
			let ID = Items[i]['id'];
			Main.Inventory[ID] = Items[i];
		}
		FH.proxy.triggerFoeHelperHandler('InventoryUpdated');
	},


	/**
	 * Updates the inventory
	 *
	 * @param Item
	 */
	UpdateInventoryItem: (Item) => {
		let ID = Item['id'];
		Main.Inventory[ID] = Item;
		FH.proxy.triggerFoeHelperHandler('InventoryUpdated');
	},


	/**
	 * Updates the inventory
	 *
	 * @param Item
	 */
	UpdateInventoryAmount: (Item) => {
			let ID = Item[0],
			Amount = Item[1];
			try {
				Main.Inventory[ID].inStock = Amount;
			} catch (e) {
			}
			FH.proxy.triggerFoeHelperHandler('InventoryUpdated');
	},


	/**
	 * Updates a building from CityMapData or CityMapEraOutpost
	 *
	 * @param Buildings
	 * */
	UpdateCityMap: (Buildings) => {
		for (let i in Buildings) {
			if (!Buildings.hasOwnProperty(i)) continue;
			if (Buildings[i]['player_id'] !== FH.Player.ID) continue; // Foreign building (z.B. visting neighbor and opening a GB)

			let ID = Buildings[i]['id'];
			if (Main.CityMapData[ID]) {
				Main.CityMapData[ID] = Buildings[i];
			} 
			if (FH.ActiveMap === "era_outpost") {
				CityMap.EraOutpost.data[ID] = Buildings[i];
			}
			else if (FH.ActiveMap === "cultural_outpost") {
				CityMap.CulturalOutpost.data[ID] = Buildings[i];
			}
			else if (FH.ActiveMap === "guild_raids") {
				CityMap.QI.data[ID] = Buildings[i];
			}
		}
		Main.SetArkBonus2();

		if ($('#bluegalaxy').length > 0) {
			FH.BlueGalaxy.CalcBody(Buildings);
		}

		FPCollector.CityMapDataNew = Buildings;
		FH.proxy.triggerFoeHelperHandler('CityMapUpdated');
	},


	/**
	 * Collect titles of the chats
	 *
	 * @param d
	 * @param refresh
	 */
	setConversations: (d, refresh = false) => {

		// If the cache is empty, read out the memory.
		if (Main.Conversations.length === 0 && refresh)
		{
			let StorageHeader = FH.Storage.getItem('ConversationsHeaders');
			if (StorageHeader !== null) {
				Main.Conversations = JSON.parse(StorageHeader);
			}
		}
		let day = Math.floor(Date.now()/86400000);
		let LCUindex = Main.Conversations.findIndex((obj) => (obj.id === "__lastCleanup"));
		let LCU = day;
		if (LCUindex === -1) {
			Main.Conversations.forEach( (obj) => obj.lastSeen = day);
			Main.Conversations.push({
				id: "__lastCleanup",
				LCU: day,
				lastSeen: day
			})
		} else {
			LCU = Main.Conversations[LCUindex]["LCU"];
			Main.Conversations[LCUindex]["lastSeen"] = day;
		}

		if (d['teasers'])
		{
			for (let k in d['teasers'])
			{
				if (!d['teasers'].hasOwnProperty(k)) {
					continue;
				}

				let key = Main.Conversations.findIndex((obj) => (obj.id === d['teasers'][k]['id']));

				// Is a key already available?
				if (key !== -1) {
					Main.Conversations[key]['type'] = d['type'];
					Main.Conversations[key]['title'] = d['teasers'][k]['title'];
					Main.Conversations[key]['hidden'] = d['teasers'][k]['isHidden'];
					Main.Conversations[key]['favorite'] = d['teasers'][k]['isFavorite'];
					Main.Conversations[key]['important'] = d['teasers'][k]['isImportant'];
					Main.Conversations[key]['lastSeen'] = day;
				}
				// → Create key
				else {
					Main.Conversations.push({
						type: d['type'],
						id: d['teasers'][k]['id'],
						title: d['teasers'][k]['title'],
						hidden: d['teasers'][k]['isHidden'],
						favorite: d['teasers'][k]['isFavorite'],
						important: d['teasers'][k]['isImportant'],
						lastSeen: day
					});
				}

			}

		}

		if (Main.Conversations.length > 0)
		{
			//cleanup of entries that have not been seen for more than a month - executes once per day
			if (LCU != day) {
				Main.Conversations[LCUindex]["LCU"] = day;
				Main.Conversations = Main.Conversations.filter(obj => obj.lastSeen +30 > day);
			}
			// Dopplungen entfernen und Daten lokal abspeichern
			Main.Conversations = [...new Set(Main.Conversations.map(s => JSON.stringify(s)))].map(s => JSON.parse(s));
			FH.Storage.setItem('ConversationsHeaders', JSON.stringify(Main.Conversations));
		}
	},


	/**
	 * Get a jSON via Ajax
	 *
	 */
	loadJSON: (url, callback) => {

		let xobj = new XMLHttpRequest();
		xobj.overrideMimeType("application/json");
		xobj.open('GET', url, true);
		xobj.onreadystatechange = function () {
			if (xobj.readyState === 4 && xobj.status === 200) {
				callback(xobj.responseText);
			}
		};
		xobj.send(null);
	},


	/**
	 * Loads a file from a given URL
	 *
	 * @param url
	 * @param callback
	 */
	loadFile: (url, callback) => {

		let xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.responseType = 'blob';
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4 && xhr.status === 200)
			{
				let reader = new FileReader();
				reader.readAsArrayBuffer(xhr.response);
				reader.onload = function (e) {
					callback(e.target.result);
				};
			}
			else {
				callback(false);
			}
		};
		xhr.send();

	},


	ClearText: (text) => {
		let RegEx = new RegExp(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi);

		return text.replace(RegEx, '');
	},


	ResizeFunctions: () => {
		// FP-Bar
		if (document.getElementById('game_body'))
			StrategyPoints.HandleWindowResize();
	},


	/**
	 * Create a blob for file download
	 *
	 * @param Blob
	 * @param FileName
	 * @constructor
	 */
	ExportFile: (Blob, FileName) => {
		// Browsercheck
		let isIE = !!document.documentMode;

		if (isIE) {
			window.navigator.msSaveBlob(Blob, FileName);
		}
		else {
			let url = window.URL || window.webkitURL,
				link = url.createObjectURL(Blob),
				a = document.createElement('a');

			a.download = FileName;
			a.href = link;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
	},


	Inactives: {
		list:[],
		ignore: JSON.parse(FH.Storage.getItem("LimitedBuildingsIgnoreList")||'[]'),

		check: () => {
			//get list of buildings for which an alert is already set
			let LB = JSON.parse(FH.Storage.getItem("LimitedBuildingsAlertSet")||'{}')
			//get list of expired limited buildings in city
			let list = Object.values(Main.CityMapData).filter(value => !!value.decayedFromCityEntityId).map(value => value.id);
			//remove buildings that were already tracked and that should have just triggered an alert
			for (let i = list.length-1;i>=0;i--) {
				if (LB[list[i]] || Main.Inactives.ignore.includes(Main.CityMapData[list[i]].cityentity_id)) {
					list.splice(i,1)
				}
			}
			Main.Inactives.list = [...new Set(list.map(x=>Main.CityMapData[x].cityentity_id))];
			
			//remove tracked buildings if time ran out
			for (let x in LB) {
				if (!LB[x]) continue;
				if (LB[x]<(GameTime-GameTime.Offset)*1000) delete LB[x];
				FH.Storage.setItem("LimitedBuildingsAlertSet",JSON.stringify(LB));
			}
			if(!Settings.GetSetting('ShowBuildingsExpired')){
				return;
			}
			//create instant alert for currently expired buildings		
			if (list.length > 0) {
					const data = {
					title: FH.t("InactiveBuildingsAlert.title"),
					body: list.map(x=>Main.CityEntities[Main.CityMapData[x].cityentity_id].name).join("\n"),
					expires: moment().add(1,"seconds").valueOf(),
					repeat: -1,
					persistent: true,
					tag: '',
					category: 'event',
					vibrate: false,
					actions: [{title:"OK"}]
				};
		
				Main.sendExtMessage({
					type: 'alerts',
					playerId: FH.Player.ID,
					action: 'create',
					data: data,
				})
			}
			let buildings = Object.values(Main.CityMapData)
			for (let building of buildings) {
				// set alerts for limited buildings that will run out in the future and that have no alert yet
				if (!LB[building.id] && Main.CityEntities[building.cityentity_id]?.components?.AllAge?.limited?.config?.expireTime) {
					const data = {
						title: FH.t("InactiveBuildingsAlert.title"),
						body: Main.CityEntities[Main.CityEntities[building.cityentity_id]?.components?.AllAge?.limited?.config?.targetCityEntityId].name,
						expires: (Main.CityEntities[building.cityentity_id]?.components?.AllAge?.limited?.config?.expireTime + building.state.constructionFinishedAt - GameTime.Offset)*1000,
						repeat: -1,
						persistent: true,
						tag: '',
						category: 'event',
						vibrate: false,
						actions: [{title:"OK"}]
					};
			
					Main.sendExtMessage({
						type: 'alerts',
						playerId: FH.Player.ID,
						action: 'create',
						data: data,
					}).then((aId) => {
						LB[building.id]=(Main.CityEntities[building.cityentity_id]?.components?.AllAge?.limited?.config?.expireTime + building.state.constructionFinishedAt - GameTime.Offset)*1000;
						FH.Storage.setItem("LimitedBuildingsAlertSet",JSON.stringify(LB));
					})
				}
			}
		},

		showSettings: ()=> {

			if ($('#inactivesSettingsBox').length === 0) {
				FH.HTML.Box({
					id: 'inactivesSettingsBox',
					title: FH.t('Boxes.InactivesSettings.Title'),
					auto_close: true,
					dragdrop: true,
					minimize: true,
					resize: true,
				});
	
				//FH.HTML.AddCssFile('auctions');
			}
			Main.Inactives.updateSettings();
		},

		updateSettings:()=>{ 
			let t=[];
			//t.push(`<h2>${FH.t('Boxes.InactivesSettings.Ignored')}</h2>`);
			t.push(`<h2>${FH.t('Boxes.InactivesSettings.Toggle')}</h2>`);
			for (let id of Main.Inactives.ignore) {
				t.push(`<span class="inactivesIgnoreToggle" data-id="${id}" title="${FH.t('Boxes.InactivesSettings.NoAlert')}">🤐${Main.CityEntities[id].name}</span></br>`);
			}
			//t.push(`<h2>${FH.t('Boxes.InactivesSettings.ClickToIgnore')}</h2>`);
			
			for (let id of Main.Inactives.list) {
				t.push(`<span class="inactivesIgnoreToggle" data-id="${id}" title="${FH.t('Boxes.InactivesSettings.AlertActive')}">⚠️${Main.CityEntities[id].name}</span></br>`);
			}
			
			
			$('#inactivesSettingsBoxBody').html(t.join(''));
			
			$('.inactivesIgnoreToggle').on("click", (e) => {
				let id = e.target.dataset.id;
				let i = Main.Inactives.ignore.findIndex(x => x==id);
				if (i>=0) {
					Main.Inactives.ignore.splice(i,1);
					Main.Inactives.list.push(id);

				} else {
					i = Main.Inactives.list.findIndex(x => x==id);
					Main.Inactives.list.splice(i,1);
					Main.Inactives.ignore.push(id);

				};
				FH.Storage.setItem("LimitedBuildingsIgnoreList",JSON.stringify(Main.Inactives.ignore));
				Main.Inactives.updateSettings();
			});
		},
	},


	UpdateActiveMap: (map)=>{
		FH.ActiveMap = map
		FH.proxy.triggerFoeHelperHandler("ActiveMapUpdated");
	}
};

if (window.FHBgApiHandler !== undefined && window.FHBgApiHandler instanceof Function) {
	FH.BgApiHandler = window.FHBgApiHandler;
	delete window.FHBgApiHandler;
}

FH.Main = Main;
FH.ExistenceConfirmed = ExistenceConfirmed;
FH.GameTime = GameTime;

console.log('Forge Hammer version ' + FH.BaseData.extVersion + ' started' + '. ID: ' + FH.BaseData.extID);
console.log(navigator.userAgent);

})();
