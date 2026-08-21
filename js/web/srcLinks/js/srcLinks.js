/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

let srcLinks = {
    FileList: null,
    raw:null,

    init: async () => {
        // wait for ForgeHX is loaded, then read the full script url
        const isElementLoaded = async name => {
            while ( document.querySelector('script[src*="' + name + '"]') === null) {
                await new Promise( resolve => requestAnimationFrame(resolve))
            }
            return document.querySelector('script[src*="' + name + '"]');
        };

        const script = await isElementLoaded('ForgeHX')
        
        let xhr = new XMLHttpRequest();
        xhr.open("GET", script.src)
        xhr.onreadystatechange = function () {
            if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                srcLinks.raw = xhr.responseText;
                srcLinks.readHX();
            }
        };
        xhr.send();
    },

    readHX: () => {
        let HXscript = srcLinks.raw+"";
        let startString = "baseUrl,";
        let start = HXscript.indexOf(startString) + startString.length;
        HXscript = HXscript.substring(start);

        let end = HXscript.indexOf("}")+1;
        HXscript = HXscript.substring(0, end);

        try {
            srcLinks.FileList = JSON.parse(HXscript);

            // ExtPlayerId is not available on this point
            let c = FH.Storage.getItem('current_player_id');

        } 
        catch {
            console.log("parsing of ForgeHX failed");
        }
    },

    get: (filename, full = false, noerror = false) => {
        let CS = undefined;
        let filenameP = filename.split(".");
        let CSfilename = filenameP[0]
        
        if (!srcLinks.FileList) {
            if (!noerror) console.log ("Source file list not loaded!");
        }
        else {
            CS = srcLinks.FileList[filename];
            if (!CS) {
                if (!noerror) console.log (`file "${filename}" not in List`);
                CSfilename = "/city/gui/citymap_icons/antiquedealer_flag";    //plunder_robber
                filenameP[1]="png";
                CS=srcLinks.FileList["/city/gui/citymap_icons/antiquedealer_flag.png"];
            }
        }
        
        CSfilename += "-" + CS + "." + filenameP[1];
        
        if (full){
            return FH.Links.InnoCDN + 'assets' + CSfilename;
        }
        return CSfilename;
    },


    GetPortrait: (id)=> {
        let file = FH.Main.PlayerPortraits[id] || 'portrait_433';

        return srcLinks.get('/shared/avatars/' + file + '.jpg', true);
    },


    getReward:(icon) => {
        let url=""
        if (icon.substring(1, 2) === "_") {
            url = srcLinks.getBuilding(FH.Main.CityEntities?.[icon]?.asset_id);
        } else if (url==""|| url.indexOf("antiquedealer_flag") > -1) 
            url = srcLinks.get(`/shared/unit_portraits/armyuniticons_90x90/armyuniticons_90x90_${icon}.jpg`,true, true) // does not work :(

        if (url.indexOf("antiquedealer_flag") > -1) 
            url = srcLinks.get(`/shared/icons/goods_large/${icon}.png`,true, true)
        if (url.indexOf("antiquedealer_flag") > -1) 
            url = srcLinks.get(`/shared/icons/reward_icons/reward_icon_${icon}.png`,true, true)
        if (url.indexOf("antiquedealer_flag") > -1) 
            url = srcLinks.getBuilding(icon);

        return url;
    },


    getQuest:(icon) => {
        let url1 = srcLinks.get(`/shared/icons/quest_icons/${icon}.png`,true, true);
        let url2 = srcLinks.get(`/shared/icons/${icon}.png`,true, true);
        
        if (url1.indexOf("antiquedealer_flag") > -1) {
            return url2;
        }

        return url1;
    },

    getBuilding:(id) => {
        let link = srcLinks.get("/city/buildings/"+id.replace(/^(\D_)(.*?)/,"$1SS_$2")+".png",true,true);
        if (link.includes("antiquedealer_flag")) link = srcLinks.get("/city/buildings/"+id.replace(/^(\D_)(.*?)/,"$1SS_$2")+"a.png",true);
        return link;
    },

    icons: (x) => {
        if (!x) return ""
        let link = srcLinks.get(`/shared/icons/${x}.png`,true,true);
        if (link.includes("antiquedealer_flag")) link = srcLinks.get(`/shared/gui/upgrade/upgrade_icon_${x}.png`,true,true);
        if (link.includes("antiquedealer_flag")) link = srcLinks.get(`/shared/icons/${x.replace(/(.*?)_[0-9]+/gm,"$1")}.png`,true,true);
        if (link.includes("antiquedealer_flag")) link = srcLinks.get(`/shared/icons/goods/icon_fine_${x}.png`,true,true);
        if (link.includes("antiquedealer_flag")) link = srcLinks.get(`/shared/icons/reward_icons/reward_icon_${x}.png`,true,true);
        if (link.includes("antiquedealer_flag")) link = srcLinks.get(`/shared/icons/reward_icons/reward_icon_${x.replace(/(.*?)_[0-9]+/gm,"$1")}.png`,true,true);
        if (link.includes("antiquedealer_flag")) link = srcLinks.getBuilding(x);
        if (link.includes("antiquedealer_flag")) link = srcLinks.getBuilding(x);
        if (link.includes("antiquedealer_flag")) link = srcLinks.getBuilding(FH.Main.CityEntities?.[x]?.asset_id);
        return `<img src=${link} alt="">`;
    },
    regEx: (regEx)=>{
        file = Object.keys(srcLinks.FileList).find(x=>regEx.test(x))
        let link = srcLinks.get(file,true,true);
        return `<img src=${link} alt="">`;
    }

}

srcLinks.init()