import { Map as OlMap, View } from "ol";
import { type FunctionComponent, PropsWithChildren, useEffect, useId, useState } from "react";

import { wgsToMercator } from "../../utils/geom-utils";
import { MapContext } from "./MapProvider";

export interface MapContainerProps {
  center: [number, number];
  zoom: number;
  zoomSnap?: number;
  style: React.CSSProperties;
}

const MapContainer: FunctionComponent<PropsWithChildren<MapContainerProps>> = ({
  center,
  zoom,
  zoomSnap,
  style,
  children,
}) => {
  const id = useId();

  const [map, setMap] = useState<OlMap | null>(null);

  useEffect(() => {
    const map = new OlMap({
      target: id,
      view: new View({
        projection: "EPSG:3857",
        center: wgsToMercator(center),
        zoom,
      }),
      controls: [],
    });

    console.log("Created map", map);

    setMap(map);

    return () => {
      console.log("Destroying map", map);
      map.setTarget();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id={id} style={style}>
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  );
};

export default MapContainer;
