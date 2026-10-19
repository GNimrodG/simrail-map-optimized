import { type LatLngExpression } from "leaflet";
import { type FunctionComponent, useEffect, useMemo, useState } from "react";
import { Polygon } from "react-leaflet";

import { useSetting } from "../../hooks/useSetting";
import { dataProvider } from "../../utils/data-manager";

// The darkness of the area outside the playable area at full layer opacity
const MASK_OPACITY = 0.45;

// The whole map (as far as Web Mercator goes), the playable area is cut out of it
const WORLD_RING: LatLngExpression[] = [
  [-85, -180],
  [85, -180],
  [85, 180],
  [-85, 180],
];

/**
 * Darkens the map outside the playable area.
 */
const PlayableAreaLayer: FunctionComponent = () => {
  const [layerOpacities] = useSetting("layerOpacities");
  const [area, setArea] = useState<GeoJSON.Polygon | GeoJSON.MultiPolygon | null>(null);

  useEffect(() => {
    let cancelled = false;

    dataProvider
      .fetchPlayableArea()
      .then((playableArea) => {
        if (!cancelled) setArea(playableArea);
      })
      .catch((e) => console.error("Failed to load the playable area", e));

    return () => {
      cancelled = true;
    };
  }, []);

  // The world with every ring of the area as a hole. With the even-odd fill rule, the holes inside the playable
  // area (enclosed by tracks) are dark again.
  const rings = useMemo(() => {
    if (!area) return null;

    const polygons = area.type === "Polygon" ? [area.coordinates] : area.coordinates;

    return [
      WORLD_RING,
      ...polygons.flatMap((polygon) =>
        polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng] as LatLngExpression)),
      ),
    ];
  }, [area]);

  if (!rings) return null;

  return (
    <Polygon
      positions={rings}
      pane="playableAreaPane"
      interactive={false}
      pathOptions={{
        stroke: false,
        fillColor: "#000",
        fillOpacity: MASK_OPACITY * (layerOpacities["playable-area"] ?? 1),
        fillRule: "evenodd",
      }}
    />
  );
};

export default PlayableAreaLayer;
