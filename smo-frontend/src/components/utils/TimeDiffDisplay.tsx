import moment from "moment";
import { type FunctionComponent, useMemo } from "react";

export interface TimeDiffDisplayProps {
  start: string | number;
  end: string | number;
}

const TimeDiffDisplay: FunctionComponent<TimeDiffDisplayProps> = ({ start, end }) => {
  const timeDiffMins = useMemo(() => {
    const startDate = moment(start);
    const endDate = moment(end);

    return endDate.diff(startDate, "minutes");
  }, [start, end]);

  const timeDiffSecs = useMemo(() => {
    if (timeDiffMins > 0) {
      return null;
    }

    const startDate = moment(start);
    const endDate = moment(end);

    return endDate.diff(startDate, "seconds");
  }, [timeDiffMins, start, end]);

  return timeDiffMins ? `${timeDiffMins}'` : `${timeDiffSecs}"`;
};

export default TimeDiffDisplay;
