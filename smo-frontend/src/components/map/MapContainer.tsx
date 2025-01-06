import { Map as OlMap, View } from "ol";
import { FeatureLike } from "ol/Feature";
import { type FunctionComponent, PropsWithChildren, useEffect, useId, useState } from "react";

import { wgsToMercator } from "../../utils/geom-utils";
import { MapContext } from "./MapProvider";
import { FeatureClickContext, FeatureClickEventListener } from "./useFeatureClick";

export interface MapContainerProps {
  center: [number, number];
  zoom: number;
  style: React.CSSProperties;
}

const MapContainer: FunctionComponent<PropsWithChildren<MapContainerProps>> = ({ center, zoom, style, children }) => {
  const id = useId();

  const [map, setMap] = useState<OlMap | null>(null);
  const [featureClickMap] = useState(new Map<FeatureLike, FeatureClickEventListener[]>());

  useEffect(() => {
    const map = new OlMap({
      target: id,
      view: new View({
        projection: "EPSG:3857", // Web Mercator
        center: wgsToMercator(center),
        zoom,
      }),
      controls: [],
    });

    map.on("click", (event) => {
      const features = map.getFeaturesAtPixel(event.pixel, { hitTolerance: 5 });

      if (!features) return;

      for (const feature of features) {
        const handlers = featureClickMap.get(feature) || [];

        if (!handlers.length) continue; // Ignore non-clickable features

        const closeEvent = new Event("close-popup");

        window.dispatchEvent(closeEvent);

        for (const handler of handlers) {
          handler(event);
        }

        break;
      }
    });

    setMap(map);

    return () => {
      map.setTarget();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id={id} style={style}>
      <MapContext.Provider value={map}>
        <FeatureClickContext.Provider value={featureClickMap}>{children}</FeatureClickContext.Provider>
      </MapContext.Provider>
    </div>
  );
};

export default MapContainer;
