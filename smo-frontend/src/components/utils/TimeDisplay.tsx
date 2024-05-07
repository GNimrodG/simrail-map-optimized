import { type FunctionComponent, useMemo } from "react";

export interface TimeDisplayProps {
  time: string | number;
}

const TimeDisplay: FunctionComponent<TimeDisplayProps> = ({ time }) => {
  const timeString = useMemo(() => new Date(time).toLocaleTimeString(), [time]);

  return timeString;
};

export default TimeDisplay;
