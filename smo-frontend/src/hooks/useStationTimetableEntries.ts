import { useCallback, useEffect, useMemo, useState } from "react";

import UnplayableStations from "../assets/unplayable-stations.json";
import { dataProvider } from "../utils/data-manager";
import { SimplifiedTimtableEntry } from "../utils/types";

const useStationTimetableEntries = (mainStation: string) => {
  const [stationTimetable, setStationTimetable] = useState<SimplifiedTimtableEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const subStations = useMemo(() => {
    return UnplayableStations.find((station) => station.Name === mainStation)?.SubStations || [];
  }, [mainStation]);

  const ignoredStations = useMemo(() => {
    return UnplayableStations.find((station) => station.Name === mainStation)?.IgnoredStations || [];
  }, [mainStation]);

  const stationNames = useMemo(
    () => [mainStation, ...subStations, ...ignoredStations],
    [mainStation, subStations, ignoredStations],
  );

  const processStationEntries = useCallback(
    (mainStationEntries: SimplifiedTimtableEntry[], subStationEntriesArrays: (SimplifiedTimtableEntry[] | null)[]) => {
      // Create a copy to avoid mutating the original data
      const processedEntries = [...mainStationEntries];

      const validSubStationEntries = subStationEntriesArrays.filter(Boolean).flat() as SimplifiedTimtableEntry[];

      if (validSubStationEntries.length === 0) return processedEntries;

      const mainStationMap = new Map<string, SimplifiedTimtableEntry>();
      for (const entry of processedEntries) {
        mainStationMap.set(entry.trainNoLocal, entry);
      }

      validSubStationEntries.sort((a, b) => a.trainNoLocal.localeCompare(b.trainNoLocal) || b.index - a.index);

      for (const subStationEntry of validSubStationEntries) {
        const mainStationEntry = mainStationMap.get(subStationEntry.trainNoLocal);

        if (!mainStationEntry) {
          // Add as new entry with note
          const newEntry = { ...subStationEntry, note: subStationEntry.stationName };
          processedEntries.push(newEntry);
          mainStationMap.set(newEntry.trainNoLocal, newEntry);
          continue;
        }

        // Initialize subStationEntries if needed
        mainStationEntry.subStationEntries ||= [];
        mainStationEntry.subStationEntries.push(subStationEntry);
      }

      for (const mainStationEntry of processedEntries) {
        if (!mainStationEntry.subStationEntries?.length) continue;

        mainStationEntry.subStationEntries.sort((a, b) => a.index - b.index);

        // Separate previous and next entries
        const prevStations: string[] = [];
        const nextStations: string[] = [];

        for (const subEntry of mainStationEntry.subStationEntries) {
          if (subEntry.index < mainStationEntry.index && subEntry.previousStation) {
            prevStations.push(subEntry.previousStation);
          } else if (subEntry.index > mainStationEntry.index && subEntry.nextStation) {
            nextStations.push(subEntry.nextStation);
          }
        }

        // Update station connections
        if (prevStations.length > 0) {
          const existingPrev = mainStationEntry.previousStation || "";
          const uniquePrev = [...new Set([existingPrev, ...prevStations])];

          let filteredPrev = uniquePrev.filter(
            // filter out stopping points
            (x) => !!x && !ignoredStations.includes(x) && UnplayableStations.some((station) => station.Name === x),
          );

          if (filteredPrev.length === 0) {
            filteredPrev = uniquePrev.filter((x) => !!x && !ignoredStations.includes(x));
          }

          mainStationEntry.previousStation = filteredPrev.join(",\n");
        }

        if (nextStations.length > 0) {
          const existingNext = mainStationEntry.nextStation || "";
          const uniqueNext = [...new Set([existingNext, ...nextStations])];

          let filteredNext = uniqueNext.filter(
            // filter out stopping points
            (x) => !!x && !ignoredStations.includes(x) && UnplayableStations.some((station) => station.Name === x),
          );

          if (filteredNext.length === 0) {
            filteredNext = uniqueNext.filter((x) => !!x && !ignoredStations.includes(x));
          }

          mainStationEntry.nextStation = filteredNext.join(",\n");
        }

        // Remove subStationEntries if they are ignored
        mainStationEntry.subStationEntries = mainStationEntry.subStationEntries.filter(
          (subEntry) => !ignoredStations.includes(subEntry.stationName),
        );
      }

      return processedEntries;
    },
    [ignoredStations],
  );

  useEffect(() => {
    if (!mainStation) {
      setStationTimetable(null);
      return;
    }

    const abortController = new AbortController();
    setLoading(true);

    const fetchTimetableData = async () => {
      try {
        const promises = stationNames.map((name) =>
          dataProvider.getStationTimetable(name).catch((err) => {
            console.warn(`Failed to fetch timetable for station ${name}:`, err);
            return null;
          }),
        );

        const results = await Promise.all(promises);

        if (abortController.signal.aborted) return;

        const [mainStationEntries, ...subStationEntriesArrays] = results;

        if (!mainStationEntries) {
          console.warn(`Main station ${mainStation} not found in timetable entries.`);
          setStationTimetable(null);
          return;
        }

        const processedEntries = processStationEntries(mainStationEntries, subStationEntriesArrays);
        setStationTimetable(processedEntries);
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch station timetable data:", err);
          setStationTimetable(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchTimetableData();

    return () => {
      abortController.abort();
    };
  }, [mainStation, stationNames, processStationEntries]);

  return {
    stationTimetable,
    loading,
  };
};

export default useStationTimetableEntries;
