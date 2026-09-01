'use strict';

window.PlannerApp = window.PlannerApp || {};

/*
 * Before / After city comparison
 * Everything is computed on demand when the modal is opened, never on the fly
 */
(function (app) {
    const state = app.state;
    const dom = app.dom;

    const SIZE = 30;
    const DAY_SECONDS = 86400;

    const EXCLUDED_TYPES = new Set(['off_grid', 'outpost_ship', 'friends_tavern']);
    const PRODUCTION_OPTION_STRATEGY = 'longest';

    // --- icon placeholder ---------------------------------------------------
    function icon(iconId) {
        if (!iconId) return '';
        return '<span class="stat-icon" data-icon="' + iconId + '"></span>';
    }

    // --- metric definitions -------------------------------------------------
    const BOOST_TYPES = [
        ['att_boost_attacker', 'General.AttAttacker', 'Red Attack'],
        ['def_boost_attacker', 'General.DefAttacker', 'Red Defense'],
        ['att_boost_defender', 'General.AttDefender', 'Blue Attack'],
        ['def_boost_defender', 'General.DefDefender', 'Blue Defense']
    ];

    // [short key, targetedFeature value, icon suffix, i18n key, fallback]
    const BOOST_FEATURES = [
        ['city', 'all', '', 'XPlan.Compare.FeatureCity', 'Base'],
        ['gbg', 'battleground', '_gbg', 'Boxes.General.Guild_Battlegrounds.short', 'GBG'],
        ['ge', 'guild_expedition', '_gex', 'Boxes.General.Guild_Expedition.short', 'GE'],
        ['gr', 'guild_raids', '_gr', 'Boxes.General.Quantum_Incursion.short', 'QI']
    ];

    const FEATURE_BY_TARGET = {};
    for (const [short, target] of BOOST_FEATURES) FEATURE_BY_TARGET[target] = short;

    function buildBoostMetrics() {
        const list = [];
        for (const [type, typeKey, typeFallback] of BOOST_TYPES) {
            for (const [short, target, iconSuffix, featKey, featFallback] of BOOST_FEATURES) {
                list.push({
                    key: 'boost_' + type + '_' + short,
                    group: 'battle',
                    icon: type + iconSuffix,
                    t: typeKey,
                    fallback: typeFallback,
                    suffixT: featKey,
                    suffixFallback: featFallback,
                    percent: true
                });
            }
        }
        return list;
    }

    const METRICS = [
        { key: 'population_provided', group: 'population', icon: 'population', t: 'General.PopulationProvided', fallback: 'Total population' },
        { key: 'population_required', group: 'population', icon: 'population', t: 'General.PopulationRequired', fallback: 'Required population' },
        { key: 'population_net', group: 'population', icon: 'population', t: 'General.PopulationNet', fallback: 'Available population' },
        { key: 'happiness', group: 'population', icon: 'happiness', t: 'Productions.Happiness', fallback: 'Happiness' },

        { key: 'coins', group: 'production', icon: 'money', t: 'General.Coins', fallback: 'Coins' },
        { key: 'supplies', group: 'production', icon: 'supplies', t: 'General.Supplies', fallback: 'Supplies' },
        { key: 'forge_points', group: 'production', icon: 'strategy_points', t: 'General.ForgePoints', fallback: 'Forge Points' },
        { key: 'goods_previous', group: 'production', icon: 'random_goods_of_previous_age', t: 'Boxes.Productions.goods_previous', fallback: 'Goods (previous era)' },
        { key: 'goods_current', group: 'production', icon: 'all_goods_of_age', t: 'Boxes.Productions.goods_current', fallback: 'Goods (current era)' },
        { key: 'goods_next', group: 'production', icon: 'next_age_random_goods', t: 'Boxes.Productions.goods_next', fallback: 'Goods (next era)' },
        { key: 'guild_goods', group: 'production', icon: 'treasury_goods', t: 'Boxes.Productions.GuildGoods', fallback: 'Guild goods' },
        { key: 'medals', group: 'production', icon: 'medals', t: 'General.Medals', fallback: 'Medals' },
        { key: 'units_current', group: 'production', icon: 'military', t: 'General.UnitsCurrent', fallback: 'Units (current)' },
        { key: 'units_next', group: 'production', icon: 'military', t: 'General.UnitsNext', fallback: 'Next Age Units' }
    ]
        .concat(buildBoostMetrics())
        .concat([
            { key: 'tiles_total', group: 'space', icon: 'size', t: 'Boxes.CityMap.WholeArea', fallback: 'Unlocked tiles' },
            { key: 'tiles_streets', group: 'space', icon: 'street_required', t: 'XPlan.Street.All', fallback: 'Tiles used by streets' },
            { key: 'tiles_free', group: 'space', icon: 'size', t: 'Boxes.CityMap.FreeArea', fallback: 'Free tiles' },
            { key: 'building_count', group: 'space', icon: 'size', t: 'Boxes.CityMap.Building', fallback: 'Buildings' }
        ]);

    const METRIC_BY_KEY = new Map(METRICS.map(m => [m.key, m]));

    const GROUPS = [
        ['population', 'Boxes.Tooltip.Building.provides', 'Provides'],
        ['production', 'Boxes.Tooltip.Building.produces', 'Produces (per 24h)'],
        ['battle', 'Boxes.PlayerProfile.BattleBoosts', 'Battle boosts'],
        ['boosts', 'XPlan.Compare.GroupBoosts', 'Other boosts'],
        ['items', 'XPlan.Compare.GroupItems', 'Items & fragments (per 24h)'],
        ['space', 'General.Space', 'Space']
    ];

    const DEFAULT_AXES = [
        'forge_points',
        'goods_previous',
        'goods_current',
        'boost_att_boost_attacker_city',
        'boost_def_boost_attacker_city',
        'boost_att_boost_defender_city',
        'boost_def_boost_defender_city'
    ];

    let selectedAxes = DEFAULT_AXES.slice();
    let chartInstance = null;
    let lastResult = null;

    function metricLabel(metric) {
        const base = app.t(metric.t, metric.fallback);
        if (!metric.suffixT) return base;
        return base + ' - ' + app.t(metric.suffixT, metric.suffixFallback);
    }

    // --- resource mapping ---------------------------------------------------
    function resMapper(res, group) {
        const m = {
            goods: {
                era_goods: 'all_goods_of_age',
                random_good_of_next_age: 'next_age_random_goods',
                random_good_of_previous_age: 'random_goods_of_previous_age',
                random_good_of_age: 'random_goods_chest',
                random_good_of_age_1: 'random_goods_chest',
                random_good_of_age_2: 'random_goods_chest',
                random_good_of_age_3: 'random_goods_chest',
                each_special_goods_up_to_age: 'special_goods'
            },
            treasury_goods: {
                era_goods: 'treasury_goods',
                all_goods_of_age: 'treasury_goods',
                all_goods_of_next_age: 'treasury_goods_of_next_age',
                all_goods_of_previous_age: 'treasury_goods_of_previous_age',
                random_good_of_age: 'treasury_goods'
            }
        };
        return (m[group] && m[group][res]) || res;
    }

    const GOODS_PREVIOUS = new Set(['random_goods_of_previous_age', 'all_goods_of_previous_age']);
    const GOODS_NEXT = new Set(['next_age_random_goods', 'all_goods_of_next_age']);
    const GOODS_CURRENT = new Set(['all_goods_of_age', 'random_goods_chest', 'era_goods', 'special_goods']);

    const IGNORED_RESOURCES = new Set([
        'blueprints', 'icons', 'tavern_silver', 'guild_raids_action_points',
        'clan_power', 'rank', 'ranking_points', 'total_ranking_points', 'negotiation_game_currency'
    ]);
    const IGNORED_BOOSTS = new Set([
        'helping_hands', 'quest_boost', 'critical_hit_chance', 'first_strike', 'life_support'
    ]);

    function mapResourceToMetric(res) {
        if (!res) return null;
        if (res === 'money' || res === 'coins') return 'coins';
        if (res === 'supplies') return 'supplies';
        if (res === 'strategy_points') return 'forge_points';
        if (res === 'medals') return 'medals';
        if (res === 'population') return 'population';
        if (res === 'happiness') return 'happiness';
        if (GOODS_PREVIOUS.has(res)) return 'goods_previous';
        if (GOODS_NEXT.has(res)) return 'goods_next';
        if (GOODS_CURRENT.has(res)) return 'goods_current';
        if (IGNORED_RESOURCES.has(res)) return null;
        if (String(res).indexOf('treasury') === 0) return 'guild_goods';
        return 'goods_current';
    }

    // Asset names that really are resources. Used for generic rewards
    const KNOWN_RESOURCE_ASSETS = new Set([
        'money', 'coins', 'supplies', 'strategy_points', 'medals', 'population',
        'happiness', 'premium', 'blueprints', 'blueprint', 'tavern_silver', 'icons',
        'clan_power', 'rank', 'ranking_points', 'total_ranking_points',
        'negotiation_game_currency', 'guild_raids_action_points', 'goods',
        ...GOODS_PREVIOUS, ...GOODS_NEXT, ...GOODS_CURRENT
    ]);

    function strictResourceMetric(res) {
        if (!res) return null;
        if (String(res).indexOf('treasury') === 0) return 'guild_goods';
        if (res === 'goods') return 'goods_current';
        if (!KNOWN_RESOURCE_ASSETS.has(res)) return null;
        return mapResourceToMetric(res);
    }

    // Ported from Boosts.Mapper in boosts.js
    const BOOST_MAPPER = {
        supplies_boost: ['supply_production'],
        happiness: ['happiness_amount'],
        military_boost: ['att_boost_attacker', 'def_boost_attacker'],
        att_def_boost_attacker: ['att_boost_attacker', 'def_boost_attacker'],
        fierce_resistance: ['att_boost_defender', 'def_boost_defender'],
        att_def_boost_defender: ['att_boost_defender', 'def_boost_defender'],
        att_def_boost_attacker_defender: [
            'att_boost_attacker', 'def_boost_attacker',
            'att_boost_defender', 'def_boost_defender'
        ],
        advanced_tactics: [
            'att_boost_attacker', 'def_boost_attacker',
            'att_boost_defender', 'def_boost_defender'
        ],
        money_boost: ['coin_production']
    };

    function isIgnoredBoost(type) {
        return IGNORED_BOOSTS.has(type);
    }

    // Ported from Boosts.percent — these are absolute values, not percentages.
    const BOOST_NOT_PERCENT = new Set([
        'diplomacy',
        'guild_raids_action_points_collection',
        'guild_raids_goods_start',
        'guild_raids_units_start',
        'guild_raids_supplies_start',
        'guild_raids_coins_start',
        'guild_raids_action_points_capacity'
    ]);

    function boostFeatureShort(type, feature) {
        if (!/attacker|defender/.test(String(type))) return null;
        return FEATURE_BY_TARGET[feature || 'all'] || 'city';
    }

    const dynamicMetrics = new Map();

    function humanizeBoostType(type) {
        return String(type)
            .replace(/_/g, ' ')
            .replace(/\b[a-z]/g, c => c.toUpperCase());
    }

    function registerDynamicBoost(key, type, featureShort) {
        if (dynamicMetrics.has(key) || METRIC_BY_KEY.has(key)) return;

        const feature = featureShort ? BOOST_FEATURES.find(f => f[0] === featureShort) : null;

        dynamicMetrics.set(key, {
            key: key,
            group: 'boosts',
            icon: type + (feature ? feature[2] : ''),
            t: 'XPlan.Compare.Boost.' + type,
            fallback: humanizeBoostType(type),
            suffixT: feature ? feature[3] : null,
            suffixFallback: feature ? feature[4] : null,
            percent: !BOOST_NOT_PERCENT.has(type)
        });
    }

    function boostTargets(type, feature) {
        if (!type || isIgnoredBoost(type)) return [];

        const mapped = BOOST_MAPPER[type] || [type];
        const targets = [];

        for (const mappedType of mapped) {
            if (isIgnoredBoost(mappedType)) continue;

            if (mappedType === 'happiness_amount') {
                targets.push({ flat: 'happiness' });
                continue;
            }

            const featureShort = boostFeatureShort(mappedType, feature);
            const key = featureShort
                ? 'boost_' + mappedType + '_' + featureShort
                : 'boost_' + mappedType;

            registerDynamicBoost(key, mappedType, featureShort);
            targets.push({ key: key });
        }

        return targets;
    }

    // --- accumulator --------------------------------------------------------
    function makeAcc() {
        const acc = Object.create(null);
        for (const m of METRICS) acc[m.key] = 0;
        return acc;
    }

    function add(acc, key, value) {
        if (!key) return;
        const n = Number(value);
        if (!Number.isFinite(n) || n === 0) return;
        acc[key] = (acc[key] || 0) + n;
    }

    // Population arrives as a signed number; split into provided / required.
    function addPopulation(acc, value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n === 0) return;
        if (n > 0) add(acc, 'population_provided', n);
        else add(acc, 'population_required', -n);
    }

    function addBoost(acc, type, feature, value) {
        for (const target of boostTargets(type, feature)) {
            if (target.flat) add(acc, target.flat, value);
            else add(acc, target.key, value);
        }
    }

    function addResource(acc, res, amount, group) {
        const mapped = resMapper(res, group || 'goods');
        const key = mapResourceToMetric(mapped);
        if (key === 'population') return addPopulation(acc, amount);
        add(acc, key, amount);
    }

    // --- era / flags --------------------------------------------------------
    function resolveEra(meta, data) {
        const wanted = (data && data.era) || state.currentEra || null;

        if (meta.components) {
            if (wanted && meta.components[wanted]) return wanted;
            const eraKeys = Object.keys(meta.components).filter(k => k !== 'AllAge');
            if (!eraKeys.length) return 'AllAge';
            if (!wanted) return eraKeys[eraKeys.length - 1];
            // Closest era at or below the requested one.
            const wantedId = app.InnoEras[wanted];
            let best = null;
            let bestId = -1;
            for (const k of eraKeys) {
                const id = app.InnoEras[k];
                if (id === undefined) continue;
                if (id <= wantedId && id > bestId) { best = k; bestId = id; }
            }
            return best || eraKeys[0];
        }

        if (Array.isArray(meta.entity_levels) && meta.entity_levels.length) {
            if (wanted && meta.entity_levels.some(l => l && l.era === wanted)) return wanted;
        }

        return wanted;
    }

    function getFlags(meta) {
        const flags = { motivate: false, polish: false, coinsFromSupplies: false };

        const interaction = meta.components?.AllAge?.socialInteraction?.interactionType;
        if (interaction === 'motivate') flags.motivate = true;
        if (interaction === 'polish') flags.polish = true;

        for (const a of meta.abilities || []) {
            if (!a) continue;
            if (a.__class__ === 'MotivatableAbility') flags.motivate = true;
            if (a.__class__ === 'PolishableAbility') flags.polish = true;
            if (a.__class__ === 'AddCoinsToSupplyProductionWhenMotivatedAbility') flags.coinsFromSupplies = true;
        }

        return flags;
    }

    // --- generic rewards, items and fragments --------------------------------

    function itemMetricKey(id, isFragment) {
        return 'item_' + (isFragment ? 'frag_' : '') +
            String(id).replace(/[^a-zA-Z0-9_]+/g, '_');
    }

    function registerDynamicItem(key, name, iconAsset, requiredAmount) {
        if (dynamicMetrics.has(key) || METRIC_BY_KEY.has(key)) return;

        dynamicMetrics.set(key, {
            key: key,
            group: 'items',
            icon: iconAsset || 'icon_fragment',
            // Whole items need exactly one piece; fragments need requiredAmount.
            requiredAmount: requiredAmount || 1,
            t: 'XPlan.Compare.Item.' + key,
            fallback: name || key,
            suffixT: requiredAmount ? 'General.Fragments' : null,
            suffixFallback: requiredAmount
                ? app.t('General.Fragments', 'Fragments') + ' (' + requiredAmount + ')'
                : null,
            percent: false
        });
    }

    function genericRewardAmount(rew) {
        const match = String(rew.name || '').match(/^([+\-]?\d*)x? (.*)$/);
        const parsed = match ? Number(match[1]) : NaN;
        if (Number.isFinite(parsed) && parsed !== 0) return parsed;
        return rew.totalAmount ?? rew.amount ?? 1;
    }

    // Unit rewards encode their era in the reward id, e.g.
    // "era_unit#light_melee#NextEra#60"
    function unitMetricKey(rew) {
        return /nextera/i.test(String(rew?.id || '')) ? 'units_next' : 'units_current';
    }

    function addGenericReward(acc, rew, factor) {
        if (!rew) return;

        const amount = genericRewardAmount(rew) * factor;
        if (!amount) return;

        if (rew.type === 'unit') {
            add(acc, unitMetricKey(rew), amount);
            return;
        }

        // Fragments are counted as fragments, filed under the item they build.
        if (rew.subType === 'fragment' || rew.iconAssetName === 'icon_fragment') {
            const assembled = rew.assembledReward || null;
            const key = itemMetricKey(assembled?.id || rew.id, true);

            registerDynamicItem(
                key,
                assembled?.name || rew.name,
                assembled?.iconAssetName || assembled?.subType || 'icon_fragment',
                rew.requiredAmount || null
            );

            add(acc, key, amount);
            return;
        }

        const asset = (rew.type === 'resource' || rew.type === 'good')
            ? (rew.subType || rew.iconAssetName)
            : rew.iconAssetName;

        const resourceKey = strictResourceMetric(resMapper(asset, 'goods'));
        if (resourceKey === 'population') return addPopulation(acc, amount);
        if (resourceKey) return add(acc, resourceKey, amount);

        // Everything else is a whole item: kits, chests, buildings, avatars, …
        const key = itemMetricKey(rew.id || rew.subType || asset || 'unknown', false);
        registerDynamicItem(key, rew.name, rew.iconAssetName || rew.subType, null);
        add(acc, key, amount);
    }

    // Rewards can be wrapped in containers that have to be opened before the
    // contents can be counted:
    //   chest (GenericChest)      -> possible_rewards[], each behind a drop chance
    //   set   (GenericRewardSet)  -> rewards[], all granted together, and these
    //                                nest (a 15-kit set holds a 10-kit set plus
    //                                five singles)
    const REWARD_DEPTH_LIMIT = 8;

    function addRewardTree(acc, reward, factor, depth) {
        if (!reward) return;

        const level = depth || 0;
        if (level > REWARD_DEPTH_LIMIT) {
            console.warn('Reward nesting too deep, skipping:', reward.id);
            return;
        }

        if (reward.type === 'chest' && Array.isArray(reward.possible_rewards)) {
            for (const sub of reward.possible_rewards) {
                const chance = Number(sub?.drop_chance);
                addRewardTree(acc, sub?.reward, factor * (Number.isFinite(chance) ? chance / 100 : 1), level + 1);
            }
            return;
        }

        // A set grants everything inside it, so no chance weighting here.
        if (Array.isArray(reward.rewards) && reward.rewards.length) {
            for (const sub of reward.rewards) {
                addRewardTree(acc, sub, factor, level + 1);
            }
            return;
        }

        addGenericReward(acc, reward, factor);
    }

    // --- production options -------------------------------------------------

    function pickOption(options, timeField) {
        if (!options || !options.length) return null;
        if (options.length === 1) return options[0];

        if (PRODUCTION_OPTION_STRATEGY === 'longest') {
            let best = options[0];
            for (const o of options) {
                if ((o[timeField] || 0) > (best[timeField] || 0)) best = o;
            }
            return best;
        }

        return options[0];
    }

    function dayFactor(seconds) {
        const t = Number(seconds);
        if (!Number.isFinite(t) || t <= 0) return 1;
        return DAY_SECONDS / t;
    }

    // --- product walker (components shape) ---------------------------------

    function walkProduct(acc, product, factor, lookup, flags) {
        if (!product) return;

        const motivateMultiplier = (res) =>
            (flags.motivate && !product.onlyWhenMotivated &&
             (res === 'supplies' || res === 'coins' || res === 'money')) ? 2 : 1;

        if (product.type === 'resources') {
            const resources = product.playerResources?.resources || {};
            for (const [res, amount] of Object.entries(resources)) {
                if (!amount) continue;
                const value = amount * factor * motivateMultiplier(res);
                addResource(acc, res, value, 'goods');
                if (flags.coinsFromSupplies && res === 'supplies') {
                    add(acc, 'coins', amount * factor);
                }
            }
        }

        if (product.type === 'guildResources') {
            const resources = product.guildResources?.resources || {};
            for (const [res, amount] of Object.entries(resources)) {
                if (!amount) continue;
                addResource(acc, res, amount * factor, 'treasury_goods');
            }
        }

        if (product.type === 'unit' && product.amount) {
            add(acc, 'units_current', product.amount * factor);
        }

        if (product.type === 'genericReward') {
            addRewardTree(acc, lookup[product.reward?.id], factor);
        }

        if (product.type === 'random') {
            for (const random of product.products || []) {
                const chance = Number(random.dropChance);
                const weight = Number.isFinite(chance) ? chance : 0;
                walkProduct(acc, random.product, factor * weight, lookup, flags);
            }
        }
    }

    // --- components shape ---------------------------------------------------

    function collectComponents(acc, meta, era, flags, entity) {
        const levels = meta.components;
        const eraLevel = (era && levels[era]) ? levels[era] : null;

        // static resources
        const staticSources = [
            levels.AllAge?.staticResources?.resources?.resources,
            eraLevel?.staticResources?.resources?.resources
        ];
        for (const resources of staticSources) {
            for (const [res, amount] of Object.entries(resources || {})) {
                if (res === 'population') addPopulation(acc, amount);
                else if (res === 'happiness') add(acc, 'happiness', amount * (flags.polish ? 2 : 1));
                else addResource(acc, res, amount, 'goods');
            }
        }

        // happiness
        const happiness = (levels.AllAge?.happiness?.provided || 0) + (eraLevel?.happiness?.provided || 0);
        if (happiness) add(acc, 'happiness', happiness * (flags.polish ? 2 : 1));

        // boosts
        const boostSources = [levels.AllAge?.boosts?.boosts, eraLevel?.boosts?.boosts];
        for (const boosts of boostSources) {
            for (const b of boosts || []) {
                if (!b) continue;
                addBoost(acc, b.type, b.feature || b.targetedFeature, b.value);
            }
        }

        // productions
        const options = eraLevel?.production?.options || levels.AllAge?.production?.options || [];
        const option = pickOption(options, 'time');

        if (option) {
            const factor = dayFactor(option.time);
            entity.factor = factor;

            const lookup = Object.assign(
                {},
                eraLevel?.lookup?.rewards || {},
                levels.AllAge?.lookup?.rewards || {}
            );

            for (const product of option.products || []) {
                walkProduct(acc, product, factor, lookup, flags);
            }
        }
    }

    // --- legacy shape -------------------------------------------------------

    function collectLegacy(acc, meta, era, flags, entity) {
        const levels = Object.assign({}, ...((meta.entity_levels || []).map(x => ({ [x.era]: x }))));
        const lvl = (era && levels[era]) || (meta.entity_levels || [])[0] || null;

        // population
        if (meta.provided_population || meta.required_population) {
            addPopulation(acc, (meta.provided_population || 0) - (meta.required_population || 0));
        } else if (lvl && (lvl.provided_population || lvl.required_population)) {
            addPopulation(acc, (lvl.provided_population || 0) - (lvl.required_population || 0));
        }

        // happiness
        const happiness = meta.provided_happiness || lvl?.provided_happiness || 0;
        if (happiness) add(acc, 'happiness', happiness * (flags.polish ? 2 : 1));

        // static resources
        for (const [res, amount] of Object.entries(meta.static_resources?.resources || {})) {
            addResource(acc, res, amount, 'goods');
        }

        // building costs are ignored on purpose — this compares upkeep/output.

        // productions
        const product = pickOption(meta.available_products || [], 'production_time');
        if (product) {
            const factor = dayFactor(product.production_time);
            entity.factor = factor;

            const motivate = flags.motivate ? 2 : 1;

            if (lvl?.produced_money) {
                add(acc, 'coins', lvl.produced_money * factor * motivate);
                if (flags.coinsFromSupplies) add(acc, 'coins', 0);
            }

            for (const [res, rawAmount] of Object.entries(product.product?.resources || {})) {
                if (res === 'money' && lvl?.produced_money) continue;

                let amount = rawAmount;
                if (!amount && lvl?.production_values && product.production_option) {
                    amount = lvl.production_values[product.production_option - 1]?.value || 0;
                }
                if (!amount) continue;

                const mult = (res === 'money' || res === 'coins' || res === 'supplies') ? motivate : 1;
                addResource(acc, res, amount * factor * mult, 'goods');

                if (flags.coinsFromSupplies && res === 'supplies') {
                    add(acc, 'coins', amount * factor);
                }
            }

            if (product.unit_class) add(acc, 'units_current', factor);
        }

        // abilities
        const factor = entity.factor || 1;

        for (const a of meta.abilities || []) {
            if (!a) continue;

            if (a.__class__ === 'AddResourcesAbility' || a.__class__ === 'AddResourcesWhenMotivatedAbility') {
                const sources = [a.additionalResources?.AllAge?.resources, a.additionalResources?.[era]?.resources];
                for (const resources of sources) {
                    for (const [res, amount] of Object.entries(resources || {})) {
                        addResource(acc, res, amount * factor, 'goods');
                    }
                }
            }

            if (a.__class__ === 'AddResourcesToGuildTreasuryAbility') {
                const sources = [a.additionalResources?.AllAge?.resources, a.additionalResources?.[era]?.resources];
                for (const resources of sources) {
                    for (const [res, amount] of Object.entries(resources || {})) {
                        addResource(acc, res, amount * factor, 'treasury_goods');
                    }
                }
            }

            if (a.__class__ === 'RandomUnitOfAgeWhenMotivatedAbility') {
                add(acc, 'units_current', (a.amount || 1) * factor);
            }

            if (a.__class__ === 'RandomChestRewardAbility') {
                const rewards = a.rewards?.[era]?.possible_rewards || a.rewards?.AllAge?.possible_rewards || {};
                for (const rew of Object.values(rewards)) {
                    if (!rew?.reward) continue;
                    // drop_chance is a percentage here, unlike dropChance above.
                    const chance = Number(rew.drop_chance) / 100;
                    if (!Number.isFinite(chance)) continue;

                    addRewardTree(acc, rew.reward, chance * factor);
                }
            }

            for (const hint of a.boostHints || []) {
                const map = hint.boostHintEraMap || {};
                const entry = map.AllAge || map[era];
                if (entry) addBoost(acc, entry.type, entry.feature || entry.targetedFeature, entry.value);
            }
        }
    }

    // --- great buildings ----------------------------------------------------

    // Great building bonuses that are a flat amount rather than a percentage.
    // Anything not listed here is treated as a boost, which is what most GB
    // bonus types (coin/supply/goods/FP production, …) actually are.
    const GB_FLAT_BONUS_TO_METRIC = {
        population: 'population',
        happiness: 'happiness',
        medals: 'medals',
        strategy_points: 'forge_points'
    };

    function collectGreatBuilding(acc, meta, era, flags, entity, cityEntry) {
        const level = entity.level || 1;
        const lvl = (meta.entity_levels || [])[level - 1] || (meta.entity_levels || [])[0] || null;

        if (lvl) {
            addPopulation(acc, (lvl.provided_population || 0) - (lvl.required_population || 0));
            if (lvl.provided_happiness) add(acc, 'happiness', lvl.provided_happiness);
        }

        const bonusList = [];
        const primary = cityEntry?.bonus || lvl?.bonus || null;
        if (primary) bonusList.push(primary);
        for (const b of cityEntry?.bonuses || []) bonusList.push(b);

        for (const bonus of bonusList) {
            if (!bonus || !bonus.value) continue;

            const flat = GB_FLAT_BONUS_TO_METRIC[bonus.type];
            if (flat === 'population') addPopulation(acc, bonus.value);
            else if (flat) add(acc, flat, bonus.value);
            else addBoost(acc, bonus.type, bonus.feature || bonus.targetedFeature, bonus.value);
        }
    }

    // --- set / chain adjacency ---------------------------------------------

    function getSetId(meta) {
        const chainId = meta.components?.AllAge?.chain?.chainId;
        if (chainId) return chainId;

        for (const a of meta.abilities || []) {
            if (!a) continue;
            if (a.__class__ === 'ChainStartAbility' || a.__class__ === 'ChainLinkAbility') return a.chainId;
            if (a.__class__ === 'BuildingSetAbility') return a.setId;
            if (a.__class__ === 'BonusOnSetAdjacencyAbility') return a.setId;
        }

        return null;
    }

    function isAdjacent(a, b) {
        const ax2 = a.x + a.w, ay2 = a.y + a.h;
        const bx2 = b.x + b.w, by2 = b.y + b.h;

        const xOverlap = a.x < bx2 && b.x < ax2;
        const yOverlap = a.y < by2 && b.y < ay2;

        if (xOverlap && (ay2 === b.y || by2 === a.y)) return true;
        if (yOverlap && (ax2 === b.x || bx2 === a.x)) return true;

        return false;
    }

    function countAdjacentSetMembers(entity, entities) {
        if (!entity.setId) return 0;

        let count = 0;
        for (const other of entities) {
            if (other === entity) continue;
            if (other.setId !== entity.setId) continue;
            if (isAdjacent(entity, other)) count++;
        }
        return count;
    }

    function applyBonusEntry(acc, bonus, era, factor) {
        // boosts
        const boostList = Array.isArray(bonus.boosts) ? bonus.boosts : Object.values(bonus.boosts || {});
        for (const b of boostList) {
            if (!b) continue;
            addBoost(acc, b.type, b.feature || b.targetedFeature, b.value);
        }

        // single boost keyed by era (legacy set abilities)
        const boost = bonus.boost?.AllAge || bonus.boost?.[era];
        if (boost) addBoost(acc, boost.type, boost.feature || boost.targetedFeature, boost.value);

        // revenue (legacy set abilities)
        const revenue = bonus.revenue?.AllAge || bonus.revenue?.[era];
        for (const [res, amount] of Object.entries(revenue?.resources || {})) {
            addResource(acc, res, amount * factor, 'goods');
        }

        // productions (component chains)
        for (const product of bonus.productions || []) {
            walkProduct(acc, product, factor, {}, { motivate: false, polish: false, coinsFromSupplies: false });
        }
    }

    function collectSetBonuses(acc, entity, adjacentCount) {
        if (!adjacentCount) return;

        const meta = entity.meta;
        const era = entity.era;
        const factor = entity.factor || 1;

        const chainConfigs = [
            meta.components?.AllAge?.chain?.config?.bonuses,
            (era && meta.components?.[era]?.chain?.config?.bonuses) || null
        ];

        for (const bonuses of chainConfigs) {
            for (const bonus of bonuses || []) {
                if (!bonus || (bonus.level || 0) > adjacentCount) continue;
                applyBonusEntry(acc, bonus, era, factor);
            }
        }

        for (const a of meta.abilities || []) {
            if (!a) continue;
            if (a.__class__ !== 'BonusOnSetAdjacencyAbility' && a.__class__ !== 'ChainLinkAbility') continue;

            for (const bonus of a.bonuses || []) {
                if (!bonus || (bonus.level || 0) > adjacentCount) continue;
                applyBonusEntry(acc, bonus, era, factor);
            }
        }
    }

    // --- entity building ----------------------------------------------------

    function isCityEntity(meta) {
        if (!meta) return false;
        if (EXCLUDED_TYPES.has(meta.type)) return false;
        if (String(meta.type).includes('hub')) return false;
        return true;
    }

    function buildCityEntryIndex() {
        const index = new Map();
        for (const entry of Object.values(state.cityData || {})) {
            if (!entry || entry.cityentity_id === undefined) continue;
            if (!index.has(entry.cityentity_id)) index.set(entry.cityentity_id, entry);
        }
        return index;
    }

    function makeEntity(meta, data, tileX, tileY, cityEntryIndex) {
        const dims = app.getMetaSize(meta);

        // Great buildings exist only once per city: fall back to the level the
        // original city data recorded, and treat anything new as level 1.
        let level = 1;
        let cityEntry = null;
        if (meta.type === 'greatbuilding') {
            cityEntry = cityEntryIndex.get(meta.id) || null;
            level = (data && data.level) || cityEntry?.level || 1;
        }

        return {
            meta: meta,
            data: data || {},
            era: resolveEra(meta, data),
            level: level,
            cityEntry: cityEntry,
            setId: getSetId(meta),
            x: tileX,
            y: tileY,
            w: dims.width,
            h: dims.height,
            factor: 1
        };
    }

    function entitiesFromCityData(cityData, cityEntryIndex) {
        const entities = [];

        for (const entry of Object.values(cityData || {})) {
            if (!entry) continue;
            const meta = state.metaById.get(entry.cityentity_id);
            if (!isCityEntity(meta)) continue;
            entities.push(makeEntity(meta, entry, entry.x || 0, entry.y || 0, cityEntryIndex));
        }

        return entities;
    }

    function entitiesFromMapBuildings(cityEntryIndex) {
        const entities = [];

        for (const building of state.mapBuildings || []) {
            const meta = building.meta;
            if (!isCityEntity(meta)) continue;
            entities.push(makeEntity(
                meta,
                building.data,
                Math.round(building.x / SIZE),
                Math.round(building.y / SIZE),
                cityEntryIndex
            ));
        }

        return entities;
    }

    // --- aggregation --------------------------------------------------------

    function totalUnlockedTiles() {
        let total = 0;
        for (const exp of state.mapData || []) {
            total += (exp.width || 0) * (exp.length || 0);
        }
        return total;
    }

    function summarise(entities) {
        const acc = makeAcc();

        let buildingTiles = 0;
        let streetTiles = 0;
        let streetCount = 0;
        let buildingCount = 0;

        for (const entity of entities) {
            const tiles = entity.w * entity.h;

            if (entity.meta.type === 'street') {
                streetTiles += tiles;
                streetCount++;
                continue;
            }

            buildingTiles += tiles;
            buildingCount++;

            const flags = getFlags(entity.meta);

            if (entity.meta.type === 'greatbuilding') {
                collectGreatBuilding(acc, entity.meta, entity.era, flags, entity, entity.cityEntry);
            } else if (entity.meta.components) {
                collectComponents(acc, entity.meta, entity.era, flags, entity);
            } else {
                collectLegacy(acc, entity.meta, entity.era, flags, entity);
            }
        }

        // Second pass: set / chain bonuses depend on where things ended up.
        for (const entity of entities) {
            if (!entity.setId || entity.meta.type === 'street') continue;
            collectSetBonuses(acc, entity, countAdjacentSetMembers(entity, entities));
        }

        const total = totalUnlockedTiles();
        acc.tiles_total = total;
        acc.tiles_buildings = buildingTiles;
        acc.tiles_streets = streetTiles;
        acc.tiles_free = total - buildingTiles - streetTiles;
        acc.street_count = streetCount;
        acc.building_count = buildingCount;

        acc.population_net = (acc.population_provided || 0) - (acc.population_required || 0);

        for (const key of Object.keys(acc)) {
            acc[key] = Math.round(acc[key] * 100) / 100;
        }

        return acc;
    }

    // --- building diff -------------------------------------------------------

    function buildingCounts(entities) {
        const counts = new Map();

        for (const entity of entities) {
            const id = String(entity.meta.id);
            let entry = counts.get(id);

            if (!entry) {
                entry = {
                    id: id,
                    name: entity.meta.name || id,
                    type: entity.meta.type || '',
                    width: entity.w,
                    height: entity.h,
                    count: 0
                };
                counts.set(id, entry);
            }

            entry.count++;
        }

        return counts;
    }

    function diffBuildings(beforeEntities, afterEntities) {
        const before = buildingCounts(beforeEntities);
        const after = buildingCounts(afterEntities);

        const removed = [];
        const added = [];

        for (const id of new Set([...before.keys(), ...after.keys()])) {
            const beforeEntry = before.get(id);
            const afterEntry = after.get(id);
            const delta = (afterEntry ? afterEntry.count : 0) - (beforeEntry ? beforeEntry.count : 0);

            if (delta < 0) removed.push(Object.assign({}, beforeEntry, { count: -delta }));
            else if (delta > 0) added.push(Object.assign({}, afterEntry, { count: delta }));
        }

        const byAmount = (a, b) => b.count - a.count || a.name.localeCompare(b.name);
        removed.sort(byAmount);
        added.sort(byAmount);

        return { removed: removed, added: added };
    }

    function computeComparison() {
        if (!state.metaById || !state.metaById.size) return null;

        // Both sides must share one registry so discovered rows line up.
        dynamicMetrics.clear();

        const cityEntryIndex = buildCityEntryIndex();
        const originalCityData = (state.originalData && state.originalData.cityData) || state.cityData || {};

        const beforeEntities = entitiesFromCityData(originalCityData, cityEntryIndex);
        const afterEntities = entitiesFromMapBuildings(cityEntryIndex);

        return {
            before: summarise(beforeEntities),
            after: summarise(afterEntities),
            buildings: diffBuildings(beforeEntities, afterEntities)
        };
    }

    // --- rendering ----------------------------------------------------------

    function formatNumber(value, metric) {
        const n = Number(value) || 0;
        const text = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
        return metric && metric.percent ? text + '%' : text;
    }

    function formatDelta(delta, metric) {
        const n = Number(delta) || 0;
        const sign = n > 0 ? '+' : '';
        return sign + formatNumber(n, metric);
    }

    function deltaClass(delta) {
        if (delta > 0) return 'positive';
        if (delta < 0) return 'negative';
        return '';
    }

    // Static rows plus anything discovered while walking this city.
    function allMetrics() {
        return METRICS.concat(Array.from(dynamicMetrics.values()));
    }

    function findMetric(key) {
        return METRIC_BY_KEY.get(key) || dynamicMetrics.get(key) || null;
    }

    // Items are ordered by how many pieces one finished item takes, cheapest
    // first; every other group keeps its declared order.
    function metricsInGroup(group) {
        const metrics = allMetrics().filter(m => m.group === group);
        if (group !== 'items') return metrics;

        return metrics.sort((a, b) =>
            (a.requiredAmount || 1) - (b.requiredAmount || 1) ||
            metricLabel(a).localeCompare(metricLabel(b))
        );
    }

    function matchesFilter(metric, text) {
        if (!text) return true;
        return (metricLabel(metric) + ' ' + metric.key).toLowerCase().includes(text);
    }

    function filterText(el) {
        return el && el.value ? el.value.trim().toLowerCase() : '';
    }

    function renderTable(result) {
        if (!dom.compareTableWrap) return;

        const rows = [];
        const text = filterText(dom.compareTableFilter);
        const changedOnly = !!(dom.compareChangedOnly && dom.compareChangedOnly.checked);

        for (const [group, groupKey, groupFallback] of GROUPS) {
            const metrics = metricsInGroup(group);
            const visible = metrics.filter(m => {
                const before = result.before[m.key] || 0;
                const after = result.after[m.key] || 0;

                if (before === 0 && after === 0) return false;
                if (changedOnly && after === before) return false;
                return matchesFilter(m, text);
            });
            if (!visible.length) continue;

            rows.push('<tr class="group-row"><th colspan="4">' + app.t(groupKey, groupFallback) + '</th></tr>');

            for (const metric of visible) {
                const before = result.before[metric.key] || 0;
                const after = result.after[metric.key] || 0;
                const delta = after - before;
                const percent = before !== 0 ? Math.round((delta / Math.abs(before)) * 100) : null;

                rows.push(
                    '<tr>' +
                        '<td class="metric">' + icon(metric.icon) + '<span>' + metricLabel(metric) + '</span></td>' +
                        '<td class="num">' + formatNumber(before, metric) + '</td>' +
                        '<td class="num">' + formatNumber(after, metric) + '</td>' +
                        '<td class="num delta ' + deltaClass(delta) + '">' +
                            formatDelta(delta, metric) +
                            (percent !== null && delta !== 0 ? ' <span class="pct">(' + (percent > 0 ? '+' : '') + percent + '%)</span>' : '') +
                        '</td>' +
                    '</tr>'
                );
            }
        }

        if (!rows.length) {
            const message = (text || changedOnly)
                ? app.t('XPlan.Compare.NoMatches', 'No metrics match the filter.')
                : app.t('XPlan.Compare.NoData', 'No comparable data available.');
            dom.compareTableWrap.innerHTML = '<p class="empty">' + message + '</p>';
            return;
        }

        dom.compareTableWrap.innerHTML =
            '<table class="compare-table">' +
                '<thead><tr>' +
                    '<th></th>' +
                    '<th class="num">' + app.t('General.Before', 'Before') + '</th>' +
                    '<th class="num">' + app.t('General.After', 'After') + '</th>' +
                    '<th class="num">' + app.t('General.Change', 'Change') + '</th>' +
                '</tr></thead>' +
                '<tbody>' + rows.join('') + '</tbody>' +
            '</table>';
    }

    function renderAxisPicker(result) {
        if (!dom.compareAxisPicker) return;

        const text = filterText(dom.compareAxisFilter);
        const options = [];

        for (const [group] of GROUPS) {
            for (const metric of metricsInGroup(group)) {
                const selected = selectedAxes.indexOf(metric.key) !== -1;
                const hasData = (result.before[metric.key] || 0) !== 0 || (result.after[metric.key] || 0) !== 0;

                // A selected axis stays listed even with no data, so it can be
                // unticked again — but the filter still applies to it.
                if (!hasData && !selected) continue;
                if (!matchesFilter(metric, text)) continue;

                options.push(
                    '<label class="axis-option">' +
                        '<input type="checkbox" value="' + metric.key + '"' + (selected ? ' checked' : '') + '>' +
                        '<span>' + metricLabel(metric) + '</span>' +
                    '</label>'
                );
            }
        }

        dom.compareAxisPicker.innerHTML = options.length
            ? options.join('')
            : '<span class="empty">' + app.t('XPlan.Compare.NoMatches', 'No metrics match the filter.') + '</span>';
    }

    function renderChart(result) {
        if (!dom.compareChart) return;

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded — skipping the comparison chart.');
            return;
        }

        const axes = selectedAxes.filter(key => findMetric(key));
        if (axes.length < 3) return;

        const labels = axes.map(key => metricLabel(findMetric(key)));

        chartInstance = new Chart(dom.compareChart, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: app.t('XPlan.Compare.Before', 'Before'),
                        data: axes.map(key => result.before[key] || 0),
                        fill: true,
                        backgroundColor: 'rgba(230, 203, 47, 0.2)',
                        borderColor: '#e6d42f',
                        pointBackgroundColor: '#e6d42f'
                    },
                    {
                        label: app.t('XPlan.Compare.After', 'After'),
                        data: axes.map(key => result.after[key] || 0),
                        fill: true,
                        backgroundColor: 'rgba(64, 154, 196, 0.2)',
                        borderColor: '#40a5c4',
                        pointBackgroundColor: '#409fc4'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: { line: { borderWidth: 2 } },
                plugins: {
                    legend: { labels: { color: '#eee' } }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        angleLines: { color: '#5f5751' },
                        grid: { color: '#5f5751' },
                        pointLabels: { color: '#eee', font: { size: 11 } },
                        ticks: { color: '#eee', backdropColor: 'transparent' }
                    }
                }
            }
        });
    }

    function renderBuildingList(el, entries) {
        if (!el) return;

        if (!entries.length) {
            el.innerHTML = '<li class="empty">' +
                app.t('XPlan.Compare.NoChanges', 'No changes') + '</li>';
            return;
        }

        el.innerHTML = entries.map(entry =>
            '<li class="' + entry.type + '">' +
                '<span class="amount">' + entry.count + '</span>' +
                '<span class="name">' + entry.name + '</span>,' +
                ' <span>' + entry.height + 'x' + entry.width + '</span>' +
            '</li>'
        ).join('');
    }

    function renderBuildingLists(result) {
        const buildings = result.buildings || { removed: [], added: [] };
        renderBuildingList(dom.compareRemovedList, buildings.removed);
        renderBuildingList(dom.compareAddedList, buildings.added);
    }

    function renderComparison() {
        if (!lastResult) return;
        renderTable(lastResult);
        renderBuildingLists(lastResult);
        renderAxisPicker(lastResult);
        renderChart(lastResult);
    }

    function openCompareModal() {
        if (!dom.compareModal) return;

        lastResult = computeComparison();

        if (!lastResult) {
            if (dom.compareTableWrap) {
                dom.compareTableWrap.innerHTML = '-';
            }
            dom.compareModal.classList.remove('hidden');
            return;
        }

        dom.compareModal.classList.remove('hidden');
        renderComparison();
    }

    function onAxisToggle(e) {
        const input = e.target.closest('input[type="checkbox"]');
        if (!input) return;

        const key = input.value;
        const index = selectedAxes.indexOf(key);

        if (input.checked && index === -1) selectedAxes.push(key);
        else if (!input.checked && index !== -1) selectedAxes.splice(index, 1);

        renderChart(lastResult);
    }

    function bindCompareEvents() {
        if (dom.compareAxisPicker) {
            dom.compareAxisPicker.addEventListener('change', onAxisToggle);
        }

        if (dom.compareAxisFilter) {
            dom.compareAxisFilter.addEventListener('input', () => {
                if (lastResult) renderAxisPicker(lastResult);
            });
        }

        if (dom.compareTableFilter) {
            dom.compareTableFilter.addEventListener('input', () => {
                if (lastResult) renderTable(lastResult);
            });
        }

        if (dom.compareChangedOnly) {
            dom.compareChangedOnly.addEventListener('change', () => {
                if (lastResult) renderTable(lastResult);
            });
        }
    }

    app.computeComparison = computeComparison;
    app.openCompareModal = openCompareModal;
    app.bindCompareEvents = bindCompareEvents;
    app.compareMetrics = METRICS;
})(window.PlannerApp);