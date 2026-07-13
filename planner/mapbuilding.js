'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const state = app.state;
    const SIZE = 30;
    const FONT_SIZE = 15;
    const FONT = FONT_SIZE + 'px Arial';

    function getMetaSize(meta) {
        return {
            width: meta.width ?? meta.components?.AllAge?.placement?.size?.x ?? 1,
            height: meta.length ?? meta.components?.AllAge?.placement?.size?.y ?? 1
        };
    }

    const InnoEras = {
        StoneAge: 0, 
        BronzeAge: 1, 
        IronAge: 2, 
        EarlyMiddleAge: 3, 
        HighMiddleAge: 4,
        LateMiddleAge: 5, 
        ColonialAge: 6, 
        IndustrialAge: 7, 
        ProgressiveEra: 8,
        ModernEra: 9, 
        PostModernEra: 10, 
        ContemporaryEra: 11, 
        TomorrowEra: 12,
        FutureEra: 13, 
        ArcticFuture: 14, 
        OceanicFuture: 15, 
        VirtualFuture: 16,
        SpaceAgeMars: 17, 
        SpaceAgeAsteroidBelt: 18, 
        SpaceAgeVenus: 19,
        SpaceAgeJupiterMoon: 20, 
        SpaceAgeTitan: 21, 
        SpaceAgeSpaceHub: 22, 
        NextEra: 23
    };


    function getBuildingPopulation(meta, data) {
        if (!meta) return 0;

        const isGeneric = meta.__class__ === 'GenericCityEntity';
        const eraId = InnoEras[data.era];

        if (!isGeneric && Array.isArray(meta.entity_levels) && meta.entity_levels.length > 0) {
            const level = eraId !== undefined ? meta.entity_levels[eraId] : undefined;
            if (level) {
                if (level.required_population) return level.required_population * -1;
                if (level.provided_population) return level.provided_population;
                return 0;
            }

            for (const lvl of meta.entity_levels) {
                if (!lvl) continue;
                if (lvl.required_population) return lvl.required_population * -1;
                if (lvl.provided_population) return lvl.provided_population;
            }
            return 0;
        }

        if (!isGeneric && meta.requirements?.cost?.resources) {
            if (meta.type === 'decoration') return 0;
            if (meta.type === 'greatbuilding') {
                let cityData = Object.values(state.cityData).find(x => x.cityentity_id === data.cityentity_id)
                if (cityData.bonus && cityData.bonus.type === "population")
                    return cityData.bonus.value;
            };
            const cost = meta.requirements.cost.resources.population;
            return cost ? cost * -1 : 0;
        }

        if (meta.components) {
            if (data.era && meta.components[data.era]?.staticResources?.resources?.resources?.population !== undefined) {
                return meta.components[data.era].staticResources.resources.resources.population;
            }

            const allAge = meta.components.AllAge?.staticResources?.resources?.resources?.population;
            if (allAge !== undefined) return allAge;

            for (const key of Object.keys(meta.components)) {
                const pop = meta.components[key]?.staticResources?.resources?.resources?.population;
                if (pop !== undefined) return pop;
            }
        }

        return 0;
    }

    class MapBuilding {
        constructor(data, meta) {
            this.data = data;
            this.meta = meta;
            this.name = meta.name;
            this.custom = !!(data && data.custom);
            this.displayName = (this.custom ? '* ' : '') + this.name;

            this.x = (data.x * SIZE) || 0;
            this.y = (data.y * SIZE) || 0;

            const dims = getMetaSize(meta);
            this.width = SIZE * dims.width;
            this.height = SIZE * dims.height;

            this.isSelected = false;
            this.isActive = false;

            this.streetReq = this.setNeedsStreet();
            this.population = getBuildingPopulation(meta, data);
            this.fill = this.setFillColor();
            this.stroke = this.setStrokeColor();
            this.hasLabel = !(this.meta.type === 'street' || this.height === SIZE || this.width === SIZE);
        }

        setNeedsStreet() {
            let needsStreet = this.meta.requirements?.street_connection_level;

            if (needsStreet === undefined) {
                if (Array.isArray(this.meta.abilities)) {
                    for (const ability of this.meta.abilities) {
                        if (ability?.__class__ === 'StreetConnectionRequirementComponent') {
                            needsStreet = 1;
                            break;
                        }
                    }
                }

                const req = this.meta.components?.AllAge?.streetConnectionRequirement;
                if (req !== undefined) needsStreet = req.requiredLevel;
            }

            return (needsStreet === undefined ? 0 : needsStreet);
        }

        setFillColor() {
            let color = '#888';

            if (this.meta.type === 'main_building') color = '#ffb300';
            else if (this.meta.type === 'military') color = '#fff';
            else if (this.meta.type === 'greatbuilding') color = '#e6542f';
            else if (this.meta.type === 'residential') color = '#7abaff';
            else if (this.meta.type === 'production') color = '#416dff';
            else if (this.meta.type === 'goods') color = '#7d2a4d';

            if (this.streetReq === 0) color = '#793bc9';
            return color;
        }

        setStrokeColor() {
            let color = '#888';

            if (this.meta.type === 'main_building') color = '#ffb300';
            else if (this.meta.type === 'greatbuilding') color = '#af3d2b';
            else if (this.meta.type === 'residential') color = '#219eff';
            else if (this.meta.type === 'production') color = '#2732ff';
            else if (this.meta.type === 'goods') color = '#6a2a3a';

            if (this.streetReq === 0) color = '#3d2783';
            return color;
        }

        draw(context) {
            const outOfBounds = app.isBuildingOutOfBounds(this);

            context.save();
            if (outOfBounds) context.globalAlpha = 0.75;

            context.fillStyle = this.isSelected ? '#cfe5f0' : this.isActive ? '#66c440' : this.fill;
            context.strokeStyle = this.isSelected ? '#2a4670' : this.stroke;

            context.fillRect(this.x, this.y, this.width, this.height);
            context.lineWidth = 2;
            context.strokeRect(this.x, this.y, this.width, this.height);

            this.drawName(context);

            context.restore();
        }

        drawName(context) {
            if (!this.hasLabel) return;

            context.save();

            if (state.rotated) {
                const cx = this.x + this.width / 2;
                const cy = this.y + this.height / 2;
                context.translate(cx, cy);
                context.rotate(-Math.PI / 2);
                context.translate(-cx, -cy);
            }

            context.fillStyle = '#000';
            context.font = this.isSelected ? ('bold ' + FONT) : FONT;

            const boxWidth = state.rotated ? this.height : this.width;
            const label = this.displayName;

            const text = context.measureText(label);
            let sizeOffset = FONT_SIZE + Math.ceil(FONT_SIZE * 0.4);

            if (text.width < boxWidth) {
                context.fillText(label, this.x + this.width / 2, this.y + this.height / 2 - Math.ceil(FONT_SIZE * 0.3));
                sizeOffset = FONT_SIZE - 2;
            } else if (this.height > SIZE && this.width > SIZE) {
                const ratio = Math.ceil(text.width / (boxWidth - 30));
                let textStart = 0;
                let textEnd = Math.ceil(label.length / ratio);

                context.fillText(label.slice(textStart, textEnd), this.x + this.width / 2, this.y + this.height / 2 - Math.ceil(FONT_SIZE * 0.9));
                textStart = textEnd;
                textEnd = Math.ceil(label.length / ratio) + textStart;
                const more = (textEnd >= label.length) ? '' : '…';
                context.fillText(label.slice(textStart, textEnd) + more, this.x + this.width / 2, this.y + this.height / 2 + Math.ceil(FONT_SIZE * 0.2));
            }

            const metaDims  = app.getMetaSize(this.meta);
            const totalSize = metaDims.height + 'x' + metaDims.width;
            context.font = '12px Arial';
            context.fillText(totalSize, this.x + this.width / 2, this.y + this.height / 2 + sizeOffset);

            context.restore();
        }
    }

    app.getMetaSize = getMetaSize;
    app.getBuildingPopulation = getBuildingPopulation;
    app.InnoEras = InnoEras;
    app.MapBuilding = MapBuilding;
})(window.PlannerApp);