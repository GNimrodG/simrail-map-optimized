import { useCallback, useEffect, useMemo, useState } from "react";

import SelectedTrainContext, { SelectedTrainData } from "../utils/selected-train-context";

const TRAIN_HASH_PREFIX = "train:";
const STATION_HASH_PREFIX = "station:";

const SelectedTrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTrain, setSelectedTrain] = useState<SelectedTrainData | null>(null);

  const setSelectedTrainCb = useCallback(
    (value: SelectedTrainData | null) => {
      setSelectedTrain(value);
      if (value) {
        // eslint-disable-next-line react-compiler/react-compiler
        globalThis.location.hash = `#${TRAIN_HASH_PREFIX}${value.trainNo}`;
      } else {
        globalThis.location.hash = "";
      }
    },
    [setSelectedTrain],
  );

  useEffect(() => {
    const hash = globalThis.location.hash.slice(1);
    if (!hash || hash.startsWith(STATION_HASH_PREFIX)) {
      return;
    }

    const trainHash = hash.startsWith(TRAIN_HASH_PREFIX) ? hash.slice(TRAIN_HASH_PREFIX.length) : hash;
    const trainNo = decodeURIComponent(trainHash);

    if (trainNo) {
      setSelectedTrain({ trainNo, follow: true, paused: false });
    }
  }, []);

  const value = useMemo(
    () => ({ selectedTrain, setSelectedTrain: setSelectedTrainCb }),
    [selectedTrain, setSelectedTrainCb],
  );

  return <SelectedTrainContext.Provider value={value}>{children}</SelectedTrainContext.Provider>;
};

export default SelectedTrainProvider;
