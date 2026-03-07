import { useCallback, useEffect, useMemo, useState } from "react";

import SelectedStationTimetableContext from "../utils/selected-station-timetable-context";

const STATION_HASH_PREFIX = "station:";

const SelectedStationTimetableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedStationTimetable, setSelectedStationTimetable] = useState<string | null>(null);

  const setSelectedStationTimetableCb = useCallback(
    (value: string | null) => {
      setSelectedStationTimetable(value);

      if (value) {
        globalThis.location.hash = `#${STATION_HASH_PREFIX}${encodeURIComponent(value)}`;
        return;
      }

      const currentHash = globalThis.location.hash.slice(1);
      if (currentHash.startsWith(STATION_HASH_PREFIX)) {
        globalThis.location.hash = "";
      }
    },
    [setSelectedStationTimetable],
  );

  useEffect(() => {
    const hash = globalThis.location.hash.slice(1);
    if (!hash.startsWith(STATION_HASH_PREFIX)) {
      return;
    }

    const stationName = decodeURIComponent(hash.slice(STATION_HASH_PREFIX.length));
    if (stationName) {
      setSelectedStationTimetable(stationName);
    }
  }, []);

  const value = useMemo(
    () => ({ selectedStationTimetable, setSelectedStationTimetable: setSelectedStationTimetableCb }),
    [selectedStationTimetable, setSelectedStationTimetableCb],
  );

  return <SelectedStationTimetableContext.Provider value={value}>{children}</SelectedStationTimetableContext.Provider>;
};

export default SelectedStationTimetableProvider;
