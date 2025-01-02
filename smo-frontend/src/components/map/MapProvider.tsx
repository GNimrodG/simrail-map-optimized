import OlMap from "ol/Map";
import { createContext, useContext } from "react";

export const MapContext = createContext<OlMap | null>(null);

export function useMap() {
  return useContext(MapContext);
}
