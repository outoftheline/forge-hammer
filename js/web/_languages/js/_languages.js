/*
 * Copyright (C) 2026 Forge Hammer team - All Rights Reserved
 * Licensed under AGPL - see LICENSE.md for details.
 */

if (typeof FH === 'undefined') {
	var FH = {};
}
[FH.Translation,FH.Languages] = (()=>{
Languages = {
	PossibleLanguages: {
		'bs': 'Bosanski',
		'ca': 'Català',
		'cs': 'Český',
		'de': 'Deutsch',
		'dk': 'Dansk',
		'el': 'Ελληνικά',
		'en': 'English',
		'es': 'Español',
		'fi': 'Suomi',
		'fr': 'Français',
		'hu': 'Magyar',
		'it': 'Italiano',
		'ja': '日本語',
		//'nb_NO': 'Norsk bokmål',
		'nl': 'Nederlands',
		//'nn': 'Nynorsk',
		'pl': 'Polski',
		'pt': 'Português',
		'pt-br': 'Português do Brasil',
		'ro': 'Română',
		'ru': 'Русский',
		'sk': 'Slovenčina',
		'sr_Latn': 'Srpski (latinica)',
		'sv': 'Svenska',
		'tr': 'Türkçe',
		'uk': 'Українська',
	},
};

Translation = {
	targetData: null,
	referenceData: null,
	tempData: JSON.parse((window.FH? FH.Storage.getItem('Translation.Temp') : localStorage.getItem('Hammer.Translation.Temp')) || '{}'),
	CopyReference: (window.FH? FH.Storage.getItem('Translation.CopyRef') : localStorage.getItem('Hammer.Translation.CopyRef')) || 'Conditional',
	CopyRefOptions: ["No","Conditional","Once","Always"],
	getString: (entry) => {
		if (entry == null) return '';
		if (typeof entry === 'object') return entry.s ?? '';
		return String(entry);
	},
	Show: ()=> {
		if ( $('#Translation').length === 0 ) {

			FH.HTML.AddCssFile('_languages');

			FH.HTML.Box({
				id: 'Translation',
				title: i18n('Boxes.Translation.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true
			});		
			let html = `
				<div id="TranslationHead" class="p5">
					<label for="TargetLanguage">${i18n('Boxes.Translation.TargetLanguage')}</label>
					<select id="TargetLanguage">
						<option value="" disabled selected>${i18n('Boxes.Translation.SelectLanguage')}...</option>
						${Object.entries(Languages.PossibleLanguages).map(([code, name])=>`<option value="${code}">${name}</option>`).join('')}
					</select>
					<input type="text" id="TranslationSearch" placeholder="${i18n('Boxes.Translation.SearchPlaceholder')}" length="50"/>
					<label for="ComparisonLanguage">${i18n('Boxes.Translation.ComparisonLanguage')}</label>
					<select id="ComparisonLanguage">
						${Object.entries(Languages.PossibleLanguages).map(([code, name])=>`<option value="${code}" ${code === 'de' ? 'selected' : ''}>${name}</option>`).join('')}
					</select>
					<select id="CopyReference">
						${Translation.CopyRefOptions.map((x)=>`<option value="${x}" ${Translation.CopyReference==x ? 'selected':""}>${i18n('Boxes.Translation.Reference.'+x)}</option>`).join("")}
					</select>
					<br />
					<input type="checkbox" id="ShowOnlyMissing" />
					<label for="ShowOnlyMissing">${i18n('Boxes.Translation.ShowOnlyMissing')}</label>
					<input type="checkbox" id="ShowOnlyUpdated" />
					<label for="ShowOnlyUpdated">${i18n('Boxes.Translation.ShowOnlyUpdated')}</label>
				</div>
				<table id="TranslationTable" class="foe-table">
					<thead>
						<tr>
							<th>${i18n('Boxes.Translation.Key')}</th>
							<th>${i18n('Boxes.Translation.Reference')}</th>
							<th>${i18n('Boxes.Translation.Target')}</th>
						</tr>
					</thead>
					<tbody>
					</tbody>
				</table>
				<div id="TranslationFooter" class="flex between">
					<div class="p5" id="CopyJSONInfo">
						<h2>How to help translate</h2> 
						<ul>
							<li>Using a local version of the <a href="https://github.com/outoftheline/forge-hammer/develop" target="_blank">Forge Hammer develop branch</a></li> is preferred, so you have the latest changes, but optional
							<li>Add missing translations or correct faulty ones</li>
							<li>Confirm correctness of translations where appropriate by clicking the checkmark icon - mainly for the first pass-over after Forge Hammer release</li>
							<li>Use the Copy JSON button on the right to copy the translation data</li>
							<li>Submit the copied JSON data in the Translation channel on our <a href="https://discord.gg/M32xurRsQ9" target="_blank">Discord server</a></li>
							<li>You can save your translation progress locally - it also is applied to the extension directly then, although some strings might need a reload</li>
							<li>If you use a fork of the extension, you can also copy the JSON data into the respective language file and create a pull request on Github to get your changes merged.</li>
							</br>
							<li>Please keep __values__ that are encased by double underscores untranslated! These are parameters that are repaced with values during runtime.</li>
							<li>Please keep &lt;FH.HTML.ode&gt; between the angle backets as is. Those are needed for correct formatting. For &lt;someFH.HTML.gtText&lt;someMoreFH.HTML.gt; hwever, the Text between FH.HTML.Code sections can translated</li>
							</br>
							<li>You can select whether to copy the reference text into the input field on entering it. Conditional copy means, the reference is inserted only when the current translation is empty and the reference text includes FH.HTML.or place holders.</li>
						</ul>
					</div>
					<div class="p5">
						<span class="btn btn-default" id="CopyJSON">${i18n('Boxes.Translation.CopyJSON')}</span>
						<span class="btn btn-default" id="TempStorage">${i18n('Boxes.Translation.TempStorage')}</span>
						<span class="btn btn-default" id="ClearStorage">${i18n('Boxes.Translation.ClearStorage')}</span>
					</div>
				</div>
			`

			$('#TranslationBody').html(html)
		}
		$('#TargetLanguage').on('change', Translation.UpdateTable);
		$('#ComparisonLanguage').on('change', Translation.UpdateTable);
		$('#ShowOnlyMissing').on('change', ()=>{
			$('#TranslationTable')[0].classList.toggle('show-only-missing', $('#ShowOnlyMissing')[0].checked);
		});
		$('#ShowOnlyUpdated').on('change', ()=>{
			$('#TranslationTable')[0].classList.toggle('show-only-updated', $('#ShowOnlyUpdated')[0].checked);
		});
		$('#TranslationSearch').on('input', Translation.FilterTable);
		$('#CopyJSON').on('click', ()=>{
			let data = structuredClone(Translation.targetData);
			data = Object.entries(data)
						.sort((a, b) => a[0].localeCompare(b[0]))
						.map(([key, value])=>({[key]: value}));
			data = Object.assign({},...data)
			navigator.clipboard.writeText(JSON.stringify(data, null, 2));
		});
		$('#TempStorage').on('click', ()=>{
			Translation.tempData = structuredClone(Translation.targetData);
			FH.Storage.setItem('Translation.Temp', JSON.stringify(Translation.tempData));
		});
		$('#ClearStorage').on('click', ()=>{
			Translation.tempData = {};
			FH.Storage.removeItem('Translation.Temp');
		});
		$('#TranslationTable').on('mousedown', 'td:nth-child(3)', function() {
			setTimeout(()=>{
				let td = $(this);
				if (td.find('textarea').length > 0) return;
				let currentValue = $(this).find('span').html();
				if (undefined === currentValue) return;
				let ref = td.prev()
				let refvalue = ref.html()
				ref.html(`<textarea disabled>${refvalue}</textarea>`);
				
				td.html(`<textarea></textarea><span class="hidden">${currentValue}</span>`);
				
				if (['Once', 'Always'].includes(Translation.CopyReference) || (Translation.CopyReference == 'Conditional' && !currentValue && (/<.*?>/.test(refvalue) || /__.*?__/.test(refvalue))))
					currentValue = refvalue;
				td.find('textarea').val(currentValue).focus();

				if (Translation.CopyReference == 'Once') {
					Translation.CopyReference = FH.Storage.getItem('Translation.CopyRef') || 'Conditional'
					$('#CopyReference')[0].value = Translation.CopyReference
				}
				
			},50)
		});
		$('#TranslationTable').on('mousedown', 'td:nth-child(3) b', function(e) {
			let key = $(this).parent().siblings(':first').html();
			Translation.targetData[key] = {s: Translation.targetData[key]?.s || Translation.targetData[key], r:Translation.referenceData[key]?.s || Translation.referenceData[key]};
			$(this).remove();
			e.stopPropagation();
		});
		$('#TranslationTable').on('blur', 'td:nth-child(3) textarea', function() {
			let textarea = $(this);
			let td = textarea.parent();
			
			let ref = td.prev()
			let refvalue = ref.find('textarea').val()
			ref.html(refvalue);
			
			let key = textarea.parent().siblings(':first').html();
			let originalValue = textarea.next().html();
			let newValue = textarea.val();
			if (newValue.trim() === '') newValue = '';
			if (newValue.length < originalValue.length) {
				if (!confirm(i18n('Boxes.Translation.EditValuePrompt'))) {
					newValue = originalValue;
				}
			}
			
			if (newValue != originalValue && newValue !== '') 
				Translation.targetData[key] = {s: newValue, r: Translation.getString(Translation.referenceData[key])};
			let reference = Translation.getString(Translation.referenceData[key]);
			let updated = !Translation.targetData[key]?.r || reference !== Translation.targetData[key]?.r;
			td.html(`${(updated && newValue != "") ? `<b title="click to confirm translation as correct">✓ </b>` : ''}<span>${newValue}</span>`);
			td.attr('title', ``);	

		})
		$('#CopyReference').on('change', function () {
			option = Translation.CopyReference = this.value;
			if (option != "Once") FH.Storage.setItem('Translation.CopyRef', option);
		})


	},

	UpdateTable: async ()=> {
		let target = $('#TargetLanguage')[0].value;
		let comparison = $('#ComparisonLanguage')[0].value;

		Translation.targetData = await fetch(FH.extUrl + 'js/web/_languages/json/'+target+'.json').then(res=>res.json()).catch(()=>({}));
		Translation.referenceData = await fetch(FH.extUrl + 'js/web/_languages/json/en.json').then(res=>res.json()).catch(()=>({}));
		let comparisonData = await fetch(FH.extUrl + 'js/web/_languages/json/'+comparison+'.json').then(res=>res.json()).catch(()=>({}));
		
		referenceData = Object.entries(Translation.referenceData).sort((a, b) => a[0].localeCompare(b[0])).map(([key, reference])=>({key, reference}));
		let rowsHtml = referenceData.map(({key, reference})=>{
			let targetValue = Translation.getString(Translation.targetData?.[key]);
			let comparisonValue = Translation.getString(comparisonData?.[key]);
			let referenceValue = Translation.getString(reference);
			let missing = targetValue.trim() === '';
			let updated = !Translation.targetData?.[key]?.r || referenceValue !== Translation.targetData?.[key]?.r;
			let OldRef = FH.HTML.escapeHtml(Translation.targetData?.[key]?.r || '');
			let showCheckmark = updated && !!targetValue && (Translation.tempData?.[key]?.r !== referenceValue);
			return `<tr class="${missing ? 'missing' : ''} ${updated ? 'updated' : ''}">
				<td>${key}</td>
				<td title="Comparison Value: ${FH.HTML.escapeHtml(comparisonValue)}">${referenceValue}</td>
				<td ${(updated && !!OldRef) ? `title="Old Reference: ${OldRef}"` : ''}>
					${showCheckmark ? `<b title="click to confirm translation as correct">✓ </b>` : ''}
					<span>${Translation.tempData?.[key]?.s || Translation.tempData?.[key] || targetValue}</span>
				</td></tr>`;
		}).join('');
		$('#TranslationTable tbody').html(rowsHtml);
		Translation.FilterTable();
		Translation.targetData=Object.assign(Translation.targetData||{},structuredClone(Translation.tempData||{}))
	},

	FilterTable: ()=> {
		let search = $('#TranslationSearch')[0].value.trim();
		$('#TranslationTable')[0].classList.toggle('search-active', search !== '');
		if (search === '') {
			$('#TranslationTable .found').removeClass('found');
			return;
		}
		try {
			let searchRE = new RegExp(search, 'i');
			$('#TranslationTable tbody tr').each((i, row)=>{
				let key = $(row).find('td:nth-child(1)').html();
				let reference = $(row).find('td:nth-child(2)').html();
				let target = $(row).find('td:nth-child(3)').html();
				if (!searchRE.test(key) && !searchRE.test(reference) && !searchRE.test(target)) {
					$(row)[0].classList.remove('found');
				} else {
					$(row)[0].classList.add('found');
				}
			});
		} catch (err) {

		}
	}
};
return [Translation, Languages];
})()
