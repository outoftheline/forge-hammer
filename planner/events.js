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

    function isTypingTarget(target) {
        if (!target) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
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

        if (state.activeBuilding) {
            state.activeBuilding.isActive = false;
            state.activeBuilding = null;
        }

        state.placingBuilding = app.createRotatedBuilding(
            {
                ...stored.data,
                x: 0,
                y: 0
            },
            stored.meta
        );

        state.placingBuilding.isActive = true;
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

        state.placingBuilding.isActive = true;
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
        state.activeBuilding = null;
        state.placingBuilding = null;
        state.dragCopy = null;
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

        const currentActiveBuilding = state.mapBuildings.find(x => x.isActive);

        if (currentActiveBuilding && currentActiveBuilding !== building) {
            currentActiveBuilding.isActive = false;
            state.activeBuilding = building;
            building.isActive = true;
        } else if (currentActiveBuilding === building) {
            building.isActive = false;
            state.activeBuilding = null;
        } else {
            state.activeBuilding = building;
            building.isActive = true;
        }

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
        state.placingBuilding.isActive = false;
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
                state.placingBuilding.isActive = true;
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
        return Object.values(state.metaData).filter(x => x.type === 'street');
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
            if (app.isFootprintOccupiedByStreet(tile.x, tile.y, size)) continue;

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

            if (e.altKey) mode = 'pan';
            else if (e.ctrlKey) mode = 'select';
            else {
                if (state.activeBuilding) {
                    const p = app.getCanvasPointElem(e);
                    if (
                        p.x >= state.activeBuilding.x && p.x <= state.activeBuilding.x + state.activeBuilding.width &&
                        p.y >= state.activeBuilding.y && p.y <= state.activeBuilding.y + state.activeBuilding.height
                    ) {
                        mode = 'move';
                    }
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
                drag.building = state.activeBuilding;
                app.pushSnapshot();
                app.removeBuildingFromOccupiedTiles(drag.building);

                state.dragCopy = {
                    building: drag.building,
                    x: drag.building.x,
                    y: drag.building.y,
                    valid: true
                };

                drag.grabOffsetX = startElem.x - drag.building.x;
                drag.grabOffsetY = startElem.y - drag.building.y;
                drag.startBuildingX = drag.building.x;
                drag.startBuildingY = drag.building.y;
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

                const desiredX = p.x - drag.grabOffsetX;
                const desiredY = p.y - drag.grabOffsetY;

                const snappedX = app.snapToGrid(desiredX);
                const snappedY = app.snapToGrid(desiredY);

                const valid = app.canPlaceAt(drag.building, snappedX, snappedY);

                state.dragCopy = {
                    building: drag.building,
                    x: snappedX,
                    y: snappedY,
                    valid
                };

                if (valid) {
                    drag.building.x = snappedX;
                    drag.building.y = snappedY;
                    drag.building.data.x = snappedX / SIZE;
                    drag.building.data.y = snappedY / SIZE;
                }

                // Highlight the sidebar when the building is dragged over it.
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
                const sidebar = dom.buildingsListEl.closest('.sidebar');
                sidebar.classList.remove('drop-target');

                const sidebarRect = sidebar.getBoundingClientRect();
                const overSidebar =
                    e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right &&
                    e.clientY >= sidebarRect.top  && e.clientY <= sidebarRect.bottom;

                if (overSidebar) {
                    // Building was already removed from occupiedTiles on mousedown —
                    // just remove it from mapBuildings and send it to storedBuildings.
                    const idx = state.mapBuildings.indexOf(drag.building);
                    if (idx !== -1) state.mapBuildings.splice(idx, 1);

                    drag.building.x = 0;
                    drag.building.y = 0;
                    drag.building.data.x = 0;
                    drag.building.data.y = 0;
                    drag.building.isActive = false;
                    state.activeBuilding = null;
                    state.storedBuildings.push(drag.building);

                    app.showStoredBuildings();
                    app.updateStats();
                } else {
                    // Normal drop: place back on the map.
                    app.addBuildingToOccupiedTiles(drag.building);
                }

                state.dragCopy = null;
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

        if (state.activeBuilding) {
            state.activeBuilding.isActive = false;
            state.activeBuilding = null;
        }

        state.placingBuilding = app.createRotatedBuilding(
            { cityentity_id: meta.id, x: 0, y: 0, era: state.currentEra, custom: true },
            meta
        );
        state.placingBuilding.isActive = true;
        state.placingBuilding._fromMeta = true;  // flag: not from storedBuildings

        app.clearMetaSearch();
        updatePlacingBuildingPreview();
    }

    async function refreshPlanListUi() {
        if (!dom.planListItems) return;

        dom.planListItems.innerHTML = '<li class="empty">Loading…</li>';

        let plans = [];
        try {
            plans = await app.getPlanList();
        } catch (err) {
            console.error('Failed to load plan list:', err);
            dom.planListItems.innerHTML = '<li class="empty">Failed to load saved plans.</li>';
            return;
        }

        if (!plans || !plans.length) {
            dom.planListItems.innerHTML = '<li class="empty">No saved plans yet.</li>';
            return;
        }

        plans.sort((a, b) => (b.date || 0) - (a.date || 0));

        const html = plans.map(plan => {
            const dateStr = plan.date ? new Date(plan.date * 1000).toLocaleString() : '';
            const name = plan.name || 'Unnamed plan';
            const meta = [plan.world, plan.playerName, dateStr].filter(Boolean).join(' · ');

            return (
                '<li data-plan-id="' + plan.id + '">' +
                    '<span class="plan-info">' +
                        '<span class="plan-name">' + name + '</span>' +
                        '<span class="plan-meta">' + meta + '</span>' +
                    '</span>' +
                    '<button class="btn plan-delete" title="Delete plan">✕</button>' +
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

            if (e.target.classList && e.target.classList.contains('modal')) {
                e.target.classList.add('hidden');
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

    function bindEvents(init) {

        bindModalCloseHandlers();

        dom.informationBtn.addEventListener('click', () => {
            openModal(document.querySelector('#information'));
        });
        dom.zoomInBtn.addEventListener('click', app.zoomIn);
        dom.zoomOutBtn.addEventListener('click', app.zoomOut);
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

        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');
        if (undoBtn) undoBtn.addEventListener('click', () => app.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => app.redo());
        
        document.querySelector('.info .close').addEventListener('click', () => {
            document.querySelector('.info span').classList.toggle('hidden');
        });

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
                (e.key === 'Backspace' || e.key === 'Delete') &&
                state.selectedStoredMetaId &&
                !isTypingTarget(e.target)
            ) {
                e.preventDefault();
                const { metaId, custom } = parseGroupId(state.selectedStoredMetaId);
                deleteStoredBuildings(metaId, custom);
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
            state.activeBuilding = null;

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
            const reset = confirm('Do you want to restart from scratch? Your changes will not be saved');
            if (reset) {
                app.clearSavedLayout();
                resetCity();
            }
        });

        if (dom.saveBtn) {
            dom.saveBtn.addEventListener('click', async () => {
                if (dom.saveBtn.disabled) return;

                const originalText = dom.saveBtn.textContent;
                dom.saveBtn.disabled = true;
                dom.saveBtn.textContent = 'Saving…';

                const success = await app.savePlanToDatabase();

                dom.saveBtn.textContent = success ? 'Saved' : 'Failed to save';
                setTimeout(() => {
                    dom.saveBtn.textContent = originalText;
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
                const deleteBtn = e.target.closest('.plan-delete');
                if (deleteBtn) {
                    const li = deleteBtn.closest('li[data-plan-id]');
                    if (!li) return;
                    const planId = Number(li.dataset.planId);
                    if (!confirm('Delete this saved plan? This cannot be undone.')) return;
                    try {
                        await app.removePlanFromDatabase(planId);
                        await refreshPlanListUi();
                    } catch (err) {
                        console.error('Failed to delete plan:', err);
                        alert('Failed to delete plan.');
                    }
                    return;
                }

                const li = e.target.closest('li[data-plan-id]');
                if (!li) return;
                const planId = Number(li.dataset.planId);

                try {
                    await app.loadPlanFromDatabase(planId);
                    dom.planListModal.classList.add('hidden');
                    dom.submitWindow.classList.add('hidden');
                } catch (err) {
                    console.error('Failed to load plan:', err);
                    alert('Failed to load plan.');
                }
            });
        }

        if (dom.exportBtn) {
            dom.exportBtn.addEventListener('click', () => app.exportSaveToFile());
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
            // todo: remove 
            //e.preventDefault();

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
            
            if (state.activeBuilding) {
                state.activeBuilding.isActive = false;
                state.activeBuilding = null;
            }

            clearSelection();
            app.redrawMap();
        });

        window.addEventListener('resize', () => {
            app.resizeCanvasToCSSSize();
            app.rebuildGridLayer();
            app.redrawMap();
        });

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
})(window.PlannerApp);