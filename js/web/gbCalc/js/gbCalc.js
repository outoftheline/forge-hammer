{

    let GBList = {};
    const goldenGBs = ['X_SS_AllAge_EasterBonus4','X_SS_BronzeAge_Landmark2','X_SS_IronAge_Landmark1','X_SS_EarlyMiddleAge_Landmark2','X_HighMiddleAge_Landmark1','X_SS_LateMiddleAge_Landmark3','X_SS_ColonialAge_Landmark2','X_IndustrialAge_Landmark1','X_ProgressiveEra_Landmark1','X_ProgressiveEra_Landmark2','X_ContemporaryEra_Landmark1','X_FutureEra_Landmark1','X_ArcticFuture_Landmark2','X_ArcticFuture_Landmark3','X_SS_OceanicFuture_Landmark2','X_SS_OceanicFuture_Landmark3','X_VirtualFuture_Landmark1','X_VirtualFuture_Landmark2','X_SpaceAgeMars_Landmark2','X_SpaceAgeAsteroidBelt_Landmark1','X_StellarAgeDiscovery_Landmark1'];

    // other player's city loaded
    FH.proxy.addHandler('OtherPlayerService', 'visitPlayer', (data, postData) => {
		let GBs  = data.responseData.city_map.entities.filter(x=>x.type=="greatbuilding");
        GBList = Object.assign(GBList, ...GBs.map(x => ({[x.player_id+ '_' + x.id]:x})));
	});
    // own city loaded
    FH.proxy.addHandler('CityMapService', 'getEntities', (data, postData) => {
		let GBs  = data.responseData.filter(x=>x.type=="greatbuilding");
        GBList = Object.assign(GBList, ...GBs.map(x => ({[x.player_id+ '_' + x.id]:x})));
	});
    FH.proxy.addHandler('StartupService', 'getData', (data, postData) => {
		let GBs  = data.responseData.city_map.entities.filter(x=>x.type=="greatbuilding");
        GBList = Object.assign(GBList, ...GBs.map(x => ({[x.player_id+ '_' + x.id]:x})));
	});
    FH.proxy.addHandler('CityMapService', 'updateEntity', (data, postData) => {
		let GBs  = data.responseData.filter(x=>x.type=="greatbuilding");
        GBList = Object.assign(GBList, ...GBs.map(x => ({[x.player_id+ '_' + x.id]:x})));
	});
    //own GB leveled up by other player while opened
    FH.proxy.addWsHandler('CityMapService', 'updateEntity', data => {
        let GBs  = data.responseData.filter(x=>x.type=="greatbuilding");
        GBList = Object.assign(GBList, ...GBs.map(x => ({[x.player_id+ '_' + x.id]:x})));
    });
    // any player GB opened
    FH.proxy.addHandler('OtherPlayerService', 'getOtherPlayerCityMapEntity', (data, postData) => {
		let x = data.responseData;
        if (x.type!="greatbuilding") return;
        GBList[x.player_id+ '_' + x.id] = x;
	});
    // any player GB list loaded
    FH.proxy.addHandler('GreatBuildingsService', 'getOtherPlayerOverview', (data, postData) => {
		data.responseData.forEach(x=>{
            let id= x.player.player_id + '_' + x.entity_id;
            if (GBList[id]) {
                GBList[id].state.invested_forge_points = x.current_progress;
                GBList[id].state.forge_points_for_level_up = x.max_progress;
                GBList[id].level = x.level;
                GBList[id].max_level = x.maxLevel || GBList[id].max_level;
                GBList[id].tier = x.currentTier?.value || 'copper';
            }
        })
	});
   // FP payed into (own) GB
    FH.proxy.addHandler('CityMapService', 'reset', (data, postData) => {
		let x = data.responseData[0];
        if (x.type!="greatbuilding") return;
        GBList[x.player_id+ '_' + x.id] = x;
	});

    function getGB(player_id, entity_id) {
        let id = player_id + '_' + entity_id;
        return GBList[id];
    };

    FH.GBCalc = {getGB: getGB};

}
