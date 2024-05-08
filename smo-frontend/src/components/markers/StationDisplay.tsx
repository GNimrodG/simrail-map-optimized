import Typography from "@mui/joy/Typography";
import moment from "moment";
import { type FunctionComponent, useMemo, useState } from "react";

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
  const [timeUntil, setTimeUntil] = useState<number | null>(null);

  const stationName = useMemo(
    () => `${station.nameOfPoint} (${STOP_TYPE_MAP[station.stopType] ?? station.stopType})`,
    [station.nameOfPoint, station.stopType]
  );

  useObservable(timeSubj$, (time) => {
    if (!isPastStation) {
      setTimeUntil(moment(time).diff(moment(station.arrivalTime), "m"));
    } else {
      setTimeUntil(null);
    }
  });

  return (
    <>
      <Typography level={mainStation ? "body-md" : "body-sm"}>{stationName}</Typography>
      <Typography level={mainStation ? "body-sm" : "body-xs"}>
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
        {timeUntil !== null && (
          <>
            {" "}
            <Typography
              variant="outlined"
              level="body-xs"
              color={!timeUntil ? "neutral" : timeUntil < 0 ? "success" : "warning"}>
              {timeUntil}'
            </Typography>
          </>
        )}
      </Typography>
    </>
  );
};

export default StationDisplay;
