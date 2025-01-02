import TileLayer from "ol/layer/Tile";
import { XYZ } from "ol/source";
import { type FunctionComponent, useEffect, useRef } from "react";

import { useMap } from "../map/MapProvider";

export interface RefreshableTileLayerProps {
  className: string;
  url: string;
  attribution: string;
  opacity?: number;
}

const RefreshableTileLayer: FunctionComponent<RefreshableTileLayerProps> = ({
  className,
  url,
  attribution,
  opacity = 1,
}) => {
  const map = useMap();
  const layerRef = useRef<TileLayer | null>(null);

  useEffect(() => {
    if (!map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const layer = new TileLayer({
      source: new XYZ({
        url,
        attributions: attribution,
      }),
      opacity,
      className,
    });

    console.log("Adding layer", layer, "to map", map);

    map.addLayer(layer);

    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        console.log("Removing layer", layerRef.current, "from map", map);
        map.removeLayer(layerRef.current);
      }
    };
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, url, attribution, map]);

  // update opacity
  useEffect(() => {
    const timeout = setTimeout(() => {
      layerRef.current?.setOpacity(opacity);
    }, 100);

    return () => clearTimeout(timeout);
  }, [opacity]);

  return null;
};

export default RefreshableTileLayer;
