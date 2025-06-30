import { useEffect, useState } from "react";

import { dataProvider } from "../utils/data-manager";
import { Timetable } from "../utils/types";

export function useTrainTimetable(trainNo: string) {
  const [timetable, setTimetable] = useState<Timetable | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    dataProvider
      .fetchTimetable(trainNo)
      .then((data) => {
        if (!abortController.signal.aborted) setTimetable(data);
      })
      .catch((e) => {
        console.error("Failed to fetch timetable: ", e);
      });

    return () => {
      abortController.abort();
    };
  }, [trainNo]);

  return timetable;
}
