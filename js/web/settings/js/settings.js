/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Copyright (C) 2026 Forge Hammer
 * Licensed under AGPL - see LICENSE.md for details.
 */

let Settings = {

	/**
	 * Settings
	 */
	Preferences: null,

	/**
	 * Tab groups
	 */
	BoxGroups: [
		'About',
		'Extension',
		'Auto',
		'Boxes'
	],

	/**
	 * Sound files (vendor/sounds/<name>.mp3)
	 */
	SoundList: [
		'message',
		'notification1',
		'notification2',
		'notification3',
		'notification4',
		'notification5',
		'notification6'
	],
	SoundModules: [
		{ id: 'Calculator', label: 'Menu.Calculator.Title' },
		{ id: 'Infoboard', label: 'Menu.Info.Title' },
		{ id: 'BonusService', label: 'Boxes.BonusService.quest_sound' },
		{ id: 'GameEvents', label: 'Settings.Entry.ShowEventChest' }
	],

	/**
	 * load the settings from the json
	 */
	Init: () => {
		Settings.LoadConfig((response) => {
			Settings.Preferences = response;
		});
	},


	/**
	 * Load config from config file
	 */
	LoadConfig: (callback) => {
		fetch(
			`${FH.extUrl}js/web/settings/config/config.json`
		).then(response => {
			if (response.status === 200) {
				response.json().then(callback);
			}
		});
	},


	/**
	 * activeTab and activeSubTab need to be integers
	 */
	BuildBox: (activeTab = null, activeSubTab = null) => {
		if ($('#SettingsBox').length < 1) {

			FH.HTML.AddCssFile('settings');

			FH.HTML.Box({
				id: 'SettingsBox',
				title: FH.t('Boxes.Settings.Title'),
				auto_close: true,
				dragdrop: true
			});

		} else {
			FH.HTML.CloseOpenBox('SettingsBox');
		}

		Settings.BuildBody(activeTab, activeSubTab);
	},


	BuildBody: (activeTab = null, activeSubTab = null) => {
		let parentLis = [],
			div = [],
			content;

		for (let i = 0; i < Settings.BoxGroups.length; i++) {
			let g = Settings.BoxGroups[i],
				grps = Settings.Preferences.filter((x) => x['group'] === g),
				subcontent,
				cnt = 1,
				childLis = [],
				childDivs = [];

			parentLis.push(`<li><a href="#tab-${i}"><span>${FH.t('Settings.Tab.' + g)}</span></a></li>`);

			for (let x in grps) {
				if (!grps.hasOwnProperty(x) || grps[x].hidden) break;

				let d = grps[x],
					status = d['status'],
					button = d['button'],
					c = $('<div class="item" />'),
					cr = $('<div />').addClass('item-row'),
					ct = $('<h2 />'),
					cd = $('<div />').addClass('desc'),
					cs = $('<div />').addClass('setting');

				if ('NotificationsPosition' !== d['name']) {
					let s = FH.Storage.getItem(d['name']);

					if (s !== null) {
						status = JSON.parse(s);
					}
				}

				// no value && no callback function, make it empty
				if(d['callback'] === undefined && status === undefined && d['button'] === undefined) {
					cs.html('');
				}
				else if (d['callback'] !== undefined) {
					cs.html(Settings[d['callback']]());
				}
				if (button) {
					let b = $('<div />').addClass('button-wrapper').append(
						$(`<button class="btn" id="${x}Button" onclick="${button}">${FH.t('Settings.' + d['name'] + '.Button')}</button>`)
					);

					cs.append(b);
				} 
				if (status !== undefined) {
					cs.append(
						$('<span />').addClass('check '+(status ? '' : 'unchecked')).append(
							$('<span />').addClass('toogle-word').text(status ? FH.t('Boxes.Settings.Active') : FH.t('Boxes.Settings.Inactive'))
						).append(
							$('<input class="setting-check game-cursor" type="checkbox" data-id="'+d['name']+'" '+(status ? 'checked' : '')+'/>')
						)
					)
				}

				cd.html(FH.t(`Settings.${d['name']}.Desc`));
				ct.text(FH.t(`Settings.${d['name']}.Title`));

				childLis.push(`<li class="${d['cssClass']||""}">`);
				if (d.link)
					childLis.push(`<a href="${FH.extUrl}${d.link}" target="_blank">${FH.t('Settings.Entry.' + d['name'])}</a>`);
				else
					childLis.push(`<a href="#subtab-${cnt}">${FH.t('Settings.Entry.' + d['name'])}</a>`);
				childLis.push(`</li>`);

				let h = c.append(cr.append(ct, cd, cs));
				childDivs.push('<div id="subtab-' + cnt + '" class="sub-tab">' + h.html() + '</div>');

				cnt++;
			}

			subcontent = `<div class='tabs-sub settings-sub'>`;
			subcontent += `<ul class='vertical'>${childLis.join('')}</ul>`;
			subcontent += childDivs.join('');
			subcontent += `</div>`;

			div.push(`<div id='tab-${i}' class="settings-wrapper">${subcontent}</div>`);
		}

		content = `<div class='tabs settings'>`;
		content += `<ul class='horizontal dark-bg'>${parentLis.join('')}</ul>`;
		content += div.join('');
		content += `</div>`;

		// wait for html in the DOM
		$('#SettingsBoxBody').html(content).promise().done(function () {
			// init Tabslet
			if (activeTab) 
				$('.settings').tabslet({active: activeTab});
			else 
				$('.settings').tabslet();
			
			if (activeSubTab) 
				$('.settings-sub').tabslet({active: activeSubTab});
			else 
				$('.settings-sub').tabslet();
		});


		$('#SettingsBoxBody').off('click.settings change.settings')
			.on('click.settings', 'input.setting-check', function () {
				Settings.StoreSettings($(this));
			})
			.on('change.settings', 'input[name="nSound"]:checked', function () {
				FH.Storage.setItem('hammerSound', $(this).val());
			})
			.on('change.settings', '.module-sound-select', function () {
				let mod = $(this).data('module'),
					val = $(this).val();

				if (val === '') {
					FH.Storage.removeItem('hammerSound_' + mod);
				} else {
					FH.Storage.setItem('hammerSound_' + mod, val);
				}
			})
			.on('click.settings', '.sound-preview', function () {
				let file = $(this).data('file') || FH.helper.sounds.getSoundFile($(this).data('module'));
				FH.helper.sounds.playFile(file);
			});
		$('.setting [data-original-title]').tooltip({
			container: 'body',
			html: true,
		});
	},

	NoCallback: () => {
		return;
	},


	StoreSettings: (el, changeText = true) => {
		let id = $(el).data('id'),
			v = $(el).prop('checked');

		FH.Storage.setItem(id, v);

		if (changeText === false) {
			return;
		}

		$(el).prev().text(v === true ? FH.t('Boxes.Settings.Active') : FH.t('Boxes.Settings.Inactive'));

		if (v === true) {
			$(el).closest('span.check').removeClass('unchecked');
		} else {
			$(el).closest('span.check').addClass('unchecked');
		}
	},


	GetSetting: (name, is_string = false) => {
		let s = FH.Storage.getItem(name);

		if (s !== null) {
			return is_string ? s : JSON.parse(s);
		} 
		else {

			if (Settings.Preferences === null) {
				console.error('Error getting default value of setting "' + name + '". config.json not loaded');
				return null;

			} else {
				return Settings.Preferences.find(itm => itm['name'] === name)?.status;
			}
		}
	},

	SetSetting: (name, value) => {
		let s = FH.Storage.setItem(name, value);
	},

	VersionInfo: () => {
		let v = '<ul>';
		v +=	FH.BaseData.extVersion.includes('beta') ? `` : `<li><b>${FH.t('Settings.Version.Link').replace('__version__', '')}</b></li>`;
		v +=	`<li><a href="${FH.extUrl}content/about.html" target="_blank">${FH.t('Settings.About.Title')}</a></li>
				<li><a href="${FH.extUrl}content/help.html" target="_blank">${FH.t('Settings.Help.Title')}</a></li>
				</ul>
				<p>${FH.t('Settings.Version.Donate')}</p> <a class="kofi" href="https://ko-fi.com/forgehammer" target="_blank"><img src="${FH.extUrl}images/kofi.png" height="22" /> Support us on Ko-fi! </a>
				<div class="info-box">
					<span><b>${FH.t('Boxes.General.Version')}</b> ${FH.BaseData.extVersion}</span>
					<span><b>${FH.t('Settings.Version.PlayerId')}</b> ${FH.Player.ID}</span>
					<span><b>${FH.t('Settings.Version.GuildId')}</b> ${(FH.Guild.ID ? FH.Guild.ID : 'N/A')}</span>
					<span><b>${FH.t('Settings.Version.World')}</b> ${FH.World}</span>
					<span><small><code>${navigator.userAgent}</code></small></span>
				</div>`;
		return v;
	},


	LoadBeta: () => {
		return `<a href="https://github.com/outoftheline/forge-hammer/archive/refs/heads/main.zip" class="btn">${FH.t('Settings.LoadBeta2.Button')}</a>`;
	},


	GameFilters: () => {
		const defaultValues = {
			brightness: 1,
			contrast: 1,
			saturation: 1,
			hue: 0,
		};

		let filters = JSON.parse(FH.Storage.getItem('hammerGameFilters')) ?? { ...defaultValues };

		const applyFilters = () => {
			$('#game-container').css('filter',
				`brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation}) hue-rotate(${filters.hue}deg)`
			);
			FH.Storage.setItem('hammerGameFilters', JSON.stringify(filters));
		};

		const syncInputs = () => {
			for (const [name, value] of Object.entries(filters)) {
				const input = $(`#game${name}`);
				input.val(value);
				input.next('output').text(value);
			}
		};

		let v = `<ul class="gameFilters foe-table">
			<li><span>${FH.t('Boxes.Settings.GameFilters.Brightness')}</span> <input type="range" name="brightness" id="gamebrightness" min="0.1" max="1.5" step="0.01" value="${filters.brightness}" /> <output for="gamebrightness">${filters.brightness}</output></li>
			<li><span>${FH.t('Boxes.Settings.GameFilters.Contrast')}</span> <input type="range" name="contrast" id="gamecontrast" min="0.5" max="1.5" step="0.01" value="${filters.contrast}" /> <output for="gamecontrast">${filters.contrast}</output></li>
			<li><span>${FH.t('Boxes.Settings.GameFilters.Saturation')}</span> <input type="range" name="saturation" id="gamesaturation" min="0" max="1.5" step="0.01" value="${filters.saturation}" /> <output for="gamesaturation">${filters.saturation}</output></li>
			<li><span>${FH.t('Boxes.Settings.GameFilters.Hue')}</span> <input type="range" name="hue" id="gamehue" min="0" max="360" step="1" value="${filters.hue}" /> <output for="gamehue">${filters.hue}</output></li>
		</ul>
		<button class="btn resetColors my-5">${FH.t('Boxes.General.Reset')}</button>`;

		$('#SettingsBoxBody')
			.off('change.gameFilters click.gameFilters')
			.on('change.gameFilters', 'input[name="brightness"], input[name="contrast"], input[name="saturation"], input[name="hue"]', function () {
				filters[this.name] = parseFloat(this.value);
				$(this).next('output').text(this.value);
				applyFilters();
			})
			.on('click.gameFilters', '.resetColors', function () {
				filters = { ...defaultValues };
				syncInputs();
				applyFilters();
			});

		return v;
	},


	ExportView: () => {
		return `<p><button class="btn" onclick="DBExport.BuildBox()">${FH.t('Settings.ExportSettings.OpenImportExportTool')}</button></p>`;
	},


	ExportSettings: () => {
		let settings = {};

		Object.keys(localStorage).forEach((key) => {

			if (
				key.indexOf('Cords') > -1 ||
				key.indexOf('Size') > -1 ||
				key.indexOf('CopyName') > -1 ||
				key.indexOf('MenuSort') > -1 ||
				key.indexOf('Tone') > -1 ||
				key.indexOf('ForderBonus') > -1 ||
				key.indexOf('hammerSound') > -1
			) {
				settings[key] = FH.Storage.getItem(key);
			}
		});

		let json = JSON.stringify(settings),
			blob1 = new Blob([json], { type: "application/json;charset=utf-8" }),
			file = `${FH.World}-${FH.Player.ID}.json`;

		FH.Main.ExportFile(blob1, file);
	},


	MenuAppearanceSettings: () => {
		let dp = [],
			lengthValue = FH.Storage.getItem('MenuLength'),
			sizeValue = FH.Storage.getItem('MenuBtnSize');

		dp.push(`<div class="p5 bbd">
			<label for="change-menu">${FH.t('Settings.MenuAppearance.Position')}</label><br />
			<select class="setting-dropdown" id="change-menu">`);
		for (let index = 0; index < FH.menu.MenuOptions.length; index++) {
			const element = FH.menu.MenuOptions[index];
			if (element[Object.keys(element)[0]]) {
				dp.push('<option value="' + element + '"' + (FH.Main.SelectedMenu === element ? ' selected' : '') + '>' + FH.t('Menu.' + element) + '</option>');
			}
		}
		dp.push(`</select>
		</div>`);

		dp.push(`<div class="p5 bbd">
			<label for="menu-input-length">${FH.t('Settings.MenuAppearance.Length')}</label><br />
			<input class="setting-input" type="number" id="menu-input-length" step="1" min="2" value="${lengthValue !== null ? lengthValue : ''}" />
		</div>`);

		// menu button size input
		dp.push(`<div class="p5">
			<label for="menu-btn-size-input">${FH.t('Settings.MenuAppearance.Size')}</label><br />
			<input class="setting-input" type="range" id="menu-btn-size-input" step="1" min="24" max="64" value="${sizeValue !== null ? sizeValue : ''}" />
		</div>`);

		$('#SettingsBoxBody').off('change.changeMenu').on('change.changeMenu', '#change-menu', function () {
			let selMenu = $(this).val();
			FH.Storage.setItem('SelectedMenu', selMenu);
			FH.menu.SwitchMenu(selMenu);
		});

		$('#SettingsBox').off('keyup.menuInputLength').on('keyup.menuInputLength', '#menu-input-length', function () {
			let value = $(this).val();

			if (value > 0) {
				FH.Storage.setItem('MenuLength', value);
			} else {
				FH.Storage.removeItem('MenuLength');
			}

			FH.menu.UpdateMenuLength();
		});

		$('#SettingsBox').off('change.menuBtnSizeInput').on('change.menuBtnSizeInput', '#menu-btn-size-input', function () {
			let value = $(this).val();

			if (value >= 24 && value <= 64) {
				FH.Storage.setItem('MenuBtnSize', value);
			} else {
				FH.Storage.removeItem('MenuBtnSize');
			}

			FH.menu.ApplyMenuBtnSize();
			FH.menu.UpdateMenuLength();
		});

		return dp.join('');
	},


	SoundPreviewButton: (file, moduleId) => {
		let attr = file ? `data-file="${file}"` : `data-module="${moduleId}"`;
		return `<button type="button" class="btn btn-mid sound-preview" ${attr}>${FH.t('Settings.SoundEffects.play')}</button>`;
	},


	SoundEffects: () => {
		let chosenSound = FH.Storage.getItem('hammerSound') || 'message';

		let rows = Settings.SoundList.map((s) => `
			<li>
				<input name="nSound" value="${s}" type="radio" ${chosenSound === s ? 'checked' : ''} />
				${Settings.SoundPreviewButton(s)}
				<label>${FH.t('Settings.SoundEffects.' + s)}</label>
			</li>`
		);

		return `<ul class="soundEffects simpleList">${rows.join('')}</ul>`;
	},


	ModuleSounds: () => {
		let rows = Settings.SoundModules.map((module) => {
			let key = 'hammerSound_' + module.id;
			let chosen = FH.Storage.getItem(key) || '';

			let options = [`<option value="">${FH.t('Settings.SoundEffects.default')}</option>`]
				.concat(Settings.SoundList.map((s) =>
					`<option value="${s}"${chosen === s ? ' selected' : ''}>${FH.t('Settings.SoundEffects.' + s)}</option>`
				));

			return `<li>
				<select class="setting-dropdown module-sound-select" data-module="${module.id}">${options.join('')}</select>
				${Settings.SoundPreviewButton(null, module.id)}
				<span>${FH.t(module.label)}</span>
			</li>`;
		});

		return `<ul class="moduleSounds simpleList">${rows.join('')}</ul>`;
	},


	OpenModuleSoundSettings: () => {
		Settings.BuildBox(2, 4);
	},
	OpenModuleDecayedBuildingSettings: () => {
		Settings.BuildBox(2, 6);
	},


	/**
	 * Import saved settings
	 * @constructor
	 */
	ImportSettings: () => {
		let file = document.getElementById("import-settings").files[0];

		if (file) {
			let reader = new FileReader();
			reader.readAsText(file, "UTF-8");

			reader.onload = function (evt) {

				const parts = JSON.parse(evt.target.result);

				Object.keys(parts).forEach((key) => {
					FH.Storage.setItem(key, parts[key]);
				});

				alert(FH.t('Settings.ExportImport.Reload'));
				location.reload();
			}

			reader.onerror = function (evt) {
				alert(FH.t('Settings.ExportImport.Error'));
			}
		}
	},


	ShowEventHelpers: () => {
		let eventHelperSettings = {'EventHelperMerge': true, 'EventHelperPresent': true, 'EventHelperIdle': true, 'EventHelperPop': true};
		let dp = [];
		
		dp.push('<div class="p5">');
		dp.push('<b>'+FH.t('Settings.EventHelper.Advanced')+'</b>')
		for (let [setting, value] of Object.entries(eventHelperSettings)) {
			let savedSetting = FH.Storage.getItem(setting);
			if (savedSetting !== null) {
				value = JSON.parse(savedSetting);
			}
			dp.push('<div>');
			dp.push( '<span class="check ' + (value ? '' : 'unchecked') + '">' +
				'<span class="toogle-word">' + (value ? FH.t('Boxes.Settings.Active') : FH.t('Boxes.Settings.Inactive')) + '</span>' +
				'<input name="'+setting+'" data-id="'+setting+'" class="setting-check game-cursor" type="checkbox" ' + (value ? 'checked' : '') + ' />' +
			'</span>');
			dp.push(FH.t('Settings.'+setting)+'</div>');
		}
		dp.push('</div>');
		dp.push('<br/><b>'+FH.t('Settings.EventHelper.All')+'</b><br/>');
		return dp.join('');
	},


	/**
	 * Resets all Box Coordinated to the default values
	 */
	ResetBoxCoords: () => {
		$.each(localStorage, function (key, value) {
			if (key.toLowerCase().indexOf('cords') > -1) {
				FH.Storage.removeItem(key);
			}
		});

		FH.HTML.ShowToastMsg({
			head: FH.t('Boxes.Settings.DeletedBoxCoordsHead'),
			text: FH.t('Boxes.Settings.DeletedBoxCoordsBody'),
			type: 'success',
			hideAfter: 4000
		});
	},


	SelectWebsite: () => {
		let dp = [];
		let currentSite = FH.Storage.getItem('linkSite') || "siteScoredb";
		dp.push('<p>Choose your preferred website:<br />');
		dp.push('<label for="scoredb"><input type="radio" value="siteScoredb" id="scoredb" name="website" '+(currentSite === "siteScoredb" ? 'checked' : "")+' /> foe.scoredb.io</label><br />');
		dp.push('<label for="forgedb"><input type="radio" value="siteForgedb" id="forgedb" name="website" '+(currentSite === "siteForgedb" ? 'checked' : "")+' /> foestats.com</label></p>');

		$('#SettingsBoxBody').off('change.selectWebsite').on('change.selectWebsite', 'input[name="website"]', function () {
			let site = $(this).val();
			FH.Storage.setItem('linkSite', site);
		});
		return dp.join('');
	},


	LanguageDropdown: () => {
		let dp = [];

		dp.push('<select class="setting-dropdown" id="change-lang">');
		for (let iso in FH.Languages.PossibleLanguages) {
			if (!FH.Languages.PossibleLanguages.hasOwnProperty(iso)) {
				break;
			}

			dp.push('<option value="' + iso + '"' + (FH.Main.Language === iso ? ' selected' : '') + '>' + FH.Languages.PossibleLanguages[iso] + '</option>');
		}
		dp.push('</select>');

		if (FH.Storage.getItem('user-language') !== "de") {
			dp.push(`<hr />${FH.t('Settings.ChangeLanguage.TranslateDescription')} <a href="#" onClick="FH.Translation.Show()">${FH.t('Settings.ChangeLanguage.Translate')}</a>`);
		}

		$('#SettingsBoxBody').off('change.changeLang').on('change.changeLang', '#change-lang', async function () {
			let uLng = $(this).val();

			FH.Storage.setItem('user-language', uLng);

			await FH.LoadLanguage(uLng);

			let activeTab = $('.tabs.settings > ul.horizontal > li.active'),
				activeTabIdx = activeTab.index(),
				activeTabTarget = activeTab.find('a').attr('href'),
				activeSubTabIdx = activeTabTarget ? $(activeTabTarget + ' .settings-sub > ul.vertical > li.active').index() : -1;

			Settings.BuildBody(
				activeTabIdx >= 0 ? activeTabIdx + 1 : null,
				activeSubTabIdx >= 0 ? activeSubTabIdx + 1 : null
			);
		});

		return dp.join('');
	},


	/**
	 * Default date/time formats used by the extension, see FH.DateFormat.
	 */
	DateTimeFormats: () => {
		const presets = {
			dateShort: ['DD/MMM', 'DD.MM.', 'DD/MM', 'MM/DD', 'MM.DD', 'MM-DD', 'D MMM', 'ddd DD'],
			dateLong: ['DD/MMM/YYYY', 'DD.MM.YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'YYYY.MM.DD', 'D MMMM YYYY', 'ddd, DD MMM YYYY'],
			dateTimeShort: ['DD/MMM, HH:mm', 'DD.MM. HH:mm', 'DD/MM HH:mm', 'MM/DD hh:mm a', 'MM-DD HH:mm', 'MM.DD HH:mm', 'ddd HH:mm', 'HH:mm'],
			dateTimeLong: ['DD/MMM, hh:mm:ssa', 'DD/MMM/YYYY HH:mm:ss', 'DD.MM.YYYY HH:mm:ss', 'YYYY-MM-DD HH:mm:ss', 'YYYY.MM.DD HH:mm:ss', 'MM/DD/YYYY hh:mm:ss a', 'ddd, DD MMM YYYY HH:mm:ss']
		};

		// sample of the current time, so every option shows what it produces
		const sample = () => moment(FH.Main.getCurrentDateTime());

		const store = (type, pattern) => {
			let key = FH.DateFormat.Types[type].storage;

			pattern = (pattern || '').trim();

			if (pattern === '') {
				FH.Storage.removeItem(key);
			} else {
				FH.Storage.setItem(key, pattern);
			}

			FH.DateFormat.clearCache();
		};

		const showPreview = (row) => {
			row.find('.dateformat-preview').text(sample().format(FH.DateFormat.get(row.data('type'))));
		};

		let v = ['<div class="dateFormats">'];

		for (let [type, formats] of Object.entries(presets)) {
			let d = FH.DateFormat.Types[type],
				def = FH.DateFormat.default(type), // format of the language file, always the first option
				current = FH.Storage.getItem(d.storage),
				custom = current !== null && current !== def && !formats.includes(current),
				label = FH.t('Settings.DateTimeFormat.' + type.charAt(0).toUpperCase() + type.slice(1)),
				options = [`<option value=""${current === null ? ' selected' : ''}>${sample().format(def)} &mdash; ${FH.t('Settings.DateTimeFormat.Default')}</option>`];

			for (let f of formats.filter(f => f !== def)) {
				options.push(`<option value="${FH.HTML.escapeHtml(f)}"${current === f ? ' selected' : ''}>${sample().format(f)} &mdash; ${f}</option>`);
			}

			options.push(`<option value="custom"${custom ? ' selected' : ''}>${FH.t('Settings.DateTimeFormat.Custom')}</option>`);

			let id = `dateformat-${type}`;

			v.push(`<div class="dateformat-row${custom ? ' custom' : ''}" data-type="${type}">
					<label for="${id}">${label}</label>
					<select class="setting-dropdown dateformat-select" id="${id}" name="${id}">${options.join('')}</select>
					<input type="text" class="dateformat-custom" id="${id}-custom" name="${id}-custom" autocomplete="off" aria-label="${label} - ${FH.t('Settings.DateTimeFormat.Custom')}" placeholder="${FH.HTML.escapeHtml(def)}" value="${custom ? FH.HTML.escapeHtml(current) : ''}" />
					<span class="dateformat-preview">${custom ? sample().format(current) : ''}</span>
				</div>`);
		}

		v.push('</div>');
		v.push(`<p class="text-smaller">${FH.t('Settings.DateTimeFormat.CustomHint')} <a href="https://momentjs.com/docs/#/displaying/format/" target="_blank">momentjs.com</a></p>`);
		v.push(`<button class="btn resetDateFormats my-5">${FH.t('Boxes.General.Reset')}</button>`);

		$('#SettingsBoxBody')
			.off('change.dateFormats input.dateFormats click.dateFormats')
			.on('change.dateFormats', 'select.dateformat-select', function () {
				let row = $(this).closest('.dateformat-row'),
					type = row.data('type'),
					value = $(this).val();

				row.toggleClass('custom', value === 'custom');

				if (value === 'custom') {
					store(type, row.find('input.dateformat-custom').val());
					showPreview(row);
				} else {
					store(type, value);
				}
			})
			.on('input.dateFormats', 'input.dateformat-custom', function () {
				let row = $(this).closest('.dateformat-row');

				store(row.data('type'), $(this).val());
				showPreview(row);
			})
			.on('click.dateFormats', '.resetDateFormats', function () {
				for (let d of Object.values(FH.DateFormat.Types)) {
					FH.Storage.removeItem(d.storage);
				}

				FH.DateFormat.clearCache();

				let rows = $('.dateFormats .dateformat-row').removeClass('custom');

				rows.find('select.dateformat-select').val('');
				rows.find('input.dateformat-custom').val('');
			});

		return v.join('');
	},


	ChooseSkin: () => {
		let dp = [];

		let skins = [
			{name: "Forge Hammer", path: "themes/hammer"},
			{name: "Oldschool", path: "variables"},
			{name: "Dark", path: "themes/grey"},
			{name: "Blues", path: "themes/blues"},
			{name: "Quantum", path: "themes/qi"},
			{name: "Titan", path: "themes/titan"},
			{name: "Oceanic", path: "themes/oceanic"},
			{name: "Eternal", path: "themes/eternal"}
		];

		let currentSkin = FH.Storage.getItem('HammerSkin')||"variables";

		dp.push('<select class="setting-dropdown" id="changeSkin">');
		for (let skin of Object.values(skins)) {
			dp.push('<option value="' + skin.path + '"' + (currentSkin === skin.path ? ' selected' : '') + '>' + skin.name + '</option>');
		}
		dp.push('</select>');

		$('#SettingsBoxBody').off('change.changeSkin').on('change.changeSkin', '#changeSkin', function () {
			let skin = $(this).val();
			FH.Storage.setItem('HammerSkin', skin);
			FH.HTML.ChangeSkinCssFile(skin);
		});

		return dp.join('');
	},


	GexStockWarning: () => {
		let ip = $('<input />').addClass('setting-input').attr({
			type: 'number',
			id: 'GexStockWarningInput',
			step: 1,
			min: 0,
			max: 100
		}),
		value = JSON.parse(FH.Storage.getItem('GexStockWarningMin')||"100");
		
		ip[0].defaultValue = ip[0].value = value;
		ip.val(value);
	
		$('#SettingsBox').off('keyup.gexStockWarningInput').on('keyup.gexStockWarningInput', '#GexStockWarningInput', function () {
			let value = $(this).val();

			if (value >= 0 && value <= 100) {
				FH.Storage.setItem('GexStockWarningMin', value);
			} else {
				FH.Storage.setItem('GexStockWarningMin', 100);
				$(this).val(100)
			}
		});

		return ip;
	},
	

	doubleFPtimeout: () => {
		let ip = $('<input />').addClass('setting-input').attr({
			type: 'number',
			id: 'doubleFPtimeoutinput',
			step: 1,
			min: 0
		}),
		value = FH.Storage.getItem('doubleFPtimeout');
		ip[0].defaultValue = ip[0].value = value;

		if (null !== value) {
			ip.val(value);
		}

		$('#SettingsBox').off('keyup.doubleFPtimeoutInput').on('keyup.doubleFPtimeoutInput', '#doubleFPtimeoutinput', function () {
			let value = Number($(this).val());
			if (value > 0) {
				FH.Storage.setItem('doubleFPtimeout', value);
			} else {
				FH.Storage.removeItem('doubleFPtimeout');
			}

		});

		return ip;
	},


	/**
	 * Add all the buttons you need
	 */
	MenuContent: () => {
		let bl = $('<div />'),
			menuItems = Array.from(FH.menu.Items),
			HiddenItems = FH.Storage.getItem('MenuHiddenItems'),
			hiddenArray = [];

		// Reattach already hidden icons
		if (HiddenItems !== null) {
			hiddenArray = JSON.parse(HiddenItems);
			menuItems.push(...hiddenArray);
		}

		for (let i in menuItems) {
			if (!menuItems.hasOwnProperty(i)) break;

			const name = menuItems[i];
			if(name === 'settings') continue;

			// is there a function?
			if (FH.menu[name + '_Btn']) {
				let btnBG = $('<div />')
					.attr({ id: `setting-${name}-Btn` })
					.addClass('hud-btn')
					.addClass(hiddenArray.includes(name) ? 'hud-btn-red' : '');
				let btnData = FH.menu.ItemsData.find(x => x.id === name);

				let btn = $(`<span onclick="FH.menu.ToggleItemVisibility('${name}')" data-original-title="<b>${btnData?.title||""}</b><br>${btnData?.description.replace(/<[^>]+>/g, '')||""}"></span>`);
		
				btnBG.append(btn);
				bl.append(btnBG);
			}
		}

		return bl.html();
	},


	/**
	 *	Erzeugt ein Input Feld
	 *
	 * @returns {null|undefined|jQuery}
	 */
	InfoboxInputEntryCount: () => {
		let ip = $('<input />').addClass('setting-input').attr({
			type: 'number',
			id: 'infobox-entry-length',
			step: 1,
			min: 1
		}),
		value = FH.Storage.getItem('EntryCount') || 0;
		ip[0].defaultValue = ip[0].value = value;

		FH.Storage.setItem('EntryCount', value);

		$('#SettingsBox').off('keyup.infoboxEntryLength').on('keyup.infoboxEntryLength', '#infobox-entry-length', function () {
			let value = $(this).val();

			if (value > 0) {
				FH.Storage.setItem('EntryCount', value);
			} else {
				FH.Storage.setItem('EntryCount', 0);
			}

			Infoboard.MaxEntries = value;
		});

		return ip;
	},


	NotificationView: () => {
		let elements = [],
			settingPos = FH.Storage.getItem('NotificationsPosition'),
			positions = [
				'bottom-left',
				'bottom-right',
				'top-right',
				'top-left',
				'bottom-center',
				'top-center',
				'mid-center'
			];

		if (!settingPos) {
			settingPos = 'bottom-right';
		}

		elements.push('<select class="setting-dropdown" id="notification-position">');

		for (let pos in positions) {
			if (!positions.hasOwnProperty(pos)) { break; }

			elements.push(`<option value="${positions[pos]}"${(settingPos === positions[pos] ? ' selected' : '')}>${FH.t('Menu.Notification.Position.' + positions[pos])}</option>`);
		}

		elements.push('</select>');

		$('#SettingsBoxBody').off('change.notificationPosition').on('change.notificationPosition', '#notification-position', function () {
			$('.jq-toast-wrap').remove();

			let pos = $(this).val();

			FH.Storage.setItem('NotificationsPosition', pos);

			$.toast({
				heading: FH.t('Settings.NotificationPosition.ToastTestHeader'),
				text: FH.t('Settings.NotificationPosition.ToastTestBody'),
				icon: 'success',
				hideAfter: 6000,
				position: pos,
				extraClass: FH.Storage.getItem('SelectedMenu') || 'RightBar',
				afterHidden: function () {
					$('.jq-toast-wrap').remove();
				}
			});
		});

		return elements.join('');
	},


	NotificationStack: ()=> {
		let ip = $('<input />').addClass('setting-input').attr({
				type: 'number',
				id: 'toast-amount',
				step: 1,
				min: 1
			}),
			value = FH.Storage.getItem('NotificationStack');

		if (null !== value) {
			ip[0].defaultValue = ip[0].value = value;
			ip.val(value);
		}

		$('#SettingsBox').off('keyup.toastAmount').on('keyup.toastAmount', '#toast-amount', function () {
			let value = $(this).val();

			if (value > 0) {
				FH.Storage.setItem('NotificationStack', value);

			} else {
				FH.Storage.removeItem('NotificationStack');
			}
		});

		return ip;
	},
};

Settings.Init(); // May be called here, as no other modules are required. config.json should be loaded by StartUp