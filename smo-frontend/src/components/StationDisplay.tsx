import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { TimetableEntry } from "../utils/data-manager";
import TimeDisplay from "./TimeDisplay";

export interface StationDisplayProps {
  station: TimetableEntry;
  mainStation?: boolean;
}

const STOP_TYPE_MAP: Record<TimetableEntry["stopType"], string> = {
  CommercialStop: "Commercial Stop",
  NoStopOver: "Non-Stop",
  NoncommercialStop: "Non-Commercial Stop",
};

const StationDisplay: FunctionComponent<StationDisplayProps> = ({ station, mainStation }) => {
  return (
    <>
      <Typography level={mainStation ? "body-md" : "body-sm"}>
        {station.nameOfPoint} ({STOP_TYPE_MAP[station.stopType] ?? station.stopType})
      </Typography>
      <Typography level={mainStation ? "body-sm" : "body-xs"}>
        {station.arrivalTime && <TimeDisplay time={station.arrivalTime} />}
        {station.departureTime && station.departureTime !== station.arrivalTime && (
          <>
            {station.arrivalTime && " - "}
            <TimeDisplay time={station.departureTime} />
          </>
        )}
      </Typography>
    </>
  );
};

export default StationDisplay;
