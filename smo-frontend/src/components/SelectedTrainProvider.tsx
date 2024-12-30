import { useEffect, useMemo, useState, useCallback } from "react";
import SelectedTrainContext, { SelectedTrainData } from "../utils/selected-train-context";

const SelectedTrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTrain, setSelectedTrainState] = useState<SelectedTrainData | null>(null);

  const setSelectedTrain = useCallback((value: SelectedTrainData | null) => {
    setSelectedTrainState(value);
    if (value) {
      window.location.hash = `#${value.trainNo}`;
    } else {
      window.location.hash = "";
    }
  }, [setSelectedTrainState]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setSelectedTrainState({ trainNo: hash, follow: true, paused: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ selectedTrain, setSelectedTrain }), [selectedTrain, setSelectedTrain]);

  return <SelectedTrainContext.Provider value={value}>{children}</SelectedTrainContext.Provider>;
};

export default SelectedTrainProvider;
