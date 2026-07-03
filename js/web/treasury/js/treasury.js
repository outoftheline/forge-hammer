/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

// LG Investitionen
FH.proxy.addHandler('ClanService', 'getTreasuryLogs', (data) => {
    if (Settings.GetSetting('ShowGuildTreasuryLogExport')) {
        Treasury.HandleNewLogs(data);
    }
});


let Treasury = {
    Logs: [],
    LastNewLogs: undefined,

    HandleNewLogs: (Logs) => {
        Treasury.LastNewLogs = Logs;

        if ($('#treasury').length === 0) {
            FH.HTML.Box({
                'id': 'treasury',
                'title': FH.t('Boxes.Treasury.Title'),
                'auto_close': true,
                'dragdrop': true,
                settings: Treasury.ShowSettings
            });

            // CSS in den DOM prügeln
            FH.HTML.AddCssFile('treasury');

            $('#treasury').on('click', '.button-reset', function () {
                Treasury.Logs = [];

                Treasury.HandleNewLogs(Treasury.LastNewLogs); //Logs der aktuellen Seite erneut verabeiten
            });

            $('#treasury').on('click', '.button-export', function () {
                Treasury.Export();
            });
        }

        let LogArray = Logs['responseData']['logs'].map(x=>{
            let date = EventHandler.ParseDate(x.createdAt)
            x.createdAt = date||x.createdAt
            return x
        });
        Treasury.Logs = Treasury.Logs.concat(LogArray);           
                
        Treasury.CalcBody();
    },


    CalcBody: () => {
        let h = [];

        h.push('<strong>' + FH.t('Boxes.Treasury.Message') + '</strong><br>');
        h.push(FH.t('Boxes.Treasury.RowNumber') + ': ' + FH.HTML.Format(Treasury.Logs.length) + '<br>');
        h.push('<span class="btn button-reset">' + FH.t('Boxes.Treasury.Reset') + '</span>');
        h.push('<span class="btn button-export">' + FH.t('Boxes.Treasury.Export') + '</span>');

        $('#treasuryBody').html(h.join(''));
    },


    Export: () => {
        let h = [],
            CurrentLine = [];

        CurrentLine.push(FH.t('Boxes.Treasury.PlayerID'));
        CurrentLine.push(FH.t('Boxes.Treasury.PlayerName'));
        CurrentLine.push(FH.t('Boxes.Treasury.Era'));
        CurrentLine.push(FH.t('Boxes.Treasury.Resource'));
        CurrentLine.push(FH.t('Boxes.Treasury.Amount'));
        CurrentLine.push(FH.t('Boxes.Treasury.Action'));
        CurrentLine.push(FH.t('Boxes.Treasury.DateTime'));

        h.push(CurrentLine.join(';'));

        for (let i = 0; i < Treasury.Logs.length; i++) {
            let CurrentLog = Treasury.Logs[i];

            CurrentLine = [];
            CurrentLine.push(CurrentLog['player']['player_id']);
            CurrentLine.push(CurrentLog['player']['name'].replace(/;/g, ''));
            let GoodID = CurrentLog['resource'];
            let EraName = GoodsData[GoodID]['era'];
            let EraID = Technologies.Eras[EraName];
            CurrentLine.push((EraID + '').padStart(2, '0') + ' - ' + FH.t('Eras.' + EraID).replace(/;/g, ''));
            CurrentLine.push(GoodsData[GoodID]['name'].replace(/;/g, ''));
            CurrentLine.push(CurrentLog['amount']);
            CurrentLine.push(CurrentLog['action'].replace(/;/g, ''));
            CurrentLine.push(typeof CurrentLog['createdAt'] == "object" ? CurrentLog['createdAt'].toLocaleString().replace(/,/g,"") : CurrentLog['createdAt'].replace(/;/g, ''));

            h.push(CurrentLine.join(';'));
        }

        let ExportString = h.join('\r\n');
        let BOM = "\uFEFF";
        let Blob1 = new Blob([BOM + ExportString], { type: "application/octet-binary;charset=ANSI" });
        FH.Main.ExportFile(Blob1, 'GuildTreasury-'+moment().format('YYYY-MM-DD')+'.csv');
    },

    /**
    *
    */
     ShowSettings: () => {
		let autoOpen = Settings.GetSetting('ShowGuildTreasuryLogExport');

        let h = [];
        h.push(`<p><input id="autoStartTreasuryExport" name="autoStartTreasuryExport" value="1" type="checkbox" ${(autoOpen === true) ? ' checked="checked"' : ''} /> <label for="autoStartMarket">${FH.t('Boxes.Settings.Autostart')}</label></p>`);
        h.push(`<p><button onclick="Treasury.SaveSettings()" id="save-treasury-settings" class="btn saveSettings">${FH.t('Boxes.Settings.Save')}</button></p>`);

        $('#treasurySettingsBox').html(h.join(''));
    },

    /**
    *
    */
    SaveSettings: () => {
        let value = false;
		if ($("#autoStartMarket").is(':checked'))
			value = true;

		FH.Storage.setItem('ShowGuildTreasuryLogExport', value);
		$(`#treasurySettingsBox`).remove();
    },
};
