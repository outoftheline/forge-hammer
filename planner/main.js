'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const state = app.state;

    // BASE_KEY stores the large, rarely-changing FoE data (CityEntities etc.).
    // It is written only when a fresh clipboard paste arrives via init().
    // LAYOUT_KEY stores only building positions — tiny, written on every mutation.
    const BASE_KEY    = 'foe_planner_base';
    const LAYOUT_KEY  = 'foe_planner_layout';
    const HISTORY_KEY = 'foe_planner_history';

    // make sure types are the same as in the game map
    function correctBuildingType(metaData) {
        for (const id in metaData) {
            if (!metaData.hasOwnProperty(id)) continue;
            const entity = metaData[id];
            if (!entity.type) {
                entity.type = entity?.components?.AllAge?.tags?.tags
                    ?.find(v => v.hasOwnProperty('buildingType'))?.buildingType;
            }
        }
        return metaData;
    }

    // grab metadata from the DB
    async function getCityEntityMetaData(region) {
        const buildingMetaDB = new Dexie("FoEBuildingMeta");
        await buildingMetaDB.open();
        const table = buildingMetaDB.table('buildingMeta');
        const entries = await table.where('region').equals(region).toArray();

        const metaData = {};
        for (const entry of entries) {
            try {
                metaData[entry.id] = JSON.parse(entry.json);
            } catch (e) {
                console.warn('Could not parse meta for', entry.id, e);
            }
        }
        return correctBuildingType(metaData);
    }

    // key used by CityMap.openPlanner() via background.js
    const PENDING_KEY = 'foe_planner_pending';

    // Checks for new data from CityMap.openPlanner()
    async function loadGameCityData() {
        for (let attempt = 0; attempt < 10; attempt++) {
            const stored = await browser.storage.local.get(PENDING_KEY).catch(() => null);
            const pending = stored && stored[PENDING_KEY];
            if (pending) {
                await browser.storage.local.remove(PENDING_KEY).catch(() => {});
                await init(pending);
                return true;
            }
            await new Promise(r => setTimeout(r, 150));
        }
        return false;
    }

    async function init(data) {
        state.region = data.region;
        state.cityData = data.CityMapData;
        state.mapData = data.UnlockedAreas;

        state.metaData = await getCityEntityMetaData(state.region);

        state.metaById = new Map(Object.values(state.metaData).map(m => [m.id, m]));

        state.rotated = false;
        state.history = [];
        state.future = [];
        localStorage.removeItem(HISTORY_KEY);

        try {
            localStorage.setItem(BASE_KEY, JSON.stringify({
                region: state.region,
                cityData: state.cityData,
                mapData: state.mapData
            }));
        } catch (e) {
            console.warn('Could not cache base data in localStorage:', e);
        }

        app.resizeCanvasToCSSSize();
        app.rebuildGridLayer();
        app.drawMap();
        app.rebuildOccupiedTiles();
        app.updateStats();
        app.showStoredBuildings();
    }

    // --- Serialization ---

    // just position + metaId
    function serializeLayout() {
        return {
            version: 2,
            mapBuildings: state.mapBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y
            })),
            storedBuildings: state.storedBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y
            })),
            camX: state.camX,
            camY: state.camY,
            zoomScale: state.zoomScale,
            rotated: !!state.rotated,
            mapData: state.mapData
        };
    }

    // Full export
    function serializeState() {
        return {
            version: 3,
            region: state.region,
            cityData: state.cityData,
            mapData: state.mapData,
            mapBuildings: state.mapBuildings.map(b => ({ metaId: b.meta.id, x: b.data.x, y: b.data.y })),
            storedBuildings: state.storedBuildings.map(b => ({ metaId: b.meta.id, x: b.data.x, y: b.data.y })),
            camX: state.camX, camY: state.camY, zoomScale: state.zoomScale,
            rotated: !!state.rotated
        };
    }

    async function deserializeState(saved) {
        state.region = saved.region;
        state.cityData = saved.cityData;
        state.mapData = saved.mapData;

        applyLayout(saved);
        app.resizeCanvasToCSSSize();
        app.rebuildGridLayer();
        app.rebuildOccupiedTiles();
        app.redrawMap();
        app.updateStats();
        app.showStoredBuildings();
    }

    // switch width and height
    function swapBuildingDimensions(b) {
        const widthTemp = b.width;
        b.width  = b.height;
        b.height = widthTemp;

        b.hasLabel = !(b.meta.type === 'street' || b.height === app.SIZE || b.width === app.SIZE);
    }


    function createRotatedBuilding(data, meta) {
        const building = new app.MapBuilding(data, meta);
        if (state.rotated) swapBuildingDimensions(building);
        return building;
    }

    function buildingsFromEntries(entries) {
        return (entries || []).map(entry => {
            const meta = state.metaById.get(entry.metaId);
            if (!meta) return null;
            const data = {
                cityentity_id: entry.metaId,
                x: entry.x ?? (entry.data ? entry.data.x : 0) ?? 0,
                y: entry.y ?? (entry.data ? entry.data.y : 0) ?? 0,
            };
            const effectiveMeta = meta.type === 'street'
                ? { ...meta, width: 1, length: 1 }
                : meta;
            return createRotatedBuilding(data, effectiveMeta);
        }).filter(Boolean);
    }

    function applyLayout(layout) {
        state.camX      = layout.camX      ?? 0;
        state.camY      = layout.camY      ?? 0;
        state.zoomScale = layout.zoomScale ?? 0.75;
        state.rotated   = !!layout.rotated;
        if (layout.mapData) state.mapData = layout.mapData;
        state.mapBuildings    = buildingsFromEntries(layout.mapBuildings);
        state.storedBuildings = buildingsFromEntries(layout.storedBuildings);
    }

    // --- localStorage ---

    function saveState() {
        try {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(serializeLayout()));
            flashSaveBtn();
        } catch (e) {
            console.error('Failed to save layout:', e);
            alert('Could not save to localStorage (storage may be full).\nUse Export to save a file instead.');
        }
    }

    async function loadFromLocalStorage() {
        try {
            const rawBase   = localStorage.getItem(BASE_KEY);
            const rawLayout = localStorage.getItem(LAYOUT_KEY);
            if (!rawBase) return false;

            const base = JSON.parse(rawBase);
            state.region = base.region;
            state.cityData = base.cityData;
            state.mapData = base.mapData;
            state.metaData = await getCityEntityMetaData(state.region);
            state.metaById = new Map(Object.values(state.metaData).map(m => [m.id, m]));

            if (rawLayout) applyLayout(JSON.parse(rawLayout));

            loadHistory();
            app.resizeCanvasToCSSSize();
            app.rebuildGridLayer();
            app.rebuildOccupiedTiles();
            app.redrawMap();
            app.updateStats();
            app.showStoredBuildings();
            return true;
        } catch (e) {
            console.error('Failed to load saved state:', e);
            return false;
        }
    }

    // --- File export / import ---

    function exportStateToFile() {
        const json = JSON.stringify(serializeState());
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'foe_planner_save.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importStateFromFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const saved = JSON.parse(e.target.result);
                await deserializeState(saved);
                // Imported state replaces everything — old history is stale.
                state.history = [];
                state.future  = [];
                try {
                    localStorage.setItem(BASE_KEY, JSON.stringify({
                        region:   state.region,
                        cityData: state.cityData,
                        mapData:  state.mapData
                    }));
                    localStorage.setItem(LAYOUT_KEY, JSON.stringify(serializeLayout()));
                    localStorage.removeItem(HISTORY_KEY);
                } catch (storageErr) {
                    console.warn('Could not update localStorage after import:', storageErr);
                }
                app.dom.submitWindow.classList.add('hidden');
            } catch (err) {
                console.error('Import failed:', err);
                alert('Could not read the save file. Make sure it is a valid FoE Planner export.');
            }
        };
        reader.readAsText(file);
    }

    function flashSaveBtn() {
        const btn = app.dom.saveBtn;
        if (!btn) return;
        btn.textContent = '✓ Saved';
        setTimeout(() => { btn.textContent = 'Save'; }, 1500);
    }


    function restoreOriginalMapAndCity() {
        try {
            const rawBase = localStorage.getItem(BASE_KEY);
            if (!rawBase) return false;

            const base = JSON.parse(rawBase);
            state.cityData = base.cityData;
            state.mapData  = base.mapData;
            return true;
        } catch (e) {
            console.warn('Could not restore original map/city data:', e);
            return false;
        }
    }


    function clearSavedLayout() {
        localStorage.removeItem(LAYOUT_KEY);
        localStorage.removeItem(HISTORY_KEY);
    }


    function autoSave() {
        if (state.metaData && Object.keys(state.metaData).length) {
            saveState();
        }
    }

    // 90° clockwise rotation
    function rotateLayout() {
        if (!state.mapData) return;

        const clockwise = !state.rotated;

        let maxY = 0, maxX = 0;
        for (const exp of state.mapData) {
            const right  = (exp.x || 0) + exp.width;
            const bottom = (exp.y || 0) + exp.length;
            if (right  > maxX) maxX = right;
            if (bottom > maxY) maxY = bottom;
        }

        // rotate expansions
        for (const exp of state.mapData) {
            const oldX      = exp.x      || 0;
            const oldY      = exp.y      || 0;
            const oldWidth  = exp.width;
            const oldLength = exp.length;

            if (clockwise) {
                exp.x      = maxY - (oldY + oldLength);
                exp.y      = oldX;
            } else {
                exp.x      = oldY;
                exp.y      = maxX - (oldX + oldWidth);
            }
            exp.width  = oldLength;
            exp.length = oldWidth;
        }

        // rotate buildings on canvas + in storage
        function rotateBuilding(b) {
            const tileX = Math.round(b.x / app.SIZE);
            const tileY = Math.round(b.y / app.SIZE);
            const tileW = Math.round(b.width  / app.SIZE);
            const tileH = Math.round(b.height / app.SIZE);

            if (clockwise) {
                b.data.x = maxY - (tileY + tileH);
                b.data.y = tileX;
            } else {
                b.data.x = tileY;
                b.data.y = maxX - (tileX + tileW);
            }

            b.x = b.data.x * app.SIZE;
            b.y = b.data.y * app.SIZE;

            swapBuildingDimensions(b);
        }

        for (const b of state.mapBuildings) 
            rotateBuilding(b);
        for (const b of state.storedBuildings) 
            rotateBuilding(b);

        state.rotated = clockwise;

        // cancel any action 
        state.activeBuilding    = null;
        state.placingBuilding   = null;
        state.dragCopy          = null;
        state.selectionRect     = null;
        state.selectedBuildings = [];

        state.camX = 0;
        state.camY = 0;

        app.rebuildGridLayer();
        app.rebuildOccupiedTiles();
        app.redrawMap();
        app.updateStats();
        app.showStoredBuildings();
        app.autoSave();
    }

    // --- Undo / Redo ---
    const HISTORY_LIMIT = 5;

    function captureSnapshot() {
        return {
            mapBuildings: state.mapBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y
            })),
            storedBuildings: state.storedBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y
            })),
            // Grid shape + orientation at capture time. Rotating doesn't
            // push its own history entry, but a move made while rotated
            // still needs to be replayed against a matching grid — without
            // this, undo/redo across an intervening rotate corrupts
            // positions/dimensions instead of just skipping past the rotate.
            mapData: state.mapData ? JSON.parse(JSON.stringify(state.mapData)) : state.mapData,
            rotated: !!state.rotated
        };
    }

    function saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify({
                history: state.history,
                future:  state.future
            }));
        } catch (e) {
            // History is best-effort — silently ignore if storage is full.
            console.warn('Could not persist undo/redo history:', e);
        }
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            state.history = parsed.history || [];
            state.future  = parsed.future  || [];
        } catch (e) {
            console.warn('Could not restore undo/redo history:', e);
            state.history = [];
            state.future  = [];
        }
    }

    function pushSnapshot() {
        state.history.push(captureSnapshot());
        if (state.history.length > HISTORY_LIMIT) state.history.shift();
        state.future = [];
        updateUndoRedoButtons();
        saveHistory();
    }

    function applySnapshot(snapshot) {
        // Restore grid shape + rotation BEFORE rebuilding buildings, so
        // buildingsFromEntries applies dimensions matching the orientation
        // the saved x/y positions actually belong to.
        if (snapshot.mapData) state.mapData = snapshot.mapData;
        state.rotated = !!snapshot.rotated;

        state.mapBuildings    = buildingsFromEntries(snapshot.mapBuildings);
        state.storedBuildings = buildingsFromEntries(snapshot.storedBuildings);

        state.activeBuilding    = null;
        state.placingBuilding   = null;
        state.dragCopy          = null;
        state.selectionRect     = null;
        state.selectedBuildings = [];

        app.rebuildGridLayer();
        app.rebuildOccupiedTiles();
        app.redrawMap();
        app.updateStats();
        app.showStoredBuildings();
        autoSave();
    }

    function undo() {
        if (!state.history.length) return;
        state.future.push(captureSnapshot());
        applySnapshot(state.history.pop());
        updateUndoRedoButtons();
        saveHistory();
    }

    function redo() {
        if (!state.future.length) return;
        state.history.push(captureSnapshot());
        if (state.history.length > HISTORY_LIMIT) state.history.shift();
        applySnapshot(state.future.pop());
        updateUndoRedoButtons();
        saveHistory();
    }

    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');
        if (undoBtn) undoBtn.disabled = state.history.length === 0;
        if (redoBtn) redoBtn.disabled = state.future.length === 0;
    }

    app.init = init;
    app.saveState = saveState;
    app.autoSave = autoSave;
    app.pushSnapshot = pushSnapshot;
    app.undo = undo;
    app.redo = redo;
    app.updateUndoRedoButtons = updateUndoRedoButtons;
    app.exportStateToFile = exportStateToFile;
    app.importStateFromFile = importStateFromFile;
    app.rotateLayout = rotateLayout;
    app.createRotatedBuilding = createRotatedBuilding;
    app.restoreOriginalMapAndCity = restoreOriginalMapAndCity;
    app.clearSavedLayout = clearSavedLayout;

    // check for data from CityMap.openPlanner() use localStorage as fallback
    // todo: implement something to ask if incoming data should be used or the currently saved data
    (async () => {
        const hasPending = await loadGameCityData();
        const hasSave = hasPending || await loadFromLocalStorage();
        if (hasSave) {
            app.dom.submitWindow.classList.add('hidden');
        }

        app.updateUndoRedoButtons();
        app.bindEvents(init);
    })();
})(window.PlannerApp);