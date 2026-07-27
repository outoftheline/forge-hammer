'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const state = app.state;
    const dom = app.dom;
    const SIZE = app.SIZE;

    function clearSelection() {
        for (const b of state.selectedBuildings) b.isSelected = false;
        state.selectedBuildings = [];
        dom.storeSelectionCount.textContent = '';
        dom.storeSelectionBtn.classList.remove('show');
    }

    function refreshSelectionUi() {
        dom.storeSelectionCount.textContent = state.selectedBuildings.length || '';
        if (state.selectedBuildings.length) {
            dom.storeSelectionBtn.classList.add('show');
        } else {
            dom.storeSelectionBtn.classList.remove('show');
        }
    }

    function storeBuilding(building) {
        app.removeBuildingFromOccupiedTiles(building);

        const idx = state.mapBuildings.indexOf(building);
        if (idx !== -1) state.mapBuildings.splice(idx, 1);

        building.x = 0;
        building.y = 0;
        state.storedBuildings.push(building);
    }

    let wheelZoomSaveTimer = null;

    function handleWheelZoom(e) {
        e.preventDefault();

        const rect = dom.canvas.getBoundingClientRect();
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;

        const factor = Math.exp(-e.deltaY * 0.0015);
        const minZoom = app.MIN_ZOOM || 0.5;
        const maxZoom = app.MAX_ZOOM || 3;
        const newScale = Math.min(maxZoom, Math.max(minZoom, state.zoomScale * factor));

        if (newScale === state.zoomScale) return;
        app.zoomAtScreenPoint(newScale, cssX, cssY, true);

        clearTimeout(wheelZoomSaveTimer);
        wheelZoomSaveTimer = setTimeout(() => {
            if (app.saveViewState) app.saveViewState();
        }, 200);
    }

    function isTypingTarget(target) {
        if (!target) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    }

    const PAN_KEYS = new Set(['w', 'a', 's', 'd']);
    const pannedKeys = new Set();
    const PAN_SPEED = 400; // px/sec at zoomScale 1
    let panRAF = null;
    let lastPanTime = null;

    function panStep(timestamp) {
        if (!pannedKeys.size) {
            panRAF = null;
            lastPanTime = null;
            if (app.saveViewState) app.saveViewState();
            return;
        }

        if (lastPanTime === null) lastPanTime = timestamp;
        const dt = (timestamp - lastPanTime) / 1000;
        lastPanTime = timestamp;

        let dx = 0, dy = 0;
        if (pannedKeys.has('a')) dx -= 1;
        if (pannedKeys.has('d')) dx += 1;
        if (pannedKeys.has('w')) dy -= 1;
        if (pannedKeys.has('s')) dy += 1;

        if (dx || dy) {
            const len = Math.hypot(dx, dy);
            const worldDelta = (PAN_SPEED * dt) / state.zoomScale;
            state.camX += (dx / len) * worldDelta;
            state.camY += (dy / len) * worldDelta;
            app.redrawMap();
        }

        panRAF = requestAnimationFrame(panStep);
    }

    function startPanLoop() {
        if (panRAF === null) {
            lastPanTime = null;
            panRAF = requestAnimationFrame(panStep);
        }
    }

    function handlePanKeyDown(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTypingTarget(e.target)) return;

        const key = e.key.toLowerCase();
        if (!PAN_KEYS.has(key)) return;

        pannedKeys.add(key);
        startPanLoop();
    }

    function handlePanKeyUp(e) {
        const key = e.key.toLowerCase();
        if (!PAN_KEYS.has(key)) return;
        pannedKeys.delete(key);
    }

    function stopPanningAll() {
        pannedKeys.clear();
    }

    function parseGroupId(groupId) {
        if (typeof groupId !== 'string') return { metaId: groupId, custom: false };
        if (groupId.endsWith(':custom')) return { metaId: groupId.slice(0, -7), custom: true };
        return { metaId: groupId, custom: false };
    }

    function deleteStoredBuildings(metaId, custom = false) {
        if (!metaId) return;

        const remaining = [];
        const toDelete = [];
        for (const b of state.storedBuildings) {
            if (String(b.meta.id) === String(metaId) && !!b.custom === !!custom) toDelete.push(b);
            else remaining.push(b);
        }
        if (!toDelete.length) return;

        app.pushSnapshot();

        state.storedBuildings = remaining;
        state.deletedBuildings = (state.deletedBuildings || []).concat(toDelete);

        // cancel building placement
        if (
            state.placingBuilding &&
            String(state.placingBuilding.meta.id) === String(metaId) &&
            !!state.placingBuilding.custom === !!custom
        ) {
            state.placingBuilding = null;
            state.dragCopy = null;
        }

        state.selectedStoredMetaId = null;

        app.showStoredBuildings();
        app.redrawMap();
        app.autoSave();
    }

    function restoreDeletedBuildings(metaId, custom = false) {
        if (!metaId || !state.deletedBuildings || !state.deletedBuildings.length) return;

        const remaining = [];
        const toRestore = [];
        for (const b of state.deletedBuildings) {
            if (String(b.meta.id) === String(metaId) && !!b.custom === !!custom) toRestore.push(b);
            else remaining.push(b);
        }
        if (!toRestore.length) return;

        app.pushSnapshot();

        state.deletedBuildings = remaining;
        state.storedBuildings = state.storedBuildings.concat(toRestore);

        app.showStoredBuildings();
        app.autoSave();
    }

    function deleteSelectedMapBuildings() {
        const buildings = state.selectedBuildings.slice();
        if (!buildings.length) return;

        app.pushSnapshot();

        for (const building of buildings) {
            app.removeBuildingFromOccupiedTiles(building);

            const idx = state.mapBuildings.indexOf(building);
            if (idx !== -1) state.mapBuildings.splice(idx, 1);

            building.isSelected = false;
            building.x = 0;
            building.y = 0;

            state.deletedBuildings = (state.deletedBuildings || []).concat(building);
        }

        state.selectedBuildings = [];
        refreshSelectionUi();

        app.showStoredBuildings();
        app.redrawMap();
        app.updateStats();
        app.autoSave();
    }

    function sortStoredBuildingsByAreaDesc() {
        state.storedBuildings.sort((a, b) => {
            const aSize = app.getMetaSize(a.meta);
            const bSize = app.getMetaSize(b.meta);
            return (bSize.width * bSize.height) - (aSize.width * aSize.height);
        });
    }

    function startPlacingStoredBuilding(metaId, custom = false) {
        const stored = state.storedBuildings.find(b => String(b.meta.id) === String(metaId) && !!b.custom === !!custom);
        if (!stored) return;

        clearSelection();

        state.placingBuilding = app.createRotatedBuilding(
            {
                ...stored.data,
                x: 0,
                y: 0
            },
            stored.meta
        );

        updatePlacingBuildingPreview();
    }

    function continuePlacingStoredBuilding(metaId, custom = false) {
        const nextStored = state.storedBuildings.find(b => String(b.meta.id) === String(metaId) && !!b.custom === !!custom);

        if (!nextStored) {
            state.placingBuilding = null;
            state.dragCopy = null;
            app.redrawMap();
            return;
        }

        state.placingBuilding = app.createRotatedBuilding(
            {
                ...nextStored.data,
                x: 0,
                y: 0
            },
            nextStored.meta
        );

        updatePlacingBuildingPreview();
    }

    function updatePlacingBuildingPreview() {
        if (!state.placingBuilding || !state.lastMouseElem) {
            state.dragCopy = null;
            app.redrawMap();
            return;
        }

        const snappedX = app.snapToGrid(state.lastMouseElem.x - state.placingBuilding.width / 2);
        const snappedY = app.snapToGrid(state.lastMouseElem.y - state.placingBuilding.height / 2);

        state.dragCopy = {
            building: state.placingBuilding,
            x: snappedX,
            y: snappedY,
            valid: app.canPlaceAt(state.placingBuilding, snappedX, snappedY)
        };

        app.redrawMap();
    }

    function storeSelectedBuildings() {
        app.pushSnapshot();
        for (const building of state.selectedBuildings) {
            storeBuilding(building);
        }

        clearSelection();
        app.showStoredBuildings();
        app.redrawMap();
        app.updateStats();
        app.autoSave();
    }

    function resetCity() {
        app.restoreCity();

        state.mapBuildings = [];
        state.storedBuildings = [];
        state.deletedBuildings = [];
        state.selectedBuildings = [];
        state.selectedStoredMetaId = null;
        state.placingBuilding = null;
        state.dragCopy = null;
        state.dragCopies = null;
        state.rotated = false;
        state.camX = 0;
        state.camY = 0;
        state.zoomScale = 0.75;

        state.history = [];
        state.future  = [];
        app.updateUndoRedoButtons();

        app.rebuildGridLayer();
        app.drawMap();
        app.rebuildOccupiedTiles();
        app.updateStats();
        app.showStoredBuildings();
    }

    function handleCanvasClick(e) {
        if (state._suppressCanvasClick) {
            state._suppressCanvasClick = false;
            return;
        }

        if (state.placingBuilding) return;
        if (e.altKey || e.ctrlKey) return;

        if (state.streetPlacement.active) {
            const point = app.getCanvasPointElem(e);
            const tile = app.worldToTile(point.x, point.y);
            const size = state.streetPlacement.size || 1;

            if (size > 1) {
                state.streetPlacement.previewTiles = [tile];
                commitStreetPreview();
            } else if (!state.streetPlacement.startTile) {
                state.streetPlacement.startTile = tile;
                state.streetPlacement.previewTiles = [tile];
            } else {
                state.streetPlacement.previewTiles = app.getStraightLineTiles(
                    state.streetPlacement.startTile,
                    tile
                );
                commitStreetPreview();
            }

            app.redrawMap();
            return;
        }

        const point = app.getCanvasPointElem(e);
        const building = app.hitTestBuilding(point.x, point.y);
        if (!building) return;

        const alreadySelected = state.selectedBuildings.includes(building);

        if (alreadySelected && state.selectedBuildings.length === 1) { // clicking on one building deselects it
            building.isSelected = false;
            state.selectedBuildings = [];
        } else if (alreadySelected) { // do nothing so dragging a group of buildings works
        } else { // select one building
            for (const b of state.selectedBuildings) b.isSelected = false;
            building.isSelected = true;
            state.selectedBuildings = [building];
        }

        refreshSelectionUi();
        app.redrawMap();
    }

    function handleCanvasMouseMove(e) {
        state.lastMouseElem = app.getCanvasPointElem(e);

        if (state.streetPlacement.active) {
            const currentTile = app.worldToTile(state.lastMouseElem.x, state.lastMouseElem.y);
            const size = state.streetPlacement.size || 1;

            if (size > 1) {
                state.streetPlacement.previewTiles = [currentTile];
            } else if (state.streetPlacement.startTile) {
                state.streetPlacement.previewTiles = app.getStraightLineTiles(
                    state.streetPlacement.startTile,
                    currentTile
                );
            } else {
                state.streetPlacement.previewTiles = [currentTile];
            }

            app.redrawMap();
            return;
        }

        if (!state.placingBuilding) return;

        const snappedX = app.snapToGrid(state.lastMouseElem.x - state.placingBuilding.width / 2);
        const snappedY = app.snapToGrid(state.lastMouseElem.y - state.placingBuilding.height / 2);

        const valid = app.canPlaceAt(state.placingBuilding, snappedX, snappedY);

        state.dragCopy = {
            building: state.placingBuilding,
            x: snappedX,
            y: snappedY,
            valid
        };

        app.redrawMap();
    }

    function handleCanvasMouseDownPlace(e) {
        if (e.button !== 0) return;
        if (!state.placingBuilding || !state.dragCopy) return;
        if (e.altKey || e.ctrlKey) return;
        if (!state.dragCopy.valid) return;

        const placedMetaId = state.placingBuilding.meta.id || false;
        const placedCustom = !!state.placingBuilding.custom;
        const fromMeta = state.placingBuilding._fromMeta === true;

        app.pushSnapshot();

        state.placingBuilding.x = state.dragCopy.x;
        state.placingBuilding.y = state.dragCopy.y;
        state.placingBuilding.data.x = state.dragCopy.x / SIZE;
        state.placingBuilding.data.y = state.dragCopy.y / SIZE;
        state.placingBuilding._fromMeta = undefined;

        state.mapBuildings.push(state.placingBuilding);
        app.addBuildingToOccupiedTiles(state.placingBuilding);

        if (fromMeta) {
            // Re-arm immediately with a fresh copy of the same building.
            const meta = state.metaById.get(String(placedMetaId));
            if (meta) {
                state.placingBuilding = app.createRotatedBuilding(
                    { cityentity_id: meta.id, x: 0, y: 0, era: state.currentEra, custom: true },
                    meta
                );
                state.placingBuilding._fromMeta = true;
            } else {
                state.placingBuilding = null;
                state.dragCopy = null;
            }
        } else {
            const idx = state.storedBuildings.findIndex(b => String(b.meta.id) === String(placedMetaId) && !!b.custom === !!placedCustom);
            if (idx !== -1) state.storedBuildings.splice(idx, 1);
            continuePlacingStoredBuilding(placedMetaId, placedCustom);
        }

        app.showStoredBuildings(String(placedMetaId) + (placedCustom ? ':custom' : ''));
        app.updateStats();
        app.autoSave();
    }

    function getStreetMetas() {
        return Array.from(state.metaById.values()).filter(x => x.type === 'street');
    }

    function getStreetFootprintSizes() {
        const sizes = new Set();
        for (const meta of getStreetMetas()) {
            const dims = app.getMetaSize(meta);
            sizes.add(Math.max(dims.width, dims.height) || 1);
        }
        return Array.from(sizes).sort((a, b) => a - b);
    }

    function getStreetMetaForSize(size) {
        const metas = getStreetMetas();
        const match = metas.find(meta => {
            const dims = app.getMetaSize(meta);
            return Math.max(dims.width, dims.height) === size;
        });
        return match || metas[0] || null;
    }

    function renderStreetSizeOptions() {
        if (!dom.streetSizeGroup) return;

        const sizes = getStreetFootprintSizes();

        if (sizes.length <= 1) {
            state.streetPlacement.size = sizes[0] || 1;
            dom.streetSizeGroup.innerHTML = '';
            return;
        }

        if (!sizes.includes(state.streetPlacement.size)) {
            state.streetPlacement.size = sizes[0];
        }

        dom.streetSizeGroup.innerHTML = sizes.map(size =>
            '<button class="btn street-size-btn' + (size === state.streetPlacement.size ? ' active' : '') + '" data-size="' + size + '">' +
                size + 'x' + size +
            '</button>'
        ).join('');
    }

    function startStreetPlacement() {
        if (state.streetPlacement.active) {
            cancelStreetPlacement();
            return;
        }
        state.placingBuilding = null;
        state.dragCopy = null;
        state.streetPlacement.active = true;
        state.streetPlacement.startTile = null;
        state.streetPlacement.previewTiles = [];
        renderStreetSizeOptions();
        dom.placeStreetBtn.classList.add('active');
        dom.streetSizeGroup.classList.add('active');
        app.redrawMap();
    }

    function cancelStreetPlacement() {
        state.streetPlacement.active = false;
        state.streetPlacement.startTile = null;
        state.streetPlacement.previewTiles = [];
        dom.placeStreetBtn.classList.remove('active');
        dom.streetSizeGroup.classList.remove('active');
        app.redrawMap();
    }

    function createStreetBuildingAtTile(tx, ty, streetMeta) {
        return app.createRotatedBuilding(
            {
                cityentity_id: streetMeta.id,
                type: 'street',
                x: tx,
                y: ty,
                era: state.currentEra
            },
            streetMeta
        );
    }

    function commitStreetPreview() {
        const size = state.streetPlacement.size || 1;
        const streetMeta = getStreetMetaForSize(size);
        if (!streetMeta) return;

        app.pushSnapshot();

        for (const tile of state.streetPlacement.previewTiles) {
            if (app.isFootprintOccupiedByNonStreet(tile.x, tile.y, size)) continue;

            const existingStreets = app.getStreetsInFootprint(tile.x, tile.y, size);
            if (existingStreets.length) {
                for (const existing of existingStreets) {
                    app.removeBuildingFromOccupiedTiles(existing);
                    const idx = state.mapBuildings.indexOf(existing);
                    if (idx !== -1) state.mapBuildings.splice(idx, 1);
                }
                continue;
            }

            const street = createStreetBuildingAtTile(tile.x, tile.y, streetMeta);
            state.mapBuildings.push(street);
            app.addBuildingToOccupiedTiles(street);
        }

        app.updateStats();
        app.autoSave();
        state.streetPlacement.startTile = null;
        state.streetPlacement.previewTiles = [];
        app.redrawMap();
    }

    function bindMapDrag() {
        let drag = null;

        const mouseDownHandler = (e) => {
            if (e.button !== 0) return;
            if (state.placingBuilding) return;
            if (state.streetPlacement.active && !e.altKey) return;

            let mode = null;
            let grabbed = null;

            if (e.altKey) mode = 'pan';
            else if (e.ctrlKey) mode = 'select';
            else {
                if (state.selectedBuildings.length) {
                    const p = app.getCanvasPointElem(e);
                    grabbed = state.selectedBuildings.find(b =>
                        p.x >= b.x && p.x <= b.x + b.width &&
                        p.y >= b.y && p.y <= b.y + b.height
                    );
                    if (grabbed) mode = 'move';
                }
            }

            if (!mode) return;
            e.preventDefault();

            const startElem = app.getCanvasPointElem(e);

            drag = {
                mode,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startCamX: state.camX,
                startCamY: state.camY,
                startElem,
                endElem: startElem
            };

            if (mode === 'move') {
                drag.buildings = state.selectedBuildings.map(b => ({
                    building: b,
                    startX: b.x,
                    startY: b.y
                }));
                drag.grabbedStartX = grabbed.x;
                drag.grabbedStartY = grabbed.y;

                app.pushSnapshot();

                for (const entry of drag.buildings) {
                    app.removeBuildingFromOccupiedTiles(entry.building);
                }

                state.dragCopies = drag.buildings.map(entry => ({
                    building: entry.building,
                    x: entry.startX,
                    y: entry.startY,
                    valid: true
                }));

                drag.grabOffsetX = startElem.x - grabbed.x;
                drag.grabOffsetY = startElem.y - grabbed.y;
            }

            document.addEventListener('mousemove', mouseMoveHandler, { passive: false });
            document.addEventListener('mouseup', mouseUpHandler, { passive: false });
        };

        const mouseMoveHandler = (e) => {
            if (!drag) return;
            e.preventDefault();

            if (drag.mode === 'pan') {
                const dx = (e.clientX - drag.startClientX) / state.zoomScale;
                const dy = (e.clientY - drag.startClientY) / state.zoomScale;
                state.camX = drag.startCamX - dx;
                state.camY = drag.startCamY - dy;
                app.redrawMap();
                return;
            }

            if (drag.mode === 'select') {
                drag.endElem = app.getCanvasPointElem(e);
                state.selectionRect = { start: drag.startElem, end: drag.endElem };
                app.redrawMap();
                return;
            }

            if (drag.mode === 'move') {
                const p = app.getCanvasPointElem(e);

                const desiredGrabbedX = p.x - drag.grabOffsetX;
                const desiredGrabbedY = p.y - drag.grabOffsetY;

                const snappedGrabbedX = app.snapToGrid(desiredGrabbedX);
                const snappedGrabbedY = app.snapToGrid(desiredGrabbedY);

                const deltaX = snappedGrabbedX - drag.grabbedStartX;
                const deltaY = snappedGrabbedY - drag.grabbedStartY;

                let groupValid = true;
                const tentative = drag.buildings.map(entry => {
                    const x = entry.startX + deltaX;
                    const y = entry.startY + deltaY;
                    if (!app.canPlaceAt(entry.building, x, y)) groupValid = false;
                    return { building: entry.building, x, y };
                });

                state.dragCopies = tentative.map(t => ({
                    building: t.building,
                    x: t.x,
                    y: t.y,
                    valid: groupValid
                }));

                // only place if the whole group fits
                if (groupValid) {
                    for (const t of tentative) {
                        t.building.x = t.x;
                        t.building.y = t.y;
                        t.building.data.x = t.x / SIZE;
                        t.building.data.y = t.y / SIZE;
                    }
                }

                const sidebarRect = dom.buildingsListEl.closest('.sidebar').getBoundingClientRect();
                const overSidebar =
                    e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right &&
                    e.clientY >= sidebarRect.top  && e.clientY <= sidebarRect.bottom;
                dom.buildingsListEl.closest('.sidebar').classList.toggle('drop-target', overSidebar);

                app.redrawMap();
                return;
            }
        };

        const mouseUpHandler = (e) => {
            if (!drag) return;
            e.preventDefault();

            if (drag.mode === 'pan') {
                if (app.saveViewState) app.saveViewState();
            }

            if (drag.mode === 'select') {
                state.selectionRect = null;
                const endElem = app.getCanvasPointElem(e);

                const min = {
                    x: Math.min(drag.startElem.x, endElem.x),
                    y: Math.min(drag.startElem.y, endElem.y)
                };
                const max = {
                    x: Math.max(drag.startElem.x, endElem.x),
                    y: Math.max(drag.startElem.y, endElem.y)
                };

                let changed = false;

                for (const building of state.mapBuildings) {
                    if (building.meta.type === 'street') continue;

                    const intersects =
                        building.x <= max.x &&
                        building.y <= max.y &&
                        (building.x + building.width) >= min.x &&
                        (building.y + building.height) >= min.y;

                    if (intersects) {
                        if (!building.isSelected) {
                            building.isSelected = true;
                            state.selectedBuildings.push(building);
                            changed = true;
                        } else {
                            building.isSelected = false;
                            state.selectedBuildings = state.selectedBuildings.filter(b => b !== building);
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    refreshSelectionUi();
                    app.redrawMap();
                }
            }

            if (drag.mode === 'move') {
                state._suppressCanvasClick = true;

                const sidebar = dom.buildingsListEl.closest('.sidebar');
                sidebar.classList.remove('drop-target');

                const sidebarRect = sidebar.getBoundingClientRect();
                const overSidebar =
                    e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right &&
                    e.clientY >= sidebarRect.top  && e.clientY <= sidebarRect.bottom;

                if (overSidebar) {
                    for (const entry of drag.buildings) {
                        const building = entry.building;
                        const idx = state.mapBuildings.indexOf(building);
                        if (idx !== -1) state.mapBuildings.splice(idx, 1);

                        building.x = 0;
                        building.y = 0;
                        building.data.x = 0;
                        building.data.y = 0;
                        building.isSelected = false;
                        state.storedBuildings.push(building);
                    }

                    state.selectedBuildings = [];
                    refreshSelectionUi();

                    app.showStoredBuildings();
                    app.updateStats();
                } else {
                    for (const entry of drag.buildings) {
                        app.addBuildingToOccupiedTiles(entry.building);
                    }
                }

                state.dragCopies = null;
                app.redrawMap();
                app.autoSave();

                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                drag = null;
                state.dragCopy = null;
                return;
            }

            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            drag = null;
            state.dragCopy = null;
        };

        dom.canvas.addEventListener('mousedown', mouseDownHandler);
    }

    function startPlacingMetaBuilding(metaId) {
        const meta = state.metaById.get(String(metaId));
        if (!meta) return;

        clearSelection();

        state.placingBuilding = app.createRotatedBuilding(
            { cityentity_id: meta.id, x: 0, y: 0, era: state.currentEra, custom: true },
            meta
        );
        state.placingBuilding._fromMeta = true;  // flag: not from storedBuildings

        app.clearMetaSearch();
        updatePlacingBuildingPreview();
    }

    function startPlanNameEdit(li, planId) {
        if (!li || !planId) return;

        const nameEl = li.querySelector('.plan-name');
        if (!nameEl || li.querySelector('.plan-name-input')) return; // already editing

        const currentName = nameEl.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;

        nameEl.replaceWith(input);
        input.focus();
        input.select();

        let settled = false;

        const finish = () => {
            if (input.isConnected) input.replaceWith(nameEl);
        };

        const commit = async () => {
            if (settled) return;
            settled = true;

            const trimmed = input.value.trim();
            finish();

            if (!trimmed || trimmed === currentName) return;

            nameEl.textContent = trimmed; // optimistic update

            try {
                const success = await app.renamePlanInDatabase(planId, trimmed);
                if (!success) throw new Error('Plan rename failed');
            } catch (err) {
                console.error('Failed to rename plan:', err);
                nameEl.textContent = currentName;
                alert(app.t('XPlan.Alerts.RenameFailed', 'Failed to rename plan.'));
            }
        };

        const cancel = () => {
            if (settled) return;
            settled = true;
            finish();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur(); // triggers commit via the blur handler below
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
            }
        });

        input.addEventListener('blur', commit);
        input.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    async function refreshPlanListUi() {
        if (!dom.planListItems) return;

        dom.planListItems.innerHTML = '<li class="empty">' + app.t('XPlan.PlanList.Loading', 'Loading…') + '</li>';

        let plans = [];
        try {
            plans = await app.getPlanList();
        } catch (err) {
            console.error('Failed to load plan list:', err);
            dom.planListItems.innerHTML = '<li class="empty">' + app.t('XPlan.PlanList.LoadFailed', 'Failed to load saved plans.') + '</li>';
            return;
        }

        if (!plans || !plans.length) {
            dom.planListItems.innerHTML = '<li class="empty">' + app.t('XPlan.PlanList.Empty', 'No saved plans yet.') + '</li>';
            return;
        }

        plans.sort((a, b) => (b.date || 0) - (a.date || 0));

        const loadTitle = app.t('XPlan.PlanList.LoadPlan', 'Load plan');
        const renameTitle = app.t('XPlan.PlanList.RenamePlan', 'Rename plan');
        const deleteTitle = app.t('XPlan.PlanList.DeletePlan', 'Delete plan');
        const unnamed = app.t('XPlan.PlanList.UnnamedPlan', 'Unnamed plan');

        const html = plans.map(plan => {
            const dateStr = plan.date ? new Date(plan.date * 1000).toLocaleString() : '';
            const name = plan.name || unnamed;
            const meta = [plan.world, plan.playerName, dateStr].filter(Boolean).join(' · ');

            return (
                '<li data-plan-id="' + plan.id + '">' +
                    '<span class="plan-info">' +
                        '<span class="plan-name">' + name + '</span>' +
                        '<span class="plan-meta">' + meta + '</span>' +
                    '</span>' +
                    '<div>' +
                    '<button class="btn plan-load" title="' + loadTitle + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-icon lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>' +
                    '<button class="btn plan-rename" title="' + renameTitle + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg></button>' +
                    '<button class="btn plan-delete" title="' + deleteTitle + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
                    '</div>' +
                '</li>'
            );
        });

        dom.planListItems.innerHTML = html.join('');
    }

    function bindModalCloseHandlers() {
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.modal-close');
            if (closeBtn) {
                const modal = closeBtn.closest('.modal');
                if (modal) modal.classList.add('hidden');
                return;
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const openModal = document.querySelector('.modal:not(.hidden)');
            if (openModal) openModal.classList.add('hidden');
        });
    }

    function openModal(modal) {
        if (modal) modal.classList.remove('hidden');
    }

    function showNewDataModal(hasCurrentPlan) {
        if (!dom.newDataModal) return;

        if (dom.newDataPlanNameInput) {
            dom.newDataPlanNameInput.value = app.t('XPlan.Plan.FallbackName', 'Plan') + ' ' + new Date().toLocaleDateString();
        }

        if (dom.newDataDiscardBtn) {
            dom.newDataDiscardBtn.classList.toggle('hidden', !hasCurrentPlan);
        }
        if (dom.newDataModalText) {
            dom.newDataModalText.classList.toggle('hidden', !hasCurrentPlan);
        }

        openModal(dom.newDataModal);

        if (dom.newDataPlanNameInput) {
            dom.newDataPlanNameInput.focus();
            dom.newDataPlanNameInput.select();
        }
    }

    app.showNewDataModal = showNewDataModal;

    function bindEvents(init) {

        bindModalCloseHandlers();

        dom.informationBtn.addEventListener('click', () => {
            openModal(document.querySelector('#information'));
        });

        if (dom.languageSelect) {
            dom.languageSelect.addEventListener('change', () => {
                app.setLanguage(dom.languageSelect.value);
            });
        }

        dom.zoomInBtn.addEventListener('click', app.zoomIn);
        dom.zoomOutBtn.addEventListener('click', app.zoomOut);
        dom.canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
        dom.placeStreetBtn.addEventListener('click', startStreetPlacement);

        if (dom.streetSizeGroup) {
            dom.streetSizeGroup.addEventListener('click', (e) => {
                const btn = e.target.closest('.street-size-btn');
                if (!btn) return;

                state.streetPlacement.size = Number(btn.dataset.size);
                state.streetPlacement.startTile = null;
                state.streetPlacement.previewTiles = [];
                renderStreetSizeOptions();
                app.redrawMap();
            });
        }

        dom.fontBtn.addEventListener('click', () => {
            state.fontSize = (state.fontSize === 15) ? 11 : 15;
            state.font = state.fontSize + 'px Arial';

            app.redrawMap();
        });

        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');
        if (undoBtn) undoBtn.addEventListener('click', () => app.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => app.redo());

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                app.undo();
            } else if (
                (e.ctrlKey || e.metaKey) && e.key === 'y' ||
                (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z'
            ) {
                e.preventDefault();
                app.redo();
            } else if (
                (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'r') &&
                !isTypingTarget(e.target)
            ) {
                if (state.selectedBuildings.length) {
                    e.preventDefault();
                    deleteSelectedMapBuildings();
                } else if (state.selectedStoredMetaId) {
                    e.preventDefault();
                    const { metaId, custom } = parseGroupId(state.selectedStoredMetaId);
                    deleteStoredBuildings(metaId, custom);
                }
            } else if (
                e.key === ' ' &&
                !isTypingTarget(e.target) &&
                state.selectedBuildings.length
            ) {
                e.preventDefault();
                storeSelectedBuildings();
            }
        });

        const turn90Btn = document.getElementById('turn90');
        if (turn90Btn) turn90Btn.addEventListener('click', () => app.rotateLayout());

        dom.storeBuildingsBtn.addEventListener('click', () => {
            app.pushSnapshot();
            state.storedBuildings = state.storedBuildings.concat(state.mapBuildings);

            sortStoredBuildingsByAreaDesc();

            state.mapBuildings = [];
            app.rebuildOccupiedTiles();

            for (const b of state.selectedBuildings) b.isSelected = false;
            state.selectedBuildings = [];
            refreshSelectionUi();

            app.showStoredBuildings();
            app.updateStats();
            app.drawEmptyMap();
            app.autoSave();
        });

        dom.storeSelectionBtn.addEventListener('click', storeSelectedBuildings);

        dom.buildingsListEl.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-id]');
            if (!li) return;

            const groupId = li.dataset.id;
            const { metaId, custom } = parseGroupId(groupId);

            if (li.classList.contains('deleted')) {
                restoreDeletedBuildings(metaId, custom);
                return;
            }

            state.selectedStoredMetaId = groupId;
            li.classList.add('active');
            startPlacingStoredBuilding(metaId, custom);
        });

        dom.canvas.addEventListener('click', handleCanvasClick);
        dom.canvas.addEventListener('mousemove', handleCanvasMouseMove);
        dom.canvas.addEventListener('mousedown', handleCanvasMouseDownPlace);

        dom.removeStreetsBtn.addEventListener('click', () => {
            app.pushSnapshot();
            state.mapBuildings = state.mapBuildings.filter(x => x.meta.type !== 'street');
            app.rebuildOccupiedTiles();
            app.redrawMap();
            app.updateStats();
            app.autoSave();
        });

        dom.resetBtn.addEventListener('click', () => {
            const reset = confirm(app.t('XPlan.Confirms.Restart', 'Do you want to restart from scratch? Your changes will not be saved'));
            if (reset) {
                app.clearSavedLayout();
                resetCity();
            }
        });

        if (dom.saveBtn) {
            dom.saveBtn.addEventListener('click', async () => {
                if (dom.saveBtn.disabled) return;
                let textElem = document.querySelector('#save span');

                const originalText = textElem.textContent;
                dom.saveBtn.disabled = true;
                textElem.textContent = app.t('XPlan.Save.Saving', 'Saving…');

                const success = await app.savePlanToDatabase();

                textElem.textContent = success
                    ? app.t('XPlan.Save.Saved', 'Saved')
                    : app.t('XPlan.Save.Failed', 'Failed to save');
                setTimeout(() => {
                    textElem.textContent = originalText;
                    dom.saveBtn.disabled = false;
                }, 1500);
            });
        }

        if (dom.loadPlanBtn && dom.planListModal) {
            dom.loadPlanBtn.addEventListener('click', async () => {
                openModal(dom.planListModal);
                await refreshPlanListUi();
            });
        }

        if (dom.planListItems) {
            dom.planListItems.addEventListener('click', async (e) => {
                if (e.target.closest('.plan-name-input')) return;

                const renameBtn = e.target.closest('.plan-rename');
                if (renameBtn) {
                    const li = renameBtn.closest('li[data-plan-id]');
                    if (!li) return;
                    startPlanNameEdit(li, Number(li.dataset.planId));
                    return;
                }

                const deleteBtn = e.target.closest('.plan-delete');
                if (deleteBtn) {
                    const li = deleteBtn.closest('li[data-plan-id]');
                    if (!li) return;
                    const planId = Number(li.dataset.planId);
                    if (!confirm(app.t('XPlan.Confirms.DeletePlan', 'Delete this plan? This cannot be undone.'))) return;
                    try {
                        await app.removePlanFromDatabase(planId);
                        await refreshPlanListUi();
                    } catch (err) {
                        console.error('Failed to delete plan:', err);
                        alert(app.t('XPlan.Alerts.DeletePlanFailed', 'Failed to delete plan.'));
                    }
                    return;
                }

                const loadBtn = e.target.closest('.plan-load');
                if (loadBtn) {
                    const li = loadBtn.closest('li[data-plan-id]');
                    if (!li) return;
                    const planId = Number(li.dataset.planId);
                    try {
                        await app.loadPlanFromDatabase(planId);
                        dom.planListModal.classList.add('hidden');
                        dom.submitWindow.classList.add('hidden');
                    } catch (err) {
                        console.error('Failed to load plan:', err);
                        alert(app.t('XPlan.Alerts.LoadPlanFailed', 'Failed to load plan.'));
                    }
                    return;
                }
            });
        }

        if (dom.newDataSaveBtn) {
            dom.newDataSaveBtn.addEventListener('click', async () => {
                const name = dom.newDataPlanNameInput ? dom.newDataPlanNameInput.value : '';
                dom.newDataModal.classList.add('hidden');
                await app.confirmSaveIncomingAsNewPlan(name);
            });
        }

        if (dom.newDataDiscardBtn) {
            dom.newDataDiscardBtn.addEventListener('click', () => {
                app.discardIncomingData();
                dom.newDataModal.classList.add('hidden');
            });
        }

        if (dom.newDataPlanNameInput) {
            dom.newDataPlanNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    dom.newDataSaveBtn.click();
                }
            });
        }

        if (dom.exportBtn) {
            dom.exportBtn.addEventListener('click', () => app.exportSaveToFile());
        }

        if (dom.exportImageBtn) {
            dom.exportImageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                app.exportToImage();
            });
        }

        if (dom.importBtn) {
            dom.importBtn.addEventListener('click', () => dom.importFileInput.click());
        }

        if (dom.importFileInput) {
            dom.importFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    app.importStateFromFile(file);
                    e.target.value = '';
                }
            });
        }

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            if (state.streetPlacement.active) {
                cancelStreetPlacement();
                return;
            }

            if (state.placingBuilding) {
                state.placingBuilding = null;
                state.dragCopy = null;
                app.redrawMap();
                return;
            }
            
            clearSelection();
            app.redrawMap();
        });

        window.addEventListener('resize', () => {
            app.resizeCanvasToCSSSize();
            app.rebuildGridLayer();
            app.redrawMap();
        });

        document.addEventListener('keydown', handlePanKeyDown);
        document.addEventListener('keyup', handlePanKeyUp);
        window.addEventListener('blur', stopPanningAll);

        dom.buildingSort.addEventListener('change', (e) => {
            state.sidebarState.sortBy = e.target.value;
            app.showStoredBuildings();
        });

        dom.buildingFilterText.addEventListener('input', (e) => {
            state.sidebarState.filterText = e.target.value.trim();
            app.showStoredBuildings();
        });

        dom.buildingTypeFilter.addEventListener('change', (e) => {
            state.sidebarState.filterType = e.target.value;
            app.showStoredBuildings();
        });

        dom.buildingStreetFilter.addEventListener('change', (e) => {
            state.sidebarState.filterStreetReq = e.target.value;
            app.showStoredBuildings();
        });

        if (dom.overlayImportFileInput) {
            dom.overlayImportFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    app.importStateFromFile(file);
                    e.target.value = '';
                }
            });
        }

        dom.metaSearchInput.addEventListener('input', (e) => {
            const results = app.searchMeta(e.target.value.trim());
            app.renderMetaSearchResults(results);
        });

        dom.metaSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') app.clearMetaSearch();
        });

        dom.metaSearchResults.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-meta-id]');
            if (!li) return;
            startPlacingMetaBuilding(li.dataset.metaId);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#metaSearch')) {
                app.clearMetaSearch();
            }
        });

        bindMapDrag();
    }

    app.bindEvents = bindEvents;
    app.renderStreetSizeOptions = renderStreetSizeOptions;
    app.clearSelection = clearSelection;
})(window.PlannerApp);