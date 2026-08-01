'use strict';

window.PlannerApp = window.PlannerApp || {};

window.PlannerApp.dom = {
    submitWindow: document.querySelector('#submitWindow'),
    submitError: document.querySelector('#submitWindow .error'),

    storeBuildingsBtn: document.querySelector('#storeAll'),
    storeSelectionBtn: document.querySelector('#storeSelection'),
    storeSelectionCount: document.querySelector('#storeSelection .count'),
    searchMap: document.querySelector('#mapSearch'),

    buildingsListEl: document.querySelector('#storedBuildingsList'),

    zoomInBtn: document.querySelector('#zoomIn'),
    zoomOutBtn: document.querySelector('#zoomOut'),
    informationBtn: document.querySelector('#howto'),
    fontBtn: document.querySelector('#font'),
    languageSelect: document.querySelector('#languageSelect'),

    canvas: document.getElementById('planner'),

    removeStreetsBtn: document.getElementById('removeStreets'),
    resetBtn: document.getElementById('reset'),

    buildingSort: document.querySelector('#buildingSort'),
    buildingFilterText: document.querySelector('#buildingFilterText'),
    buildingTypeFilter: document.querySelector('#buildingTypeFilter'),
    buildingStreetFilter: document.querySelector('#buildingStreetFilter'),

    metaSearchInput: document.querySelector('#metaSearchInput'),
    metaSearchResults: document.querySelector('#metaSearchResults'),

    oldStreetsEl: document.querySelector('.old .streets'),
    currentStreetAmountEl: document.querySelector('#currentStreetAmount'),
    placeStreetBtn: document.querySelector('#placeStreet'),
    streetSizeGroup: document.querySelector('#streetSizeGroup'),
    populationEl: document.querySelector('#populationStat .pop-stat'),

    saveBtn: document.querySelector('#save'),
    exportBtn: document.querySelector('#export'),
    exportImageBtn: document.querySelector('#exportImage'),
    importBtn: document.querySelector('#import'),
    importFileInput: document.querySelector('#importFileInput'),
    overlayImportFileInput: document.querySelector('#overlayImportFileInput'),

    loadPlanBtn: document.querySelector('#loadPlan'),
    planListModal: document.querySelector('#planListModal'),
    planListClose: document.querySelector('#planListClose'),
    planListItems: document.querySelector('#planListItems'),

    newDataModal: document.querySelector('#newDataModal'),
    newDataModalText: document.querySelector('#newDataModalText'),
    newDataPlanNameInput: document.querySelector('#newDataPlanName'),
    newDataSaveBtn: document.querySelector('#newDataSaveBtn'),
    newDataDiscardBtn: document.querySelector('#newDataDiscardBtn'),
};

window.PlannerApp.state = {
    cityData: {},
    mapData: {},

    planId: null,
    planName: null,
    playerId: null,
    playerName: null,
    currentEra: null,

    occupiedTiles: new Map(),
    mapBuildings: [],
    storedBuildings: [],
    deletedBuildings: [],
    selectedBuildings: [],
    selectedStoredMetaId: null,

    placingBuilding: null,
    placementAnchor: null,
    dragCopy: null,
    dragCopies: null,
    rotated: false,
    fontSize: 15,
    font: '15px Arial',

    pendingIncomingData: null,

    zoomScale: 0.75,
    camX: 0,
    camY: 0,

    metaById: new Map(),

    gridCanvas: null,
    gridCtx: null,
    lastMouseElem: null,
    selectionRect: null,

    sidebarState: {
        sortBy: 'name-desc',
        filterText: '',
        filterType: 'all',
        filterStreetReq: 'all'
    },
    streetPlacement: {
        active: false,
        startTile: null,
        previewTiles: [],
        size: 1
    },

    history: [], // snapshots for undo, max 5
    future:  []  // snapshots for redo, cleared on new action
};