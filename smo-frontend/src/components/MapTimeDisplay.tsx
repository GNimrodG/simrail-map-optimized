import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useEffect, useState } from "react";

import { timezoneSubj$ } from "../utils/data-manager";
import { timeSubj$ } from "../utils/time";
import useBehaviorSubj from "../utils/useBehaviorSubj";

export interface TimeDisplayProps {
  time: number;
}

// I have no idea why...
const CORRECTION = 2 * 60 * 60 * 1000;

const MapTimeDisplay: FunctionComponent<TimeDisplayProps> = ({ time }) => {
  const [currentTime, setCurrentTime] = useState<number>(time);
  const timezone = useBehaviorSubj(timezoneSubj$);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime((currentTime) => {
        timeSubj$.next(currentTime + 1000);
        return currentTime + 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const diff = Math.abs(time - currentTime);

    if (diff < 1000) return;

    timeSubj$.next(time - CORRECTION);
    setCurrentTime(time - CORRECTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  return (
    <Typography
      variant="outlined"
      textAlign="center"
      level="h4"
      fontFamily="monospace"
      sx={{
        verticalAlign: "middle",
        borderRadius: "var(--joy-radius-sm)",
        backgroundColor: "var(--joy-palette-background-surface)",
        boxShadow:
          "var(--joy-shadowRing, 0 0 #000),0px 1px 2px 0px rgba(var(--joy-shadowChannel, 21 21 21) / var(--joy-shadowOpacity, 0.08))",
      }}>
      {new Date(currentTime).toLocaleTimeString()}{" "}
      <Typography level="body-md">
        (UTC{timezone >= 0 ? "+" : ""}
        {timezone})
      </Typography>
    </Typography>
  );
};

export default MapTimeDisplay;
