import { useCallback, useMemo, useState } from "react";

import SelectedStationTimetableContext from "../utils/selected-station-timetable-context";

const STATION_HASH_PREFIX = "station:";

/** The station in the URL ("#station:<name>"), when the page was opened with one */
function getStationFromHash(): string | null {
  const hash = globalThis.location.hash.slice(1);
  if (!hash.startsWith(STATION_HASH_PREFIX)) {
    return null;
  }

  return decodeURIComponent(hash.slice(STATION_HASH_PREFIX.length)) || null;
}

const SelectedStationTimetableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedStationTimetable, setSelectedStationTimetable] = useState<string | null>(getStationFromHash);

  const setSelectedStationTimetableCb = useCallback(
    (value: string | null) => {
      setSelectedStationTimetable(value);

      if (value) {
        globalThis.location.assign(`#${STATION_HASH_PREFIX}${encodeURIComponent(value)}`);
        return;
      }

      const currentHash = globalThis.location.hash.slice(1);
      if (currentHash.startsWith(STATION_HASH_PREFIX)) {
        globalThis.location.assign("#");
      }
    },
    [setSelectedStationTimetable],
  );

  const value = useMemo(
    () => ({ selectedStationTimetable, setSelectedStationTimetable: setSelectedStationTimetableCb }),
    [selectedStationTimetable, setSelectedStationTimetableCb],
  );

  return <SelectedStationTimetableContext.Provider value={value}>{children}</SelectedStationTimetableContext.Provider>;
};

export default SelectedStationTimetableProvider;
