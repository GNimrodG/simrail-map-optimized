import { useEffect, useState } from "react";

import { dataProvider } from "./data-manager";
import { SimplifiedTimtableEntry } from "./types";

const useStationTimetableEntries = (stationName: string) => {
  const [stationTimetable, setStationTimetable] = useState<SimplifiedTimtableEntry[] | null>(null);

  useEffect(() => {
    dataProvider.getStationTimetable(stationName).then((entries) => {
      setStationTimetable(entries);
    });

    return () => {
      setStationTimetable(null);
    };
  }, [stationName]);

  return stationTimetable;
};

export default useStationTimetableEntries;
