
/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

{

let diff = JSON.parse(FH.Storage.getItem('AuctionDifference') || '[1,2,5,222]'),
    fak = JSON.parse(FH.Storage.getItem('AuctionFactors') || '[1,1,1,1.1]'),
    index = 0,
    current = 0,
    timeout = null;

const updateClipboard = () => {
    newBid = Math.floor(Math.max(fak[index] * current, current + diff[index]));
    FH.helper.str.copyToClipboard(newBid);
};

FH.proxy.addWsHandler('ItemAuctionService', 'updateBid', data => {
    if (!Settings.GetSetting('Auctions')) {
        return;
    }
    current = data.responseData.amount;
    updateClipboard();
    
});

FH.proxy.addHandler('ItemAuctionService', 'getAuction', (data, postdata) => {
    if (!Settings.GetSetting('Auctions')) {
        return;
    }
    if (data.responseData.state == "closed") return;
    current = Math.max(data.responseData.highestBid?.amount||0,(data.responseData.startingBid||0)-diff[index]);
    updateClipboard();
});

FH.proxy.addHandler('ItemAuctionService', 'updateBid', (data, postdata) => {
    if (!Settings.GetSetting('Auctions')) {
        return;
    }
    current = data.responseData.amount;
    updateClipboard();
});

FH.proxy.addRequestHandler('ItemAuctionService', 'makeBid', (data, postdata) => {
    index = Math.min(index + 1, diff.length-1);
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(
        ()=>{index=0},
        60000);
});


let Auction={

	BuildBody: ()=> {

		if ($('#auctionSettingsBox').length === 0) {
			FH.HTML.Box({
				id: 'auctionSettingsBox',
				title: FH.t('Boxes.AuctionSettings.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true,
			});

			FH.HTML.AddCssFile('auctions');
		} 
        let t=[];
        t.push(`<button id="AuctionHelpBtn" class="btn">${FH.t('Boxes.AuctionSettings.Help')}</button>`);
        t.push(`<div id="AuctionHelp" style="display:none"><ul><li>${FH.t('Boxes.AuctionSettings.Help1')}</li><li>${FH.t('Boxes.AuctionSettings.Help2')}</li><li>${FH.t('Boxes.AuctionSettings.Help3')}</li><li>${FH.t('Boxes.AuctionSettings.Help4')}</li><li>${FH.t('Boxes.AuctionSettings.Help5')}</li></div> `);
        t.push(`<table><tr><th>${FH.t('Boxes.AuctionSettings.Bid')}</th><th>${FH.t('Boxes.AuctionSettings.Add')}</th><th>${FH.t('Boxes.AuctionSettings.Factor')}</th></tr>`)
        for (let i = 0; i<diff.length;i++) {
            t.push(`<tr><td>${i+1}</td><td><Input class="AuctionInput" data-type="Add" data-id="${i}" type="number" value="${diff[i]}"></td><td><Input class="AuctionInput" data-type="Mult" data-id="${i}" type="number" value="${fak[i]}"></td></tr>`)

        }
        t.push(`<tr><td colspan="3"><button id="AuctionAddRow" class="btn">+</button><button id="AuctionDelRow" class="btn">-</button></td></tr>`)
        t.push(`</table>`)
        
        
        $('#auctionSettingsBoxBody').html(t.join(''));
        $('.AuctionInput').on("input", (e) => {
            let elem = e.target;
            if (elem.dataset.type=="Add") {
                diff[Number(elem.dataset.id)] = Number(elem.value);
                FH.Storage.setItem('AuctionDifference', JSON.stringify(diff))
            } else if (elem.dataset.type=="Mult") {
                fak[Number(elem.dataset.id)] = Number(elem.value);
                FH.Storage.setItem('AuctionFactors', JSON.stringify(fak))
            };
        });
        $('#AuctionAddRow').on("click", () => {
            diff.push(1);
            fak.push(1);
            FH.Storage.setItem('AuctionDifference', JSON.stringify(diff))
            FH.Storage.setItem('AuctionFactors', JSON.stringify(fak))
            Auction.BuildBody();            
        });
        $('#AuctionDelRow').on("click", () => {
            let x= diff.pop();
            x = fak.pop();
            FH.Storage.setItem('AuctionDifference', JSON.stringify(diff))
            FH.Storage.setItem('AuctionFactors', JSON.stringify(fak))
            Auction.BuildBody();            
        });
        $('#AuctionHelpBtn').on("click", () => {
            $('#AuctionHelp').fadeToggle();            
        });
    },
};
FH.Auction = Auction;
}