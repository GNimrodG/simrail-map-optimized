import { createContext } from "react";

export type SelectedTrainData = { trainNo: string; follow: boolean; paused: boolean };

const SelectedTrainContext = createContext<{
  selectedTrain: SelectedTrainData | null;
  setSelectedTrain: (value: SelectedTrainData | null) => void;
}>({ selectedTrain: null, setSelectedTrain: () => {} });

export default SelectedTrainContext;
