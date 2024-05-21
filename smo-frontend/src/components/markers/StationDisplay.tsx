import { useMediaQuery } from "@mantine/hooks";
import { useTheme } from "@mui/joy/styles";
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

const STOP_TYPE_FRIENDLY: Partial<Record<TimetableEntry["stopType"], string>> = {
  CommercialStop: "Commercial Stop", // PH
  NoncommercialStop: "Non-Commercial Stop", // PT
};

const STOP_TYPE_TECHNICAL: Partial<Record<TimetableEntry["stopType"], string>> = {
  CommercialStop: "PH",
  NoncommercialStop: "PT",
};

const StationDisplay: FunctionComponent<StationDisplayProps> = ({
  station,
  mainStation,
  pastStation: isPastStation,
}) => {
  const theme = useTheme();
  const isSmallHeight = useMediaQuery(`(max-height: ${theme.breakpoints.values.md}px)`);
  const [timeUntil, setTimeUntil] = useState<number | null>(null);

  useObservable(timeSubj$, (time) => {
    if (!isPastStation) {
      setTimeUntil(moment(time).diff(moment(station.arrivalTime), "m"));
    } else {
      setTimeUntil(null);
    }
  });

  const shouldCollapse =
    (isSmallHeight &&
      !!station.arrivalTime &&
      (!station.departureTime || station.departureTime === station.arrivalTime)) ||
    (!!station.departureTime &&
      (!station.arrivalTime || station.departureTime === station.arrivalTime));

  return (
    <>
      <Typography level={mainStation ? "body-md" : "body-sm"}>
        {station.nameOfPoint}
        {STOP_TYPE_TECHNICAL[station.stopType] && (
          <>
            {" "}
            <Typography
              variant="outlined"
              level="body-sm">
              {STOP_TYPE_TECHNICAL[station.stopType]}
            </Typography>
          </>
        )}
        {shouldCollapse && (
          <>
            {" "}
            <Typography level="body-sm">
              <TimeDisplay
                time={station.arrivalTime!}
                noSeconds
              />
            </Typography>
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
          </>
        )}
      </Typography>
      <Typography level={mainStation ? "body-sm" : "body-xs"}>
        {!shouldCollapse && station.arrivalTime && (
          <TimeDisplay
            time={station.arrivalTime}
            noSeconds={isSmallHeight}
          />
        )}
        {!shouldCollapse &&
          station.departureTime &&
          station.departureTime !== station.arrivalTime && (
            <>
              {station.arrivalTime && " - "}
              <TimeDisplay
                time={station.departureTime}
                noSeconds={isSmallHeight}
              />
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
        {!shouldCollapse && timeUntil !== null && (
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
        {!shouldCollapse && (
          <>
            {" "}
            <Typography
              level="body-xs"
              textOverflow="clip">
              {STOP_TYPE_FRIENDLY[station.stopType]}
            </Typography>
          </>
        )}
      </Typography>
    </>
  );
};

export default StationDisplay;
