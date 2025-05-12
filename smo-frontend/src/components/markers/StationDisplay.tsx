import { useMediaQuery } from "@mantine/hooks";
import { useTheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import equals from "lodash/isEqual";
import moment from "moment";
import { type FunctionComponent, memo, ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { filter } from "rxjs";

import { timeSubj$ } from "../../utils/time";
import { TimetableEntry } from "../../utils/types";
import useSubject from "../../utils/use-subject";
import DelayDisplay from "../utils/DelayDisplay";
import StopTypeDisplay from "../utils/StopTypeDisplay";
import TimeDiffDisplay from "../utils/TimeDiffDisplay";
import TimeDisplay from "../utils/TimeDisplay";

export interface StationDisplayProps {
  /**
   * The timetable entry of the station.
   */
  station: TimetableEntry;
  /**
   * Whether the station is a main station. This is used to determine the font size.
   */
  mainStation?: boolean;
  /**
   * Whether the station is already passed.
   */
  pastStation?: boolean;
  /**
   * The delay in seconds.
   */
  delay?: number;
  /**
   * Set the station name to green.
   */
  current?: boolean;
}

const filteredTimeSubj$ = timeSubj$.pipe(filter((_, index) => index % 30 === 0));

/**
 * Displays a station with arrival, departure time and the delay or the time until arrival.
 */
const StationDisplay: FunctionComponent<StationDisplayProps> = ({
  station,
  mainStation,
  pastStation,
  delay,
  current,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "StationDisplay" });
  const theme = useTheme();
  const isSmallHeight = useMediaQuery(`(max-height: ${theme.breakpoints.values.md}px)`) || false;
  const timeUntil = useSubject(filteredTimeSubj$, null, (time) => {
    if (!pastStation) {
      const arrivalTime = moment(station.ArrivalTime);
      arrivalTime.set("year", moment(time).year());
      arrivalTime.set("month", moment(time).month());
      arrivalTime.set("date", moment(time).date());
      return moment(time).diff(arrivalTime, "m");
    } else {
      return null;
    }
  });

  const shouldCollapse =
    (isSmallHeight &&
      !!station.ArrivalTime &&
      (!station.DepartureTime || station.DepartureTime === station.ArrivalTime)) ||
    (!!station.DepartureTime && (!station.ArrivalTime || station.DepartureTime === station.ArrivalTime));

  const timeColor = !timeUntil ? "neutral" : timeUntil < 0 ? "success" : timeUntil > 15 ? "danger" : "warning";

  const timeUntilDisplay = useMemo(
    () => (
      <>
        {" "}
        <Tooltip
          arrow
          title={
            !timeUntil
              ? t("ShouldArrive.Now")
              : timeUntil < 0
                ? t("ShouldArrive.Future", {
                    time: moment.duration({ m: -timeUntil }).humanize(true),
                  })
                : t("ShouldArrive.Past", {
                    time: moment.duration({ m: -timeUntil }).humanize(true),
                  })
          }
          color={timeColor}>
          <Typography variant="outlined" level="body-xs" color={timeColor}>
            {timeUntil}'
          </Typography>
        </Tooltip>
      </>
    ),
    [timeUntil, timeColor, t],
  );

  const delayDisplay = useMemo(
    () =>
      typeof delay === "number" ? <DelayDisplay delay={delay} scheduledDeparture={station.DepartureTime} /> : null,
    [delay, station.DepartureTime],
  );

  return (
    <>
      <StationHeader
        station={station}
        mainStation={mainStation}
        current={current}
        shouldCollapse={shouldCollapse}
        delayDisplay={delayDisplay}
        timeUntilDisplay={timeUntilDisplay}
        timeUntil={timeUntil}
      />
      {!shouldCollapse && (
        <StationTimes
          station={station}
          mainStation={mainStation}
          isSmallHeight={isSmallHeight}
          delayDisplay={delayDisplay}
          timeUntilDisplay={timeUntilDisplay}
          timeUntil={timeUntil}
        />
      )}
    </>
  );
};

const StationHeader: FunctionComponent<{
  station: TimetableEntry;
  mainStation?: boolean;
  current?: boolean;
  shouldCollapse: boolean;
  delayDisplay: ReactNode;
  timeUntilDisplay: ReactNode;
  timeUntil: number | null;
}> = ({ station, mainStation, current, shouldCollapse, delayDisplay, timeUntilDisplay, timeUntil }) => (
  <Typography level={mainStation ? "body-md" : "body-sm"} color={current ? "success" : undefined}>
    {station.NameOfPoint}
    {station.Track && station.Platform && (
      <Typography level={mainStation ? "body-sm" : "body-xs"}>
        {" "}
        {station.Track}/{station.Platform}
      </Typography>
    )}
    {!!station.StopType && (
      <>
        {" "}
        <StopTypeDisplay stopType={station.StopType} />
      </>
    )}
    {shouldCollapse && (
      <>
        {" "}
        <Typography level="body-sm">
          {station.ArrivalTime && <TimeDisplay time={station.ArrivalTime} noSeconds />}
        </Typography>
        {delayDisplay && " "}
        {delayDisplay}
        {timeUntil !== null && timeUntilDisplay}
      </>
    )}
  </Typography>
);

const StationTimes: FunctionComponent<{
  station: TimetableEntry;
  mainStation?: boolean;
  isSmallHeight: boolean;
  delayDisplay: ReactNode;
  timeUntilDisplay: ReactNode;
  timeUntil: number | null;
}> = ({ station, mainStation, isSmallHeight, delayDisplay, timeUntilDisplay, timeUntil }) => (
  <Typography level={mainStation ? "body-sm" : "body-xs"}>
    {station.ArrivalTime && <TimeDisplay time={station.ArrivalTime} noSeconds={isSmallHeight} />}
    {station.DepartureTime && station.DepartureTime !== station.ArrivalTime && (
      <>
        {station.ArrivalTime && " - "}
        <TimeDisplay time={station.DepartureTime} noSeconds={isSmallHeight} />
        {station.ArrivalTime && (
          <>
            {" "}
            <TimeDiffDisplay start={station.ArrivalTime} end={station.DepartureTime} />
          </>
        )}
        {delayDisplay && " "}
        {delayDisplay}
      </>
    )}
    {timeUntil !== null && timeUntilDisplay}
  </Typography>
);

export default memo(StationDisplay, equals);
