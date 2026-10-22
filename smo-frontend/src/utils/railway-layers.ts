// The railway background layers: from the SimRail Railmap (made from the game's own track data: its line speeds,
// ETCS levels and signals, github.com/GNimrodG/simrail-railmap) or from OpenRailwayMap (the real-world railway). The
// layer ids stay the OpenRailwayMap ones, so the layers and opacities people chose carry over to either provider.

export const RAILWAY_LAYER_PROVIDERS = ["railmap", "openrailwaymap"] as const;
export type RailwayLayerProvider = (typeof RAILWAY_LAYER_PROVIDERS)[number];

export const RAILWAY_LAYERS = ["orm-infra", "orm-maxspeed", "orm-signals", "orm-electrification"] as const;
export type RailwayLayer = (typeof RAILWAY_LAYERS)[number];

export const isRailwayLayerProvider = (value: string): value is RailwayLayerProvider =>
  (RAILWAY_LAYER_PROVIDERS as readonly string[]).includes(value);

const RAILMAP_TILES = "https://railmap.data-unknown.com/tiles/styles";
const RAILMAP_ATTRIBUTION =
  'Railway data from the SimRail game files, <a href="https://railmap.data-unknown.com/">SimRail Railmap</a>';
const ORM_ATTRIBUTION =
  'Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>';

// the Railmap has no electrification layer: that one is always OpenRailwayMap's
const RAILMAP_STYLES: Partial<Record<RailwayLayer, string>> = {
  "orm-infra": "infrastructure",
  "orm-maxspeed": "maxspeed",
};

const ORM_STYLES: Record<RailwayLayer, string> = {
  "orm-infra": "standard",
  "orm-maxspeed": "maxspeed",
  "orm-signals": "signals",
  "orm-electrification": "electrification",
};

/** The provider a layer comes from with the chosen one. */
export function railwayLayerProvider(layer: string, chosen: string): RailwayLayerProvider {
  return chosen === "railmap" && RAILMAP_STYLES[layer as RailwayLayer] ? "railmap" : "openrailwaymap";
}

/** The tile URL and the attribution of a railway layer. */
export function railwayLayerSource(layer: RailwayLayer, chosen: string) {
  return railwayLayerProvider(layer, chosen) === "railmap"
    ? { url: `${RAILMAP_TILES}/${RAILMAP_STYLES[layer]}/{z}/{x}/{y}{r}.png`, attribution: RAILMAP_ATTRIBUTION }
    : {
        url: `https://{s}.tiles.openrailwaymap.org/${ORM_STYLES[layer]}/{z}/{x}/{y}.png`,
        attribution: ORM_ATTRIBUTION,
      };
}

/** The translation key of a railway layer's name, which names its provider. */
export function railwayLayerLabelKey(layer: string, chosen: string) {
  return railwayLayerProvider(layer, chosen) === "railmap"
    ? `Layers.Background.${layer.replace(/^orm-/, "railmap-")}`
    : `Layers.Background.${layer}`;
}
