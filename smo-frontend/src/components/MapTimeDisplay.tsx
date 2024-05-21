import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useEffect, useState } from "react";

import { timeData$ } from "../utils/data-manager";
import { timeSubj$ } from "../utils/time";
import useBehaviorSubj from "../utils/useBehaviorSubj";

// I have no idea why...
const CORRECTION = 2 * 60 * 60 * 1000;

const MapTimeDisplay: FunctionComponent = () => {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const timeData = useBehaviorSubj(timeData$);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime((currentTime) => {
        timeSubj$.next(currentTime + 1000);
        return currentTime + 1000;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (timeData?.time) {
      timeSubj$.next(timeData.time - CORRECTION);
      setCurrentTime(timeData.time - CORRECTION);
    }
  }, [timeData?.time]);

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
        marginInline: 0,
        boxShadow:
          "var(--joy-shadowRing, 0 0 #000),0px 1px 2px 0px rgba(var(--joy-shadowChannel, 21 21 21) / var(--joy-shadowOpacity, 0.08))",
      }}>
      {new Date(currentTime).toLocaleTimeString()}{" "}
      {timeData && (
        <Typography level="body-md">
          (UTC{timeData.timezone >= 0 ? "+" : ""}
          {timeData.timezone.toString().padStart(2, "0")})
        </Typography>
      )}
    </Typography>
  );
};

export default MapTimeDisplay;
