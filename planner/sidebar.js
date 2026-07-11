'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const state = app.state;
    const dom = app.dom;

    function getStoredBuildingGroups(list) {
        const groups = new Map();

        for (const building of (list || state.storedBuildings)) {
            if (building.meta.type === 'street') continue;

            const isCustom = !!building.custom;
            const id = String(building.meta.id) + (isCustom ? ':custom' : '');
            const dims = app.getMetaSize(building.meta);
            const width = dims.width;
            const height = dims.height;

            if (!groups.has(id)) {
                groups.set(id, {
                    id,
                    metaId: String(building.meta.id),
                    name: building.meta.name,
                    custom: isCustom,
                    type: building.meta.type,
                    width,
                    height,
                    area: width * height,
                    noStreet: building.streetReq === 0,
                    amount: 1,
                    sample: building
                });
            } else {
                groups.get(id).amount += 1;
            }
        }

        return Array.from(groups.values());
    }

    function getDeletedBuildingGroups() {
        return getStoredBuildingGroups(state.deletedBuildings || []);
    }

    function filterStoredBuildingGroups(groups) {
        return groups.filter(item => {
            if (state.sidebarState.filterType !== 'all' && item.type !== state.sidebarState.filterType) {
                return false;
            }

            if (state.sidebarState.filterStreetReq === 'street' && item.noStreet) {
                return false;
            }

            if (state.sidebarState.filterStreetReq === 'nostreet' && !item.noStreet) {
                return false;
            }

            if (state.sidebarState.filterText) {
                const text = state.sidebarState.filterText.toLowerCase();
                const haystack = `${item.name} ${item.width}x${item.height} ${item.type}`.toLowerCase();
                if (!haystack.includes(text)) return false;
            }

            return true;
        });
    }

    function sortStoredBuildingGroups(groups) {
        const arr = [...groups];

        arr.sort((a, b) => {
            switch (state.sidebarState.sortBy) {
                case 'name-asc':
                    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

                case 'name-desc':
                    return b.name.localeCompare(a.name) || a.id.localeCompare(b.id);

                case 'width-asc':
                    return a.width - b.width || a.height - b.height || a.name.localeCompare(b.name);

                case 'width-desc':
                    return b.width - a.width || b.height - a.height || a.name.localeCompare(b.name);

                case 'height-asc':
                    return a.height - b.height || a.width - b.width || a.name.localeCompare(b.name);

                case 'height-desc':
                    return b.height - a.height || b.width - a.width || a.name.localeCompare(b.name);

                default:
                    return b.area - a.area || a.name.localeCompare(b.name);
            }
        });

        return arr;
    }

    function showStoredLi(item, activeId) {
        const noStreet = item.noStreet ? ' nostreet' : '';
        const isActive = (activeId && item.id === activeId ? ' active' : '');
        const name = (item.custom ? '* ' : '') + item.name;

        return (
            '<li data-id="' + item.id + '" class="' + item.type + noStreet + isActive + '">' +
                '<span class="amount">' + (item.amount > 1 ? item.amount : '') + '</span>' +
                '<span class="name">' + name + '</span>' +
                ' <span class="height">' + item.height + '</span>x<span class="width">' + item.width + '</span>' +
            '</li>'
        );
    }

    function showDeletedLi(item) {
        const name = (item.custom ? '* ' : '') + item.name;

        return (
            '<li data-id="' + item.id + '" class="deleted ' + item.type + '" title="Click to restore">' +
                '<span class="amount">' + (item.amount > 1 ? item.amount : '') + '</span>' +
                '<span class="name">' + name + '</span>' +
                ' <span class="height">' + item.height + '</span>x<span class="width">' + item.width + '</span>' +
                '<span class="restore-icon" title="Restore">↺</span>' +
            '</li>'
        );
    }

    function showStoredBuildings(buildingId = false) {
        const activeId = buildingId || state.selectedStoredMetaId || false;

        let groups = getStoredBuildingGroups();
        groups = filterStoredBuildingGroups(groups);
        groups = sortStoredBuildingGroups(groups);

        const html = groups.map(item => showStoredLi(item, activeId));

        const deletedGroups = sortStoredBuildingGroups(getDeletedBuildingGroups());
        let deletedHtml = '';
        if (deletedGroups.length) {
            deletedHtml = '<li class="section-header">Deleted</li>' +
                deletedGroups.map(showDeletedLi).join('');
        }

        dom.buildingsListEl.innerHTML = html.join('') + deletedHtml;
    }

    app.getStoredBuildingGroups = getStoredBuildingGroups;
    app.getDeletedBuildingGroups = getDeletedBuildingGroups;
    app.filterStoredBuildingGroups = filterStoredBuildingGroups;
    app.sortStoredBuildingGroups = sortStoredBuildingGroups;
    app.showStoredBuildings = showStoredBuildings;

    // --- Meta building search ---

    const EXCLUDED_TYPES = new Set(['off_grid', 'outpost_ship', 'friends_tavern', 'street']);

    function searchMeta(query) {
        if (!query || query.length < 2) return [];

        const q = query.toLowerCase();

        return Object.values(state.metaData)
            .filter(meta => {
                if (!meta.name) return false;
                if (EXCLUDED_TYPES.has(meta.type)) return false;
                if (String(meta.type).includes('hub')) return false;
                return meta.name.toLowerCase().includes(q);
            })
            .sort((a, b) => {
                // Exact / prefix matches first, then alphabetical.
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aStarts = aName.startsWith(q);
                const bStarts = bName.startsWith(q);
                if (aStarts !== bStarts) return aStarts ? -1 : 1;
                return aName.localeCompare(bName);
            })
            .slice(0, 30);
    }

    function renderMetaSearchResults(results) {
        if (!results.length) {
            dom.metaSearchResults.innerHTML = '';
            dom.metaSearchResults.classList.remove('open');
            return;
        }

        const html = results.map(meta => {
            const dims = app.getMetaSize(meta);
            const typeClass = meta.type || '';
            return (
                '<li data-meta-id="' + meta.id + '" class="' + typeClass + '">' +
                    '<span class="name">' + meta.name + '</span>' +
                    '<span class="dims">' + dims.height + 'x' + dims.width + '</span>' +
                '</li>'
            );
        });

        dom.metaSearchResults.innerHTML = html.join('');
        dom.metaSearchResults.classList.add('open');
    }

    function clearMetaSearch() {
        dom.metaSearchInput.value = '';
        dom.metaSearchResults.innerHTML = '';
        dom.metaSearchResults.classList.remove('open');
    }

    app.searchMeta = searchMeta;
    app.renderMetaSearchResults = renderMetaSearchResults;
    app.clearMetaSearch = clearMetaSearch;
})(window.PlannerApp);