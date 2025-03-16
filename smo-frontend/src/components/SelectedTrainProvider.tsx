import { useCallback, useEffect, useMemo, useState } from "react";

import SelectedTrainContext, { SelectedTrainData } from "../utils/selected-train-context";

const SelectedTrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTrain, setSelectedTrain] = useState<SelectedTrainData | null>(null);

  const setSelectedTrainCb = useCallback(
    (value: SelectedTrainData | null) => {
      setSelectedTrain(value);
      if (value) {
        window.location.hash = `#${value.trainNo}`;
      } else {
        window.location.hash = "";
      }
    },
    [setSelectedTrain],
  );

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setSelectedTrain({ trainNo: hash, follow: true, paused: false });
    }
  }, []);

  const value = useMemo(
    () => ({ selectedTrain, setSelectedTrain: setSelectedTrainCb }),
    [selectedTrain, setSelectedTrainCb],
  );

  return <SelectedTrainContext.Provider value={value}>{children}</SelectedTrainContext.Provider>;
};

export default SelectedTrainProvider;
