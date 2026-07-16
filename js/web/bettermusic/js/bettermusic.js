
/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

FH.proxy.addHandler('AnnouncementsService', 'fetchAllAnnouncements', (data, postData) => {
    //on startUp
    let first = false;
    if ($('#betterMusic1').length === 0) {
        
        let newSound = document.createElement("audio");
        newSound.id = "betterMusic1";
        newSound.volume = 0;
        newSound.loop = true;
        newSound.onloadedmetadata = function () {FH.betterMusic.setEvent(id="betterMusic1")}
        $('#game_body').append(newSound);
        FH.betterMusic.Ids.push(newSound.id);
        
        let newSound2 = document.createElement("audio");
        newSound2.id = "betterMusic2";
        newSound2.volume = 0;
        newSound2.loop = true;
        newSound2.onloadedmetadata = function () {FH.betterMusic.setEvent(id="betterMusic2")}
        $('#game_body').append(newSound2);
        FH.betterMusic.Ids.push(newSound2.id);
        
        let newSound3 = document.createElement("audio");
        newSound3.id = "betterMusic3";
        newSound3.volume = 0;
        newSound3.loop = true;
        newSound3.onloadedmetadata = function () {FH.betterMusic.setEvent(id="betterMusic3")}
        $('#game_body').append(newSound3);
        FH.betterMusic.Ids.push(newSound3.id);
        
        FH.betterMusic.loadSettings();
        
        FH.betterMusic.playStatus = FH.betterMusic.Settings.PlayOnStart;
        if (!FH.betterMusic.playStatus) FH.betterMusic.pause();
        
        FH.betterMusic.buildlists();
        first = true;

        
    }
    
    if (!first) FH.betterMusic.setScene("main");

});

FH.proxy.addHandler('CampaignService', 'start', (data, postData) => {
       
    FH.betterMusic.setScene("map");
    
});

FH.proxy.addHandler('CityMapService', 'getCityMap', (data, postData) => {
    
    if (!data.responseData?.gridId) return;
    
    switch (data.responseData.gridId) {
        case "cultural_outpost":
            FH.betterMusic.setScene("settlement");
            break;
        case "era_outpost":
            FH.betterMusic.setScene("colony");
            break;
    }
   
});

FH.proxy.addHandler('CityMapService', 'getEntities', (data, postData) => {

    FH.betterMusic.setScene("main");   

});

FH.proxy.addHandler('GuildBattlegroundService', 'getBattleground', (data, postData) => {
       
    FH.betterMusic.setScene("gbg");
    
});

FH.proxy.addHandler('GuildExpeditionService', 'getOverview', (data, postData) => {
       
    FH.betterMusic.setScene("ge");
    
});
FH.proxy.addHandler('BattlefieldService', 'startByBattleType', (data, postData) => {
    if (!data.responseData.map) return;
    FH.betterMusic.setScene("battle");
    
});

FH.proxy.addHandler('PVPArenaService', 'getOverview', (data, postData) => {
       
    if (FH.betterMusic.Settings.Pvp) FH.betterMusic.setScene("foe_music_pvp_arena");
    
});

FH.proxy.addHandler('GrandPrizeService', 'getGrandPrizes', (data, postData) => {

    Eventname = data.responseData[0].context;
    
    if (!FH.betterMusic.Settings.Events) return;
    
    for (t in FH.betterMusic.PossibleTracks) {
        if (FH.betterMusic.PossibleTracks[t].Event != Eventname) continue;
        return FH.betterMusic.setScene(t);
    };
    
});
FH.proxy.addHandler('EventPassService', 'getPreview', (data, postData) => {

    Eventname = data.responseData?.teaserPrizes?.context;
    
    if (!FH.betterMusic.Settings.Events) return;
    
    for (t in FH.betterMusic.PossibleTracks) {
        if (FH.betterMusic.PossibleTracks[t].Event != Eventname) continue;
        return FH.betterMusic.setScene(t);
    };
    
});

FH.proxy.addHandler('FriendsTavernService', 'getConfig', (data, postData) => {
       
    if (FH.betterMusic.Settings.Tavern) FH.betterMusic.setScene("foe_music_tavern");
    
});

$('#game_body').click(function () {
    if (!FH.betterMusic.first || $('#betterMusic1').length === 0) return;
    FH.betterMusic.first = false;
    FH.betterMusic.TrackSelector();
})
$('#game_body').contextmenu(function () {
    if (!FH.betterMusic.first || $('#betterMusic1').length === 0) return;
    FH.betterMusic.first = false;
    FH.betterMusic.TrackSelector();
})
$('#game_body').keydown(function () {
    if (!FH.betterMusic.first || $('#betterMusic1').length === 0) return;
    FH.betterMusic.first = false;
    FH.betterMusic.TrackSelector();
})


FH.betterMusic = {

    first: true,
    NextEvent: null,
    Ids: [],
    currentId: "",
    nextId: "",
    currentTitle: "",
    currentScene:"main",
    Settings: {
        Volume: 1,
        TransitionTime: 5000,
        Finish: false,
        Tavern: true,
        Events: true,
        Pvp: true,
        PlayOnStart: false,
        MainCity: 2,
        Colony: 2,
        IgnoreSettlement: false,
        Scenes: {
            "main": {
                "FoE_CityTrack_Vs2": true,
                "foe_music_hma_to_col_1_vs2": true,
                "foe_music_ind_to_pro_1_vs1": true,
                "foe_music_tmr_to_fut": true,
                "foe_music_asteroid_belt_city": true,
                "foe_music_jupiter_moon_city": true,
                "foe_music_tavern": true,
                "foe_music_stpatricks_v2": true,
                "foe_music_anniversary": true,
                "foe_music_history":true
            },
            "settlement": {
                "foe_music_expedition": true,
                "foe_music_archeology": true,
                "foe_music_summer": true,
                "foe_music_vikings": true,
                "foe_music_japanese": true,
                "foe_music_egyptians": true,
                "foe_music_aztecs": true,
                "foe_music_mughals": true,
                "foe_music_polynesia":true
            },
            "colony": {
                "foe_music_mars": true,
                "foe_music_asteroid_belt": true,
                "foe_music_venus": true,
                "foe_music_jupiter_moon": true
            },
            "ge": {
                "foe_music_expedition": true,
                "foe_music_wildlife": true,
                "foe_music_archeology": true,
                "foe_music_aztecs": true,
                "foe_music_mughals": true,
                "foe_music_polynesia":true
            },
            "gbg": {
                "foe_music_expedition": true,
                "foe_music_battlegrounds": true,
                "foe_music_pvp_arena": true,
                "FoE_BattleTheme_Vs1": true,
                "foe_music_polynesia":true
            },
            "battle": {
                "foe_music_battlegrounds": true,
                "foe_music_pvp_arena": true,
                "FoE_BattleTheme_Vs1": true,
                "foe_music_egyptians": true
            },
            "map": {
                "FoE_CityTrack_Vs2": true,
                "foe_music_hma_to_col_1_vs2": true,
                "foe_music_ind_to_pro_1_vs1": true,
                "foe_music_tmr_to_fut": true,
                "foe_music_mars": true,
                "foe_music_asteroid_belt_city": true,
                "foe_music_asteroid_belt": true,
                "foe_music_venus": true,
                "foe_music_jupiter_moon_city": true,
                "foe_music_jupiter_moon": true,
                "foe_music_tavern": true,
                "foe_music_archeology": true,
                "foe_music_summer": true
            }
        }
    },
    playStatus: false,
    Scenes: {
        "main": {Name: FH.t('Boxes.BetterMusic.Main'), TitleList: []},
        "settlement":{Name: FH.t('Boxes.BetterMusic.Settlement'), TitleList: []},
        "colony":{Name: FH.t('Boxes.BetterMusic.Colony'), TitleList: []},
        "ge":{Name: FH.t('Boxes.BetterMusic.GE'), TitleList: []},
        "gbg":{Name: FH.t('Boxes.BetterMusic.GBG'), TitleList: []},
        "battle":{Name: FH.t('Boxes.BetterMusic.Battle'), TitleList: []},
        "map":{Name: FH.t('Boxes.BetterMusic.Map'), TitleList: []},
    },
    PossibleTracks: {
        "FoE_CityTrack_Vs2": {Volume:1, Name:"Stone Age - Early Middle Ages", Age:1, Agelimit: 4},
        "foe_music_hma_to_col_1_vs2": {Volume:1, Name:"High middle Ages - Colonial Age", Age:5, Agelimit: 7},
        "foe_music_ind_to_pro_1_vs1": {Volume:1, Name:"Industrial Age - Contemporary Era", Age:8, Agelimit: 12},
        "foe_music_tmr_to_fut": {Volume:1, Name:"Tomorrow Era - Space Age Mars", Age:13, Agelimit: 18},
        "foe_music_future_2_vs1": {Volume:1, Name:"Future 2", Age:14, Agelimit: 14},
        "foe_music_mars": {Volume:1, Name:"Space Age Mars (Colony)", Age:18, Agelimit: 18, Outpost: true},
        "foe_music_asteroid_belt_city": {Volume:1, Name:"Space Age Asteroid Belt - Space Age Venus", Age:19, Agelimit: 20},
        "foe_music_asteroid_belt": {Volume:1, Name:"Space Age Asteroid Belt (Colony)", Age:19, Agelimit: 19, Outpost: true},
        "foe_music_venus": {Volume:1, Name:"Space Age Venus (Colony)", Age:20, Agelimit: 20, Outpost: true},
        "foe_music_jupiter_moon_city": {Volume:1, Name:"Space Age Jupiter Moon", Age:21, Agelimit: 21},
        "foe_music_jupiter_moon": {Volume:1, Name:"Space Age Jupiter Moon (Colony)", Age:21, Agelimit: 22, Outpost: true},
        "foe_music_titan": {Volume:1, Name:"Space Age Titan", Age:22, Agelimit: 22},
        "foe_music_space_hub": {Volume:1, Name:"Space Age Space Hub", Age:23, Agelimit: 23},
        "foe_music_discovery": {Volume:1, Name:"Stellar Age Discovery", Age:24, Agelimit: 30},
        "foe_music_tavern": {Volume:.7, Name:"Tavern"},
        "foe_music_expedition": {Volume:.7, Name:"Guild Expedition"},
        "foe_music_battlegrounds": {Volume:.7, Name:"Guild Battlegrounds"},
        "foe_music_pvp_arena": {Volume:.6, Name:"PvP Arena"},
        "FoE_BattleTheme_Vs1": {Volume:.7, Name:"Battle Theme"},
        "foe_music_stpatricks_v2": {Volume:.6, Name:"St Patricks Day Event", Event:"st_patricks_event"},
        "age23_background_music": {Volume:.6, Name:"Anniversary Event", Event:"anniversary_event"},
        "foe_music_anniversary": {Volume:.5, Name:"Ages Event", Event:"forge_ages_event"},
        "foe_music_wildlife": {Volume:.6, Name:"Wildlife Event", Event:"wildlife_event"},
        "foe_music_archeology": {Volume:.6, Name:"Archaeology  Event", Event:"archeology_event"},
        "foe_music_hero": {Volume:.6, Name:"Fellowship Event 22", Event:"hero_event"},
        "cup23_background_music": {Volume:.6, Name:"Soccer Event", Event:"soccer_event"},
        "foe_music_fellowship": {Volume:.6, Name:"Fellowship Event 23", Event:"fellowship_event"},
        "foe_music_history": {Volume:.6, Name:"History Event", Event:"history_event"},
        "foe_music_care": {Volume:.6, Name:"Care Event", Event:"care_event"},
        "foe_music_summer": {Volume:.7, Name:"Summer Event", Event:"summer_event"},
        "foe_music_fall": {Volume:.7, Name:"Fall Event", Event:"fall_event"},
        "foe_music_halloween": {Volume:.6, Name:"Halloween Event", Event:"halloween_event"},
        "foe_music_winter": {Volume:.6, Name:"Winter Event", Event:"winter_event"},
        "foe_music_vikings": {Volume:1, Name:"Viking Settlement", Settlement:"vikings"},
        "foe_music_japanese": {Volume:1, Name:"Japanese Settlement", Settlement:"japanese"},
        "foe_music_egyptians": {Volume:1, Name:"Egypt Settlement", Settlement:"egyptians"},
        "foe_music_aztecs": {Volume:1, Name:"Aztec Settlement", Settlement:"aztecs"},
        "foe_music_mughals": {Volume:1, Name:"Mughal Settlement", Settlement:"mughals"},
        "foe_music_polynesia": {Volume:1, Name:"Polynesia Settlement", Settlement:"polynesia"},
        "foe_music_pirates": {Volume:1, Name:"Pirates Settlement", Settlement:"pirates"},
    },

    
    /**
     * Shows a box for testing sound playback
     *
     * @constructor
     */
    ShowDialog: () => {

                
        let htmltext = `<div class="flex">`;
        htmltext += `<div id="musicSettingsGeneral" class="musicSettings"><h1>${FH.t('Boxes.BetterMusic.GeneralSettings')}</h1>`;
        htmltext += `<label for="musicSettingsVolume">${FH.t('Boxes.BetterMusic.Volume')} <input id="musicSettingsVolume" type="range" min="0" max="1" step ="0.05" value="${FH.betterMusic.Settings.Volume}" oninput="FH.betterMusic.newVolume(Number(this.value))"></label> <br>`;
        htmltext += `<input id="musicSettingsPlayOnClose" type="checkbox" ${FH.betterMusic.Settings.PlayOnStart ? 'checked="checked"' : ''}" oninput="FH.betterMusic.Settings.PlayOnStart = this.checked"><label for="musicSettingsPlayOnClose">${FH.t('Boxes.BetterMusic.Auto')}</label></div>`;
        
        htmltext += `<div id="musicSettingsTitle" class="musicSettings"><h1>${FH.t('Boxes.BetterMusic.TitleSettings')}</h1>`;
        htmltext += `<label for="musicSettingsTransitionTime">${FH.t('Boxes.BetterMusic.Transition')} <input id="musicSettingsTransitionTime" type="range" min="0" max="5000" step ="500" value="${FH.betterMusic.Settings.TransitionTime}" oninput="FH.betterMusic.Settings.TransitionTime = Number(this.value)"></label><br>`;
        htmltext += `<input id="musicSettingsFinish" type="checkbox" ${FH.betterMusic.Settings.Finish ? 'checked="checked"' : ''}" oninput="FH.betterMusic.Settings.Finish = this.checked"><label for="musicSettingsFinish">${FH.t('Boxes.BetterMusic.Finish')}</label></div>`;
        htmltext += `</div>`;

        htmltext += `<div id="musicSettingsScenes" class="musicSettings"><h1 class="text-center">${FH.t('Boxes.BetterMusic.SceneSettings')}</h1>`
        htmltext += `<div class="flex">`;
        htmltext += `<div class="text-right">`;
        htmltext += `<label for="musicSettingsMainCity">${FH.t('Boxes.BetterMusic.InCity')} </label><select id="musicSettingsMainCity" type="select" oninput="FH.betterMusic.Settings.MainCity = this.selectedIndex"><option value="0" ${FH.betterMusic.Settings.MainCity === 0 ? 'selected="selected"': ''}>${FH.t('Boxes.BetterMusic.IgnoreEra')} </option><option value="1" ${FH.betterMusic.Settings.MainCity === 1 ? 'selected="selected"': ''}>${FH.t('Boxes.BetterMusic.ToEra')} </option><option value="2" ${FH.betterMusic.Settings.MainCity === 2 ? 'selected="selected"': ''}>${FH.t('Boxes.BetterMusic.CurrentEra')} </option></select><br>`;
        htmltext += `<label for="musicSettingsColony">${FH.t('Boxes.BetterMusic.InColony')} </label>`;
        htmltext += `<select id="musicSettingsColony" type="select" oninput="FH.betterMusic.Settings.Colony = this.selectedIndex"><option value="0" ${FH.betterMusic.Settings.Colony === 0 ? 'selected="selected"': ''}>${FH.t('Boxes.BetterMusic.IgnoreEra')}</option><option value="1" ${FH.betterMusic.Settings.Colony === 1 ? 'selected="selected"': ''}>${FH.t('Boxes.BetterMusic.ToEra')}</option><option value="2" ${FH.betterMusic.Settings.Colony === 2 ? 'selected="selected"': ''}>${FH.t('Boxes.BetterMusic.CurrentEra')}</option></select>`;
        htmltext += `</div>`;
        htmltext += `<div>`;
        htmltext += `<input id="musicSettingsTavern" type="checkbox" ${FH.betterMusic.Settings.Tavern ? 'checked="checked"' : ''}" oninput="FH.betterMusic.Settings.Tavern = this.checked"><label for="musicSettingsTavern">${FH.t('Boxes.BetterMusic.TavernT')}</label>`;
        htmltext += `<input id="musicSettingsPvp" type="checkbox" ${FH.betterMusic.Settings.Pvp ? 'checked="checked"' : ''}" oninput="FH.betterMusic.Settings.Pvp = this.checked"><label for="musicSettingsPvp">${FH.t('Boxes.BetterMusic.PvPT')}</label>`;
        htmltext += `<input id="musicSettingsIgnoreSettlement" type="checkbox" ${FH.betterMusic.Settings.IgnoreSettlement ? 'checked="checked"' : ''}" oninput="FH.betterMusic.Settings.IgnoreSettlement = this.checked"><label for="musicSettingsIgnoreSettlement">${FH.t('Boxes.BetterMusic.IgnoreSettlement')}</label>`;
        htmltext += `<input id="musicSettingsEvents" type="checkbox" ${FH.betterMusic.Settings.Events ? 'checked="checked"' : ''}" oninput="FH.betterMusic.Settings.Events = this.checked"><label for="musicSettingsEvents">${FH.t('Boxes.BetterMusic.EventT')}</label>`;
        htmltext += `</div>`;
        htmltext += `</div>`;

        htmltext += `<table id="musicSettingsScenesX" class="foe-table"><caption style="font-weight: bold; font-size: initial; padding-top: 10px;">${FH.t('Boxes.BetterMusic.Scenes')}</caption><thead class="sticky">><tr><th>${FH.t('Boxes.BetterMusic.TitleName')}</th>`;
        
        for (let scene in FH.betterMusic.Scenes) {
            htmltext += `<th><span>${FH.betterMusic.Scenes[scene].Name}</span></th>`;
        }
        htmltext += `</tr></thead>`;
        
        for (let title in FH.betterMusic.PossibleTracks) {
            htmltext += `<tr><td class="betterMusicTitle" onclick="FH.betterMusic.switchTrack('${title}', 0)" onmouseout="FH.betterMusic.pause(event)">${FH.betterMusic.PossibleTracks[title].Name}</td>`;
            for (let scene in FH.betterMusic.Scenes) {
                htmltext += `<td class="betterMusicEntry ${FH.betterMusic.testSettings(scene, title) ? 'betterMusicSelected' :'betterMusicNotSelected'}" data-scene="${scene}" data-title="${title}" onclick="FH.betterMusic.setSceneTitle(event)"></td>`;
            }
            htmltext += `</tr>`;
                
        }
        
        htmltext += `</table>`;
        
        if ($('#betterMusicDialog').length === 0) {
            FH.HTML.AddCssFile('bettermusic');
    
            FH.HTML.Box({
                id: 'betterMusicDialog',
                title: FH.t('Boxes.BetterMusic.Title'),
                auto_close: true,
                dragdrop: true,
                minimize: true,
                resize: true,                
            });

            $('#betterMusicDialogclose').on('click', function() {
                FH.betterMusic.close();
                });

            FH.betterMusic.pause();
        }
    
        $('#betterMusicDialogBody').html(htmltext);
    },

    
    playRandom: (titles = Object.keys(FH.betterMusic.PossibleTracks)) => {
        
        if ((titles?.length|0) == 0 ) return;
        
        let title = titles[Math.floor(titles.length * Math.random())];
        
        FH.betterMusic.switchTrack(title);
        
        
    },


    switchTrack: (newTrack, transition = FH.betterMusic.Settings.TransitionTime) => {
        let $SoundC = $(`#${FH.betterMusic.Ids.shift()}`);
        let $SoundN = $(`#${FH.betterMusic.Ids[0]}`);
        let path = srcLinks.get(FH.betterMusic.PossibleTracks[newTrack].Path || '/sounds/shared/theme/'+ newTrack +'.ogg', true)
        if ($SoundC[0].src == path) {
        
            FH.betterMusic.Ids.unshift($SoundC[0].id);
            FH.betterMusic.setEvent($SoundC[0].id, 0);
        
        } else {
            
            let elem = $(`#${FH.betterMusic.Ids[1]}`)[0];
            if (!(!elem)) elem.pause();
            
            FH.betterMusic.Ids.push($SoundC[0].id);
            $SoundC.animate({volume: 0}, transition);
            
            $SoundN[0].volume = 0;
            $SoundN[0].src = path;
            
            clearTimeout(FH.betterMusic.nextEvent);
            var playPromise = $SoundN[0].play();

            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    FH.betterMusic.playStatus = true;
                    FH.betterMusic.currentTitle = newTrack;
                    $SoundN.animate({volume: 1*FH.betterMusic.PossibleTracks[newTrack].Volume*FH.betterMusic.Settings.Volume}, transition);
                })
                .catch(error => {
                    if (error.toString() == "NotSupportedError: Failed to load because no supported source was found.") {
                        console.log(`↑ ↑ ↑ ↑ ${newTrack} banned from playlist ↑ ↑ ↑ ↑ ↑`);
                        if (FH.betterMusic.PossibleTracks[newTrack]) {
                            FH.betterMusic.PossibleTracks[newTrack].banned = true;
                            FH.betterMusic.buildlist(FH.betterMusic.currentScene);
                        }
                    }
                    FH.betterMusic.TrackSelector();
                });
            }

        }
        return;
    },

    pause: (e) => {
        clearTimeout(FH.betterMusic.nextEvent);
        FH.betterMusic.playStatus = false;
        $('#musicControl-Btn').addClass('musicmuted');
        
        if (!(e?.relatedTarget?.classList.contains('betterMusicTitle'))) {
            let elem= $(`#${FH.betterMusic.Ids[0]}`)[0];
            if (!elem) return;
            elem.pause();
            elem.src = "";
        }
    },

    TrackSelector: () => {
        if (!FH.betterMusic.playStatus) return;
        $('#musicControl-Btn').removeClass('musicmuted');
        
        FH.betterMusic.playRandom(FH.betterMusic.Scenes[FH.betterMusic.currentScene].TitleList);    
    },

    setEvent: (id, transition = FH.betterMusic.Settings.TransitionTime) => {
        if (!FH.betterMusic.playStatus) return;
        let $SoundC = $(`#${id}`);
        let timeout = Math.floor($SoundC[0].duration * 1000 - transition);
        if (timeout != 'NaN') {
            clearTimeout(FH.betterMusic.nextEvent);
            FH.betterMusic.nextEvent = setTimeout(function() {FH.betterMusic.TrackSelector()}, timeout);
        }
    },

    setScene: (scene) => {
        
        if (FH.betterMusic.currentTitle == scene) return
        
        if (!FH.betterMusic.Scenes[scene]) {
            if (FH.betterMusic.Settings.Finish) return;
            if (!FH.betterMusic.playStatus) return;
            FH.betterMusic.switchTrack(scene);
            return
        }

        FH.betterMusic.buildlist(scene);
        if (FH.betterMusic.currentScene === scene) return;

        FH.betterMusic.currentScene = scene;
        if (FH.betterMusic.Scenes[scene].TitleList.includes(FH.betterMusic.currentTitle)) return;
        
        if (FH.betterMusic.Settings.Finish) return;
        FH.betterMusic.TrackSelector();
    },

    close: () => {
        FH.betterMusic.saveSettings();
        FH.betterMusic.playStatus = FH.betterMusic.Settings.PlayOnStart;
        FH.betterMusic.TrackSelector()
    },

    CloseBox: () => {
        FH.HTML.CloseOpenBox('betterMusicDialog');
        FH.betterMusic.close();
    },

    newVolume: (value) => {
        FH.betterMusic.Settings.Volume = value;
        $(`#${FH.betterMusic.Ids[0]}`)[0].volume = value;
        
    },
    
    loadSettings: ()=> {

		tempSettings = JSON.parse(FH.Storage.getItem('betterMusicSettings') || '{}');
        if (tempSettings.Scenes) {
            for (let i of Object.keys(tempSettings.Scenes)) {
                if (!FH.betterMusic.Settings.Scenes[i]) delete tempSettings.Scenes[i];
            }
        }
        FH.betterMusic.Settings = FH.betterMusic.update(FH.betterMusic.Settings,tempSettings);
    },
    
    saveSettings: ()=> {
        FH.Storage.setItem('betterMusicSettings', JSON.stringify(FH.betterMusic.Settings));
        FH.betterMusic.buildlists();
    },
    
    update (obj/*, …*/) {
        for (var i=1; i<arguments.length; i++) {
            for (var prop in arguments[i]) {
                var val = arguments[i][prop];
                if (typeof val == "object") // this also applies to arrays or null!
                    FH.betterMusic.update(obj[prop], val);
                else
                    obj[prop] = val;
            }
        }
        return obj;
    },

    setSceneTitle: (e) => {
        e.target.classList.toggle('betterMusicSelected');
        e.target.classList.toggle('betterMusicNotSelected');
        FH.betterMusic.Settings.Scenes[e.target.dataset.scene][e.target.dataset.title] = e.target.classList.contains('betterMusicSelected');
    },

    testSettings: (scene, title) => {
        if (!FH.betterMusic.Settings.Scenes) return false;
        if (!FH.betterMusic.Settings.Scenes[scene]) return false;
        return FH.betterMusic.Settings.Scenes[scene][title] | false;
    },

    buildlists: () => {
        for (scene in FH.betterMusic.Scenes) {
            FH.betterMusic.buildlist(scene);
        }
    },

    buildlist: (scene) => {
        if (!FH.betterMusic.Scenes[scene]) return;
        FH.betterMusic.Scenes[scene].TitleList = [];
        for (title in FH.betterMusic.Settings.Scenes[scene]) {
            if (FH.betterMusic.PossibleTracks[title]?.banned) continue;
            if (scene==="settlement" && (FH.betterMusic.PossibleTracks[title].Settlement != Outposts?.OutpostData?.content) && (FH.betterMusic.PossibleTracks[title].Settlement != undefined) && (!FH.betterMusic.IgnoreSettlement)) continue;
            if (scene==="colony" && (
                ((FH.betterMusic.PossibleTracks[title].Agelimit < FH.CurrentEraID || FH.betterMusic.PossibleTracks[title].Age > FH.CurrentEraID ) && FH.betterMusic.Settings.Colony == 2) ||
                (FH.betterMusic.PossibleTracks[title].Age > FH.CurrentEraID && FH.betterMusic.Settings.Colony == 1)
                )) continue;
            if (scene==="main" && (
                (FH.betterMusic.Settings.MainCity == 2 && (FH.betterMusic.PossibleTracks[title].Agelimit < FH.CurrentEraID || FH.betterMusic.PossibleTracks[title].Age > FH.CurrentEraID )) ||
                (FH.betterMusic.Settings.MainCity == 1 && FH.betterMusic.PossibleTracks[title].Age > FH.CurrentEraID)
                )) continue;
            if (FH.betterMusic.Settings.Scenes[scene][title]) FH.betterMusic.Scenes[scene].TitleList.push(title);
        }
    }

};
