import L from "leaflet";
import { type FunctionComponent, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

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
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const layer = L.tileLayer(url, {
      attribution,
      className,
      opacity,
    }).addTo(map);

    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
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
