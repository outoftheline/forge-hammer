'use strict';

window.PlannerApp = window.PlannerApp || {};

/* 
 * 4x4 expansion grid - cells in blockedAreas can never be unlocked
 */
(function (app) {
    const state = app.state;
    const dom = app.dom;
    const SIZE = app.SIZE;
    const CELL = 4;
    const FLASH_MS = 1000;

    state.blockedAreas = null;
    state.expansionMode = false;
    state.expansionHover = null;

    const openWarnings = {}; // reason -> notification element

    state.expansionCutOff = null; // cells highlighted because they would be cut off
    let cutOffTimer = null;

    function normalizeBlockedAreas(list) {
        if (!Array.isArray(list) || !list.length) return null;
        return list.map(a => ({ x: Number(a.x) || 0, y: Number(a.y) || 0 }));
    }

    function hasExpansionData() {
        return Array.isArray(state.blockedAreas) && state.blockedAreas.length > 0;
    }

    // state.mapData starts out as {} before any city is loaded
    function areaList() {
        return Array.isArray(state.mapData) ? state.mapData : [];
    }

    function getPlannedAreas() {
        return areaList().filter(a => a && a.planned);
    }

    function getUnlockedAreas() {
        return areaList().filter(a => a && !a.planned);
    }

    function makePlannedArea(x, y) {
        return { x, y, width: CELL, length: CELL, planned: true };
    }

    // Unlocked areas plus the given planned cells
    function withPlannedAreas(cells) {
        return getUnlockedAreas().concat((cells || []).map(c => makePlannedArea(c.x, c.y)));
    }

    function areaX(a) { return (a.x === undefined || Number.isNaN(a.x)) ? 0 : a.x; }
    function areaY(a) { return (a.y === undefined || Number.isNaN(a.y)) ? 0 : a.y; }

    function isTileInAreas(tx, ty, areas) {
        for (const a of areas) {
            const ax = areaX(a), ay = areaY(a);
            if (tx >= ax && tx < ax + a.width && ty >= ay && ty < ay + a.length) return true;
        }
        return false;
    }

    // Size of the whole grid in tiles, rounded up to full cells
    function getGridSize() {
        let w = 0, h = 0;
        for (const a of state.blockedAreas || []) {
            w = Math.max(w, a.x + CELL);
            h = Math.max(h, a.y + CELL);
        }
        for (const a of areaList()) {
            w = Math.max(w, areaX(a) + a.width);
            h = Math.max(h, areaY(a) + a.length);
        }
        return {
            width: Math.ceil(w / CELL) * CELL,
            height: Math.ceil(h / CELL) * CELL
        };
    }

    function isCellBlocked(cx, cy) {
        return (state.blockedAreas || []).some(a => a.x === cx && a.y === cy);
    }

    function isCellInAreas(cx, cy, areas) {
        for (let dy = 0; dy < CELL; dy++) {
            for (let dx = 0; dx < CELL; dx++) {
                if (isTileInAreas(cx + dx, cy + dy, areas)) return true;
            }
        }
        return false;
    }

    // Shares an edge with any tile of the given areas
    function doesCellTouch(cx, cy, areas) {
        for (let i = 0; i < CELL; i++) {
            if (isTileInAreas(cx - 1, cy + i, areas)) return true;
            if (isTileInAreas(cx + CELL, cy + i, areas)) return true;
            if (isTileInAreas(cx + i, cy - 1, areas)) return true;
            if (isTileInAreas(cx + i, cy + CELL, areas)) return true;
        }
        return false;
    }

    // Every cell that could still be unlocked (not unlocked, not planned, not blocked)
    function getCandidateCells() {
        if (!hasExpansionData()) return [];

        const areas = areaList();
        const grid = getGridSize();
        const cells = [];

        for (let cy = 0; cy < grid.height; cy += CELL) {
            for (let cx = 0; cx < grid.width; cx += CELL) {
                if (isCellBlocked(cx, cy)) continue;
                if (isCellInAreas(cx, cy, areas)) continue;
                cells.push({ x: cx, y: cy });
            }
        }
        return cells;
    }

    function getAddableCells() {
        const areas = areaList();
        return getCandidateCells().filter(c => doesCellTouch(c.x, c.y, areas));
    }

    function cellAtTile(tile) {
        return {
            x: Math.floor(tile.x / CELL) * CELL,
            y: Math.floor(tile.y / CELL) * CELL
        };
    }

    function findPlannedAreaAt(cx, cy) {
        return getPlannedAreas().find(a => areaX(a) === cx && areaY(a) === cy) || null;
    }

    function isCellAddable(cx, cy) {
        if (!hasExpansionData()) return false;
        const areas = areaList();
        if (isCellBlocked(cx, cy) || isCellInAreas(cx, cy, areas)) return false;
        const grid = getGridSize();
        if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return false;
        return doesCellTouch(cx, cy, areas);
    }

    function hasBuildingsInCell(cx, cy) {
        for (let dy = 0; dy < CELL; dy++) {
            for (let dx = 0; dx < CELL; dx++) {
                if (state.occupiedTiles.has(app.tileKey(cx + dx, cy + dy))) return true;
            }
        }
        return false;
    }

    // Planned cells that would no longer connect to the city without this one
    function getCutOffWithout(removed) {
        const unlocked = getUnlockedAreas();
        let pending = getPlannedAreas().filter(a => a !== removed);
        const reached = unlocked.slice();

        let progress = true;
        while (pending.length && progress) {
            progress = false;
            pending = pending.filter(a => {
                if (doesCellTouch(areaX(a), areaY(a), reached)) {
                    reached.push(a);
                    progress = true;
                    return false;
                }
                return true;
            });
        }
        return pending;
    }

    // Highlight the cells that would be cut off for FLASH_MS
    function flashCutOff(cells) {
        clearTimeout(cutOffTimer);
        state.expansionCutOff = cells.map(a => ({ x: areaX(a), y: areaY(a) }));
        app.redrawMap();

        cutOffTimer = setTimeout(() => {
            state.expansionCutOff = null;
            app.redrawMap();
        }, FLASH_MS);
    }

    function refreshAfterChange() {
        app.rebuildGridLayer();
        app.rebuildOccupiedTiles();
        app.redrawMap();
        app.updateStats();
        app.autoSave();
    }

    function addExpansion(cx, cy) {
        if (!isCellAddable(cx, cy)) return false;

        app.pushSnapshot();
        state.mapData = areaList().concat(makePlannedArea(cx, cy)); // new array: originalData shares the old one
        refreshAfterChange();
        return true;
    }

    // Show a warning once; while it is still open, highlight it again instead
    function warnOnce(key, message) {
        const open = openWarnings[key];
        if (open && open.isConnected) {
            open.classList.remove('note-flash');
            void open.offsetWidth; // restart the animation
            open.classList.add('note-flash');
            clearTimeout(open._flashTimer);
            open._flashTimer = setTimeout(() => open.classList.remove('note-flash'), FLASH_MS);
            return;
        }

        openWarnings[key] = app.notify({
            level: 'warn',
            title: app.t('XPlan.Expansion.RemoveBlockedTitle', 'Expansion not removed'),
            message
        });
    }

    function removeExpansion(area) {
        const cx = areaX(area), cy = areaY(area);

        if (hasBuildingsInCell(cx, cy)) {
            warnOnce('buildings', app.t('XPlan.Expansion.RemoveHasBuildings', 'Move or store the buildings on this expansion first.'));
            return false;
        }

        const cutOff = getCutOffWithout(area);
        if (cutOff.length) {
            flashCutOff(cutOff);
            warnOnce('disconnects', app.t('XPlan.Expansion.RemoveDisconnects', 'Other planned expansions would no longer touch your city. Remove those first.'));
            return false;
        }

        app.pushSnapshot();
        state.mapData = areaList().filter(a => a !== area);
        refreshAfterChange();
        return true;
    }

    function handleExpansionClick(point) {
        const cell = cellAtTile(app.worldToTile(point.x, point.y));
        const planned = findPlannedAreaAt(cell.x, cell.y);

        if (planned) removeExpansion(planned);
        else addExpansion(cell.x, cell.y);
    }

    function handleExpansionHover(point) {
        const cell = cellAtTile(app.worldToTile(point.x, point.y));
        const prev = state.expansionHover;
        if (prev && prev.x === cell.x && prev.y === cell.y) return;

        state.expansionHover = cell;
        app.redrawMap();
    }

    function setExpansionMode(on) {
        const active = !!on && hasExpansionData();
        if (active === state.expansionMode) {
            updateExpansionUi();
            return;
        }

        state.expansionMode = active;
        state.expansionHover = null;

        if (active) {
            if (app.cancelStreetPlacement && state.streetPlacement.active) app.cancelStreetPlacement();
            state.placingBuilding = null;
            state.dragCopy = null;
            state.placementAnchor = null;
        }

        updateExpansionUi();
        app.redrawMap();
    }

    function updateExpansionUi() {
        if (!dom.placeExpansionBtn) return;

        const available = hasExpansionData();
        if (!available && state.expansionMode) {
            state.expansionMode = false;
            state.expansionHover = null;
        }

        dom.placeExpansionBtn.disabled = !available;
        dom.placeExpansionBtn.title = available
            ? ''
            : app.t('XPlan.Expansion.NoData', 'Open your city in the game to load the expansion data.');
        dom.placeExpansionBtn.classList.toggle('active', state.expansionMode);

        if (dom.plannedExpansionCount) {
            const count = getPlannedAreas().length;
            dom.plannedExpansionCount.textContent = count ? '+' + count : '';
        }
    }

    // --- drawing ------------------------------------------------------------

    // Very faded tiles for every cell that could still be unlocked (grid layer)
    function drawExpansionCandidates(context) {
        const cells = getCandidateCells();
        if (!cells.length) return;

        context.save();
        context.globalAlpha = 0.12;
        context.fillStyle = '#fffead';
        context.strokeStyle = '#cbca4a';
        context.lineWidth = 0.5;

        for (const c of cells) {
            for (let dy = 0; dy < CELL; dy++) {
                for (let dx = 0; dx < CELL; dx++) {
                    app.createMapGridPart({ x: c.x + dx, y: c.y + dy }, context);
                }
            }
        }

        context.globalAlpha = 0.25;
        context.strokeStyle = '#8c8a19';
        for (const c of cells) {
            context.strokeRect(c.x * SIZE, c.y * SIZE, CELL * SIZE, CELL * SIZE);
        }
        context.restore();
    }

    // Addable cells and the hovered cell while expansion mode is on
    function drawExpansionOverlay(context) {
        if (!state.expansionMode) return;

        const lw = 2 / state.zoomScale;
        context.save();

        context.strokeStyle = '#66c440';
        context.lineWidth = lw;
        context.setLineDash([6 / state.zoomScale, 4 / state.zoomScale]);
        for (const c of getAddableCells()) {
            context.globalAlpha = 0.18;
            context.fillStyle = '#66c440';
            context.fillRect(c.x * SIZE, c.y * SIZE, CELL * SIZE, CELL * SIZE);
            context.globalAlpha = 0.9;
            context.strokeRect(c.x * SIZE, c.y * SIZE, CELL * SIZE, CELL * SIZE);
        }

        const hover = state.expansionHover;
        if (hover) {
            let color = null;
            if (findPlannedAreaAt(hover.x, hover.y)) color = '#ff4d4d';
            else if (isCellAddable(hover.x, hover.y)) color = '#66c440';

            if (color) {
                context.setLineDash([]);
                context.globalAlpha = 0.45;
                context.fillStyle = color;
                context.fillRect(hover.x * SIZE, hover.y * SIZE, CELL * SIZE, CELL * SIZE);
                context.globalAlpha = 1;
                context.strokeStyle = color;
                context.strokeRect(hover.x * SIZE, hover.y * SIZE, CELL * SIZE, CELL * SIZE);
            }
        }

        // cells that would be cut off, in the warning's orange
        if (state.expansionCutOff) {
            context.setLineDash([]);
            context.lineWidth = 3 / state.zoomScale;
            context.fillStyle = '#e6972f';
            context.strokeStyle = '#e6972f';
            for (const c of state.expansionCutOff) {
                context.globalAlpha = 0.55;
                context.fillRect(c.x * SIZE, c.y * SIZE, CELL * SIZE, CELL * SIZE);
                context.globalAlpha = 1;
                context.strokeRect(c.x * SIZE, c.y * SIZE, CELL * SIZE, CELL * SIZE);
            }
        }

        context.restore();
    }

    function bindExpansionEvents() {
        if (!dom.placeExpansionBtn) return;
        dom.placeExpansionBtn.addEventListener('click', () => setExpansionMode(!state.expansionMode));
        dom.canvas.addEventListener('mouseleave', () => {
            if (!state.expansionHover) return;
            state.expansionHover = null;
            app.redrawMap();
        });
        updateExpansionUi();
    }

    app.EXPANSION_CELL = CELL;
    app.normalizeBlockedAreas = normalizeBlockedAreas;
    app.hasExpansionData = hasExpansionData;
    app.getPlannedAreas = getPlannedAreas;
    app.getUnlockedAreas = getUnlockedAreas;
    app.withPlannedAreas = withPlannedAreas;
    app.getExpansionGridSize = getGridSize;
    app.handleExpansionClick = handleExpansionClick;
    app.handleExpansionHover = handleExpansionHover;
    app.setExpansionMode = setExpansionMode;
    app.updateExpansionUi = updateExpansionUi;
    app.drawExpansionCandidates = drawExpansionCandidates;
    app.drawExpansionOverlay = drawExpansionOverlay;
    app.bindExpansionEvents = bindExpansionEvents;
})(window.PlannerApp);
