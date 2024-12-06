import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { timeData$ } from "../utils/data-manager";
import { timeSubj$ } from "../utils/time";
import useBehaviorSubj from "../utils/useBehaviorSubj";

const MapTimeDisplay: FunctionComponent = () => {
  const currentTime = useBehaviorSubj(timeSubj$);
  const timeData = useBehaviorSubj(timeData$);

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
      }}
    >
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
