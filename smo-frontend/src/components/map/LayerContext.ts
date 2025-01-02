import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { createContext, useContext } from "react";

export const LayerGroupContext = createContext<VectorLayer<VectorSource> | null>(null);

export const useLayerGroup = () => {
  return useContext(LayerGroupContext);
};
