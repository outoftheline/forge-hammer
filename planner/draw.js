'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const state = app.state;
    const dom = app.dom;
    const SIZE = app.SIZE;
    const FONT_SIZE = 15;
    const FONT = FONT_SIZE + 'px Arial';
    const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

    const canvas = dom.canvas;
    const ctx = canvas.getContext('2d', { alpha: true });

    ctx.textBaseline = 'middle';
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;

    function getDpr() {
        return Math.min(window.devicePixelRatio || 1, 2);
    }

    function resizeCanvasToCSSSize() {
        const cssRect = canvas.parentElement.getBoundingClientRect();
        canvas.style.width = cssRect.width + 'px';
        canvas.style.height = cssRect.height + 'px';

        const rect = canvas.getBoundingClientRect();
        const dpr = getDpr();

        const newW = Math.max(1, Math.round(rect.width * dpr));
        const newH = Math.max(1, Math.round(rect.height * dpr));

        if (canvas.width !== newW) canvas.width = newW;
        if (canvas.height !== newH) canvas.height = newH;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = FONT;
        ctx.lineWidth = 2;
    }

    function getMapBoundsPx() {
        let maxX = 0, maxY = 0;
        if (state.mapData) {
            for (const exp of state.mapData) {
                const right  = ((exp.x || 0) + exp.width)  * SIZE;
                const bottom = ((exp.y || 0) + exp.length) * SIZE;
                if (right  > maxX) maxX = right;
                if (bottom > maxY) maxY = bottom;
            }
        }
        return { width: maxX, height: maxY };
    }

    function isTileInMapData(tx, ty) {
        if (!state.mapData || !state.mapData.length) return false;

        for (const exp of state.mapData) {
            const ex = (exp.x === undefined || Number.isNaN(exp.x)) ? 0 : exp.x;
            const ey = (exp.y === undefined || Number.isNaN(exp.y)) ? 0 : exp.y;

            if (tx >= ex && tx < ex + exp.width && ty >= ey && ty < ey + exp.length) {
                return true;
            }
        }
        return false;
    }

    function screenToWorld(cssX, cssY) {
        const x = cssX / state.zoomScale + state.camX;
        const y = cssY / state.zoomScale + state.camY;

        if (!state.rotated) return { x, y };

        const bounds = getMapBoundsPx();
        return {
            x: y,
            y: bounds.height - x
        };
    }

    function getCanvasPointElem(evt) {
        const rect = canvas.getBoundingClientRect();
        return screenToWorld(evt.clientX - rect.left, evt.clientY - rect.top);
    }

    function rebuildGridLayer() {
        const dpr = getDpr();
        const bounds = getMapBoundsPx();
        const maxX = bounds.width;
        const maxY = bounds.height;

        state.gridCanvas = document.createElement('canvas');
        state.gridCanvas.width  = Math.max(1, Math.round(maxX * dpr));
        state.gridCanvas.height = Math.max(1, Math.round(maxY * dpr));
        state.gridCtx = state.gridCanvas.getContext('2d');

        state.gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (state.mapData) {
            for (const exp of state.mapData) drawExpansion(exp, state.gridCtx);
        }
    }

    function drawExpansion(expansion, context) {
        context.fillStyle = '#fffead';
        context.strokeStyle = '#cbca4a';
        context.lineWidth = 0.5;

        for (let a = 0; a < expansion.length; a++) {
            for (let b = 0; b < expansion.width; b++) {
                createMapGridPart(
                    {
                        x: ((expansion.x === undefined || Number.isNaN(expansion.x)) ? 0 : expansion.x) + a,
                        y: (expansion.y === undefined ? 0 : expansion.y) + b
                    },
                    context
                );
            }
        }

        context.strokeStyle = '#8c8a19';
        context.strokeRect((expansion.x || 0) * SIZE, (expansion.y || 0) * SIZE, expansion.width * SIZE, expansion.length * SIZE);
    }

    function createMapGridPart(data, context) {
        const top = data.y * SIZE;
        const left = data.x * SIZE;

        context.fillRect(left, top, SIZE, SIZE);
        context.strokeRect(left, top, SIZE, SIZE);
    }

    function drawBuildingCopy(context, building, x, y, valid) {
        context.save();

        context.globalAlpha = 0.55;
        context.fillStyle = valid ? '#66c440' : '#ff4d4d';
        context.fillRect(x, y, building.width, building.height);

        context.globalAlpha = 1;
        context.strokeStyle = valid ? '#1d6b2a' : '#8b0000';
        context.lineWidth = 2 / state.zoomScale;
        context.setLineDash([6 / state.zoomScale, 4 / state.zoomScale]);
        context.strokeRect(x, y, building.width, building.height);

        context.restore();
    }

    function drawMap() {
        const city = Object.values(state.cityData);
        state.mapBuildings = [];

        for (const building of city) {
            const buildingData = state.metaById.get(building.cityentity_id);
            if (!buildingData) continue;

            if (
                buildingData.type !== 'off_grid' &&
                buildingData.type !== 'outpost_ship' &&
                buildingData.type !== 'friends_tavern' &&
                !String(buildingData.type).includes('hub')
            ) {
                const newBuilding = app.createRotatedBuilding({ ...building }, buildingData);
                state.mapBuildings.push(newBuilding);
            }
        }

        app.rebuildOccupiedTiles();
        redrawMap();
    }

    function drawEmptyMap() {
        state.mapBuildings = [];
        app.rebuildOccupiedTiles();
        redrawMap();
    }

    function redrawMap() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const dpr = getDpr();

        ctx.setTransform(
            dpr * state.zoomScale, 0,
            0, dpr * state.zoomScale,
            -state.camX * dpr * state.zoomScale,
            -state.camY * dpr * state.zoomScale
        );

        if (state.rotated) {
            const bounds = getMapBoundsPx();
            ctx.transform(0, 1, -1, 0, bounds.height, 0);
        }

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = FONT;
        ctx.lineWidth = 1 / state.zoomScale;

        if (state.gridCanvas) {
            const bounds = getMapBoundsPx();
            ctx.drawImage(state.gridCanvas, 0, 0, bounds.width, bounds.height);
        }

        for (const building of state.mapBuildings) {
            building.draw(ctx);
        }

        if (state.dragCopy) {
            drawBuildingCopy(ctx, state.dragCopy.building, state.dragCopy.x, state.dragCopy.y, state.dragCopy.valid);
        }

        drawSelectionRect(ctx);
        drawStreetPreview(ctx);
    }

    function calculatePopulation() {
        let total = 0;
        for (const building of state.mapBuildings) {
            total += (building.population || 0);
        }
        return total;
    }

    function updateStats() {
        const oldStreetAmount = Object.values(state.cityData).filter(x => x.type === 'street').length;
        if (dom.oldStreetsEl) dom.oldStreetsEl.textContent = oldStreetAmount;

        const streetAmount = state.mapBuildings.filter(x => x.data.type === 'street').length;
        if (dom.newStreetsEl) dom.newStreetsEl.textContent = streetAmount;

        const population = calculatePopulation();
        if (dom.populationEl) {
            dom.populationEl.textContent = population;
            dom.populationEl.classList.toggle('negative', population < 0);
            dom.populationEl.title = population < 0
                ? 'Warning: population is negative — this layout needs more residences.'
                : '';
        }
    }

    function clampZoomToSteps(dir) {
        let idx = 0;
        for (let i = 0; i < ZOOM_STEPS.length; i++) {
            if (ZOOM_STEPS[i] <= state.zoomScale) idx = i;
        }
        const nextIdx = Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx + dir));
        return ZOOM_STEPS[nextIdx];
    }

    function zoomAtScreenPoint(newZoomScale, screenX, screenY) {
        const pointBefore = screenToWorld(screenX, screenY);

        state.zoomScale = newZoomScale;

        const pointAfter = screenToWorld(screenX, screenY);
        state.camX += pointBefore.x - pointAfter.x;
        state.camY += pointBefore.y - pointAfter.y;

        redrawMap();
        if (app.saveViewState) app.saveViewState();
    }

    function zoomIn() {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const newScale = clampZoomToSteps(+1);
        zoomAtScreenPoint(newScale, cx, cy);
    }

    function zoomOut() {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const newScale = clampZoomToSteps(-1);
        zoomAtScreenPoint(newScale, cx, cy);
    }

    function drawSelectionRect(context) {
        const rect = state.selectionRect;
        if (!rect) return;

        const minX = Math.min(rect.start.x, rect.end.x);
        const minY = Math.min(rect.start.y, rect.end.y);
        const maxX = Math.max(rect.start.x, rect.end.x);
        const maxY = Math.max(rect.start.y, rect.end.y);
        const w = maxX - minX;
        const h = maxY - minY;

        // Highlight buildings that fall within the current drag rect.
        for (const building of state.mapBuildings) {
            if (building.meta.type === 'street') continue;
            const intersects =
                building.x <= maxX &&
                building.y <= maxY &&
                (building.x + building.width)  >= minX &&
                (building.y + building.height) >= minY;

            if (intersects && !building.isSelected) {
                context.save();
                context.globalAlpha = 0.25;
                context.fillStyle = '#4af';
                context.fillRect(building.x, building.y, building.width, building.height);
                context.restore();
            }
        }

        // Draw the rubber-band rectangle itself.
        context.save();
        context.globalAlpha = 0.15;
        context.fillStyle = '#4af';
        context.fillRect(minX, minY, w, h);

        context.globalAlpha = 1;
        context.strokeStyle = '#4af';
        context.lineWidth = 1 / state.zoomScale;
        context.setLineDash([6 / state.zoomScale, 3 / state.zoomScale]);
        context.strokeRect(minX, minY, w, h);
        context.restore();
    }

    function drawStreetPreview(context) {
        const streetState = state.streetPlacement;
        if (!streetState.active || !streetState.previewTiles.length) return;

        const size = streetState.size || 1;
        const boxSize = SIZE * size;

        context.save();

        for (const tile of streetState.previewTiles) {
            const blocked = app.isFootprintOccupiedByNonStreet(tile.x, tile.y, size);
            const px = tile.x * SIZE;
            const py = tile.y * SIZE;

            context.globalAlpha = 0.55;
            context.fillStyle = blocked ? '#ff4d4d' : '#66c440';
            context.fillRect(px, py, boxSize, boxSize);

            context.globalAlpha = 1;
            context.strokeStyle = blocked ? '#8b0000' : '#1d6b2a';
            context.lineWidth = 2 / state.zoomScale;
            context.setLineDash([6 / state.zoomScale, 4 / state.zoomScale]);
            context.strokeRect(px, py, boxSize, boxSize);
        }

        context.restore();
    }

    app.ctx = ctx;
    app.getDpr = getDpr;
    app.resizeCanvasToCSSSize = resizeCanvasToCSSSize;
    app.getMapBoundsPx = getMapBoundsPx;
    app.isTileInMapData = isTileInMapData;
    app.screenToWorld = screenToWorld;
    app.getCanvasPointElem = getCanvasPointElem;
    app.rebuildGridLayer = rebuildGridLayer;
    app.drawExpansion = drawExpansion;
    app.createMapGridPart = createMapGridPart;
    app.drawBuildingCopy = drawBuildingCopy;
    app.drawMap = drawMap;
    app.drawEmptyMap = drawEmptyMap;
    app.redrawMap = redrawMap;
    app.updateStats = updateStats;
    app.calculatePopulation = calculatePopulation;
    app.clampZoomToSteps = clampZoomToSteps;
    app.zoomAtScreenPoint = zoomAtScreenPoint;
    app.zoomIn = zoomIn;
    app.zoomOut = zoomOut;
    app.drawSelectionRect = drawSelectionRect;
    app.drawStreetPreview = drawStreetPreview;
})(window.PlannerApp);