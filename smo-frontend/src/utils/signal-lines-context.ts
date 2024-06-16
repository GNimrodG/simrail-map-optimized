import { createContext } from "react";

export type SignalLineData = {
  signal: string;
  lines: {
    type: "prev" | "prev-further" | "next" | "next-further";
    signal: string;
    coords: [number, number][];
    index: number;
  }[];
};

const SignalLinesContext = createContext<{
  signalLines: SignalLineData | null;
  setSignalLines: (value: SignalLineData | null) => void;
}>({ signalLines: null, setSignalLines: () => {} });

export default SignalLinesContext;
