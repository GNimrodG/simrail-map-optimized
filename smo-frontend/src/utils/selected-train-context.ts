import { createContext } from "react";

const SelectedTrainContext = createContext<{
  selectedTrain: string | null;
  setSelectedTrain: (value: string | null) => void;
}>({ selectedTrain: null, setSelectedTrain: () => {} });

export default SelectedTrainContext;
