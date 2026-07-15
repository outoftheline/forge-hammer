/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Copyright (C) 2026 Forge Hammer
 * Licensed under AGPL - see LICENSE.md for details.
*/

// neues Postfach
FH.proxy.addHandler('ConversationService', 'getOverviewForCategory', (data, postData) => {
    FH.Main.setConversations(data.responseData.category, true);
});

FH.proxy.addHandler('ConversationService', 'getCategory', (data, postData) => {
    FH.Main.setConversations(data.responseData);
});

let Infoboard = {

    InjectionLoaded: false,
    PlayInfoSound: true,
    SavedFilter: ["auction", "ge", "gbg", "qi", "trade", "level", "msg", "text"],
    SavedTextFilter: "",
    DebugWebSocket: false,
    History: [],
    MaxEntries: 0,
    GbgProvShortNameFl: true,
    OriginalDocumentTitle: document.title,
    TitleBlinkEvent: null,

    /**
     * Setzt einen ByPass auf den WebSocket und "hört" mit
     * */
    Init: () => {
        FH.proxy.addRawWsHandler(data => {
            Infoboard.HandleMessage('in', data);
        });

        // Der Spieler ist wieder im FoE Tab
        window.onfocus = function() {
            // Infoboard.StopTitleBlinking();
        };
    },


    Show: () => {
        let StorageHeader = FH.Storage.getItem('ConversationsHeaders');

        if (FH.Main.Conversations.length === 0 && StorageHeader !== null) 
            FH.Main.Conversations = JSON.parse(StorageHeader);

        Infoboard.Box();
    },


    /**
     * Erzeugt die Box wenn noch nicht im DOM
     *
     */
    Box: () => {
        if ($('#BackgroundInfo').length === 0) {
            let spk = FH.Storage.getItem('infoboxTone');
            if (spk === null) {
                FH.Storage.setItem('infoboxTone', 'deactivated');
                Infoboard.PlayInfoSound = false;

            } else 
                Infoboard.PlayInfoSound = (spk !== 'deactivated');
            
            if (FH.Storage.getItem("infoboxSavedFilter") === null)
                FH.Storage.setItem("infoboxSavedFilter", JSON.stringify(Infoboard.SavedFilter));
            else
                Infoboard.SavedFilter = JSON.parse(FH.Storage.getItem("infoboxSavedFilter"));

            if (FH.Storage.getItem("infoboxTextFilter") === null)
                FH.Storage.setItem("infoboxTextFilter", Infoboard.SavedTextFilter);
            else
                Infoboard.SavedTextFilter = FH.Storage.getItem("infoboxTextFilter");

            FH.HTML.Box({
                id: 'BackgroundInfo',
                title: FH.t('Boxes.Infobox.Title'),
                auto_close: true,
                dragdrop: true,
                resize: true,
                minimize: true,
                speaker: 'infoboxTone',
                settings: Infoboard.ShowSettings
            });
            FH.HTML.AddCssFile('infoboard');

        } else {
            return FH.HTML.CloseOpenBox('BackgroundInfo');
        }

        let div = $('#BackgroundInfo'),
            h = [];

        // Filter
        h.push('<div class="filter-row sticky">');

        h.push('<div class="dropdown">');
        h.push('<input type="checkbox" class="dropdown-checkbox" id="infobox-checkbox-toggle"><label class="dropdown-label" for="infobox-checkbox-toggle">' + FH.t('Boxes.Infobox.Filter') + '</label><span class="arrow"></span>');

        h.push('<ul>');
        h.push('<li><label><input type="text" data-type="text" placeholder="1.9|A1: M" class="textfilter filter-msg" value=' + (Infoboard.SavedFilter.includes("text") ? Infoboard.SavedTextFilter : "") + '></label></li>');
        h.push('<li><label><input type="checkbox" data-type="favorites" class="filter-msg" ' + (Infoboard.SavedFilter.includes("favorites") ? "checked" : "") + '> ' + FH.t('Boxes.General.Favorites') + '</label></li>');
        h.push('<li><label><input type="checkbox" data-type="msg" class="filter-msg" ' + (Infoboard.SavedFilter.includes("msg") ? "checked" : "") + '> ' + FH.t('Boxes.Infobox.FilterMessage') + '</label></li>');
        h.push('<li><label><input type="checkbox" data-type="level" class="filter-msg" ' + (Infoboard.SavedFilter.includes("level") ? "checked" : "") + '> ' + FH.t('Boxes.Infobox.FilterLevel') + '</label></li>');
        h.push('<li><label><input type="checkbox" data-type="ge" class="filter-msg" ' + (Infoboard.SavedFilter.includes("ge") ? "checked" : "") + '> ' + FH.t('Boxes.General.Guild_Expedition.short') + '</label></li>');
        h.push('<li><label><input type="checkbox" data-type="gbg" class="filter-msg" ' + (Infoboard.SavedFilter.includes("gbg") ? "checked" : "") + '> ' + FH.t('Boxes.General.Guild_Battlegrounds.short') + '</label></li>');
        h.push('<li><label><input type="checkbox" data-type="qi" class="filter-msg" ' + (Infoboard.SavedFilter.includes("qi") ? "checked" : "") + '> ' + FH.t('Boxes.General.Quantum_Incursion.short') + '</label></li>');
        h.push('<li><label><input type="checkbox" data-type="auction" class="filter-msg" ' + (Infoboard.SavedFilter.includes("auction") ? "checked" : "") + '> ' + FH.t('Boxes.Infobox.FilterAuction') + '</label></li>');
        h.push('<li><label><input type="checkbox" data-type="trade" class="filter-msg" ' + (Infoboard.SavedFilter.includes("trade") ? "checked" : "") + '> ' + FH.t('Boxes.Infobox.FilterTrade') + '</label></li>');
        h.push('</ul>');
        h.push('</div>');

        h.push('<button class="btn btn-mid btn-reset-box">' + FH.t('Boxes.Infobox.ResetBox') + '</button>');
        h.push('</div>');

        h.push('<ul id="BackgroundInfoList" class="foe-table">');
        h.push('</ul>');

        div.find('#BackgroundInfoBody').html(h.join(''));
        div.show();

        Infoboard.FilterInput();
        Infoboard.ResetBox();

        Infoboard.PostMessage({
            class: 'welcome',
            type: FH.t('Menu.Info.Title'),
            msg: FH.t('Boxes.Infobox.Messages.Welcome'),
        });

        Infoboard.MaxEntries = FH.Storage.getItem("EntryCount") || 0;

        for (let i = 0; i < Infoboard.History.length; i++) {
            const element = Infoboard.History[i];
            Infoboard.PostMessage(element,false);
        }

        div.on('click', '#infoboxTone', function () {
            let disabled = $(this).hasClass('deactivated');

            FH.Storage.setItem('infoboxTone', (disabled ? '' : 'deactivated'));
            Infoboard.PlayInfoSound = !!disabled;

            if (disabled === true) 
                $('#infoboxTone').removeClass('deactivated');
            else 
                $('#infoboxTone').addClass('deactivated');
        });

        div.on('click', '.fav', function () {
            let id = $(this).parent().parent().data('id');
            let favorites = JSON.parse(FH.Storage.getItem('infoboxFavs')) || [];
            let favFound = favorites.find(x => x == id);
            let favEl = $('[data-id="'+id+'"] .fav');
            if (favEl.hasClass('active')) {
                favEl.text('☆');
                favEl.attr('data-original-title',FH.t('Boxes.General.FavoritesAdd'));
            }
            else {
                favEl.text('★');
                favEl.attr('data-original-title',FH.t('Boxes.General.FavoritesRemove'));
            }

            $('[data-id="'+id+'"] .fav').toggleClass('active')

            if (!favFound) 
                favorites.push(id);
            else
                favorites.splice(favorites.indexOf(id), 1);

            FH.Storage.setItem('infoboxFavs', JSON.stringify(favorites));
        });
        $('#BackgroundInfoList [data-original-title]').tooltip({container: 'body'})
    },


    HandleMessage: async (dir, data) => {
        let Msg = data[0];

        if (!Msg || !Msg.requestClass) return;

        let c = Msg.requestClass,
            m = Msg.requestMethod,
            t = Msg.responseData?.type || '',
            functionName = c + '_' + m + t;

        if (Infoboard.DebugWebSocket) console.log(JSON.stringify(data));

        if (!Info[functionName]) return;

        let bd = await Info[functionName](Msg['responseData']);
        if (!bd) return;

        Infoboard.PostMessage(bd);
    },


    PostMessage: (bd, add = true) => {
        if (!bd['date']) bd['date'] = new Date();

        if ($('#BackgroundInfo').length === 0 || bd.class === 'welcome' && Infoboard.History.length > 0) return;

        if(bd.class !== 'welcome' && add) {
            if(Infoboard.MaxEntries > 0 && Infoboard.History.length >= Infoboard.MaxEntries) 
                Infoboard.History.shift();
            
            Infoboard.History.push(bd);
        }

        let status = $('input[data-type="' + bd.class + '"]').prop('checked'),
            textfilter = $('input[data-type="text"]').val().split("|"),
            msg = bd.msg, type = bd.type,
            filterStatus = textfilter.some(e => msg.toLowerCase().includes(e.toLowerCase()));
        let cl = bd.img ? bd.img : bd.class;
        let dataId = bd.data||cl;
        let hidden = ((!status || !filterStatus) && bd.class !== 'welcome') ? ' display:none' : '';
        let favActive = false;

        let favoritesOnly = $('input[data-type="favorites"]').prop('checked');
        let favorites = JSON.parse(FH.Storage.getItem('infoboxFavs')) || [];
        let favFound = favorites.find(x => x == dataId);
        if (favFound)
            favActive = 'active';

        if (favoritesOnly) {
            if (favFound == undefined) 
                hidden = ' display:none';
        }

        let li = `<li data-id="${dataId}" class="${cl}" style="${hidden}">
                    <div class="icon"></div>
                    <div class="main">
                        <small><em>${moment(bd.date).format('HH:mm:ss')}</em></small>
                        <div>${msg}</div>
                        <span class="clickable fav ${favActive !== false ? favActive : ''}" 
                            data-original-title="${favActive !== false ? 'Remove from favorites' : 'Add to favorites'}">
                            ${favActive !== false ? '★' : '☆'}
                        </span>
                    </div>
                  </li>`;

        if (hidden == '') {
            if (Infoboard.MaxEntries > 0 && $('#BackgroundInfoList li').length >= Infoboard.MaxEntries) {
                while (Infoboard.MaxEntries > 0 && $('#BackgroundInfoList li').length >= Infoboard.MaxEntries) {
                    let liLast = $('#BackgroundInfoList li:last-child')[0];
                    liLast.parentNode.removeChild(liLast);
                }
            }
        }

        $('#BackgroundInfoList').prepend(li);

        if (Infoboard.PlayInfoSound && status && filterStatus) {
            FH.helper.sounds.play("ping");
        }
        
    },


    /**
     * Filter Message Type
     */
    FilterInput: () => {
        $('#BackgroundInfo').on('change', '.filter-msg', function () {
            let active = [];

            $('.filter-msg').each(function () {
                if ($(this).is(':checked') || ($(this).data("type") === "text" && $(this).val() !== "")) {
                    active.push($(this).data('type'));
                    if (!Infoboard.SavedFilter.includes($(this).data('type')))
                        Infoboard.SavedFilter.push($(this).data('type'));
                }
                else {
                    if (Infoboard.SavedFilter.includes($(this).data('type')))
                        Infoboard.SavedFilter.splice(Infoboard.SavedFilter.indexOf($(this).data('type')), 1);
                }
            });

            FH.Storage.setItem("infoboxSavedFilter", JSON.stringify(Infoboard.SavedFilter));
            FH.Storage.setItem("infoboxTextFilter", $('input[data-type="text"]').val());
            let favorites = JSON.parse(FH.Storage.getItem("infoboxFavs")) || [];

            $('#BackgroundInfoList li').each(function () {
                let li = $(this),
                    textfilter = $('input[data-type="text"]').val().split("|"),
                    type = li.attr('class');
   
                if (active.some(e => type.startsWith(e)) && textfilter.some(e => $(li.children()[1]).html().toLowerCase().includes(e.toLowerCase()))) 
                    li.show();
                else 
                    li.hide();
                
                if ($('input[data-type="favorites"]').prop('checked')) {
                    if (favorites.find(x => x == li.data('id')))
                        li.show();
                    else 
                        li.hide();
                } 

                if (li.hasClass('welcome')) li.show();
            });
        });
    },


    /**
     * Leert die Infobox, auf Wunsch
     *
     */
    ResetBox: () => {
        $('#BackgroundInfo').on('click', '.btn-reset-box', function () {
            $('#BackgroundInfoList').html('');
            Infoboard.History = [];
        });
    },
    

	ShowSettings: () => {
		let autoOpen = Settings.GetSetting('AutoOpenInfoBox');
		let messagesAmount = FH.Storage.getItem('EntryCount');

        let EntryCountTitle = FH.t('Settings.InfoboxEntryCount.Title'); //Dummy usage. Dont mark key for disposal yet. Might be useful later

        let h = [];
        h.push(`<p><input id="autoStartInfoboard" name="autoStartInfoboard" value="1" type="checkbox" ${(autoOpen === true) ? ' checked="checked"' : ''} />
                <label for="autoStartInfoboard">${FH.t('Boxes.Settings.Autostart')}</label></p>
                <hr>
                <p><label for="infoboxentry-length">${FH.t('Settings.InfoboxEntryCount.Desc')}</label>
                <input class="setting-input" type="number" id="infoboxentry-length" step="1" min="1" max="2000" value="${(messagesAmount)}"></p>
                <button onclick="Infoboard.SaveSettings()" id="saveInfoboardSettings" class="btn saveSettings">${FH.t('Boxes.Settings.Save')}</button>`);

        $('#BackgroundInfoSettingsBox').html(h.join(''));
    },


    SaveSettings: () => {        
        FH.Storage.setItem('AutoOpenInfoBox', $("#autoStartInfoboard").is(':checked'));
        FH.Storage.setItem('EntryCount', $("#infoboxentry-length").val());

		$(`#BackgroundInfoSettingsBox`).remove();
    },
};


let Info = {
    GuildPoints: {},


    /**
     * Jmd hat in einer Auktion mehr geboten
     */
    ItemAuctionService_updateBid: (d) => {
        let PlayerLink = FH.Main.GetPlayerLink(d['player']['player_id'], d['player']['name']);

        return {
            class: 'auction',
            type: 'Auktion',
            msg: FH.helper.str.Replacer(
                FH.t('Boxes.Infobox.Messages.Auction'), {
                    player: PlayerLink,
                    amount: FH.HTML.Format(d['amount']),
                }
            )
        };
    },


    /**
     * Nachricht in einem bekannten Chat
     */
    ConversationService_getNewMessage: (d) => {
        let chat = FH.Main.Conversations.find(obj => obj.id === d['conversationId']),
            header, message, image = 'msg';

        if (chat && chat['hidden']){
            return undefined;
        }

        if (d['text'] !== '') {
            // normale Nachricht
            message = d['text'].replace(/(\r\n|\n|\r)/gm, '<br>');
        }
        else if (d['attachment']) {
            if (d['attachment']['type'] === 'great_building') {
                // legendäres Bauwerk
                message = FH.helper.str.Replacer(
                    FH.t('Boxes.Infobox.Messages.MsgBuilding'), {
                    building: FH.Main.CityEntities[d['attachment']['cityEntityId']]['name'],
                    level: d['attachment']['level']
                });
            }
            else if (d['attachment']['type'] === 'trade_offer') {
                // Handelsangebot
                message = `<div class="offer"><span title="${FH.Goods.Data[d['attachment']['offeredResource']]['name']}" class="goods-sprite sprite-50 ${d['attachment']['offeredResource']}"></span> <span>x<strong>${d['attachment']['offeredAmount']}</strong></span> <span class="sign">&#187</span> <span title="${FH.Goods.Data[d['attachment']['neededResource']]['name']}" class="goods-sprite sprite-50 ${d['attachment']['neededResource']}"></span> <span>x<strong>${d['attachment']['neededAmount']}</strong></span></div>`;
            }
        }

        if (chat) {
            if (chat.important) {
                image = 'msg-important';
            }
            else if (chat.favorite) {
                image = 'msg-favorite';
            }

            if (d.sender && d.sender.name) {
                // normale Chatnachricht (bekannte ID)
                if (d.sender.name === chat.title) {
                    header = '<div><strong class="bright">' + FH.Main.GetPlayerLink(d['sender']['player_id'], d['sender']['name']) + '</strong></div>';
                }
                else {
                    header = '<div><strong class="bright">' + FH.HTML.escapeHtml(chat['title']) + '</strong> - <em>' + FH.Main.GetPlayerLink(d['sender']['player_id'], d['sender']['name']) + '</em></div>';
                }
            }
            else {
                // Chatnachricht vom System (Betreten/Verlassen)
                header = '<div><strong class="bright">' + FH.HTML.escapeHtml(chat['title']) + '</strong></div>';
            }
        }
        else {
            return {
                class: 'msg',
                type: FH.t('Boxes.Infobox.FilterMessage'),
                msg: (d.sender?.name||'') + '<div class="content">'+message+'</div>',
                img: 'msg',
                data: d.conversationId
            };
        }

        return {
            class: 'msg',
            type: FH.t('Boxes.Infobox.FilterMessage'),
            msg: header + '<div class="content">'+message+'</div>',
            img: image,
            data: d.conversationId
        };
    },


    /**
     * Nachricht in einem unbekannten Chat
     */
    ConversationService_getConversationUpdate: (d) => {
        let chat = FH.Main.Conversations.find(obj => obj.id === d['conversationId']);
        if (chat) return undefined;

        let message = '<div><strong class="bright">' + FH.t('Boxes.Infobox.UnknownConversation') + '</strong></div>';
        return {
            class: 'message',
            type: FH.t('Boxes.Infobox.FilterMessage'),
            msg: message
        };
    },


    /**
     * GBG Map figths
     */
    GuildBattlegroundService_getProvinces: async (d) => {
        await FH.ExistenceConfirmed('GuildFights.SortedColors')

        let data = d[0];
        let bP = GuildFights.MapData['battlegroundParticipants'],
            prov;

        if (!data.id || data.id === 0) {
            prov = ProvinceMap.ProvinceData()[0];
        } else {
            prov = ProvinceMap.ProvinceData().find(o => (o['id'] === data.id));
        }

        if (data.lockedUntil !== undefined) {
            // keine Übernahme
            if (data.lockedUntil < Math.floor(FH.Main.getCurrentDateTime() / 1000) + 14390) return undefined;

            let p = bP.find(o => (o['participantId'] === data['ownerId'])),
                colors = GuildFights.SortedColors.find(c => (c['id'] === data['ownerId']));

            let tc = colors['highlight'],
                ts = colors['shadow'];

            return {
                class: 'gbg',
                type: FH.t('Boxes.General.Guild_Battlegrounds.short'),
                msg: FH.helper.str.Replacer(
                    FH.t('Boxes.Infobox.Messages.GildFightOccupied'), {
                    provinceName: prov['name'],
                    attackerColor: tc,
                    attackerShadow: ts,
                    attackerName: p['clan']['name'],
                    untilOccupied: moment.unix(data.lockedUntil).format('HH:mm:ss')
                }),
                img: 'gbg-lock'
            };
        }

        if (!data.conquestProgress[0]) return undefined;

        // Es wird gerade gekämpft
        let color = GuildFights.SortedColors.find(c => (c['id'] === data['ownerId'])), t = '', image;

        for (let i in data.conquestProgress) {
            if (!data.conquestProgress.hasOwnProperty(i))  break;

            let d = data.conquestProgress[i],
                p = bP.find(o => (o['participantId'] === d.participantId)),
                colors = GuildFights.SortedColors.find(c => (c['id'] === d.participantId));

            // es gibt mehrere Gilden in einer Provinz, aber eine kämpft gar nicht, überspringen
            if (Info.GuildPoints[data.id] !== undefined &&
                Info.GuildPoints[data.id][d.participantId] !== undefined &&
                Info.GuildPoints[data.id][d.participantId] === d['progress']) {

                continue;
            }

            let provLabel = prov['short'];

            if (color) {
                let tc = colors['highlight'], sc = color['highlight'],
                    ts = colors['shadow'], ss = color['shadow'];

                t += '<span style="color:' + tc + ';text-shadow: 0 1px 1px ' + ts + '">' + p['clan']['name'] + '</span>'
                  + ' ⚔ <span style="color:' + sc + ';text-shadow: 0 1px 1px ' + ss + '">' + provLabel + '</span>'
                  + ' (<strong>' + d['progress'] + '</strong>/<strong>' + d['maxProgress'] + '</strong>)<br>';
            }
            else {
                let tc = colors['highlight'],
                    ts = colors['shadow'];

                t += '<span style="color:' + tc + ';text-shadow: 0 1px 1px ' + ts + '">' + p['clan']['name'] + '</span>'
                  + ' ⚔ ' + provLabel + ' (<strong>' + d['progress'] + '</strong>/<strong>' + d['maxProgress'] + '</strong>)<br>';

            }

            if (image) {
                image = 'gbg-undefined';
            }
            else {
                image = 'gbg-' + colors['cid'];
            }

            if (Info.GuildPoints[data.id] === undefined) {
                Info.GuildPoints[data.id] = {};
            }

            // mitschreiben um keine Punkte doppelt auszugeben
            Info.GuildPoints[data.id][d.participantId] = d['progress'];
        }

        return {
            class: 'gbg',
            type: FH.t('Boxes.General.Guild_Battlegrounds.short'),
            msg: t,
            img: image
        };
    },


    /**
     * LG wurde gelevelt
     */
    OtherPlayerService_newEventgreat_building_contribution: (d) => {
        let newFP = -1;
        if (d['rank'] >= 6) 
            newFP = 0;
        else {
            let Entity = Object.values(FH.Main.CityEntities).find(obj => (obj['name'] === d['great_building_name']));
                EntityID = Entity['id'],
                EraName = EraName = GreatBuildings.GetEraName(EntityID),
                Era = Technologies.Eras[EraName],
                P1 = GreatBuildings.Rewards[Era][d['level']-1],
                FPRewards = GreatBuildings.GetMaezen(P1, FH.Main.ArkBonus);

                newFP = FPRewards[d['rank'] - 1];
        }

        let PlayerLink = FH.Main.GetPlayerLink(d['other_player']['player_id'], d['other_player']['name']);

        return {
            class: 'level',
            type: 'Level-Up',
            msg: FH.helper.str.Replacer(
                FH.t('Boxes.Infobox.Messages.LevelUp'), {
                    player: PlayerLink,
                    building: d['great_building_name'],
                    level: d['level'],
                    rank: d['rank'],
                    fps: newFP !== -1 ? newFP : '???'
                }
            )
        };
    },


    /**
     * Handel wurde angenommen
     */
    OtherPlayerService_newEventtrade_accepted: (d) => {
        let PlayerLink = FH.Main.GetPlayerLink(d['other_player']['player_id'], d['other_player']['name']);

        return {
            class: 'trade',
            type: FH.t('Boxes.Infobox.FilterTrade'),
            msg: FH.helper.str.Replacer(
                FH.t('Boxes.Infobox.Messages.Trade'), {
                'player': PlayerLink,
                'offer': FH.Goods.Data[d['offer']['good_id']]['name'],
                'offerValue': d['offer']['value'],
                'need': FH.Goods.Data[d['need']['good_id']]['name'],
                'needValue': d['need']['value']
            }
            )
        }
    },


    /**
     * Ein Gildenmitglied hat in der GEX gekämpft
     */
    GuildExpeditionService_receiveContributionNotification: (d) => {
        if (d['player']['player_id'] === FH.Player.ID) {
            return false;
        }

        let PlayerLink = FH.Main.GetPlayerLink(d['player']['player_id'], d['player']['name']);

        return {
            class: 'ge',
            type: 'GE',
            msg: FH.helper.str.Replacer(
                FH.t('Boxes.Infobox.Messages.GEX'), {
                'player': PlayerLink,
                'points': FH.HTML.Format(d['expeditionPoints'])
            }
            )
        };
    },

    GuildRaidsMapService_updateNodeCurrentProgress: (d) => {
        let nodeData = QiProgress.QiMap?.nodes?.find(x => x.id === d.nodeId);
        let image = ('qi-'+nodeData.type?.type);
        if (nodeData.type?.armyType !== undefined)
            image = ('qi-'+nodeData.type?.armyType||"") + '-' + (nodeData.type?.fightType||"");

        return {
            class: 'qi',
            type: 'QI',
            msg: FH.helper.str.Replacer(
                FH.t('Boxes.Infobox.Messages.QINodeProgress'), {
                'id': (""+d.nodeId).toUpperCase(),
                'points': FH.HTML.Format(d.currentProgress)
            }),
            img: image
        };
    },

    GuildRaidsMapService_updateState: (d) => {
        if (d.causingPlayerId === FH.Player.ID) return false;

        let nodeID = d.state.nodeId;
        let PlayerLink = FH.Main.GetPlayerLink(d.causingPlayerId, FH.Players.Dict[d.causingPlayerId]?.PlayerName) || '';
        let nodeData = QiProgress.QiMap.nodes?.find(x => x.id === nodeID);
        let image = ('qi-'+nodeData.type?.type) || 'qi';
        if (nodeData.type?.armyType !== undefined)
            image = ('qi-'+nodeData.type?.armyType||"") + '-' + (nodeData.type?.fightType||"");

        return {
            class: 'qi',
            type: 'QI',
            msg: FH.helper.str.Replacer(
                FH.t('Boxes.Infobox.Messages.QINodeFinished'), {
                'player': PlayerLink,
                'id': (""+nodeID).toUpperCase()
            }),
            img: image
        };
    }
};
