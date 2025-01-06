import { useHotkeys } from "@mantine/hooks";
import { Feature } from "ol";
import { LineString } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import { type FunctionComponent, useContext, useEffect } from "react";

import { wgsToMercator } from "../../utils/geom-utils";
import MapLinesContext from "../../utils/map-lines-context";
import { useMap } from "../map/MapProvider";
import { getCssVarValue } from "../utils/general-utils";

const MapLinesLayer: FunctionComponent = () => {
  const map = useMap();
  const { mapLines, setMapLines } = useContext(MapLinesContext);

  useHotkeys([
    [
      "Escape",
      () => {
        mapLines && setMapLines(null);
      },
    ],
    [
      "mod+E",
      () => {
        // export the lines to a file in WKT format
        if (!mapLines) return;
        const lines = mapLines.lines.map((line) => {
          const coords = line.coords
            .map(([x, y]) => `${y} ${x}`) // swap lat and lon
            .toReversed()
            .join(",");
          return `(${coords})`;
        });

        const wkt = `SRID=4326;MULTILINESTRING(${lines.join(",")})`;

        const blob = new Blob([wkt], { type: "text/plain;charset=utf-8" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "map-lines.wkt";

        a.click();
      },
    ],
  ]);

  useEffect(() => {
    if (!mapLines || !map) return;

    const layerSource = new VectorSource({
      features: mapLines.lines.map((line) => {
        const coords = line.coords.map(wgsToMercator);

        const feature = new Feature({
          geometry: new LineString(coords),
        });

        feature.set("color", line.color);
        feature.set("label", line.label);

        return feature;
      }),
    });

    const layer = new VectorLayer({
      source: layerSource,
      style: (feature) => {
        return new Style({
          stroke: new Stroke({
            color: feature.get("color"),
            width: 4,
          }),
          text: new Text({
            text: feature.get("label"),
            font: getCssVarValue("--joy-fontSize-sm") + " Inter",
            fill: new Fill({ color: getCssVarValue("--joy-palette-text-primary") }),
            backgroundFill: new Fill({ color: getCssVarValue("--joy-palette-background-surface") }),
            backgroundStroke: new Stroke({ color: getCssVarValue("--joy-palette-neutral-outlinedBorder"), width: 1 }),
            padding: [2, 4, 2, 4], // Add padding to create space for the border radius
          }),
        });
      },
      zIndex: 30,
    });

    map.addLayer(layer);

    return () => {
      map?.removeLayer(layer);
    };
  }, [map, mapLines]);

  return null;
};

export default MapLinesLayer;
