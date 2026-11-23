/*
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * Copyright (C) 2026 Forge Hammer
 * Licensed under AGPL - see LICENSE.md for details.
 */

/*
*  "statsGBGPlayers", Battle ground leader board
* {
*   date: Date,
*   players: {
*       id: number, // player id
*       n: number, // negotiations won
*       b: number, // battles won,
*       r: number, // rank
*   }[]
* }
* Structure of "statsGBGPlayerCache". Battle ground player cache
* {
*   id: number, // player id
*   name: string,
*   avatar: string,
*   date: Date
* }
* Structure of "statsRewards" db
* {
*   date: Date,
*   type: 'battlegrounds_conquest' | 'guildExpedition' | 'spoils_of_war' | 'diplomatic_gifts' | 'autoAid',
*   amount: number,
*   reward: string, // eg. resource#strategy_points#10
* }
* Structure "statsRewardTypes" db is same FOE "GenericReward" class
* {
*   "id": "premium_50",
*   "name": "50 Бриллиантов",
*   "description": "",
*   "iconAssetName": "diamond",
*   "isHighlighted": true,
*   "flags": ["rare"], // Note: flag is not rarity of guild expedition reward
*   "type": "resource",
*   "subType": "premium",
*   "amount": 50,
* }
* Structure of "statsUnitsD", "statsUnitsH"
* {
*   date: Date,
*   army: Object // key - id of unit, value - number of units
* }
* Structure of "statsTreasurePlayerH", "statsTreasurePlayerD" DBs
* {
*   date: Date,
*   resources: Object, // key is id of resource
* }
* Structure of "statsTreasureClanH", "statsTreasureClanD" DBs
* {
*   date: Date,
*   resources: Object,
*   clandId: number
* }
*/

/**
 * One-time, best-effort copy from the legacy "FoeHelperDB_*" databases into "ForgeHammerDB_*" ones
 * FoE Helper can upgrade the legacy dbs at any time, so they are read with native IndexedDB
 */
let LegacyDB = {
    OpenTimeout: 10 * 1000,
    ChunkSize: 2000,
    MaxAttempts: 3, // failed attempts before a copy is given up
    SpaceMargin: 50 * 1024 * 1024, // free space wanted on top of the estimated size

    running: {}, // legacy db name => copied rows
    noSpace: [], // labels of dbs not copied, not enough free space
    quotaHit: [], // labels of dbs partially copied, the disk ran out of space

    // names of our db for a legacy db, for imports of old backups
    newName: (name) => name
        .replace(/^FoeHelperDB_GuildFights_/, 'ForgeHammer_GBG_')
        .replace(/^FoeHelperDB_/, 'ForgeHammerDB_'),

    /**
     * Register the copy on a Dexie db before it is opened. Runs in db.on('ready') -> all other queries wait until it is finished
     */
    attach: (db, options = {}) => {
        const legacyName = options.legacyName || db.name.replace(/^ForgeHammerDB_/, 'FoeHelperDB_');
        const skip = [...(options.skip || []), ...(options.clearLegacy || [])];
        const flagKey = `LegacyCopyPending_${db.name}`; // value: number of failed attempts

        // don't reset the failed attempts on every load
        if (options.force && !FH.Storage.getItem(flagKey)) FH.Storage.setItem(flagKey, '0');

        // only fires when the db is created
        db.on('populate', () => FH.Storage.setItem(flagKey, '0'));

        const finish = () => {
            FH.Storage.removeItem(flagKey);
            if (options.onDone) options.onDone();
        };

        const failed = () => {
            const attempts = (parseInt(FH.Storage.getItem(flagKey)) || 0) + 1;
            if (attempts < LegacyDB.MaxAttempts) return FH.Storage.setItem(flagKey, String(attempts));

            console.warn(`Forge Hammer: copying "${legacyName}" given up after ${attempts} failed attempts`);
            finish();
        };

        db.on('ready', () => {
            if (!FH.Storage.getItem(flagKey)) return;

            return LegacyDB.copy(db, legacyName, skip, options.clearLegacy || [])
                .then(result => {
                    if (result === 'nospace') return; // not counted, the user can free up space
                    if (result === 'retry') return failed();
                    finish(); // done, or quota: partially copied, not retried
                })
                .catch(e => {
                    console.warn(`Forge Hammer: copying "${legacyName}" failed`, e);
                    failed();
                })
                .finally(() => LegacyDB.progress(legacyName, null));
        });
    },

    /**
     * @returns {Promise<'done'|'retry'|'nospace'|'quota'>}
     *  done: finished or nothing to copy; retry: old db couldn't be opened;
     *  nospace: not started, too little free space; quota: stopped, the disk ran out of space
     */
    copy: async (db, legacyName, skip, clearLegacy) => {
        const oldDB = await LegacyDB.openNative(legacyName);
        if (oldDB === null) return 'done';
        if (oldDB === undefined) return 'retry';

        try {
            // first, so the freed space counts for the space check
            for (const name of clearLegacy) {
                if (!oldDB.objectStoreNames.contains(name)) continue;
                await LegacyDB.clearStore(oldDB, name)
                    .catch(e => console.warn(`Forge Hammer: could not clear "${legacyName}.${name}"`, e));
            }

            if (!await LegacyDB.hasSpace()) {
                console.warn(`Forge Hammer: "${legacyName}" not copied, not enough free disk space`);
                LegacyDB.noSpace.push(LegacyDB.label(legacyName));
                return 'nospace';
            }

            LegacyDB.progress(legacyName, 0);

            for (const table of db.tables) {
                if (skip.includes(table.name) || !oldDB.objectStoreNames.contains(table.name)) continue;

                // skip broken tables, so it can't fail the whole copy
                await LegacyDB.copyTable(oldDB, table, legacyName).catch(e => {
                    if (LegacyDB.isQuota(e)) throw e;
                    console.warn(`Forge Hammer: "${legacyName}.${table.name}" skipped, copying failed`, e);
                });
            }
        } catch (e) {
            if (!LegacyDB.isQuota(e)) throw e;
            console.warn(`Forge Hammer: copying "${legacyName}" stopped, the disk ran out of space`, e);
            LegacyDB.quotaHit.push(LegacyDB.label(legacyName));
            return 'quota';
        } finally {
            oldDB.close();
        }

        return 'done';
    },

    copyTable: async (oldDB, table, legacyName) => {
        // all tables have inbound keys, so the old table must use the same key path
        const oldKeyPath = JSON.stringify(oldDB.transaction(table.name).objectStore(table.name).keyPath);
        const newKeyPath = JSON.stringify(table.schema.primKey.keyPath);
        if (oldKeyPath !== newKeyPath) {
            console.warn(`Forge Hammer: "${legacyName}.${table.name}" skipped, primary key differs (${oldKeyPath} vs ${newKeyPath})`);
            return;
        }

        let range = null;
        while (true) {
            const {keys, values} = await LegacyDB.readChunk(oldDB, table.name, range);
            if (!keys.length) return;

            try {
                await Dexie.vip(() => table.bulkPut(values));
            } catch (e) {
                // BulkError: only some rows failed, the rest is stored
                if (e?.name !== 'BulkError' || LegacyDB.isQuota(e)) throw e;
                console.warn(`Forge Hammer: ${e.failures?.length} row(s) of "${legacyName}.${table.name}" not copied`, e);
            }
            LegacyDB.progress(legacyName, keys.length);

            if (keys.length < LegacyDB.ChunkSize) return;
            range = IDBKeyRange.lowerBound(keys[keys.length - 1], true);
        }
    },

    // databases size can't be read, so the whole usage of the origin is the upper limit
    hasSpace: async () => {
        const {usage, quota} = await navigator.storage?.estimate?.().catch(() => null) || {};
        return !quota || quota - usage >= usage + LegacyDB.SpaceMargin;
    },

    /**
     * Opens a db at its current version
     * @returns {Promise<IDBDatabase|null|undefined>} null if it does not exist, undefined on error/timeout
     */
    openNative: (name) => new Promise(resolve => {
        let done = false;
        const finish = (val) => {
            if (done) return val?.close();
            done = true;
            resolve(val);
        };

        setTimeout(() => finish(undefined), LegacyDB.OpenTimeout);

        const request = indexedDB.open(name);
        let notExisting = false;
        request.onupgradeneeded = (e) => {
            // only happens if the db does not exist => don't create it
            notExisting = true;
            e.target.transaction.abort();
        };
        request.onsuccess = (e) => {
            const oldDB = e.target.result;
            oldDB.onversionchange = () => oldDB.close();
            finish(oldDB);
        };
        request.onerror = (e) => {
            e.preventDefault();
            finish(notExisting ? null : undefined);
        };
    }),

    clearStore: (oldDB, storeName) => new Promise((resolve, reject) => {
        const tx = oldDB.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
    }),

    // Dexie wraps the native error (AbortError, BulkError)
    isQuota: (e) => [e, e?.inner, ...(e?.failures || [])].some(x => x?.name === 'QuotaExceededError'),

    readChunk: (oldDB, storeName, range) => new Promise((resolve, reject) => {
        const tx = oldDB.transaction(storeName);
        const store = tx.objectStore(storeName);
        const result = {keys: [], values: []};

        store.getAllKeys(range, LegacyDB.ChunkSize).onsuccess = (e) => result.keys = e.target.result;
        store.getAll(range, LegacyDB.ChunkSize).onsuccess = (e) => result.values = e.target.result;

        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error);
    }),

    // FoeHelperDB_Events_123 => Events, FoeHelperDB_123 => Stats
    label: (legacyName) => legacyName.replace(/^FoeHelperDB_/, '').replace(/_?\d+$/, '') || 'Stats',

    /**
     * Update the overlay
     * @param {string} legacyName
     * @param {number|null} added rows copied since the last call, 0 when a copy starts, null when it has finished
     */
    progress: (legacyName, added) => {
        if (added === null) delete LegacyDB.running[legacyName];
        else LegacyDB.running[legacyName] = (LegacyDB.running[legacyName] || 0) + added;

        const running = Object.entries(LegacyDB.running);
        const hasNotices = LegacyDB.noSpace.length || LegacyDB.quotaHit.length;
        let overlay = document.getElementById('LegacyCopyOverlay');

        if (!running.length && !hasNotices) return overlay?.remove();
        if (!overlay && (added === 0 || !running.length)) overlay = LegacyDB.createOverlay();
        if (!overlay) return; // closed by the user

        if (running.length) {
            overlay.querySelector('.tables').replaceChildren(...running.map(([name, count]) => {
                const li = document.createElement('li');
                li.textContent = `${LegacyDB.label(name)}: ${FH.helper.str.Replacer(FH.t('DBCreationWarning.LegacyCopyEntries'), {count: count.toLocaleString()})}`;
                return li;
            }));
            return;
        }

        const messages = [];
        if (LegacyDB.noSpace.length) messages.push(FH.helper.str.Replacer(FH.t('DBCreationWarning.LegacyCopyNoSpace'), {dbs: LegacyDB.noSpace.join(', ')}));
        if (LegacyDB.quotaHit.length) messages.push(FH.helper.str.Replacer(FH.t('DBCreationWarning.LegacyCopyQuota'), {dbs: LegacyDB.quotaHit.join(', ')}));
        LegacyDB.noSpace = [];
        LegacyDB.quotaHit = [];

        overlay.querySelector('h2').textContent = 'Forge Hammer: ' + FH.t('DBCreationWarning.LegacyCopyIncompleteTitle');
        overlay.querySelector('.explanation').textContent = messages.join(' ');
        overlay.querySelector('.tables').replaceChildren();
        overlay.querySelector('.loader')?.remove();
    },

    createOverlay: () => {
        const overlay = document.createElement('div');
        overlay.id = 'LegacyCopyOverlay';
        overlay.style.cssText = 'position:fixed;bottom:0;right:0;min-width:300px;max-width:450px;width:50%;padding:0 1rem 1rem 0;background-color:#000000cc;color:#eee;z-index:9999999999;display:flex;align-items:center;justify-content:center;font-size:0.95rem;text-align:center;flex-direction:column;box-shadow:0 0 50px 50px #000c';
        overlay.innerHTML = `
            <div style="width:100%;text-align:right;padding-bottom:0.5rem;"><span class="close" style="cursor:pointer"></span></div>
            <h2></h2>
            <p class="explanation"></p>
            <ul class="tables" style="list-style:none;padding:0;margin:0.5rem 0;"></ul>
            <div class="loader" style="position:relative;height:75px;width:100%;"><div class="loading-data" style="height:0;background:unset;top:30px;"><span class="loadericon" style="zoom:0.5"></span></div></div>`;

        const close = overlay.querySelector('.close');
        close.textContent = FH.t('DBCreationWarning.CloseOverlay') + ' ⨯';
        close.addEventListener('click', () => overlay.remove());
        overlay.querySelector('h2').textContent = 'Forge Hammer: ' + FH.t('DBCreationWarning.LegacyCopyTitle');
        overlay.querySelector('.explanation').textContent = FH.t('DBCreationWarning.LegacyCopyExplanation');

        (document.body || document.documentElement).appendChild(overlay);
        return overlay;
    },
};

let IndexDB = {
    db: null,

    _dbPromise: new Promise(resolveCb => window._dbPromiseResolver = resolveCb),


    /**
     * Resolve db when ready for using.
     * SHOULD be always used in FH.proxy.addHandler.
     * In Boxes you can use IndexDB.db
     * @returns {Promise<void>}
     */
    getDB: () => {
        return IndexDB._dbPromise;
    },


    Init: async (playerId, attempt = 0) => {
        const primaryDBName = 'ForgeHammerDB_' + playerId; //Create different IndexDBs if two players are sharing the same PC playing on the same world

        // ask not to evict our data on low disk space (Chrome decides without a prompt)
        if (attempt === 0 && navigator.storage?.persist) {
            navigator.storage.persisted()
                .then(persisted => persisted || navigator.storage.persist())
                .catch(() => {});
        }

        const db = IndexDB.db = new Dexie(primaryDBName);
        IndexDB._applyIndexSchema(db);
        // skip: cleared by the GarbageCollector anyway
        // buildingMeta: built anew, emptied in the legacy db to free space (FoE Helper rebuilds it when needed)
        LegacyDB.attach(db, {
            skip: ['players', 'pvpActions', 'greatbuildings'],
            clearLegacy: ['buildingMeta']
        });

        try {
            await db.open();
        } catch (e) {
            console.error('Forge Hammer: opening ' + primaryDBName + ' failed', e);
            if (attempt < 5) {
                setTimeout(() => IndexDB.Init(playerId, attempt + 1), 1000);
            }
            return;
        }

        window._dbPromiseResolver(db);

        setTimeout(() => {
            IndexDB.GarbageCollector();
            IndexDB.rewardDBCleanup()
        }, 10 * 1000);
    },

    // DB index schema
    _applyIndexSchema(db) {
        db.version(1).stores({
            players: 'id,date',
            pvpActions: '++id,playerId,date,type',
            greatbuildings: '++id,playerId,name,&[playerId+name],level,currentFp,bestRateNettoFp,bestRateCosts,date',
            forgeStats: '++id,type,amount,date', // FP Collector
            statsGBGPlayers: 'date', // battleground
            statsGBGPlayerCache: 'id, date', // Cache of players for using in gbgPlayers
            statsRewards: 'date', // Collected rewards by Himeji, etc
            statsRewardTypes: 'id', // Human readable cache info about rewards
            statsUnitsD: 'date',
            statsUnitsH: 'date',
            statsTreasurePlayerH: 'date',
            statsTreasurePlayerD: 'date',
            statsTreasureClanH: 'date, clanId',
            statsTreasureClanD: 'date, clanId',
        });

        db.version(2).stores({
            players: 'id,date',
            pvpActions: '++id,playerId,date,type',
            greatbuildings: '++id,playerId,name,&[playerId+name],level,currentFp,bestRateNettoFp,bestRateCosts,date',
            investhistory: '++id,playerId,entity_id,&[playerId+entity_id],name,level,max_progress,current_progress,profit,currentFp,fphistory,date',
            forgeStats: '++id,type,amount,date', // FP Collector
            statsGBGPlayers: 'date', // battleground
            statsGBGPlayerCache: 'id, date', // Cache of players for using in gbgPlayers
            statsRewards: 'date', // Collected rewards by Himeji, etc
            statsRewardTypes: 'id', // Human readable cache info about rewards
            statsUnitsD: 'date',
            statsUnitsH: 'date',
            statsTreasurePlayerH: 'date',
            statsTreasurePlayerD: 'date',
            statsTreasureClanH: 'date, clanId',
            statsTreasureClanD: 'date, clanId',
        });
        db.version(3).stores({
            buildingMeta: 'id, hash, json',
        });
    },

    /**
     * Util function for making backup of db easier
     * @example
     *   // copy with name + _copy
     *   IndexDB.cloneDB('PlayerDB');
     *   // equals to
     *   IndexDB.cloneDB('PlayerDB', 'PlayerDB_copy');
     *   // copy and set version to 1
     *   IndexDB.cloneDB('PlayerDB', 'PlayerDB_copy', 1);
     */
    cloneDB: async (srcName, dstName, version) => {
        dstName = dstName || srcName + '_copy';
        const sdb = new Dexie(srcName),
              ddb = new Dexie(dstName);

        if (await Dexie.exists(dstName)) {
            console.error(`Aborted. Please firstly delete "${dstName}" before continue.`);
            return false;
        }

        return sdb.open().then(() => {
            // Clone scheme
            version = version || sdb.verno;
            // console.log(`Cloning DB "${srcName}" v${sdb.verno} => "${dstName}" v${version}`);

            // console.log('Dumping schema...');
            const schema = sdb.tables.reduce((result, table) => {
                // console.log(` => ${table.name}...`);
                result[table.name] = (
                    [table.schema.primKey]
                        .concat(table.schema.indexes)
                        .map(indexSpec => indexSpec.src)
                ).toString();
                return result;
            }, {});
            // console.log('Schema:', schema);
            ddb.version(version).stores(schema);

            return sdb.tables.reduce(
                (result, table) => result
                    // .then(() => console.log(`Cloning table ${table.name}...`))
                    .then(() => table.toArray())
                    .then(rows => ddb.table(table.name).bulkAdd(rows) ),
                Promise.resolve()
            ).then((x) => {
                sdb.close();
                ddb.close();
               // console.log(`Clonning DB is finished, created "${dstName}"`);
            })
        });
    },


    /**
    * Remove old records from db to avoid overflow
    *
    * @returns {Promise<void>}
    */
    GarbageCollector: async () => {
        // Expiry time for db with 1 record per day
        const daylyExpiryTime = moment().subtract(1, 'years').toDate();

        // Expiry time for db with 1 record per hour
        const hourlyExpiryTime = moment().subtract(8, 'days').toDate();

        // Keep logs for guild battlegrounds for 2 weeks
        const gbgExpiryTime = moment().subtract(2, 'weeks').toDate();

        await IndexDB.getDB();
        await IndexDB.db.pvpActions.clear();
        await IndexDB.db.players.clear();
        await IndexDB.db.greatbuildings.clear();

        for (const table of ['statsRewards', 'statsUnitsD', 'statsTreasurePlayerD', 'statsTreasureClanD']) {
            await IndexDB.db[table].where('date').below(daylyExpiryTime).delete();
        }

        for (const table of ['statsUnitsH', 'statsTreasurePlayerH', 'statsTreasureClanH']) {
            await IndexDB.db[table].where('date').below(hourlyExpiryTime).delete();
        }

        for (const table of ['statsGBGPlayers', 'statsGBGPlayerCache']) {
            await IndexDB.db[table].where('date').below(gbgExpiryTime).delete();
        }
    },

    rewardDBCleanup: async () => {
        //reward type for shard, Ad chests and shards was changed around april 11 and code was amended for that on May 19 - this will switch all old entries for incidents to the new type
        if (!FH.Storage.getItem("HiddenRewardOverwrite")) {
            let x = await IndexDB.db.statsRewards.toArray();
            let y= [];
            x.forEach(a=>{
                if (a.type=="hidden_reward") {
                    a.type="shards"
                    y.push(a)
                }
                if (a.type=="default" || a.type=="living_city") {
                    a.type="hidden_reward"
                    y.push(a)
                }
                });
            IndexDB.db.statsRewards.bulkPut(y);
            FH.Storage.setItem("HiddenRewardOverwrite","done");
        }
    },


    /**
     * Calculate estimated space used in db
     * In fact db is more compact than returned value because this is not json
     */
    calculateSpace: async () => {
        let totalSize = 0;
        const db = IndexDB.db;
        for (let table of db.tables.map(it => it.name)) {
            const data = await db[table].limit(20).toArray();
            const count = await db[table].count();
            const sizePerItemBytes = (new Blob([JSON.stringify(data)]).size) / data.length;
            totalSize += count * sizePerItemBytes;
        }
        return parseInt(totalSize);
    },


    /**
     * Add user from FH.Players.Dict if not added, without era information
     *
     * @param playerId
     * @param updateDate
     * @returns {Promise<void>}
     */
    addUserFromPlayerDictIfNotExists: async(playerId, updateDate) => {
        const playerFromDB = await IndexDB.db.players.get(playerId);
        if (!playerFromDB) {
            let player = FH.Players.Dict[playerId];
            if (player) {
                await IndexDB.db.players.add({
                    id: playerId,
                    name: player.PlayerName,
                    clanId: player.ClanId || 0,
                    clanName: player.ClanName,
                    avatar: player.Avatar,
                    era: 'unknown', // Era can be discovered when user is visited, not now
                    date: FH.Main.getCurrentDate(),
                });
            }
        }
        else if (updateDate) {
            IndexDB.db.players.update(playerId, {
                date: FH.Main.getCurrentDate()
            });
        }
    }
};
