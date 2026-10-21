'use strict';

window.PlannerApp = window.PlannerApp || {};

/*
 * Era mode
 * Colours every building by its era and lets the user change the era of the
 * current selection (BronzeAge .. StellarAgeDiscovery).
 * The era picker floats next to the cursor of the last click on the map.
 */
(function (app) {
    const state = app.state;
    const dom = app.dom;

    const MIN_ERA = 'BronzeAge';
    const MAX_ERA = 'StellarAgeDiscovery';

    // Buildings whose output does not depend on an era
    const NO_ERA_TYPES = new Set(['street', 'greatbuilding']);

    const ERA_LIST = Object.keys(app.InnoEras)
        .filter(era =>
            app.InnoEras[era] >= app.InnoEras[MIN_ERA] &&
            app.InnoEras[era] <= app.InnoEras[MAX_ERA])
        .sort((a, b) => app.InnoEras[a] - app.InnoEras[b]);

    const NEUTRAL = { fill: '#3a3a3a', stroke: '#555', text: '#bbb' };
    const UNKNOWN = { fill: '#777', stroke: '#555', text: '#000' };

    const PICKER_OFFSET = 16;
    const PICKER_MARGIN = 8;

    const colorCache = new Map();
    const eraCapable = new WeakMap();

    let picker = null;
    let lastPointer = null;     // client coords of the last click on the map
    let pickerTargets = null;   // selection the picker is currently positioned for

    function eraId(era) {
        const id = app.InnoEras[era];
        return id === undefined ? null : id;
    }

    function eraLabel(era) {
        return app.getEraLabel ? app.getEraLabel(era) : String(era);
    }

    function effectiveEra(building) {
        return (building && building.data && building.data.era) || state.currentEra || null;
    }

    function canChangeEra(meta) {
        if (!meta || NO_ERA_TYPES.has(meta.type)) return false;
        if (eraCapable.has(meta)) return eraCapable.get(meta);

        let result = false;
        if (meta.components) {
            result = Object.keys(meta.components).some(k => k !== 'AllAge');
        } else if (Array.isArray(meta.entity_levels)) {
            result = meta.entity_levels.length > 1;
        }

        eraCapable.set(meta, result);
        return result;
    }

    // Reads the .eraN background colour from planner.css
    function readEraColor(id) {
        if (colorCache.has(id)) return colorCache.get(id);

        const probe = document.createElement('div');
        probe.className = 'era' + id;
        probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;';
        document.body.appendChild(probe);
        const bg = getComputedStyle(probe).backgroundColor;
        probe.remove();

        const parts = (bg.match(/[\d.]+/g) || []).map(Number);
        if (parts.length < 3 || (parts.length > 3 && parts[3] === 0)) {
            colorCache.set(id, null);
            return null;
        }

        const [r, g, b] = parts;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const colors = {
            fill: 'rgb(' + r + ', ' + g + ', ' + b + ')',
            stroke: 'rgb(' + Math.round(r * 0.6) + ', ' + Math.round(g * 0.6) + ', ' + Math.round(b * 0.6) + ')',
            text: luminance > 0.55 ? '#000' : '#fff'
        };

        colorCache.set(id, colors);
        return colors;
    }

    function getEraColors(building) {
        if (!canChangeEra(building.meta)) return NEUTRAL;

        const id = eraId(effectiveEra(building));
        if (id === null) return UNKNOWN;

        return readEraColor(id) || UNKNOWN;
    }

    function shiftEra(era, step) {
        const id = eraId(era);
        let idx = ERA_LIST.indexOf(era);
        if (idx === -1) idx = (id !== null && id > eraId(MAX_ERA)) ? ERA_LIST.length : -1;

        const next = Math.min(ERA_LIST.length - 1, Math.max(0, idx + step));
        return ERA_LIST[next];
    }

    function setBuildingEra(building, era) {
        building.data.era = era;
        building.population = app.getBuildingPopulation(building.meta, building.data);
    }

    function getEraTargets() {
        if (!state.eraMode) return [];
        return state.selectedBuildings.filter(b => canChangeEra(b.meta));
    }

    function applyEraChange(getNewEra) {
        const changes = [];

        for (const building of getEraTargets()) {
            const next = getNewEra(effectiveEra(building));
            if (next && next !== building.data.era) changes.push([building, next]);
        }

        if (!changes.length) return;

        app.pushSnapshot();
        for (const [building, era] of changes) setBuildingEra(building, era);

        app.updateStats();   // also refreshes the info panel and the picker
        app.redrawMap();
        app.autoSave();
    }

    // --- picker UI ----------------------------------------------------------

    function fillSelect() {
        if (!picker) return;

        const select = picker.querySelector('select');
        const mixed = app.t('XPlan.EraMode.Mixed', 'Mixed eras');

        select.innerHTML =
            '<option value="" disabled>' + mixed + '</option>' +
            ERA_LIST.map(era => '<option value="' + era + '">' + eraLabel(era) + '</option>').join('');
    }

    function buildPicker() {
        if (picker) return;

        picker = document.createElement('div');
        picker.id = 'eraPicker';
        picker.className = 'group hidden';
        picker.innerHTML =
            '<button class="btn" type="button" data-step="-1" title="' + app.t('XPlan.EraMode.Previous', 'Previous era') + '">−</button>' +
            '<select class="btn"></select>' +
            '<button class="btn" type="button" data-step="1" title="' + app.t('XPlan.EraMode.Next', 'Next era') + '">+</button>';

        (document.querySelector('#map') || document.body).appendChild(picker);
        fillSelect();

        picker.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-step]');
            if (!btn) return;
            const step = Number(btn.dataset.step);
            applyEraChange(era => shiftEra(era, step));
        });

        picker.querySelector('select').addEventListener('change', (e) => {
            const era = e.target.value;
            if (era) applyEraChange(() => era);
        });

        // don't let clicks on the picker reach the map underneath
        picker.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    function sameTargets(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        const set = new Set(a);
        return b.every(x => set.has(x));
    }

    function positionPicker() {
        if (!picker || !lastPointer) return;

        picker.style.left = '0px';
        picker.style.top = '0px';
        const rect = picker.getBoundingClientRect();

        let left = lastPointer.x + PICKER_OFFSET;
        let top = lastPointer.y + PICKER_OFFSET;

        // flip to the other side of the cursor if it would leave the window
        if (left + rect.width > window.innerWidth - PICKER_MARGIN) left = lastPointer.x - rect.width - PICKER_OFFSET;
        if (top + rect.height > window.innerHeight - PICKER_MARGIN) top = lastPointer.y - rect.height - PICKER_OFFSET;

        picker.style.left = Math.max(PICKER_MARGIN, left) + 'px';
        picker.style.top = Math.max(PICKER_MARGIN, top) + 'px';
    }

    function updateEraPicker() {
        if (!picker) return;

        const targets = getEraTargets();
        picker.classList.toggle('hidden', !targets.length);
        if (!targets.length) {
            pickerTargets = null;
            return;
        }

        // only jump to the cursor when the selection itself changed,
        // not after an era change on the same selection
        if (!sameTargets(pickerTargets, targets)) {
            pickerTargets = targets.slice();
            positionPicker();
        }

        const eras = new Set(targets.map(effectiveEra));
        const single = eras.size === 1 ? Array.from(eras)[0] : '';
        picker.querySelector('select').value = ERA_LIST.includes(single) ? single : '';
    }

    function rememberPointer(e) {
        lastPointer = { x: e.clientX, y: e.clientY };
    }

    function setEraMode(on) {
        state.eraMode = !!on;
        if (dom.eraChangerBtn) dom.eraChangerBtn.classList.toggle('active', state.eraMode);

        if (state.eraMode) fillSelect(); // labels may have changed with the language
        pickerTargets = null;
        updateEraPicker();
        app.redrawMap();
    }

    function isTypingTarget(target) {
        if (!target) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    }

    function handleEraKeyDown(e) {
        if (!state.eraMode || !state.selectedBuildings.length) return;
        if (isTypingTarget(e.target)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        let step = 0;
        if (e.key === '+' || e.key === '=') step = 1;
        else if (e.key === '-') step = -1;
        if (!step) return;

        e.preventDefault();
        applyEraChange(era => shiftEra(era, step));
    }

    function bindEraEvents() {
        if (!dom.eraChangerBtn) return;

        buildPicker();
        if (app.onTranslationsReady) app.onTranslationsReady(fillSelect);

        dom.eraChangerBtn.addEventListener('click', () => setEraMode(!state.eraMode));
        document.addEventListener('keydown', handleEraKeyDown);

        // mousedown covers a normal click, mouseup the end of a Ctrl-drag selection
        dom.canvas.addEventListener('mousedown', rememberPointer);
        dom.canvas.addEventListener('mouseup', rememberPointer);
    }

    app.ERA_LIST = ERA_LIST;
    app.canChangeEra = canChangeEra;
    app.getEraColors = getEraColors;
    app.effectiveEra = effectiveEra;
    app.shiftEra = shiftEra;
    app.setEraMode = setEraMode;
    app.updateEraPicker = updateEraPicker;
    app.bindEraEvents = bindEraEvents;
})(window.PlannerApp);