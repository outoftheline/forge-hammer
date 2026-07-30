/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

FH.proxy.addHandler('QuestService', 'getUpdates', (data, postData) => {
    
    if (!data.responseData) return;
    for (let quest of data.responseData) {
        if (quest.type !=="generic" || quest.id < 900000 || quest.id >= 1000000  ) continue;
        if (!(quest.genericRewards?.length > 0)) continue;
        if (!quest.genericRewards.map(x=>x.flags).flat().includes('random')) continue;
        let q = Recurring.data.Questlist[quest.id] || {'title':quest.title}

        q.diamonds = q.diamonds || quest.genericRewards[0].subType == "medals" || quest.genericRewards[0].subType == "premium";
        q.era = q.era || FH.CurrentEraID;
        q.conditions = q.conditions || quest.successConditions;
        q.groups = q.groups || quest.successConditionGroups;

        Recurring.data.Questlist[quest.id] = q;

    }
    Recurring.SaveSettings();
    Recurring.RefreshGui();
});

let Recurring = {
    data: JSON.parse(FH.Storage.getItem('Recurring')) || {"Questlist": {}, "count":0, "showCounter": false,"hideTasks":true},
    
	/**
	 * Box in den DOM
	 */
    init: () => {
        if ($('#RecurringQuestsBox').length < 1) {

            FH.HTML.AddCssFile('recurring-quests');

            FH.HTML.Box({
                'id': 'RecurringQuestsBox',
                'title': FH.t('Boxes.RecurringQuests.Title'),
                'auto_close': true,
                'dragdrop': true,
                'minimize': true,
                'resize': true,
                'settings': Recurring.ShowSettingsButton
            });

            Recurring.RefreshGui();

        } else {
            FH.HTML.CloseOpenBox('RecurringQuestsBox');
        }
    },


	RefreshGui: (fromHandler = false) => {       
        Recurring.SetCounter();
        if ($('#RecurringQuestsBox').length < 1) return;
        
        if ((Recurring.data?.filter?.length || 0) + (Recurring.data?.filter2?.length || 0) === 0) {
            $('#RecurringQuestsBox').fadeOut('500', function() {
                $(this).remove();
            });
        }
        else 
            Recurring.BuildBox();  
    },
    filter: () => {
        Recurring.data.filter = [];
        Recurring.data.filter2 = [];
        Recurring.data.count = 0;
        for (let [id,q] of Object.entries(Recurring.data.Questlist)) {
            if (q.era == FH.CurrentEraID) {
                if (!q.diamonds){
                    Recurring.data.filter.push(id);
                    Recurring.data.count++;
                } else {
                    Recurring.data.filter2.push(id);
                }
            } else if (FH.CurrentEraID - q.era > 2) {
                delete Recurring.data.Questlist[id];
            }
        }
    },

	/**
	 * Inhalt der Box in den BoxBody legen
	 */
    BuildBox: () => {
        let h = [];
        h.push(`<div>${FH.t('Boxes.RecurringQuests.Warning')}</div>`);

        h.push(`<table id="recurringTable" class="foe-table${!!Recurring.data.hideTasks?' hideTasks':''}">`);

        h.push('<thead class="sticky">');
        h.push('<tr>');
        h.push(`<th onclick="Recurring.hideTasks()">${FH.t('Boxes.RecurringQuests.Table.Quest')} ⇋</th>`);
        h.push(`<th onclick="Recurring.hideTasks()">${FH.t('Boxes.RecurringQuests.Table.Tasks')} ⇋</th>`);
        h.push('<th><img src="' + srcLinks.get("/shared/icons/premium.png", true) + '" alt="" width="20px" height="20px">?</th>');
        h.push('</tr>');
        h.push('</thead>');

        h.push('<tbody>');

        for (let q of Recurring.data.filter) {
            if (!Recurring.data.Questlist[q]) continue;
            let quest=Recurring.data.Questlist[q]
            h.push(`<tr>`);
            h.push(`<td title="${Recurring.getTasksTitle(quest.groups,quest.conditions)}"><span>${quest.title}</span></td>`);
            h.push(`<td title="${Recurring.getTasksTitle(quest.groups,quest.conditions)}">${Recurring.getTasks(quest.groups,quest.conditions)}</td>`);
            h.push(`<td><span class="switchState" data-id="${q}">${quest.diamonds ? "✓" : "?"}</span></td>`);
            h.push('</tr>');
        }
        for (let q of Recurring.data.filter2) {
            if (!Recurring.data.Questlist[q]) continue;
            let quest=Recurring.data.Questlist[q]
            h.push(`<tr>`);
            h.push(`<td title="${Recurring.getTasksTitle(quest.groups,quest.conditions)}"><span>${quest.title}</span></td>`);
            h.push(`<td title="${Recurring.getTasksTitle(quest.groups,quest.conditions)}">${Recurring.getTasks(quest.groups,quest.conditions)}</td>`);
            h.push(`<td class="check"><span class="switchState" data-id="${q}">${quest.diamonds ? "✓" : "?"}</span></td>`);
            h.push('</tr>');
        }
        h.push('</tbody>');
        h.push('</table>');

        $('#RecurringQuestsBoxBody').html(h.join(''));
        $('#RecurringQuestsBoxBody .switchState').on('mousedown', function() {
            $(this).addClass('loading');
            Recurring.loadingTimer = setTimeout(() => {
                $(this).removeClass('loading');
                id=$(this).data('id');
                Recurring.data.Questlist[id].diamonds = !Recurring.data.Questlist[id].diamonds;
                Recurring.SaveSettings();
                Recurring.BuildBox();
                Recurring.loadingTimer = null;
            }, 5000)
        })
        $('#RecurringQuestsBoxBody .switchState').on('mouseup', function() {
            if (Recurring.loadingTimer) {
                clearTimeout(Recurring.loadingTimer);
                Recurring.loadingTimer = null;
                $(this).removeClass('loading');
            }
        });

    },
    loadingTimer: null,

	SetCounter: ()=> {
        $buttonNumber=$('#recurring-count')
        if ($buttonNumber.length==0) return;
        $buttonNumber.text(Recurring.data.count).show();
        if (Recurring.data.count === 0 || !Recurring.data.showCounter) $buttonNumber.hide();
	},

    ShowSettingsButton: () => {
        let h = [];
        h.push(`<label><input type="checkbox" oninput="Recurring.SaveSettings(this.checked)" ${Recurring.data.showCounter?'checked':''}/>${FH.t('Boxes.RecurringQuests.showCounter')}<label>`);
        $('#RecurringQuestsBoxSettingsBox').html(h.join(''));
    },

    SaveSettings: (show=Recurring.data.showCounter) => {
        Recurring.filter()
        Recurring.data.showCounter = show;
        FH.Storage.setItem('Recurring', JSON.stringify(Recurring.data));
        Recurring.SetCounter();
    },
    getTasks: (groups,conditions) =>{
        let t = '';
        let tAdd = '';
        for (let x in groups) {
            if (!groups[x]) continue;
            for (let c of groups[x].conditionIds) {
                let d= conditions.find(item => item.id==c).description;
                let img= srcLinks.getQuest(conditions.find(item => item.id==c).iconType);
                t += `<span>${tAdd} <img src="${img}"> ${d}</span>`;
                tAdd = `<pre style="display:inline">&emsp;&emsp;</pre>${FH.t('Boxes.RecurringQuests.OR')} `;
            }
            tAdd = `${FH.t('Boxes.RecurringQuests.AND')}`;
        }
        return t;
    },
    getTasksTitle: (groups,conditions) =>{
        let t = '';
        let tAdd = '';
        for (let x in groups) {
            if (!groups[x]) continue;
            for (let c of groups[x].conditionIds) {
                t += tAdd + conditions.find(item => item.id==c).description;
                tAdd = `\n${FH.t('Boxes.RecurringQuests.OR')} `;
            }
            tAdd = `\n-------\n${FH.t('Boxes.RecurringQuests.AND')} `;
        }
        return t;
    },
    hideTasks: () => {
        $('#recurringTable').toggleClass('hideTasks'); 
        Recurring.data["hideTasks"]=!Recurring.data.hideTasks;
        Recurring.SaveSettings();
    }

};
