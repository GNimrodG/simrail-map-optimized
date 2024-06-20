import { createContext } from "react";

export type MapLineData = {
  signal: string;
  lines: {
    color: string;
    label: string;
    coords: [number, number][];
    index: number;
  }[];
};

const MapLinesContext = createContext<{
  mapLines: MapLineData | null;
  setMapLines: (value: MapLineData | null) => void;
}>({ mapLines: null, setMapLines: () => {} });

export default MapLinesContext;
