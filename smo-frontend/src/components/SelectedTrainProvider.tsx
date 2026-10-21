import { useCallback, useMemo, useState } from "react";

import SelectedTrainContext, { SelectedTrainData } from "../utils/selected-train-context";

const TRAIN_HASH_PREFIX = "train:";
const STATION_HASH_PREFIX = "station:";

/** The train in the URL ("#train:<number>", or just the number), when the page was opened with one */
function getTrainFromHash(): SelectedTrainData | null {
  const hash = globalThis.location.hash.slice(1);
  if (!hash || hash.startsWith(STATION_HASH_PREFIX)) {
    return null;
  }

  const trainHash = hash.startsWith(TRAIN_HASH_PREFIX) ? hash.slice(TRAIN_HASH_PREFIX.length) : hash;
  const trainNo = decodeURIComponent(trainHash);

  return trainNo ? { trainNo, follow: true, paused: false } : null;
}

const SelectedTrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTrain, setSelectedTrain] = useState<SelectedTrainData | null>(getTrainFromHash);

  const setSelectedTrainCb = useCallback(
    (value: SelectedTrainData | null) => {
      setSelectedTrain(value);
      if (value) {
        globalThis.location.assign(`#${TRAIN_HASH_PREFIX}${value.trainNo}`);
      } else {
        globalThis.location.assign("#");
      }
    },
    [setSelectedTrain],
  );

  const value = useMemo(
    () => ({ selectedTrain, setSelectedTrain: setSelectedTrainCb }),
    [selectedTrain, setSelectedTrainCb],
  );

  return <SelectedTrainContext.Provider value={value}>{children}</SelectedTrainContext.Provider>;
};

export default SelectedTrainProvider;
