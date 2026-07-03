
/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

FH.proxy.addHandler('ArmyUnitManagementService', 'getArmyInfo', (data, postData) => {
    // Closes the box when the player is about to attack a sector
    FH.HTML.CloseOpenBox('mapTradeWarningDialog');
});

FH.proxy.addHandler('AnnouncementsService', 'fetchAllAnnouncements', (data, postData) => {
    // Closes the box when the player navigates back to the city
    FH.HTML.CloseOpenBox('mapTradeWarningDialog');
});

FH.proxy.addHandler('CampaignService', 'getProvinceData', (data, postData) => {
    // Is the warning enabled in the settings?
    if (!Settings.GetSetting('ShowMapTradeWarning')) {
        return;
    }

    // Closes the box when the player visits a province that is completely conquered
    if (data.responseData && data.responseData.filter(e => !e.isPlayerOwned).length === 0) {
        FH.HTML.CloseOpenBox('mapTradeWarningDialog');
        return;
    }

    // Don't create a new box while another one is still open
    if ($('#mapTradeWarningDialog').length > 0) {
        return;
    }

    return mapTradeWarning.ShowMapDialog();
});

/**
 * @type {{ShowMapDialog: mapTradeWarning.ShowMapDialog}}
 */
let mapTradeWarning = {

    /**
     * Shows a User Box covering the 'Negotiate' button in province sector screens
     *
     * @constructor
     */
    ShowMapDialog: () => {
        FH.HTML.AddCssFile('maptradewarning');
        
        FH.HTML.Box({
            'id': 'mapTradeWarningDialog',
            'title': FH.t('Boxes.mapTradeWarning.Title'),
            'auto_close': true,
            'class': 'window-warning',
            'dragdrop': false,
            'minimize': false
        });
        $('#mapTradeWarningDialogBody').html(`${FH.t('Boxes.mapTradeWarning.Text')}`);
    },
};
