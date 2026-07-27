'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const LANG_KEY = 'foe_planner_lang';
    const CANDIDATE_LANGUAGES = [
        'de', 'en', 'fr', 'pl'
    ];

    let translationData = {};
    let ready = false;
    let currentLng = 'en';
    let availableLanguagesPromise = null;
    const readyCallbacks = [];

    function getEntry(key) {
        const entry = translationData[key];
        if (entry && typeof entry === 'object') return entry.s;
        return entry;
    }

    function t(key, fallback) {
        const value = getEntry(key);
        if (value !== undefined && value !== null && value !== '') return value;
        return fallback !== undefined ? fallback : key;
    }

    function getStoredLanguage() {
        try {
            return localStorage.getItem(LANG_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function setStoredLanguage(lng) {
        if (!lng) localStorage.removeItem(LANG_KEY);
        else localStorage.setItem(LANG_KEY, lng);
    }

    async function detectGuiLanguage() {
        const stored = getStoredLanguage();
        if (stored) return stored;

        if (window.browser?.i18n?.getUILanguage) {
            const uiLng = window.browser.i18n.getUILanguage();
            if (uiLng) return uiLng.split('-')[0];
        }

        return 'en';
    }

    async function fetchLanguageFile(lng) {
        try {
            const res = await fetch('../js/web/_languages/json/' + lng + '.json');
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    async function loadTranslations(lng) {
        try {
            const base = (await fetchLanguageFile('en')) || {};
            const guiLng = (lng && lng !== 'auto') ? lng : await detectGuiLanguage();

            let data = base;
            currentLng = 'en';

            if (guiLng && guiLng !== 'en') {
                const overlay = await fetchLanguageFile(guiLng);
                if (overlay) {
                    data = Object.assign({}, base, overlay);
                    currentLng = guiLng;
                }
            }

            translationData = data;
        } catch (e) {
            console.error('Planner translation loading error:', e);
        } finally {
            ready = true;
            applyTranslations();
            populateLanguageSelect();
            readyCallbacks.splice(0).forEach(cb => {
                try { cb(); } catch (e) { console.error(e); }
            });
        }
    }

    async function setLanguage(code) {
        setStoredLanguage(code === 'auto' ? '' : code);
        await loadTranslations(code);
    }

    function onReady(cb) {
        if (ready) cb();
        else readyCallbacks.push(cb);
    }

    function applyTranslations(root) {
        const scope = root || document;
        if (!scope.querySelectorAll) return;

        scope.querySelectorAll('[data-t]').forEach(el => {
            let key = el.getAttribute('data-t');
            if (!key || key === 'true') {
                key = el.textContent;
                el.setAttribute('data-t', key);
            }
            el.innerHTML = t(key, el.innerHTML);
        });

        scope.querySelectorAll('[data-t-title]').forEach(el => {
            const key = el.getAttribute('data-t-title');
            el.title = t(key, el.title);
        });

        scope.querySelectorAll('[data-t-placeholder]').forEach(el => {
            const key = el.getAttribute('data-t-placeholder');
            el.placeholder = t(key, el.placeholder);
        });
    }

    function populateLanguageSelect() {
        const select = app.dom && app.dom.languageSelect;
        if (!select) return;

        if (!availableLanguagesPromise) {
            availableLanguagesPromise = Promise.all(
                CANDIDATE_LANGUAGES.map(lang =>
                    fetchLanguageFile(lang).then(data => (data ? lang : null))
                )
            ).then(results => results.filter(Boolean));
        }

        availableLanguagesPromise.then(available => {
            const autoLabel = t('XPlan.Language.SystemDefault', 'Default');
            const options = ['<option value="auto">' + autoLabel + '</option>']
                .concat(available.map(lang =>
                    '<option value="' + lang + '">' + lang + '</option>'
                ));

            const selected = getStoredLanguage() || 'auto';
            select.innerHTML = options.join('');
            select.value = selected;
        });
    }

    app.t = t;
    app.applyTranslations = applyTranslations;
    app.onTranslationsReady = onReady;
    app.setLanguage = setLanguage;
    app.getCurrentLanguage = () => currentLng;
    app.translationsPromise = loadTranslations();
})(window.PlannerApp);