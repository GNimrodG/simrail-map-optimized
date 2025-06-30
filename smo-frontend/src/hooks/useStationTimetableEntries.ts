import { useEffect, useState } from "react";

import { dataProvider } from "../utils/data-manager";
import { SimplifiedTimtableEntry } from "../utils/types";

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
