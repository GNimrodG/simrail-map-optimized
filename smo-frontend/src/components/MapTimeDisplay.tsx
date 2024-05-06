import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useEffect, useState } from "react";

export interface TimeDisplayProps {
  time: number;
}

const MapTimeDisplay: FunctionComponent<TimeDisplayProps> = ({ time }) => {
  const [currentTime, setCurrentTime] = useState<number>(time);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime((currentTime) => currentTime + 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTime]);

  useEffect(() => {
    const diff = Math.abs(time - currentTime);

    if (diff < 1000) return;

    setCurrentTime(time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  return (
    <Typography
      variant="outlined"
      textAlign="center"
      level="h4"
      sx={{
        verticalAlign: "middle",
        borderRadius: "var(--joy-radius-sm)",
        backgroundColor: "var(--joy-palette-background-surface)",
        boxShadow:
          "var(--joy-shadowRing, 0 0 #000),0px 1px 2px 0px rgba(var(--joy-shadowChannel, 21 21 21) / var(--joy-shadowOpacity, 0.08))",
      }}>
      {new Date(currentTime).toLocaleTimeString()}
    </Typography>
  );
};

export default MapTimeDisplay;
