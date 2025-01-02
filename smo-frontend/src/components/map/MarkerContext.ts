import { Feature } from "ol";
import { createContext, useContext } from "react";

export const MarkerContext = createContext<Feature | null>(null);

export const useMarker = () => {
  return useContext(MarkerContext);
};
