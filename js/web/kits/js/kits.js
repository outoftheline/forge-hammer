/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

/**
 * A {@link FH.HTML.Box box} for listing owned (in inventory) and missing buildings, and according kits and assets.
 * @namespace
 */

FH.proxy.addCustomHandler('InventoryUpdated', () => {
	Kits.UpdateBoxIfVisible();
});

let Kits = {

	/**
	 * The parsed JSON of all known sets.
	 * @type {object[]}
	 */
	KitsjSON: null,
	/**
	 * Determines which sets and assets to create. Valid values:
	 * - `0`: Shows owned sets and assets only
	 * - `1`: Shows owned sets and according assets (owned and missing)
	 * - `2`: Shows all known sets and assets
	 * @type {number}
	 */
	ShowMissing: 0,
	Fragments:{},
	fragmentURL:null,
	favourites:JSON.parse(FH.Storage.getItem("Kits.favourites")||"[]"),
	specialCases:{
		"selection_kit_watchtower_1_gbg" : "selection_kit_watchtower1_gbg",
		"selection_kit_ind_palace_set" :"selection_kit_indian_palace",
		"selection_kit_ind_fountain_set":"selection_kit_indian_fountain",
		"selection_kit_epic_FELL23":"selection_kit_epic_FELLOW23",
		"selection_kit_FELL23A":"selection_kit_FELLOW23A",
		"selection_kit_governors_villa":"selection_kit_govenors_villa",
		"selection_kit_classic_garden_set":"selection_kit_classical_garden",
		"selection_kit_winter_village_set":"selection_kit_winter_village",
		"selection_kit_royal_garden_set":"selection_kit_royal_garden",
		"selection_kit_gentiana_windmill_farmland":"selection_kit_gentiana_farmland",
		"selection_kit_W_MultiAge_WIN22A":"selection_kit_chocolatery",
		"selection_kit_winter_cars":"selection_kit_winter_train_carriage",
		"selection_kit_hippodrome_tracks": "selection_kit_hippodrome_track"
	},
	upgradeKits:null,

	/**
	 * Loads all known sets {@link Kits.KitsjSON JSON} and creates the {@link FH.HTML.Box DOM box}.
	 */
	init: ()=> {
		let out = [];

		out.push({"groupname":"Chains"});

		let reduceList = (List, trackFirsts = false) =>{
			let assets = [...List]
			let firsts = []
			for (let b of List) {
				if (!Kits.UpgradeSchemes[b]) continue;
				firsts.push(Kits.UpgradeSchemes[b].upgradeSteps[0].buildingId);

				for (let u of Kits.UpgradeSchemes[b].upgradeSteps) {
					i = assets.findIndex(x=>x==u.buildingId);
					if (i > -1) delete assets[i];
				}
				i = assets.findIndex(x=>x==b);
				delete assets[i];
				if (!trackFirsts) assets.push(Kits.UpgradeSchemes[b].upgradeSteps[0].buildingId);
			}
			return trackFirsts ? [assets,firsts] : assets;
		}

		for ([id,chain] of Object.entries(FH.Main.BuildingChains)){
			let c={};
			c.name = id.split("_").map(x=>x.charAt(0).toUpperCase() + x.slice(1)).join("_");
			c.assets = reduceList(chain.cityEntityIds);
			//find firsts:
			let potFirsts = Object.values(FH.Main.CityEntities).filter(
					b => (b?.abilities?.filter(x => (x.__class__ == "ChainStartAbility" && x.chainId == id))?.length > 0 || 
					(b?.components?.AllAge?.chain?.config?.__class__ == "ChainStartConfig" &&
						b?.components?.AllAge?.chain?.chainId == id))
				).map(b=>b.id)
			
			let firsts = reduceList(potFirsts);
			c.buildings = firsts.map(x=>({"first":x}));
			out.push(c);
		}
		
		out.push({"groupname":"Sets"});
		for ([id,set] of Object.entries(FH.Main.BuildingSets)) {
			let s = {}
			s.name = id.split("_").map(x=>x.charAt(0).toUpperCase() + x.slice(1)).join("_")+"_Set";
			let [assets,firsts] = reduceList(set.cityEntityIds,true);
			s.buildings = firsts.map(x=>({"first": x}));
			s.assets = assets;
			out.push(s);
		}
		Kits.KitsjSON = out;
	},


	/**
	 * Creates the {@link FH.HTML.Box box} with displayed sets.
	 */
	BuildBox: ()=> {

		if (!Kits.KitsjSON) Kits.init();

		if ( $('#kits').length === 0 ) {

			FH.HTML.AddCssFile('kits');

			FH.HTML.Box({
				id: 'kits',
				title: FH.t('Menu.Kits.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true
			});

			$('#kitsBody').append(
				$('<div />').attr('id', 'kitsBodyTopbar'),
				$('<div />').attr('id', 'kitsBodyInner'),
				$('<div />').attr('id', 'kitsBodyBottombar')
			);

			$('#kitsBodyTopbar').append(
				$('<label />').attr({
					class: 'game-cursor'
				}).text(FH.t('Boxes.Kits.FilterSets') + ':\xA0').append(
					$('<input />').attr({
						class: 'game-cursor',
						type: 'text',
						'data-type': 'filter-sets-text',
						placeholder: 'e.g. sent||cherry||winter'
					}).on('change', Kits._filter)
				)
			).append(
				$('<label />').attr({class: 'game-cursor'}).text(FH.t('Boxes.General.FilterItems') + ':\xA0').append(
					$('<input />').attr({
						class: 'game-cursor',
						type: 'text',
						'data-type': 'filter-items-text',
						placeholder: 'e.g. car||field'
					}).on('change', Kits._filter)
				)
			);

			$('#kitsBodyBottombar').append(
				$('<span />').attr({
					id: 'kits-triplestate-button',
					class: 'btn btn-slim',
					onclick: 'Kits.ToggleView()'
				}).text(FH.t('Boxes.Kits.TripleStateButton'+Kits.ShowMissing))
			);
			$('#kitsBodyBottombar').append(
				$('<span />').attr({
					id: 'kits-showFavourites',
					class: 'btn btn-slim',
					onclick: 'Kits.ToggleFavouritesBtn()'
				}).text(FH.t('Boxes.Kits.ShowFavourites'))
			);
		}
		else {
			FH.HTML.CloseOpenBox('kits');
		}

		Kits.ReadSets();
		Kits._filterMissing();
	},

	/**
	 * Refresh the Box
	 */
	UpdateBoxIfVisible: ()=> {
		if ($('#kits').length !== 0) {
			Kits.ReadSets();
			Kits._filter();
		}
	},


	/**
	 * Creates all displayed set elements.
	 */
	ReadSets: ()=> {
		let inv = Kits.GetInventoryArray(),
			entities = FH.Main.CityEntities,
			kits = Kits.KitsjSON;

		let t = '<div class="foe-table">';
		if (!Kits.fragmentURL) Kits.fragmentURL = srcLinks.get("/shared/icons/icon_tooltip_fragment.png",true)

		let selectionKits = {};

		for (let k in FH.Main.SelectionKits) {
			if (!FH.Main.SelectionKits.hasOwnProperty(k)) continue;
			const options = FH.Main.SelectionKits[k].options || FH.Main.SelectionKits[k].eraOptions.BronzeAge.options;
			for (let o of options) {
				if (!["BuildingItemPayload", "UpgradeKitPayload"].includes(o.item.__class__)) continue;
				let id = o.item.upgradeItemId || o.item.selectionKitId || o.item.cityEntityId;
				if (!selectionKits[id]) selectionKits[id] = [];
				selectionKits[id].push(k);
			}
		}

		let addItems = (set, idx) => {
			for (let r of set) {
				if (r.type === "set") {
					addItems(r.rewards, idx);
				} else if (r.subType === "selection_kit") {
					const options = FH.Main.SelectionKits[r.id].options || FH.Main.SelectionKits[r.id].eraOptions.BronzeAge.options;
					for (let o of options) {
						if (!["BuildingItemPayload", "UpgradeKitPayload"].includes(o.item.__class__)) continue;
						let id = o.item.upgradeItemId || o.item.selectionKitId || o.item.cityEntityId;
						if (!selectionKits[id]) selectionKits[id] = [];
						selectionKits[id].push(idx);
					}
				} else {
					let reward = r.id;
					if (r.type === "building") {
						reward = r.subType;
					}
					if (!selectionKits[reward]) selectionKits[reward] = [];
					selectionKits[reward].push(idx);
				}
			}
		}
		for (let k in FH.Main.Inventory) {
			if (! FH.Main.Inventory.hasOwnProperty(k)) continue
			if (FH.Main.Inventory[k]?.item?.reward?.type==="set") {
				addItems(FH.Main.Inventory[k].item.reward.rewards,FH.Main.Inventory[k].item.reward.id)
			}

		}

		Kits.upgradeKits = {}

		for (let u of Object.values(FH.Main.BuildingUpgrades||Kits.upgradeItems)) {
			let upgradeList = [u.upgradeItem.id];
			let buildingList=[];
			let sK=[]
			let us = u.upgradeItem.id.split("_")
			let upgradeType = us.includes("gold") ? "golden" : us.includes("silver") ? "silver" : us.includes("ascended") ? "ascended" : us[0];	
			let upgradeCount=JSON.parse(`{"${upgradeType}":${u.upgradeSteps.length-1}}`)
			for (let step of u.upgradeSteps) {
				if (!step) continue
				for (b of step.buildingIds) {
					buildingList.push(b)
					if (Kits.upgradeKits[b]) {
						buildingList = [...buildingList,...Kits.upgradeKits[b].buildingList];
						upgradeList = [...upgradeList,...Kits.upgradeKits[b].upgradeList];
						upgradeCount = {...upgradeCount,...Kits.upgradeKits[b].upgradeCount};
						delete Kits.upgradeKits[b]						
					}
					if (selectionKits[b]) sK.push(...selectionKits[b])
				}
			}
			for (let b of u.upgradeSteps[0].buildingIds) {
				if (sK.length>0) selectionKits[b] = Array.from(new Set([...sK,...(selectionKits[b]||[])]))
				let i = Object.keys(Kits.upgradeKits)[Object.values(Kits.upgradeKits).findIndex(x=>x.buildingList.includes(b))]
				if (i) {
					Kits.upgradeKits[i].buildingList = [...Kits.upgradeKits[i].buildingList,...buildingList];
					Kits.upgradeKits[i].upgradeList = [...Kits.upgradeKits[i].upgradeList,...upgradeList];
					Kits.upgradeKits[i].upgradeCount = {...Kits.upgradeKits[i].upgradeCount,...upgradeCount};
				} else {				
					Kits.upgradeKits[b] = {upgradeList:upgradeList,buildingList:buildingList,upgradeCount:upgradeCount};
				}
			}
		}

		for (let k in kits) {
			if (kits[k].kit) {
				if (!Array.isArray(kits[k].kit)) kits[k].kit = [kits[k].kit]
				continue;
			}
			let s = [];
			if (kits[k].buildings) {
				for (let b in kits[k].buildings) {
					if (!kits[k].buildings.hasOwnProperty(b)) continue;
					if (kits[k].buildings[b].first && Kits.upgradeKits?.[kits[k].buildings[b].first]?.upgradeList) {
						Kits.upgradeKits[kits[k].buildings[b].first]?.upgradeList.forEach(x => kits[k].buildings[b][x]=x);
					}
					for (let i of Object.values(kits[k].buildings[b])) {
						s.push(...(selectionKits[i] || []));
					}
				}
			}
			kits[k].kit = Array.from(new Set(s));
			s = [];
			if (kits[k].assets) {
				for (let b of kits[k].assets) {
					for (let i of selectionKits[b] || []) {	
						s.push(i);
					}
				}
				kits[k].assetKits = Array.from(new Set(s));
			}
		}

		let create = (type, id, showMissing = true) => {
			return {
				type: type,
				item: inv[id] || (type === "first" ? entities[id] : (type === "asset" ? entities[id] : id)),
				fragments: inv["fragment#" + id]?.inStock,
				reqFragments: inv["fragment#" + id]?.required,
				missing: ((inv[id]?.inStock || 0) < 1) && (((inv["fragment#" + id]?.inStock) || 0) < 1),
				showMissing: showMissing
			};
		}
		
		// Sets durchsteppen
		for (let set in kits) {

			if (!kits.hasOwnProperty(set)) {
				break;
			}

			/** @type {SetItem[][]} */
			let buildings = [],
				/** @type {SetItem[][]} */
				assetRow = [],
				/** @type {SetItem[]} */
				kitRow = [],
				show = false,
				showB = false,
				showA = false,
				showK = false;

			// step buildings in a set
			for (let i in kits[set].buildings) {

				if (!kits[set].buildings.hasOwnProperty(i)) {
					break;
				}

				const building = kits[set].buildings[i];

				/** @type {SetItem[]} */
				let itemRow = [];

				// Level 1

				if (building.first) {
					let l = itemRow.push(create('first',building.first));
					if (!itemRow[l-1].missing) showB = true; 
					if (Kits.upgradeKits[building.first]) {
						for (let b of Kits.upgradeKits[building.first].buildingList) {
							let l = itemRow.push(create('first',b,false));
							if (!itemRow[l-1].missing) showB = true; 				
						}
					}
				}

				for (let i in building) {
					if (!building.hasOwnProperty(i)) continue;
					if (i==="first")	continue;
					let l = itemRow.push(create('update',building[i]));
					if (!itemRow[l-1].missing) showB = true; 
				}

				buildings.push(itemRow)
			}

			// Building has asset buildings?
			if (kits[set].assets) {
				for (let a of kits[set].assets) {
					let l = assetRow.push(create('asset',a));
					if (!assetRow[l-1].missing) showA = true;
					if (Kits.upgradeKits[a]) {
						for (let b of Kits.upgradeKits[a].buildingList) {
							let l = assetRow.push(create('asset',b,false));
							if (!assetRow[l-1].missing) showA = true; 				
						}
					} 
				}
			}
			if (kits[set].assetKits) {
				for (let a of kits[set].assetKits) {
					let l = assetRow.push(create('kit',a));
					if (!assetRow[l-1].missing) showA = true;
				}
			}

			// selection kit exist?
			if (kits[set].kit) {
				for (let a of kits[set].kit) {
					let l = kitRow.push(create('kit',a));
					if (!kitRow[l-1].missing) showK = true; 
				}
			}
			show = showB || showA || showK;

			const Name = kits[set].name,
				GroupName = kits[set].groupname;

			let ChainSetIco = '';
			let favourite = "";
			let favClass = "";
			let KitText = '';
			
			if (Name) { // Name is set
				favourite = `<span class="FavStar" data-name="${Name}" onclick="Kits.toggleFavourite(event)" style="background-image:url('${Kits.favourites.includes(Name)? srcLinks.get("/shared/gui/guild_meta_layer/guild_meta_layer_recommend_star_fill.png",true) : srcLinks.get("/shared/gui/guild_meta_layer/guild_meta_layer_recommend_star_empty.png",true)}')"></span>`
				favClass = Kits.favourites.includes(Name) ? "":" notFavourite";
				let sName = Name.toLowerCase().replace(/_set/g, '');

				
				if (Name === 'Kits') {
					KitText = FH.t('Boxes.Kits.Kits');
				}
				else if (Name === 'Guard_Post') {
					KitText = FH.Main.SelectionKits.selection_kit_guard_post.name;
				}
				else if (Name === 'Winterdeco_Set') {
					KitText = FH.Main.SelectionKits.selection_kit_winter_deco.name;
				}
				else if (FH.Main.BuildingChains[sName]) {
					KitText = FH.Main.BuildingChains[sName].name;
					ChainSetIco = '<img src="' + srcLinks.get('/shared/icons/' + sName + '.png', true) + '" class="chain-set-ico">';
				}
				else if (FH.Main.BuildingSets[sName]) {
					KitText = FH.Main.BuildingSets[sName].name;
					ChainSetIco = '<img src="' + srcLinks.get('/shared/icons/' + sName + '.png', true) + '" class="chain-set-ico">';
				}
				else if (FH.Main.CityEntities[kits[set].buildings[0].first]) {
					let itemName = FH.Main.CityEntities[kits[set].buildings[0].first].name;
					let idx = itemName.indexOf(' - ', 0);

					if (idx === -1) {
						idx = itemName.indexOf(' – ', 0); // looks the same but it isn't ¯\_(ツ)_/¯
					}

					if (idx === -1) {
						KitText = itemName;
					}
					else {
						KitText = itemName.substring(0, idx);
					}
				}
				else {
					KitText = Name.replace(/_/g, ' '); //Upcoming => Fallback to Name
				}

				let Link = Name.includes("Set") ? Name : "Building_Chains";
				KitText = FH.Main.GetBuildingLink(Link, KitText);
			}
			else if (GroupName) { // Group is set
				let Key = 'Boxes.Kits.' + GroupName,
					Translation = FH.t(Key);

				if (Key === Translation) Translation = GroupName.replace(/_/g, ' '); //No translation => Fallback to GroupName

				KitText = Translation;
				show = true;
				if (GroupName !== 'Events')
					t += '</div>'
				t += `<div class="group"><h1 class="grouphead" onclick="Kits.toggleGroup(event)">` + KitText + '</h1>'
			}
			else { // No name and group set => Show udate
				KitText = FH.t('Boxes.Kits.Udate') + kits[set].udate;
				show = true;
			}
			//let upgradeOrder=["upgrade","silver","golden","platinum","ascended"];
			let upgrades = "";
			let eff=""
			if (kits[set].buildings?.[0]?.first && FH.Main.CityEntities[kits[set].buildings[0].first]) {
				let f=Kits.upgradeKits?.[kits[set].buildings[0].first]
				let upgradeCount = f?.upgradeCount;
				if (upgradeCount) {
					upgrades = '<span class="upgrades" data-original-title="'+FH.t('Boxes.Kits.Upgrades')+'" data-toggle="tooltip">'
					let first = true
					//for (let i of upgradeOrder) {
					for (let i in upgradeCount) {
						if (!upgradeCount[i]) continue
						upgrades += (first ? '<span class="base">1</span>' : "") + `<span class="${i}">${upgradeCount[i]}</span>` //title="'+FH.t('Boxes.Kits.Base')+'"
						first = false;
					}
					upgrades+= '</span>'
				}
				if (f?.buildingList) {
					let rating=Productions.rateBuildings([kits[set].buildings[0].first,...f?.buildingList]?.slice(-3),true)
					let title=""
					if (!rating) break
					for (r of rating) {
						if (title === "") {
							title = `${r.building?.name||r.name}: ${Math.round(100 * r.rating.totalScore)}`
						}else {
							title =`${r.building?.name||r.name}: ${Math.round(100 * r.rating.totalScore)}<br>`+title
						}
					}
					let top=rating.pop()
					eff = `<span class="kitsEff" data-original-title="${title}">${FH.t('Boxes.Kits.Efficiency')}: `
					eff += Math.round(100 * top?.rating.totalScore||0);
					eff+= '</span>'
				}
			}

			if (!GroupName) {
				t += '<div class="item-row'+ (!show ? " all-missing" : "") + favClass + '">'
				t += `<h2 class="head sticky">` + favourite + ChainSetIco +' '+ KitText + (ChainSetIco !== "" ? "": eff) + upgrades + '</h2>'
			}
			if(buildings.length) {
				buildings.forEach((building) => {
					let rowTd = ''
					building.forEach((e)=> {
						rowTd += Kits.ItemDiv(e);
					});
					t += rowTd
				})
			}

			// Kit listing
			if (kitRow.length) {
				let rowTd = ''

				kitRow.forEach((e)=> {
					rowTd += Kits.ItemDiv(e);
				});

				t += rowTd
			}

			// Asset listing
			if (assetRow.length) {
				t += `<h3 class="assets-header ${!show ? "all-missing" : (!showA ? "row-missing" : "")}">${FH.t('Boxes.Kits.Extensions')}</h3>`;
				let rowTd = ''
				assetRow.forEach((e)=> {
					rowTd += Kits.ItemDiv(e);

				});

				t += `<div class="item-row  ${!show ? "all-missing" : (!showA ? "row-missing" : "")}">` + rowTd + '</div>';
			}
			if (!GroupName)
				t += '</div>';
		}

		t += '</div>';

		$('#kitsBodyInner').html(t);
		$('#kitsBodyInner [data-original-title]').tooltip({
			html: true,
			container: '#kits'
		});
	},


	/**
	 * Creates a `div` for any item.
	 * @param {SetItem} el
	 * @returns {string} FH.HTML.string of the `div` element.
	 */
	ItemDiv: (el)=> {

		if (!el?.item) return '';
		if (el.missing && !el.showMissing) return '';
		let item = el.item,
			aName = item.itemAssetName || item.asset_id || (FH.Main.BuildingUpgrades||Kits.upgradeItems)[item]?.upgradeItem?.iconAssetName || Kits.specialCases[item] || item,
			url = '/shared/icons/reward_icons/reward_icon_' + aName + '.png',
			title = '';

		try {
			if (el.type === "first" || el.type === "asset") {
				url = '/city/buildings/' + [aName.slice(0, 1), '_SS', aName.slice(1)].join('') + '.png';
			}
		} 
		catch (error) {
			console.error('Error processing element in ItemDiv:', error.message, { element: el, assetName: aName });
		}

		url = srcLinks.get(url,true)

		title = item.name;

		if (!title ) {
			if (el.type === 'update') {
				title = Kits.Names[item] || FH.t('Boxes.Kits.UpgradeKit');
			}
			else if (el.type === 'kit') {
				title = Kits.Names[item] || FH.t('Boxes.Kits.SelectionKit');
			}
		}

		return 	`<div class="item${((el.missing) ? ' is-missing' : '')}">
					<div class="image"><img loading="lazy" src="${url}" alt="${title}" /></div>
					<strong class="in-stock" data-original-title="${FH.t('Boxes.Kits.InStock')}">${(item.inStock ? item.inStock : '-')}</strong>
					<span>${title}</span>
					<span class="fragments">${(el.fragments ? `<img class="ItemFragment" src="${Kits.fragmentURL}"> ` + el.fragments + '/' + el.reqFragments : '')}</span>
				</div>`;
	},


	/**
	 * Returns {@link FH.Main.Inventory} as array.
	 * @returns {any[]}
	 */
	GetInventoryArray: ()=> {
		let Ret = {}
		for (let i in FH.Main.Inventory) {
			if (!FH.Main.Inventory.hasOwnProperty(i)) continue;
			let x = FH.Main.Inventory[i]
			let amount = x.inStock;
			let required = null;
			let id = x.item.upgradeItemId||x.item.selectionKitId||x.item.cityEntityId||x.itemAssetName;
			let asset= x.itemAssetName;
			let name = x.name;
			if (x.item.__class__ === "BuildingItemPayload") {
				asset=FH.Main.CityEntities[id].asset_id;
			}
			if (x.item.__class__ === "FragmentItemPayload") {
				id =  "fragment#"+ ((x.item.reward.assembledReward.type === "building") ? 
										(x.item.reward.assembledReward.subType) : 
										(x.item.reward.assembledReward.id||x.item.reward.assembledReward.iconAssetName));
				amount = x.inStock*x.item.reward.amount;
				required = x.item.reward.requiredAmount;
				asset = x.item.reward.assembledReward.iconAssetName;
				name = x.item.reward.assembledReward.name;
			}
			if (x?.item?.reward?.type === "set") {
				id = x.item.reward.id;
				asset = x.item.reward.iconAssetName;
			}
			if (!Ret[id]) {
				Ret[id] = {id:id,name:name,inStock:amount,required:required,itemAssetName:asset}
			} else {
				Ret[id].inStock += amount
			}
		}
		return Ret;
    },


	toggleFavourite:(e) => {
		let name = e.target.dataset.name
		let index = Kits.favourites.indexOf(name);

		if (index === -1) {
			Kits.favourites.push(name);
		} else {
			Kits.favourites.splice(index, 1);
		}
		e.target.style = `background-image:url('${Kits.favourites.includes(name)? srcLinks.get("/shared/gui/guild_meta_layer/guild_meta_layer_recommend_star_fill.png",true) : srcLinks.get("/shared/gui/guild_meta_layer/guild_meta_layer_recommend_star_empty.png",true)}')`
		FH.Storage.setItem("Kits.favourites",JSON.stringify(Kits.favourites));
		e.target.parentElement.parentElement.classList.toggle("notFavourite");
	},

	/**
	 * Toggles displaying of owned, missing and all set items.
	 */
	ToggleView: ()=> {
		Kits.ShowMissing = (Kits.ShowMissing + 1) % 3;

		Kits._filter()

		$('#kits-triplestate-button').text(FH.t('Boxes.Kits.TripleStateButton'+Kits.ShowMissing))
	},

	ToggleFavouritesBtn:() => {
		$('#kits-showFavourites')[0].classList.toggle("btn-active");
		Kits._filter()
	},

	toggleGroup: (event)=> {
		// Toggle visibility of items under this group
		const groupElement = event.currentTarget.parentElement;
		const itemRows = groupElement.querySelectorAll('.item-row');

		for (let row of itemRows) {
			row.style.display = row.style.display === 'none' ? '' : 'none';
		}
	},

	_filter:()=>{
		$('#kitsBodyInner .item-row').show()
		$('#kitsBodyInner .item').show()
		Kits._filterSets();
		Kits._filterItems();
		Kits._filterMissing();
		if ($('#kits-showFavourites')[0].classList.contains("btn-active")) $('.notFavourite').hide(); 
	},

	/**
	 * Filters whole sets by name patterns.
	 */

	_filterMissing:()=>{
		if (Kits.ShowMissing === 0) {
			$('.is-missing').hide();
			$('.row-missing').hide();
			$('.all-missing').hide();
		}
		if (Kits.ShowMissing === 1) {
			$('.all-missing').hide();
		}
	},

	_filterSets: () => {
		const filterRegExps = $('#kitsBodyTopbar input[data-type="filter-sets-text"]').val()
			.split('||').filter(it => it.trim().length > 0).map(it => new RegExp(it, 'i'));
		if (filterRegExps && filterRegExps.length >= 1) {
			const allRowHeads = $('#kitsBodyInner .head');
			allRowHeads.each((i, e) => {
				const setHead = $(e);
				if (!filterRegExps.some(it => it.test(setHead.text()))) {
					setHead.parent('.item-row').hide();
				}
			});
		}
	},


	/**
	 * Filters all items by name patterns.
	 */
	_filterItems: () => {
		const filterRegExps = $('#kitsBodyTopbar input[data-type="filter-items-text"]').val()
			.split('||').filter(it => it.trim().length > 0).map(it => new RegExp(it, 'i'));
		if (filterRegExps && filterRegExps.length >= 1) {
			const allRows = $('#kitsBodyInner .item-row');
			allRows.each((i, e) => {
				const row = $(e);
				let visibleItemsCount = 0;
				const itemDivs = row.find('.item');
				if (itemDivs.length > 0) {
					itemDivs.each((i, e) => {
						const item = $(e);
						const show = filterRegExps.some(it => it.test(item.text()) || it.test(item.html()));
						if (show) {
							visibleItemsCount++;
						} else {
							item.hide();
						}
					});
				} 
				if (visibleItemsCount < 1) {
					row.hide();
				}
			});
		}
	},

	UpgradeSchemes:null,
	selectionOptions:null,
	Names:{},
	Assets:{},
	individualBuildingUpgrades:null,
	ascendableBuildings:null,
	ascendItems:null,
	upgradeItems:null,

	CreateUpgradeSchemes: ()=> {
		if (!FH.Main.BuildingUpgrades && !FH.Main.BuildingUpgradePaths) return;
		if (!FH.Main.SelectionKits) return;
		if (!FH.Main.CityEntities) return;

		let sO = {};
		for (let s of Object.values(FH.Main.SelectionKits)) {
			Kits.Names[s.selectionKitId] = s.name;
			for (let c of s.options || s.eraOptions[FH.CurrentEra].options) {
				id = (c.item.cityEntityId||c.item.upgradeItemId);
				if (!id)
					continue;
				if (!sO[id]) {
					sO[id] = [s.selectionKitId];
				} else {
					sO[id].push(s.selectionKitId);
				}
			}			
		}
		Kits.selectionOptions = sO;
		
		let endBuildings = {};
		if (FH.Main.BuildingUpgradePaths) { //NEW!!!
			let individualBuildingUpgrades = Object.values(FH.Main.BuildingUpgradePaths).map(x=>x.upgradeSteps).flat();
			Kits.ascendableBuildings = Object.assign({},...individualBuildingUpgrades.filter(x=>FH.Main.CityEntities[x.toBuildingId]?.components?.AllAge?.limited).map(x=>({[x.fromBuildingId]:x.toBuildingId})));
			Kits.upgradeItems = Object.assign({},
				...Object.values(FH.Main.BuildingUpgradePaths)
				.map(x=>
					Object.assign({},
						...Object.entries(x.upgradeItems)
						.map(([id, item])=>({[id]:{upgradeItem:item,upgradeSteps:[]}}))
					)
				)
			);

			individualBuildingUpgrades.forEach(x=>{
				let  id = x.upgradeItemId;
				let i = (x.stepIndex||0)+1;
				if (!Kits.upgradeItems[id].upgradeSteps[0]) {
					Kits.upgradeItems[id].upgradeSteps[0] = {buildingIds: [x.fromBuildingId]};
				}
				if (!Kits.upgradeItems[id].upgradeSteps[i+1]) {
					Kits.upgradeItems[id].upgradeSteps[i+1] = {buildingIds: []};
				}
				Kits.upgradeItems[id].upgradeSteps[i+1].buildingIds.push(x.toBuildingId);
			});

			Kits.individualBuildingUpgrades = Object.assign({},...individualBuildingUpgrades.map(x=>({[x.fromBuildingId]:x})))


			for (let startbuilding of Object.values(FH.Main.BuildingUpgradePaths)) {
				let schemes = {};
				let steps = structuredClone(startbuilding.upgradeSteps);
				steps.sort((a,b)=>(a.stepIndex || 0)  - (b.stepIndex||0));
				for (let step of steps) {
					if (!schemes[step.fromBuildingId]) {
						schemes[step.toBuildingId] = [{buildingId: step.fromBuildingId, upgradeId: step.upgradeItemId}];
					} else {
						schemes[step.toBuildingId] = [...schemes[step.fromBuildingId], {buildingId: step.toBuildingId, upgradeId: step.upgradeItemId}];	
					}
				}
				lower = Array.from(new Set(Object.values(schemes).flat()))
				for (let endbuilding of Object.keys(schemes)) {
					if (!lower.includes(endbuilding)) {
						endBuildings[endbuilding] = schemes[endbuilding];
					}
				}
			}
			
		} else {

			let startBuildings = {};
			let potentialForks = {};
			for (let upgrade of Object.values(FH.Main.BuildingUpgrades)) {
				if (["silver_upgrade_kit_BOWL22A"].includes(upgrade.upgradeItem.id)) continue; // faulty game data

				Kits.Names[upgrade.upgradeItem.id] = upgrade.upgradeItem.name;
				let upgradeId= upgrade.upgradeItem.id;
				let buildingList = upgrade.upgradeSteps.map(x => x.buildingIds);
				let finalBuildings = buildingList.pop();
				buildingList = buildingList.flat().map(x => ({buildingId: x, upgradeId: upgradeId}));
				
				let buffer=buildingList[0].buildingId;
				if (endBuildings[buffer]) {
					
					buildingList.unshift(...endBuildings[buffer]);
					potentialForks[buffer] = structuredClone(endBuildings[buffer]);
					delete endBuildings[buffer];
					delete startBuildings[buffer];
				} else if (potentialForks[buffer]) {
					buildingList.unshift(...potentialForks[buffer]);
				}
				for (let endBuilding of finalBuildings) {
					if (startBuildings[endBuilding]) {
						endBuildings[startBuildings[endBuilding]].unshift(...buildingList);
						startBuildings[buffer] = startBuildings[endBuilding];
						delete startBuildings[endBuilding];
					}
					else {
						startBuildings[buffer] = endBuilding;
						endBuildings[endBuilding] = buildingList;
					} 
				}
			}
		}
		
		
		let schemes={};
		let allBuildingsUpgradeCounts = {};

		for (let [endBuilding,buildingList] of Object.entries(endBuildings)) {
			let upgrades={}
			let upgradeCount = {}

			for (b of buildingList) {

				if (!upgrades[b.upgradeId]) {
					upgrades[b.upgradeId] = 1
				} else {
					upgrades[b.upgradeId]++
				}

				allBuildingsUpgradeCounts[b.buildingId] = structuredClone(upgradeCount)

				let us=b.upgradeId.split("_")
				let upgradeType = us.includes("gold") ? "golden" : us.includes("silver") ? "silver" : us.includes("ascended") ? "ascended" : us[0];	

				if (!upgradeCount[upgradeType])
					upgradeCount[upgradeType] = 0
				upgradeCount[upgradeType] ++
			}
			allBuildingsUpgradeCounts[endBuilding] = structuredClone(upgradeCount)
			schemes[endBuilding] = {
				upgrades: upgrades,
				upgradeSteps: buildingList
			}	
		}
		Kits.allBuildingsUpgradeCounts = allBuildingsUpgradeCounts
		Kits.UpgradeSchemes = schemes
	},


	BuildingsFromInventory: (ascendedBuildingIds = null) =>{
		let output = {}
		let upgradeBuildings = Object.keys(Kits.UpgradeSchemes);
		upgradeBuildings.push(...(Object.values(Kits.UpgradeSchemes)).map(x => x.upgradeSteps.map(y => y.buildingId)).flat());
		//Flatten Inventory
		let Inventory = {}
		let InventoryAdd = (id,amount) => {
			if (amount === 0) return
			Inventory[id] = (Inventory[id] || 0) + amount;
			if (id.substring(1,2)=="_" && !upgradeBuildings.includes(id)) {
				if (output[id]) {
					output[id].chains[0].count += amount
					output[id].amount += amount
				} else
					output[id] = {building:"inInventory", amount:amount, chains:[{chain:[{type:"building",id:id,from:"inventory",count:1}],count:amount}]};
			}
		}
		let InventoryAddSet = (rewards, amount) => {
			for (let r of rewards) {
				if (r.type === "building") {
					InventoryAdd(r.subType, amount * r.amount)
				} else if (r.subType === "upgrade_kit") {
					InventoryAdd(r.id, amount * r.amount)
				} else if (r.subType === "selection_kit") {
					InventoryAdd(r.id, amount * r.amount)
				} else if (r.type === "set") {
					InventoryAddSet(r.rewards, amount * r.amount)
				}
			}
		}
		for (let i of Object.values(FH.Main.Inventory)) {
			if (i.itemAssetName === "icon_fragment") {
				if (i.item.reward.assembledReward.subType==="selection_kit") {
					InventoryAdd(i.item.reward.assembledReward.id, Math.floor(i.inStock/i.item.reward.requiredAmount))
					if (i.item.reward.assembledReward.iconAssetName != i.item.reward.assembledReward.id)
						 Kits.specialCases[i.item.reward.assembledReward.id]=i.item.reward.assembledReward.iconAssetName
				}
				if (i.item.reward.assembledReward.subType=="upgrade_kit") {
					InventoryAdd(i.item.reward.assembledReward.id, Math.floor(i.inStock/i.item.reward.requiredAmount))
					if (i.item.reward.assembledReward.iconAssetName != i.item.reward.assembledReward.id) 
						 Kits.specialCases[i.item.reward.assembledReward.id]=i.item.reward.assembledReward.iconAssetName
				}
				if (i.item.reward.assembledReward.type=="building") {
					InventoryAdd(i.item.reward.assembledReward.subType, Math.floor(i.inStock/i.item.reward.requiredAmount))
				}
			} else if (i.item.selectionKitId) {
				InventoryAdd(i.item.selectionKitId, i.inStock)
				if (i.itemAssetName != i.item.selectionKitId)
					Kits.specialCases[i.item.selectionKitId]=i.itemAssetName
			} else if (i.item.cityEntityId) {
				InventoryAdd(i.item.cityEntityId, i.inStock)
			} else if (i.item.upgradeItemId) {
				InventoryAdd(i.item.upgradeItemId, i.inStock)
				if (i.itemAssetName != i.item.upgradeItemId)
					Kits.specialCases[i.item.upgradeItemId]=i.itemAssetName
			} else if (i.item?.reward?.type === "set") { //check if this works when there is a league reward with nested sets
				InventoryAddSet(i.item.reward.rewards,i.inStock)
			}
		}
		//flatten CityBuildings
		cityBuildings = {}
		Object.values(FH.Main.CityMapData).forEach(x=>cityBuildings[x.cityentity_id]=(cityBuildings[x.cityentity_id] || 0)+1);
		//check non-upgrade scheme selection kit items 
		if (!ascendedBuildingIds) {
			for (let [id,kits] of Object.entries(Kits.selectionOptions)) {
				if (id.substring(1,2)=="_" && !upgradeBuildings.includes(id)) {
					for (let kit of kits) {
						if (!Inventory[kit]) continue
						if (output[id]) {
							output[id].kitsUsed = (output[id].kitsUsed||0) + Inventory[kit];
							output[id].amount = (output[id].amount||0) + Inventory[kit];
							output[id].chains.push({chain:[{type:"selectionKit",id:kit,from:"inventory",count:1}],count:Inventory[kit]});
						} else 
							output[id] = {kitsUsed:Inventory[kit],amount:Inventory[kit],chains:[{chain:[{type:"selectionKit",id:kit,from:"inventory",count:1}],count:Inventory[kit]}]};
					}
				}
			}
		}
		// check each scheme
		let schemeEntries = ascendedBuildingIds
			? Object.entries(Kits.UpgradeSchemes).filter(([id]) => ascendedBuildingIds.includes(id))
			: Object.entries(Kits.UpgradeSchemes);
		for (let [buildingId, scheme] of schemeEntries) {
			let ignoreAscended = false
			do { //repeat for non-ascended version if ascended version is found
				let upgradeSteps = scheme.upgradeSteps;
				let upgrades = scheme.upgrades;
				let maxLevel = 0;
				let amount = 0
				let buildingsFromCity = 0;
				let buildingsFromInventory = 0;
				let kitCount = 0;
				let ascended = false;
				let chains = []
				let level
				let maxBuilding = buildingId
				if (ignoreAscended) buildingId = upgradeSteps[upgradeSteps.length-1].buildingId

				// determine selectionKit values
				let items = Object.keys(upgrades)
				items.push(...upgradeSteps.map(x => x.buildingId),buildingId)

				let SKs = Array.from(new Set(items.map(x => Kits.selectionOptions[x] || []).flat()))
				let sKvalues = Object.assign({},...SKs.map(x=>({[x]:0})));
				let upgradesIndexed = Object.keys(upgrades)
				for (let sk of SKs) {
					for (let o of FH.Main.SelectionKits[sk].options) {
						let i = upgradesIndexed.indexOf(o.item.cityEntityId||o.item.upgradeItemId||"test")
						if (i > -1)
							sKvalues[sk] += Math.pow(2,i)
						else	
							sKvalues[sk] += 0.01
					}
				}
				//duplicate and sort selectionOptions & duplicate cityBuildings
				let SO = {}
				let city = {}
				for (let i of items) {
					if  (Kits.selectionOptions[i])
						SO[i] = Kits.selectionOptions[i].sort((a,b) => sKvalues[a] - sKvalues[b]) 	
					if (cityBuildings[i]) {
						city[i] = cityBuildings[i]
					}
				}
				//duplicate Inventory 
				let Inv = {}
				items.push(...SKs)
				for (let item of items) {
					if (Inventory[item]) {
						Inv[item] = Inventory[item]
					}
				}		

				//max Building already in Inventory (directly or via selection kit)
				if (Inv[buildingId]) {
					amount += Inv[buildingId];
					buildingsFromInventory += Inv[buildingId];
					for (let i = 0; i < Inv[buildingId]; i++) {
						chains.push([{type:"building", from:"inventory", id:buildingId}]);
					}
					maxLevel = upgradeSteps.length - (ignoreAscended ? 1 : 0);
					if (Object.keys(upgrades).join("").includes("ascended") && !ignoreAscended)
						ascended = true
				}
				if (Kits.selectionOptions[buildingId]) {
					for (let k of Kits.selectionOptions[buildingId] || []) {
						if (Inv[k]) {
							amount += Inv[k];
							kitCount += Inv[k];
							for (let i = 0; i < Inv[k]; i++) {
								chains.push([{type:"building", from:"selectionKit", id:k}]);
							}
							maxLevel = upgradeSteps.length - (ignoreAscended ? 1 : 0);
							if (Object.keys(upgrades).join("").includes("ascended") && !ignoreAscended)
								ascended = true
						}
					}
				}
				//assemble buildings from kits
				while (true) {
					let chain=[]
					level = upgradeSteps.length - (ignoreAscended ? 2 : 1)
					for (level; level>=0; level--) {
						let b = upgradeSteps[level].buildingId;
						if (city[b]) {
							buildingsFromCity++
							city[b]--
							chain.push({type:"building",from:"city",id:b})
							break
						}
						if (Inv[b]) {
							buildingsFromInventory++
							Inv[b]--
							chain.push({type:"building",from:"inventory",id:b})
							break
						}
						if (SO[b]) {
							let check = false
							for (let k of SO[b]) {
								if (Inv[k]) {
									Inv[k]--
									kitCount++;
									check = true
									chain.push({type:"building",from:"selectionKit",id:k})
									break
								}
							}
							if (check) break
						}
					}
					if (level>=0) {
						for (level;level<upgradeSteps.length; level++) {
							let upgrade = upgradeSteps[level].upgradeId;
							if (Inv[upgrade]) {
								if (upgrade.includes("ascended")) {
									if (ignoreAscended)	break
									ascended = true
								}
								Inv[upgrade]--;
								kitCount++;
								chain.push({type:"upgrade",from:"inventory",id:upgrade})
								continue
							}
							let check = false
							for (let k of SO[upgrade]||[]) {
								if (Inv[k]) {
									if (upgrade.includes("ascended")){
										if (ignoreAscended)	break
										ascended = true
									}
									Inv[k]--
									kitCount++
									chain.push({type:"upgrade",from:"selectionKit",id:k})
									check = true
									break
								}
							}
							if (check) continue
							break
						}
						if (level<=upgradeSteps.length && maxLevel === 0 && kitCount+buildingsFromInventory>0) {
							if (level<upgradeSteps.length) buildingId = upgradeSteps[level].buildingId
							maxLevel = level;
						}
					}
					if (level < maxLevel)
						break
					if (level === maxLevel) {
						amount++
						chains.push(chain)
					}				
				} 
				if (amount > 0 && (buildingsFromInventory > 0 || kitCount > 0)) {
					//flatten chains
					let flatChains = {}
					for (let chain of chains) {
						let compressed=[]
						for (let element of chain) {
							if (element.id === compressed[compressed.length-1]?.id||"") {
								compressed[compressed.length-1].count++;
							} else {
								compressed.push({id:element.id,type:element.type,from:element.from,count:1})
							}
						}
						let chainId = JSON.stringify(compressed)
						if (!flatChains[chainId]) {
							flatChains[chainId] = {chain:compressed,count:1};
						} else {
							flatChains[chainId].count++;
						}
					}
					let upgradeCount={}
					for (let [u,a] of Object.entries(upgrades)) {
						let us=u.split("_")
						upgradeType = us.includes("gold") ? "golden" : us.includes("silver") ? "silver" : us.includes("ascended") ? "ascended" : us[0];	
						if (!upgradeCount[upgradeType])
							upgradeCount[upgradeType] = {}
						upgradeCount[upgradeType].is = (upgradeCount[upgradeType].is||0) + Math.min(a, maxLevel)
						upgradeCount[upgradeType].max = (upgradeCount[upgradeType].max||0) + a

						maxLevel -= Math.min(a, maxLevel)
					}
					output[buildingId] = {
						kitsUsed:kitCount,
						includesAscended: ascended,
						buildingsFromCity: buildingsFromCity,
						buildingsFromInventory:buildingsFromInventory,
						amount: amount,
						chains: Object.values(flatChains),
						upgradeCount: upgradeCount,
						maxBuilding: maxBuilding
					}
					if (ascended) {
						let ascendedKit = Object.keys(upgrades).find(x => x.includes("ascended"));
						let ascendedStock = 0
						if (Inventory[ascendedKit]) 
							ascendedStock += Inventory[ascendedKit];
						for (let k of SO[ascendedKit]||[]) 
							if (Inventory[k]) 
								ascendedStock += Inventory[k]
						output[buildingId].ascendedStock = ascendedStock;
						ignoreAscended = true;
					} else {
						ignoreAscended = false
					}
				} else {
					ignoreAscended = false
				}
			} while (ignoreAscended)
		}
		return output;
	},

	UpgradeSpan: (id) => {
		let u = '<span class="upgrades"><span class="base">1</span>';
		let upgradeCount = Kits.allBuildingsUpgradeCounts[id]||{}
		if (Object.keys(upgradeCount).length>0) {
			for (let i in upgradeCount) {
				if (!upgradeCount[i]) continue;
				if (upgradeCount[i]) {
					u += `<span class="${i}">${upgradeCount[i]}</span>`;
				}
			}
		}
		u += '</span>';
		return u;
	},

	InventoryTooltip: (e) => {
        const id = e?.currentTarget?.dataset?.id || e?.currentTarget?.parentElement?.dataset?.id;
		let lng = FH.World.substring(0, 2);
		const mapper = {
			'us': 'en',
			'xs': 'en',
			'zz': 'en',
			'ar': 'es',
			'mx': 'es',
			'no': 'en'
		};
		lng = mapper[lng] || lng;

		const inventoryBuilding = Productions.InventoryBuildings[id];
		if (!inventoryBuilding) return '';

		const upgradeCount = inventoryBuilding.upgradeCount;
		let upgrades = Kits.UpgradeSpan(id);
		let upgradesMax = '<span class="upgrades">';

		if (upgradeCount) {
			for (let i in upgradeCount) {
				if (upgradeCount[i].max - upgradeCount[i].is) {
					upgradesMax += `<span class="${i}">+${upgradeCount[i].max - upgradeCount[i].is}</span>`;
				}
			}
		}
		upgradesMax += '</span>';

		let tooltip = `<div class="inventoryTooltip" lang="${lng}">`;
        tooltip += `<h2>${inventoryBuilding.amount}x ${FH.Main.CityEntities[id]?.name}${upgrades}</h2>`;
		tooltip += `<span style="padding:3px 8px;">${FH.t("Boxes.Tooltip.Efficiency.description")}:</span>`;

		if (inventoryBuilding.includesAscended) {
			tooltip += `<span class="inventoryChainAscendedStock">${inventoryBuilding.ascendedStock}x</span>`;
		}

		tooltip += `<div class="inventoryChains">`;
		for (let chain of inventoryBuilding.chains || []) {
			tooltip += `<div class="inventoryChain">`;
			tooltip += `<span class="inventoryChainCount">${chain.count}x</span>`;

			for (let c of chain.chain) {
				tooltip += `<div class="inventoryChainItem ${c.type} ${c.from}">`;
				tooltip += `<div class="inventoryChainItemImg"><img src="${srcLinks.getReward(Kits.specialCases[c.id] || c.id)}" alt=""></div>`;
				tooltip += `<div class="inventoryChainItemDesc">`;

				if (c.count > 1) {
					tooltip += `<span class="inventoryChainItemCount">${c.count}x</span>`;
				}

				tooltip += `<span>${Kits.Names[c.id] || FH.Main.CityEntities[c.id]?.name}</span>`;
				tooltip += `</div></div>`;
			}
			tooltip += `</div>`;
		}
		tooltip += `</div>`;

		if (upgradesMax !== '<span class="upgrades"></span>') {
			tooltip += `<div class="maxBuilding">`;
			tooltip += `<h2>${FH.t("Boxes.Kits.maxBuilding")}:</h2>`;
			tooltip += `<span class="maxBuildingDetails">${FH.Main.CityEntities[inventoryBuilding.maxBuilding]?.name}${upgradesMax}</span>`;
			tooltip += `</div>`;
		}

		tooltip += `</div>`;
		return tooltip;
	}
};

/**
 * @typedef SetItem
 * @property {string} type 'first', 'update', 'kit' or 'asset'
 * @property {string|object} item
 * @property {boolean} missing
 */
FH.Tooltips.addCallback('InventoryKits', Kits.InventoryTooltip);

/**
FH.Main.BuildingUpgradePaths = {
    "A_MultiAge_MayDayBonus16": {
        "baseBuildingId": "A_MultiAge_MayDayBonus16",
        "containedBuildingIds": [
            "A_MultiAge_MayDayBonus16",
            "A_MultiAge_MayDayBonus17",
            "A_MultiAge_MayDayBonus17b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_maypole"
        ],
        "upgradeItems": {
            "upgrade_kit_maypole": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_maypole",
                "name": "Maypole Upgrade",
                "description": "Upgrades your Maypole to an improved version that will also grant you a coin boost. Upgrade your Maypoles up to two times for an even bigger effect!",
                "iconAssetName": "upgrade_kit_maypole",
                "isHighlighted": true,
                "flags": [
                    "uncommon"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_MayDayBonus16",
                "toBuildingId": "A_MultiAge_MayDayBonus17",
                "upgradeItemId": "upgrade_kit_maypole",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_MayDayBonus17",
                "toBuildingId": "A_MultiAge_MayDayBonus17b",
                "upgradeItemId": "upgrade_kit_maypole",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL16A1": {
        "baseBuildingId": "W_MultiAge_FALL16A1",
        "containedBuildingIds": [
            "W_MultiAge_FALL16A1",
            "W_MultiAge_FALL16A2",
            "W_MultiAge_FALL16A3",
            "W_MultiAge_FALL16A4",
            "W_MultiAge_FALL16A5",
            "W_MultiAge_FALL16A6",
            "W_MultiAge_FALL16A7",
            "W_MultiAge_FALL16A8",
            "W_MultiAge_FALL16A9",
            "W_MultiAge_FALL16A10",
            "W_MultiAge_FALL16A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_cider_mill",
            "upgrade_kit_FALL16A",
            "silver_upgrade_kit_FALL16A",
            "golden_upgrade_kit_FALL16A",
            "platinum_upgrade_kit_FALL16A"
        ],
        "upgradeItems": {
            "upgrade_kit_cider_mill": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_cider_mill",
                "name": "Cider Mill Upgrade",
                "description": "Upgrades your Cider Mill to an improved version that will produce a variety of different resources. Upgrade your Cider Mill up to five times for an even bigger effect!",
                "iconAssetName": "upgrade_kit_cider_mill",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_FALL16A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL16A",
                "name": "Vintage Cider Mill Upgrade Kit",
                "description": "Upgrades your Cider Mill to an improved version!",
                "iconAssetName": "upgrade_kit_FALL16A",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FALL16A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FALL16A",
                "name": "Noble Cider Mill Silver Upgrade Kit",
                "description": "Upgrades your Cider Mill to its third best version!",
                "iconAssetName": "silver_upgrade_kit_FALL16A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FALL16A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FALL16A",
                "name": "Regal Cider Mill Golden Upgrade Kit",
                "description": "Upgrades your Cider Mill to its second best version!",
                "iconAssetName": "golden_upgrade_kit_FALL16A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_FALL16A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_FALL16A",
                "name": "Supreme Cider Mill Platinum Upgrade Kit",
                "description": "Upgrades your Cider Mill to its best version!",
                "iconAssetName": "platinum_upgrade_kit_FALL16A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A1",
                "toBuildingId": "W_MultiAge_FALL16A2",
                "upgradeItemId": "upgrade_kit_cider_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A2",
                "toBuildingId": "W_MultiAge_FALL16A3",
                "upgradeItemId": "upgrade_kit_cider_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A3",
                "toBuildingId": "W_MultiAge_FALL16A4",
                "upgradeItemId": "upgrade_kit_cider_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A4",
                "toBuildingId": "W_MultiAge_FALL16A5",
                "upgradeItemId": "upgrade_kit_cider_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A5",
                "toBuildingId": "W_MultiAge_FALL16A6",
                "upgradeItemId": "upgrade_kit_cider_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A6",
                "toBuildingId": "W_MultiAge_FALL16A7",
                "upgradeItemId": "upgrade_kit_FALL16A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A7",
                "toBuildingId": "W_MultiAge_FALL16A8",
                "upgradeItemId": "upgrade_kit_FALL16A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A8",
                "toBuildingId": "W_MultiAge_FALL16A9",
                "upgradeItemId": "silver_upgrade_kit_FALL16A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A9",
                "toBuildingId": "W_MultiAge_FALL16A10",
                "upgradeItemId": "golden_upgrade_kit_FALL16A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL16A10",
                "toBuildingId": "W_MultiAge_FALL16A11",
                "upgradeItemId": "platinum_upgrade_kit_FALL16A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "A_MultiAge_HalloweenBonus1": {
        "baseBuildingId": "A_MultiAge_HalloweenBonus1",
        "containedBuildingIds": [
            "A_MultiAge_HalloweenBonus1",
            "A_MultiAge_HalloweenBonus2",
            "A_MultiAge_HalloweenBonus3",
            "A_MultiAge_HalloweenBonus15",
            "A_MultiAge_HalloweenBonus16",
            "A_MultiAge_HalloweenBonus17"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_graveyard"
        ],
        "upgradeItems": {
            "upgrade_kit_graveyard": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_graveyard",
                "name": "Graveyard Upgrade",
                "description": "Upgrades your Graveyard to an improved version that will grant more happiness. Upgrade your Graveyard up to five times for an even bigger effect!",
                "iconAssetName": "upgrade_kit_graveyard",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_HalloweenBonus1",
                "toBuildingId": "A_MultiAge_HalloweenBonus2",
                "upgradeItemId": "upgrade_kit_graveyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_HalloweenBonus2",
                "toBuildingId": "A_MultiAge_HalloweenBonus3",
                "upgradeItemId": "upgrade_kit_graveyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_HalloweenBonus3",
                "toBuildingId": "A_MultiAge_HalloweenBonus15",
                "upgradeItemId": "upgrade_kit_graveyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_HalloweenBonus15",
                "toBuildingId": "A_MultiAge_HalloweenBonus16",
                "upgradeItemId": "upgrade_kit_graveyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_HalloweenBonus16",
                "toBuildingId": "A_MultiAge_HalloweenBonus17",
                "upgradeItemId": "upgrade_kit_graveyard",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SportBonus17a": {
        "baseBuildingId": "R_MultiAge_SportBonus17a",
        "containedBuildingIds": [
            "R_MultiAge_SportBonus17a",
            "R_MultiAge_SportBonus17b",
            "R_MultiAge_SportBonus17c",
            "R_MultiAge_SportBonus17d",
            "R_MultiAge_SportBonus17e",
            "R_MultiAge_SportBonus17f",
            "R_MultiAge_SportBonus17g"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_pillar"
        ],
        "upgradeItems": {
            "upgrade_kit_pillar": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_pillar",
                "name": "Pillar of Heroes Upgrade",
                "description": "Upgrades your Pillar of Heroes to an improved version that will produce more resources. Upgrade your Pillar up to six times for an even bigger effect!",
                "iconAssetName": "upgrade_kit_pillar",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus17a",
                "toBuildingId": "R_MultiAge_SportBonus17b",
                "upgradeItemId": "upgrade_kit_pillar",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus17b",
                "toBuildingId": "R_MultiAge_SportBonus17c",
                "upgradeItemId": "upgrade_kit_pillar",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus17c",
                "toBuildingId": "R_MultiAge_SportBonus17d",
                "upgradeItemId": "upgrade_kit_pillar",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus17d",
                "toBuildingId": "R_MultiAge_SportBonus17e",
                "upgradeItemId": "upgrade_kit_pillar",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus17e",
                "toBuildingId": "R_MultiAge_SportBonus17f",
                "upgradeItemId": "upgrade_kit_pillar",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus17f",
                "toBuildingId": "R_MultiAge_SportBonus17g",
                "upgradeItemId": "upgrade_kit_pillar",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CarnivalBonus18a": {
        "baseBuildingId": "R_MultiAge_CarnivalBonus18a",
        "containedBuildingIds": [
            "R_MultiAge_CarnivalBonus18a",
            "R_MultiAge_CarnivalBonus18b",
            "R_MultiAge_CarnivalBonus18c",
            "R_MultiAge_CarnivalBonus18d",
            "R_MultiAge_CarnivalBonus18e",
            "R_MultiAge_CarnivalBonus18f",
            "R_MultiAge_CarnivalBonus18g"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_grand_bridge"
        ],
        "upgradeItems": {
            "upgrade_kit_grand_bridge": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_grand_bridge",
                "name": "Grand Bridge Upgrade",
                "description": "Upgrades your Grand Bridge to an improved version that will produce more resources. Upgrade your Grand Bridge up to six times for an even bigger effect!",
                "iconAssetName": "upgrade_kit_grand_bridge",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus18a",
                "toBuildingId": "R_MultiAge_CarnivalBonus18b",
                "upgradeItemId": "upgrade_kit_grand_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus18b",
                "toBuildingId": "R_MultiAge_CarnivalBonus18c",
                "upgradeItemId": "upgrade_kit_grand_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus18c",
                "toBuildingId": "R_MultiAge_CarnivalBonus18d",
                "upgradeItemId": "upgrade_kit_grand_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus18d",
                "toBuildingId": "R_MultiAge_CarnivalBonus18e",
                "upgradeItemId": "upgrade_kit_grand_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus18e",
                "toBuildingId": "R_MultiAge_CarnivalBonus18f",
                "upgradeItemId": "upgrade_kit_grand_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus18f",
                "toBuildingId": "R_MultiAge_CarnivalBonus18g",
                "upgradeItemId": "upgrade_kit_grand_bridge",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SpringBonusSet17b": {
        "baseBuildingId": "R_MultiAge_SpringBonusSet17b",
        "containedBuildingIds": [
            "R_MultiAge_SpringBonusSet17b",
            "R_MultiAge_SpringBonusSet18b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_emperors_entrance"
        ],
        "upgradeItems": {
            "upgrade_kit_emperors_entrance": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_emperors_entrance",
                "name": "Emperor's Entrance Upgrade",
                "description": "Upgrades your Emperor's Entrance to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_emperors_entrance",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonusSet17b",
                "toBuildingId": "R_MultiAge_SpringBonusSet18b",
                "upgradeItemId": "upgrade_kit_emperors_entrance",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SpringBonusSet17a": {
        "baseBuildingId": "R_MultiAge_SpringBonusSet17a",
        "containedBuildingIds": [
            "R_MultiAge_SpringBonusSet17a",
            "R_MultiAge_SpringBonusSet18a"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_zen_zone"
        ],
        "upgradeItems": {
            "upgrade_kit_zen_zone": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_zen_zone",
                "name": "Zen Zone Upgrade",
                "description": "Upgrades your Zen Zone to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_zen_zone",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonusSet17a",
                "toBuildingId": "R_MultiAge_SpringBonusSet18a",
                "upgradeItemId": "upgrade_kit_zen_zone",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_SpringBonusSet17a": {
        "baseBuildingId": "D_MultiAge_SpringBonusSet17a",
        "containedBuildingIds": [
            "D_MultiAge_SpringBonusSet17a",
            "D_MultiAge_SpringBonusSet18a"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_nishikigoi_pond"
        ],
        "upgradeItems": {
            "upgrade_kit_nishikigoi_pond": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_nishikigoi_pond",
                "name": "Nishikigoi Pond Upgrade",
                "description": "Upgrades your Nishikigoi Pond to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_nishikigoi_pond",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_SpringBonusSet17a",
                "toBuildingId": "D_MultiAge_SpringBonusSet18a",
                "upgradeItemId": "upgrade_kit_nishikigoi_pond",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_SpringBonusSet17b": {
        "baseBuildingId": "D_MultiAge_SpringBonusSet17b",
        "containedBuildingIds": [
            "D_MultiAge_SpringBonusSet17b",
            "D_MultiAge_SpringBonusSet18b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_sakura_rock"
        ],
        "upgradeItems": {
            "upgrade_kit_sakura_rock": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_sakura_rock",
                "name": "Sakura Rock Upgrade",
                "description": "Upgrades your Sakura Rock to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_sakura_rock",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_SpringBonusSet17b",
                "toBuildingId": "D_MultiAge_SpringBonusSet18b",
                "upgradeItemId": "upgrade_kit_sakura_rock",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "L_AllAge_SpringBonusSet17": {
        "baseBuildingId": "L_AllAge_SpringBonusSet17",
        "containedBuildingIds": [
            "L_AllAge_SpringBonusSet17",
            "L_AllAge_SpringBonusSet18"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_gong_of_wisdom"
        ],
        "upgradeItems": {
            "upgrade_kit_gong_of_wisdom": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_gong_of_wisdom",
                "name": "Gong of Wisdom Upgrade",
                "description": "Upgrades your Gong of Wisdom to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_gong_of_wisdom",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "L_AllAge_SpringBonusSet17",
                "toBuildingId": "L_AllAge_SpringBonusSet18",
                "upgradeItemId": "upgrade_kit_gong_of_wisdom",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SportBonus18a": {
        "baseBuildingId": "R_MultiAge_SportBonus18a",
        "containedBuildingIds": [
            "R_MultiAge_SportBonus18a",
            "R_MultiAge_SportBonus18b",
            "R_MultiAge_SportBonus18c",
            "R_MultiAge_SportBonus18d",
            "R_MultiAge_SportBonus18e",
            "R_MultiAge_SportBonus18f",
            "R_MultiAge_SportBonus18g",
            "R_MultiAge_SportBonus18h",
            "R_MultiAge_SportBonus18i",
            "R_MultiAge_SportBonus18j"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_tholos_of_idols"
        ],
        "upgradeItems": {
            "upgrade_kit_tholos_of_idols": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_tholos_of_idols",
                "name": "Tholos of Idols Upgrade",
                "description": "Upgrades your Tholos of Idols to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_tholos_of_idols",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18a",
                "toBuildingId": "R_MultiAge_SportBonus18b",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18b",
                "toBuildingId": "R_MultiAge_SportBonus18c",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18c",
                "toBuildingId": "R_MultiAge_SportBonus18d",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18d",
                "toBuildingId": "R_MultiAge_SportBonus18e",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18e",
                "toBuildingId": "R_MultiAge_SportBonus18f",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18f",
                "toBuildingId": "R_MultiAge_SportBonus18g",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18g",
                "toBuildingId": "R_MultiAge_SportBonus18h",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18h",
                "toBuildingId": "R_MultiAge_SportBonus18i",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus18i",
                "toBuildingId": "R_MultiAge_SportBonus18j",
                "upgradeItemId": "upgrade_kit_tholos_of_idols",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_AllAge_EasterBonus1": {
        "baseBuildingId": "W_AllAge_EasterBonus1",
        "containedBuildingIds": [
            "W_AllAge_EasterBonus1",
            "W_AllAge_EasterBonus1Small"
        ],
        "containedUpgradeItemIds": [
            "shrink_kit_wishing_well"
        ],
        "upgradeItems": {
            "shrink_kit_wishing_well": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "shrink_kit_wishing_well",
                "name": "Wishing Well Shrink Kit",
                "description": "Use this Shrink Kit to make your Wishing Well more compact in size whilst still remaining just as powerful.",
                "iconAssetName": "shrink_kit_wishing_well",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_AllAge_EasterBonus1",
                "toBuildingId": "W_AllAge_EasterBonus1Small",
                "upgradeItemId": "shrink_kit_wishing_well",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SummerBonus18a": {
        "baseBuildingId": "R_MultiAge_SummerBonus18a",
        "containedBuildingIds": [
            "R_MultiAge_SummerBonus18a",
            "R_MultiAge_SummerBonus18b",
            "R_MultiAge_SummerBonus18c",
            "R_MultiAge_SummerBonus18d",
            "R_MultiAge_SummerBonus18e",
            "R_MultiAge_SummerBonus18f",
            "R_MultiAge_SummerBonus18gRoyal",
            "R_MultiAge_SummerBonus18gTrader",
            "R_MultiAge_SummerBonus18gPirate"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_the_ship"
        ],
        "upgradeItems": {
            "upgrade_kit_the_ship": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_the_ship",
                "name": "The Ship Upgrade Kit",
                "description": "Upgrades your Ship to an improved version that will produce more resources. Select a specialization on the highest level.",
                "iconAssetName": "upgrade_kit_the_ship",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18a",
                "toBuildingId": "R_MultiAge_SummerBonus18b",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18b",
                "toBuildingId": "R_MultiAge_SummerBonus18c",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18c",
                "toBuildingId": "R_MultiAge_SummerBonus18d",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18d",
                "toBuildingId": "R_MultiAge_SummerBonus18e",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18e",
                "toBuildingId": "R_MultiAge_SummerBonus18f",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18f",
                "toBuildingId": "R_MultiAge_SummerBonus18gRoyal",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18f",
                "toBuildingId": "R_MultiAge_SummerBonus18gTrader",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus18f",
                "toBuildingId": "R_MultiAge_SummerBonus18gPirate",
                "upgradeItemId": "upgrade_kit_the_ship",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_FallBonus18a": {
        "baseBuildingId": "R_MultiAge_FallBonus18a",
        "containedBuildingIds": [
            "R_MultiAge_FallBonus18a",
            "R_MultiAge_FallBonus18b",
            "R_MultiAge_FallBonus18c",
            "R_MultiAge_FallBonus18d",
            "R_MultiAge_FallBonus18e",
            "R_MultiAge_FallBonus18f",
            "R_MultiAge_FallBonus18gaqueous",
            "R_MultiAge_FallBonus18gsunflower",
            "R_MultiAge_FallBonus18gcolorful"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_mill_of_fall"
        ],
        "upgradeItems": {
            "upgrade_kit_mill_of_fall": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_mill_of_fall",
                "name": "Mill of Fall Upgrade Kit",
                "description": "Upgrades your Mill of Fall to an improved version that will produce more resources. Select a specialization on the highest level.",
                "iconAssetName": "upgrade_kit_mill_of_fall",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18a",
                "toBuildingId": "R_MultiAge_FallBonus18b",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18b",
                "toBuildingId": "R_MultiAge_FallBonus18c",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18c",
                "toBuildingId": "R_MultiAge_FallBonus18d",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18d",
                "toBuildingId": "R_MultiAge_FallBonus18e",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18e",
                "toBuildingId": "R_MultiAge_FallBonus18f",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18f",
                "toBuildingId": "R_MultiAge_FallBonus18gaqueous",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18f",
                "toBuildingId": "R_MultiAge_FallBonus18gsunflower",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus18f",
                "toBuildingId": "R_MultiAge_FallBonus18gcolorful",
                "upgradeItemId": "upgrade_kit_mill_of_fall",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "M_AllAge_EasterBonus1": {
        "baseBuildingId": "M_AllAge_EasterBonus1",
        "containedBuildingIds": [
            "M_AllAge_EasterBonus1",
            "M_AllAge_EasterBonus1Small"
        ],
        "containedUpgradeItemIds": [
            "shrink_kit_rogue_hideout"
        ],
        "upgradeItems": {
            "shrink_kit_rogue_hideout": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "shrink_kit_rogue_hideout",
                "name": "Rogue Hideout Shrink Kit",
                "description": "Use this Shrink Kit to make your Rogue Hideout more compact in size whilst still able to produce the same output",
                "iconAssetName": "shrink_kit_rogue_hideout",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "M_AllAge_EasterBonus1",
                "toBuildingId": "M_AllAge_EasterBonus1Small",
                "upgradeItemId": "shrink_kit_rogue_hideout",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_WinterBonus18a": {
        "baseBuildingId": "R_MultiAge_WinterBonus18a",
        "containedBuildingIds": [
            "R_MultiAge_WinterBonus18a",
            "R_MultiAge_WinterBonus18b",
            "R_MultiAge_WinterBonus18c",
            "R_MultiAge_WinterBonus18d",
            "R_MultiAge_WinterBonus18e",
            "R_MultiAge_WinterBonus18f",
            "R_MultiAge_WinterBonus18g",
            "R_MultiAge_WinterBonus18h",
            "R_MultiAge_WinterBonus18i",
            "R_MultiAge_WinterBonus18j",
            "R_MultiAge_WinterBonus18k",
            "R_MultiAge_WinterBonus18l"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_winter_spire"
        ],
        "upgradeItems": {
            "upgrade_kit_winter_spire": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_winter_spire",
                "name": "Winter Spire Upgrade Kit",
                "description": "Upgrades your Winter Spire to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_winter_spire",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18a",
                "toBuildingId": "R_MultiAge_WinterBonus18b",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18b",
                "toBuildingId": "R_MultiAge_WinterBonus18c",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18c",
                "toBuildingId": "R_MultiAge_WinterBonus18d",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18d",
                "toBuildingId": "R_MultiAge_WinterBonus18e",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18e",
                "toBuildingId": "R_MultiAge_WinterBonus18f",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18f",
                "toBuildingId": "R_MultiAge_WinterBonus18g",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18g",
                "toBuildingId": "R_MultiAge_WinterBonus18h",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18h",
                "toBuildingId": "R_MultiAge_WinterBonus18i",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18i",
                "toBuildingId": "R_MultiAge_WinterBonus18j",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18j",
                "toBuildingId": "R_MultiAge_WinterBonus18k",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus18k",
                "toBuildingId": "R_MultiAge_WinterBonus18l",
                "upgradeItemId": "upgrade_kit_winter_spire",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "T_AllAge_EasterBonus1": {
        "baseBuildingId": "T_AllAge_EasterBonus1",
        "containedBuildingIds": [
            "T_AllAge_EasterBonus1",
            "T_AllAge_EasterBonus1b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_watchfire"
        ],
        "upgradeItems": {
            "upgrade_kit_watchfire": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_watchfire",
                "name": "Watchfire Upgrade Kit",
                "description": "Upgrades your Watchfire to an improved version that will give higher defense boost for your city.",
                "iconAssetName": "upgrade_kit_watchfire",
                "isHighlighted": true,
                "flags": [
                    "uncommon"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "T_AllAge_EasterBonus1",
                "toBuildingId": "T_AllAge_EasterBonus1b",
                "upgradeItemId": "upgrade_kit_watchfire",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_AllAge_CupBonus1": {
        "baseBuildingId": "W_AllAge_CupBonus1",
        "containedBuildingIds": [
            "W_AllAge_CupBonus1",
            "W_AllAge_CupBonus2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_victory_tower"
        ],
        "upgradeItems": {
            "upgrade_kit_victory_tower": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_victory_tower",
                "name": "Victory Tower Upgrade Kit",
                "description": "Upgrades your Victory Tower to an improved version that will produce more medals.",
                "iconAssetName": "upgrade_kit_victory_tower",
                "isHighlighted": true,
                "flags": [
                    "uncommon"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_AllAge_CupBonus1",
                "toBuildingId": "W_AllAge_CupBonus2",
                "upgradeItemId": "upgrade_kit_victory_tower",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CulturalBuilding2a": {
        "baseBuildingId": "R_MultiAge_CulturalBuilding2a",
        "containedBuildingIds": [
            "R_MultiAge_CulturalBuilding2a",
            "R_MultiAge_CulturalBuilding2b",
            "R_MultiAge_CulturalBuilding2c",
            "R_MultiAge_CulturalBuilding2d",
            "R_MultiAge_CulturalBuilding2e"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_greater_rune_stone"
        ],
        "upgradeItems": {
            "upgrade_kit_greater_rune_stone": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_greater_rune_stone",
                "name": "Greater Runestone Upgrade",
                "description": "Upgrades your Greater Runestone to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_greater_rune_stone",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding2a",
                "toBuildingId": "R_MultiAge_CulturalBuilding2b",
                "upgradeItemId": "upgrade_kit_greater_rune_stone",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding2b",
                "toBuildingId": "R_MultiAge_CulturalBuilding2c",
                "upgradeItemId": "upgrade_kit_greater_rune_stone",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding2c",
                "toBuildingId": "R_MultiAge_CulturalBuilding2d",
                "upgradeItemId": "upgrade_kit_greater_rune_stone",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding2d",
                "toBuildingId": "R_MultiAge_CulturalBuilding2e",
                "upgradeItemId": "upgrade_kit_greater_rune_stone",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SportBonus19a": {
        "baseBuildingId": "R_MultiAge_SportBonus19a",
        "containedBuildingIds": [
            "R_MultiAge_SportBonus19a",
            "R_MultiAge_SportBonus19b",
            "R_MultiAge_SportBonus19c",
            "R_MultiAge_SportBonus19d",
            "R_MultiAge_SportBonus19e",
            "R_MultiAge_SportBonus19f",
            "R_MultiAge_SportBonus19g",
            "R_MultiAge_SportBonus19h",
            "R_MultiAge_SportBonus19i",
            "R_MultiAge_SportBonus19j"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_colossus"
        ],
        "upgradeItems": {
            "upgrade_kit_colossus": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_colossus",
                "name": "Colossus Upgrade Kit",
                "description": "Upgrades your Colossus to an improved version that will give boosts and produce more resources.",
                "iconAssetName": "upgrade_kit_colossus",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19a",
                "toBuildingId": "R_MultiAge_SportBonus19b",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19b",
                "toBuildingId": "R_MultiAge_SportBonus19c",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19c",
                "toBuildingId": "R_MultiAge_SportBonus19d",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19d",
                "toBuildingId": "R_MultiAge_SportBonus19e",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19e",
                "toBuildingId": "R_MultiAge_SportBonus19f",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19f",
                "toBuildingId": "R_MultiAge_SportBonus19g",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19g",
                "toBuildingId": "R_MultiAge_SportBonus19h",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19h",
                "toBuildingId": "R_MultiAge_SportBonus19i",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus19i",
                "toBuildingId": "R_MultiAge_SportBonus19j",
                "upgradeItemId": "upgrade_kit_colossus",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CarnivalBonus19a": {
        "baseBuildingId": "R_MultiAge_CarnivalBonus19a",
        "containedBuildingIds": [
            "R_MultiAge_CarnivalBonus19a",
            "R_MultiAge_CarnivalBonus19b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_piazza_homes"
        ],
        "upgradeItems": {
            "upgrade_kit_piazza_homes": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_piazza_homes",
                "name": "Piazza Homes Upgrade Kit",
                "description": "Upgrades your Piazza Homes to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_piazza_homes",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus19a",
                "toBuildingId": "R_MultiAge_CarnivalBonus19b",
                "upgradeItemId": "upgrade_kit_piazza_homes",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_CarnivalBonus19a": {
        "baseBuildingId": "D_MultiAge_CarnivalBonus19a",
        "containedBuildingIds": [
            "D_MultiAge_CarnivalBonus19a",
            "D_MultiAge_CarnivalBonus19b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_piazza_fountain"
        ],
        "upgradeItems": {
            "upgrade_kit_piazza_fountain": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_piazza_fountain",
                "name": "Piazza Fountain Upgrade Kit",
                "description": "Upgrades your Piazza Fountain to an improved version that will give more happiness and stronger boosts.",
                "iconAssetName": "upgrade_kit_piazza_fountain",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_CarnivalBonus19a",
                "toBuildingId": "D_MultiAge_CarnivalBonus19b",
                "upgradeItemId": "upgrade_kit_piazza_fountain",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "A_MultiAge_CarnivalBonus19a": {
        "baseBuildingId": "A_MultiAge_CarnivalBonus19a",
        "containedBuildingIds": [
            "A_MultiAge_CarnivalBonus19a",
            "A_MultiAge_CarnivalBonus19b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_piazza_clock_tower"
        ],
        "upgradeItems": {
            "upgrade_kit_piazza_clock_tower": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_piazza_clock_tower",
                "name": "Piazza Clock Tower Upgrade Kit",
                "description": "Upgrades your Piazza Clock Tower to an improved version that will give stronger boosts.",
                "iconAssetName": "upgrade_kit_piazza_clock_tower",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_CarnivalBonus19a",
                "toBuildingId": "A_MultiAge_CarnivalBonus19b",
                "upgradeItemId": "upgrade_kit_piazza_clock_tower",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CarnivalBonus19c": {
        "baseBuildingId": "R_MultiAge_CarnivalBonus19c",
        "containedBuildingIds": [
            "R_MultiAge_CarnivalBonus19c",
            "R_MultiAge_CarnivalBonus19d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_piazza_cafe"
        ],
        "upgradeItems": {
            "upgrade_kit_piazza_cafe": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_piazza_cafe",
                "name": "Piazza Café Upgrade Kit",
                "description": "Upgrades your Piazza Cafe to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_piazza_cafe",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CarnivalBonus19c",
                "toBuildingId": "R_MultiAge_CarnivalBonus19d",
                "upgradeItemId": "upgrade_kit_piazza_cafe",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "L_AllAge_CarnivalBonus19a": {
        "baseBuildingId": "L_AllAge_CarnivalBonus19a",
        "containedBuildingIds": [
            "L_AllAge_CarnivalBonus19a",
            "L_AllAge_CarnivalBonus19b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_piazza_mask_vendor"
        ],
        "upgradeItems": {
            "upgrade_kit_piazza_mask_vendor": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_piazza_mask_vendor",
                "name": "Piazza Mask Vendor Upgrade Kit",
                "description": "Upgrades your Piazza Mask Vendor to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_piazza_mask_vendor",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "L_AllAge_CarnivalBonus19a",
                "toBuildingId": "L_AllAge_CarnivalBonus19b",
                "upgradeItemId": "upgrade_kit_piazza_mask_vendor",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ARCH19A1": {
        "baseBuildingId": "W_MultiAge_ARCH19A1",
        "containedBuildingIds": [
            "W_MultiAge_ARCH19A1",
            "W_MultiAge_ARCH19A2",
            "W_MultiAge_ARCH19A3",
            "W_MultiAge_ARCH19A4",
            "W_MultiAge_ARCH19A5",
            "W_MultiAge_ARCH19A6",
            "W_MultiAge_ARCH19A7",
            "W_MultiAge_ARCH19A8",
            "W_MultiAge_ARCH19A9",
            "W_MultiAge_ARCH19A10",
            "W_MultiAge_ARCH19A11",
            "W_MultiAge_ARCH19A12",
            "W_MultiAge_ARCH19A13",
            "W_MultiAge_ARCH19A14"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_worlds_fair",
            "silver_upgrade_kit_ARCH19A",
            "golden_upgrade_kit_ARCH19A",
            "platinum_upgrade_kit_ARCH19A",
            "upgrade_kit_ascended_ARCH19A"
        ],
        "upgradeItems": {
            "upgrade_kit_worlds_fair": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_worlds_fair",
                "name": "World's Fair Upgrade Kit",
                "description": "Upgrades your World's Fair to an improved version that will produce more resources. Upgrade your World's Fair up to nine times for an even bigger effect!",
                "iconAssetName": "upgrade_kit_worlds_fair",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_ARCH19A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_ARCH19A",
                "name": "World Expo Silver Upgrade Kit",
                "description": "Upgrades your World's Fair to its second best version!",
                "iconAssetName": "silver_upgrade_kit_ARCH19A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ARCH19A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ARCH19A",
                "name": "Hopeful World Expo Golden Upgrade Kit",
                "description": "Upgrades your World's Fair to its best version!",
                "iconAssetName": "golden_upgrade_kit_ARCH19A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_ARCH19A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_ARCH19A",
                "name": "Harmonious World Expo Platinum Upgrade Kit",
                "description": "Upgrades your World's Fair to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_ARCH19A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_ARCH19A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ARCH19A",
                "name": "United World Expo Upgrade Kit",
                "description": "Upgrades your Harmonious World Expo to a time-limited United World Expo that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ARCH19A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A1",
                "toBuildingId": "W_MultiAge_ARCH19A2",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A2",
                "toBuildingId": "W_MultiAge_ARCH19A3",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A3",
                "toBuildingId": "W_MultiAge_ARCH19A4",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A4",
                "toBuildingId": "W_MultiAge_ARCH19A5",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A5",
                "toBuildingId": "W_MultiAge_ARCH19A6",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A6",
                "toBuildingId": "W_MultiAge_ARCH19A7",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A7",
                "toBuildingId": "W_MultiAge_ARCH19A8",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A8",
                "toBuildingId": "W_MultiAge_ARCH19A9",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A9",
                "toBuildingId": "W_MultiAge_ARCH19A10",
                "upgradeItemId": "upgrade_kit_worlds_fair",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A10",
                "toBuildingId": "W_MultiAge_ARCH19A11",
                "upgradeItemId": "silver_upgrade_kit_ARCH19A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A11",
                "toBuildingId": "W_MultiAge_ARCH19A12",
                "upgradeItemId": "golden_upgrade_kit_ARCH19A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A12",
                "toBuildingId": "W_MultiAge_ARCH19A13",
                "upgradeItemId": "platinum_upgrade_kit_ARCH19A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 12,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH19A13",
                "toBuildingId": "W_MultiAge_ARCH19A14",
                "upgradeItemId": "upgrade_kit_ascended_ARCH19A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SpringBonus17a": {
        "baseBuildingId": "R_MultiAge_SpringBonus17a",
        "containedBuildingIds": [
            "R_MultiAge_SpringBonus17a",
            "R_MultiAge_SpringBonus17b",
            "R_MultiAge_SpringBonus17c",
            "R_MultiAge_SpringBonus17d",
            "R_MultiAge_SpringBonus17e",
            "R_MultiAge_SpringBonus17f",
            "R_MultiAge_SpringBonus17gBlue",
            "R_MultiAge_SpringBonus17gRed",
            "R_MultiAge_SpringBonus17gGreen"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_pagoda"
        ],
        "upgradeItems": {
            "upgrade_kit_pagoda": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_pagoda",
                "name": "Pagoda Upgrade",
                "description": "Upgrades your Pagoda to an improved version that will produce more resources. Select a specialization of the highest level.",
                "iconAssetName": "upgrade_kit_pagoda",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17a",
                "toBuildingId": "R_MultiAge_SpringBonus17b",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17b",
                "toBuildingId": "R_MultiAge_SpringBonus17c",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17c",
                "toBuildingId": "R_MultiAge_SpringBonus17d",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17d",
                "toBuildingId": "R_MultiAge_SpringBonus17e",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17e",
                "toBuildingId": "R_MultiAge_SpringBonus17f",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17f",
                "toBuildingId": "R_MultiAge_SpringBonus17gBlue",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17f",
                "toBuildingId": "R_MultiAge_SpringBonus17gRed",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus17f",
                "toBuildingId": "R_MultiAge_SpringBonus17gGreen",
                "upgradeItemId": "upgrade_kit_pagoda",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SoccerBonus19a": {
        "baseBuildingId": "R_MultiAge_SoccerBonus19a",
        "containedBuildingIds": [
            "R_MultiAge_SoccerBonus19a",
            "R_MultiAge_SoccerBonus19b",
            "R_MultiAge_SoccerBonus19c",
            "R_MultiAge_SoccerBonus19d",
            "R_MultiAge_SoccerBonus19eAphrodite",
            "R_MultiAge_SoccerBonus19eArtemis",
            "R_MultiAge_SoccerBonus19eAthena",
            "R_MultiAge_SoccerBonus19eDemeter",
            "R_MultiAge_SoccerBonus19eHera",
            "R_MultiAge_SoccerBonus19eHestia"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_altar_garden"
        ],
        "upgradeItems": {
            "upgrade_kit_altar_garden": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_altar_garden",
                "name": "Altar Garden Upgrade Kit",
                "description": "Upgrades your Altar Garden to an improved version that will produce more resources. Choose from six different specializations on the highest level.",
                "iconAssetName": "upgrade_kit_altar_garden",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19a",
                "toBuildingId": "R_MultiAge_SoccerBonus19b",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19b",
                "toBuildingId": "R_MultiAge_SoccerBonus19c",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19c",
                "toBuildingId": "R_MultiAge_SoccerBonus19d",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19d",
                "toBuildingId": "R_MultiAge_SoccerBonus19eAphrodite",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19d",
                "toBuildingId": "R_MultiAge_SoccerBonus19eArtemis",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19d",
                "toBuildingId": "R_MultiAge_SoccerBonus19eAthena",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19d",
                "toBuildingId": "R_MultiAge_SoccerBonus19eDemeter",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19d",
                "toBuildingId": "R_MultiAge_SoccerBonus19eHera",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus19d",
                "toBuildingId": "R_MultiAge_SoccerBonus19eHestia",
                "upgradeItemId": "upgrade_kit_altar_garden",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CulturalBuilding4a": {
        "baseBuildingId": "R_MultiAge_CulturalBuilding4a",
        "containedBuildingIds": [
            "R_MultiAge_CulturalBuilding4a",
            "R_MultiAge_CulturalBuilding4b",
            "R_MultiAge_CulturalBuilding4c",
            "R_MultiAge_CulturalBuilding4d",
            "R_MultiAge_CulturalBuilding4e"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_timeless_dojo"
        ],
        "upgradeItems": {
            "upgrade_kit_timeless_dojo": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_timeless_dojo",
                "name": "Timeless Dojo Upgrade",
                "description": "Upgrades your Timeless Dojo to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_timeless_dojo",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding4a",
                "toBuildingId": "R_MultiAge_CulturalBuilding4b",
                "upgradeItemId": "upgrade_kit_timeless_dojo",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding4b",
                "toBuildingId": "R_MultiAge_CulturalBuilding4c",
                "upgradeItemId": "upgrade_kit_timeless_dojo",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding4c",
                "toBuildingId": "R_MultiAge_CulturalBuilding4d",
                "upgradeItemId": "upgrade_kit_timeless_dojo",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding4d",
                "toBuildingId": "R_MultiAge_CulturalBuilding4e",
                "upgradeItemId": "upgrade_kit_timeless_dojo",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN19A1": {
        "baseBuildingId": "W_MultiAge_WIN19A1",
        "containedBuildingIds": [
            "W_MultiAge_WIN19A1",
            "W_MultiAge_WIN19A2",
            "W_MultiAge_WIN19A3",
            "W_MultiAge_WIN19A4",
            "W_MultiAge_WIN19A5",
            "W_MultiAge_WIN19A6",
            "W_MultiAge_WIN19A7",
            "W_MultiAge_WIN19A8",
            "W_MultiAge_WIN19A9a",
            "W_MultiAge_WIN19A9b",
            "W_MultiAge_WIN19A9c",
            "W_MultiAge_WIN19A10a",
            "W_MultiAge_WIN19A10b",
            "W_MultiAge_WIN19A10c"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_winter_train",
            "golden_upgrade_kit_WIN19Aa",
            "golden_upgrade_kit_WIN19Ab",
            "golden_upgrade_kit_WIN19Ac"
        ],
        "upgradeItems": {
            "upgrade_kit_winter_train": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_winter_train",
                "name": "Winter Train Upgrade Kit",
                "description": "Upgrades your Winter Train to an improved version that will produce more resources. Select a specialization on the highest level.",
                "iconAssetName": "upgrade_kit_winter_train",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN19Aa": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN19Aa",
                "name": "The Charcoal Limited Express Golden Upgrade Kit",
                "description": "Upgrades your Winter Train to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN19Aa",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN19Ab": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN19Ab",
                "name": "The Evergreen Limited Express Golden Upgrade Kit",
                "description": "Upgrades your Winter Train to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN19Ab",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN19Ac": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN19Ac",
                "name": "The Sleighride Limited Express Golden Upgrade Kit",
                "description": "Upgrades your Winter Train to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN19Ac",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A1",
                "toBuildingId": "W_MultiAge_WIN19A2",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A2",
                "toBuildingId": "W_MultiAge_WIN19A3",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A3",
                "toBuildingId": "W_MultiAge_WIN19A4",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A4",
                "toBuildingId": "W_MultiAge_WIN19A5",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A5",
                "toBuildingId": "W_MultiAge_WIN19A6",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A6",
                "toBuildingId": "W_MultiAge_WIN19A7",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A7",
                "toBuildingId": "W_MultiAge_WIN19A8",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A8",
                "toBuildingId": "W_MultiAge_WIN19A9a",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A8",
                "toBuildingId": "W_MultiAge_WIN19A9b",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A8",
                "toBuildingId": "W_MultiAge_WIN19A9c",
                "upgradeItemId": "upgrade_kit_winter_train",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A9a",
                "toBuildingId": "W_MultiAge_WIN19A10a",
                "upgradeItemId": "golden_upgrade_kit_WIN19Aa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A9b",
                "toBuildingId": "W_MultiAge_WIN19A10b",
                "upgradeItemId": "golden_upgrade_kit_WIN19Ab",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19A9c",
                "toBuildingId": "W_MultiAge_WIN19A10c",
                "upgradeItemId": "golden_upgrade_kit_WIN19Ac",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "T_AllAge_WinterBonus19a": {
        "baseBuildingId": "T_AllAge_WinterBonus19a",
        "containedBuildingIds": [
            "T_AllAge_WinterBonus19a",
            "T_AllAge_WinterBonus19b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_tacticians_tower"
        ],
        "upgradeItems": {
            "upgrade_kit_tacticians_tower": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_tacticians_tower",
                "name": "Tactician's Tower Upgrade Kit",
                "description": "Upgrades your Tactician's Tower to an improved version that will give higher attack boost for your defending armies.",
                "iconAssetName": "upgrade_kit_tacticians_tower",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "T_AllAge_WinterBonus19a",
                "toBuildingId": "T_AllAge_WinterBonus19b",
                "upgradeItemId": "upgrade_kit_tacticians_tower",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SportBonus20a": {
        "baseBuildingId": "R_MultiAge_SportBonus20a",
        "containedBuildingIds": [
            "R_MultiAge_SportBonus20a",
            "R_MultiAge_SportBonus20b",
            "R_MultiAge_SportBonus20c",
            "R_MultiAge_SportBonus20d",
            "R_MultiAge_SportBonus20e",
            "R_MultiAge_SportBonus20f",
            "R_MultiAge_SportBonus20g",
            "R_MultiAge_SportBonus20h",
            "R_MultiAge_SportBonus20i",
            "R_MultiAge_SportBonus20j"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_olympic_treasury"
        ],
        "upgradeItems": {
            "upgrade_kit_olympic_treasury": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_olympic_treasury",
                "name": "Olympic Treasury Upgrade Kit",
                "description": "Upgrades your Olympic Treasury to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_olympic_treasury",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20a",
                "toBuildingId": "R_MultiAge_SportBonus20b",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20b",
                "toBuildingId": "R_MultiAge_SportBonus20c",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20c",
                "toBuildingId": "R_MultiAge_SportBonus20d",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20d",
                "toBuildingId": "R_MultiAge_SportBonus20e",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20e",
                "toBuildingId": "R_MultiAge_SportBonus20f",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20f",
                "toBuildingId": "R_MultiAge_SportBonus20g",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20g",
                "toBuildingId": "R_MultiAge_SportBonus20h",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20h",
                "toBuildingId": "R_MultiAge_SportBonus20i",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SportBonus20i",
                "toBuildingId": "R_MultiAge_SportBonus20j",
                "upgradeItemId": "upgrade_kit_olympic_treasury",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "T_AllAge_SportBonus20a": {
        "baseBuildingId": "T_AllAge_SportBonus20a",
        "containedBuildingIds": [
            "T_AllAge_SportBonus20a",
            "T_AllAge_SportBonus20b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_sentinel_outpost"
        ],
        "upgradeItems": {
            "upgrade_kit_sentinel_outpost": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_sentinel_outpost",
                "name": "Sentinel Outpost Upgrade Kit",
                "description": "Upgrades your Sentinel Outpost to an improved version that will give higher defense boost for your Attacking Armies.",
                "iconAssetName": "upgrade_kit_sentinel_outpost",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "T_AllAge_SportBonus20a",
                "toBuildingId": "T_AllAge_SportBonus20b",
                "upgradeItemId": "upgrade_kit_sentinel_outpost",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL19A1": {
        "baseBuildingId": "W_MultiAge_HAL19A1",
        "containedBuildingIds": [
            "W_MultiAge_HAL19A1",
            "W_MultiAge_HAL19A2",
            "W_MultiAge_HAL19A3",
            "W_MultiAge_HAL19A4",
            "W_MultiAge_HAL19A5",
            "W_MultiAge_HAL19A6",
            "W_MultiAge_HAL19A7",
            "W_MultiAge_HAL19A8",
            "W_MultiAge_HAL19A9",
            "W_MultiAge_HAL19A10",
            "W_MultiAge_HAL19A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_abandoned_asylum",
            "silver_upgrade_kit_HAL19A",
            "golden_upgrade_kit_HAL19A"
        ],
        "upgradeItems": {
            "upgrade_kit_abandoned_asylum": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_abandoned_asylum",
                "name": "Abandoned Asylum Upgrade Kit",
                "description": "Upgrades your Abandoned Asylum to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_abandoned_asylum",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HAL19A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HAL19A",
                "name": "Eerie Abandoned Asylum Silver Upgrade Kit",
                "description": "Upgrades your Abandoned Asylum to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HAL19A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HAL19A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL19A",
                "name": "Phantom Abandoned Asylum Golden Upgrade Kit",
                "description": "Upgrades your Abandoned Asylum to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL19A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A1",
                "toBuildingId": "W_MultiAge_HAL19A2",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A2",
                "toBuildingId": "W_MultiAge_HAL19A3",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A3",
                "toBuildingId": "W_MultiAge_HAL19A4",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A4",
                "toBuildingId": "W_MultiAge_HAL19A5",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A5",
                "toBuildingId": "W_MultiAge_HAL19A6",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A6",
                "toBuildingId": "W_MultiAge_HAL19A7",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A7",
                "toBuildingId": "W_MultiAge_HAL19A8",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A8",
                "toBuildingId": "W_MultiAge_HAL19A9",
                "upgradeItemId": "upgrade_kit_abandoned_asylum",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A9",
                "toBuildingId": "W_MultiAge_HAL19A10",
                "upgradeItemId": "silver_upgrade_kit_HAL19A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL19A10",
                "toBuildingId": "W_MultiAge_HAL19A11",
                "upgradeItemId": "golden_upgrade_kit_HAL19A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_FallBonus19a": {
        "baseBuildingId": "R_MultiAge_FallBonus19a",
        "containedBuildingIds": [
            "R_MultiAge_FallBonus19a",
            "R_MultiAge_FallBonus19b",
            "R_MultiAge_FallBonus19c",
            "R_MultiAge_FallBonus19d",
            "R_MultiAge_FallBonus19e",
            "R_MultiAge_FallBonus19f",
            "R_MultiAge_FallBonus19gPond",
            "R_MultiAge_FallBonus19gApple",
            "R_MultiAge_FallBonus19gFlower"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_september_cottage"
        ],
        "upgradeItems": {
            "upgrade_kit_september_cottage": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_september_cottage",
                "name": "September Cottage Upgrade Kit",
                "description": "Upgrades your September Cottage to an improved version that will produce more resources. Select a specialization on the highest level.",
                "iconAssetName": "upgrade_kit_september_cottage",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19a",
                "toBuildingId": "R_MultiAge_FallBonus19b",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19b",
                "toBuildingId": "R_MultiAge_FallBonus19c",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19c",
                "toBuildingId": "R_MultiAge_FallBonus19d",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19d",
                "toBuildingId": "R_MultiAge_FallBonus19e",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19e",
                "toBuildingId": "R_MultiAge_FallBonus19f",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19f",
                "toBuildingId": "R_MultiAge_FallBonus19gPond",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19f",
                "toBuildingId": "R_MultiAge_FallBonus19gApple",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus19f",
                "toBuildingId": "R_MultiAge_FallBonus19gFlower",
                "upgradeItemId": "upgrade_kit_september_cottage",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SummerBonus19a": {
        "baseBuildingId": "R_MultiAge_SummerBonus19a",
        "containedBuildingIds": [
            "R_MultiAge_SummerBonus19a",
            "R_MultiAge_SummerBonus19b",
            "R_MultiAge_SummerBonus19c",
            "R_MultiAge_SummerBonus19d",
            "R_MultiAge_SummerBonus19e",
            "R_MultiAge_SummerBonus19f",
            "R_MultiAge_SummerBonus19g",
            "R_MultiAge_SummerBonus19h"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_crows_nest"
        ],
        "upgradeItems": {
            "upgrade_kit_crows_nest": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_crows_nest",
                "name": "Crow's Nest Upgrade Kit",
                "description": "Upgrades your Crow's Nest to an improved version that will produce more resources, especially Forge Points. Upgrade your Crow's Nest up to level 8 for an even bigger effect!",
                "iconAssetName": "upgrade_kit_crows_nest",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus19a",
                "toBuildingId": "R_MultiAge_SummerBonus19b",
                "upgradeItemId": "upgrade_kit_crows_nest",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus19b",
                "toBuildingId": "R_MultiAge_SummerBonus19c",
                "upgradeItemId": "upgrade_kit_crows_nest",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus19c",
                "toBuildingId": "R_MultiAge_SummerBonus19d",
                "upgradeItemId": "upgrade_kit_crows_nest",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus19d",
                "toBuildingId": "R_MultiAge_SummerBonus19e",
                "upgradeItemId": "upgrade_kit_crows_nest",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus19e",
                "toBuildingId": "R_MultiAge_SummerBonus19f",
                "upgradeItemId": "upgrade_kit_crows_nest",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus19f",
                "toBuildingId": "R_MultiAge_SummerBonus19g",
                "upgradeItemId": "upgrade_kit_crows_nest",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SummerBonus19g",
                "toBuildingId": "R_MultiAge_SummerBonus19h",
                "upgradeItemId": "upgrade_kit_crows_nest",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ARCH20A1": {
        "baseBuildingId": "W_MultiAge_ARCH20A1",
        "containedBuildingIds": [
            "W_MultiAge_ARCH20A1",
            "W_MultiAge_ARCH20A2",
            "W_MultiAge_ARCH20A3",
            "W_MultiAge_ARCH20A4",
            "W_MultiAge_ARCH20A5",
            "W_MultiAge_ARCH20A6",
            "W_MultiAge_ARCH20A7",
            "W_MultiAge_ARCH20A8",
            "W_MultiAge_ARCH20A9",
            "W_MultiAge_ARCH20A10",
            "W_MultiAge_ARCH20A11",
            "W_MultiAge_ARCH20A12",
            "W_MultiAge_ARCH20A13",
            "W_MultiAge_ARCH20A14"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_airship",
            "silver_upgrade_kit_ARCH20A",
            "golden_upgrade_kit_ARCH20A",
            "platinum_upgrade_kit_ARCH20A"
        ],
        "upgradeItems": {
            "upgrade_kit_airship": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_airship",
                "name": "Airship Upgrade Kit",
                "description": "Upgrades your Airship to an improved version that will produce more resources. Upgrade your Airship up to ten times for an even greater effect!",
                "iconAssetName": "upgrade_kit_airship",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_ARCH20A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_ARCH20A",
                "name": "Zephyr Airship Silver Upgrade Kit",
                "description": "Upgrades your Airship to its second best version!",
                "iconAssetName": "silver_upgrade_kit_ARCH20A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ARCH20A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ARCH20A",
                "name": "Celestial Airship Golden Upgrade Kit",
                "description": "Upgrades your Airship to its best version!",
                "iconAssetName": "golden_upgrade_kit_ARCH20A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_ARCH20A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_ARCH20A",
                "name": "Astral Airship Platinum Upgrade Kit",
                "description": "Upgrades your Airship to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_ARCH20A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A1",
                "toBuildingId": "W_MultiAge_ARCH20A2",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A2",
                "toBuildingId": "W_MultiAge_ARCH20A3",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A3",
                "toBuildingId": "W_MultiAge_ARCH20A4",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A4",
                "toBuildingId": "W_MultiAge_ARCH20A5",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A5",
                "toBuildingId": "W_MultiAge_ARCH20A6",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A6",
                "toBuildingId": "W_MultiAge_ARCH20A7",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A7",
                "toBuildingId": "W_MultiAge_ARCH20A8",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A8",
                "toBuildingId": "W_MultiAge_ARCH20A9",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A9",
                "toBuildingId": "W_MultiAge_ARCH20A10",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A10",
                "toBuildingId": "W_MultiAge_ARCH20A11",
                "upgradeItemId": "upgrade_kit_airship",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A11",
                "toBuildingId": "W_MultiAge_ARCH20A12",
                "upgradeItemId": "silver_upgrade_kit_ARCH20A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A12",
                "toBuildingId": "W_MultiAge_ARCH20A13",
                "upgradeItemId": "golden_upgrade_kit_ARCH20A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 12,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARCH20A13",
                "toBuildingId": "W_MultiAge_ARCH20A14",
                "upgradeItemId": "platinum_upgrade_kit_ARCH20A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_PatrickBonusSet20a": {
        "baseBuildingId": "R_MultiAge_PatrickBonusSet20a",
        "containedBuildingIds": [
            "R_MultiAge_PatrickBonusSet20a",
            "R_MultiAge_PatrickBonusSet20b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_moon_gate"
        ],
        "upgradeItems": {
            "upgrade_kit_moon_gate": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_moon_gate",
                "name": "Moon Gate Upgrade Kit",
                "description": "Upgrades your Moon Gate to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_moon_gate",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_PatrickBonusSet20a",
                "toBuildingId": "R_MultiAge_PatrickBonusSet20b",
                "upgradeItemId": "upgrade_kit_moon_gate",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_PatrickBonusSet20c": {
        "baseBuildingId": "R_MultiAge_PatrickBonusSet20c",
        "containedBuildingIds": [
            "R_MultiAge_PatrickBonusSet20c",
            "R_MultiAge_PatrickBonusSet20d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_faery_rings"
        ],
        "upgradeItems": {
            "upgrade_kit_faery_rings": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_faery_rings",
                "name": "Faery Rings Upgrade Kit",
                "description": "Upgrades your Faery Rings to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_faery_rings",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_PatrickBonusSet20c",
                "toBuildingId": "R_MultiAge_PatrickBonusSet20d",
                "upgradeItemId": "upgrade_kit_faery_rings",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "A_MultiAge_PatrickBonusSet20a": {
        "baseBuildingId": "A_MultiAge_PatrickBonusSet20a",
        "containedBuildingIds": [
            "A_MultiAge_PatrickBonusSet20a",
            "A_MultiAge_PatrickBonusSet20b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_druid_willow"
        ],
        "upgradeItems": {
            "upgrade_kit_druid_willow": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_druid_willow",
                "name": "Druid Willow Upgrade Kit",
                "description": "Upgrades your Druid Willow to an improved version that will give higher defense boosts.",
                "iconAssetName": "upgrade_kit_druid_willow",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_PatrickBonusSet20a",
                "toBuildingId": "A_MultiAge_PatrickBonusSet20b",
                "upgradeItemId": "upgrade_kit_druid_willow",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_PatrickBonusSet20a": {
        "baseBuildingId": "D_MultiAge_PatrickBonusSet20a",
        "containedBuildingIds": [
            "D_MultiAge_PatrickBonusSet20a",
            "D_MultiAge_PatrickBonusSet20b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_standing_stone"
        ],
        "upgradeItems": {
            "upgrade_kit_standing_stone": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_standing_stone",
                "name": "Standing Stone Upgrade Kit",
                "description": "Upgrades your Standing Stone to an improved version that will give even greater boosts.",
                "iconAssetName": "upgrade_kit_standing_stone",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_PatrickBonusSet20a",
                "toBuildingId": "D_MultiAge_PatrickBonusSet20b",
                "upgradeItemId": "upgrade_kit_standing_stone",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "L_AllAge_PatrickBonusSet20a": {
        "baseBuildingId": "L_AllAge_PatrickBonusSet20a",
        "containedBuildingIds": [
            "L_AllAge_PatrickBonusSet20a",
            "L_AllAge_PatrickBonusSet20b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_majestic_fawn"
        ],
        "upgradeItems": {
            "upgrade_kit_majestic_fawn": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_majestic_fawn",
                "name": "Majestic Fawn Upgrade Kit",
                "description": "Upgrades your Majestic Fawn to a Majestic Stag that will produce more resources and give a higher attack boost.",
                "iconAssetName": "upgrade_kit_majestic_fawn",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "L_AllAge_PatrickBonusSet20a",
                "toBuildingId": "L_AllAge_PatrickBonusSet20b",
                "upgradeItemId": "upgrade_kit_majestic_fawn",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SpringBonus20a": {
        "baseBuildingId": "R_MultiAge_SpringBonus20a",
        "containedBuildingIds": [
            "R_MultiAge_SpringBonus20a",
            "R_MultiAge_SpringBonus20b",
            "R_MultiAge_SpringBonus20c",
            "R_MultiAge_SpringBonus20d",
            "R_MultiAge_SpringBonus20e",
            "R_MultiAge_SpringBonus20f",
            "R_MultiAge_SpringBonus20g",
            "R_MultiAge_SpringBonus20hMikawa",
            "R_MultiAge_SpringBonus20hMikoto"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_hanami_bridge"
        ],
        "upgradeItems": {
            "upgrade_kit_hanami_bridge": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_hanami_bridge",
                "name": "Hanami Bridge Upgrade Kit",
                "description": "Upgrades your Hanami Bridge to an improved version that will produce more resources. Select a specialization on the highest level!",
                "iconAssetName": "upgrade_kit_hanami_bridge",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20a",
                "toBuildingId": "R_MultiAge_SpringBonus20b",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20b",
                "toBuildingId": "R_MultiAge_SpringBonus20c",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20c",
                "toBuildingId": "R_MultiAge_SpringBonus20d",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20d",
                "toBuildingId": "R_MultiAge_SpringBonus20e",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20e",
                "toBuildingId": "R_MultiAge_SpringBonus20f",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20f",
                "toBuildingId": "R_MultiAge_SpringBonus20g",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20g",
                "toBuildingId": "R_MultiAge_SpringBonus20hMikawa",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus20g",
                "toBuildingId": "R_MultiAge_SpringBonus20hMikoto",
                "upgradeItemId": "upgrade_kit_hanami_bridge",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_EasterBonus5": {
        "baseBuildingId": "R_MultiAge_EasterBonus5",
        "containedBuildingIds": [
            "R_MultiAge_EasterBonus5",
            "R_MultiAge_EasterBonus5b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_shrine_of_knowledge"
        ],
        "upgradeItems": {
            "upgrade_kit_shrine_of_knowledge": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_shrine_of_knowledge",
                "name": "Shrine of Knowledge Upgrade",
                "description": "Upgrades your Shrine of Knowledge to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_shrine_of_knowledge",
                "isHighlighted": true,
                "flags": [
                    "uncommon"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_EasterBonus5",
                "toBuildingId": "R_MultiAge_EasterBonus5b",
                "upgradeItemId": "upgrade_kit_shrine_of_knowledge",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_AntiquesDealerBonus19a": {
        "baseBuildingId": "R_MultiAge_AntiquesDealerBonus19a",
        "containedBuildingIds": [
            "R_MultiAge_AntiquesDealerBonus19a",
            "R_MultiAge_AntiquesDealerBonus19b",
            "R_MultiAge_AntiquesDealerBonus19c",
            "R_MultiAge_AntiquesDealerBonus19d",
            "R_MultiAge_AntiquesDealerBonus19e",
            "R_MultiAge_AntiquesDealerBonus19f",
            "R_MultiAge_AntiquesDealerBonus19g",
            "R_MultiAge_AntiquesDealerBonus19h"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_art_exhibition"
        ],
        "upgradeItems": {
            "upgrade_kit_art_exhibition": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_art_exhibition",
                "name": "Art Exhibition Upgrade",
                "description": "Upgrades your Art Exhibition to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_art_exhibition",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_AntiquesDealerBonus19a",
                "toBuildingId": "R_MultiAge_AntiquesDealerBonus19b",
                "upgradeItemId": "upgrade_kit_art_exhibition",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_AntiquesDealerBonus19b",
                "toBuildingId": "R_MultiAge_AntiquesDealerBonus19c",
                "upgradeItemId": "upgrade_kit_art_exhibition",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_AntiquesDealerBonus19c",
                "toBuildingId": "R_MultiAge_AntiquesDealerBonus19d",
                "upgradeItemId": "upgrade_kit_art_exhibition",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_AntiquesDealerBonus19d",
                "toBuildingId": "R_MultiAge_AntiquesDealerBonus19e",
                "upgradeItemId": "upgrade_kit_art_exhibition",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_AntiquesDealerBonus19e",
                "toBuildingId": "R_MultiAge_AntiquesDealerBonus19f",
                "upgradeItemId": "upgrade_kit_art_exhibition",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_AntiquesDealerBonus19f",
                "toBuildingId": "R_MultiAge_AntiquesDealerBonus19g",
                "upgradeItemId": "upgrade_kit_art_exhibition",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_AntiquesDealerBonus19g",
                "toBuildingId": "R_MultiAge_AntiquesDealerBonus19h",
                "upgradeItemId": "upgrade_kit_art_exhibition",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CulturalBuilding5a": {
        "baseBuildingId": "R_MultiAge_CulturalBuilding5a",
        "containedBuildingIds": [
            "R_MultiAge_CulturalBuilding5a",
            "R_MultiAge_CulturalBuilding5b",
            "R_MultiAge_CulturalBuilding5c",
            "R_MultiAge_CulturalBuilding5d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ancient_obelisk"
        ],
        "upgradeItems": {
            "upgrade_kit_ancient_obelisk": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ancient_obelisk",
                "name": "Ancient Obelisk Upgrade",
                "description": "Upgrades your Ancient Obelisk to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_ancient_obelisk",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding5a",
                "toBuildingId": "R_MultiAge_CulturalBuilding5b",
                "upgradeItemId": "upgrade_kit_ancient_obelisk",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding5b",
                "toBuildingId": "R_MultiAge_CulturalBuilding5c",
                "upgradeItemId": "upgrade_kit_ancient_obelisk",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding5c",
                "toBuildingId": "R_MultiAge_CulturalBuilding5d",
                "upgradeItemId": "upgrade_kit_ancient_obelisk",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "Z_MultiAge_CupBonus1": {
        "baseBuildingId": "Z_MultiAge_CupBonus1",
        "containedBuildingIds": [
            "Z_MultiAge_CupBonus1",
            "Z_MultiAge_CupBonus1b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_hall_of_fame"
        ],
        "upgradeItems": {
            "upgrade_kit_hall_of_fame": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_hall_of_fame",
                "name": "Hall of Fame Upgrade Kit",
                "description": "Upgrades your Hall of Fame to an improved version that will produce more guild power.",
                "iconAssetName": "upgrade_kit_hall_of_fame",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "Z_MultiAge_CupBonus1",
                "toBuildingId": "Z_MultiAge_CupBonus1b",
                "upgradeItemId": "upgrade_kit_hall_of_fame",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "A_MultiAge_SportBonus17": {
        "baseBuildingId": "A_MultiAge_SportBonus17",
        "containedBuildingIds": [
            "A_MultiAge_SportBonus17",
            "A_MultiAge_SportBonus17b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_winners_plaza"
        ],
        "upgradeItems": {
            "upgrade_kit_winners_plaza": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_winners_plaza",
                "name": "Winners' Plaza Upgrade Kit",
                "description": "Upgrades your Winners' Plaza to an improved version that will give higher attack boost for your attacking armies.",
                "iconAssetName": "upgrade_kit_winners_plaza",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_SportBonus17",
                "toBuildingId": "A_MultiAge_SportBonus17b",
                "upgradeItemId": "upgrade_kit_winners_plaza",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP20A1": {
        "baseBuildingId": "W_MultiAge_CUP20A1",
        "containedBuildingIds": [
            "W_MultiAge_CUP20A1",
            "W_MultiAge_CUP20A2",
            "W_MultiAge_CUP20A3",
            "W_MultiAge_CUP20A4",
            "W_MultiAge_CUP20A5",
            "W_MultiAge_CUP20A6"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_hippodrome_carceres"
        ],
        "upgradeItems": {
            "upgrade_kit_hippodrome_carceres": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_hippodrome_carceres",
                "name": "Carceres Upgrade Kit",
                "description": "Upgrades your Hippodrome Carceres to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_carceres",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20A1",
                "toBuildingId": "W_MultiAge_CUP20A2",
                "upgradeItemId": "upgrade_kit_hippodrome_carceres",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20A2",
                "toBuildingId": "W_MultiAge_CUP20A3",
                "upgradeItemId": "upgrade_kit_hippodrome_carceres",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20A3",
                "toBuildingId": "W_MultiAge_CUP20A4",
                "upgradeItemId": "upgrade_kit_hippodrome_carceres",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20A4",
                "toBuildingId": "W_MultiAge_CUP20A5",
                "upgradeItemId": "upgrade_kit_hippodrome_carceres",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20A5",
                "toBuildingId": "W_MultiAge_CUP20A6",
                "upgradeItemId": "upgrade_kit_hippodrome_carceres",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP20B1": {
        "baseBuildingId": "W_MultiAge_CUP20B1",
        "containedBuildingIds": [
            "W_MultiAge_CUP20B1",
            "W_MultiAge_CUP20B2",
            "W_MultiAge_CUP20B3",
            "W_MultiAge_CUP20B4",
            "W_MultiAge_CUP20B5",
            "W_MultiAge_CUP20B6"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_hippodrome_sphendone"
        ],
        "upgradeItems": {
            "upgrade_kit_hippodrome_sphendone": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_hippodrome_sphendone",
                "name": "Sphendone Upgrade Kit",
                "description": "Upgrades your Hippodrome Sphendone to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_sphendone",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20B1",
                "toBuildingId": "W_MultiAge_CUP20B2",
                "upgradeItemId": "upgrade_kit_hippodrome_sphendone",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20B2",
                "toBuildingId": "W_MultiAge_CUP20B3",
                "upgradeItemId": "upgrade_kit_hippodrome_sphendone",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20B3",
                "toBuildingId": "W_MultiAge_CUP20B4",
                "upgradeItemId": "upgrade_kit_hippodrome_sphendone",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20B4",
                "toBuildingId": "W_MultiAge_CUP20B5",
                "upgradeItemId": "upgrade_kit_hippodrome_sphendone",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP20B5",
                "toBuildingId": "W_MultiAge_CUP20B6",
                "upgradeItemId": "upgrade_kit_hippodrome_sphendone",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM20A1": {
        "baseBuildingId": "W_MultiAge_SUM20A1",
        "containedBuildingIds": [
            "W_MultiAge_SUM20A1",
            "W_MultiAge_SUM20A2",
            "W_MultiAge_SUM20A3",
            "W_MultiAge_SUM20A4",
            "W_MultiAge_SUM20A5",
            "W_MultiAge_SUM20A6",
            "W_MultiAge_SUM20A7",
            "W_MultiAge_SUM20A8",
            "W_MultiAge_SUM20A9",
            "W_MultiAge_SUM20A10",
            "W_MultiAge_SUM20A11",
            "W_MultiAge_SUM20A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_governors_villa",
            "golden_upgrade_kit_SUM20A",
            "platinum_upgrade_kit_SUM20A",
            "upgrade_kit_ascended_SUM20A"
        ],
        "upgradeItems": {
            "upgrade_kit_governors_villa": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_governors_villa",
                "name": "Governor's Villa Upgrade Kit",
                "description": "Upgrades your Governor's Villa to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_governors_villa",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_SUM20A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_SUM20A",
                "name": "Viceroy's Villa Upgrade Kit",
                "description": "Upgrades your Viceroy's Villa to its best version!",
                "iconAssetName": "golden_upgrade_kit_SUM20A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_SUM20A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_SUM20A",
                "name": "Crown Regent's Villa Platinum Upgrade Kit",
                "description": "Upgrades your Governor's Villa to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_SUM20A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_SUM20A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_SUM20A",
                "name": "Pirate King's Conquest Villa Upgrade Kit",
                "description": "Upgrades your Crown Regent's Villa to a time limited Pirate King's Conquest Villa that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_SUM20A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A1",
                "toBuildingId": "W_MultiAge_SUM20A2",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A2",
                "toBuildingId": "W_MultiAge_SUM20A3",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A3",
                "toBuildingId": "W_MultiAge_SUM20A4",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A4",
                "toBuildingId": "W_MultiAge_SUM20A5",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A5",
                "toBuildingId": "W_MultiAge_SUM20A6",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A6",
                "toBuildingId": "W_MultiAge_SUM20A7",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A7",
                "toBuildingId": "W_MultiAge_SUM20A8",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A8",
                "toBuildingId": "W_MultiAge_SUM20A9",
                "upgradeItemId": "upgrade_kit_governors_villa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A9",
                "toBuildingId": "W_MultiAge_SUM20A10",
                "upgradeItemId": "golden_upgrade_kit_SUM20A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A10",
                "toBuildingId": "W_MultiAge_SUM20A11",
                "upgradeItemId": "platinum_upgrade_kit_SUM20A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM20A11",
                "toBuildingId": "W_MultiAge_SUM20A12",
                "upgradeItemId": "upgrade_kit_ascended_SUM20A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_FallBonus20a": {
        "baseBuildingId": "R_MultiAge_FallBonus20a",
        "containedBuildingIds": [
            "R_MultiAge_FallBonus20a",
            "R_MultiAge_FallBonus20b",
            "R_MultiAge_FallBonus20c",
            "R_MultiAge_FallBonus20d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_harvest_barn"
        ],
        "upgradeItems": {
            "upgrade_kit_harvest_barn": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_harvest_barn",
                "name": "Harvest Barn Upgrade Kit",
                "description": "Upgrades your Harvest Barn to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_harvest_barn",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus20a",
                "toBuildingId": "R_MultiAge_FallBonus20b",
                "upgradeItemId": "upgrade_kit_harvest_barn",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus20b",
                "toBuildingId": "R_MultiAge_FallBonus20c",
                "upgradeItemId": "upgrade_kit_harvest_barn",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_FallBonus20c",
                "toBuildingId": "R_MultiAge_FallBonus20d",
                "upgradeItemId": "upgrade_kit_harvest_barn",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_HalloweenBonus20a": {
        "baseBuildingId": "R_MultiAge_HalloweenBonus20a",
        "containedBuildingIds": [
            "R_MultiAge_HalloweenBonus20a",
            "R_MultiAge_HalloweenBonus20b",
            "R_MultiAge_HalloweenBonus20c",
            "R_MultiAge_HalloweenBonus20d",
            "R_MultiAge_HalloweenBonus20e",
            "R_MultiAge_HalloweenBonus20f",
            "R_MultiAge_HalloweenBonus20gClown",
            "R_MultiAge_HalloweenBonus20gDemon",
            "R_MultiAge_HalloweenBonus20gWolf"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_house_of_horrors"
        ],
        "upgradeItems": {
            "upgrade_kit_house_of_horrors": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_house_of_horrors",
                "name": "House of Horrors Upgrade Kit",
                "description": "Upgrades your House of Horrors to an improved version that will produce more resources. Select a specialization on the highest level.",
                "iconAssetName": "upgrade_kit_house_of_horrors",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20a",
                "toBuildingId": "R_MultiAge_HalloweenBonus20b",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20b",
                "toBuildingId": "R_MultiAge_HalloweenBonus20c",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20c",
                "toBuildingId": "R_MultiAge_HalloweenBonus20d",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20d",
                "toBuildingId": "R_MultiAge_HalloweenBonus20e",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20e",
                "toBuildingId": "R_MultiAge_HalloweenBonus20f",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20f",
                "toBuildingId": "R_MultiAge_HalloweenBonus20gClown",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20f",
                "toBuildingId": "R_MultiAge_HalloweenBonus20gDemon",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonus20f",
                "toBuildingId": "R_MultiAge_HalloweenBonus20gWolf",
                "upgradeItemId": "upgrade_kit_house_of_horrors",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "T_AllAge_Expedition16": {
        "baseBuildingId": "T_AllAge_Expedition16",
        "containedBuildingIds": [
            "T_AllAge_Expedition16",
            "T_AllAge_Expedition16b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ritual_flame"
        ],
        "upgradeItems": {
            "upgrade_kit_ritual_flame": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ritual_flame",
                "name": "Ritual Flame Upgrade Kit",
                "description": "Upgrades your Ritual Flame to an improved version that will give a higher defense boost for your defending armies.",
                "iconAssetName": "upgrade_kit_ritual_flame",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "T_AllAge_Expedition16",
                "toBuildingId": "T_AllAge_Expedition16b",
                "upgradeItemId": "upgrade_kit_ritual_flame",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_Expedition16a": {
        "baseBuildingId": "R_MultiAge_Expedition16a",
        "containedBuildingIds": [
            "R_MultiAge_Expedition16a",
            "R_MultiAge_Expedition16c"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_tribal_square"
        ],
        "upgradeItems": {
            "upgrade_kit_tribal_square": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_tribal_square",
                "name": "Tribal Square Upgrade Kit",
                "description": "Upgrades your Tribal Square to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_tribal_square",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Expedition16a",
                "toBuildingId": "R_MultiAge_Expedition16c",
                "upgradeItemId": "upgrade_kit_tribal_square",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_Expedition16b": {
        "baseBuildingId": "D_MultiAge_Expedition16b",
        "containedBuildingIds": [
            "D_MultiAge_Expedition16b",
            "D_MultiAge_Expedition16d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_gate_of_the_sun_god"
        ],
        "upgradeItems": {
            "upgrade_kit_gate_of_the_sun_god": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_gate_of_the_sun_god",
                "name": "Gate Of The Sun God Upgrade Kit",
                "description": "Upgrades your Gate Of The Sun God to an improved version that will give a higher defense boost for your attacking armies.",
                "iconAssetName": "upgrade_kit_gate_of_the_sun_god",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition16b",
                "toBuildingId": "D_MultiAge_Expedition16d",
                "upgradeItemId": "upgrade_kit_gate_of_the_sun_god",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_Expedition16a": {
        "baseBuildingId": "D_MultiAge_Expedition16a",
        "containedBuildingIds": [
            "D_MultiAge_Expedition16a",
            "D_MultiAge_Expedition16c"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_face_of_the_ancient"
        ],
        "upgradeItems": {
            "upgrade_kit_face_of_the_ancient": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_face_of_the_ancient",
                "name": "Face Of The Ancient Upgrade Kit",
                "description": "Upgrades your Face Of The Ancient to an improved version that will give a higher attack boost for your attacking armies.",
                "iconAssetName": "upgrade_kit_face_of_the_ancient",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition16a",
                "toBuildingId": "D_MultiAge_Expedition16c",
                "upgradeItemId": "upgrade_kit_face_of_the_ancient",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_Expedition16aBase": {
        "baseBuildingId": "W_MultiAge_Expedition16aBase",
        "containedBuildingIds": [
            "W_MultiAge_Expedition16aBase",
            "W_MultiAge_Expedition16bBase",
            "W_MultiAge_Expedition16cSilver",
            "W_MultiAge_Expedition16dGold",
            "W_MultiAge_Expedition16ePlatinum"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_terrace_farm",
            "upgrade_kit_silver_terrace_farm",
            "upgrade_kit_gold_terrace_farm",
            "upgrade_kit_platinum_terrace_farm"
        ],
        "upgradeItems": {
            "upgrade_kit_terrace_farm": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_terrace_farm",
                "name": "Terrace Farm Upgrade Kit",
                "description": "Upgrades your Terrace Farm to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_terrace_farm",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_silver_terrace_farm": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_silver_terrace_farm",
                "name": "Terrace Farm Silver Upgrade Kit",
                "description": "Upgrades your Terrace Farm to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_silver_terrace_farm",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_gold_terrace_farm": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_gold_terrace_farm",
                "name": "Terrace Farm Gold Upgrade Kit",
                "description": "Upgrades your Terrace Farm to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_gold_terrace_farm",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_platinum_terrace_farm": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_platinum_terrace_farm",
                "name": "Terrace Farm Platinum Upgrade Kit",
                "description": "Upgrades your Terrace Farm to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_platinum_terrace_farm",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_Expedition16aBase",
                "toBuildingId": "W_MultiAge_Expedition16bBase",
                "upgradeItemId": "upgrade_kit_terrace_farm",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_Expedition16bBase",
                "toBuildingId": "W_MultiAge_Expedition16cSilver",
                "upgradeItemId": "upgrade_kit_silver_terrace_farm",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_Expedition16cSilver",
                "toBuildingId": "W_MultiAge_Expedition16dGold",
                "upgradeItemId": "upgrade_kit_gold_terrace_farm",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_Expedition16dGold",
                "toBuildingId": "W_MultiAge_Expedition16ePlatinum",
                "upgradeItemId": "upgrade_kit_platinum_terrace_farm",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_Expedition16b": {
        "baseBuildingId": "R_MultiAge_Expedition16b",
        "containedBuildingIds": [
            "R_MultiAge_Expedition16b",
            "R_MultiAge_Expedition16d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_sacred_sky"
        ],
        "upgradeItems": {
            "upgrade_kit_sacred_sky": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_sacred_sky",
                "name": "Sacred Sky Watch Upgrade Kit",
                "description": "Upgrades your Sacred Sky Watch to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_sacred_sky",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Expedition16b",
                "toBuildingId": "R_MultiAge_Expedition16d",
                "upgradeItemId": "upgrade_kit_sacred_sky",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_AllAge_Expedition16": {
        "baseBuildingId": "W_AllAge_Expedition16",
        "containedBuildingIds": [
            "W_AllAge_Expedition16",
            "W_AllAge_Expedition16Small",
            "W_AllAge_Expedition24Tiny"
        ],
        "containedUpgradeItemIds": [
            "shrink_kit_fountain_of_youth",
            "shrink_kit_little_fountain_of_youth"
        ],
        "upgradeItems": {
            "shrink_kit_fountain_of_youth": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "shrink_kit_fountain_of_youth",
                "name": "Fountain Of Youth Shrink Kit",
                "description": "Use this Shrink Kit to make your Fountain Of Youth more compact in size whilst still remaining just as powerful.",
                "iconAssetName": "shrink_kit_fountain_of_youth",
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "shrink_kit_little_fountain_of_youth": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "shrink_kit_little_fountain_of_youth",
                "name": "Little Fountain of Youth Shrink Kit",
                "description": "Use this Shrink Kit to make your Little Fountain Of Youth more compact in size whilst still remaining just as powerful.",
                "iconAssetName": "shrink_kit_little_fountain_of_youth",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_AllAge_Expedition16",
                "toBuildingId": "W_AllAge_Expedition16Small",
                "upgradeItemId": "shrink_kit_fountain_of_youth",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_AllAge_Expedition16Small",
                "toBuildingId": "W_AllAge_Expedition24Tiny",
                "upgradeItemId": "shrink_kit_little_fountain_of_youth",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CulturalBuilding8a": {
        "baseBuildingId": "R_MultiAge_CulturalBuilding8a",
        "containedBuildingIds": [
            "R_MultiAge_CulturalBuilding8a",
            "R_MultiAge_CulturalBuilding8b",
            "R_MultiAge_CulturalBuilding8c",
            "R_MultiAge_CulturalBuilding8d",
            "R_MultiAge_CulturalBuilding8e"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_jade_statue"
        ],
        "upgradeItems": {
            "upgrade_kit_jade_statue": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_jade_statue",
                "name": "Jade Statue Upgrade Kit",
                "description": "Upgrades your Jade Statue building",
                "iconAssetName": "upgrade_kit_jade_statue",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding8a",
                "toBuildingId": "R_MultiAge_CulturalBuilding8b",
                "upgradeItemId": "upgrade_kit_jade_statue",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding8b",
                "toBuildingId": "R_MultiAge_CulturalBuilding8c",
                "upgradeItemId": "upgrade_kit_jade_statue",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding8c",
                "toBuildingId": "R_MultiAge_CulturalBuilding8d",
                "upgradeItemId": "upgrade_kit_jade_statue",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding8d",
                "toBuildingId": "R_MultiAge_CulturalBuilding8e",
                "upgradeItemId": "upgrade_kit_jade_statue",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_WinterBonus20a": {
        "baseBuildingId": "R_MultiAge_WinterBonus20a",
        "containedBuildingIds": [
            "R_MultiAge_WinterBonus20a",
            "R_MultiAge_WinterBonus20b",
            "R_MultiAge_WinterBonus20c",
            "R_MultiAge_WinterBonus20d",
            "R_MultiAge_WinterBonus20e",
            "R_MultiAge_WinterBonus20fGingerbread",
            "R_MultiAge_WinterBonus20fMarzipan",
            "R_MultiAge_WinterBonus20fPatisserie",
            "R_MultiAge_WinterBonus20fLussebullar"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_winter_bakery"
        ],
        "upgradeItems": {
            "upgrade_kit_winter_bakery": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_winter_bakery",
                "name": "Winter Bakery Upgrade Kit",
                "description": "Upgrades your Winter Bakery to an improved version that will produce more resources. Select a specialization on the highest level.",
                "iconAssetName": "upgrade_kit_winter_bakery",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20a",
                "toBuildingId": "R_MultiAge_WinterBonus20b",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20b",
                "toBuildingId": "R_MultiAge_WinterBonus20c",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20c",
                "toBuildingId": "R_MultiAge_WinterBonus20d",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20d",
                "toBuildingId": "R_MultiAge_WinterBonus20e",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20e",
                "toBuildingId": "R_MultiAge_WinterBonus20fGingerbread",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20e",
                "toBuildingId": "R_MultiAge_WinterBonus20fMarzipan",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20e",
                "toBuildingId": "R_MultiAge_WinterBonus20fPatisserie",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus20e",
                "toBuildingId": "R_MultiAge_WinterBonus20fLussebullar",
                "upgradeItemId": "upgrade_kit_winter_bakery",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_BOWL21A1": {
        "baseBuildingId": "W_MultiAge_BOWL21A1",
        "containedBuildingIds": [
            "W_MultiAge_BOWL21A1",
            "W_MultiAge_BOWL21A2",
            "W_MultiAge_BOWL21A3",
            "W_MultiAge_BOWL21A4",
            "W_MultiAge_BOWL21A5",
            "W_MultiAge_BOWL21A6",
            "W_MultiAge_BOWL21A7",
            "W_MultiAge_BOWL21A8"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_terracotta_vineyard"
        ],
        "upgradeItems": {
            "upgrade_kit_terracotta_vineyard": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_terracotta_vineyard",
                "name": "Terracotta Vineyard Upgrade Kit",
                "description": "Upgrades your Terracotta Vineyard to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_terracotta_vineyard",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL21A1",
                "toBuildingId": "W_MultiAge_BOWL21A2",
                "upgradeItemId": "upgrade_kit_terracotta_vineyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL21A2",
                "toBuildingId": "W_MultiAge_BOWL21A3",
                "upgradeItemId": "upgrade_kit_terracotta_vineyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL21A3",
                "toBuildingId": "W_MultiAge_BOWL21A4",
                "upgradeItemId": "upgrade_kit_terracotta_vineyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL21A4",
                "toBuildingId": "W_MultiAge_BOWL21A5",
                "upgradeItemId": "upgrade_kit_terracotta_vineyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL21A5",
                "toBuildingId": "W_MultiAge_BOWL21A6",
                "upgradeItemId": "upgrade_kit_terracotta_vineyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL21A6",
                "toBuildingId": "W_MultiAge_BOWL21A7",
                "upgradeItemId": "upgrade_kit_terracotta_vineyard",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL21A7",
                "toBuildingId": "W_MultiAge_BOWL21A8",
                "upgradeItemId": "upgrade_kit_terracotta_vineyard",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT21A1": {
        "baseBuildingId": "W_MultiAge_PAT21A1",
        "containedBuildingIds": [
            "W_MultiAge_PAT21A1",
            "W_MultiAge_PAT21A2",
            "W_MultiAge_PAT21A3",
            "W_MultiAge_PAT21A4",
            "W_MultiAge_PAT21A5",
            "W_MultiAge_PAT21A6",
            "W_MultiAge_PAT21A7",
            "W_MultiAge_PAT21A8",
            "W_MultiAge_PAT21A9",
            "W_MultiAge_PAT21A10",
            "W_MultiAge_PAT21A11",
            "W_MultiAge_PAT21A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_druid_temple",
            "silver_upgrade_kit_PAT21A",
            "golden_upgrade_kit_PAT21A"
        ],
        "upgradeItems": {
            "upgrade_kit_druid_temple": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_druid_temple",
                "name": "Druid Temple Upgrade Kit",
                "description": "Upgrades your Druid Temple to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_druid_temple",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_PAT21A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_PAT21A",
                "name": "Forgotten Druid Temple Silver Upgrade Kit",
                "description": "Upgrades your Druid Temple to its second best version!",
                "iconAssetName": "silver_upgrade_kit_PAT21A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_PAT21A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_PAT21A",
                "name": "Lost Druid Temple Golden Upgrade Kit",
                "description": "Upgrades your Druid Temple to its best version!",
                "iconAssetName": "golden_upgrade_kit_PAT21A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A1",
                "toBuildingId": "W_MultiAge_PAT21A2",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A2",
                "toBuildingId": "W_MultiAge_PAT21A3",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A3",
                "toBuildingId": "W_MultiAge_PAT21A4",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A4",
                "toBuildingId": "W_MultiAge_PAT21A5",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A5",
                "toBuildingId": "W_MultiAge_PAT21A6",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A6",
                "toBuildingId": "W_MultiAge_PAT21A7",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A7",
                "toBuildingId": "W_MultiAge_PAT21A8",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A8",
                "toBuildingId": "W_MultiAge_PAT21A9",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A9",
                "toBuildingId": "W_MultiAge_PAT21A10",
                "upgradeItemId": "upgrade_kit_druid_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A10",
                "toBuildingId": "W_MultiAge_PAT21A11",
                "upgradeItemId": "silver_upgrade_kit_PAT21A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT21A11",
                "toBuildingId": "W_MultiAge_PAT21A12",
                "upgradeItemId": "golden_upgrade_kit_PAT21A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SpringBonus21a": {
        "baseBuildingId": "R_MultiAge_SpringBonus21a",
        "containedBuildingIds": [
            "R_MultiAge_SpringBonus21a",
            "R_MultiAge_SpringBonus21b",
            "R_MultiAge_SpringBonus21c",
            "R_MultiAge_SpringBonus21d",
            "R_MultiAge_SpringBonus21e",
            "R_MultiAge_SpringBonus21f",
            "R_MultiAge_SpringBonus21g",
            "R_MultiAge_SpringBonus21h",
            "R_MultiAge_SpringBonus21i"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_suishun_mill"
        ],
        "upgradeItems": {
            "upgrade_kit_suishun_mill": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_suishun_mill",
                "name": "Suishun Mill Upgrade Kit",
                "description": "Upgrades your Suishun Mill to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_suishun_mill",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21a",
                "toBuildingId": "R_MultiAge_SpringBonus21b",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21b",
                "toBuildingId": "R_MultiAge_SpringBonus21c",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21c",
                "toBuildingId": "R_MultiAge_SpringBonus21d",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21d",
                "toBuildingId": "R_MultiAge_SpringBonus21e",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21e",
                "toBuildingId": "R_MultiAge_SpringBonus21f",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21f",
                "toBuildingId": "R_MultiAge_SpringBonus21g",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21g",
                "toBuildingId": "R_MultiAge_SpringBonus21h",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SpringBonus21h",
                "toBuildingId": "R_MultiAge_SpringBonus21i",
                "upgradeItemId": "upgrade_kit_suishun_mill",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_ArcheologyBonus21a": {
        "baseBuildingId": "R_MultiAge_ArcheologyBonus21a",
        "containedBuildingIds": [
            "R_MultiAge_ArcheologyBonus21a",
            "R_MultiAge_ArcheologyBonus21b",
            "R_MultiAge_ArcheologyBonus21c",
            "R_MultiAge_ArcheologyBonus21d",
            "R_MultiAge_ArcheologyBonus21e",
            "R_MultiAge_ArcheologyBonus21f",
            "R_MultiAge_ArcheologyBonus21g",
            "R_MultiAge_ArcheologyBonus21h",
            "R_MultiAge_ArcheologyBonus21i",
            "R_MultiAge_ArcheologyBonus21jWonder",
            "R_MultiAge_ArcheologyBonus21jGreat"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ferris_wheel"
        ],
        "upgradeItems": {
            "upgrade_kit_ferris_wheel": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ferris_wheel",
                "name": "Ferris Wheel Upgrade Kit",
                "description": "Upgrades your Ferris Wheel to an improved version that will produce more resources. Select a specialization on the highest level.",
                "iconAssetName": "upgrade_kit_ferris_wheel",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21a",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21b",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21b",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21c",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21c",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21d",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21d",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21e",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21e",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21f",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21f",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21g",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21g",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21h",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21h",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21i",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21i",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21jWonder",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus21i",
                "toBuildingId": "R_MultiAge_ArcheologyBonus21jGreat",
                "upgradeItemId": "upgrade_kit_ferris_wheel",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_SoccerBonus21a": {
        "baseBuildingId": "R_MultiAge_SoccerBonus21a",
        "containedBuildingIds": [
            "R_MultiAge_SoccerBonus21a",
            "R_MultiAge_SoccerBonus21b",
            "R_MultiAge_SoccerBonus21c",
            "R_MultiAge_SoccerBonus21d",
            "R_MultiAge_SoccerBonus21e",
            "R_MultiAge_SoccerBonus21f",
            "R_MultiAge_SoccerBonus21g",
            "R_MultiAge_SoccerBonus21h",
            "R_MultiAge_SoccerBonus21i",
            "R_MultiAge_SoccerBonus21j",
            "R_MultiAge_SoccerBonus21k"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_athlon_abbey",
            "golden_upgrade_kit_CUP21A"
        ],
        "upgradeItems": {
            "upgrade_kit_athlon_abbey": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_athlon_abbey",
                "name": "Athlon Abbey Upgrade Kit",
                "description": "Upgrades your Athlon Abbey to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_athlon_abbey",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_CUP21A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_CUP21A",
                "name": "Azure Athlon Abbey Golden Upgrade Kit",
                "description": "Upgrades your Athlon Abbey to its best version!",
                "iconAssetName": "golden_upgrade_kit_CUP21A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21a",
                "toBuildingId": "R_MultiAge_SoccerBonus21b",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21b",
                "toBuildingId": "R_MultiAge_SoccerBonus21c",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21c",
                "toBuildingId": "R_MultiAge_SoccerBonus21d",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21d",
                "toBuildingId": "R_MultiAge_SoccerBonus21e",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21e",
                "toBuildingId": "R_MultiAge_SoccerBonus21f",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21f",
                "toBuildingId": "R_MultiAge_SoccerBonus21g",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21g",
                "toBuildingId": "R_MultiAge_SoccerBonus21h",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21h",
                "toBuildingId": "R_MultiAge_SoccerBonus21i",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21i",
                "toBuildingId": "R_MultiAge_SoccerBonus21j",
                "upgradeItemId": "upgrade_kit_athlon_abbey",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_SoccerBonus21j",
                "toBuildingId": "R_MultiAge_SoccerBonus21k",
                "upgradeItemId": "golden_upgrade_kit_CUP21A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD21A1": {
        "baseBuildingId": "W_MultiAge_WILD21A1",
        "containedBuildingIds": [
            "W_MultiAge_WILD21A1",
            "W_MultiAge_WILD21A2",
            "W_MultiAge_WILD21A3",
            "W_MultiAge_WILD21A4",
            "W_MultiAge_WILD21A5",
            "W_MultiAge_WILD21A6",
            "W_MultiAge_WILD21A7a",
            "W_MultiAge_WILD21A7c",
            "W_MultiAge_WILD21A7b",
            "W_MultiAge_WILD21A8a",
            "W_MultiAge_WILD21A8b",
            "W_MultiAge_WILD21A8c"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_mountain_reserve",
            "golden_upgrade_kit_WILD21Aa",
            "golden_upgrade_kit_WILD21Ab",
            "golden_upgrade_kit_WILD21Ac"
        ],
        "upgradeItems": {
            "upgrade_kit_mountain_reserve": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_mountain_reserve",
                "name": "Mountain Reserve Upgrade Kit",
                "description": "Upgrades your Mountain Reserve to an improved version that will produce more resources. Select a specialization on the highest level!",
                "iconAssetName": "upgrade_kit_mountain_reserve",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD21Aa": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD21Aa",
                "name": "Serene Bear Mountain Golden Upgrade Kit",
                "description": "Upgrades your Mountain Reserve to its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD21Aa",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD21Ab": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD21Ab",
                "name": "Serene Eagle Mountain Golden Upgrade Kit",
                "description": "Upgrades your Mountain Reserve to its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD21Ab",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD21Ac": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD21Ac",
                "name": "Serene Moose Mountain Golden Upgrade Kit",
                "description": "Upgrades your Mountain Reserve to its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD21Ac",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A1",
                "toBuildingId": "W_MultiAge_WILD21A2",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A2",
                "toBuildingId": "W_MultiAge_WILD21A3",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A3",
                "toBuildingId": "W_MultiAge_WILD21A4",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A4",
                "toBuildingId": "W_MultiAge_WILD21A5",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A5",
                "toBuildingId": "W_MultiAge_WILD21A6",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A6",
                "toBuildingId": "W_MultiAge_WILD21A7a",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A6",
                "toBuildingId": "W_MultiAge_WILD21A7c",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A6",
                "toBuildingId": "W_MultiAge_WILD21A7b",
                "upgradeItemId": "upgrade_kit_mountain_reserve",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A7a",
                "toBuildingId": "W_MultiAge_WILD21A8a",
                "upgradeItemId": "golden_upgrade_kit_WILD21Aa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A7b",
                "toBuildingId": "W_MultiAge_WILD21A8b",
                "upgradeItemId": "golden_upgrade_kit_WILD21Ab",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD21A7c",
                "toBuildingId": "W_MultiAge_WILD21A8c",
                "upgradeItemId": "golden_upgrade_kit_WILD21Ac",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_Battlegrounds1a": {
        "baseBuildingId": "R_MultiAge_Battlegrounds1a",
        "containedBuildingIds": [
            "R_MultiAge_Battlegrounds1a",
            "R_MultiAge_Battlegrounds1b",
            "R_MultiAge_Battlegrounds1c",
            "R_MultiAge_Battlegrounds1d",
            "R_MultiAge_Battlegrounds1e",
            "R_MultiAge_Battlegrounds1f",
            "R_MultiAge_Battlegrounds1g",
            "R_MultiAge_Battlegrounds1h"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_statue_of_honor"
        ],
        "upgradeItems": {
            "upgrade_kit_statue_of_honor": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_statue_of_honor",
                "name": "Statue Of Honor Upgrade Kit",
                "description": "Upgrades your Statue of Honor to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_statue_of_honor",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds1a",
                "toBuildingId": "R_MultiAge_Battlegrounds1b",
                "upgradeItemId": "upgrade_kit_statue_of_honor",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds1b",
                "toBuildingId": "R_MultiAge_Battlegrounds1c",
                "upgradeItemId": "upgrade_kit_statue_of_honor",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds1c",
                "toBuildingId": "R_MultiAge_Battlegrounds1d",
                "upgradeItemId": "upgrade_kit_statue_of_honor",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds1d",
                "toBuildingId": "R_MultiAge_Battlegrounds1e",
                "upgradeItemId": "upgrade_kit_statue_of_honor",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds1e",
                "toBuildingId": "R_MultiAge_Battlegrounds1f",
                "upgradeItemId": "upgrade_kit_statue_of_honor",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds1f",
                "toBuildingId": "R_MultiAge_Battlegrounds1g",
                "upgradeItemId": "upgrade_kit_statue_of_honor",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds1g",
                "toBuildingId": "R_MultiAge_Battlegrounds1h",
                "upgradeItemId": "upgrade_kit_statue_of_honor",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FallBonus21a": {
        "baseBuildingId": "W_MultiAge_FallBonus21a",
        "containedBuildingIds": [
            "W_MultiAge_FallBonus21a",
            "W_MultiAge_FallBonus21b",
            "W_MultiAge_FallBonus21c",
            "W_MultiAge_FallBonus21d",
            "W_MultiAge_FallBonus21e",
            "W_MultiAge_FallBonus21f",
            "W_MultiAge_FallBonus21g",
            "W_MultiAge_FallBonus21h",
            "W_MultiAge_FallBonus21i",
            "W_MultiAge_FALL21A10",
            "W_MultiAge_FALL21A11",
            "W_MultiAge_FALL21A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_golden_crops",
            "golden_upgrade_kit_FALL21A",
            "platinum_upgrade_kit_FALL21A",
            "upgrade_kit_ascended_FALL21A"
        ],
        "upgradeItems": {
            "upgrade_kit_golden_crops": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_golden_crops",
                "name": "Golden Crops Upgrade Kit",
                "description": "Upgrades your Golden Crops building to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_golden_crops",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FALL21A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FALL21A",
                "name": "Golden Crops Harvest Golden Upgrade Kit ",
                "description": "Upgrades your Golden Crops to its best version!",
                "iconAssetName": "golden_upgrade_kit_FALL21A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_FALL21A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_FALL21A",
                "name": "Golden Crops Feast Platinum Upgrade Kit ",
                "description": "Upgrades your Golden Crops to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_FALL21A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_FALL21A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FALL21A",
                "name": "Ascended Golden Crops Feast Upgrade Kit ",
                "description": "Upgrades your Golden Crops Feast to a time-limited Ascended Golden Crops Feast that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FALL21A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21a",
                "toBuildingId": "W_MultiAge_FallBonus21b",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21b",
                "toBuildingId": "W_MultiAge_FallBonus21c",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21c",
                "toBuildingId": "W_MultiAge_FallBonus21d",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21d",
                "toBuildingId": "W_MultiAge_FallBonus21e",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21e",
                "toBuildingId": "W_MultiAge_FallBonus21f",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21f",
                "toBuildingId": "W_MultiAge_FallBonus21g",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21g",
                "toBuildingId": "W_MultiAge_FallBonus21h",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21h",
                "toBuildingId": "W_MultiAge_FallBonus21i",
                "upgradeItemId": "upgrade_kit_golden_crops",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FallBonus21i",
                "toBuildingId": "W_MultiAge_FALL21A10",
                "upgradeItemId": "golden_upgrade_kit_FALL21A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL21A10",
                "toBuildingId": "W_MultiAge_FALL21A11",
                "upgradeItemId": "platinum_upgrade_kit_FALL21A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL21A11",
                "toBuildingId": "W_MultiAge_FALL21A12",
                "upgradeItemId": "upgrade_kit_ascended_FALL21A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_WinterBonus21a": {
        "baseBuildingId": "R_MultiAge_WinterBonus21a",
        "containedBuildingIds": [
            "R_MultiAge_WinterBonus21a",
            "R_MultiAge_WinterBonus21b",
            "R_MultiAge_WinterBonus21c",
            "R_MultiAge_WinterBonus21d",
            "R_MultiAge_WinterBonus21e",
            "R_MultiAge_WinterBonus21f",
            "R_MultiAge_WinterBonus21g",
            "R_MultiAge_WinterBonus21h",
            "R_MultiAge_WinterBonus21i",
            "R_MultiAge_WinterBonus21jFestive",
            "R_MultiAge_WinterBonus21jJolie"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_winter_canal"
        ],
        "upgradeItems": {
            "upgrade_kit_winter_canal": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_winter_canal",
                "name": "Winter Canal Upgrade Kit",
                "description": "Upgrades your Winter Canal to an improved version that will produce more resources. Select a specialization on the highest level!",
                "iconAssetName": "upgrade_kit_winter_canal",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21a",
                "toBuildingId": "R_MultiAge_WinterBonus21b",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21b",
                "toBuildingId": "R_MultiAge_WinterBonus21c",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21c",
                "toBuildingId": "R_MultiAge_WinterBonus21d",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21d",
                "toBuildingId": "R_MultiAge_WinterBonus21e",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21e",
                "toBuildingId": "R_MultiAge_WinterBonus21f",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21f",
                "toBuildingId": "R_MultiAge_WinterBonus21g",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21g",
                "toBuildingId": "R_MultiAge_WinterBonus21h",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21h",
                "toBuildingId": "R_MultiAge_WinterBonus21i",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21i",
                "toBuildingId": "R_MultiAge_WinterBonus21jFestive",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_WinterBonus21i",
                "toBuildingId": "R_MultiAge_WinterBonus21jJolie",
                "upgradeItemId": "upgrade_kit_winter_canal",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM21A1": {
        "baseBuildingId": "W_MultiAge_SUM21A1",
        "containedBuildingIds": [
            "W_MultiAge_SUM21A1",
            "W_MultiAge_SUM21A2",
            "W_MultiAge_SUM21A3",
            "W_MultiAge_SUM21A4",
            "W_MultiAge_SUM21A5",
            "W_MultiAge_SUM21A6",
            "W_MultiAge_SUM21A7",
            "W_MultiAge_SUM21A8",
            "W_MultiAge_SUM21A9"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_pirates_hideout"
        ],
        "upgradeItems": {
            "upgrade_kit_pirates_hideout": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_pirates_hideout",
                "name": "Pirate's Hideout Upgrade Kit",
                "description": "Upgrades your Pirate's Hideout to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_pirates_hideout",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A1",
                "toBuildingId": "W_MultiAge_SUM21A2",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A2",
                "toBuildingId": "W_MultiAge_SUM21A3",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A3",
                "toBuildingId": "W_MultiAge_SUM21A4",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A4",
                "toBuildingId": "W_MultiAge_SUM21A5",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A5",
                "toBuildingId": "W_MultiAge_SUM21A6",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A6",
                "toBuildingId": "W_MultiAge_SUM21A7",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A7",
                "toBuildingId": "W_MultiAge_SUM21A8",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM21A8",
                "toBuildingId": "W_MultiAge_SUM21A9",
                "upgradeItemId": "upgrade_kit_pirates_hideout",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_HalloweenBonusSet21c": {
        "baseBuildingId": "R_MultiAge_HalloweenBonusSet21c",
        "containedBuildingIds": [
            "R_MultiAge_HalloweenBonusSet21c",
            "R_MultiAge_HalloweenBonusSet21d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_clown_town"
        ],
        "upgradeItems": {
            "upgrade_kit_clown_town": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_clown_town",
                "name": "Clown Town Upgrade Kit",
                "description": "Upgrades your Clown Town to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_clown_town",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonusSet21c",
                "toBuildingId": "R_MultiAge_HalloweenBonusSet21d",
                "upgradeItemId": "upgrade_kit_clown_town",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_HalloweenBonusSet21a": {
        "baseBuildingId": "R_MultiAge_HalloweenBonusSet21a",
        "containedBuildingIds": [
            "R_MultiAge_HalloweenBonusSet21a",
            "R_MultiAge_HalloweenBonusSet21b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_helter_skelter"
        ],
        "upgradeItems": {
            "upgrade_kit_helter_skelter": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_helter_skelter",
                "name": "Helter Skelter Upgrade Kit",
                "description": "Upgrades your Helter Skelter to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_helter_skelter",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_HalloweenBonusSet21a",
                "toBuildingId": "R_MultiAge_HalloweenBonusSet21b",
                "upgradeItemId": "upgrade_kit_helter_skelter",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "A_MultiAge_HalloweenBonusSet21a": {
        "baseBuildingId": "A_MultiAge_HalloweenBonusSet21a",
        "containedBuildingIds": [
            "A_MultiAge_HalloweenBonusSet21a",
            "A_MultiAge_HalloweenBonusSet21b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_terror_teacups"
        ],
        "upgradeItems": {
            "upgrade_kit_terror_teacups": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_terror_teacups",
                "name": "Terror Teacups Upgrade Kit",
                "description": "Upgrades your Terror Teacups to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_terror_teacups",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "A_MultiAge_HalloweenBonusSet21a",
                "toBuildingId": "A_MultiAge_HalloweenBonusSet21b",
                "upgradeItemId": "upgrade_kit_terror_teacups",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "L_AllAge_HalloweenBonusSet21a": {
        "baseBuildingId": "L_AllAge_HalloweenBonusSet21a",
        "containedBuildingIds": [
            "L_AllAge_HalloweenBonusSet21a",
            "L_AllAge_HalloweenBonusSet21b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_wheel_of_death"
        ],
        "upgradeItems": {
            "upgrade_kit_wheel_of_death": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_wheel_of_death",
                "name": "Wheel of Death Upgrade Kit",
                "description": "Upgrades your Wheel of Death to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_wheel_of_death",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "L_AllAge_HalloweenBonusSet21a",
                "toBuildingId": "L_AllAge_HalloweenBonusSet21b",
                "upgradeItemId": "upgrade_kit_wheel_of_death",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_HalloweenBonusSet21a": {
        "baseBuildingId": "D_MultiAge_HalloweenBonusSet21a",
        "containedBuildingIds": [
            "D_MultiAge_HalloweenBonusSet21a",
            "D_MultiAge_HalloweenBonusSet21b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_mystical_organ"
        ],
        "upgradeItems": {
            "upgrade_kit_mystical_organ": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_mystical_organ",
                "name": "Mystical Organ Upgrade Kit",
                "description": "Upgrades your Mystical Organ to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_mystical_organ",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_HalloweenBonusSet21a",
                "toBuildingId": "D_MultiAge_HalloweenBonusSet21b",
                "upgradeItemId": "upgrade_kit_mystical_organ",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_BOWL22A1": {
        "baseBuildingId": "W_MultiAge_BOWL22A1",
        "containedBuildingIds": [
            "W_MultiAge_BOWL22A1",
            "W_MultiAge_BOWL22A2",
            "W_MultiAge_BOWL22A3",
            "W_MultiAge_BOWL22A4",
            "W_MultiAge_BOWL22A5",
            "W_MultiAge_BOWL22A6",
            "W_MultiAge_BOWL22A7",
            "W_MultiAge_BOWL22A8",
            "W_MultiAge_BOWL22A9",
            "W_MultiAge_BOWL22A10",
            "W_MultiAge_BOWL22A11",
            "W_MultiAge_BOWL22A12",
            "W_MultiAge_BOWL22A13"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_fiore_village",
            "golden_upgrade_kit_BOWL22A",
            "silver_upgrade_kit_BOWL22A",
            "platinum_upgrade_kit_BOWL22A",
            "upgrade_kit_ascended_BOWL22A"
        ],
        "upgradeItems": {
            "upgrade_kit_fiore_village": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_fiore_village",
                "name": "Fiore Village Upgrade Kit",
                "description": "Upgrades your Fiore Village to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_fiore_village",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_BOWL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_BOWL22A",
                "name": "Evergreen Fiore Village Golden Upgrade Kit",
                "description": "Upgrades your Fiore Village to its best version!",
                "iconAssetName": "golden_upgrade_kit_BOWL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_BOWL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_BOWL22A",
                "name": "Evergreen Fiore Village Silver Upgrade Kit",
                "description": "Upgrades your Fiore Village to its second best version!",
                "iconAssetName": "silver_upgrade_kit_BOWL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_BOWL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_BOWL22A",
                "name": "Everbloom Fiore Village Platinum Upgrade Kit",
                "description": "Upgrades your Fiore Village to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_BOWL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_BOWL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_BOWL22A",
                "name": "Everblossom Fiore Village Upgrade Kit",
                "description": "Upgrades your Everbloom Fiore Village to a time limited Everblossom Fiore Village that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_BOWL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A1",
                "toBuildingId": "W_MultiAge_BOWL22A2",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A2",
                "toBuildingId": "W_MultiAge_BOWL22A3",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A3",
                "toBuildingId": "W_MultiAge_BOWL22A4",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A4",
                "toBuildingId": "W_MultiAge_BOWL22A5",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A5",
                "toBuildingId": "W_MultiAge_BOWL22A6",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A6",
                "toBuildingId": "W_MultiAge_BOWL22A7",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A7",
                "toBuildingId": "W_MultiAge_BOWL22A8",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A8",
                "toBuildingId": "W_MultiAge_BOWL22A9",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A9",
                "toBuildingId": "W_MultiAge_BOWL22A10",
                "upgradeItemId": "upgrade_kit_fiore_village",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A10",
                "toBuildingId": "W_MultiAge_BOWL22A11",
                "upgradeItemId": "golden_upgrade_kit_BOWL22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A10",
                "toBuildingId": "W_MultiAge_BOWL22A11",
                "upgradeItemId": "silver_upgrade_kit_BOWL22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A11",
                "toBuildingId": "W_MultiAge_BOWL22A12",
                "upgradeItemId": "platinum_upgrade_kit_BOWL22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL22A12",
                "toBuildingId": "W_MultiAge_BOWL22A13",
                "upgradeItemId": "upgrade_kit_ascended_BOWL22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT22A1": {
        "baseBuildingId": "W_MultiAge_PAT22A1",
        "containedBuildingIds": [
            "W_MultiAge_PAT22A1",
            "W_MultiAge_PAT22A2",
            "W_MultiAge_PAT22A3",
            "W_MultiAge_PAT22A4",
            "W_MultiAge_PAT22A5",
            "W_MultiAge_PAT22A6",
            "W_MultiAge_PAT22A7",
            "W_MultiAge_PAT22A8",
            "W_MultiAge_PAT22A9",
            "W_MultiAge_PAT22A10",
            "W_MultiAge_PAT22A11",
            "W_MultiAge_PAT22A12",
            "W_MultiAge_PAT22A13"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_celtic_farmstead",
            "silver_upgrade_kit_PAT22A",
            "golden_upgrade_kit_PAT22A",
            "platinum_upgrade_kit_PAT22A"
        ],
        "upgradeItems": {
            "upgrade_kit_celtic_farmstead": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_celtic_farmstead",
                "name": "Celtic Farmstead Upgrade Kit",
                "description": "Upgrades your Celtic Farmstead to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_celtic_farmstead",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_PAT22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_PAT22A",
                "name": "Enchanted Celtic Farmstead Silver Upgrade Kit",
                "description": "Upgrades your Celtic Farmstead to its second best version!",
                "iconAssetName": "silver_upgrade_kit_PAT22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_PAT22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_PAT22A",
                "name": "Mystic Celtic Farmstead Golden Upgrade Kit",
                "description": "Upgrades your Celtic Farmstead to its best version!",
                "iconAssetName": "golden_upgrade_kit_PAT22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_PAT22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_PAT22A",
                "name": "Sacred Celtic Farmstead Platinum Upgrade Kit",
                "description": "Upgrades your Celtic Farmstead to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_PAT22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A1",
                "toBuildingId": "W_MultiAge_PAT22A2",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A2",
                "toBuildingId": "W_MultiAge_PAT22A3",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A3",
                "toBuildingId": "W_MultiAge_PAT22A4",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A4",
                "toBuildingId": "W_MultiAge_PAT22A5",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A5",
                "toBuildingId": "W_MultiAge_PAT22A6",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A6",
                "toBuildingId": "W_MultiAge_PAT22A7",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A7",
                "toBuildingId": "W_MultiAge_PAT22A8",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A8",
                "toBuildingId": "W_MultiAge_PAT22A9",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A9",
                "toBuildingId": "W_MultiAge_PAT22A10",
                "upgradeItemId": "upgrade_kit_celtic_farmstead",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A10",
                "toBuildingId": "W_MultiAge_PAT22A11",
                "upgradeItemId": "silver_upgrade_kit_PAT22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A11",
                "toBuildingId": "W_MultiAge_PAT22A12",
                "upgradeItemId": "golden_upgrade_kit_PAT22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT22A12",
                "toBuildingId": "W_MultiAge_PAT22A13",
                "upgradeItemId": "platinum_upgrade_kit_PAT22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_BirthdayBonus22a": {
        "baseBuildingId": "R_MultiAge_BirthdayBonus22a",
        "containedBuildingIds": [
            "R_MultiAge_BirthdayBonus22a",
            "R_MultiAge_BirthdayBonus22b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_grand_king"
        ],
        "upgradeItems": {
            "upgrade_kit_grand_king": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_grand_king",
                "name": "Grand King Upgrade Kit",
                "description": "Upgrades your Grand King to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_grand_king",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_BirthdayBonus22a",
                "toBuildingId": "R_MultiAge_BirthdayBonus22b",
                "upgradeItemId": "upgrade_kit_grand_king",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_BirthdayBonus22c": {
        "baseBuildingId": "R_MultiAge_BirthdayBonus22c",
        "containedBuildingIds": [
            "R_MultiAge_BirthdayBonus22c",
            "R_MultiAge_BirthdayBonus22d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_grand_queen"
        ],
        "upgradeItems": {
            "upgrade_kit_grand_queen": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_grand_queen",
                "name": "Grand Queen Upgrade Kit",
                "description": "Upgrades your Grand Queen to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_grand_queen",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_BirthdayBonus22c",
                "toBuildingId": "R_MultiAge_BirthdayBonus22d",
                "upgradeItemId": "upgrade_kit_grand_queen",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_AgeBonus22a": {
        "baseBuildingId": "W_MultiAge_AgeBonus22a",
        "containedBuildingIds": [
            "W_MultiAge_AgeBonus22a",
            "W_MultiAge_AgeBonus22b",
            "W_MultiAge_AgeBonus22c",
            "W_MultiAge_AgeBonus22d",
            "W_MultiAge_AgeBonus22e",
            "W_MultiAge_AgeBonus22f",
            "W_MultiAge_AgeBonus22g",
            "W_MultiAge_AgeBonus22h",
            "W_MultiAge_AgeBonus22i",
            "W_MultiAge_AgeBonus22j",
            "W_MultiAge_AgeBonus22k"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_golden_orrery",
            "golden_upgrade_kit_ANNI22A"
        ],
        "upgradeItems": {
            "upgrade_kit_golden_orrery": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_golden_orrery",
                "name": "Golden Orrery Upgrade Kit",
                "description": "Upgrades your Golden Orrery to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_golden_orrery",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ANNI22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ANNI22A",
                "name": "Celestial Golden Orrery Golden Upgrade Kit",
                "description": "Upgrades your Golden Orrery to its best version!",
                "iconAssetName": "golden_upgrade_kit_ANNI22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22a",
                "toBuildingId": "W_MultiAge_AgeBonus22b",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22b",
                "toBuildingId": "W_MultiAge_AgeBonus22c",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22c",
                "toBuildingId": "W_MultiAge_AgeBonus22d",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22d",
                "toBuildingId": "W_MultiAge_AgeBonus22e",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22e",
                "toBuildingId": "W_MultiAge_AgeBonus22f",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22f",
                "toBuildingId": "W_MultiAge_AgeBonus22g",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22g",
                "toBuildingId": "W_MultiAge_AgeBonus22h",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22h",
                "toBuildingId": "W_MultiAge_AgeBonus22i",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22i",
                "toBuildingId": "W_MultiAge_AgeBonus22j",
                "upgradeItemId": "upgrade_kit_golden_orrery",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22j",
                "toBuildingId": "W_MultiAge_AgeBonus22k",
                "upgradeItemId": "golden_upgrade_kit_ANNI22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_CulturalBuilding10a": {
        "baseBuildingId": "R_MultiAge_CulturalBuilding10a",
        "containedBuildingIds": [
            "R_MultiAge_CulturalBuilding10a",
            "R_MultiAge_CulturalBuilding10b",
            "R_MultiAge_CulturalBuilding10c",
            "R_MultiAge_CulturalBuilding10d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_minaret"
        ],
        "upgradeItems": {
            "upgrade_kit_minaret": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_minaret",
                "name": "Minaret Upgrade Kit",
                "description": "Upgrades your Minaret building",
                "iconAssetName": "upgrade_kit_minaret",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding10a",
                "toBuildingId": "R_MultiAge_CulturalBuilding10b",
                "upgradeItemId": "upgrade_kit_minaret",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding10b",
                "toBuildingId": "R_MultiAge_CulturalBuilding10c",
                "upgradeItemId": "upgrade_kit_minaret",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_CulturalBuilding10c",
                "toBuildingId": "R_MultiAge_CulturalBuilding10d",
                "upgradeItemId": "upgrade_kit_minaret",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_Battlegrounds3a": {
        "baseBuildingId": "R_MultiAge_Battlegrounds3a",
        "containedBuildingIds": [
            "R_MultiAge_Battlegrounds3a",
            "R_MultiAge_Battlegrounds3b",
            "R_MultiAge_Battlegrounds3c",
            "R_MultiAge_Battlegrounds3d",
            "R_MultiAge_Battlegrounds3e",
            "R_MultiAge_Battlegrounds3f",
            "R_MultiAge_Battlegrounds3g",
            "R_MultiAge_Battlegrounds3hBazaar",
            "R_MultiAge_Battlegrounds3hCitadel",
            "R_MultiAge_Battlegrounds3hRoyalty"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_great_elephant"
        ],
        "upgradeItems": {
            "upgrade_kit_great_elephant": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_great_elephant",
                "name": "The Great Elephant Upgrade Kit",
                "description": "Upgrades your Great Elephant to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_great_elephant",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3a",
                "toBuildingId": "R_MultiAge_Battlegrounds3b",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3b",
                "toBuildingId": "R_MultiAge_Battlegrounds3c",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3c",
                "toBuildingId": "R_MultiAge_Battlegrounds3d",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3d",
                "toBuildingId": "R_MultiAge_Battlegrounds3e",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3e",
                "toBuildingId": "R_MultiAge_Battlegrounds3f",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3f",
                "toBuildingId": "R_MultiAge_Battlegrounds3g",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3g",
                "toBuildingId": "R_MultiAge_Battlegrounds3hBazaar",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3g",
                "toBuildingId": "R_MultiAge_Battlegrounds3hCitadel",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Battlegrounds3g",
                "toBuildingId": "R_MultiAge_Battlegrounds3hRoyalty",
                "upgradeItemId": "upgrade_kit_great_elephant",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_ArcheologyBonus22a": {
        "baseBuildingId": "R_MultiAge_ArcheologyBonus22a",
        "containedBuildingIds": [
            "R_MultiAge_ArcheologyBonus22a",
            "R_MultiAge_ArcheologyBonus22b",
            "R_MultiAge_ArcheologyBonus22c",
            "R_MultiAge_ArcheologyBonus22d",
            "R_MultiAge_ArcheologyBonus22e"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_butterfly_house"
        ],
        "upgradeItems": {
            "upgrade_kit_butterfly_house": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_butterfly_house",
                "name": "Butterfly House Upgrade Kit",
                "description": "Upgrades your Butterfly House to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_butterfly_house",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus22a",
                "toBuildingId": "R_MultiAge_ArcheologyBonus22b",
                "upgradeItemId": "upgrade_kit_butterfly_house",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus22b",
                "toBuildingId": "R_MultiAge_ArcheologyBonus22c",
                "upgradeItemId": "upgrade_kit_butterfly_house",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus22c",
                "toBuildingId": "R_MultiAge_ArcheologyBonus22d",
                "upgradeItemId": "upgrade_kit_butterfly_house",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_ArcheologyBonus22d",
                "toBuildingId": "R_MultiAge_ArcheologyBonus22e",
                "upgradeItemId": "upgrade_kit_butterfly_house",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP22A1": {
        "baseBuildingId": "W_MultiAge_CUP22A1",
        "containedBuildingIds": [
            "W_MultiAge_CUP22A1",
            "W_MultiAge_CUP22A2",
            "W_MultiAge_CUP22A3",
            "W_MultiAge_CUP22A4",
            "W_MultiAge_CUP22A5",
            "W_MultiAge_CUP22A6",
            "W_MultiAge_CUP22A7",
            "W_MultiAge_CUP22A8",
            "W_MultiAge_CUP22A9",
            "W_MultiAge_CUP22A10",
            "W_MultiAge_CUP22A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_gentiana_windmill",
            "golden_upgrade_kit_CUP22A",
            "platinum_upgrade_kit_CUP22A",
            "upgrade_kit_ascended_CUP22A"
        ],
        "upgradeItems": {
            "upgrade_kit_gentiana_windmill": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_gentiana_windmill",
                "name": "Gentiana Windmill Upgrade Kit",
                "description": "Upgrades your Gentiana Windmill to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_gentiana_windmill",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_CUP22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_CUP22A",
                "name": "Wisteria Windmill Golden Upgrade Kit",
                "description": "Upgrades your Gentiana Windmill to its best version!",
                "iconAssetName": "golden_upgrade_kit_CUP22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_CUP22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_CUP22A",
                "name": "Azalea Windmill Platinum Upgrade Kit ",
                "description": "Upgrades your Wisteria Windmil to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_CUP22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_CUP22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CUP22A",
                "name": "Ascended Bougainvillea Windmill Upgrade Kit ",
                "description": "Upgrades your Azalea Windmill to a time limited Bougainvillea Windmill that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CUP22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A1",
                "toBuildingId": "W_MultiAge_CUP22A2",
                "upgradeItemId": "upgrade_kit_gentiana_windmill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A2",
                "toBuildingId": "W_MultiAge_CUP22A3",
                "upgradeItemId": "upgrade_kit_gentiana_windmill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A3",
                "toBuildingId": "W_MultiAge_CUP22A4",
                "upgradeItemId": "upgrade_kit_gentiana_windmill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A4",
                "toBuildingId": "W_MultiAge_CUP22A5",
                "upgradeItemId": "upgrade_kit_gentiana_windmill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A5",
                "toBuildingId": "W_MultiAge_CUP22A6",
                "upgradeItemId": "upgrade_kit_gentiana_windmill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A6",
                "toBuildingId": "W_MultiAge_CUP22A7",
                "upgradeItemId": "upgrade_kit_gentiana_windmill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A7",
                "toBuildingId": "W_MultiAge_CUP22A8",
                "upgradeItemId": "upgrade_kit_gentiana_windmill",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A8",
                "toBuildingId": "W_MultiAge_CUP22A9",
                "upgradeItemId": "golden_upgrade_kit_CUP22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A9",
                "toBuildingId": "W_MultiAge_CUP22A10",
                "upgradeItemId": "platinum_upgrade_kit_CUP22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22A10",
                "toBuildingId": "W_MultiAge_CUP22A11",
                "upgradeItemId": "upgrade_kit_ascended_CUP22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD22A1": {
        "baseBuildingId": "W_MultiAge_WILD22A1",
        "containedBuildingIds": [
            "W_MultiAge_WILD22A1",
            "W_MultiAge_WILD22A2",
            "W_MultiAge_WILD22A3",
            "W_MultiAge_WILD22A4",
            "W_MultiAge_WILD22A5",
            "W_MultiAge_WILD22A6",
            "W_MultiAge_WILD22A7",
            "W_MultiAge_WILD22A8",
            "W_MultiAge_WILD22A9",
            "W_MultiAge_WILD22A10",
            "W_MultiAge_WILD22A11",
            "W_MultiAge_WILD22A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_animal_crossing",
            "golden_upgrade_kit_WILD22A",
            "platinum_upgrade_kit_WILD22A",
            "upgrade_kit_ascended_WILD22A"
        ],
        "upgradeItems": {
            "upgrade_kit_animal_crossing": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_animal_crossing",
                "name": "Animal Crossing Upgrade Kit",
                "description": "Upgrades your Animal Crossing to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_animal_crossing",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD22A",
                "name": "Serene Animal Crossing Golden Upgrade Kit",
                "description": "Upgrades your Animal Crossing to its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_WILD22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_WILD22A",
                "name": "Harmonious Animal Crossing Platinum Upgrade Kit",
                "description": "Upgrades your Serene Animal Crossing to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_WILD22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_WILD22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WILD22A",
                "name": "Majestic Animal Crossing Upgrade Kit",
                "description": "Upgrades your Harmonious Animal Crossing to a time limited Majestic Animal Crossing that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WILD22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A1",
                "toBuildingId": "W_MultiAge_WILD22A2",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A2",
                "toBuildingId": "W_MultiAge_WILD22A3",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A3",
                "toBuildingId": "W_MultiAge_WILD22A4",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A4",
                "toBuildingId": "W_MultiAge_WILD22A5",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A5",
                "toBuildingId": "W_MultiAge_WILD22A6",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A6",
                "toBuildingId": "W_MultiAge_WILD22A7",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A7",
                "toBuildingId": "W_MultiAge_WILD22A8",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A8",
                "toBuildingId": "W_MultiAge_WILD22A9",
                "upgradeItemId": "upgrade_kit_animal_crossing",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A9",
                "toBuildingId": "W_MultiAge_WILD22A10",
                "upgradeItemId": "golden_upgrade_kit_WILD22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A10",
                "toBuildingId": "W_MultiAge_WILD22A11",
                "upgradeItemId": "platinum_upgrade_kit_WILD22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD22A11",
                "toBuildingId": "W_MultiAge_WILD22A12",
                "upgradeItemId": "upgrade_kit_ascended_WILD22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL22A1": {
        "baseBuildingId": "W_MultiAge_FELL22A1",
        "containedBuildingIds": [
            "W_MultiAge_FELL22A1",
            "W_MultiAge_FELL22A2",
            "W_MultiAge_FELL22A3",
            "W_MultiAge_FELL22A4",
            "W_MultiAge_FELL22A5",
            "W_MultiAge_FELL22A6",
            "W_MultiAge_FELL22A7",
            "W_MultiAge_FELL22A8",
            "W_MultiAge_FELL22A9",
            "W_MultiAge_FELL22A10",
            "W_MultiAge_FELL22A11",
            "W_MultiAge_FELL22A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_heroes_tavern",
            "golden_upgrade_kit_FELL22A",
            "platinum_upgrade_kit_FELL22A"
        ],
        "upgradeItems": {
            "upgrade_kit_heroes_tavern": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_heroes_tavern",
                "name": "Heroes Tavern Upgrade Kit",
                "description": "Upgrades your Heroes Tavern to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_heroes_tavern",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FELL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FELL22A",
                "name": "Legendary Lodge Golden Upgrade Kit",
                "description": "Upgrades Heroes Tavern to its best version!",
                "iconAssetName": "golden_upgrade_kit_FELLOW22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_FELL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_FELL22A",
                "name": "Mythical Manor Platinum Upgrade Kit",
                "description": "Upgrades your Heroes Tavern to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_FELL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A1",
                "toBuildingId": "W_MultiAge_FELL22A2",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A2",
                "toBuildingId": "W_MultiAge_FELL22A3",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A3",
                "toBuildingId": "W_MultiAge_FELL22A4",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A4",
                "toBuildingId": "W_MultiAge_FELL22A5",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A5",
                "toBuildingId": "W_MultiAge_FELL22A6",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A6",
                "toBuildingId": "W_MultiAge_FELL22A7",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A7",
                "toBuildingId": "W_MultiAge_FELL22A8",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A8",
                "toBuildingId": "W_MultiAge_FELL22A9",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A9",
                "toBuildingId": "W_MultiAge_FELL22A10",
                "upgradeItemId": "upgrade_kit_heroes_tavern",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A10",
                "toBuildingId": "W_MultiAge_FELL22A11",
                "upgradeItemId": "golden_upgrade_kit_FELL22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22A11",
                "toBuildingId": "W_MultiAge_FELL22A12",
                "upgradeItemId": "platinum_upgrade_kit_FELL22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SummerBonus22a": {
        "baseBuildingId": "W_MultiAge_SummerBonus22a",
        "containedBuildingIds": [
            "W_MultiAge_SummerBonus22a",
            "W_MultiAge_SummerBonus22b",
            "W_MultiAge_SummerBonus22c",
            "W_MultiAge_SummerBonus22d",
            "W_MultiAge_SummerBonus22e",
            "W_MultiAge_SummerBonus22f",
            "W_MultiAge_SummerBonus22g",
            "W_MultiAge_SummerBonus22h",
            "W_MultiAge_SummerBonus22i",
            "W_MultiAge_SummerBonus22j",
            "W_MultiAge_SummerBonus22Buccaneer",
            "W_MultiAge_SummerBonus22Deadman"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_privateers_boathouse"
        ],
        "upgradeItems": {
            "upgrade_kit_privateers_boathouse": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_privateers_boathouse",
                "name": "Privateer's Boathouse Upgrade Kit",
                "description": "Upgrades your Privateer's Boathouse to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_privateers_boathouse",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22a",
                "toBuildingId": "W_MultiAge_SummerBonus22b",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22b",
                "toBuildingId": "W_MultiAge_SummerBonus22c",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22c",
                "toBuildingId": "W_MultiAge_SummerBonus22d",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22d",
                "toBuildingId": "W_MultiAge_SummerBonus22e",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22e",
                "toBuildingId": "W_MultiAge_SummerBonus22f",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22f",
                "toBuildingId": "W_MultiAge_SummerBonus22g",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22g",
                "toBuildingId": "W_MultiAge_SummerBonus22h",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22h",
                "toBuildingId": "W_MultiAge_SummerBonus22i",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22i",
                "toBuildingId": "W_MultiAge_SummerBonus22j",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22j",
                "toBuildingId": "W_MultiAge_SummerBonus22Buccaneer",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SummerBonus22j",
                "toBuildingId": "W_MultiAge_SummerBonus22Deadman",
                "upgradeItemId": "upgrade_kit_privateers_boathouse",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HalloweenBonusGP22a": {
        "baseBuildingId": "W_MultiAge_HalloweenBonusGP22a",
        "containedBuildingIds": [
            "W_MultiAge_HalloweenBonusGP22a",
            "W_MultiAge_HalloweenBonusGP22b",
            "W_MultiAge_HalloweenBonusGP22c",
            "W_MultiAge_HalloweenBonusGP22d",
            "W_MultiAge_HalloweenBonusGP22e",
            "W_MultiAge_HalloweenBonusGP22f",
            "W_MultiAge_HalloweenBonusGP22g",
            "W_MultiAge_HalloweenBonusGP22h",
            "W_MultiAge_HalloweenBonusGP22i",
            "W_MultiAge_HalloweenBonusGP22j",
            "W_MultiAge_HalloweenBonusGP22k",
            "W_MultiAge_HalloweenBonusGP22l",
            "W_MultiAge_HalloweenBonusGP22m"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_tarot_card_caravans",
            "golden_upgrade_kit_HAL22A"
        ],
        "upgradeItems": {
            "upgrade_kit_tarot_card_caravans": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_tarot_card_caravans",
                "name": "Tarot Card Caravans Upgrade Kit",
                "description": "Upgrades your Tarot Card Caravans to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_tarot_card_caravans",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HAL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL22A",
                "name": "Arcane Tarot Card Caravans Golden Upgrade Kit",
                "description": "Upgrades your Tarot Card Caravans to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22a",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22b",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22b",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22c",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22c",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22d",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22d",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22e",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22e",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22f",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22f",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22g",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22g",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22h",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22h",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22i",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22i",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22j",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22j",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22k",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22k",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22l",
                "upgradeItemId": "upgrade_kit_tarot_card_caravans",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HalloweenBonusGP22l",
                "toBuildingId": "W_MultiAge_HalloweenBonusGP22m",
                "upgradeItemId": "golden_upgrade_kit_HAL22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL22A1": {
        "baseBuildingId": "W_MultiAge_FALL22A1",
        "containedBuildingIds": [
            "W_MultiAge_FALL22A1",
            "W_MultiAge_FALL22A2",
            "W_MultiAge_FALL22A3",
            "W_MultiAge_FALL22A4",
            "W_MultiAge_FALL22A5",
            "W_MultiAge_FALL22A6",
            "W_MultiAge_FALL22A7",
            "W_MultiAge_FALL22A8",
            "W_MultiAge_FALL22A9",
            "W_MultiAge_FALL22A10",
            "W_MultiAge_FALL22A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_sunflower_oil_press",
            "golden_upgrade_kit_FALL22A",
            "platinum_upgrade_kit_FALL22A"
        ],
        "upgradeItems": {
            "upgrade_kit_sunflower_oil_press": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_sunflower_oil_press",
                "name": "Sunflower Oil Press Upgrade Kit",
                "description": "Upgrades your Sunflower Oil Press to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_sunflower_oil_press",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FALL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FALL22A",
                "name": "Vibrant Sunflower Oil Press Golden Upgrade Kit",
                "description": "Upgrades your Sunflower Oil Press to its best version!",
                "iconAssetName": "golden_upgrade_kit_FALL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_FALL22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_FALL22A",
                "name": "Pristine Sunflower Oil Press Platinum Upgrade Kit",
                "description": "Upgrades your Sunflower Oil Press to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_FALL22A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A1",
                "toBuildingId": "W_MultiAge_FALL22A2",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A2",
                "toBuildingId": "W_MultiAge_FALL22A3",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A3",
                "toBuildingId": "W_MultiAge_FALL22A4",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A4",
                "toBuildingId": "W_MultiAge_FALL22A5",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A5",
                "toBuildingId": "W_MultiAge_FALL22A6",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A6",
                "toBuildingId": "W_MultiAge_FALL22A7",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A7",
                "toBuildingId": "W_MultiAge_FALL22A8",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A8",
                "toBuildingId": "W_MultiAge_FALL22A9",
                "upgradeItemId": "upgrade_kit_sunflower_oil_press",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A9",
                "toBuildingId": "W_MultiAge_FALL22A10",
                "upgradeItemId": "golden_upgrade_kit_FALL22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL22A10",
                "toBuildingId": "W_MultiAge_FALL22A11",
                "upgradeItemId": "platinum_upgrade_kit_FALL22A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN22A1": {
        "baseBuildingId": "W_MultiAge_WIN22A1",
        "containedBuildingIds": [
            "W_MultiAge_WIN22A1",
            "W_MultiAge_WIN22A2",
            "W_MultiAge_WIN22A3",
            "W_MultiAge_WIN22A4",
            "W_MultiAge_WIN22A5",
            "W_MultiAge_WIN22A6",
            "W_MultiAge_WIN22A7",
            "W_MultiAge_WIN22A8",
            "W_MultiAge_WIN22A9",
            "W_MultiAge_WIN22A10",
            "W_MultiAge_WIN22A11a",
            "W_MultiAge_WIN22A11b",
            "W_MultiAge_WIN22A12a",
            "W_MultiAge_WIN22A12b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_W_MultiAge_WIN22A",
            "golden_upgrade_kit_WIN22Aa",
            "golden_upgrade_kit_WIN22Ab"
        ],
        "upgradeItems": {
            "upgrade_kit_W_MultiAge_WIN22A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_W_MultiAge_WIN22A",
                "name": "Chocolatery Upgrade Kit",
                "description": "Upgrades your Chocolatery to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_chocolatery",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN22Aa": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN22Aa",
                "name": "Ted's Blissful Choc Golden Upgrade Kit",
                "description": "Upgrades your Chocolatery to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN22Aa",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN22Ab": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN22Ab",
                "name": "Ketebo Candy Delights Golden Upgrade Kit",
                "description": "Upgrades your Chocolatery to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN22Ab",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A1",
                "toBuildingId": "W_MultiAge_WIN22A2",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A2",
                "toBuildingId": "W_MultiAge_WIN22A3",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A3",
                "toBuildingId": "W_MultiAge_WIN22A4",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A4",
                "toBuildingId": "W_MultiAge_WIN22A5",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A5",
                "toBuildingId": "W_MultiAge_WIN22A6",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A6",
                "toBuildingId": "W_MultiAge_WIN22A7",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A7",
                "toBuildingId": "W_MultiAge_WIN22A8",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A8",
                "toBuildingId": "W_MultiAge_WIN22A9",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A9",
                "toBuildingId": "W_MultiAge_WIN22A10",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A10",
                "toBuildingId": "W_MultiAge_WIN22A11a",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A10",
                "toBuildingId": "W_MultiAge_WIN22A11b",
                "upgradeItemId": "upgrade_kit_W_MultiAge_WIN22A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A11a",
                "toBuildingId": "W_MultiAge_WIN22A12a",
                "upgradeItemId": "golden_upgrade_kit_WIN22Aa",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22A11b",
                "toBuildingId": "W_MultiAge_WIN22A12b",
                "upgradeItemId": "golden_upgrade_kit_WIN22Ab",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "R_MultiAge_Expedition22a": {
        "baseBuildingId": "R_MultiAge_Expedition22a",
        "containedBuildingIds": [
            "R_MultiAge_Expedition22a",
            "R_MultiAge_Expedition22b",
            "R_MultiAge_Expedition22c",
            "R_MultiAge_Expedition22dSilver",
            "R_MultiAge_Expedition22eGold",
            "R_MultiAge_Expedition22fPlatinum"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_feathered_serpent_statue",
            "upgrade_kit_feathered_serpent_statue_silver",
            "upgrade_kit_feathered_serpent_statue_gold",
            "upgrade_kit_feathered_serpent_statue_platinum"
        ],
        "upgradeItems": {
            "upgrade_kit_feathered_serpent_statue": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_feathered_serpent_statue",
                "name": "Feathered Serpent Statue Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue to an improved version that will improve the provided boosts.",
                "iconAssetName": "upgrade_kit_feathered_serpent_statue",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_feathered_serpent_statue_silver": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_feathered_serpent_statue_silver",
                "name": "Feathered Serpent Statue Silver Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue to an improved version that will improve the provided boosts.",
                "iconAssetName": "upgrade_kit_feathered_serpent_statue_silver",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_feathered_serpent_statue_gold": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_feathered_serpent_statue_gold",
                "name": "Feathered Serpent Statue Gold Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue to an improved version that will improve the provided boosts.",
                "iconAssetName": "upgrade_kit_feathered_serpent_statue_gold",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_feathered_serpent_statue_platinum": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_feathered_serpent_statue_platinum",
                "name": "Feathered Serpent Statue Platinum Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue to an improved version that will improve the provided boosts.",
                "iconAssetName": "upgrade_kit_feathered_serpent_statue_platinum",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Expedition22a",
                "toBuildingId": "R_MultiAge_Expedition22b",
                "upgradeItemId": "upgrade_kit_feathered_serpent_statue",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Expedition22b",
                "toBuildingId": "R_MultiAge_Expedition22c",
                "upgradeItemId": "upgrade_kit_feathered_serpent_statue",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Expedition22c",
                "toBuildingId": "R_MultiAge_Expedition22dSilver",
                "upgradeItemId": "upgrade_kit_feathered_serpent_statue_silver",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Expedition22dSilver",
                "toBuildingId": "R_MultiAge_Expedition22eGold",
                "upgradeItemId": "upgrade_kit_feathered_serpent_statue_gold",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "R_MultiAge_Expedition22eGold",
                "toBuildingId": "R_MultiAge_Expedition22fPlatinum",
                "upgradeItemId": "upgrade_kit_feathered_serpent_statue_platinum",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HERO24A1": {
        "baseBuildingId": "W_MultiAge_HERO24A1",
        "containedBuildingIds": [
            "W_MultiAge_HERO24A1",
            "W_MultiAge_HERO24A2",
            "W_MultiAge_HERO24A3",
            "W_MultiAge_HERO24A4",
            "W_MultiAge_HERO24A5",
            "W_MultiAge_HERO24A6",
            "W_MultiAge_HERO24A7",
            "W_MultiAge_HERO24A8",
            "W_MultiAge_HERO24A9"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HERO24A",
            "silver_upgrade_kit_HERO24A",
            "golden_upgrade_kit_HERO24A"
        ],
        "upgradeItems": {
            "upgrade_kit_HERO24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HERO24A",
                "name": "Ascendant Grove Sanctuary Upgrade Kit",
                "description": "Upgrades your Ascendant Grove Sanctuary to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HERO24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HERO24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HERO24A",
                "name": "Surging Grove Sanctuary Silver Upgrade Kit",
                "description": "Upgrades your Ascendant Grove Sanctuary to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HERO24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HERO24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HERO24A",
                "name": "Apex Grove Sanctuary Golden Upgrade Kit",
                "description": "Upgrades your Ascendant Grove Sanctuary to its best version!",
                "iconAssetName": "golden_upgrade_kit_HERO24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A1",
                "toBuildingId": "W_MultiAge_HERO24A2",
                "upgradeItemId": "upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A2",
                "toBuildingId": "W_MultiAge_HERO24A3",
                "upgradeItemId": "upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A3",
                "toBuildingId": "W_MultiAge_HERO24A4",
                "upgradeItemId": "upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A4",
                "toBuildingId": "W_MultiAge_HERO24A5",
                "upgradeItemId": "upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A5",
                "toBuildingId": "W_MultiAge_HERO24A6",
                "upgradeItemId": "upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A6",
                "toBuildingId": "W_MultiAge_HERO24A7",
                "upgradeItemId": "upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A7",
                "toBuildingId": "W_MultiAge_HERO24A8",
                "upgradeItemId": "silver_upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24A8",
                "toBuildingId": "W_MultiAge_HERO24A9",
                "upgradeItemId": "golden_upgrade_kit_HERO24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HERO24H1": {
        "baseBuildingId": "W_MultiAge_HERO24H1",
        "containedBuildingIds": [
            "W_MultiAge_HERO24H1",
            "W_MultiAge_HERO24H2",
            "W_MultiAge_HERO24H3",
            "W_MultiAge_HERO24H4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HERO24H",
            "silver_upgrade_kit_HERO24H",
            "golden_upgrade_kit_HERO24H"
        ],
        "upgradeItems": {
            "upgrade_kit_HERO24H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HERO24H",
                "name": "Mortar Garrison Upgrade Kit",
                "description": "Upgrades your Mortar Garrison to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HERO24H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HERO24H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HERO24H",
                "name": "Sterling Garrison Silver Upgrade Kit",
                "description": "Upgrades your Mortar Garrison to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HERO24H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HERO24H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HERO24H",
                "name": "Bullion Garrison Golden Upgrade Kit",
                "description": "Upgrades your Mortar Garrison to its best version!",
                "iconAssetName": "golden_upgrade_kit_HERO24H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24H1",
                "toBuildingId": "W_MultiAge_HERO24H2",
                "upgradeItemId": "upgrade_kit_HERO24H",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24H2",
                "toBuildingId": "W_MultiAge_HERO24H3",
                "upgradeItemId": "silver_upgrade_kit_HERO24H",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HERO24H3",
                "toBuildingId": "W_MultiAge_HERO24H4",
                "upgradeItemId": "golden_upgrade_kit_HERO24H",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL23A1": {
        "baseBuildingId": "W_MultiAge_FELL23A1",
        "containedBuildingIds": [
            "W_MultiAge_FELL23A1",
            "W_MultiAge_FELL23A2",
            "W_MultiAge_FELL23A3",
            "W_MultiAge_FELL23A4",
            "W_MultiAge_FELL23A5",
            "W_MultiAge_FELL23A6",
            "W_MultiAge_FELL23A7",
            "W_MultiAge_FELL23A8",
            "W_MultiAge_FELL23A9",
            "W_MultiAge_FELL23A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FELL23A",
            "golden_upgrade_kit_FELL23A"
        ],
        "upgradeItems": {
            "upgrade_kit_FELL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FELL23A",
                "name": "Summerhold Manor Upgrade Kit",
                "description": "Upgrades your Summerhold Manor to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_FELLOW23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FELL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FELL23A",
                "name": "Sunhaven Palace Golden Upgrade Kit",
                "description": "Upgrades your Summerhold Manor its best version!",
                "iconAssetName": "golden_upgrade_kit_FELLOW23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A1",
                "toBuildingId": "W_MultiAge_FELL23A2",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A2",
                "toBuildingId": "W_MultiAge_FELL23A3",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A3",
                "toBuildingId": "W_MultiAge_FELL23A4",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A4",
                "toBuildingId": "W_MultiAge_FELL23A5",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A5",
                "toBuildingId": "W_MultiAge_FELL23A6",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A6",
                "toBuildingId": "W_MultiAge_FELL23A7",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A7",
                "toBuildingId": "W_MultiAge_FELL23A8",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A8",
                "toBuildingId": "W_MultiAge_FELL23A9",
                "upgradeItemId": "upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL23A9",
                "toBuildingId": "W_MultiAge_FELL23A10",
                "upgradeItemId": "golden_upgrade_kit_FELL23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI23A1": {
        "baseBuildingId": "W_MultiAge_ANNI23A1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI23A1",
            "W_MultiAge_ANNI23A2",
            "W_MultiAge_ANNI23A3",
            "W_MultiAge_ANNI23A4",
            "W_MultiAge_ANNI23A5",
            "W_MultiAge_ANNI23A6",
            "W_MultiAge_ANNI23A7",
            "W_MultiAge_ANNI23A8",
            "W_MultiAge_ANNI23A9",
            "W_MultiAge_ANNI23A10",
            "W_MultiAge_ANNI23A11a",
            "W_MultiAge_ANNI23A11b",
            "W_MultiAge_ANNI23A11c",
            "W_MultiAge_ANNI23A11d"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ANNI23A",
            "golden_upgrade_kit_ANNI23A"
        ],
        "upgradeItems": {
            "upgrade_kit_ANNI23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ANNI23A",
                "name": "Tower of Conjunction Upgrade Kit",
                "description": "Upgrades your Tower of Conjunction to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_ANNI23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ANNI23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ANNI23A",
                "name": "Tower of Conjunction Golden Upgrade Kit",
                "description": "Upgrades your Tower of Conjunction to its highest level!",
                "iconAssetName": "golden_upgrade_kit_ANNI23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A1",
                "toBuildingId": "W_MultiAge_ANNI23A2",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A2",
                "toBuildingId": "W_MultiAge_ANNI23A3",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A3",
                "toBuildingId": "W_MultiAge_ANNI23A4",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A4",
                "toBuildingId": "W_MultiAge_ANNI23A5",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A5",
                "toBuildingId": "W_MultiAge_ANNI23A6",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A6",
                "toBuildingId": "W_MultiAge_ANNI23A7",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A7",
                "toBuildingId": "W_MultiAge_ANNI23A8",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A8",
                "toBuildingId": "W_MultiAge_ANNI23A9",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A9",
                "toBuildingId": "W_MultiAge_ANNI23A10",
                "upgradeItemId": "upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A10",
                "toBuildingId": "W_MultiAge_ANNI23A11a",
                "upgradeItemId": "golden_upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A10",
                "toBuildingId": "W_MultiAge_ANNI23A11b",
                "upgradeItemId": "golden_upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A10",
                "toBuildingId": "W_MultiAge_ANNI23A11c",
                "upgradeItemId": "golden_upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23A10",
                "toBuildingId": "W_MultiAge_ANNI23A11d",
                "upgradeItemId": "golden_upgrade_kit_ANNI23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI23B1": {
        "baseBuildingId": "W_MultiAge_ANNI23B1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI23B1",
            "W_MultiAge_ANNI23B2",
            "W_MultiAge_ANNI23B3",
            "W_MultiAge_ANNI23B4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ANNI23B"
        ],
        "upgradeItems": {
            "upgrade_kit_ANNI23B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ANNI23B",
                "name": "Key Master's Workshop Upgrade Kit",
                "description": "Upgrades your Key Master's Workshop to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_ANNI23B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23B1",
                "toBuildingId": "W_MultiAge_ANNI23B2",
                "upgradeItemId": "upgrade_kit_ANNI23B",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23B2",
                "toBuildingId": "W_MultiAge_ANNI23B3",
                "upgradeItemId": "upgrade_kit_ANNI23B",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI23B3",
                "toBuildingId": "W_MultiAge_ANNI23B4",
                "upgradeItemId": "upgrade_kit_ANNI23B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL23A1": {
        "baseBuildingId": "W_MultiAge_FALL23A1",
        "containedBuildingIds": [
            "W_MultiAge_FALL23A1",
            "W_MultiAge_FALL23A2",
            "W_MultiAge_FALL23A3",
            "W_MultiAge_FALL23A4",
            "W_MultiAge_FALL23A5",
            "W_MultiAge_FALL23A6",
            "W_MultiAge_FALL23A7",
            "W_MultiAge_FALL23A8",
            "W_MultiAge_FALL23A9",
            "W_MultiAge_FALL23A10",
            "W_MultiAge_FALL23A11",
            "W_MultiAge_FALL23A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL23A",
            "silver_upgrade_kit_FALL23A",
            "golden_upgrade_kit_FALL23A",
            "platinum_upgrade_kit_FALL23A"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL23A",
                "name": "Autumn Vineyard Upgrade Kit",
                "description": "Upgrades your Autumn Vineyard to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_FALL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FALL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FALL23A",
                "name": "Rustic Autumn Vineyard Silver Upgrade Kit",
                "description": "Upgrades your Autumn Vineyard to its second best version!",
                "iconAssetName": "silver_upgrade_kit_FALL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FALL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FALL23A",
                "name": "Vibrant Autumn Vineyard Golden Upgrade Kit",
                "description": "Upgrades your Autumn Vineyard to its best version!",
                "iconAssetName": "golden_upgrade_kit_FALL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_FALL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_FALL23A",
                "name": "Majestic Autumn Vineyard Platinum Upgrade Kit",
                "description": "Upgrades your Autumn Vineyard to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_FALL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A1",
                "toBuildingId": "W_MultiAge_FALL23A2",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A2",
                "toBuildingId": "W_MultiAge_FALL23A3",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A3",
                "toBuildingId": "W_MultiAge_FALL23A4",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A4",
                "toBuildingId": "W_MultiAge_FALL23A5",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A5",
                "toBuildingId": "W_MultiAge_FALL23A6",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A6",
                "toBuildingId": "W_MultiAge_FALL23A7",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A7",
                "toBuildingId": "W_MultiAge_FALL23A8",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A8",
                "toBuildingId": "W_MultiAge_FALL23A9",
                "upgradeItemId": "upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A9",
                "toBuildingId": "W_MultiAge_FALL23A10",
                "upgradeItemId": "silver_upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A10",
                "toBuildingId": "W_MultiAge_FALL23A11",
                "upgradeItemId": "golden_upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23A11",
                "toBuildingId": "W_MultiAge_FALL23A12",
                "upgradeItemId": "platinum_upgrade_kit_FALL23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL23B1": {
        "baseBuildingId": "W_MultiAge_FALL23B1",
        "containedBuildingIds": [
            "W_MultiAge_FALL23B1",
            "W_MultiAge_FALL23B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL23B"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL23B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL23B",
                "name": "Grape Stompin' Festival Upgrade Kit",
                "description": "Upgrades your Grape Stompin' Festival to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_FALL23B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23B1",
                "toBuildingId": "W_MultiAge_FALL23B2",
                "upgradeItemId": "upgrade_kit_FALL23B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_BOWL23A1": {
        "baseBuildingId": "W_MultiAge_BOWL23A1",
        "containedBuildingIds": [
            "W_MultiAge_BOWL23A1",
            "W_MultiAge_BOWL23A2",
            "W_MultiAge_BOWL23A3",
            "W_MultiAge_BOWL23A4",
            "W_MultiAge_BOWL23A5",
            "W_MultiAge_BOWL23A6",
            "W_MultiAge_BOWL23A7",
            "W_MultiAge_BOWL23A8",
            "W_MultiAge_BOWL23A9",
            "W_MultiAge_BOWL23A10",
            "W_MultiAge_BOWL23A11a",
            "W_MultiAge_BOWL23A11b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_BOWL23A"
        ],
        "upgradeItems": {
            "upgrade_kit_BOWL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_BOWL23A",
                "name": "Pergola Upgrade Kit",
                "description": "Upgrades your Pergola to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_BOWL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A1",
                "toBuildingId": "W_MultiAge_BOWL23A2",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A2",
                "toBuildingId": "W_MultiAge_BOWL23A3",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A3",
                "toBuildingId": "W_MultiAge_BOWL23A4",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A4",
                "toBuildingId": "W_MultiAge_BOWL23A5",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A5",
                "toBuildingId": "W_MultiAge_BOWL23A6",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A6",
                "toBuildingId": "W_MultiAge_BOWL23A7",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A7",
                "toBuildingId": "W_MultiAge_BOWL23A8",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A8",
                "toBuildingId": "W_MultiAge_BOWL23A9",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A9",
                "toBuildingId": "W_MultiAge_BOWL23A10",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A10",
                "toBuildingId": "W_MultiAge_BOWL23A11a",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_BOWL23A10",
                "toBuildingId": "W_MultiAge_BOWL23A11b",
                "upgradeItemId": "upgrade_kit_BOWL23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM23A1": {
        "baseBuildingId": "W_MultiAge_SUM23A1",
        "containedBuildingIds": [
            "W_MultiAge_SUM23A1",
            "W_MultiAge_SUM23A2",
            "W_MultiAge_SUM23A3",
            "W_MultiAge_SUM23A4",
            "W_MultiAge_SUM23A5",
            "W_MultiAge_SUM23A6",
            "W_MultiAge_SUM23A7",
            "W_MultiAge_SUM23A8",
            "W_MultiAge_SUM23A9",
            "W_MultiAge_SUM23A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_SUM23A",
            "golden_upgrade_kit_SUM23A"
        ],
        "upgradeItems": {
            "upgrade_kit_SUM23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_SUM23A",
                "name": "Trading Post Upgrade Kit",
                "description": "Upgrades your Trading Post to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_SUM23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_SUM23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_SUM23A",
                "name": "Buccaneers Bay Upgrade Kit",
                "description": "Upgrades your Trading Post to its best version!",
                "iconAssetName": "golden_upgrade_kit_SUM23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A1",
                "toBuildingId": "W_MultiAge_SUM23A2",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A2",
                "toBuildingId": "W_MultiAge_SUM23A3",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A3",
                "toBuildingId": "W_MultiAge_SUM23A4",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A4",
                "toBuildingId": "W_MultiAge_SUM23A5",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A5",
                "toBuildingId": "W_MultiAge_SUM23A6",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A6",
                "toBuildingId": "W_MultiAge_SUM23A7",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A7",
                "toBuildingId": "W_MultiAge_SUM23A8",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A8",
                "toBuildingId": "W_MultiAge_SUM23A9",
                "upgradeItemId": "upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM23A9",
                "toBuildingId": "W_MultiAge_SUM23A10",
                "upgradeItemId": "golden_upgrade_kit_SUM23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP23A1": {
        "baseBuildingId": "W_MultiAge_CUP23A1",
        "containedBuildingIds": [
            "W_MultiAge_CUP23A1",
            "W_MultiAge_CUP23A2",
            "W_MultiAge_CUP23A3",
            "W_MultiAge_CUP23A4",
            "W_MultiAge_CUP23A5",
            "W_MultiAge_CUP23A6",
            "W_MultiAge_CUP23A7",
            "W_MultiAge_CUP23A8",
            "W_MultiAge_CUP23A9",
            "W_MultiAge_CUP23A10a",
            "W_MultiAge_CUP23A10b",
            "W_MultiAge_CUP23A10c"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CUP23A",
            "golden_upgrade_kit_CUP23A"
        ],
        "upgradeItems": {
            "upgrade_kit_CUP23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CUP23A",
                "name": "Aegean Resort Upgrade Kit",
                "description": "Upgrades your Aegean Resort to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_CUP23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_CUP23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_CUP23A",
                "name": "Aegean Resort Golden Upgrade Kit",
                "description": "Upgrades your Aegean Resort to its best version!",
                "iconAssetName": "golden_upgrade_kit_CUP23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A1",
                "toBuildingId": "W_MultiAge_CUP23A2",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A2",
                "toBuildingId": "W_MultiAge_CUP23A3",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A3",
                "toBuildingId": "W_MultiAge_CUP23A4",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A4",
                "toBuildingId": "W_MultiAge_CUP23A5",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A5",
                "toBuildingId": "W_MultiAge_CUP23A6",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A6",
                "toBuildingId": "W_MultiAge_CUP23A7",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A7",
                "toBuildingId": "W_MultiAge_CUP23A8",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A8",
                "toBuildingId": "W_MultiAge_CUP23A9",
                "upgradeItemId": "upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A9",
                "toBuildingId": "W_MultiAge_CUP23A10a",
                "upgradeItemId": "golden_upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A9",
                "toBuildingId": "W_MultiAge_CUP23A10b",
                "upgradeItemId": "golden_upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP23A9",
                "toBuildingId": "W_MultiAge_CUP23A10c",
                "upgradeItemId": "golden_upgrade_kit_CUP23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT23A1": {
        "baseBuildingId": "W_MultiAge_PAT23A1",
        "containedBuildingIds": [
            "W_MultiAge_PAT23A1",
            "W_MultiAge_PAT23A2",
            "W_MultiAge_PAT23A3",
            "W_MultiAge_PAT23A4",
            "W_MultiAge_PAT23A5",
            "W_MultiAge_PAT23A6",
            "W_MultiAge_PAT23A7",
            "W_MultiAge_PAT23A8",
            "W_MultiAge_PAT23A9",
            "W_MultiAge_PAT23A10",
            "W_MultiAge_PAT23A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT23A",
            "golden_upgrade_kit_PAT23A",
            "platinum_upgrade_kit_PAT23A"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT23A",
                "name": "Druid Hut Upgrade Kit",
                "description": "Upgrades your Druid Hut to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_PAT23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_PAT23A",
                "name": "Archdruid Hut Upgrade Kit",
                "description": "Upgrades your Druid Hut to its best version!",
                "iconAssetName": "ultimate_upgrade_kit_PAT23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_PAT23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_PAT23A",
                "name": "Sacred Archdruid Hut Platinum Upgrade Kit",
                "description": "Upgrades your Druid Hut to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_PAT23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A1",
                "toBuildingId": "W_MultiAge_PAT23A2",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A2",
                "toBuildingId": "W_MultiAge_PAT23A3",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A3",
                "toBuildingId": "W_MultiAge_PAT23A4",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A4",
                "toBuildingId": "W_MultiAge_PAT23A5",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A5",
                "toBuildingId": "W_MultiAge_PAT23A6",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A6",
                "toBuildingId": "W_MultiAge_PAT23A7",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A7",
                "toBuildingId": "W_MultiAge_PAT23A8",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A8",
                "toBuildingId": "W_MultiAge_PAT23A9",
                "upgradeItemId": "upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A9",
                "toBuildingId": "W_MultiAge_PAT23A10",
                "upgradeItemId": "golden_upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23A10",
                "toBuildingId": "W_MultiAge_PAT23A11",
                "upgradeItemId": "platinum_upgrade_kit_PAT23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD23A1": {
        "baseBuildingId": "W_MultiAge_WILD23A1",
        "containedBuildingIds": [
            "W_MultiAge_WILD23A1",
            "W_MultiAge_WILD23A2",
            "W_MultiAge_WILD23A3",
            "W_MultiAge_WILD23A4",
            "W_MultiAge_WILD23A5",
            "W_MultiAge_WILD23A6",
            "W_MultiAge_WILD23A7",
            "W_MultiAge_WILD23A8",
            "W_MultiAge_WILD23A9",
            "W_MultiAge_WILD23A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD23A",
            "golden_upgrade_kit_WILD23A"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD23A",
                "name": "Panda Reserve Upgrade Kit",
                "description": "Upgrades your Panda Reserve to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_WILD23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD23A",
                "name": "Panda Shrine Upgrade Kit",
                "description": "Upgrades your Panda Reserve its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A1",
                "toBuildingId": "W_MultiAge_WILD23A2",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A2",
                "toBuildingId": "W_MultiAge_WILD23A3",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A3",
                "toBuildingId": "W_MultiAge_WILD23A4",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A4",
                "toBuildingId": "W_MultiAge_WILD23A5",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A5",
                "toBuildingId": "W_MultiAge_WILD23A6",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A6",
                "toBuildingId": "W_MultiAge_WILD23A7",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A7",
                "toBuildingId": "W_MultiAge_WILD23A8",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A8",
                "toBuildingId": "W_MultiAge_WILD23A9",
                "upgradeItemId": "upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23A9",
                "toBuildingId": "W_MultiAge_WILD23A10",
                "upgradeItemId": "golden_upgrade_kit_WILD23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD23E1": {
        "baseBuildingId": "W_MultiAge_WILD23E1",
        "containedBuildingIds": [
            "W_MultiAge_WILD23E1",
            "W_MultiAge_WILD23E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD23E"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD23E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD23E",
                "name": "Himalayan Firs Upgrade Kit",
                "description": "Upgrades your Himalayan Firs to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_WILD23E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23E1",
                "toBuildingId": "W_MultiAge_WILD23E2",
                "upgradeItemId": "upgrade_kit_WILD23E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD23F1": {
        "baseBuildingId": "W_MultiAge_WILD23F1",
        "containedBuildingIds": [
            "W_MultiAge_WILD23F1",
            "W_MultiAge_WILD23F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD23F"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD23F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD23F",
                "name": "Rhododendron Field Upgrade Kit",
                "description": "Upgrades your Rhododendron Field to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_WILD23F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD23F1",
                "toBuildingId": "W_MultiAge_WILD23F2",
                "upgradeItemId": "upgrade_kit_WILD23F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBGWatchtower2023A": {
        "baseBuildingId": "W_MultiAge_GBGWatchtower2023A",
        "containedBuildingIds": [
            "W_MultiAge_GBGWatchtower2023A",
            "W_MultiAge_GBGWatchtower2023B"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG23A"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG23A",
                "name": "Tower of Champions Upgrade Kit",
                "description": "Upgrades your Tower of Champions to an improved version.",
                "iconAssetName": "upgrade_kit_watchtower1_gbg",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBGWatchtower2023A",
                "toBuildingId": "W_MultiAge_GBGWatchtower2023B",
                "upgradeItemId": "upgrade_kit_GBG23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBGWatchtower2023C1": {
        "baseBuildingId": "W_MultiAge_GBGWatchtower2023C1",
        "containedBuildingIds": [
            "W_MultiAge_GBGWatchtower2023C1",
            "W_MultiAge_GBGWatchtower2023C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG23C"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG23C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG23C",
                "name": "Royal Tower of Champions Upgrade Kit",
                "description": "Upgrades your Royal Tower of Champions to an improved version",
                "iconAssetName": "upgrade_kit_GBG23C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBGWatchtower2023C1",
                "toBuildingId": "W_MultiAge_GBGWatchtower2023C2",
                "upgradeItemId": "upgrade_kit_GBG23C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN23A1": {
        "baseBuildingId": "W_MultiAge_WIN23A1",
        "containedBuildingIds": [
            "W_MultiAge_WIN23A1",
            "W_MultiAge_WIN23A2",
            "W_MultiAge_WIN23A3",
            "W_MultiAge_WIN23A4",
            "W_MultiAge_WIN23A5",
            "W_MultiAge_WIN23A6",
            "W_MultiAge_WIN23A7",
            "W_MultiAge_WIN23A8",
            "W_MultiAge_WIN23A9",
            "W_MultiAge_WIN23A10",
            "W_MultiAge_WIN23A11",
            "W_MultiAge_WIN23A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN23A",
            "silver_upgrade_kit_WIN23A",
            "golden_upgrade_kit_WIN23A"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN23A",
                "name": "Winter Wonderland Pyramid Upgrade Kit",
                "description": "Upgrades your Winter Wonderland Pyramid to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_WIN23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WIN23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WIN23A",
                "name": "Grand Winter Wonderland Pyramid Silver Upgrade Kit",
                "description": "Upgrades your Winter Wonderland Pyramid to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WIN23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN23A",
                "name": "Majestic Winter Wonderland Pyramid Golden Upgrade Kit",
                "description": "Upgrades your Winter Wonderland Pyramid to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A1",
                "toBuildingId": "W_MultiAge_WIN23A2",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A2",
                "toBuildingId": "W_MultiAge_WIN23A3",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A3",
                "toBuildingId": "W_MultiAge_WIN23A4",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A4",
                "toBuildingId": "W_MultiAge_WIN23A5",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A5",
                "toBuildingId": "W_MultiAge_WIN23A6",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A6",
                "toBuildingId": "W_MultiAge_WIN23A7",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A7",
                "toBuildingId": "W_MultiAge_WIN23A8",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A8",
                "toBuildingId": "W_MultiAge_WIN23A9",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A9",
                "toBuildingId": "W_MultiAge_WIN23A10",
                "upgradeItemId": "upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A10",
                "toBuildingId": "W_MultiAge_WIN23A11",
                "upgradeItemId": "silver_upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23A11",
                "toBuildingId": "W_MultiAge_WIN23A12",
                "upgradeItemId": "golden_upgrade_kit_WIN23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN23C1": {
        "baseBuildingId": "W_MultiAge_WIN23C1",
        "containedBuildingIds": [
            "W_MultiAge_WIN23C1",
            "W_MultiAge_WIN23C2",
            "W_MultiAge_WIN23C3",
            "W_MultiAge_WIN23C4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN23C",
            "silver_upgrade_kit_WIN23C",
            "golden_upgrade_kit_WIN23C"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN23C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN23C",
                "name": "Elfie's Nog Shop Upgrade Kit",
                "description": "Upgrades your Elfie's Nog Shop to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_WIN23C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WIN23C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WIN23C",
                "name": "Elfie's Cream & Nog Shop Silver Upgrade Kit",
                "description": "Upgrades your Elfie's Nog Shop to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WIN23C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN23C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN23C",
                "name": "Elfie's Cream & Nog Emporium Golden Upgrade Kit",
                "description": "Upgrades your Elfie's Nog Shop to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN23C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23C1",
                "toBuildingId": "W_MultiAge_WIN23C2",
                "upgradeItemId": "upgrade_kit_WIN23C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23C2",
                "toBuildingId": "W_MultiAge_WIN23C3",
                "upgradeItemId": "silver_upgrade_kit_WIN23C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN23C3",
                "toBuildingId": "W_MultiAge_WIN23C4",
                "upgradeItemId": "golden_upgrade_kit_WIN23C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN22B1": {
        "baseBuildingId": "W_MultiAge_WIN22B1",
        "containedBuildingIds": [
            "W_MultiAge_WIN22B1",
            "W_MultiAge_WIN22B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN22B"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN22B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN22B",
                "name": "Nutcracker Guardhouse Upgrade Kit",
                "description": "Upgrades your Nutcracker Guardhouse to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_WIN22B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN22B1",
                "toBuildingId": "W_MultiAge_WIN22B2",
                "upgradeItemId": "upgrade_kit_WIN22B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL25A1": {
        "baseBuildingId": "W_MultiAge_HAL25A1",
        "containedBuildingIds": [
            "W_MultiAge_HAL25A1",
            "W_MultiAge_HAL25A2",
            "W_MultiAge_HAL25A3",
            "W_MultiAge_HAL25A4",
            "W_MultiAge_HAL25A5",
            "W_MultiAge_HAL25A6",
            "W_MultiAge_HAL25A7",
            "W_MultiAge_HAL25A8",
            "W_MultiAge_HAL25A9",
            "W_MultiAge_HAL25A10",
            "W_MultiAge_HAL25A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HAL25A",
            "silver_upgrade_kit_HAL25A",
            "golden_upgrade_kit_HAL25A"
        ],
        "upgradeItems": {
            "upgrade_kit_HAL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HAL25A",
                "name": "Boo’loon Spectral Fair Upgrade Kit",
                "description": "Upgrades your Boo’loon Spectral Fair to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HAL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HAL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HAL25A",
                "name": "Boo’loon Masquerade Carnival Silver Upgrade Kit",
                "description": "Upgrades your Boo’loon Spectral Fair to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HAL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HAL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL25A",
                "name": "Boo’loon Grand Gala Golden Upgrade Kit",
                "description": "Upgrades your Boo’loon Spectral Fair to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A1",
                "toBuildingId": "W_MultiAge_HAL25A2",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A2",
                "toBuildingId": "W_MultiAge_HAL25A3",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A3",
                "toBuildingId": "W_MultiAge_HAL25A4",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A4",
                "toBuildingId": "W_MultiAge_HAL25A5",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A5",
                "toBuildingId": "W_MultiAge_HAL25A6",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A6",
                "toBuildingId": "W_MultiAge_HAL25A7",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A7",
                "toBuildingId": "W_MultiAge_HAL25A8",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A8",
                "toBuildingId": "W_MultiAge_HAL25A9",
                "upgradeItemId": "upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A9",
                "toBuildingId": "W_MultiAge_HAL25A10",
                "upgradeItemId": "silver_upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25A10",
                "toBuildingId": "W_MultiAge_HAL25A11",
                "upgradeItemId": "golden_upgrade_kit_HAL25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL25B1": {
        "baseBuildingId": "W_MultiAge_HAL25B1",
        "containedBuildingIds": [
            "W_MultiAge_HAL25B1",
            "W_MultiAge_HAL25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_HAL25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_HAL25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HAL25B",
                "name": "Ascended Spooktastic Shakes Upgrade Kit",
                "description": "Upgrades your Spooktastic Shakes to a time limited Ascended Spooktastic Shakes that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HAL25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25B1",
                "toBuildingId": "W_MultiAge_HAL25B2",
                "upgradeItemId": "upgrade_kit_ascended_HAL25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL25C1": {
        "baseBuildingId": "W_MultiAge_HAL25C1",
        "containedBuildingIds": [
            "W_MultiAge_HAL25C1",
            "W_MultiAge_HAL25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_HAL25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_HAL25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HAL25C",
                "name": "Ascended Beastly Burgers Upgrade Kit",
                "description": "Upgrades your Beastly Burgers to a time limited Ascended Beastly Burgers that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HAL25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25C1",
                "toBuildingId": "W_MultiAge_HAL25C2",
                "upgradeItemId": "upgrade_kit_ascended_HAL25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL25E1": {
        "baseBuildingId": "W_MultiAge_HAL25E1",
        "containedBuildingIds": [
            "W_MultiAge_HAL25E1",
            "W_MultiAge_HAL25E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HAL25E"
        ],
        "upgradeItems": {
            "upgrade_kit_HAL25E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HAL25E",
                "name": "Rattlebones Raveyard Upgrade Kit",
                "description": "Upgrades your Rattlebones Raveyard to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HAL25E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL25E1",
                "toBuildingId": "W_MultiAge_HAL25E2",
                "upgradeItemId": "upgrade_kit_HAL25E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL15A1": {
        "baseBuildingId": "W_MultiAge_HAL15A1",
        "containedBuildingIds": [
            "W_MultiAge_HAL15A1",
            "W_MultiAge_HAL15A2",
            "W_MultiAge_HAL15A3",
            "W_MultiAge_HAL15A4"
        ],
        "containedUpgradeItemIds": [
            "golden_upgrade_kit_HAL15A",
            "platinum_upgrade_kit_HAL15A",
            "upgrade_kit_ascended_HAL15A"
        ],
        "upgradeItems": {
            "golden_upgrade_kit_HAL15A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL15A",
                "name": "Mad Scientist’s Den Golden Upgrade Kit",
                "description": "Upgrades your Mad Scientist’s Den to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL15A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_HAL15A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_HAL15A",
                "name": "Mad Scientist’s Lair Platinum Upgrade Kit",
                "description": "Upgrades your Mad Scientist’s Den to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_HAL15A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_HAL15A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HAL15A",
                "name": "Mad Scientist’s Dominion Upgrade Kit",
                "description": "Upgrades your Mad Scientist’s Lair to a time limited Mad Scientist’s Dominion that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HAL15A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL15A1",
                "toBuildingId": "W_MultiAge_HAL15A2",
                "upgradeItemId": "golden_upgrade_kit_HAL15A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL15A2",
                "toBuildingId": "W_MultiAge_HAL15A3",
                "upgradeItemId": "platinum_upgrade_kit_HAL15A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL15A3",
                "toBuildingId": "W_MultiAge_HAL15A4",
                "upgradeItemId": "upgrade_kit_ascended_HAL15A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL17A1": {
        "baseBuildingId": "W_MultiAge_HAL17A1",
        "containedBuildingIds": [
            "W_MultiAge_HAL17A1",
            "W_MultiAge_HAL17A2",
            "W_MultiAge_HAL17A3",
            "W_MultiAge_HAL17A4"
        ],
        "containedUpgradeItemIds": [
            "golden_upgrade_kit_HAL17A",
            "platinum_upgrade_kit_HAL17A",
            "upgrade_kit_ascended_HAL17A"
        ],
        "upgradeItems": {
            "golden_upgrade_kit_HAL17A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL17A",
                "name": "Gothic Tower Golden Upgrade Kit",
                "description": "Upgrades your Gothic Tower to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL17A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_HAL17A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_HAL17A",
                "name": "Baroque Tower Platinum Upgrade Kit",
                "description": "Upgrades your Gothic Tower to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_HAL17A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_HAL17A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HAL17A",
                "name": "Obsidian Tower Upgrade Kit",
                "description": "Upgrades your Baroque Tower to a time limited Obsidian Tower that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HAL17A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL17A1",
                "toBuildingId": "W_MultiAge_HAL17A2",
                "upgradeItemId": "golden_upgrade_kit_HAL17A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL17A2",
                "toBuildingId": "W_MultiAge_HAL17A3",
                "upgradeItemId": "platinum_upgrade_kit_HAL17A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL17A3",
                "toBuildingId": "W_MultiAge_HAL17A4",
                "upgradeItemId": "upgrade_kit_ascended_HAL17A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL24A1": {
        "baseBuildingId": "W_MultiAge_HAL24A1",
        "containedBuildingIds": [
            "W_MultiAge_HAL24A1",
            "W_MultiAge_HAL24A2",
            "W_MultiAge_HAL24A3",
            "W_MultiAge_HAL24A4",
            "W_MultiAge_HAL24A5",
            "W_MultiAge_HAL24A6",
            "W_MultiAge_HAL24A7",
            "W_MultiAge_HAL24A8",
            "W_MultiAge_HAL24A9",
            "W_MultiAge_HAL24A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HAL24A",
            "silver_upgrade_kit_HAL24A",
            "golden_upgrade_kit_HAL24A"
        ],
        "upgradeItems": {
            "upgrade_kit_HAL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HAL24A",
                "name": "Eerie Thrill Coaster Upgrade Kit",
                "description": "Upgrades your Eerie Thrill Coaster to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HAL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HAL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HAL24A",
                "name": "Eerie Terror Coaster Silver Upgrade Kit",
                "description": "Upgrades your Eerie Thrill Coaster to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HAL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HAL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL24A",
                "name": "Eerie Nightmare Coaster Golden Upgrade Kit",
                "description": "Upgrades your Eerie Thrill Coaster to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A1",
                "toBuildingId": "W_MultiAge_HAL24A2",
                "upgradeItemId": "upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A2",
                "toBuildingId": "W_MultiAge_HAL24A3",
                "upgradeItemId": "upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A3",
                "toBuildingId": "W_MultiAge_HAL24A4",
                "upgradeItemId": "upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A4",
                "toBuildingId": "W_MultiAge_HAL24A5",
                "upgradeItemId": "upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A5",
                "toBuildingId": "W_MultiAge_HAL24A6",
                "upgradeItemId": "upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A6",
                "toBuildingId": "W_MultiAge_HAL24A7",
                "upgradeItemId": "upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A7",
                "toBuildingId": "W_MultiAge_HAL24A8",
                "upgradeItemId": "upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A8",
                "toBuildingId": "W_MultiAge_HAL24A9",
                "upgradeItemId": "silver_upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24A9",
                "toBuildingId": "W_MultiAge_HAL24A10",
                "upgradeItemId": "golden_upgrade_kit_HAL24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL24F1": {
        "baseBuildingId": "W_MultiAge_HAL24F1",
        "containedBuildingIds": [
            "W_MultiAge_HAL24F1",
            "W_MultiAge_HAL24F2",
            "W_MultiAge_HAL24F3"
        ],
        "containedUpgradeItemIds": [
            "silver_upgrade_kit_HAL24F",
            "golden_upgrade_kit_HAL24F"
        ],
        "upgradeItems": {
            "silver_upgrade_kit_HAL24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HAL24F",
                "name": "Joker’s Haunted Spin Silver Upgrade Kit",
                "description": "Upgrades your Joker’s Sinister Spin to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HAL24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HAL24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL24F",
                "name": "Joker’s Malevolent Spin Golden Upgrade Kit",
                "description": "Upgrades your Joker’s Sinister Spin to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24F1",
                "toBuildingId": "W_MultiAge_HAL24F2",
                "upgradeItemId": "silver_upgrade_kit_HAL24F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL24F2",
                "toBuildingId": "W_MultiAge_HAL24F3",
                "upgradeItemId": "golden_upgrade_kit_HAL24F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL23A1": {
        "baseBuildingId": "W_MultiAge_HAL23A1",
        "containedBuildingIds": [
            "W_MultiAge_HAL23A1",
            "W_MultiAge_HAL23A2",
            "W_MultiAge_HAL23A3",
            "W_MultiAge_HAL23A4",
            "W_MultiAge_HAL23A5",
            "W_MultiAge_HAL23A6",
            "W_MultiAge_HAL23A7",
            "W_MultiAge_HAL23A8",
            "W_MultiAge_HAL23A9",
            "W_MultiAge_HAL23A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HAL23A",
            "silver_upgrade_kit_HAL23A",
            "golden_upgrade_kit_HAL23A"
        ],
        "upgradeItems": {
            "upgrade_kit_HAL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HAL23A",
                "name": "Laboratory of Monstrosities Upgrade Kit",
                "description": "Upgrades your Laboratory of Monstrosities to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_HAL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HAL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HAL23A",
                "name": "Sinister Laboratory of Monstrosities Silver Upgrade Kit",
                "description": "Upgrades your Laboratory of Monstrosities to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HAL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HAL23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL23A",
                "name": "Thundering Laboratory of Monstrosities Golden Upgrade Kit",
                "description": "Upgrades your Laboratory of Monstrosities to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A1",
                "toBuildingId": "W_MultiAge_HAL23A2",
                "upgradeItemId": "upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A2",
                "toBuildingId": "W_MultiAge_HAL23A3",
                "upgradeItemId": "upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A3",
                "toBuildingId": "W_MultiAge_HAL23A4",
                "upgradeItemId": "upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A4",
                "toBuildingId": "W_MultiAge_HAL23A5",
                "upgradeItemId": "upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A5",
                "toBuildingId": "W_MultiAge_HAL23A6",
                "upgradeItemId": "upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A6",
                "toBuildingId": "W_MultiAge_HAL23A7",
                "upgradeItemId": "upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A7",
                "toBuildingId": "W_MultiAge_HAL23A8",
                "upgradeItemId": "upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A8",
                "toBuildingId": "W_MultiAge_HAL23A9",
                "upgradeItemId": "silver_upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23A9",
                "toBuildingId": "W_MultiAge_HAL23A10",
                "upgradeItemId": "golden_upgrade_kit_HAL23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HAL23B1": {
        "baseBuildingId": "W_MultiAge_HAL23B1",
        "containedBuildingIds": [
            "W_MultiAge_HAL23B1",
            "W_MultiAge_HAL23B2",
            "W_MultiAge_HAL23B3",
            "W_MultiAge_HAL23B4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HAL23B",
            "silver_upgrade_kit_HAL23B",
            "golden_upgrade_kit_HAL23B"
        ],
        "upgradeItems": {
            "upgrade_kit_HAL23B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HAL23B",
                "name": "Sparkborn Stormspire Upgrade Kit",
                "description": "Upgrades your Sparkborn Stormspire to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_HAL23B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HAL23B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HAL23B",
                "name": "Sparksurge Stormspire Silver Upgrade Kit",
                "description": "Upgrades your Sparkborn Stormspire to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HAL23B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HAL23B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HAL23B",
                "name": "Sparkforge Stormspire Golden Upgrade Kit",
                "description": "Upgrades your Sparkborn Stormspire to its best version!",
                "iconAssetName": "golden_upgrade_kit_HAL23B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23B1",
                "toBuildingId": "W_MultiAge_HAL23B2",
                "upgradeItemId": "upgrade_kit_HAL23B",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23B2",
                "toBuildingId": "W_MultiAge_HAL23B3",
                "upgradeItemId": "silver_upgrade_kit_HAL23B",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HAL23B3",
                "toBuildingId": "W_MultiAge_HAL23B4",
                "upgradeItemId": "golden_upgrade_kit_HAL23B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD24A1": {
        "baseBuildingId": "W_MultiAge_WILD24A1",
        "containedBuildingIds": [
            "W_MultiAge_WILD24A1",
            "W_MultiAge_WILD24A2",
            "W_MultiAge_WILD24A3",
            "W_MultiAge_WILD24A4",
            "W_MultiAge_WILD24A5",
            "W_MultiAge_WILD24A6",
            "W_MultiAge_WILD24A7",
            "W_MultiAge_WILD24A8",
            "W_MultiAge_WILD24A9",
            "W_MultiAge_WILD24A10",
            "W_MultiAge_WILD24A11",
            "W_MultiAge_WILD24A12",
            "W_MultiAge_WILD24A13",
            "W_MultiAge_WILD24A14",
            "W_MultiAge_WILD24A15"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD24A",
            "silver_upgrade_kit_WILD24A",
            "golden_upgrade_kit_WILD24A",
            "platinum_upgrade_kit_WILD24A",
            "upgrade_kit_ascended_WILD24A"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD24A",
                "name": "Flamingo Habitat Upgrade Kit",
                "description": "Upgrades your Flamingo Habitat to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WILD24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WILD24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WILD24A",
                "name": "Serene Flamingo Habitat Silver Upgrade Kit",
                "description": "Upgrades your Flamingo Habitat to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WILD24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD24A",
                "name": "Serene Flamingo Paradise Golden Upgrade Kit",
                "description": "Upgrades your Flamingo Paradise to its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_WILD24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_WILD24A",
                "name": "Sacred Flamingo Paradise Platinum Upgrade Kit",
                "description": "Upgrades your Sacred Flamingo Paradise to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_WILD24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_WILD24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WILD24A",
                "name": "Radiant Flamingo Paradise Upgrade Kit",
                "description": "Upgrades your Sacred Flamingo Paradise to a time limited Radiant Flamingo Paradise that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WILD24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A1",
                "toBuildingId": "W_MultiAge_WILD24A2",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A2",
                "toBuildingId": "W_MultiAge_WILD24A3",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A3",
                "toBuildingId": "W_MultiAge_WILD24A4",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A4",
                "toBuildingId": "W_MultiAge_WILD24A5",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A5",
                "toBuildingId": "W_MultiAge_WILD24A6",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A6",
                "toBuildingId": "W_MultiAge_WILD24A7",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A7",
                "toBuildingId": "W_MultiAge_WILD24A8",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A8",
                "toBuildingId": "W_MultiAge_WILD24A9",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A9",
                "toBuildingId": "W_MultiAge_WILD24A10",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A10",
                "toBuildingId": "W_MultiAge_WILD24A11",
                "upgradeItemId": "upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A11",
                "toBuildingId": "W_MultiAge_WILD24A12",
                "upgradeItemId": "silver_upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A12",
                "toBuildingId": "W_MultiAge_WILD24A13",
                "upgradeItemId": "golden_upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 12,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A13",
                "toBuildingId": "W_MultiAge_WILD24A14",
                "upgradeItemId": "platinum_upgrade_kit_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 13,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24A14",
                "toBuildingId": "W_MultiAge_WILD24A15",
                "upgradeItemId": "upgrade_kit_ascended_WILD24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD24C1": {
        "baseBuildingId": "W_MultiAge_WILD24C1",
        "containedBuildingIds": [
            "W_MultiAge_WILD24C1",
            "W_MultiAge_WILD24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD24C"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD24C",
                "name": "Tapir Trails Upgrade Kit",
                "description": "Upgrades your Tapir Trails to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WILD24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24C1",
                "toBuildingId": "W_MultiAge_WILD24C2",
                "upgradeItemId": "upgrade_kit_WILD24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD24D1": {
        "baseBuildingId": "W_MultiAge_WILD24D1",
        "containedBuildingIds": [
            "W_MultiAge_WILD24D1",
            "W_MultiAge_WILD24D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD24D"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD24D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD24D",
                "name": "Alligator Swamp Upgrade Kit",
                "description": "Upgrades your Alligator Swamp to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WILD24D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD24D1",
                "toBuildingId": "W_MultiAge_WILD24D2",
                "upgradeItemId": "upgrade_kit_WILD24D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT24A1": {
        "baseBuildingId": "W_MultiAge_PAT24A1",
        "containedBuildingIds": [
            "W_MultiAge_PAT24A1",
            "W_MultiAge_PAT24A2",
            "W_MultiAge_PAT24A3",
            "W_MultiAge_PAT24A4",
            "W_MultiAge_PAT24A5",
            "W_MultiAge_PAT24A6",
            "W_MultiAge_PAT24A7",
            "W_MultiAge_PAT24A8",
            "W_MultiAge_PAT24A9"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT24A",
            "silver_upgrade_kit_PAT24A",
            "golden_upgrade_kit_PAT24A"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT24A",
                "name": "Celtic Tavern Upgrade Kit",
                "description": "Upgrades your Celtic Tavern to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_PAT24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_PAT24A",
                "name": "Enchanted Celtic Tavern Silver Upgrade Kit",
                "description": "Upgrades your Celtic Tavern to its second best version!",
                "iconAssetName": "silver_upgrade_kit_PAT24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_PAT24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_PAT24A",
                "name": "Mystic Celtic Tavern Golden Upgrade Kit",
                "description": "Upgrades your Celtic Tavern to its best version!",
                "iconAssetName": "golden_upgrade_kit_PAT24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A1",
                "toBuildingId": "W_MultiAge_PAT24A2",
                "upgradeItemId": "upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A2",
                "toBuildingId": "W_MultiAge_PAT24A3",
                "upgradeItemId": "upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A3",
                "toBuildingId": "W_MultiAge_PAT24A4",
                "upgradeItemId": "upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A4",
                "toBuildingId": "W_MultiAge_PAT24A5",
                "upgradeItemId": "upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A5",
                "toBuildingId": "W_MultiAge_PAT24A6",
                "upgradeItemId": "upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A6",
                "toBuildingId": "W_MultiAge_PAT24A7",
                "upgradeItemId": "upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A7",
                "toBuildingId": "W_MultiAge_PAT24A8",
                "upgradeItemId": "silver_upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24A8",
                "toBuildingId": "W_MultiAge_PAT24A9",
                "upgradeItemId": "golden_upgrade_kit_PAT24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT23B1": {
        "baseBuildingId": "W_MultiAge_PAT23B1",
        "containedBuildingIds": [
            "W_MultiAge_PAT23B1",
            "W_MultiAge_PAT23B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT23B"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT23B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT23B",
                "name": "Tree of Silence Upgrade Kit",
                "description": "Upgrades your Tree of Silence to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT23B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23B1",
                "toBuildingId": "W_MultiAge_PAT23B2",
                "upgradeItemId": "upgrade_kit_PAT23B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT23C1": {
        "baseBuildingId": "W_MultiAge_PAT23C1",
        "containedBuildingIds": [
            "W_MultiAge_PAT23C1",
            "W_MultiAge_PAT23C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT23C"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT23C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT23C",
                "name": "Tree of Patience Upgrade Kit",
                "description": "Upgrades your Tree of Patience to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT23C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23C1",
                "toBuildingId": "W_MultiAge_PAT23C2",
                "upgradeItemId": "upgrade_kit_PAT23C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT23D1": {
        "baseBuildingId": "W_MultiAge_PAT23D1",
        "containedBuildingIds": [
            "W_MultiAge_PAT23D1",
            "W_MultiAge_PAT23D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT23D"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT23D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT23D",
                "name": "Tree of Vitality Upgrade Kit",
                "description": "Upgrades your Tree of Vitality to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT23D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT23D1",
                "toBuildingId": "W_MultiAge_PAT23D2",
                "upgradeItemId": "upgrade_kit_PAT23D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT24C1": {
        "baseBuildingId": "W_MultiAge_PAT24C1",
        "containedBuildingIds": [
            "W_MultiAge_PAT24C1",
            "W_MultiAge_PAT24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT24C"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT24C",
                "name": "Celtic Glassworks Upgrade Kit",
                "description": "Upgrades your Celtic Glassworks to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT24C1",
                "toBuildingId": "W_MultiAge_PAT24C2",
                "upgradeItemId": "upgrade_kit_PAT24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24A1": {
        "baseBuildingId": "W_MultiAge_GBG24A1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24A1",
            "W_MultiAge_GBG24A2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24A"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24A",
                "name": "Wyverntide Spire of Victory Upgrade Kit",
                "description": "Upgrades your Wyverntide Spire of Victory to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24A1",
                "toBuildingId": "W_MultiAge_GBG24A2",
                "upgradeItemId": "upgrade_kit_GBG24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24B1": {
        "baseBuildingId": "W_MultiAge_GBG24B1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24B1",
            "W_MultiAge_GBG24B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24B"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24B",
                "name": "Wyverntide Smithy Upgrade Kit",
                "description": "Upgrades your Wyverntide Smithy to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24B1",
                "toBuildingId": "W_MultiAge_GBG24B2",
                "upgradeItemId": "upgrade_kit_GBG24B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI24A1": {
        "baseBuildingId": "W_MultiAge_ANNI24A1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI24A1",
            "W_MultiAge_ANNI24A2",
            "W_MultiAge_ANNI24A3",
            "W_MultiAge_ANNI24A4",
            "W_MultiAge_ANNI24A5",
            "W_MultiAge_ANNI24A6",
            "W_MultiAge_ANNI24A7",
            "W_MultiAge_ANNI24A8",
            "W_MultiAge_ANNI24A9",
            "W_MultiAge_ANNI24A10",
            "W_MultiAge_ANNI24A11",
            "W_MultiAge_ANNI24A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ANNI24A",
            "silver_upgrade_kit_ANNI24A",
            "golden_upgrade_kit_ANNI24A"
        ],
        "upgradeItems": {
            "upgrade_kit_ANNI24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ANNI24A",
                "name": "Metro Station Upgrade Kit",
                "description": "Upgrades your Metro Station to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_ANNI24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_ANNI24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_ANNI24A",
                "name": "Metro Plaza Silver Upgrade Kit",
                "description": "Upgrades your Metro Station to its second best version!",
                "iconAssetName": "silver_upgrade_kit_ANNI24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ANNI24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ANNI24A",
                "name": "Urban Metro Plaza Golden Upgrade Kit",
                "description": "Upgrades your Metro Station to its best version!",
                "iconAssetName": "golden_upgrade_kit_ANNI24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A1",
                "toBuildingId": "W_MultiAge_ANNI24A2",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A2",
                "toBuildingId": "W_MultiAge_ANNI24A3",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A3",
                "toBuildingId": "W_MultiAge_ANNI24A4",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A4",
                "toBuildingId": "W_MultiAge_ANNI24A5",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A5",
                "toBuildingId": "W_MultiAge_ANNI24A6",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A6",
                "toBuildingId": "W_MultiAge_ANNI24A7",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A7",
                "toBuildingId": "W_MultiAge_ANNI24A8",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A8",
                "toBuildingId": "W_MultiAge_ANNI24A9",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A9",
                "toBuildingId": "W_MultiAge_ANNI24A10",
                "upgradeItemId": "upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A10",
                "toBuildingId": "W_MultiAge_ANNI24A11",
                "upgradeItemId": "silver_upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI24A11",
                "toBuildingId": "W_MultiAge_ANNI24A12",
                "upgradeItemId": "golden_upgrade_kit_ANNI24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_AgeBonus22": {
        "baseBuildingId": "W_MultiAge_AgeBonus22",
        "containedBuildingIds": [
            "W_MultiAge_AgeBonus22",
            "W_MultiAge_AgeBonus22stage"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ANNI22B"
        ],
        "upgradeItems": {
            "upgrade_kit_ANNI22B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ANNI22B",
                "name": "Stage of Ages Upgrade Kit",
                "description": "Upgrades your Stage of Ages to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_ANNI22B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_AgeBonus22",
                "toBuildingId": "W_MultiAge_AgeBonus22stage",
                "upgradeItemId": "upgrade_kit_ANNI22B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP24A1": {
        "baseBuildingId": "W_MultiAge_COP24A1",
        "containedBuildingIds": [
            "W_MultiAge_COP24A1",
            "W_MultiAge_COP24A2",
            "W_MultiAge_COP24A3",
            "W_MultiAge_COP24A4",
            "W_MultiAge_COP24A5",
            "W_MultiAge_COP24A6",
            "W_MultiAge_COP24A7",
            "W_MultiAge_COP24A8",
            "W_MultiAge_COP24A9",
            "W_MultiAge_COP24A10TEMP"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_refined_yggdrasil",
            "upgrade_kit_ascended_yggdrasil"
        ],
        "upgradeItems": {
            "upgrade_kit_refined_yggdrasil": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_refined_yggdrasil",
                "name": "Yggdrasil Upgrade Kit",
                "description": "Upgrades your Yggdrasil to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_yggdrasil",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_yggdrasil": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_yggdrasil",
                "name": "Ascended Yggdrasil Upgrade Kit",
                "description": "Upgrades your fully upgraded building to a time-limited ascended version that will produce more resources. When the time expires, it reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_yggdrasil",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A1",
                "toBuildingId": "W_MultiAge_COP24A2",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A2",
                "toBuildingId": "W_MultiAge_COP24A3",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A3",
                "toBuildingId": "W_MultiAge_COP24A4",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A4",
                "toBuildingId": "W_MultiAge_COP24A5",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A5",
                "toBuildingId": "W_MultiAge_COP24A6",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A6",
                "toBuildingId": "W_MultiAge_COP24A7",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A7",
                "toBuildingId": "W_MultiAge_COP24A8",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A8",
                "toBuildingId": "W_MultiAge_COP24A9",
                "upgradeItemId": "upgrade_kit_refined_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24A9",
                "toBuildingId": "W_MultiAge_COP24A10TEMP",
                "upgradeItemId": "upgrade_kit_ascended_yggdrasil",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP24B1": {
        "baseBuildingId": "W_MultiAge_COP24B1",
        "containedBuildingIds": [
            "W_MultiAge_COP24B1",
            "W_MultiAge_COP24B2",
            "W_MultiAge_COP24B3",
            "W_MultiAge_COP24B4",
            "W_MultiAge_COP24B5",
            "W_MultiAge_COP24B6",
            "W_MultiAge_COP24B7",
            "W_MultiAge_COP24B8",
            "W_MultiAge_COP24B9",
            "W_MultiAge_COP24B10TEMP"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_refined_shinto_temple",
            "upgrade_kit_ascended_shinto_temple"
        ],
        "upgradeItems": {
            "upgrade_kit_refined_shinto_temple": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_refined_shinto_temple",
                "name": "Shinto Temple Upgrade Kit",
                "description": "Upgrades your Shinto Temple to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_shinto_temple",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_shinto_temple": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_shinto_temple",
                "name": "Ascended Shinto Temple Upgrade Kit",
                "description": "Upgrades your fully upgraded building to a time-limited ascended version that will produce more resources. When the time expires, it reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_shinto_temple",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B1",
                "toBuildingId": "W_MultiAge_COP24B2",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B2",
                "toBuildingId": "W_MultiAge_COP24B3",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B3",
                "toBuildingId": "W_MultiAge_COP24B4",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B4",
                "toBuildingId": "W_MultiAge_COP24B5",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B5",
                "toBuildingId": "W_MultiAge_COP24B6",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B6",
                "toBuildingId": "W_MultiAge_COP24B7",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B7",
                "toBuildingId": "W_MultiAge_COP24B8",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B8",
                "toBuildingId": "W_MultiAge_COP24B9",
                "upgradeItemId": "upgrade_kit_refined_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24B9",
                "toBuildingId": "W_MultiAge_COP24B10TEMP",
                "upgradeItemId": "upgrade_kit_ascended_shinto_temple",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP24C1": {
        "baseBuildingId": "W_MultiAge_COP24C1",
        "containedBuildingIds": [
            "W_MultiAge_COP24C1",
            "W_MultiAge_COP24C2",
            "W_MultiAge_COP24C3",
            "W_MultiAge_COP24C4",
            "W_MultiAge_COP24C5",
            "W_MultiAge_COP24C6",
            "W_MultiAge_COP24C7TEMP"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_refined_royal_bathhouse",
            "upgrade_kit_ascended_royal_bathhouse"
        ],
        "upgradeItems": {
            "upgrade_kit_refined_royal_bathhouse": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_refined_royal_bathhouse",
                "name": "Royal Bathhouse Upgrade Kit",
                "description": "Upgrades your Royal Bathhouse to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_royal_bathhouse",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_royal_bathhouse": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_royal_bathhouse",
                "name": "Ascended Royal Bathhouse Upgrade Kit",
                "description": "Upgrades your fully upgraded building to a time-limited ascended version that will produce more resources. When the time expires, it reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_royal_bathhouse",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24C1",
                "toBuildingId": "W_MultiAge_COP24C2",
                "upgradeItemId": "upgrade_kit_refined_royal_bathhouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24C2",
                "toBuildingId": "W_MultiAge_COP24C3",
                "upgradeItemId": "upgrade_kit_refined_royal_bathhouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24C3",
                "toBuildingId": "W_MultiAge_COP24C4",
                "upgradeItemId": "upgrade_kit_refined_royal_bathhouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24C4",
                "toBuildingId": "W_MultiAge_COP24C5",
                "upgradeItemId": "upgrade_kit_refined_royal_bathhouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24C5",
                "toBuildingId": "W_MultiAge_COP24C6",
                "upgradeItemId": "upgrade_kit_refined_royal_bathhouse",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24C6",
                "toBuildingId": "W_MultiAge_COP24C7TEMP",
                "upgradeItemId": "upgrade_kit_ascended_royal_bathhouse",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP24D1": {
        "baseBuildingId": "W_MultiAge_COP24D1",
        "containedBuildingIds": [
            "W_MultiAge_COP24D1",
            "W_MultiAge_COP24D2",
            "W_MultiAge_COP24D3",
            "W_MultiAge_COP24D4",
            "W_MultiAge_COP24D5",
            "W_MultiAge_COP24D6",
            "W_MultiAge_COP24D7",
            "W_MultiAge_COP24D8",
            "W_MultiAge_COP24D9",
            "W_MultiAge_COP24D10TEMP"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_refined_sun_temple",
            "upgrade_kit_ascended_sun_temple"
        ],
        "upgradeItems": {
            "upgrade_kit_refined_sun_temple": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_refined_sun_temple",
                "name": "Sun Temple Upgrade Kit",
                "description": "Upgrades your Sun Temple building",
                "iconAssetName": "upgrade_kit_sun_temple",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_sun_temple": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_sun_temple",
                "name": "Ascended Sun Temple Upgrade Kit",
                "description": "Upgrades your fully upgraded building to a time-limited ascended version that will produce more resources. When the time expires, it reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_sun_temple",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D1",
                "toBuildingId": "W_MultiAge_COP24D2",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D2",
                "toBuildingId": "W_MultiAge_COP24D3",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D3",
                "toBuildingId": "W_MultiAge_COP24D4",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D4",
                "toBuildingId": "W_MultiAge_COP24D5",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D5",
                "toBuildingId": "W_MultiAge_COP24D6",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D6",
                "toBuildingId": "W_MultiAge_COP24D7",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D7",
                "toBuildingId": "W_MultiAge_COP24D8",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D8",
                "toBuildingId": "W_MultiAge_COP24D9",
                "upgradeItemId": "upgrade_kit_refined_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24D9",
                "toBuildingId": "W_MultiAge_COP24D10TEMP",
                "upgradeItemId": "upgrade_kit_ascended_sun_temple",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP24E1": {
        "baseBuildingId": "W_MultiAge_COP24E1",
        "containedBuildingIds": [
            "W_MultiAge_COP24E1",
            "W_MultiAge_COP24E2",
            "W_MultiAge_COP24E3",
            "W_MultiAge_COP24E4",
            "W_MultiAge_COP24E5",
            "W_MultiAge_COP24E6",
            "W_MultiAge_COP24E7TEMP"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_refined_mughals_temple",
            "upgrade_kit_ascended_mughals_temple"
        ],
        "upgradeItems": {
            "upgrade_kit_refined_mughals_temple": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_refined_mughals_temple",
                "name": "Mughal's Temple Upgrade Kit",
                "description": "Upgrades your Mughal's Temple building",
                "iconAssetName": "upgrade_kit_maharajas_temple",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_mughals_temple": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_mughals_temple",
                "name": "Ascended Mughal's Temple Upgrade Kit",
                "description": "Upgrades your fully upgraded building to a time-limited ascended version that will produce more resources. When the time expires, it reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_mughals_temple",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24E1",
                "toBuildingId": "W_MultiAge_COP24E2",
                "upgradeItemId": "upgrade_kit_refined_mughals_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24E2",
                "toBuildingId": "W_MultiAge_COP24E3",
                "upgradeItemId": "upgrade_kit_refined_mughals_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24E3",
                "toBuildingId": "W_MultiAge_COP24E4",
                "upgradeItemId": "upgrade_kit_refined_mughals_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24E4",
                "toBuildingId": "W_MultiAge_COP24E5",
                "upgradeItemId": "upgrade_kit_refined_mughals_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24E5",
                "toBuildingId": "W_MultiAge_COP24E6",
                "upgradeItemId": "upgrade_kit_refined_mughals_temple",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24E6",
                "toBuildingId": "W_MultiAge_COP24E7TEMP",
                "upgradeItemId": "upgrade_kit_ascended_mughals_temple",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP24J1": {
        "baseBuildingId": "W_MultiAge_COP24J1",
        "containedBuildingIds": [
            "W_MultiAge_COP24J1",
            "W_MultiAge_COP24J2",
            "W_MultiAge_COP24J3",
            "W_MultiAge_COP24J4",
            "W_MultiAge_COP24J5",
            "W_MultiAge_COP24J6",
            "W_MultiAge_COP24J7",
            "W_MultiAge_COP24J8",
            "W_MultiAge_COP24J9",
            "W_MultiAge_COP24J10TEMP"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_refined_hut_of_the_sacred_instruments",
            "upgrade_kit_ascended_hut_of_the_sacred_instruments"
        ],
        "upgradeItems": {
            "upgrade_kit_refined_hut_of_the_sacred_instruments": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "name": "Hut of the Sacred Instrument Upgrade Kit",
                "description": "Upgrades your Hut of the Sacred Instrument building",
                "iconAssetName": "upgrade_kit_hut_of_the_sacred_instruments",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_hut_of_the_sacred_instruments": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_hut_of_the_sacred_instruments",
                "name": "Ascended Hut of the Sacred Instruments Upgrade Kit",
                "description": "Upgrades your fully upgraded building to a time-limited ascended version that will produce more resources. When the time expires, it reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_hut_of_the_sacred_instruments",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J1",
                "toBuildingId": "W_MultiAge_COP24J2",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J2",
                "toBuildingId": "W_MultiAge_COP24J3",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J3",
                "toBuildingId": "W_MultiAge_COP24J4",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J4",
                "toBuildingId": "W_MultiAge_COP24J5",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J5",
                "toBuildingId": "W_MultiAge_COP24J6",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J6",
                "toBuildingId": "W_MultiAge_COP24J7",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J7",
                "toBuildingId": "W_MultiAge_COP24J8",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J8",
                "toBuildingId": "W_MultiAge_COP24J9",
                "upgradeItemId": "upgrade_kit_refined_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24J9",
                "toBuildingId": "W_MultiAge_COP24J10TEMP",
                "upgradeItemId": "upgrade_kit_ascended_hut_of_the_sacred_instruments",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP24JB1": {
        "baseBuildingId": "W_MultiAge_COP24JB1",
        "containedBuildingIds": [
            "W_MultiAge_COP24JB1",
            "W_MultiAge_COP24JB2",
            "W_MultiAge_COP24JB3",
            "W_MultiAge_COP24JB4",
            "W_MultiAge_COP24JB5"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_great_dance_stage"
        ],
        "upgradeItems": {
            "upgrade_kit_great_dance_stage": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_great_dance_stage",
                "name": "Great Dance Stage Upgrade Kit",
                "description": "Upgrades your Great Dance Stage building",
                "iconAssetName": "upgrade_kit_great_dance_stage",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24JB1",
                "toBuildingId": "W_MultiAge_COP24JB2",
                "upgradeItemId": "upgrade_kit_great_dance_stage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24JB2",
                "toBuildingId": "W_MultiAge_COP24JB3",
                "upgradeItemId": "upgrade_kit_great_dance_stage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24JB3",
                "toBuildingId": "W_MultiAge_COP24JB4",
                "upgradeItemId": "upgrade_kit_great_dance_stage",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP24JB4",
                "toBuildingId": "W_MultiAge_COP24JB5",
                "upgradeItemId": "upgrade_kit_great_dance_stage",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR23A1": {
        "baseBuildingId": "W_MultiAge_GR23A1",
        "containedBuildingIds": [
            "W_MultiAge_GR23A1",
            "W_MultiAge_GR23A2",
            "W_MultiAge_GR23A3",
            "W_MultiAge_GR23A4",
            "W_MultiAge_GR23A5",
            "W_MultiAge_GR23A6",
            "W_MultiAge_GR23A7",
            "W_MultiAge_GR23A8",
            "W_MultiAge_GR23A9",
            "W_MultiAge_GR23A10",
            "W_MultiAge_GR23A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR23A",
            "silver_upgrade_kit_GR23A",
            "golden_upgrade_kit_GR23A",
            "platinum_upgrade_kit_GR23A"
        ],
        "upgradeItems": {
            "upgrade_kit_GR23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR23A",
                "name": "Neo Colossus Upgrade Kit",
                "description": "Upgrades your Neo Colossus to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_GR23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_GR23A",
                "name": "Neo Colossus Silver Upgrade Kit",
                "description": "Upgrades your Neo Colossus to its second best version!",
                "iconAssetName": "silver_upgrade_kit_GR23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_GR23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_GR23A",
                "name": "Neo Colossus Golden Upgrade Kit",
                "description": "Upgrades your Neo Colossus to its best version!",
                "iconAssetName": "golden_upgrade_kit_GR23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_GR23A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_GR23A",
                "name": "Neo Colossus Platinum Upgrade Kit",
                "description": "Upgrades your Neo Colossus to its final form!",
                "iconAssetName": "platinum_upgrade_kit_GR23A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A1",
                "toBuildingId": "W_MultiAge_GR23A2",
                "upgradeItemId": "upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A2",
                "toBuildingId": "W_MultiAge_GR23A3",
                "upgradeItemId": "upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A3",
                "toBuildingId": "W_MultiAge_GR23A4",
                "upgradeItemId": "upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A4",
                "toBuildingId": "W_MultiAge_GR23A5",
                "upgradeItemId": "upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A5",
                "toBuildingId": "W_MultiAge_GR23A6",
                "upgradeItemId": "upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A6",
                "toBuildingId": "W_MultiAge_GR23A7",
                "upgradeItemId": "upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A7",
                "toBuildingId": "W_MultiAge_GR23A8",
                "upgradeItemId": "upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A8",
                "toBuildingId": "W_MultiAge_GR23A9",
                "upgradeItemId": "silver_upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A9",
                "toBuildingId": "W_MultiAge_GR23A10",
                "upgradeItemId": "golden_upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23A10",
                "toBuildingId": "W_MultiAge_GR23A11",
                "upgradeItemId": "platinum_upgrade_kit_GR23A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR23B1": {
        "baseBuildingId": "W_MultiAge_GR23B1",
        "containedBuildingIds": [
            "W_MultiAge_GR23B1",
            "W_MultiAge_GR23B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR23B"
        ],
        "upgradeItems": {
            "upgrade_kit_GR23B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR23B",
                "name": "Neo Winners' Plaza Upgrade Kit",
                "description": "Upgrades your Neo Winners' Plaza to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR23B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23B1",
                "toBuildingId": "W_MultiAge_GR23B2",
                "upgradeItemId": "upgrade_kit_GR23B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR23C1": {
        "baseBuildingId": "W_MultiAge_GR23C1",
        "containedBuildingIds": [
            "W_MultiAge_GR23C1",
            "W_MultiAge_GR23C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR23C"
        ],
        "upgradeItems": {
            "upgrade_kit_GR23C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR23C",
                "name": "Neo Marble Gate Way Upgrade Kit",
                "description": "Upgrades your Neo Marble Gate Way to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR23C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23C1",
                "toBuildingId": "W_MultiAge_GR23C2",
                "upgradeItemId": "upgrade_kit_GR23C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR23D1": {
        "baseBuildingId": "W_MultiAge_GR23D1",
        "containedBuildingIds": [
            "W_MultiAge_GR23D1",
            "W_MultiAge_GR23D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR23D"
        ],
        "upgradeItems": {
            "upgrade_kit_GR23D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR23D",
                "name": "Neo Botanical Rotunda Upgrade Kit",
                "description": "Upgrades your Neo Botanical Rotunda to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR23D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR23D1",
                "toBuildingId": "W_MultiAge_GR23D2",
                "upgradeItemId": "upgrade_kit_GR23D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR24A1": {
        "baseBuildingId": "W_MultiAge_GR24A1",
        "containedBuildingIds": [
            "W_MultiAge_GR24A1",
            "W_MultiAge_GR24A2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR24A"
        ],
        "upgradeItems": {
            "upgrade_kit_GR24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR24A",
                "name": "Neo Tactician's Tower Upgrade Kit",
                "description": "Upgrades your Neo Tactician's Tower to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR24A1",
                "toBuildingId": "W_MultiAge_GR24A2",
                "upgradeItemId": "upgrade_kit_GR24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR24B1": {
        "baseBuildingId": "W_MultiAge_GR24B1",
        "containedBuildingIds": [
            "W_MultiAge_GR24B1",
            "W_MultiAge_GR24B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR24B"
        ],
        "upgradeItems": {
            "upgrade_kit_GR24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR24B",
                "name": "Neo Sentinel Outpost Upgrade Kit",
                "description": "Upgrades your Neo Sentinel Outpost to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR24B1",
                "toBuildingId": "W_MultiAge_GR24B2",
                "upgradeItemId": "upgrade_kit_GR24B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24C1": {
        "baseBuildingId": "W_MultiAge_GBG24C1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24C1",
            "W_MultiAge_GBG24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24C"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24C",
                "name": "Thunderdrake Citadel Upgrade Kit",
                "description": "Upgrades your Thunderdrake Citadel to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24C1",
                "toBuildingId": "W_MultiAge_GBG24C2",
                "upgradeItemId": "upgrade_kit_GBG24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24D1": {
        "baseBuildingId": "W_MultiAge_GBG24D1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24D1",
            "W_MultiAge_GBG24D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24D"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24D",
                "name": "Thunderdrake Siegeshop Upgrade Kit",
                "description": "Upgrades your Thunderdrake Siegeshop to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24D1",
                "toBuildingId": "W_MultiAge_GBG24D2",
                "upgradeItemId": "upgrade_kit_GBG24D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM24A1": {
        "baseBuildingId": "W_MultiAge_SUM24A1",
        "containedBuildingIds": [
            "W_MultiAge_SUM24A1",
            "W_MultiAge_SUM24A2",
            "W_MultiAge_SUM24A3",
            "W_MultiAge_SUM24A4",
            "W_MultiAge_SUM24A5",
            "W_MultiAge_SUM24A6",
            "W_MultiAge_SUM24A7",
            "W_MultiAge_SUM24A8",
            "W_MultiAge_SUM24A9",
            "W_MultiAge_SUM24A10",
            "W_MultiAge_SUM24A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_SUM24A",
            "silver_upgrade_kit_SUM24A",
            "golden_upgrade_kit_SUM24A"
        ],
        "upgradeItems": {
            "upgrade_kit_SUM24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_SUM24A",
                "name": "Dragon’s Breath Upgrade Kit",
                "description": "Upgrades your Dragon’s Breath to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_SUM24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_SUM24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_SUM24A",
                "name": "Silver Dragon’s Breath Silver Upgrade Kit",
                "description": "Upgrades your Dragon’s Breath to its second best version!",
                "iconAssetName": "silver_upgrade_kit_SUM24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_SUM24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_SUM24A",
                "name": "Crimson Dragon’s Breath Golden Upgrade Kit",
                "description": "Upgrades your Dragon’s Breath to its best version!",
                "iconAssetName": "golden_upgrade_kit_SUM24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A1",
                "toBuildingId": "W_MultiAge_SUM24A2",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A2",
                "toBuildingId": "W_MultiAge_SUM24A3",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A3",
                "toBuildingId": "W_MultiAge_SUM24A4",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A4",
                "toBuildingId": "W_MultiAge_SUM24A5",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A5",
                "toBuildingId": "W_MultiAge_SUM24A6",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A6",
                "toBuildingId": "W_MultiAge_SUM24A7",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A7",
                "toBuildingId": "W_MultiAge_SUM24A8",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A8",
                "toBuildingId": "W_MultiAge_SUM24A9",
                "upgradeItemId": "upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A9",
                "toBuildingId": "W_MultiAge_SUM24A10",
                "upgradeItemId": "silver_upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24A10",
                "toBuildingId": "W_MultiAge_SUM24A11",
                "upgradeItemId": "golden_upgrade_kit_SUM24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM24B1": {
        "baseBuildingId": "W_MultiAge_SUM24B1",
        "containedBuildingIds": [
            "W_MultiAge_SUM24B1",
            "W_MultiAge_SUM24B2",
            "W_MultiAge_SUM24B3"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_SUM24B",
            "upgrade_kit_ascended_SUM24B"
        ],
        "upgradeItems": {
            "upgrade_kit_SUM24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_SUM24B",
                "name": "Golden Dragon Gong Upgrade Kit",
                "description": "Upgrades your Golden Dragon Gong to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_SUM24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_SUM24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_SUM24B",
                "name": "Ascended Golden Dragon Gong Upgrade Kit",
                "description": "Upgrades your fully upgraded Golden Dragon Gong to a time limited Ascended Golden Dragon Gong that will produce more resources. When the time expires, the building reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_SUM24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24B1",
                "toBuildingId": "W_MultiAge_SUM24B2",
                "upgradeItemId": "upgrade_kit_SUM24B",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24B2",
                "toBuildingId": "W_MultiAge_SUM24B3",
                "upgradeItemId": "upgrade_kit_ascended_SUM24B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM24C1": {
        "baseBuildingId": "W_MultiAge_SUM24C1",
        "containedBuildingIds": [
            "W_MultiAge_SUM24C1",
            "W_MultiAge_SUM24C2",
            "W_MultiAge_SUM24C3"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_SUM24C",
            "upgrade_kit_ascended_SUM24C"
        ],
        "upgradeItems": {
            "upgrade_kit_SUM24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_SUM24C",
                "name": "Zheng's Golden Bell Upgrade Kit",
                "description": "Upgrades your Zheng's Golden Bell to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_SUM24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_SUM24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_SUM24C",
                "name": "Ascended Zheng's Golden Bell Upgrade Kit",
                "description": "Upgrades your fully upgraded Zheng's Golden Bell to a time limited Ascended Zheng's Golden Bell that will produce more resources. When the time expires, the building reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_SUM24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24C1",
                "toBuildingId": "W_MultiAge_SUM24C2",
                "upgradeItemId": "upgrade_kit_SUM24C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24C2",
                "toBuildingId": "W_MultiAge_SUM24C3",
                "upgradeItemId": "upgrade_kit_ascended_SUM24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM24F1": {
        "baseBuildingId": "W_MultiAge_SUM24F1",
        "containedBuildingIds": [
            "W_MultiAge_SUM24F1",
            "W_MultiAge_SUM24F2",
            "W_MultiAge_SUM24F3",
            "W_MultiAge_SUM24F4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_SUM24F",
            "silver_upgrade_kit_SUM24F",
            "golden_upgrade_kit_SUM24F"
        ],
        "upgradeItems": {
            "upgrade_kit_SUM24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_SUM24F",
                "name": "Sailmaker’s Workshop Upgrade Kit",
                "description": "Upgrades your Sailmaker’s Workshop to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_SUM24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_SUM24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_SUM24F",
                "name": "Sailmaker’s Studio Silver Upgrade Kit",
                "description": "Upgrades your Sailmaker’s Workshop to its second best version!",
                "iconAssetName": "silver_upgrade_kit_SUM24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_SUM24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_SUM24F",
                "name": "Sailmaker’s Atelier Golden Upgrade Kit",
                "description": "Upgrades your Sailmaker’s Workshop to its best version!",
                "iconAssetName": "golden_upgrade_kit_SUM24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24F1",
                "toBuildingId": "W_MultiAge_SUM24F2",
                "upgradeItemId": "upgrade_kit_SUM24F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24F2",
                "toBuildingId": "W_MultiAge_SUM24F3",
                "upgradeItemId": "silver_upgrade_kit_SUM24F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM24F3",
                "toBuildingId": "W_MultiAge_SUM24F4",
                "upgradeItemId": "golden_upgrade_kit_SUM24F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE24A1": {
        "baseBuildingId": "W_MultiAge_CARE24A1",
        "containedBuildingIds": [
            "W_MultiAge_CARE24A1",
            "W_MultiAge_CARE24A2",
            "W_MultiAge_CARE24A3",
            "W_MultiAge_CARE24A4",
            "W_MultiAge_CARE24A5",
            "W_MultiAge_CARE24A6",
            "W_MultiAge_CARE24A7",
            "W_MultiAge_CARE24A8",
            "W_MultiAge_CARE24A9",
            "W_MultiAge_CARE24A10",
            "W_MultiAge_CARE24A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CARE24A",
            "silver_upgrade_kit_CARE24A",
            "golden_upgrade_kit_CARE24A",
            "platinum_upgrade_kit_CARE24A",
            "upgrade_kit_ascended_CARE24A"
        ],
        "upgradeItems": {
            "upgrade_kit_CARE24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CARE24A",
                "name": "Eco Hub Upgrade Kit",
                "description": "Upgrades your Eco Hub to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CARE24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_CARE24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_CARE24A",
                "name": "Eco Center Silver Upgrade Kit",
                "description": "Upgrades your Eco Hub to its second best version!",
                "iconAssetName": "silver_upgrade_kit_CARE24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_CARE24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_CARE24A",
                "name": "Eco Sanctum Golden Upgrade Kit",
                "description": "Upgrades your Eco Hub to its best version!",
                "iconAssetName": "golden_upgrade_kit_CARE24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_CARE24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_CARE24A",
                "name": "Eco Nexus Platinum Upgrade Kit",
                "description": "Upgrades your Eco Hub to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_CARE24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_CARE24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CARE24A",
                "name": "Eco Utopia Upgrade Kit",
                "description": "Upgrades your Eco Nexus to a time-limited Eco Utopia that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CARE24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A1",
                "toBuildingId": "W_MultiAge_CARE24A2",
                "upgradeItemId": "upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A2",
                "toBuildingId": "W_MultiAge_CARE24A3",
                "upgradeItemId": "upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A3",
                "toBuildingId": "W_MultiAge_CARE24A4",
                "upgradeItemId": "upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A4",
                "toBuildingId": "W_MultiAge_CARE24A5",
                "upgradeItemId": "upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A5",
                "toBuildingId": "W_MultiAge_CARE24A6",
                "upgradeItemId": "upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A6",
                "toBuildingId": "W_MultiAge_CARE24A7",
                "upgradeItemId": "upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A7",
                "toBuildingId": "W_MultiAge_CARE24A8",
                "upgradeItemId": "silver_upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A8",
                "toBuildingId": "W_MultiAge_CARE24A9",
                "upgradeItemId": "golden_upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A9",
                "toBuildingId": "W_MultiAge_CARE24A10",
                "upgradeItemId": "platinum_upgrade_kit_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24A10",
                "toBuildingId": "W_MultiAge_CARE24A11",
                "upgradeItemId": "upgrade_kit_ascended_CARE24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE24B1": {
        "baseBuildingId": "W_MultiAge_CARE24B1",
        "containedBuildingIds": [
            "W_MultiAge_CARE24B1",
            "W_MultiAge_CARE24B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_CARE24B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_CARE24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CARE24B",
                "name": "Ascended Earth's Eden Upgrade Kit",
                "description": "Upgrades your Earth's Eden to a time limited Ascended Earth's Eden that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CARE24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24B1",
                "toBuildingId": "W_MultiAge_CARE24B2",
                "upgradeItemId": "upgrade_kit_ascended_CARE24B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL25A1": {
        "baseBuildingId": "W_MultiAge_FALL25A1",
        "containedBuildingIds": [
            "W_MultiAge_FALL25A1",
            "W_MultiAge_FALL25A2",
            "W_MultiAge_FALL25A3",
            "W_MultiAge_FALL25A4",
            "W_MultiAge_FALL25A5",
            "W_MultiAge_FALL25A6",
            "W_MultiAge_FALL25A7",
            "W_MultiAge_FALL25A8",
            "W_MultiAge_FALL25A9",
            "W_MultiAge_FALL25A10",
            "W_MultiAge_FALL25A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL25A",
            "silver_upgrade_kit_FALL25A",
            "golden_upgrade_kit_FALL25A"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL25A",
                "name": "Breezemill Homestead Upgrade Kit",
                "description": "Upgrades your Breezemill Homestead to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FALL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FALL25A",
                "name": "Breezemill Acres Silver Upgrade Kit",
                "description": "Upgrades your Breezemill Homestead to its second best version!",
                "iconAssetName": "silver_upgrade_kit_FALL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FALL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FALL25A",
                "name": "Breezemill Estate Golden Upgrade Kit",
                "description": "Upgrades your Breezemill Homestead to its best version!",
                "iconAssetName": "golden_upgrade_kit_FALL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A1",
                "toBuildingId": "W_MultiAge_FALL25A2",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A2",
                "toBuildingId": "W_MultiAge_FALL25A3",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A3",
                "toBuildingId": "W_MultiAge_FALL25A4",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A4",
                "toBuildingId": "W_MultiAge_FALL25A5",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A5",
                "toBuildingId": "W_MultiAge_FALL25A6",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A6",
                "toBuildingId": "W_MultiAge_FALL25A7",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A7",
                "toBuildingId": "W_MultiAge_FALL25A8",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A8",
                "toBuildingId": "W_MultiAge_FALL25A9",
                "upgradeItemId": "upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A9",
                "toBuildingId": "W_MultiAge_FALL25A10",
                "upgradeItemId": "silver_upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25A10",
                "toBuildingId": "W_MultiAge_FALL25A11",
                "upgradeItemId": "golden_upgrade_kit_FALL25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL25E1": {
        "baseBuildingId": "W_MultiAge_FALL25E1",
        "containedBuildingIds": [
            "W_MultiAge_FALL25E1",
            "W_MultiAge_FALL25E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FALL25E"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FALL25E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FALL25E",
                "name": "Ascended Azalea Arbor Upgrade Kit",
                "description": "Upgrades your Azalea Arbor to a time limited Ascended Azalea Arbor that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FALL25E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25E1",
                "toBuildingId": "W_MultiAge_FALL25E2",
                "upgradeItemId": "upgrade_kit_ascended_FALL25E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL25F1": {
        "baseBuildingId": "W_MultiAge_FALL25F1",
        "containedBuildingIds": [
            "W_MultiAge_FALL25F1",
            "W_MultiAge_FALL25F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FALL25F"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FALL25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FALL25F",
                "name": "Ascended Amberbill Pond Upgrade Kit",
                "description": "Upgrades your Amberbill Pond to a time limited Ascended Amberbill Pond that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FALL25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL25F1",
                "toBuildingId": "W_MultiAge_FALL25F2",
                "upgradeItemId": "upgrade_kit_ascended_FALL25F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL24A1": {
        "baseBuildingId": "W_MultiAge_FALL24A1",
        "containedBuildingIds": [
            "W_MultiAge_FALL24A1",
            "W_MultiAge_FALL24A2",
            "W_MultiAge_FALL24A3",
            "W_MultiAge_FALL24A4",
            "W_MultiAge_FALL24A5",
            "W_MultiAge_FALL24A6",
            "W_MultiAge_FALL24A7",
            "W_MultiAge_FALL24A8",
            "W_MultiAge_FALL24A9",
            "W_MultiAge_FALL24A10",
            "W_MultiAge_FALL24A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL24A",
            "silver_upgrade_kit_FALL24A",
            "golden_upgrade_kit_FALL24A"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL24A",
                "name": "Harvest Squirrel Hall Upgrade Kit",
                "description": "Upgrades your Harvest Squirrel Hall to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FALL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FALL24A",
                "name": "Bountiful Squirrel Hall Silver Upgrade Kit",
                "description": "Upgrades your Harvest Squirrel Hall to its second best version!",
                "iconAssetName": "silver_upgrade_kit_FALL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FALL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FALL24A",
                "name": "Regal Squirrel Hall Golden Upgrade Kit",
                "description": "Upgrades your Harvest Squirrel Hall to its best version!",
                "iconAssetName": "golden_upgrade_kit_FALL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A1",
                "toBuildingId": "W_MultiAge_FALL24A2",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A2",
                "toBuildingId": "W_MultiAge_FALL24A3",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A3",
                "toBuildingId": "W_MultiAge_FALL24A4",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A4",
                "toBuildingId": "W_MultiAge_FALL24A5",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A5",
                "toBuildingId": "W_MultiAge_FALL24A6",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A6",
                "toBuildingId": "W_MultiAge_FALL24A7",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A7",
                "toBuildingId": "W_MultiAge_FALL24A8",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A8",
                "toBuildingId": "W_MultiAge_FALL24A9",
                "upgradeItemId": "upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A9",
                "toBuildingId": "W_MultiAge_FALL24A10",
                "upgradeItemId": "silver_upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24A10",
                "toBuildingId": "W_MultiAge_FALL24A11",
                "upgradeItemId": "golden_upgrade_kit_FALL24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL24B1": {
        "baseBuildingId": "W_MultiAge_FALL24B1",
        "containedBuildingIds": [
            "W_MultiAge_FALL24B1",
            "W_MultiAge_FALL24B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FALL24B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FALL24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FALL24B",
                "name": "Ascended Vagabond Library Upgrade Kit",
                "description": "Upgrades your Vagabond Library to a time limited Ascended Vagabond Library that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FALL24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24B1",
                "toBuildingId": "W_MultiAge_FALL24B2",
                "upgradeItemId": "upgrade_kit_ascended_FALL24B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL24C1": {
        "baseBuildingId": "W_MultiAge_FALL24C1",
        "containedBuildingIds": [
            "W_MultiAge_FALL24C1",
            "W_MultiAge_FALL24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FALL24C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FALL24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FALL24C",
                "name": "Ascended Harvest Hub Upgrade Kit",
                "description": "Upgrades your Harvest Hub to a time limited Ascended Harvest Hub that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FALL24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL24C1",
                "toBuildingId": "W_MultiAge_FALL24C2",
                "upgradeItemId": "upgrade_kit_ascended_FALL24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL23C1": {
        "baseBuildingId": "W_MultiAge_FALL23C1",
        "containedBuildingIds": [
            "W_MultiAge_FALL23C1",
            "W_MultiAge_FALL23C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL23C"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL23C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL23C",
                "name": "Jumpin' Pumpkin Upgrade Kit",
                "description": "Upgrades your Jumpin' Pumpkin to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL23C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23C1",
                "toBuildingId": "W_MultiAge_FALL23C2",
                "upgradeItemId": "upgrade_kit_FALL23C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL23D1": {
        "baseBuildingId": "W_MultiAge_FALL23D1",
        "containedBuildingIds": [
            "W_MultiAge_FALL23D1",
            "W_MultiAge_FALL23D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL23D"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL23D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL23D",
                "name": "Cider Garden Upgrade Kit",
                "description": "Upgrades your Cider Garden to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL23D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23D1",
                "toBuildingId": "W_MultiAge_FALL23D2",
                "upgradeItemId": "upgrade_kit_FALL23D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL23E1": {
        "baseBuildingId": "W_MultiAge_FALL23E1",
        "containedBuildingIds": [
            "W_MultiAge_FALL23E1",
            "W_MultiAge_FALL23E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL23E"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL23E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL23E",
                "name": "Shroom Throne Upgrade Kit",
                "description": "Upgrades your Shroom Throne to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL23E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23E1",
                "toBuildingId": "W_MultiAge_FALL23E2",
                "upgradeItemId": "upgrade_kit_FALL23E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL23F1": {
        "baseBuildingId": "W_MultiAge_FALL23F1",
        "containedBuildingIds": [
            "W_MultiAge_FALL23F1",
            "W_MultiAge_FALL23F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL23F"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL23F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL23F",
                "name": "Granny Aurora's Apple Tree Upgrade Kit",
                "description": "Upgrades your Granny Aurora's Apple Tree to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL23F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL23F1",
                "toBuildingId": "W_MultiAge_FALL23F2",
                "upgradeItemId": "upgrade_kit_FALL23F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE24C1": {
        "baseBuildingId": "W_MultiAge_CARE24C1",
        "containedBuildingIds": [
            "W_MultiAge_CARE24C1",
            "W_MultiAge_CARE24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_CARE24C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_CARE24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CARE24C",
                "name": "Ascended Green Guardians Market Upgrade Kit",
                "description": "Upgrades your Green Guardians Market to a time limited Ascended Green Guardians Market that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CARE24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE24C1",
                "toBuildingId": "W_MultiAge_CARE24C2",
                "upgradeItemId": "upgrade_kit_ascended_CARE24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24E1": {
        "baseBuildingId": "W_MultiAge_GBG24E1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24E1",
            "W_MultiAge_GBG24E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24E"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24E",
                "name": "Glimmdrake Tower Upgrade Kit",
                "description": "Upgrades your Glimmdrake Tower to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24E1",
                "toBuildingId": "W_MultiAge_GBG24E2",
                "upgradeItemId": "upgrade_kit_GBG24E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24F1": {
        "baseBuildingId": "W_MultiAge_GBG24F1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24F1",
            "W_MultiAge_GBG24F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24F"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24F",
                "name": "Glimmdrake Riders Upgrade Kit",
                "description": "Upgrades your Glimmdrake Riders to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24F1",
                "toBuildingId": "W_MultiAge_GBG24F2",
                "upgradeItemId": "upgrade_kit_GBG24F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR24C1": {
        "baseBuildingId": "W_MultiAge_GR24C1",
        "containedBuildingIds": [
            "W_MultiAge_GR24C1",
            "W_MultiAge_GR24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR24C"
        ],
        "upgradeItems": {
            "upgrade_kit_GR24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR24C",
                "name": "Neo King Upgrade Kit",
                "description": "Upgrades your Neo King to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR24C1",
                "toBuildingId": "W_MultiAge_GR24C2",
                "upgradeItemId": "upgrade_kit_GR24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR24D1": {
        "baseBuildingId": "W_MultiAge_GR24D1",
        "containedBuildingIds": [
            "W_MultiAge_GR24D1",
            "W_MultiAge_GR24D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR24D"
        ],
        "upgradeItems": {
            "upgrade_kit_GR24D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR24D",
                "name": "Neo Queen Upgrade Kit",
                "description": "Upgrades your Neo Queen to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR24D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR24D1",
                "toBuildingId": "W_MultiAge_GR24D2",
                "upgradeItemId": "upgrade_kit_GR24D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL24A1": {
        "baseBuildingId": "W_MultiAge_FELL24A1",
        "containedBuildingIds": [
            "W_MultiAge_FELL24A1",
            "W_MultiAge_FELL24A2",
            "W_MultiAge_FELL24A3",
            "W_MultiAge_FELL24A4",
            "W_MultiAge_FELL24A5",
            "W_MultiAge_FELL24A6",
            "W_MultiAge_FELL24A7",
            "W_MultiAge_FELL24A8",
            "W_MultiAge_FELL24A9",
            "W_MultiAge_FELL24A10",
            "W_MultiAge_FELL24A11",
            "W_MultiAge_FELL24A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FELL24A",
            "silver_upgrade_kit_FELL24A",
            "golden_upgrade_kit_FELL24A",
            "platinum_upgrade_kit_FELL24A",
            "upgrade_kit_ascended_FELL24A"
        ],
        "upgradeItems": {
            "upgrade_kit_FELL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FELL24A",
                "name": "Whisperwood Watermill Upgrade Kit",
                "description": "Upgrades your Whisperwood Watermill to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FELL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FELL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FELL24A",
                "name": "Sylvan Whisperwood Watermill Silver Upgrade Kit",
                "description": "Upgrades your Whisperwood Watermill to its second best version!",
                "iconAssetName": "silver_upgrade_kit_FELL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FELL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FELL24A",
                "name": "Arcadian Whisperwood Watermill Golden Upgrade Kit",
                "description": "Upgrades your Whisperwood Watermill to its best version!",
                "iconAssetName": "golden_upgrade_kit_FELL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_FELL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_FELL24A",
                "name": "Elysian Whisperwood Watermill Platinum Upgrade Kit",
                "description": "Upgrades your Whisperwood Watermill to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_FELL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_FELL24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FELL24A",
                "name": "Ascended Elysian Whisperwood Watermill Upgrade Kit",
                "description": "Upgrades your Elysian Whisperwood Watermill Platinum to a time limited Ascended Elysian Whisperwood Watermill that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FELL24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A1",
                "toBuildingId": "W_MultiAge_FELL24A2",
                "upgradeItemId": "upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A2",
                "toBuildingId": "W_MultiAge_FELL24A3",
                "upgradeItemId": "upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A3",
                "toBuildingId": "W_MultiAge_FELL24A4",
                "upgradeItemId": "upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A4",
                "toBuildingId": "W_MultiAge_FELL24A5",
                "upgradeItemId": "upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A5",
                "toBuildingId": "W_MultiAge_FELL24A6",
                "upgradeItemId": "upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A6",
                "toBuildingId": "W_MultiAge_FELL24A7",
                "upgradeItemId": "upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A7",
                "toBuildingId": "W_MultiAge_FELL24A8",
                "upgradeItemId": "upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A8",
                "toBuildingId": "W_MultiAge_FELL24A9",
                "upgradeItemId": "silver_upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A9",
                "toBuildingId": "W_MultiAge_FELL24A10",
                "upgradeItemId": "golden_upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A10",
                "toBuildingId": "W_MultiAge_FELL24A11",
                "upgradeItemId": "platinum_upgrade_kit_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24A11",
                "toBuildingId": "W_MultiAge_FELL24A12",
                "upgradeItemId": "upgrade_kit_ascended_FELL24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL22B1": {
        "baseBuildingId": "W_MultiAge_FELL22B1",
        "containedBuildingIds": [
            "W_MultiAge_FELL22B1",
            "W_MultiAge_FELL22B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FELL22B"
        ],
        "upgradeItems": {
            "upgrade_kit_FELL22B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FELL22B",
                "name": "Knights Pavilion Upgrade Kit",
                "description": "Upgrades your Knights Pavilion to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FELL22B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL22B1",
                "toBuildingId": "W_MultiAge_FELL22B2",
                "upgradeItemId": "upgrade_kit_FELL22B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL24B1": {
        "baseBuildingId": "W_MultiAge_FELL24B1",
        "containedBuildingIds": [
            "W_MultiAge_FELL24B1",
            "W_MultiAge_FELL24B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FELL24B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FELL24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FELL24B",
                "name": "Ascended Jolly Oink Pigsty Upgrade Kit",
                "description": "Upgrades your Jolly Oink Pigsty to a time limited Ascended Jolly Oink Pigsty that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FELL24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24B1",
                "toBuildingId": "W_MultiAge_FELL24B2",
                "upgradeItemId": "upgrade_kit_ascended_FELL24B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL24C1": {
        "baseBuildingId": "W_MultiAge_FELL24C1",
        "containedBuildingIds": [
            "W_MultiAge_FELL24C1",
            "W_MultiAge_FELL24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FELL24C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FELL24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FELL24C",
                "name": "Ascended Royal Carriage Upgrade Kit",
                "description": "Upgrades your Royal Carriage to a time limited Ascended Royal Carriage that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FELL24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL24C1",
                "toBuildingId": "W_MultiAge_FELL24C2",
                "upgradeItemId": "upgrade_kit_ascended_FELL24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24G1": {
        "baseBuildingId": "W_MultiAge_GBG24G1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24G1",
            "W_MultiAge_GBG24G2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24G"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24G": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24G",
                "name": "Lindworm Keep Upgrade Kit",
                "description": "Upgrades your Lindworm Keep to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24G",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24G1",
                "toBuildingId": "W_MultiAge_GBG24G2",
                "upgradeItemId": "upgrade_kit_GBG24G",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG24H1": {
        "baseBuildingId": "W_MultiAge_GBG24H1",
        "containedBuildingIds": [
            "W_MultiAge_GBG24H1",
            "W_MultiAge_GBG24H2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG24H"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG24H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG24H",
                "name": "Lindworm Archery Range Upgrade Kit",
                "description": "Upgrades your Lindworm Archery Range to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG24H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG24H1",
                "toBuildingId": "W_MultiAge_GBG24H2",
                "upgradeItemId": "upgrade_kit_GBG24H",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN24A1": {
        "baseBuildingId": "W_MultiAge_WIN24A1",
        "containedBuildingIds": [
            "W_MultiAge_WIN24A1",
            "W_MultiAge_WIN24A2",
            "W_MultiAge_WIN24A3",
            "W_MultiAge_WIN24A4",
            "W_MultiAge_WIN24A5",
            "W_MultiAge_WIN24A6",
            "W_MultiAge_WIN24A7",
            "W_MultiAge_WIN24A8",
            "W_MultiAge_WIN24A9",
            "W_MultiAge_WIN24A10",
            "W_MultiAge_WIN24A11",
            "W_MultiAge_WIN24A12",
            "W_MultiAge_WIN24A13",
            "W_MultiAge_WIN24A14"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN24A",
            "silver_upgrade_kit_WIN24A",
            "golden_upgrade_kit_WIN24A",
            "platinum_upgrade_kit_WIN24A",
            "upgrade_kit_ascended_WIN24A"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN24A",
                "name": "Yukitomo Tower Upgrade Kit",
                "description": "Upgrades your Yukitomo Tower to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WIN24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WIN24A",
                "name": "Yukitomo Plaza Silver Upgrade Kit",
                "description": "Upgrades your Yukitomo Tower to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WIN24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN24A",
                "name": "Yukitomo Empire Golden Upgrade Kit",
                "description": "Upgrades your Yukitomo Tower to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_WIN24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_WIN24A",
                "name": "Yukitomo Imperial Platinum Upgrade Kit",
                "description": "Upgrades your Yukitomo Tower to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_WIN24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_WIN24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN24A",
                "name": "Yukitomo Imperial Sky Residence Upgrade Kit",
                "description": "Upgrades your Yukitomo Imperial to a time limited Yukitomo Imperial Sky Residence that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A1",
                "toBuildingId": "W_MultiAge_WIN24A2",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A2",
                "toBuildingId": "W_MultiAge_WIN24A3",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A3",
                "toBuildingId": "W_MultiAge_WIN24A4",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A4",
                "toBuildingId": "W_MultiAge_WIN24A5",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A5",
                "toBuildingId": "W_MultiAge_WIN24A6",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A6",
                "toBuildingId": "W_MultiAge_WIN24A7",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A7",
                "toBuildingId": "W_MultiAge_WIN24A8",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A8",
                "toBuildingId": "W_MultiAge_WIN24A9",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A9",
                "toBuildingId": "W_MultiAge_WIN24A10",
                "upgradeItemId": "upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A10",
                "toBuildingId": "W_MultiAge_WIN24A11",
                "upgradeItemId": "silver_upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A11",
                "toBuildingId": "W_MultiAge_WIN24A12",
                "upgradeItemId": "golden_upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A12",
                "toBuildingId": "W_MultiAge_WIN24A13",
                "upgradeItemId": "platinum_upgrade_kit_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 12,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24A13",
                "toBuildingId": "W_MultiAge_WIN24A14",
                "upgradeItemId": "upgrade_kit_ascended_WIN24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN24F1": {
        "baseBuildingId": "W_MultiAge_WIN24F1",
        "containedBuildingIds": [
            "W_MultiAge_WIN24F1",
            "W_MultiAge_WIN24F2",
            "W_MultiAge_WIN24F3",
            "W_MultiAge_WIN24F4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN24F",
            "silver_upgrade_kit_WIN24F",
            "golden_upgrade_kit_WIN24F"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN24F",
                "name": "Didukh Upgrade Kit",
                "description": "Upgrades your Didukh to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WIN24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WIN24F",
                "name": "Didukh Delight Silver Upgrade Kit",
                "description": "Upgrades your Didukh to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WIN24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN24F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN24F",
                "name": "Didukh Dreams Golden Upgrade Kit",
                "description": "Upgrades your Didukh to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN24F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24F1",
                "toBuildingId": "W_MultiAge_WIN24F2",
                "upgradeItemId": "upgrade_kit_WIN24F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24F2",
                "toBuildingId": "W_MultiAge_WIN24F3",
                "upgradeItemId": "silver_upgrade_kit_WIN24F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24F3",
                "toBuildingId": "W_MultiAge_WIN24F4",
                "upgradeItemId": "golden_upgrade_kit_WIN24F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN18B1": {
        "baseBuildingId": "W_MultiAge_WIN18B1",
        "containedBuildingIds": [
            "W_MultiAge_WIN18B1",
            "W_MultiAge_WIN18B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN18B"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN18B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN18B",
                "name": "Sleigh Builder Upgrade Kit",
                "description": "Upgrades your Sleigh Builder to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN18B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN18B1",
                "toBuildingId": "W_MultiAge_WIN18B2",
                "upgradeItemId": "upgrade_kit_WIN18B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN24B1": {
        "baseBuildingId": "W_MultiAge_WIN24B1",
        "containedBuildingIds": [
            "W_MultiAge_WIN24B1",
            "W_MultiAge_WIN24B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WIN24B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WIN24B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN24B",
                "name": "Ascended Holly Hauler Upgrade Kit",
                "description": "Upgrades your Holly Hauler to a time limited Ascended Holly Hauler that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN24B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24B1",
                "toBuildingId": "W_MultiAge_WIN24B2",
                "upgradeItemId": "upgrade_kit_ascended_WIN24B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN24C1": {
        "baseBuildingId": "W_MultiAge_WIN24C1",
        "containedBuildingIds": [
            "W_MultiAge_WIN24C1",
            "W_MultiAge_WIN24C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WIN24C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WIN24C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN24C",
                "name": "Ascended Sled Pup Monument Upgrade Kit",
                "description": "Upgrades your Sled Pup Monument to a time limited Ascended Sled Pup Monument that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN24C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN24C1",
                "toBuildingId": "W_MultiAge_WIN24C2",
                "upgradeItemId": "upgrade_kit_ascended_WIN24C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_LTE24A1": {
        "baseBuildingId": "W_MultiAge_LTE24A1",
        "containedBuildingIds": [
            "W_MultiAge_LTE24A1",
            "W_MultiAge_LTE24A2",
            "W_MultiAge_LTE24A3",
            "W_MultiAge_LTE24A4",
            "W_MultiAge_LTE24A5",
            "W_MultiAge_LTE24A6",
            "W_MultiAge_LTE24A7",
            "W_MultiAge_LTE24A8",
            "W_MultiAge_LTE24A9",
            "W_MultiAge_LTE24A10",
            "W_MultiAge_LTE24A11"
        ],
        "containedUpgradeItemIds": [
            "platinum_upgrade_kit_LTE24A",
            "upgrade_kit_ascended_LTE24A"
        ],
        "upgradeItems": {
            "platinum_upgrade_kit_LTE24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_LTE24A",
                "name": "Eternal Market Platinum Upgrade Kit",
                "description": "Upgrades your Eternal Market to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_LTE24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_LTE24A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_LTE24A",
                "name": "Eternal Market Ascended Upgrade Kit",
                "description": "Upgrades your Eternal Market to a time limited version that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_LTE24A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A1",
                "toBuildingId": "W_MultiAge_LTE24A2",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A2",
                "toBuildingId": "W_MultiAge_LTE24A3",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A3",
                "toBuildingId": "W_MultiAge_LTE24A4",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A4",
                "toBuildingId": "W_MultiAge_LTE24A5",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A5",
                "toBuildingId": "W_MultiAge_LTE24A6",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A6",
                "toBuildingId": "W_MultiAge_LTE24A7",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A7",
                "toBuildingId": "W_MultiAge_LTE24A8",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A8",
                "toBuildingId": "W_MultiAge_LTE24A9",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A9",
                "toBuildingId": "W_MultiAge_LTE24A10",
                "upgradeItemId": "platinum_upgrade_kit_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_LTE24A10",
                "toBuildingId": "W_MultiAge_LTE24A11",
                "upgradeItemId": "upgrade_kit_ascended_LTE24A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25A1": {
        "baseBuildingId": "W_MultiAge_GR25A1",
        "containedBuildingIds": [
            "W_MultiAge_GR25A1",
            "W_MultiAge_GR25A2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25A"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25A",
                "name": "Neo Checkmate Square Upgrade Kit",
                "description": "Upgrades your Neo Checkmate Square to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25A1",
                "toBuildingId": "W_MultiAge_GR25A2",
                "upgradeItemId": "upgrade_kit_GR25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25B1": {
        "baseBuildingId": "W_MultiAge_GR25B1",
        "containedBuildingIds": [
            "W_MultiAge_GR25B1",
            "W_MultiAge_GR25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25B"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25B",
                "name": "Neo Aviary Upgrade Kit",
                "description": "Upgrades your Neo Aviary to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25B1",
                "toBuildingId": "W_MultiAge_GR25B2",
                "upgradeItemId": "upgrade_kit_GR25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25E1": {
        "baseBuildingId": "W_MultiAge_GR25E1",
        "containedBuildingIds": [
            "W_MultiAge_GR25E1",
            "W_MultiAge_GR25E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25E"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25E",
                "name": "Neo Kiosk Upgrade Kit",
                "description": "Upgrades your Neo Kiosk to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25E1",
                "toBuildingId": "W_MultiAge_GR25E2",
                "upgradeItemId": "upgrade_kit_GR25E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25F1": {
        "baseBuildingId": "W_MultiAge_GR25F1",
        "containedBuildingIds": [
            "W_MultiAge_GR25F1",
            "W_MultiAge_GR25F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25F"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25F",
                "name": "Neo Magnum Opus Upgrade Kit",
                "description": "Upgrades your Neo Magnum Opus to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25F1",
                "toBuildingId": "W_MultiAge_GR25F2",
                "upgradeItemId": "upgrade_kit_GR25F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25G1": {
        "baseBuildingId": "W_MultiAge_GR25G1",
        "containedBuildingIds": [
            "W_MultiAge_GR25G1",
            "W_MultiAge_GR25G2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25G"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25G": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25G",
                "name": "Neo Shrine of Knowledge Upgrade Kit",
                "description": "Upgrades your Neo Shrine of Knowledge to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25G",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25G1",
                "toBuildingId": "W_MultiAge_GR25G2",
                "upgradeItemId": "upgrade_kit_GR25G",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25H1": {
        "baseBuildingId": "W_MultiAge_GR25H1",
        "containedBuildingIds": [
            "W_MultiAge_GR25H1",
            "W_MultiAge_GR25H2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25H"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25H",
                "name": "Neo Obelisk Upgrade Kit",
                "description": "Upgrades your Neo Obelisk to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25H1",
                "toBuildingId": "W_MultiAge_GR25H2",
                "upgradeItemId": "upgrade_kit_GR25H",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD25A1": {
        "baseBuildingId": "W_MultiAge_WILD25A1",
        "containedBuildingIds": [
            "W_MultiAge_WILD25A1",
            "W_MultiAge_WILD25A2",
            "W_MultiAge_WILD25A3",
            "W_MultiAge_WILD25A4",
            "W_MultiAge_WILD25A5",
            "W_MultiAge_WILD25A6",
            "W_MultiAge_WILD25A7",
            "W_MultiAge_WILD25A8",
            "W_MultiAge_WILD25A9",
            "W_MultiAge_WILD25A10",
            "W_MultiAge_WILD25A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD25A",
            "silver_upgrade_kit_WILD25A",
            "golden_upgrade_kit_WILD25A"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD25A",
                "name": "Shika Shrine Upgrade Kit",
                "description": "Upgrades your Shika Shrine to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WILD25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WILD25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WILD25A",
                "name": "Momiji Shrine Silver Upgrade Kit",
                "description": "Upgrades your Shika Shrine to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WILD25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD25A",
                "name": "Momijidori Shrine Golden Upgrade Kit",
                "description": "Upgrades your Shika Shrine to its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A1",
                "toBuildingId": "W_MultiAge_WILD25A2",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A2",
                "toBuildingId": "W_MultiAge_WILD25A3",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A3",
                "toBuildingId": "W_MultiAge_WILD25A4",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A4",
                "toBuildingId": "W_MultiAge_WILD25A5",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A5",
                "toBuildingId": "W_MultiAge_WILD25A6",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A6",
                "toBuildingId": "W_MultiAge_WILD25A7",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A7",
                "toBuildingId": "W_MultiAge_WILD25A8",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A8",
                "toBuildingId": "W_MultiAge_WILD25A9",
                "upgradeItemId": "upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A9",
                "toBuildingId": "W_MultiAge_WILD25A10",
                "upgradeItemId": "silver_upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25A10",
                "toBuildingId": "W_MultiAge_WILD25A11",
                "upgradeItemId": "golden_upgrade_kit_WILD25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD25B1": {
        "baseBuildingId": "W_MultiAge_WILD25B1",
        "containedBuildingIds": [
            "W_MultiAge_WILD25B1",
            "W_MultiAge_WILD25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WILD25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WILD25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WILD25B",
                "name": "Ascended Koi Pond Upgrade Kit",
                "description": "Upgrades your Koi Pond to a time-limited Ascended Koi Pond that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WILD25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25B1",
                "toBuildingId": "W_MultiAge_WILD25B2",
                "upgradeItemId": "upgrade_kit_ascended_WILD25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD25C1": {
        "baseBuildingId": "W_MultiAge_WILD25C1",
        "containedBuildingIds": [
            "W_MultiAge_WILD25C1",
            "W_MultiAge_WILD25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WILD25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WILD25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WILD25C",
                "name": "Ascended Usagi Bonbori Gate Upgrade Kit",
                "description": "Upgrades your Usagi Bonbori Gate to a time-limited Ascended Usagi Bonbori Gate that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WILD25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD25C1",
                "toBuildingId": "W_MultiAge_WILD25C2",
                "upgradeItemId": "upgrade_kit_ascended_WILD25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD26A1": {
        "baseBuildingId": "W_MultiAge_WILD26A1",
        "containedBuildingIds": [
            "W_MultiAge_WILD26A1",
            "W_MultiAge_WILD26A2",
            "W_MultiAge_WILD26A3",
            "W_MultiAge_WILD26A4",
            "W_MultiAge_WILD26A5",
            "W_MultiAge_WILD26A6",
            "W_MultiAge_WILD26A7",
            "W_MultiAge_WILD26A8",
            "W_MultiAge_WILD26A9",
            "W_MultiAge_WILD26A10",
            "W_MultiAge_WILD26A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WILD26A",
            "silver_upgrade_kit_WILD26A",
            "golden_upgrade_kit_WILD26A"
        ],
        "upgradeItems": {
            "upgrade_kit_WILD26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WILD26A",
                "name": "Elephant Rehabilitation Centre Upgrade Kit",
                "description": "Upgrades your Elephant Rehabilitation Centre to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WILD26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WILD26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WILD26A",
                "name": "Elephant Conservation Wing Silver Upgrade Kit",
                "description": "Upgrades your Elephant Rehabilitation Centre to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WILD26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WILD26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WILD26A",
                "name": "Elephant Great Reserve Golden Upgrade Kit",
                "description": "Upgrades your Elephant Rehabilitation Centre to its best version!",
                "iconAssetName": "golden_upgrade_kit_WILD26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A1",
                "toBuildingId": "W_MultiAge_WILD26A2",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A2",
                "toBuildingId": "W_MultiAge_WILD26A3",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A3",
                "toBuildingId": "W_MultiAge_WILD26A4",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A4",
                "toBuildingId": "W_MultiAge_WILD26A5",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A5",
                "toBuildingId": "W_MultiAge_WILD26A6",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A6",
                "toBuildingId": "W_MultiAge_WILD26A7",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A7",
                "toBuildingId": "W_MultiAge_WILD26A8",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A8",
                "toBuildingId": "W_MultiAge_WILD26A9",
                "upgradeItemId": "upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A9",
                "toBuildingId": "W_MultiAge_WILD26A10",
                "upgradeItemId": "silver_upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26A10",
                "toBuildingId": "W_MultiAge_WILD26A11",
                "upgradeItemId": "golden_upgrade_kit_WILD26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD26B1": {
        "baseBuildingId": "W_MultiAge_WILD26B1",
        "containedBuildingIds": [
            "W_MultiAge_WILD26B1",
            "W_MultiAge_WILD26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WILD26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WILD26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WILD26B",
                "name": "Ascended Savannah Camp Upgrade Kit",
                "description": "Upgrades your Savannah Camp to a time limited Ascended Savannah Camp that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WILD26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26B1",
                "toBuildingId": "W_MultiAge_WILD26B2",
                "upgradeItemId": "upgrade_kit_ascended_WILD26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WILD26C1": {
        "baseBuildingId": "W_MultiAge_WILD26C1",
        "containedBuildingIds": [
            "W_MultiAge_WILD26C1",
            "W_MultiAge_WILD26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WILD26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WILD26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WILD26C",
                "name": "Ascended Hippo Lagoon Upgrade Kit",
                "description": "Upgrades your Hippo Lagoon to a time limited Ascended Hippo Lagoon that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WILD26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WILD26C1",
                "toBuildingId": "W_MultiAge_WILD26C2",
                "upgradeItemId": "upgrade_kit_ascended_WILD26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25A1": {
        "baseBuildingId": "W_MultiAge_GBG25A1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25A1",
            "W_MultiAge_GBG25A2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25A"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25A",
                "name": "Frontier Citadel Upgrade Kit",
                "description": "Upgrades your Frontier Citadel to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25A1",
                "toBuildingId": "W_MultiAge_GBG25A2",
                "upgradeItemId": "upgrade_kit_GBG25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25B1": {
        "baseBuildingId": "W_MultiAge_GBG25B1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25B1",
            "W_MultiAge_GBG25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25B"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25B",
                "name": "Frontier Watch Upgrade Kit",
                "description": "Upgrades your Frontier Watch to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25B1",
                "toBuildingId": "W_MultiAge_GBG25B2",
                "upgradeItemId": "upgrade_kit_GBG25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25C1": {
        "baseBuildingId": "W_MultiAge_GBG25C1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25C1",
            "W_MultiAge_GBG25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25C"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25C",
                "name": "Fort Imperial Upgrade Kit",
                "description": "Upgrades your Fort Imperial to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25C1",
                "toBuildingId": "W_MultiAge_GBG25C2",
                "upgradeItemId": "upgrade_kit_GBG25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25D1": {
        "baseBuildingId": "W_MultiAge_GBG25D1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25D1",
            "W_MultiAge_GBG25D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25D"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25D",
                "name": "Imperial Foundry Upgrade Kit",
                "description": "Upgrades your Imperial Foundry to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25D1",
                "toBuildingId": "W_MultiAge_GBG25D2",
                "upgradeItemId": "upgrade_kit_GBG25D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25E1": {
        "baseBuildingId": "W_MultiAge_GBG25E1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25E1",
            "W_MultiAge_GBG25E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25E"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25E",
                "name": "Somerset Hospital Upgrade Kit",
                "description": "Upgrades your Somerset Hospital to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25E1",
                "toBuildingId": "W_MultiAge_GBG25E2",
                "upgradeItemId": "upgrade_kit_GBG25E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25F1": {
        "baseBuildingId": "W_MultiAge_GBG25F1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25F1",
            "W_MultiAge_GBG25F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25F"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25F",
                "name": "Somerset Infirmary Upgrade Kit",
                "description": "Upgrades your Somerset Infirmary to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25F1",
                "toBuildingId": "W_MultiAge_GBG25F2",
                "upgradeItemId": "upgrade_kit_GBG25F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS25A1": {
        "baseBuildingId": "W_MultiAge_HIS25A1",
        "containedBuildingIds": [
            "W_MultiAge_HIS25A1",
            "W_MultiAge_HIS25A2",
            "W_MultiAge_HIS25A3",
            "W_MultiAge_HIS25A4",
            "W_MultiAge_HIS25A5",
            "W_MultiAge_HIS25A6",
            "W_MultiAge_HIS25A7",
            "W_MultiAge_HIS25A8",
            "W_MultiAge_HIS25A9",
            "W_MultiAge_HIS25A10",
            "W_MultiAge_HIS25A11",
            "W_MultiAge_HIS25A12",
            "W_MultiAge_HIS25A13",
            "W_MultiAge_HIS25A14"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HIS25A",
            "silver_upgrade_kit_HIS25A",
            "golden_upgrade_kit_HIS25A",
            "platinum_upgrade_kit_HIS25A",
            "upgrade_kit_ascended_HIS25A"
        ],
        "upgradeItems": {
            "upgrade_kit_HIS25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HIS25A",
                "name": "Fjordstorm Wharf Upgrade Kit",
                "description": "Upgrades your Fjordstorm Wharf to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HIS25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HIS25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HIS25A",
                "name": "Fjordstorm Dockyard Silver Upgrade Kit",
                "description": "Upgrades your Fjordstorm Wharf to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HIS25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HIS25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HIS25A",
                "name": "Fjordstorm Harbor Golden Upgrade Kit",
                "description": "Upgrades your Fjordstorm Wharf to its best version!",
                "iconAssetName": "golden_upgrade_kit_HIS25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_HIS25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_HIS25A",
                "name": "Njord's Fjordstorm Harbor Platinum Upgrade Kit",
                "description": "Upgrades your Fjordstorm Harbor to an improved version that will produce more resources.",
                "iconAssetName": "platinum_upgrade_kit_HIS25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_HIS25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HIS25A",
                "name": "Ascended Njord's Fjordstorm Harbor Upgrade Kit",
                "description": "Upgrades your Njord's Fjordstorm Harbor to a time limited Ascended Njord's Fjordstorm Harbor that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HIS25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A1",
                "toBuildingId": "W_MultiAge_HIS25A2",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A2",
                "toBuildingId": "W_MultiAge_HIS25A3",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A3",
                "toBuildingId": "W_MultiAge_HIS25A4",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A4",
                "toBuildingId": "W_MultiAge_HIS25A5",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A5",
                "toBuildingId": "W_MultiAge_HIS25A6",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A6",
                "toBuildingId": "W_MultiAge_HIS25A7",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A7",
                "toBuildingId": "W_MultiAge_HIS25A8",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A8",
                "toBuildingId": "W_MultiAge_HIS25A9",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A9",
                "toBuildingId": "W_MultiAge_HIS25A10",
                "upgradeItemId": "upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A10",
                "toBuildingId": "W_MultiAge_HIS25A11",
                "upgradeItemId": "silver_upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A11",
                "toBuildingId": "W_MultiAge_HIS25A12",
                "upgradeItemId": "golden_upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A12",
                "toBuildingId": "W_MultiAge_HIS25A13",
                "upgradeItemId": "platinum_upgrade_kit_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 12,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25A13",
                "toBuildingId": "W_MultiAge_HIS25A14",
                "upgradeItemId": "upgrade_kit_ascended_HIS25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS25B1": {
        "baseBuildingId": "W_MultiAge_HIS25B1",
        "containedBuildingIds": [
            "W_MultiAge_HIS25B1",
            "W_MultiAge_HIS25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_HIS25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_HIS25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HIS25B",
                "name": "Ascended Emberfang Totem Upgrade Kit",
                "description": "Upgrades your Emberfang Totem to a time limited Ascended Emberfang Totem that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HIS25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25B1",
                "toBuildingId": "W_MultiAge_HIS25B2",
                "upgradeItemId": "upgrade_kit_ascended_HIS25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS25C1": {
        "baseBuildingId": "W_MultiAge_HIS25C1",
        "containedBuildingIds": [
            "W_MultiAge_HIS25C1",
            "W_MultiAge_HIS25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_HIS25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_HIS25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HIS25C",
                "name": "Ascended Skuddeholm Stead Upgrade Kit",
                "description": "Upgrades your Skuddeholm Stead to a time limited Ascended Skuddeholm Stead that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HIS25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25C1",
                "toBuildingId": "W_MultiAge_HIS25C2",
                "upgradeItemId": "upgrade_kit_ascended_HIS25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS25F1": {
        "baseBuildingId": "W_MultiAge_HIS25F1",
        "containedBuildingIds": [
            "W_MultiAge_HIS25F1",
            "W_MultiAge_HIS25F2",
            "W_MultiAge_HIS25F3",
            "W_MultiAge_HIS25F4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HIS25F",
            "silver_upgrade_kit_HIS25F",
            "golden_upgrade_kit_HIS25F"
        ],
        "upgradeItems": {
            "upgrade_kit_HIS25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HIS25F",
                "name": "Berserkers Aim Upgrade Kit",
                "description": "Upgrades your Berserkers Aim to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HIS25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HIS25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HIS25F",
                "name": "Berserkers Precision Silver Upgrade Kit",
                "description": "Upgrades your Berserkers Aim to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HIS25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HIS25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HIS25F",
                "name": "Berserkers Wrath Golden Upgrade Kit",
                "description": "Upgrades your Berserkers Aim to its best version!",
                "iconAssetName": "golden_upgrade_kit_HIS25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25F1",
                "toBuildingId": "W_MultiAge_HIS25F2",
                "upgradeItemId": "upgrade_kit_HIS25F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25F2",
                "toBuildingId": "W_MultiAge_HIS25F3",
                "upgradeItemId": "silver_upgrade_kit_HIS25F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25F3",
                "toBuildingId": "W_MultiAge_HIS25F4",
                "upgradeItemId": "golden_upgrade_kit_HIS25F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS25G1": {
        "baseBuildingId": "W_MultiAge_HIS25G1",
        "containedBuildingIds": [
            "W_MultiAge_HIS25G1",
            "W_MultiAge_HIS25G2",
            "W_MultiAge_HIS25G3"
        ],
        "containedUpgradeItemIds": [
            "golden_upgrade_kit_HIS25G",
            "platinum_upgrade_kit_HIS25G"
        ],
        "upgradeItems": {
            "golden_upgrade_kit_HIS25G": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HIS25G",
                "name": "Oarcrest Falls Golden Upgrade Kit",
                "description": "Upgrades your Oarcrest Mill to its second best version!",
                "iconAssetName": "golden_upgrade_kit_HIS25G",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_HIS25G": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_HIS25G",
                "name": "Oarcrest Fjord Platinum Upgrade Kit",
                "description": "Upgrades your Oarcrest Mill to its best version!",
                "iconAssetName": "platinum_upgrade_kit_HIS25G",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25G1",
                "toBuildingId": "W_MultiAge_HIS25G2",
                "upgradeItemId": "golden_upgrade_kit_HIS25G",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS25G2",
                "toBuildingId": "W_MultiAge_HIS25G3",
                "upgradeItemId": "platinum_upgrade_kit_HIS25G",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS26A1": {
        "baseBuildingId": "W_MultiAge_HIS26A1",
        "containedBuildingIds": [
            "W_MultiAge_HIS26A1",
            "W_MultiAge_HIS26A2",
            "W_MultiAge_HIS26A3",
            "W_MultiAge_HIS26A4",
            "W_MultiAge_HIS26A5",
            "W_MultiAge_HIS26A6",
            "W_MultiAge_HIS26A7",
            "W_MultiAge_HIS26A8",
            "W_MultiAge_HIS26A9",
            "W_MultiAge_HIS26A10",
            "W_MultiAge_HIS26A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HIS26A",
            "silver_upgrade_kit_HIS26A",
            "golden_upgrade_kit_HIS26A"
        ],
        "upgradeItems": {
            "upgrade_kit_HIS26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HIS26A",
                "name": "Valkyrie Tower Upgrade Kit",
                "description": "Upgrades your Valkyrie Tower to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_HIS26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_HIS26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_HIS26A",
                "name": "Valkyrie Spire Silver Upgrade Kit",
                "description": "Upgrades your Valkyrie Tower to its second best version!",
                "iconAssetName": "silver_upgrade_kit_HIS26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_HIS26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_HIS26A",
                "name": "Valkyrie Sanctum Golden Upgrade Kit",
                "description": "Upgrades your Valkyrie Tower to its best version!",
                "iconAssetName": "golden_upgrade_kit_HIS26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A1",
                "toBuildingId": "W_MultiAge_HIS26A2",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A2",
                "toBuildingId": "W_MultiAge_HIS26A3",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A3",
                "toBuildingId": "W_MultiAge_HIS26A4",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A4",
                "toBuildingId": "W_MultiAge_HIS26A5",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A5",
                "toBuildingId": "W_MultiAge_HIS26A6",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A6",
                "toBuildingId": "W_MultiAge_HIS26A7",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A7",
                "toBuildingId": "W_MultiAge_HIS26A8",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A8",
                "toBuildingId": "W_MultiAge_HIS26A9",
                "upgradeItemId": "upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A9",
                "toBuildingId": "W_MultiAge_HIS26A10",
                "upgradeItemId": "silver_upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26A10",
                "toBuildingId": "W_MultiAge_HIS26A11",
                "upgradeItemId": "golden_upgrade_kit_HIS26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS26B1": {
        "baseBuildingId": "W_MultiAge_HIS26B1",
        "containedBuildingIds": [
            "W_MultiAge_HIS26B1",
            "W_MultiAge_HIS26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_HIS26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_HIS26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HIS26B",
                "name": "Ascended Mimir's Spring Upgrade Kit",
                "description": "Upgrades your Mimir's Spring to a time limited Ascended Mimir's Spring that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HIS26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26B1",
                "toBuildingId": "W_MultiAge_HIS26B2",
                "upgradeItemId": "upgrade_kit_ascended_HIS26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS26C1": {
        "baseBuildingId": "W_MultiAge_HIS26C1",
        "containedBuildingIds": [
            "W_MultiAge_HIS26C1",
            "W_MultiAge_HIS26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_HIS26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_HIS26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HIS26C",
                "name": "Ascended Freki's Lair Upgrade Kit",
                "description": "Upgrades your Freki's Lair to a time limited Ascended Freki's Lair that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HIS26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26C1",
                "toBuildingId": "W_MultiAge_HIS26C2",
                "upgradeItemId": "upgrade_kit_ascended_HIS26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS26E1": {
        "baseBuildingId": "W_MultiAge_HIS26E1",
        "containedBuildingIds": [
            "W_MultiAge_HIS26E1",
            "W_MultiAge_HIS26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_HIS26E"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_HIS26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_HIS26E",
                "name": "Ascended Dreki Totem Upgrade Kit",
                "description": "Upgrades your Dreki Totem to a time limited Ascended Dreki Totem that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_HIS26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26E1",
                "toBuildingId": "W_MultiAge_HIS26E2",
                "upgradeItemId": "upgrade_kit_ascended_HIS26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_HIS26F1": {
        "baseBuildingId": "W_MultiAge_HIS26F1",
        "containedBuildingIds": [
            "W_MultiAge_HIS26F1",
            "W_MultiAge_HIS26F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_HIS26F"
        ],
        "upgradeItems": {
            "upgrade_kit_HIS26F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_HIS26F",
                "name": "Huginn Tale Hut Upgrade Kit",
                "description": "Upgrades your Huginn Tale Hut to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_HIS26F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_HIS26F1",
                "toBuildingId": "W_MultiAge_HIS26F2",
                "upgradeItemId": "upgrade_kit_HIS26F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT25A1": {
        "baseBuildingId": "W_MultiAge_PAT25A1",
        "containedBuildingIds": [
            "W_MultiAge_PAT25A1",
            "W_MultiAge_PAT25A2",
            "W_MultiAge_PAT25A3",
            "W_MultiAge_PAT25A4",
            "W_MultiAge_PAT25A5",
            "W_MultiAge_PAT25A6",
            "W_MultiAge_PAT25A7",
            "W_MultiAge_PAT25A8",
            "W_MultiAge_PAT25A9",
            "W_MultiAge_PAT25A10",
            "W_MultiAge_PAT25A11",
            "W_MultiAge_PAT25A12",
            "W_MultiAge_PAT25A13"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT25A",
            "silver_upgrade_kit_PAT25A",
            "golden_upgrade_kit_PAT25A",
            "platinum_upgrade_kit_PAT25A",
            "upgrade_kit_ascended_PAT25A"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT25A",
                "name": "Celtic Goldsmith Upgrade Kit",
                "description": "Upgrades your Celtic Goldsmith to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_PAT25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_PAT25A",
                "name": "Lucky Celtic Goldsmith Silver Upgrade Kit",
                "description": "Upgrades your Celtic Goldsmith to its second best version!",
                "iconAssetName": "silver_upgrade_kit_PAT25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_PAT25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_PAT25A",
                "name": "Fabled Celtic Goldsmith Golden Upgrade Kit",
                "description": "Upgrades your Celtic Goldsmith to its best version!",
                "iconAssetName": "golden_upgrade_kit_PAT25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_PAT25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_PAT25A",
                "name": "Fortunate Celtic Goldsmith Platinum Upgrade Kit",
                "description": "Upgrades your Celtic Goldsmith to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_PAT25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_PAT25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_PAT25A",
                "name": "Ascended Fortunate Celtic Goldsmith Upgrade Kit",
                "description": "Upgrades your Fortunate Celtic Goldsmith to a time limited Ascended Fortunate Celtic Goldsmith that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_PAT25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A1",
                "toBuildingId": "W_MultiAge_PAT25A2",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A2",
                "toBuildingId": "W_MultiAge_PAT25A3",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A3",
                "toBuildingId": "W_MultiAge_PAT25A4",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A4",
                "toBuildingId": "W_MultiAge_PAT25A5",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A5",
                "toBuildingId": "W_MultiAge_PAT25A6",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A6",
                "toBuildingId": "W_MultiAge_PAT25A7",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A7",
                "toBuildingId": "W_MultiAge_PAT25A8",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A8",
                "toBuildingId": "W_MultiAge_PAT25A9",
                "upgradeItemId": "upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A9",
                "toBuildingId": "W_MultiAge_PAT25A10",
                "upgradeItemId": "silver_upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A10",
                "toBuildingId": "W_MultiAge_PAT25A11",
                "upgradeItemId": "golden_upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A11",
                "toBuildingId": "W_MultiAge_PAT25A12",
                "upgradeItemId": "platinum_upgrade_kit_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25A12",
                "toBuildingId": "W_MultiAge_PAT25A13",
                "upgradeItemId": "upgrade_kit_ascended_PAT25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT25E1": {
        "baseBuildingId": "W_MultiAge_PAT25E1",
        "containedBuildingIds": [
            "W_MultiAge_PAT25E1",
            "W_MultiAge_PAT25E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT25E"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT25E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT25E",
                "name": "Clover Keep Ruin Upgrade Kit",
                "description": "Upgrades your Clover Keep Ruin to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT25E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25E1",
                "toBuildingId": "W_MultiAge_PAT25E2",
                "upgradeItemId": "upgrade_kit_PAT25E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT25B1": {
        "baseBuildingId": "W_MultiAge_PAT25B1",
        "containedBuildingIds": [
            "W_MultiAge_PAT25B1",
            "W_MultiAge_PAT25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_PAT25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_PAT25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_PAT25B",
                "name": "Ascended Blueberry Field Upgrade Kit",
                "description": "Upgrades your Blueberry Field to a time limited Ascended Blueberry Field that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_PAT25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25B1",
                "toBuildingId": "W_MultiAge_PAT25B2",
                "upgradeItemId": "upgrade_kit_ascended_PAT25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT25C1": {
        "baseBuildingId": "W_MultiAge_PAT25C1",
        "containedBuildingIds": [
            "W_MultiAge_PAT25C1",
            "W_MultiAge_PAT25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_PAT25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_PAT25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_PAT25C",
                "name": "Ascended Whispering Well Upgrade Kit",
                "description": "Upgrades your Whispering Well to a time limited Ascended Whispering Well that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_PAT25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT25C1",
                "toBuildingId": "W_MultiAge_PAT25C2",
                "upgradeItemId": "upgrade_kit_ascended_PAT25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT26A1": {
        "baseBuildingId": "W_MultiAge_PAT26A1",
        "containedBuildingIds": [
            "W_MultiAge_PAT26A1",
            "W_MultiAge_PAT26A2",
            "W_MultiAge_PAT26A3",
            "W_MultiAge_PAT26A4",
            "W_MultiAge_PAT26A5",
            "W_MultiAge_PAT26A6",
            "W_MultiAge_PAT26A7",
            "W_MultiAge_PAT26A8",
            "W_MultiAge_PAT26A9",
            "W_MultiAge_PAT26A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT26A",
            "silver_upgrade_kit_PAT26A",
            "golden_upgrade_kit_PAT26A"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT26A",
                "name": "Lochan Lune Upgrade Kit",
                "description": "Upgrades your Lochan Lune to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_PAT26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_PAT26A",
                "name": "Mystic Lochan Lune Silver Upgrade Kit",
                "description": "Upgrades your Lochan Lune to its second best version!",
                "iconAssetName": "silver_upgrade_kit_PAT26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_PAT26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_PAT26A",
                "name": "Fabled Lochan Lune Golden Upgrade Kit",
                "description": "Upgrades your Lochan Lune to its best version!",
                "iconAssetName": "golden_upgrade_kit_PAT26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A1",
                "toBuildingId": "W_MultiAge_PAT26A2",
                "upgradeItemId": "upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A2",
                "toBuildingId": "W_MultiAge_PAT26A3",
                "upgradeItemId": "upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A3",
                "toBuildingId": "W_MultiAge_PAT26A4",
                "upgradeItemId": "upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A4",
                "toBuildingId": "W_MultiAge_PAT26A5",
                "upgradeItemId": "upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A5",
                "toBuildingId": "W_MultiAge_PAT26A6",
                "upgradeItemId": "upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A6",
                "toBuildingId": "W_MultiAge_PAT26A7",
                "upgradeItemId": "upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A7",
                "toBuildingId": "W_MultiAge_PAT26A8",
                "upgradeItemId": "upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A8",
                "toBuildingId": "W_MultiAge_PAT26A9",
                "upgradeItemId": "silver_upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26A9",
                "toBuildingId": "W_MultiAge_PAT26A10",
                "upgradeItemId": "golden_upgrade_kit_PAT26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT26E1": {
        "baseBuildingId": "W_MultiAge_PAT26E1",
        "containedBuildingIds": [
            "W_MultiAge_PAT26E1",
            "W_MultiAge_PAT26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_PAT26E"
        ],
        "upgradeItems": {
            "upgrade_kit_PAT26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_PAT26E",
                "name": "McDough's Loaf House Upgrade Kit",
                "description": "Upgrades your McDough's Loaf House to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_PAT26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26E1",
                "toBuildingId": "W_MultiAge_PAT26E2",
                "upgradeItemId": "upgrade_kit_PAT26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT26B1": {
        "baseBuildingId": "W_MultiAge_PAT26B1",
        "containedBuildingIds": [
            "W_MultiAge_PAT26B1",
            "W_MultiAge_PAT26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_PAT26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_PAT26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_PAT26B",
                "name": "Ascended Moorehead's Hatsmith Upgrade Kit",
                "description": "Upgrades your Moorehead's Hatsmith to a time limited Ascended Moorehead's Hatsmith that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_PAT26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26B1",
                "toBuildingId": "W_MultiAge_PAT26B2",
                "upgradeItemId": "upgrade_kit_ascended_PAT26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_PAT26C1": {
        "baseBuildingId": "W_MultiAge_PAT26C1",
        "containedBuildingIds": [
            "W_MultiAge_PAT26C1",
            "W_MultiAge_PAT26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_PAT26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_PAT26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_PAT26C",
                "name": "Ascended Ogham Stones Upgrade Kit",
                "description": "Upgrades your Ogham Stones to a time limited Ascended Ogham Stones that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_PAT26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_PAT26C1",
                "toBuildingId": "W_MultiAge_PAT26C2",
                "upgradeItemId": "upgrade_kit_ascended_PAT26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI25A1": {
        "baseBuildingId": "W_MultiAge_ANNI25A1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI25A1",
            "W_MultiAge_ANNI25A2",
            "W_MultiAge_ANNI25A3",
            "W_MultiAge_ANNI25A4",
            "W_MultiAge_ANNI25A5",
            "W_MultiAge_ANNI25A6",
            "W_MultiAge_ANNI25A7",
            "W_MultiAge_ANNI25A8",
            "W_MultiAge_ANNI25A9",
            "W_MultiAge_ANNI25A10",
            "W_MultiAge_ANNI25A11",
            "W_MultiAge_ANNI25A12"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ANNI25A",
            "silver_upgrade_kit_ANNI25A",
            "golden_upgrade_kit_ANNI25A"
        ],
        "upgradeItems": {
            "upgrade_kit_ANNI25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ANNI25A",
                "name": "Viaticum Lighthouse Upgrade Kit",
                "description": "Upgrades your Viaticum Lighthouse to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_ANNI25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_ANNI25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_ANNI25A",
                "name": "Celestial Viaticum Lighthouse Silver Upgrade Kit",
                "description": "Upgrades your Viaticum Lighthouse to its second best version!",
                "iconAssetName": "silver_upgrade_kit_ANNI25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ANNI25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ANNI25A",
                "name": "Astral Viaticum Lighthouse Golden Upgrade Kit",
                "description": "Upgrades your Viaticum Lighthouse to its best version!",
                "iconAssetName": "golden_upgrade_kit_ANNI25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A1",
                "toBuildingId": "W_MultiAge_ANNI25A2",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A2",
                "toBuildingId": "W_MultiAge_ANNI25A3",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A3",
                "toBuildingId": "W_MultiAge_ANNI25A4",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A4",
                "toBuildingId": "W_MultiAge_ANNI25A5",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A5",
                "toBuildingId": "W_MultiAge_ANNI25A6",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A6",
                "toBuildingId": "W_MultiAge_ANNI25A7",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A7",
                "toBuildingId": "W_MultiAge_ANNI25A8",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A8",
                "toBuildingId": "W_MultiAge_ANNI25A9",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A9",
                "toBuildingId": "W_MultiAge_ANNI25A10",
                "upgradeItemId": "upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A10",
                "toBuildingId": "W_MultiAge_ANNI25A11",
                "upgradeItemId": "silver_upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25A11",
                "toBuildingId": "W_MultiAge_ANNI25A12",
                "upgradeItemId": "golden_upgrade_kit_ANNI25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI25B1": {
        "baseBuildingId": "W_MultiAge_ANNI25B1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI25B1",
            "W_MultiAge_ANNI25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_ANNI25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_ANNI25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ANNI25B",
                "name": "Ascended Helianthus Arboretum Upgrade Kit",
                "description": "Upgrades your Helianthus Arboretum to a time limited Ascended Helianthus Arboretum that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ANNI25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25B1",
                "toBuildingId": "W_MultiAge_ANNI25B2",
                "upgradeItemId": "upgrade_kit_ascended_ANNI25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI25C1": {
        "baseBuildingId": "W_MultiAge_ANNI25C1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI25C1",
            "W_MultiAge_ANNI25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_ANNI25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_ANNI25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ANNI25C",
                "name": "Ascended Octo Orb Upgrade Kit",
                "description": "Upgrades your Octo Orb to a time limited Ascended Octo Orb that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ANNI25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI25C1",
                "toBuildingId": "W_MultiAge_ANNI25C2",
                "upgradeItemId": "upgrade_kit_ascended_ANNI25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_Expedition22Scales": {
        "baseBuildingId": "D_MultiAge_Expedition22Scales",
        "containedBuildingIds": [
            "D_MultiAge_Expedition22Scales",
            "D_MultiAge_Expedition22ScalesSilver",
            "D_MultiAge_Expedition22ScalesGold",
            "D_MultiAge_Expedition22ScalesPlatinum"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_serpent_scales_silver",
            "upgrade_kit_serpent_scales_gold",
            "upgrade_kit_serpent_scales_platinum"
        ],
        "upgradeItems": {
            "upgrade_kit_serpent_scales_silver": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_scales_silver",
                "name": "Serpent Fins Silver Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_scales_silver",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_serpent_scales_gold": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_scales_gold",
                "name": "Serpent Fins Gold Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_scales_gold",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_serpent_scales_platinum": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_scales_platinum",
                "name": "Serpent Scales Platinum Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_scales_platinum",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22Scales",
                "toBuildingId": "D_MultiAge_Expedition22ScalesSilver",
                "upgradeItemId": "upgrade_kit_serpent_scales_silver",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22ScalesSilver",
                "toBuildingId": "D_MultiAge_Expedition22ScalesGold",
                "upgradeItemId": "upgrade_kit_serpent_scales_gold",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22ScalesGold",
                "toBuildingId": "D_MultiAge_Expedition22ScalesPlatinum",
                "upgradeItemId": "upgrade_kit_serpent_scales_platinum",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_Expedition22Spikes": {
        "baseBuildingId": "D_MultiAge_Expedition22Spikes",
        "containedBuildingIds": [
            "D_MultiAge_Expedition22Spikes",
            "D_MultiAge_Expedition22SpikesSilver",
            "D_MultiAge_Expedition22SpikesGold",
            "D_MultiAge_Expedition22SpikesPlatinum"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_serpent_spikes_silver",
            "upgrade_kit_serpent_spikes_gold",
            "upgrade_kit_serpent_spikes_platinum"
        ],
        "upgradeItems": {
            "upgrade_kit_serpent_spikes_silver": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_spikes_silver",
                "name": "Serpent Spikes Silver Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_spikes_silver",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_serpent_spikes_gold": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_spikes_gold",
                "name": "Serpent Spikes Gold Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_spikes_gold",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_serpent_spikes_platinum": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_spikes_platinum",
                "name": "Serpent Spikes Platinum Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_spikes_platinum",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22Spikes",
                "toBuildingId": "D_MultiAge_Expedition22SpikesSilver",
                "upgradeItemId": "upgrade_kit_serpent_spikes_silver",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22SpikesSilver",
                "toBuildingId": "D_MultiAge_Expedition22SpikesGold",
                "upgradeItemId": "upgrade_kit_serpent_spikes_gold",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22SpikesGold",
                "toBuildingId": "D_MultiAge_Expedition22SpikesPlatinum",
                "upgradeItemId": "upgrade_kit_serpent_spikes_platinum",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "D_MultiAge_Expedition22Feathers": {
        "baseBuildingId": "D_MultiAge_Expedition22Feathers",
        "containedBuildingIds": [
            "D_MultiAge_Expedition22Feathers",
            "D_MultiAge_Expedition22FeathersSilver",
            "D_MultiAge_Expedition22FeathersGold",
            "D_MultiAge_Expedition22FeathersPlatinum"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_serpent_feathers_silver",
            "upgrade_kit_serpent_feathers_gold",
            "upgrade_kit_serpent_feathers_platinum"
        ],
        "upgradeItems": {
            "upgrade_kit_serpent_feathers_silver": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_feathers_silver",
                "name": "Serpent Feathers Silver Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_feathers_silver",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_serpent_feathers_gold": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_feathers_gold",
                "name": "Serpent Feathers Gold Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_feathers_gold",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_serpent_feathers_platinum": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_serpent_feathers_platinum",
                "name": "Serpent Feathers Platinum Upgrade Kit",
                "description": "Upgrades your Feathered Serpent Statue Chain Element to an improved version that will improve the provided boosts",
                "iconAssetName": "upgrade_kit_serpent_feathers_platinum",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22Feathers",
                "toBuildingId": "D_MultiAge_Expedition22FeathersSilver",
                "upgradeItemId": "upgrade_kit_serpent_feathers_silver",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22FeathersSilver",
                "toBuildingId": "D_MultiAge_Expedition22FeathersGold",
                "upgradeItemId": "upgrade_kit_serpent_feathers_gold",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "D_MultiAge_Expedition22FeathersGold",
                "toBuildingId": "D_MultiAge_Expedition22FeathersPlatinum",
                "upgradeItemId": "upgrade_kit_serpent_feathers_platinum",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM25A1": {
        "baseBuildingId": "W_MultiAge_SUM25A1",
        "containedBuildingIds": [
            "W_MultiAge_SUM25A1",
            "W_MultiAge_SUM25A2",
            "W_MultiAge_SUM25A3",
            "W_MultiAge_SUM25A4",
            "W_MultiAge_SUM25A5",
            "W_MultiAge_SUM25A6",
            "W_MultiAge_SUM25A7",
            "W_MultiAge_SUM25A8",
            "W_MultiAge_SUM25A9",
            "W_MultiAge_SUM25A10",
            "W_MultiAge_SUM25A11",
            "W_MultiAge_SUM25A12",
            "W_MultiAge_SUM25A13",
            "W_MultiAge_SUM25A14",
            "W_MultiAge_SUM25A15",
            "W_MultiAge_SUM25A16",
            "W_MultiAge_SUM25A17",
            "W_MultiAge_SUM25A18"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_SUM25A",
            "silver_upgrade_kit_SUM25A",
            "golden_upgrade_kit_SUM25A"
        ],
        "upgradeItems": {
            "upgrade_kit_SUM25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_SUM25A",
                "name": "Lagoon Hideout Upgrade Kit",
                "description": "Upgrades your Lagoon Hideout to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_SUM25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_SUM25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_SUM25A",
                "name": "Lagoon Hold Silver Upgrade Kit",
                "description": "Upgrades your Lagoon Hideout to its second best version!",
                "iconAssetName": "silver_upgrade_kit_SUM25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_SUM25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_SUM25A",
                "name": "Lagoon Stronghold Golden Upgrade Kit",
                "description": "Upgrades your Lagoon Hideout to its best version!",
                "iconAssetName": "golden_upgrade_kit_SUM25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A1",
                "toBuildingId": "W_MultiAge_SUM25A2",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A2",
                "toBuildingId": "W_MultiAge_SUM25A3",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A3",
                "toBuildingId": "W_MultiAge_SUM25A4",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A4",
                "toBuildingId": "W_MultiAge_SUM25A5",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A5",
                "toBuildingId": "W_MultiAge_SUM25A6",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A6",
                "toBuildingId": "W_MultiAge_SUM25A7",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A7",
                "toBuildingId": "W_MultiAge_SUM25A8",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A8",
                "toBuildingId": "W_MultiAge_SUM25A9",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A9",
                "toBuildingId": "W_MultiAge_SUM25A10",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A10",
                "toBuildingId": "W_MultiAge_SUM25A11",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A11",
                "toBuildingId": "W_MultiAge_SUM25A12",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 11,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A12",
                "toBuildingId": "W_MultiAge_SUM25A13",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 12,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A13",
                "toBuildingId": "W_MultiAge_SUM25A14",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 13,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A14",
                "toBuildingId": "W_MultiAge_SUM25A15",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 14,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A15",
                "toBuildingId": "W_MultiAge_SUM25A16",
                "upgradeItemId": "upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 15,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A16",
                "toBuildingId": "W_MultiAge_SUM25A17",
                "upgradeItemId": "silver_upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 16,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25A17",
                "toBuildingId": "W_MultiAge_SUM25A18",
                "upgradeItemId": "golden_upgrade_kit_SUM25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM25B1": {
        "baseBuildingId": "W_MultiAge_SUM25B1",
        "containedBuildingIds": [
            "W_MultiAge_SUM25B1",
            "W_MultiAge_SUM25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_SUM25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_SUM25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_SUM25B",
                "name": "Ascended Captain's Coconut Paradise Upgrade Kit",
                "description": "Upgrades your Captain's Coconut Paradise to a time limited Ascended Captain's Coconut Paradise that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_SUM25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25B1",
                "toBuildingId": "W_MultiAge_SUM25B2",
                "upgradeItemId": "upgrade_kit_ascended_SUM25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM25C1": {
        "baseBuildingId": "W_MultiAge_SUM25C1",
        "containedBuildingIds": [
            "W_MultiAge_SUM25C1",
            "W_MultiAge_SUM25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_SUM25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_SUM25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_SUM25C",
                "name": "Ascended Pirate's Parrot Perch Upgrade Kit",
                "description": "Upgrades your Pirate's Parrot Perch to a time limited Ascended Pirate's Parrot Perch that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_SUM25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25C1",
                "toBuildingId": "W_MultiAge_SUM25C2",
                "upgradeItemId": "upgrade_kit_ascended_SUM25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_SUM25F1": {
        "baseBuildingId": "W_MultiAge_SUM25F1",
        "containedBuildingIds": [
            "W_MultiAge_SUM25F1",
            "W_MultiAge_SUM25F2",
            "W_MultiAge_SUM25F3",
            "W_MultiAge_SUM25F4"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_SUM25F",
            "silver_upgrade_kit_SUM25F",
            "golden_upgrade_kit_SUM25F"
        ],
        "upgradeItems": {
            "upgrade_kit_SUM25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_SUM25F",
                "name": "Siren's Rock Upgrade Kit",
                "description": "Upgrades your Siren's Rock to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_SUM25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_SUM25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_SUM25F",
                "name": "Siren's Treasure Rock Silver Upgrade Kit",
                "description": "Upgrades your Siren's Rock to its second best version!",
                "iconAssetName": "silver_upgrade_kit_SUM25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_SUM25F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_SUM25F",
                "name": "Enchanted Siren's Treasure Rock Golden Upgrade Kit",
                "description": "Upgrades your Siren's Rock to its best version!",
                "iconAssetName": "golden_upgrade_kit_SUM25F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25F1",
                "toBuildingId": "W_MultiAge_SUM25F2",
                "upgradeItemId": "upgrade_kit_SUM25F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25F2",
                "toBuildingId": "W_MultiAge_SUM25F3",
                "upgradeItemId": "silver_upgrade_kit_SUM25F",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_SUM25F3",
                "toBuildingId": "W_MultiAge_SUM25F4",
                "upgradeItemId": "golden_upgrade_kit_SUM25F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE25A1": {
        "baseBuildingId": "W_MultiAge_CARE25A1",
        "containedBuildingIds": [
            "W_MultiAge_CARE25A1",
            "W_MultiAge_CARE25A2",
            "W_MultiAge_CARE25A3",
            "W_MultiAge_CARE25A4",
            "W_MultiAge_CARE25A5",
            "W_MultiAge_CARE25A6",
            "W_MultiAge_CARE25A7",
            "W_MultiAge_CARE25A8",
            "W_MultiAge_CARE25A9",
            "W_MultiAge_CARE25A10",
            "W_MultiAge_CARE25A11"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CARE25A",
            "silver_upgrade_kit_CARE25A",
            "golden_upgrade_kit_CARE25A"
        ],
        "upgradeItems": {
            "upgrade_kit_CARE25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CARE25A",
                "name": "Forest Sentinel Upgrade Kit",
                "description": "Upgrades your Forest Sentinel to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CARE25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_CARE25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_CARE25A",
                "name": "Forest Warden Silver Upgrade Kit",
                "description": "Upgrades your Forest Sentinel to its second best version!",
                "iconAssetName": "silver_upgrade_kit_CARE25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_CARE25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_CARE25A",
                "name": "Forest Guardian Golden Upgrade Kit",
                "description": "Upgrades your Forest Sentinel to its best version!",
                "iconAssetName": "golden_upgrade_kit_CARE25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A1",
                "toBuildingId": "W_MultiAge_CARE25A2",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A2",
                "toBuildingId": "W_MultiAge_CARE25A3",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A3",
                "toBuildingId": "W_MultiAge_CARE25A4",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A4",
                "toBuildingId": "W_MultiAge_CARE25A5",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A5",
                "toBuildingId": "W_MultiAge_CARE25A6",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A6",
                "toBuildingId": "W_MultiAge_CARE25A7",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A7",
                "toBuildingId": "W_MultiAge_CARE25A8",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A8",
                "toBuildingId": "W_MultiAge_CARE25A9",
                "upgradeItemId": "upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A9",
                "toBuildingId": "W_MultiAge_CARE25A10",
                "upgradeItemId": "silver_upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25A10",
                "toBuildingId": "W_MultiAge_CARE25A11",
                "upgradeItemId": "golden_upgrade_kit_CARE25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE25B1": {
        "baseBuildingId": "W_MultiAge_CARE25B1",
        "containedBuildingIds": [
            "W_MultiAge_CARE25B1",
            "W_MultiAge_CARE25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_CARE25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_CARE25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CARE25B",
                "name": "Ascended Nano-Nurture Flower Tower Upgrade Kit",
                "description": "Upgrades your Nano-Nurture Flower Tower to a time limited Ascended Nano-Nurture Flower Tower that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CARE25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25B1",
                "toBuildingId": "W_MultiAge_CARE25B2",
                "upgradeItemId": "upgrade_kit_ascended_CARE25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE25C1": {
        "baseBuildingId": "W_MultiAge_CARE25C1",
        "containedBuildingIds": [
            "W_MultiAge_CARE25C1",
            "W_MultiAge_CARE25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_CARE25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_CARE25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CARE25C",
                "name": "Ascended Terra Tea Lounge Upgrade Kit",
                "description": "Upgrades your Terra Tea Lounge to a time limited Ascended Terra Tea Lounge that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CARE25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25C1",
                "toBuildingId": "W_MultiAge_CARE25C2",
                "upgradeItemId": "upgrade_kit_ascended_CARE25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE25E1": {
        "baseBuildingId": "W_MultiAge_CARE25E1",
        "containedBuildingIds": [
            "W_MultiAge_CARE25E1",
            "W_MultiAge_CARE25E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CARE25E"
        ],
        "upgradeItems": {
            "upgrade_kit_CARE25E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CARE25E",
                "name": "Garden of United Visions Upgrade Kit",
                "description": "Upgrades your Garden of United Visions to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CARE25E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE25E1",
                "toBuildingId": "W_MultiAge_CARE25E2",
                "upgradeItemId": "upgrade_kit_CARE25E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL25A1": {
        "baseBuildingId": "W_MultiAge_FELL25A1",
        "containedBuildingIds": [
            "W_MultiAge_FELL25A1",
            "W_MultiAge_FELL25A2",
            "W_MultiAge_FELL25A3",
            "W_MultiAge_FELL25A4",
            "W_MultiAge_FELL25A5",
            "W_MultiAge_FELL25A6",
            "W_MultiAge_FELL25A7",
            "W_MultiAge_FELL25A8",
            "W_MultiAge_FELL25A9",
            "W_MultiAge_FELL25A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FELL25A",
            "silver_upgrade_kit_FELL25A",
            "golden_upgrade_kit_FELL25A"
        ],
        "upgradeItems": {
            "upgrade_kit_FELL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FELL25A",
                "name": "Mercantile Crossing Upgrade Kit",
                "description": "Upgrades your Mercantile Crossing to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FELL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FELL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FELL25A",
                "name": "Mercantile Passage Silver Upgrade Kit",
                "description": "Upgrades your Mercantile Crossing to its second best version!",
                "iconAssetName": "silver_upgrade_kit_FELL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FELL25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FELL25A",
                "name": "Mercantile Waystation Golden Upgrade Kit",
                "description": "Upgrades your Mercantile Crossing to its best version!",
                "iconAssetName": "golden_upgrade_kit_FELL25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A1",
                "toBuildingId": "W_MultiAge_FELL25A2",
                "upgradeItemId": "upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A2",
                "toBuildingId": "W_MultiAge_FELL25A3",
                "upgradeItemId": "upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A3",
                "toBuildingId": "W_MultiAge_FELL25A4",
                "upgradeItemId": "upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A4",
                "toBuildingId": "W_MultiAge_FELL25A5",
                "upgradeItemId": "upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A5",
                "toBuildingId": "W_MultiAge_FELL25A6",
                "upgradeItemId": "upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A6",
                "toBuildingId": "W_MultiAge_FELL25A7",
                "upgradeItemId": "upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A7",
                "toBuildingId": "W_MultiAge_FELL25A8",
                "upgradeItemId": "upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A8",
                "toBuildingId": "W_MultiAge_FELL25A9",
                "upgradeItemId": "silver_upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25A9",
                "toBuildingId": "W_MultiAge_FELL25A10",
                "upgradeItemId": "golden_upgrade_kit_FELL25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL25B1": {
        "baseBuildingId": "W_MultiAge_FELL25B1",
        "containedBuildingIds": [
            "W_MultiAge_FELL25B1",
            "W_MultiAge_FELL25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FELL25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FELL25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FELL25B",
                "name": "Ascended Ribbit Retreat Upgrade Kit",
                "description": "Upgrades your Ribbit Retreat to a time limited Ascended Ribbit Retreat that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FELL25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25B1",
                "toBuildingId": "W_MultiAge_FELL25B2",
                "upgradeItemId": "upgrade_kit_ascended_FELL25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL25C1": {
        "baseBuildingId": "W_MultiAge_FELL25C1",
        "containedBuildingIds": [
            "W_MultiAge_FELL25C1",
            "W_MultiAge_FELL25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FELL25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FELL25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FELL25C",
                "name": "Ascended Nomad's Nook Upgrade Kit",
                "description": "Upgrades your Nomad's Nook to a time limited Ascended Nomad's Nook that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FELL25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25C1",
                "toBuildingId": "W_MultiAge_FELL25C2",
                "upgradeItemId": "upgrade_kit_ascended_FELL25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL25E1": {
        "baseBuildingId": "W_MultiAge_FELL25E1",
        "containedBuildingIds": [
            "W_MultiAge_FELL25E1",
            "W_MultiAge_FELL25E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FELL25E"
        ],
        "upgradeItems": {
            "upgrade_kit_FELL25E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FELL25E",
                "name": "Raftway Harbour Upgrade Kit",
                "description": "Upgrades your Raftway Harbour to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FELL25E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL25E1",
                "toBuildingId": "W_MultiAge_FELL25E2",
                "upgradeItemId": "upgrade_kit_FELL25E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL26A1": {
        "baseBuildingId": "W_MultiAge_FELL26A1",
        "containedBuildingIds": [
            "W_MultiAge_FELL26A1",
            "W_MultiAge_FELL26A2",
            "W_MultiAge_FELL26A3",
            "W_MultiAge_FELL26A4",
            "W_MultiAge_FELL26A5",
            "W_MultiAge_FELL26A6",
            "W_MultiAge_FELL26A7",
            "W_MultiAge_FELL26A8",
            "W_MultiAge_FELL26A9",
            "W_MultiAge_FELL26A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FELL26A",
            "silver_upgrade_kit_FELL26A",
            "golden_upgrade_kit_FELL26A"
        ],
        "upgradeItems": {
            "upgrade_kit_FELL26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FELL26A",
                "name": "Hearthglen Wayhouse Upgrade Kit",
                "description": "Upgrades your Hearthglen Wayhouse to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FELL26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FELL26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FELL26A",
                "name": "Halcyon Hearthglen Wayhouse Silver Upgrade Kit",
                "description": "Upgrades your Hearthglen Wayhouse to its second best version!",
                "iconAssetName": "silver_upgrade_kit_FELL26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FELL26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FELL26A",
                "name": "Aurelian Hearthglen Wayhouse Golden Upgrade Kit",
                "description": "Upgrades your Hearthglen Wayhouse to its best version!",
                "iconAssetName": "golden_upgrade_kit_FELL26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A1",
                "toBuildingId": "W_MultiAge_FELL26A2",
                "upgradeItemId": "upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A2",
                "toBuildingId": "W_MultiAge_FELL26A3",
                "upgradeItemId": "upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A3",
                "toBuildingId": "W_MultiAge_FELL26A4",
                "upgradeItemId": "upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A4",
                "toBuildingId": "W_MultiAge_FELL26A5",
                "upgradeItemId": "upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A5",
                "toBuildingId": "W_MultiAge_FELL26A6",
                "upgradeItemId": "upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A6",
                "toBuildingId": "W_MultiAge_FELL26A7",
                "upgradeItemId": "upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A7",
                "toBuildingId": "W_MultiAge_FELL26A8",
                "upgradeItemId": "upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A8",
                "toBuildingId": "W_MultiAge_FELL26A9",
                "upgradeItemId": "silver_upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26A9",
                "toBuildingId": "W_MultiAge_FELL26A10",
                "upgradeItemId": "golden_upgrade_kit_FELL26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL26B1": {
        "baseBuildingId": "W_MultiAge_FELL26B1",
        "containedBuildingIds": [
            "W_MultiAge_FELL26B1",
            "W_MultiAge_FELL26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FELL26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FELL26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FELL26B",
                "name": "Ascended Banneret Muster Upgrade Kit",
                "description": "Upgrades your Banneret Muster to a time limited Ascended Banneret Muster that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FELL26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26B1",
                "toBuildingId": "W_MultiAge_FELL26B2",
                "upgradeItemId": "upgrade_kit_ascended_FELL26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL26C1": {
        "baseBuildingId": "W_MultiAge_FELL26C1",
        "containedBuildingIds": [
            "W_MultiAge_FELL26C1",
            "W_MultiAge_FELL26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FELL26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FELL26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FELL26C",
                "name": "Ascended Duskmantle Covenant Upgrade Kit",
                "description": "Upgrades your Duskmantle Covenant to a time limited Ascended Duskmantle Covenant that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FELL26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26C1",
                "toBuildingId": "W_MultiAge_FELL26C2",
                "upgradeItemId": "upgrade_kit_ascended_FELL26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FELL26E1": {
        "baseBuildingId": "W_MultiAge_FELL26E1",
        "containedBuildingIds": [
            "W_MultiAge_FELL26E1",
            "W_MultiAge_FELL26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FELL26E"
        ],
        "upgradeItems": {
            "upgrade_kit_FELL26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FELL26E",
                "name": "Waitswood Songhouse Upgrade Kit",
                "description": "Upgrades your Waitswood Songhouse to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FELL26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FELL26E1",
                "toBuildingId": "W_MultiAge_FELL26E2",
                "upgradeItemId": "upgrade_kit_FELL26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25I1": {
        "baseBuildingId": "W_MultiAge_GR25I1",
        "containedBuildingIds": [
            "W_MultiAge_GR25I1",
            "W_MultiAge_GR25I2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25I"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25I": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25I",
                "name": "Neo Clocktower Upgrade Kit",
                "description": "Upgrades your Neo Clocktower to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25I",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25I1",
                "toBuildingId": "W_MultiAge_GR25I2",
                "upgradeItemId": "upgrade_kit_GR25I",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25J1": {
        "baseBuildingId": "W_MultiAge_GR25J1",
        "containedBuildingIds": [
            "W_MultiAge_GR25J1",
            "W_MultiAge_GR25J2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25J"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25J": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25J",
                "name": "Neo Menagerie Upgrade Kit",
                "description": "Upgrades your Neo Menagerie to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25J",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25J1",
                "toBuildingId": "W_MultiAge_GR25J2",
                "upgradeItemId": "upgrade_kit_GR25J",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25D1": {
        "baseBuildingId": "W_MultiAge_GR25D1",
        "containedBuildingIds": [
            "W_MultiAge_GR25D1",
            "W_MultiAge_GR25D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25D"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25D",
                "name": "Neo Fashion Boutique Upgrade Kit",
                "description": "Upgrades your Neo Fashion Boutique to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25D1",
                "toBuildingId": "W_MultiAge_GR25D2",
                "upgradeItemId": "upgrade_kit_GR25D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR25C1": {
        "baseBuildingId": "W_MultiAge_GR25C1",
        "containedBuildingIds": [
            "W_MultiAge_GR25C1",
            "W_MultiAge_GR25C2",
            "W_MultiAge_GR25C3",
            "W_MultiAge_GR25C4",
            "W_MultiAge_GR25C5",
            "W_MultiAge_GR25C6",
            "W_MultiAge_GR25C7",
            "W_MultiAge_GR25C8",
            "W_MultiAge_GR25C9a",
            "W_MultiAge_GR25C9b",
            "W_MultiAge_GR25C10a",
            "W_MultiAge_GR25C10b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR25C",
            "silver_upgrade_kit_GR25Ca",
            "silver_upgrade_kit_GR25Cb",
            "golden_upgrade_kit_GR25Ca",
            "golden_upgrade_kit_GR25Cb"
        ],
        "upgradeItems": {
            "upgrade_kit_GR25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR25C",
                "name": "Neo Bazaar Upgrade Kit",
                "description": "Upgrades your Neo Bazaar to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_GR25Ca": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_GR25Ca",
                "name": "Solara Bazaar Silver Upgrade Kit",
                "description": "Upgrades your Neo Bazaar to Silver level!",
                "iconAssetName": "silver_upgrade_kit_GR25Ca",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_GR25Cb": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_GR25Cb",
                "name": "Lunara Bazaar Silver Upgrade Kit",
                "description": "Upgrades your Neo Bazaar to Silver level!",
                "iconAssetName": "silver_upgrade_kit_GR25Cb",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_GR25Ca": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_GR25Ca",
                "name": "Solara Emporium Golden Upgrade Kit",
                "description": "Upgrades your Neo Bazaar to Golden level!",
                "iconAssetName": "golden_upgrade_kit_GR25Ca",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_GR25Cb": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_GR25Cb",
                "name": "Lunara Emporium Golden Upgrade Kit",
                "description": "Upgrades your Neo Bazaar to Golden level!",
                "iconAssetName": "golden_upgrade_kit_GR25Cb",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C1",
                "toBuildingId": "W_MultiAge_GR25C2",
                "upgradeItemId": "upgrade_kit_GR25C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C2",
                "toBuildingId": "W_MultiAge_GR25C3",
                "upgradeItemId": "upgrade_kit_GR25C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C3",
                "toBuildingId": "W_MultiAge_GR25C4",
                "upgradeItemId": "upgrade_kit_GR25C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C4",
                "toBuildingId": "W_MultiAge_GR25C5",
                "upgradeItemId": "upgrade_kit_GR25C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C5",
                "toBuildingId": "W_MultiAge_GR25C6",
                "upgradeItemId": "upgrade_kit_GR25C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C6",
                "toBuildingId": "W_MultiAge_GR25C7",
                "upgradeItemId": "upgrade_kit_GR25C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C7",
                "toBuildingId": "W_MultiAge_GR25C8",
                "upgradeItemId": "upgrade_kit_GR25C",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C8",
                "toBuildingId": "W_MultiAge_GR25C9a",
                "upgradeItemId": "silver_upgrade_kit_GR25Ca",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C8",
                "toBuildingId": "W_MultiAge_GR25C9b",
                "upgradeItemId": "silver_upgrade_kit_GR25Cb",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C9a",
                "toBuildingId": "W_MultiAge_GR25C10a",
                "upgradeItemId": "golden_upgrade_kit_GR25Ca",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR25C9b",
                "toBuildingId": "W_MultiAge_GR25C10b",
                "upgradeItemId": "golden_upgrade_kit_GR25Cb",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25G1": {
        "baseBuildingId": "W_MultiAge_GBG25G1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25G1",
            "W_MultiAge_GBG25G2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25G"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25G": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25G",
                "name": "Ironclad Depot Upgrade Kit",
                "description": "Upgrades your Ironclad Depot to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25G",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25G1",
                "toBuildingId": "W_MultiAge_GBG25G2",
                "upgradeItemId": "upgrade_kit_GBG25G",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG25H1": {
        "baseBuildingId": "W_MultiAge_GBG25H1",
        "containedBuildingIds": [
            "W_MultiAge_GBG25H1",
            "W_MultiAge_GBG25H2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG25H"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG25H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG25H",
                "name": "Ironclad Provisions Upgrade Kit",
                "description": "Upgrades your Ironclad Provisions to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG25H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG25H1",
                "toBuildingId": "W_MultiAge_GBG25H2",
                "upgradeItemId": "upgrade_kit_GBG25H",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "M_AllAge_LSO25A1": {
        "baseBuildingId": "M_AllAge_LSO25A1",
        "containedBuildingIds": [
            "M_AllAge_LSO25A1",
            "M_AllAge_LSO25A2",
            "M_AllAge_LSO25A3"
        ],
        "containedUpgradeItemIds": [
            "silver_upgrade_kit_legend_a",
            "golden_upgrade_kit_legend_a"
        ],
        "upgradeItems": {
            "silver_upgrade_kit_legend_a": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_legend_a",
                "name": "Statue of Castor Silver Upgrade Kit",
                "description": "This Upgrade Kit is automatically applied to an eligible building when collected as a reward.",
                "iconAssetName": "silver_upgrade_kit_GR25Cb",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_legend_a": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_legend_a",
                "name": "Statue of Castor Golden Upgrade Kit",
                "description": "This Upgrade Kit is automatically applied to an eligible building when collected as a reward.",
                "iconAssetName": "golden_upgrade_kit_GR25Cb",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "M_AllAge_LSO25A1",
                "toBuildingId": "M_AllAge_LSO25A2",
                "upgradeItemId": "silver_upgrade_kit_legend_a",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "M_AllAge_LSO25A2",
                "toBuildingId": "M_AllAge_LSO25A3",
                "upgradeItemId": "golden_upgrade_kit_legend_a",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN25A1": {
        "baseBuildingId": "W_MultiAge_WIN25A1",
        "containedBuildingIds": [
            "W_MultiAge_WIN25A1",
            "W_MultiAge_WIN25A2",
            "W_MultiAge_WIN25A3",
            "W_MultiAge_WIN25A4",
            "W_MultiAge_WIN25A5",
            "W_MultiAge_WIN25A6",
            "W_MultiAge_WIN25A7",
            "W_MultiAge_WIN25A8",
            "W_MultiAge_WIN25A9"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN25A",
            "silver_upgrade_kit_WIN25A",
            "golden_upgrade_kit_WIN25A"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN25A",
                "name": "Midnight Clock Tower Upgrade Kit",
                "description": "Upgrades your Midnight Clock Tower to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WIN25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WIN25A",
                "name": "Grand Midnight Clock Tower Silver Upgrade Kit",
                "description": "Upgrades your Midnight Clock Tower to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WIN25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN25A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN25A",
                "name": "Royal Midnight Clock Tower Golden Upgrade Kit",
                "description": "Upgrades your Midnight Clock Tower to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN25A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A1",
                "toBuildingId": "W_MultiAge_WIN25A2",
                "upgradeItemId": "upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A2",
                "toBuildingId": "W_MultiAge_WIN25A3",
                "upgradeItemId": "upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A3",
                "toBuildingId": "W_MultiAge_WIN25A4",
                "upgradeItemId": "upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A4",
                "toBuildingId": "W_MultiAge_WIN25A5",
                "upgradeItemId": "upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A5",
                "toBuildingId": "W_MultiAge_WIN25A6",
                "upgradeItemId": "upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A6",
                "toBuildingId": "W_MultiAge_WIN25A7",
                "upgradeItemId": "upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A7",
                "toBuildingId": "W_MultiAge_WIN25A8",
                "upgradeItemId": "silver_upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25A8",
                "toBuildingId": "W_MultiAge_WIN25A9",
                "upgradeItemId": "golden_upgrade_kit_WIN25A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN25B1": {
        "baseBuildingId": "W_MultiAge_WIN25B1",
        "containedBuildingIds": [
            "W_MultiAge_WIN25B1",
            "W_MultiAge_WIN25B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WIN25B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WIN25B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN25B",
                "name": "Ascended Snowdrop Garden Upgrade Kit",
                "description": "Upgrades your Snowdrop Garden to a time limited Ascended Snowdrop Garden that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN25B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25B1",
                "toBuildingId": "W_MultiAge_WIN25B2",
                "upgradeItemId": "upgrade_kit_ascended_WIN25B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN25C1": {
        "baseBuildingId": "W_MultiAge_WIN25C1",
        "containedBuildingIds": [
            "W_MultiAge_WIN25C1",
            "W_MultiAge_WIN25C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WIN25C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WIN25C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN25C",
                "name": "Ascended Starlight Boulevard Kiosk Upgrade Kit",
                "description": "Upgrades your Starlight Boulevard Kiosk to a time limited Ascended Starlight Boulevard Kiosk that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN25C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN25C1",
                "toBuildingId": "W_MultiAge_WIN25C2",
                "upgradeItemId": "upgrade_kit_ascended_WIN25C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN19B1": {
        "baseBuildingId": "W_MultiAge_WIN19B1",
        "containedBuildingIds": [
            "W_MultiAge_WIN19B1",
            "W_MultiAge_WIN19B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN19B"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN19B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN19B",
                "name": "Dining Car Upgrade Kit",
                "description": "Upgrades your Dining Car to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN19B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19B1",
                "toBuildingId": "W_MultiAge_WIN19B2",
                "upgradeItemId": "upgrade_kit_WIN19B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN19C1": {
        "baseBuildingId": "W_MultiAge_WIN19C1",
        "containedBuildingIds": [
            "W_MultiAge_WIN19C1",
            "W_MultiAge_WIN19C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN19C"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN19C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN19C",
                "name": "Sleeping Car Upgrade Kit",
                "description": "Upgrades your Sleeping Car to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN19C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19C1",
                "toBuildingId": "W_MultiAge_WIN19C2",
                "upgradeItemId": "upgrade_kit_WIN19C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN19D1": {
        "baseBuildingId": "W_MultiAge_WIN19D1",
        "containedBuildingIds": [
            "W_MultiAge_WIN19D1",
            "W_MultiAge_WIN19D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN19D"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN19D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN19D",
                "name": "Freight Car Upgrade Kit",
                "description": "Upgrades your Freight Car to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN19D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN19D1",
                "toBuildingId": "W_MultiAge_WIN19D2",
                "upgradeItemId": "upgrade_kit_WIN19D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN21B1": {
        "baseBuildingId": "W_MultiAge_WIN21B1",
        "containedBuildingIds": [
            "W_MultiAge_WIN21B1",
            "W_MultiAge_WIN21B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN21B"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN21B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN21B",
                "name": "Parlor Car Upgrade Kit",
                "description": "Upgrades your Parlor Car to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN21B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN21B1",
                "toBuildingId": "W_MultiAge_WIN21B2",
                "upgradeItemId": "upgrade_kit_WIN21B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "M_AllAge_LSO25B1": {
        "baseBuildingId": "M_AllAge_LSO25B1",
        "containedBuildingIds": [
            "M_AllAge_LSO25B1",
            "M_AllAge_LSO25B2"
        ],
        "containedUpgradeItemIds": [
            "golden_upgrade_kit_legend_b"
        ],
        "upgradeItems": {
            "golden_upgrade_kit_legend_b": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_legend_b",
                "name": "Statue of Thea Golden Upgrade Kit",
                "description": "This Upgrade Kit is automatically applied to an eligible building when collected as a reward.",
                "iconAssetName": "golden_upgrade_kit_GR25Cb",
                "isHighlighted": true,
                "flags": [
                    "rare"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "M_AllAge_LSO25B1",
                "toBuildingId": "M_AllAge_LSO25B2",
                "upgradeItemId": "golden_upgrade_kit_legend_b",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26A1": {
        "baseBuildingId": "W_MultiAge_GR26A1",
        "containedBuildingIds": [
            "W_MultiAge_GR26A1",
            "W_MultiAge_GR26A2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26A"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26A",
                "name": "Neo Ziggurat Upgrade Kit",
                "description": "Upgrades your Neo Ziggurat to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26A1",
                "toBuildingId": "W_MultiAge_GR26A2",
                "upgradeItemId": "upgrade_kit_GR26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26B1": {
        "baseBuildingId": "W_MultiAge_GR26B1",
        "containedBuildingIds": [
            "W_MultiAge_GR26B1",
            "W_MultiAge_GR26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26B"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26B",
                "name": "Neo Tree of Love Upgrade Kit",
                "description": "Upgrades your Neo Tree of Love to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26B1",
                "toBuildingId": "W_MultiAge_GR26B2",
                "upgradeItemId": "upgrade_kit_GR26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26C1": {
        "baseBuildingId": "W_MultiAge_GR26C1",
        "containedBuildingIds": [
            "W_MultiAge_GR26C1",
            "W_MultiAge_GR26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26C"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26C",
                "name": "Neo Art Exhibition Upgrade Kit",
                "description": "Upgrades your Neo Art Exhibition to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26C1",
                "toBuildingId": "W_MultiAge_GR26C2",
                "upgradeItemId": "upgrade_kit_GR26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26D1": {
        "baseBuildingId": "W_MultiAge_GR26D1",
        "containedBuildingIds": [
            "W_MultiAge_GR26D1",
            "W_MultiAge_GR26D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26D"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26D",
                "name": "Neo Globe Fountain Upgrade Kit",
                "description": "Upgrades your Neo Globe Fountain to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26D1",
                "toBuildingId": "W_MultiAge_GR26D2",
                "upgradeItemId": "upgrade_kit_GR26D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26A1": {
        "baseBuildingId": "W_MultiAge_GBG26A1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26A1",
            "W_MultiAge_GBG26A2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26A"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26A",
                "name": "Warforge Assembly Upgrade Kit",
                "description": "Upgrades your Warforge Assembly to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26A1",
                "toBuildingId": "W_MultiAge_GBG26A2",
                "upgradeItemId": "upgrade_kit_GBG26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26B1": {
        "baseBuildingId": "W_MultiAge_GBG26B1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26B1",
            "W_MultiAge_GBG26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26B"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26B",
                "name": "Warforge Trench Upgrade Kit",
                "description": "Upgrades your Warforge Trench to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26B1",
                "toBuildingId": "W_MultiAge_GBG26B2",
                "upgradeItemId": "upgrade_kit_GBG26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP25K1": {
        "baseBuildingId": "W_MultiAge_COP25K1",
        "containedBuildingIds": [
            "W_MultiAge_COP25K1",
            "W_MultiAge_COP25K2",
            "W_MultiAge_COP25K3",
            "W_MultiAge_COP25K4",
            "W_MultiAge_COP25K5",
            "W_MultiAge_COP25K6",
            "W_MultiAge_COP25K7",
            "W_MultiAge_COP25K8",
            "W_MultiAge_COP25K9",
            "W_MultiAge_COP25K10TEMP"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_COP25K",
            "upgrade_kit_ascended_COP25K"
        ],
        "upgradeItems": {
            "upgrade_kit_COP25K": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_COP25K",
                "name": "Pirate Treasure Cove Upgrade Kit",
                "description": "Upgrades your Pirate Treasure Cove to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_treasure_cove",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_COP25K": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_COP25K",
                "name": "Ascended Pirate Treasure Cove Upgrade Kit",
                "description": "Upgrades your fully upgraded building to a time-limited ascended version that will produce more resources. When the time expires, it reverts to its previous fully upgraded state.",
                "iconAssetName": "upgrade_kit_ascended_treasure_cove",
                "isHighlighted": true,
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K1",
                "toBuildingId": "W_MultiAge_COP25K2",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K2",
                "toBuildingId": "W_MultiAge_COP25K3",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K3",
                "toBuildingId": "W_MultiAge_COP25K4",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K4",
                "toBuildingId": "W_MultiAge_COP25K5",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K5",
                "toBuildingId": "W_MultiAge_COP25K6",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K6",
                "toBuildingId": "W_MultiAge_COP25K7",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K7",
                "toBuildingId": "W_MultiAge_COP25K8",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K8",
                "toBuildingId": "W_MultiAge_COP25K9",
                "upgradeItemId": "upgrade_kit_COP25K",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25K9",
                "toBuildingId": "W_MultiAge_COP25K10TEMP",
                "upgradeItemId": "upgrade_kit_ascended_COP25K",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_COP25KB1": {
        "baseBuildingId": "W_MultiAge_COP25KB1",
        "containedBuildingIds": [
            "W_MultiAge_COP25KB1",
            "W_MultiAge_COP25KB2",
            "W_MultiAge_COP25KB3",
            "W_MultiAge_COP25KB4",
            "W_MultiAge_COP25KB5"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_COP25KB"
        ],
        "upgradeItems": {
            "upgrade_kit_COP25KB": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_COP25KB",
                "name": "Blackbeard's Hideout Upgrade Kit",
                "description": "Upgrades your Blackbeard's Hideout to an improved version that will produce more resources.",
                "iconAssetName": "upgrade_kit_COP25KB",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25KB1",
                "toBuildingId": "W_MultiAge_COP25KB2",
                "upgradeItemId": "upgrade_kit_COP25KB",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25KB2",
                "toBuildingId": "W_MultiAge_COP25KB3",
                "upgradeItemId": "upgrade_kit_COP25KB",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25KB3",
                "toBuildingId": "W_MultiAge_COP25KB4",
                "upgradeItemId": "upgrade_kit_COP25KB",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_COP25KB4",
                "toBuildingId": "W_MultiAge_COP25KB5",
                "upgradeItemId": "upgrade_kit_COP25KB",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26C1": {
        "baseBuildingId": "W_MultiAge_GBG26C1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26C1",
            "W_MultiAge_GBG26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26C"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26C",
                "name": "Intelligence Bureau Upgrade Kit",
                "description": "Upgrades your Intelligence Bureau to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26C1",
                "toBuildingId": "W_MultiAge_GBG26C2",
                "upgradeItemId": "upgrade_kit_GBG26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26D1": {
        "baseBuildingId": "W_MultiAge_GBG26D1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26D1",
            "W_MultiAge_GBG26D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26D"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26D",
                "name": "Intelligence Relay Upgrade Kit",
                "description": "Upgrades your Intelligence Relay to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26D1",
                "toBuildingId": "W_MultiAge_GBG26D2",
                "upgradeItemId": "upgrade_kit_GBG26D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI26A1": {
        "baseBuildingId": "W_MultiAge_ANNI26A1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI26A1",
            "W_MultiAge_ANNI26A2",
            "W_MultiAge_ANNI26A3",
            "W_MultiAge_ANNI26A4",
            "W_MultiAge_ANNI26A5",
            "W_MultiAge_ANNI26A6",
            "W_MultiAge_ANNI26A7",
            "W_MultiAge_ANNI26A8",
            "W_MultiAge_ANNI26A9",
            "W_MultiAge_ANNI26A10a",
            "W_MultiAge_ANNI26A10b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ANNI26A",
            "silver_upgrade_kit_ANNI26A",
            "golden_upgrade_kit_ANNI26A"
        ],
        "upgradeItems": {
            "upgrade_kit_ANNI26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ANNI26A",
                "name": "Mk I Anomaly Extractor Upgrade Kit",
                "description": "Upgrades your Mk I Anomaly Extractor to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_ANNI26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_ANNI26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_ANNI26A",
                "name": "Mk II Anomaly Extractor Silver Upgrade Kit",
                "description": "Upgrades your Mk I Anomaly Extractor to its second best version!",
                "iconAssetName": "silver_upgrade_kit_ANNI26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ANNI26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ANNI26A",
                "name": "Mk III Anomaly Extractor Golden Upgrade Kit",
                "description": "Upgrades your Mk I Anomaly Extractor to its best version!",
                "iconAssetName": "golden_upgrade_kit_ANNI26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A1",
                "toBuildingId": "W_MultiAge_ANNI26A2",
                "upgradeItemId": "upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A2",
                "toBuildingId": "W_MultiAge_ANNI26A3",
                "upgradeItemId": "upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A3",
                "toBuildingId": "W_MultiAge_ANNI26A4",
                "upgradeItemId": "upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A4",
                "toBuildingId": "W_MultiAge_ANNI26A5",
                "upgradeItemId": "upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A5",
                "toBuildingId": "W_MultiAge_ANNI26A6",
                "upgradeItemId": "upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A6",
                "toBuildingId": "W_MultiAge_ANNI26A7",
                "upgradeItemId": "upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A7",
                "toBuildingId": "W_MultiAge_ANNI26A8",
                "upgradeItemId": "upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A8",
                "toBuildingId": "W_MultiAge_ANNI26A9",
                "upgradeItemId": "silver_upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A9",
                "toBuildingId": "W_MultiAge_ANNI26A10a",
                "upgradeItemId": "golden_upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26A9",
                "toBuildingId": "W_MultiAge_ANNI26A10b",
                "upgradeItemId": "golden_upgrade_kit_ANNI26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI26B1": {
        "baseBuildingId": "W_MultiAge_ANNI26B1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI26B1",
            "W_MultiAge_ANNI26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_ANNI26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_ANNI26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ANNI26B",
                "name": "Ascended Iris Glass Gardens Upgrade Kit",
                "description": "Upgrades your Iris Glass Gardens to a time-limited Ascended Iris Glass Gardens that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ANNI26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26B1",
                "toBuildingId": "W_MultiAge_ANNI26B2",
                "upgradeItemId": "upgrade_kit_ascended_ANNI26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI26C1": {
        "baseBuildingId": "W_MultiAge_ANNI26C1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI26C1",
            "W_MultiAge_ANNI26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_ANNI26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_ANNI26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ANNI26C",
                "name": "Ascended Meridian Sun Dial Upgrade Kit",
                "description": "Upgrades your Meridian Sun Dial to a time-limited Ascended Meridian Sun Dial that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ANNI26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26C1",
                "toBuildingId": "W_MultiAge_ANNI26C2",
                "upgradeItemId": "upgrade_kit_ascended_ANNI26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ANNI26E1": {
        "baseBuildingId": "W_MultiAge_ANNI26E1",
        "containedBuildingIds": [
            "W_MultiAge_ANNI26E1",
            "W_MultiAge_ANNI26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ANNI26E"
        ],
        "upgradeItems": {
            "upgrade_kit_ANNI26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ANNI26E",
                "name": "Palace of Liquid Light Upgrade Kit",
                "description": "Upgrades your Palace of Liquid Light to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_ANNI26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ANNI26E1",
                "toBuildingId": "W_MultiAge_ANNI26E2",
                "upgradeItemId": "upgrade_kit_ANNI26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26E1": {
        "baseBuildingId": "W_MultiAge_GR26E1",
        "containedBuildingIds": [
            "W_MultiAge_GR26E1",
            "W_MultiAge_GR26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26E"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26E",
                "name": "Neo Grand Bridge Upgrade Kit",
                "description": "Upgrades your Neo Grand Bridge to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26E1",
                "toBuildingId": "W_MultiAge_GR26E2",
                "upgradeItemId": "upgrade_kit_GR26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26F1": {
        "baseBuildingId": "W_MultiAge_GR26F1",
        "containedBuildingIds": [
            "W_MultiAge_GR26F1",
            "W_MultiAge_GR26F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26F"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26F",
                "name": "Neo Rosarium Upgrade Kit",
                "description": "Upgrades your Neo Rosarium to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26F1",
                "toBuildingId": "W_MultiAge_GR26F2",
                "upgradeItemId": "upgrade_kit_GR26F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ARTHUR26A1": {
        "baseBuildingId": "W_MultiAge_ARTHUR26A1",
        "containedBuildingIds": [
            "W_MultiAge_ARTHUR26A1",
            "W_MultiAge_ARTHUR26A2",
            "W_MultiAge_ARTHUR26A3",
            "W_MultiAge_ARTHUR26A4",
            "W_MultiAge_ARTHUR26A5",
            "W_MultiAge_ARTHUR26A6",
            "W_MultiAge_ARTHUR26A7",
            "W_MultiAge_ARTHUR26A8",
            "W_MultiAge_ARTHUR26A9",
            "W_MultiAge_ARTHUR26A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ARTHUR26A",
            "silver_upgrade_kit_ARTHUR26A",
            "golden_upgrade_kit_ARTHUR26A",
            "platinum_upgrade_kit_ARTHUR26A",
            "upgrade_kit_ascended_ARTHUR26A"
        ],
        "upgradeItems": {
            "upgrade_kit_ARTHUR26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ARTHUR26A",
                "name": "Camelot Upgrade Kit",
                "description": "Upgrades your Camelot to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_ARTHUR26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_ARTHUR26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_ARTHUR26A",
                "name": "Noble Camelot Silver Upgrade Kit",
                "description": "Upgrades your Camelot to its second best version!",
                "iconAssetName": "silver_upgrade_kit_ARTHUR26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_ARTHUR26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_ARTHUR26A",
                "name": "Royal Camelot Golden Upgrade Kit",
                "description": "Upgrades your Camelot to its best version!",
                "iconAssetName": "golden_upgrade_kit_ARTHUR26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_ARTHUR26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_ARTHUR26A",
                "name": "Crown of Camelot Platinum Upgrade Kit",
                "description": "Upgrades your Camelot to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_ARTHUR26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_ARTHUR26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ARTHUR26A",
                "name": "Pendragon's Throne of Camelot Upgrade Kit",
                "description": "Upgrades your Crown of Camelot to a time limited Pendragon's Throne of Camelot that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ARTHUR26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A1",
                "toBuildingId": "W_MultiAge_ARTHUR26A2",
                "upgradeItemId": "upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A2",
                "toBuildingId": "W_MultiAge_ARTHUR26A3",
                "upgradeItemId": "upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A3",
                "toBuildingId": "W_MultiAge_ARTHUR26A4",
                "upgradeItemId": "upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A4",
                "toBuildingId": "W_MultiAge_ARTHUR26A5",
                "upgradeItemId": "upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A5",
                "toBuildingId": "W_MultiAge_ARTHUR26A6",
                "upgradeItemId": "upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A6",
                "toBuildingId": "W_MultiAge_ARTHUR26A7",
                "upgradeItemId": "silver_upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A7",
                "toBuildingId": "W_MultiAge_ARTHUR26A8",
                "upgradeItemId": "golden_upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A8",
                "toBuildingId": "W_MultiAge_ARTHUR26A9",
                "upgradeItemId": "platinum_upgrade_kit_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26A9",
                "toBuildingId": "W_MultiAge_ARTHUR26A10",
                "upgradeItemId": "upgrade_kit_ascended_ARTHUR26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ARTHUR26B1": {
        "baseBuildingId": "W_MultiAge_ARTHUR26B1",
        "containedBuildingIds": [
            "W_MultiAge_ARTHUR26B1",
            "W_MultiAge_ARTHUR26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_ARTHUR26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_ARTHUR26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ARTHUR26B",
                "name": "Ascended Knights' Round Table Upgrade Kit",
                "description": "Upgrades your Knights' Round Table to a time limited Ascended Knights' Round Table that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ARTHUR26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26B1",
                "toBuildingId": "W_MultiAge_ARTHUR26B2",
                "upgradeItemId": "upgrade_kit_ascended_ARTHUR26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_ARTHUR26C1": {
        "baseBuildingId": "W_MultiAge_ARTHUR26C1",
        "containedBuildingIds": [
            "W_MultiAge_ARTHUR26C1",
            "W_MultiAge_ARTHUR26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_ARTHUR26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_ARTHUR26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_ARTHUR26C",
                "name": "Ascended Sword in the Lake Upgrade Kit",
                "description": "Upgrades your Sword in the Lake to a time limited Ascended Sword in the Lake that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_ARTHUR26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_ARTHUR26C1",
                "toBuildingId": "W_MultiAge_ARTHUR26C2",
                "upgradeItemId": "upgrade_kit_ascended_ARTHUR26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26E1": {
        "baseBuildingId": "W_MultiAge_GBG26E1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26E1",
            "W_MultiAge_GBG26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26E"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26E",
                "name": "Steamworks Depot Upgrade Kit",
                "description": "Upgrades your Steamworks Depot  to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26E1",
                "toBuildingId": "W_MultiAge_GBG26E2",
                "upgradeItemId": "upgrade_kit_GBG26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26F1": {
        "baseBuildingId": "W_MultiAge_GBG26F1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26F1",
            "W_MultiAge_GBG26F2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26F"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26F": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26F",
                "name": "Rail Howitzer Upgrade Kit",
                "description": "Upgrades your Rail Howitzer to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26F",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26F1",
                "toBuildingId": "W_MultiAge_GBG26F2",
                "upgradeItemId": "upgrade_kit_GBG26F",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE26A1": {
        "baseBuildingId": "W_MultiAge_CARE26A1",
        "containedBuildingIds": [
            "W_MultiAge_CARE26A1",
            "W_MultiAge_CARE26A2",
            "W_MultiAge_CARE26A3",
            "W_MultiAge_CARE26A4",
            "W_MultiAge_CARE26A5",
            "W_MultiAge_CARE26A6",
            "W_MultiAge_CARE26A7",
            "W_MultiAge_CARE26A8",
            "W_MultiAge_CARE26A9"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CARE26A",
            "silver_upgrade_kit_CARE26A",
            "golden_upgrade_kit_CARE26A"
        ],
        "upgradeItems": {
            "upgrade_kit_CARE26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CARE26A",
                "name": "Purifier Post Upgrade Kit",
                "description": "Upgrades your Purifier Post to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CARE26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_CARE26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_CARE26A",
                "name": "Purifier Tower Silver Upgrade Kit",
                "description": "Upgrades your Purifier Post to its second best version!",
                "iconAssetName": "silver_upgrade_kit_CARE26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_CARE26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_CARE26A",
                "name": "Purifier Apex Golden Upgrade Kit",
                "description": "Upgrades your Purifier Post to its best version!",
                "iconAssetName": "golden_upgrade_kit_CARE26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A1",
                "toBuildingId": "W_MultiAge_CARE26A2",
                "upgradeItemId": "upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A2",
                "toBuildingId": "W_MultiAge_CARE26A3",
                "upgradeItemId": "upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A3",
                "toBuildingId": "W_MultiAge_CARE26A4",
                "upgradeItemId": "upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A4",
                "toBuildingId": "W_MultiAge_CARE26A5",
                "upgradeItemId": "upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A5",
                "toBuildingId": "W_MultiAge_CARE26A6",
                "upgradeItemId": "upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A6",
                "toBuildingId": "W_MultiAge_CARE26A7",
                "upgradeItemId": "upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A7",
                "toBuildingId": "W_MultiAge_CARE26A8",
                "upgradeItemId": "silver_upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26A8",
                "toBuildingId": "W_MultiAge_CARE26A9",
                "upgradeItemId": "golden_upgrade_kit_CARE26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE26B1": {
        "baseBuildingId": "W_MultiAge_CARE26B1",
        "containedBuildingIds": [
            "W_MultiAge_CARE26B1",
            "W_MultiAge_CARE26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_CARE26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_CARE26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CARE26B",
                "name": "Ascended Field of Recycling Drones Upgrade Kit ",
                "description": "Upgrades your Field of Recycling Drones to a time limited Ascended Field of Recycling Drones that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CARE26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26B1",
                "toBuildingId": "W_MultiAge_CARE26B2",
                "upgradeItemId": "upgrade_kit_ascended_CARE26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE26C1": {
        "baseBuildingId": "W_MultiAge_CARE26C1",
        "containedBuildingIds": [
            "W_MultiAge_CARE26C1",
            "W_MultiAge_CARE26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_CARE26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_CARE26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_CARE26C",
                "name": "Ascended Terra Brew Lodge Upgrade Kit ",
                "description": "Upgrades your Terra Brew Lodge to a time limited Ascended Terra Brew Lodge that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_CARE26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26C1",
                "toBuildingId": "W_MultiAge_CARE26C2",
                "upgradeItemId": "upgrade_kit_ascended_CARE26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CARE26E1": {
        "baseBuildingId": "W_MultiAge_CARE26E1",
        "containedBuildingIds": [
            "W_MultiAge_CARE26E1",
            "W_MultiAge_CARE26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CARE26E"
        ],
        "upgradeItems": {
            "upgrade_kit_CARE26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CARE26E",
                "name": "Terrafarm Center Upgrade Kit ",
                "description": "Upgrades your Terrafarm Center to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CARE26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CARE26E1",
                "toBuildingId": "W_MultiAge_CARE26E2",
                "upgradeItemId": "upgrade_kit_CARE26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP22B1": {
        "baseBuildingId": "W_MultiAge_CUP22B1",
        "containedBuildingIds": [
            "W_MultiAge_CUP22B1",
            "W_MultiAge_CUP22B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CUP22B"
        ],
        "upgradeItems": {
            "upgrade_kit_CUP22B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CUP22B",
                "name": "Flower Trail Upgrade Kit",
                "description": "Upgrades your Flower Path to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CUP22B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22B1",
                "toBuildingId": "W_MultiAge_CUP22B2",
                "upgradeItemId": "upgrade_kit_CUP22B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP22C1": {
        "baseBuildingId": "W_MultiAge_CUP22C1",
        "containedBuildingIds": [
            "W_MultiAge_CUP22C1",
            "W_MultiAge_CUP22C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CUP22C"
        ],
        "upgradeItems": {
            "upgrade_kit_CUP22C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CUP22C",
                "name": "Wheat Trail Upgrade Kit",
                "description": "Upgrades your Wheat Path to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CUP22C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22C1",
                "toBuildingId": "W_MultiAge_CUP22C2",
                "upgradeItemId": "upgrade_kit_CUP22C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP22D1": {
        "baseBuildingId": "W_MultiAge_CUP22D1",
        "containedBuildingIds": [
            "W_MultiAge_CUP22D1",
            "W_MultiAge_CUP22D2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CUP22D"
        ],
        "upgradeItems": {
            "upgrade_kit_CUP22D": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CUP22D",
                "name": "Olive Trail Upgrade Kit",
                "description": "Upgrades your Olive Path to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CUP22D",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22D1",
                "toBuildingId": "W_MultiAge_CUP22D2",
                "upgradeItemId": "upgrade_kit_CUP22D",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_CUP22E1": {
        "baseBuildingId": "W_MultiAge_CUP22E1",
        "containedBuildingIds": [
            "W_MultiAge_CUP22E1",
            "W_MultiAge_CUP22E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_CUP22E"
        ],
        "upgradeItems": {
            "upgrade_kit_CUP22E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_CUP22E",
                "name": "Rocky Trail Upgrade Kit",
                "description": "Upgrades your Rocky Path to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_CUP22E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_CUP22E1",
                "toBuildingId": "W_MultiAge_CUP22E2",
                "upgradeItemId": "upgrade_kit_CUP22E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26G1": {
        "baseBuildingId": "W_MultiAge_GR26G1",
        "containedBuildingIds": [
            "W_MultiAge_GR26G1",
            "W_MultiAge_GR26G2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26G"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26G": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26G",
                "name": "Neo Bus Upgrade Kit",
                "description": "Upgrades your Neo Bus to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26G",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26G1",
                "toBuildingId": "W_MultiAge_GR26G2",
                "upgradeItemId": "upgrade_kit_GR26G",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GR26H1": {
        "baseBuildingId": "W_MultiAge_GR26H1",
        "containedBuildingIds": [
            "W_MultiAge_GR26H1",
            "W_MultiAge_GR26H2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GR26H"
        ],
        "upgradeItems": {
            "upgrade_kit_GR26H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GR26H",
                "name": "Neo Glider Upgrade Kit",
                "description": "Upgrades your Neo Glider to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GR26H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GR26H1",
                "toBuildingId": "W_MultiAge_GR26H2",
                "upgradeItemId": "upgrade_kit_GR26H",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL26A1": {
        "baseBuildingId": "W_MultiAge_FALL26A1",
        "containedBuildingIds": [
            "W_MultiAge_FALL26A1",
            "W_MultiAge_FALL26A2",
            "W_MultiAge_FALL26A3",
            "W_MultiAge_FALL26A4",
            "W_MultiAge_FALL26A5",
            "W_MultiAge_FALL26A6",
            "W_MultiAge_FALL26A7",
            "W_MultiAge_FALL26A8",
            "W_MultiAge_FALL26A9",
            "W_MultiAge_FALL26A10"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL26A",
            "silver_upgrade_kit_FALL26A",
            "golden_upgrade_kit_FALL26A"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL26A",
                "name": "Momiji Stop Upgrade Kit",
                "description": "Upgrades your Momiji Stop to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_FALL26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_FALL26A",
                "name": "Momiji Station Silver Upgrade Kit",
                "description": "Upgrades your Momiji Stop to its second best version!",
                "iconAssetName": "silver_upgrade_kit_FALL26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_FALL26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_FALL26A",
                "name": "Momiji Terminal Golden Upgrade Kit",
                "description": "Upgrades your Momiji Stop to its best version!",
                "iconAssetName": "golden_upgrade_kit_FALL26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A1",
                "toBuildingId": "W_MultiAge_FALL26A2",
                "upgradeItemId": "upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A2",
                "toBuildingId": "W_MultiAge_FALL26A3",
                "upgradeItemId": "upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A3",
                "toBuildingId": "W_MultiAge_FALL26A4",
                "upgradeItemId": "upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A4",
                "toBuildingId": "W_MultiAge_FALL26A5",
                "upgradeItemId": "upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A5",
                "toBuildingId": "W_MultiAge_FALL26A6",
                "upgradeItemId": "upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A6",
                "toBuildingId": "W_MultiAge_FALL26A7",
                "upgradeItemId": "upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A7",
                "toBuildingId": "W_MultiAge_FALL26A8",
                "upgradeItemId": "upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A8",
                "toBuildingId": "W_MultiAge_FALL26A9",
                "upgradeItemId": "silver_upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26A9",
                "toBuildingId": "W_MultiAge_FALL26A10",
                "upgradeItemId": "golden_upgrade_kit_FALL26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL26B1": {
        "baseBuildingId": "W_MultiAge_FALL26B1",
        "containedBuildingIds": [
            "W_MultiAge_FALL26B1",
            "W_MultiAge_FALL26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FALL26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FALL26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FALL26B",
                "name": "Ascended Koyo Treat Upgrade Kit",
                "description": "Upgrades your Koyo Treat to a time limited Ascended Koyo Treat that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FALL26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26B1",
                "toBuildingId": "W_MultiAge_FALL26B2",
                "upgradeItemId": "upgrade_kit_ascended_FALL26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL26C1": {
        "baseBuildingId": "W_MultiAge_FALL26C1",
        "containedBuildingIds": [
            "W_MultiAge_FALL26C1",
            "W_MultiAge_FALL26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_FALL26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_FALL26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_FALL26C",
                "name": "Ascended Kinoko Stage Upgrade Kit ",
                "description": "Upgrades your Kinoko Stage to a time limited Ascended Kinoko Stage that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_FALL26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26C1",
                "toBuildingId": "W_MultiAge_FALL26C2",
                "upgradeItemId": "upgrade_kit_ascended_FALL26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_FALL26E1": {
        "baseBuildingId": "W_MultiAge_FALL26E1",
        "containedBuildingIds": [
            "W_MultiAge_FALL26E1",
            "W_MultiAge_FALL26E2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_FALL26E"
        ],
        "upgradeItems": {
            "upgrade_kit_FALL26E": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_FALL26E",
                "name": "Ramen Nook Upgrade Kit ",
                "description": "Upgrades your Ramen Nook to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_FALL26E",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_FALL26E1",
                "toBuildingId": "W_MultiAge_FALL26E2",
                "upgradeItemId": "upgrade_kit_FALL26E",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26G1": {
        "baseBuildingId": "W_MultiAge_GBG26G1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26G1",
            "W_MultiAge_GBG26G2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26G"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26G": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26G",
                "name": "Steelport Warship Upgrade Kit",
                "description": "Upgrades your Steelport Warship to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26G",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26G1",
                "toBuildingId": "W_MultiAge_GBG26G2",
                "upgradeItemId": "upgrade_kit_GBG26G",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_GBG26H1": {
        "baseBuildingId": "W_MultiAge_GBG26H1",
        "containedBuildingIds": [
            "W_MultiAge_GBG26H1",
            "W_MultiAge_GBG26H2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_GBG26H"
        ],
        "upgradeItems": {
            "upgrade_kit_GBG26H": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_GBG26H",
                "name": "Steelport Silo Upgrade Kit",
                "description": "Upgrades your Steelport Silo to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_GBG26H",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_GBG26H1",
                "toBuildingId": "W_MultiAge_GBG26H2",
                "upgradeItemId": "upgrade_kit_GBG26H",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN26A1": {
        "baseBuildingId": "W_MultiAge_WIN26A1",
        "containedBuildingIds": [
            "W_MultiAge_WIN26A1",
            "W_MultiAge_WIN26A2",
            "W_MultiAge_WIN26A3",
            "W_MultiAge_WIN26A4",
            "W_MultiAge_WIN26A5",
            "W_MultiAge_WIN26A6",
            "W_MultiAge_WIN26A7",
            "W_MultiAge_WIN26A8",
            "W_MultiAge_WIN26A9",
            "W_MultiAge_WIN26A10",
            "W_MultiAge_WIN26A11",
            "W_MultiAge_WIN26A12a",
            "W_MultiAge_WIN26A12b"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_WIN26A",
            "silver_upgrade_kit_WIN26A",
            "golden_upgrade_kit_WIN26A",
            "platinum_upgrade_kit_WIN26A",
            "upgrade_kit_ascended_WIN26A"
        ],
        "upgradeItems": {
            "upgrade_kit_WIN26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_WIN26A",
                "name": "WIN26A Upgrade Kit",
                "description": "Upgrades your WIN26A to an improved version that will produce more resources",
                "iconAssetName": "upgrade_kit_WIN26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "silver_upgrade_kit_WIN26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "silver_upgrade_kit_WIN26A",
                "name": "WIN26A Silver Silver Upgrade Kit",
                "description": "Upgrades your WIN26A to its second best version!",
                "iconAssetName": "silver_upgrade_kit_WIN26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "golden_upgrade_kit_WIN26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "golden_upgrade_kit_WIN26A",
                "name": "WIN26A Gold Golden Upgrade Kit",
                "description": "Upgrades your WIN26A to its best version!",
                "iconAssetName": "golden_upgrade_kit_WIN26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "platinum_upgrade_kit_WIN26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "platinum_upgrade_kit_WIN26A",
                "name": "WIN26A Platinum Platinum Upgrade Kit",
                "description": "Upgrades your WIN26A to an even better version!",
                "iconAssetName": "platinum_upgrade_kit_WIN26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            },
            "upgrade_kit_ascended_WIN26A": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN26A",
                "name": "WIN26A Platinum Ascended Upgrade Kit",
                "description": "Upgrades your WIN26A Platinum to a time limited WIN26A Platinum Ascended that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN26A",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A1",
                "toBuildingId": "W_MultiAge_WIN26A2",
                "upgradeItemId": "upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 1,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A2",
                "toBuildingId": "W_MultiAge_WIN26A3",
                "upgradeItemId": "upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 2,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A3",
                "toBuildingId": "W_MultiAge_WIN26A4",
                "upgradeItemId": "upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 3,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A4",
                "toBuildingId": "W_MultiAge_WIN26A5",
                "upgradeItemId": "upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 4,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A5",
                "toBuildingId": "W_MultiAge_WIN26A6",
                "upgradeItemId": "upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 5,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A6",
                "toBuildingId": "W_MultiAge_WIN26A7",
                "upgradeItemId": "upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 6,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A7",
                "toBuildingId": "W_MultiAge_WIN26A8",
                "upgradeItemId": "upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 7,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A8",
                "toBuildingId": "W_MultiAge_WIN26A9",
                "upgradeItemId": "silver_upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 8,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A9",
                "toBuildingId": "W_MultiAge_WIN26A10",
                "upgradeItemId": "golden_upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 9,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A10",
                "toBuildingId": "W_MultiAge_WIN26A11",
                "upgradeItemId": "platinum_upgrade_kit_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A11",
                "toBuildingId": "W_MultiAge_WIN26A12a",
                "upgradeItemId": "upgrade_kit_ascended_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            },
            {
                "stepIndex": 10,
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26A11",
                "toBuildingId": "W_MultiAge_WIN26A12b",
                "upgradeItemId": "upgrade_kit_ascended_WIN26A",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN26B1": {
        "baseBuildingId": "W_MultiAge_WIN26B1",
        "containedBuildingIds": [
            "W_MultiAge_WIN26B1",
            "W_MultiAge_WIN26B2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WIN26B"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WIN26B": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN26B",
                "name": "Ascended WIN26B Upgrade Kit",
                "description": "Upgrades your WIN26B to a time limited Ascended WIN26B that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN26B",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26B1",
                "toBuildingId": "W_MultiAge_WIN26B2",
                "upgradeItemId": "upgrade_kit_ascended_WIN26B",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    },
    "W_MultiAge_WIN26C1": {
        "baseBuildingId": "W_MultiAge_WIN26C1",
        "containedBuildingIds": [
            "W_MultiAge_WIN26C1",
            "W_MultiAge_WIN26C2"
        ],
        "containedUpgradeItemIds": [
            "upgrade_kit_ascended_WIN26C"
        ],
        "upgradeItems": {
            "upgrade_kit_ascended_WIN26C": {
                "type": "consumable",
                "subType": "upgrade_kit",
                "amount": 1,
                "id": "upgrade_kit_ascended_WIN26C",
                "name": "Ascended WIN26C Upgrade Kit",
                "description": "Upgrades your WIN26C to a time limited Ascended WIN26C that will produce more resources. When the time expires, the building reverts to its previous state.",
                "iconAssetName": "upgrade_kit_ascended_WIN26C",
                "flags": [
                    "epic"
                ],
                "boostValue": 1,
                "__class__": "GenericReward"
            }
        },
        "upgradeSteps": [
            {
                "optionIndex": -1,
                "fromBuildingId": "W_MultiAge_WIN26C1",
                "toBuildingId": "W_MultiAge_WIN26C2",
                "upgradeItemId": "upgrade_kit_ascended_WIN26C",
                "__class__": "BuildingUpgradePathStep"
            }
        ],
        "__class__": "BuildingUpgradePath"
    }
} */