import Typography from "@mui/joy/Typography";
import moment from "moment";
import { type FunctionComponent, useState } from "react";

import { TimetableEntry } from "../../utils/data-manager";
import { timeSubj$ } from "../../utils/time";
import useObservable from "../../utils/useObservable";
import TimeDiffDisplay from "../utils/TimeDiffDisplay";
import TimeDisplay from "../utils/TimeDisplay";

export interface StationDisplayProps {
  station: TimetableEntry;
  mainStation?: boolean;
  pastStation?: boolean;
}

const STOP_TYPE_MAP: Record<TimetableEntry["stopType"], string> = {
  CommercialStop: "Commercial Stop",
  NoStopOver: "Non-Stop",
  NoncommercialStop: "Non-Commercial Stop",
};

const StationDisplay: FunctionComponent<StationDisplayProps> = ({
  station,
  mainStation,
  pastStation: isPastStation,
}) => {
  const [isLate, setIsLate] = useState<number | null>(null);

  useObservable(timeSubj$, (time) => {
    if (!isPastStation && station.arrivalTime && new Date(station.arrivalTime).getTime() < time) {
      setIsLate(moment(time).diff(moment(station.arrivalTime), "m"));
    } else {
      setIsLate(null);
    }
  });

  return (
    <>
      <Typography level={mainStation ? "body-md" : "body-sm"}>
        {station.nameOfPoint} ({STOP_TYPE_MAP[station.stopType] ?? station.stopType})
      </Typography>
      <Typography
        level={mainStation ? "body-sm" : "body-xs"}
        color={isLate ? "warning" : "neutral"}>
        {station.arrivalTime && <TimeDisplay time={station.arrivalTime} />}
        {station.departureTime && station.departureTime !== station.arrivalTime && (
          <>
            {station.arrivalTime && " - "}
            <TimeDisplay time={station.departureTime} />
            {station.arrivalTime && (
              <>
                {" "}
                (
                <TimeDiffDisplay
                  start={station.arrivalTime}
                  end={station.departureTime}
                />
                )
              </>
            )}
          </>
        )}
        {isLate && (
          <>
            {" "}
            <Typography
              variant="outlined"
              level="body-xs"
              color="warning">
              min. {isLate}' late
            </Typography>
          </>
        )}
      </Typography>
    </>
  );
};

export default StationDisplay;
