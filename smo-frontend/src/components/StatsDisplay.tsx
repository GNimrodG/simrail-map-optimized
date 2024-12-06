import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { t } from "i18next";
import { type FunctionComponent } from "react";

import { stationsData$, trainsData$ } from "../utils/data-manager";
import useBehaviorSubj from "../utils/useBehaviorSubj";

const StatsDisplay: FunctionComponent = () => {
  const trains = useBehaviorSubj(trainsData$);
  const stations = useBehaviorSubj(stationsData$);

  const driveableTrains = trains.filter((x) => !x.TrainData.InBorderStationArea).length;
  const playerTrains = trains.filter((x) => !!x.TrainData.ControlledBySteamID).length;
  const playerStations = stations.filter((x) => !!x.DispatchedBy?.[0]?.SteamId).length;

  return (
    <Tooltip
      variant="outlined"
      title={
        <Typography>
          {t("Stats.Tooltip.Trains", { player: playerTrains, total: driveableTrains })}
          <br />
          {t("Stats.Tooltip.Stations", { player: playerStations, total: stations.length })}
        </Typography>
      }
    >
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
        {t("Stats.Trains", { player: playerTrains, total: driveableTrains })}
        {" | "}
        {t("Stats.Stations", { player: playerStations, total: stations.length })}
      </Typography>
    </Tooltip>
  );
};

export default StatsDisplay;
