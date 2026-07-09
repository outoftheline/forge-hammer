'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const state = app.state;

    const VIEW_KEY = 'foe_planner_view';
    const HISTORY_KEY = 'foe_planner_history';
    const PLAN_ID_KEY = 'foe_planner_plan_id';

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
        state.currentEra = data.currentEra || null;

        state.originalData = {
            cityData: data.CityMapData,
            mapData: data.UnlockedAreas,
            currentEra: data.currentEra || null
        };

        state.playerName = data.playerName || state.playerName || 'unknown';
        const sampleBuilding = Object.values(state.cityData || {})[0];
        state.playerId = (sampleBuilding && sampleBuilding.player_id !== undefined)
            ? sampleBuilding.player_id
            : (state.playerId || 'unknown');

        state.metaData = await getCityEntityMetaData(state.region);
        state.metaById = new Map(Object.values(state.metaData).map(m => [m.id, m]));
        if (app.renderStreetSizeOptions) app.renderStreetSizeOptions();

        state.rotated = false;
        state.deletedBuildings = [];
        state.selectedStoredMetaId = null;
        state.history = [];
        state.future = [];
        localStorage.removeItem(HISTORY_KEY);

        loadViewState();

        app.resizeCanvasToCSSSize();
        app.rebuildGridLayer();
        app.drawMap();
        app.rebuildOccupiedTiles();
        app.updateStats();
        app.showStoredBuildings();

        state.planId = loadSavedPlanId();
        await savePlanToDatabase();
    }

    function saveViewState() {
        try {
            localStorage.setItem(VIEW_KEY, JSON.stringify({
                camX: state.camX,
                camY: state.camY,
                zoomScale: state.zoomScale,
                rotated: !!state.rotated
            }));
        } catch (e) {
            console.warn('Could not persist view state:', e);
        }
    }

    function loadViewState() {
        try {
            const raw = localStorage.getItem(VIEW_KEY);
            if (!raw) return;
            const view = JSON.parse(raw);
            state.camX = view.camX ?? state.camX;
            state.camY = view.camY ?? state.camY;
            state.zoomScale = view.zoomScale ?? state.zoomScale;
            state.rotated = !!view.rotated;
        } catch (e) {
            console.warn('Could not restore view state:', e);
        }
    }

    // --- Planner database sync ---

    function loadSavedPlanId() {
        try {
            const raw = localStorage.getItem(PLAN_ID_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveSavedPlanId(planId) {
        try {
            localStorage.setItem(PLAN_ID_KEY, JSON.stringify(planId));
        } catch (e) {
            console.warn('Could not persist plan id:', e);
        }
    }


    async function callBackground(message) {
        const response = await browser.runtime.sendMessage(message);
        if (!response || response.ok !== true) {
            throw new Error((response && response.error) || 'Unknown error from background script');
        }
        return response.data;
    }


    function buildPlannerMapData() {
        let syntheticId = 0;

        const toPlannerBuilding = (building, stored, deleted) => ({
            id: (building.data && building.data.id !== undefined) ? building.data.id : `planner-${syntheticId++}`,
            x: Math.round(building.x / app.SIZE),
            y: Math.round(building.y / app.SIZE),
            type: building.meta.type,
            cityentity_id: building.meta.id,
            era: building.data ? building.data.era : undefined,
            stored: !!stored,
            deleted: !!deleted
        });

        return [
            ...state.mapBuildings.map(b => toPlannerBuilding(b, false, false)),
            ...(state.storedBuildings || []).map(b => toPlannerBuilding(b, true, false)),
            ...(state.deletedBuildings || []).map(b => toPlannerBuilding(b, true, true))
        ];
    }

    async function createNewPlanRecord(world, planName, playerId, playerName, boostData, mapData) {
        const data = await callBackground({
            type: 'Planner.newPlan',
            world, planName, playerId, playerName, boostData, mapData,
            originalData: state.originalData || null
        });
        if (data && data.planId !== undefined) {
            state.planId = data.planId;
            saveSavedPlanId(state.planId);
        }
    }

    async function savePlanToDatabase() {
        // Nothing loaded yet — nothing to save
        if (!state.metaData || !Object.keys(state.metaData).length) return false;

        const world = state.region || 'unknown';
        const planName = state.planName || 'Plan';
        const playerId = state.playerId || 'unknown';
        const playerName = state.playerName || 'unknown';
        const boostData = {};
        const mapData = buildPlannerMapData();

        try {
            if (!state.planId) {
                await createNewPlanRecord(world, planName, playerId, playerName, boostData, mapData);
            } else {
                try {
                    await callBackground({
                        type: 'Planner.updatePlan',
                        planId: state.planId,
                        world, planName, playerId, playerName, boostData, mapData
                    });
                } catch (e) {
                    if (e && /not found/i.test(e.message || '')) {
                        console.log('Saved plan no longer exists in the database — creating a new one.');
                        state.planId = null;
                        saveSavedPlanId(null);
                        await createNewPlanRecord(world, planName, playerId, playerName, boostData, mapData);
                    } else {
                        throw e;
                    }
                }
            }
            return true;
        } catch (e) {
            console.error('Failed to save plan to database:', e);
            return false;
        }
    }

    // --- Loading plans from the database ---
    function buildingRowsToEntries(rows) {
        return (rows || []).map(row => {
            let parsed = {};
            try { parsed = row.JSON ? JSON.parse(row.JSON) : {}; } catch (e) { parsed = {}; }
            return {
                metaId: parsed.cityentity_id,
                x: row.x,
                y: row.y,
                era: parsed.era,
                stored: !!parsed.stored,
                deleted: !!parsed.deleted
            };
        });
    }

    async function loadPlanFromDatabase(planId) {
        const plan = await callBackground({ type: 'Planner.getPlan', planId });
        if (!plan) throw new Error('Plan not found');

        const rows = await callBackground({ type: 'Planner.getBuildingList', planId });

        let originalData = null;
        try { originalData = plan.originalJSON ? JSON.parse(plan.originalJSON) : null; } catch (e) { originalData = null; }

        state.region = plan.world;
        state.cityData = (originalData && originalData.cityData) || {};
        state.mapData = (originalData && originalData.mapData) || [];
        state.currentEra = (originalData && originalData.currentEra) || null;
        state.originalData = originalData || { cityData: state.cityData, mapData: state.mapData, currentEra: state.currentEra };

        state.metaData = await getCityEntityMetaData(state.region);
        state.metaById = new Map(Object.values(state.metaData).map(m => [m.id, m]));
        if (app.renderStreetSizeOptions) app.renderStreetSizeOptions();

        const entries = buildingRowsToEntries(rows);
        state.mapBuildings = buildingsFromEntries(entries.filter(e => !e.stored && !e.deleted));
        state.storedBuildings = buildingsFromEntries(entries.filter(e => e.stored && !e.deleted));
        state.deletedBuildings = buildingsFromEntries(entries.filter(e => e.deleted));

        state.rotated = false;
        state.camX = 0;
        state.camY = 0;
        state.zoomScale = 0.75;
        state.history = [];
        state.future = [];
        localStorage.removeItem(HISTORY_KEY);

        state.planId = plan.id;
        state.planName = plan.planName;
        state.playerId = plan.playerId;
        state.playerName = plan.playerName;
        saveSavedPlanId(state.planId);

        loadViewState();

        app.resizeCanvasToCSSSize();
        app.rebuildGridLayer();
        app.rebuildOccupiedTiles();
        app.redrawMap();
        app.updateStats();
        app.showStoredBuildings();
        app.updateUndoRedoButtons();

        return plan;
    }


    async function loadLastSavedPlan() {
        try {
            const plans = await callBackground({ type: 'Planner.getPlanList' });
            if (!plans || !plans.length) return false;

            let latest = plans[0];
            for (const p of plans) {
                if ((p.date || 0) > (latest.date || 0)) latest = p;
            }

            await loadPlanFromDatabase(latest.id);
            return true;
        } catch (e) {
            console.error('Failed to load last saved plan:', e);
            return false;
        }
    }

    async function getPlanList() {
        return callBackground({ type: 'Planner.getPlanList' });
    }

    async function removePlanFromDatabase(planId) {
        return callBackground({ type: 'Planner.removePlan', planId });
    }


    // just position + metaId
    function serializeLayout() {
        return {
            version: 2,
            mapBuildings: state.mapBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y,
                era: b.data.era
            })),
            storedBuildings: state.storedBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y,
                era: b.data.era
            })),
            deletedBuildings: (state.deletedBuildings || []).map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y,
                era: b.data.era
            })),
            camX: state.camX,
            camY: state.camY,
            zoomScale: state.zoomScale,
            rotated: !!state.rotated,
            mapData: state.mapData,
            currentEra: state.currentEra
        };
    }

    // Full export
    function serializeState() {
        return {
            version: 3,
            region: state.region,
            cityData: state.cityData,
            mapData: state.mapData,
            currentEra: state.currentEra,
            mapBuildings: state.mapBuildings.map(b => ({ metaId: b.meta.id, x: b.data.x, y: b.data.y, era: b.data.era })),
            storedBuildings: state.storedBuildings.map(b => ({ metaId: b.meta.id, x: b.data.x, y: b.data.y, era: b.data.era })),
            deletedBuildings: (state.deletedBuildings || []).map(b => ({ metaId: b.meta.id, x: b.data.x, y: b.data.y, era: b.data.era })),
            camX: state.camX, camY: state.camY, zoomScale: state.zoomScale,
            rotated: !!state.rotated
        };
    }

    async function deserializeState(saved) {
        state.region = saved.region;
        state.cityData = saved.cityData;
        state.mapData = saved.mapData;
        state.currentEra = saved.currentEra || null;

        applyLayout(saved);
        app.resizeCanvasToCSSSize();
        app.rebuildGridLayer();
        app.rebuildOccupiedTiles();
        app.redrawMap();
        app.updateStats();
        app.showStoredBuildings();
    }

    function createRotatedBuilding(data, meta) {
        return new app.MapBuilding(data, meta);
    }

    function restoreCity() {
        if (!state.originalData) return;

        state.cityData = JSON.parse(JSON.stringify(state.originalData.cityData || {}));
        state.mapData = JSON.parse(JSON.stringify(state.originalData.mapData || []));
        state.currentEra = state.originalData.currentEra || null;
    }

    function clearSavedLayout() {
        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch (e) {
            console.log('Could not clear saved history:', e);
        }
    }

    function buildingsFromEntries(entries) {
        return (entries || []).map(entry => {
            const meta = state.metaById.get(entry.metaId);
            if (!meta) return null;
            const data = {
                cityentity_id: entry.metaId,
                x: entry.x ?? (entry.data ? entry.data.x : 0) ?? 0,
                y: entry.y ?? (entry.data ? entry.data.y : 0) ?? 0,
                era: entry.era ?? (entry.data ? entry.data.era : undefined) ?? state.currentEra ?? null,
            };
            // Use the meta's real footprint (streets can be 1x1 or 2x2) — the
            // same source of truth drawMap() uses for a freshly opened city.
            return createRotatedBuilding(data, meta);
        }).filter(Boolean);
    }

    function applyLayout(layout) {
        state.camX      = layout.camX      ?? 0;
        state.camY      = layout.camY      ?? 0;
        state.zoomScale = layout.zoomScale ?? 0.75;
        state.rotated   = !!layout.rotated;
        if (layout.mapData) state.mapData = layout.mapData;
        if (layout.currentEra !== undefined) state.currentEra = layout.currentEra;
        state.mapBuildings     = buildingsFromEntries(layout.mapBuildings);
        state.storedBuildings  = buildingsFromEntries(layout.storedBuildings);
        state.deletedBuildings = buildingsFromEntries(layout.deletedBuildings);
    }


    // 90° clockwise view rotation
    function rotateLayout() {
        if (!state.mapData) return;

        state.rotated = !state.rotated;

        // cancel any action
        state.activeBuilding    = null;
        state.placingBuilding   = null;
        state.dragCopy          = null;
        state.selectionRect     = null;
        state.selectedBuildings = [];

        state.camX = 0;
        state.camY = 0;

        app.redrawMap();
        app.updateStats();
        app.showStoredBuildings();
        app.autoSave();
        saveViewState();
    }

    // --- Undo / Redo ---
    const HISTORY_LIMIT = 5;

    function captureSnapshot() {
        return {
            mapBuildings: state.mapBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y,
                era: b.data.era
            })),
            storedBuildings: state.storedBuildings.map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y,
                era: b.data.era
            })),
            deletedBuildings: (state.deletedBuildings || []).map(b => ({
                metaId: b.meta.id,
                x: b.data.x,
                y: b.data.y,
                era: b.data.era
            })),
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
        state.rotated = !!snapshot.rotated;

        state.mapBuildings = buildingsFromEntries(snapshot.mapBuildings);
        state.storedBuildings = buildingsFromEntries(snapshot.storedBuildings);
        state.deletedBuildings = buildingsFromEntries(snapshot.deletedBuildings);

        state.activeBuilding = null;
        state.placingBuilding = null;
        state.dragCopy = null;
        state.selectionRect = null;
        state.selectedBuildings = [];
        state.selectedStoredMetaId = null;

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

    // TODO: autosave to the DB after 2mins
    function autoSave() {}

    app.init = init;
    app.savePlanToDatabase = savePlanToDatabase;
    app.loadPlanFromDatabase = loadPlanFromDatabase;
    app.loadLastSavedPlan = loadLastSavedPlan;
    app.getPlanList = getPlanList;
    app.removePlanFromDatabase = removePlanFromDatabase;
    app.saveViewState = saveViewState;
    app.loadViewState = loadViewState;
    app.autoSave = autoSave;
    app.pushSnapshot = pushSnapshot;
    app.undo = undo;
    app.redo = redo;
    app.updateUndoRedoButtons = updateUndoRedoButtons;
    app.rotateLayout = rotateLayout;
    app.createRotatedBuilding = createRotatedBuilding;
    app.restoreCity = restoreCity;
    app.clearSavedLayout = clearSavedLayout;

    (async () => {
        const hasPending = await loadGameCityData();
        if (hasPending) {
            app.dom.submitWindow.classList.add('hidden');
        } else {
            const loadedFromDb = await loadLastSavedPlan();
            if (loadedFromDb) app.dom.submitWindow.classList.add('hidden');
        }

        app.updateUndoRedoButtons();
        app.bindEvents(init);
    })();
})(window.PlannerApp);