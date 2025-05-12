import { type FunctionComponent, memo, useMemo } from "react";

export interface TimeDisplayProps {
  time: string | number;
  noSeconds?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

const noSecondsFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "numeric",
});

const TimeDisplay: FunctionComponent<TimeDisplayProps> = ({ time, noSeconds }) => {
  const timeString = useMemo(
    () => (noSeconds ? noSecondsFormatter : dateFormatter).format(new Date(time)),
    [time, noSeconds],
  );

  return timeString;
};

export default memo(TimeDisplay);
