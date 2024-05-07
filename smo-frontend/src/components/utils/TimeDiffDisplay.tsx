import moment from "moment";
import { type FunctionComponent, useMemo } from "react";

export interface TimeDiffDisplayProps {
  start: string | number;
  end: string | number;
}

const TimeDiffDisplay: FunctionComponent<TimeDiffDisplayProps> = ({ start, end }) => {
  const timeDiff = useMemo(() => {
    const startDate = moment(start);
    const endDate = moment(end);

    return endDate.diff(startDate, "minutes");
  }, [start, end]);

  return `${timeDiff}'`;
};

export default TimeDiffDisplay;
