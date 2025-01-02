import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { PropsWithChildren, useEffect, useState } from "react";
import { type FunctionComponent } from "react";

import { LayerGroupContext } from "./LayerContext";
import { useMap } from "./MapProvider";

export interface LayerGroupProps {}

const LayerGroup: FunctionComponent<PropsWithChildren<LayerGroupProps>> = ({ children }) => {
  const map = useMap();
  const [layerGroup, setLayerGroup] = useState<VectorLayer<VectorSource> | null>(null);

  useEffect(() => {
    if (!map) return;

    const layer = new VectorLayer({
      source: new VectorSource(),
    });

    map.addLayer(layer);

    setLayerGroup(layer);

    return () => {
      layer.setSource(null);
      map.removeLayer(layer);
    };
  }, [map]);

  return <LayerGroupContext.Provider value={layerGroup}>{children}</LayerGroupContext.Provider>;
};

export default LayerGroup;
