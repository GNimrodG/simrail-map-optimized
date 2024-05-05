import { createContext } from "react";

const SelectedTrainContext = createContext<{
  selectedTrain: { trainNo: string; follow: boolean } | null;
  setSelectedTrain: (value: { trainNo: string; follow: boolean } | null) => void;
}>({ selectedTrain: null, setSelectedTrain: () => {} });

export default SelectedTrainContext;
