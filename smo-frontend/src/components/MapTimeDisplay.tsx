import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { dataProvider } from "../utils/data-manager";
import { timeSubj$ } from "../utils/time";

const MapTimeDisplay: FunctionComponent = () => {
  const currentTime = useBehaviorSubj(timeSubj$);
  const timeData = useBehaviorSubj(dataProvider.timeData$);

  const timezone = timeData?.Timezone ?? 0;

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
      <Typography level="body-lg" fontFamily="monospace">
        (UTC{timezone >= 0 ? "+" : "-"}
        {Math.abs(timezone).toString().padStart(2, "0")})
      </Typography>
    </Typography>
  );
};

export default MapTimeDisplay;
