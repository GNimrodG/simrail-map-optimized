import { useMediaQuery } from "@mantine/hooks";
import { useTheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import equals from "lodash/isEqual";
import moment from "moment";
import { type FunctionComponent, memo, ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EMPTY, filter } from "rxjs";

import useSubject from "../../../hooks/useSubject";
import { timeSubj$ } from "../../../utils/time";
import { TimetableEntry } from "../../../utils/types";
import DelayDisplay from "../../utils/DelayDisplay";
import StopTypeDisplay from "../../utils/StopTypeDisplay";
import TimeDiffDisplay from "../../utils/TimeDiffDisplay";
import TimeDisplay from "../../utils/TimeDisplay";
import SpeedIcon from "../icons/SpeedIcon";
import { TFunction } from "i18next";

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
   * Whether the delay is predicted (based on last known delay) rather than actual.
   */
  predictedDelay?: boolean;
  /**
   * Set the station name to green.
   */
  current?: boolean;
  /**
   * Whether to hide the time until arrival.
   */
  hideTimeUntil?: boolean;
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
  predictedDelay,
  current,
  hideTimeUntil,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "StationDisplay" });
  const theme = useTheme();
  const isSmallHeight = useMediaQuery(`(max-height: ${theme.breakpoints.values.md}px)`) || false;
  const timeUntil = useSubject(hideTimeUntil ? EMPTY : filteredTimeSubj$, null, (time) => {
    if (hideTimeUntil) return null;

    if (!pastStation) {
      const arrivalTime = moment(station.ArrivalTime || station.DepartureTime);
      arrivalTime.set("year", moment(time).year());
      arrivalTime.set("month", moment(time).month());
      arrivalTime.set("date", moment(time).date());
      return moment(time).diff(arrivalTime, "m") || null;
    }

    return null;
  });

  const shouldCollapse =
    (isSmallHeight &&
      !!station.ArrivalTime &&
      (!station.DepartureTime || station.DepartureTime === station.ArrivalTime)) ||
    (!!station.DepartureTime && (!station.ArrivalTime || station.DepartureTime === station.ArrivalTime));

  const timeColor = useMemo(() => {
    if (timeUntil == null || timeUntil === 0) return "neutral"; // on time
    if (timeUntil < 0) return "success"; // early
    if (timeUntil > 15) return "danger"; // 15+ minutes late
    return "warning"; // slight delay (1-15 minutes)
  }, [timeUntil]);

  const timeText = useMemo(() => {
    if (timeUntil == null || timeUntil === 0) return t("ShouldArrive.Now");
    if (timeUntil < 0) return t("ShouldArrive.Future", { time: moment.duration({ m: -timeUntil }).humanize(true) });
    return t("ShouldArrive.Past", { time: moment.duration({ m: -timeUntil }).humanize(true) });
  }, [timeUntil, t]);

  const delayDisplay = useMemo(
    () =>
      typeof delay === "number" ? (
        <DelayDisplay delay={delay} scheduledDeparture={station.DepartureTime} isPredicted={predictedDelay} />
      ) : null,
    [delay, station.DepartureTime, predictedDelay],
  );

  const timeUntilDisplay = useMemo(
    () =>
      timeUntil === null || delayDisplay ? null : (
        <>
          {" "}
          <Tooltip arrow title={timeText} color={timeColor}>
            <Typography variant="outlined" level="body-xs" color={timeColor}>
              {timeUntil || 0}'
            </Typography>
          </Tooltip>
        </>
      ),
    [delayDisplay, timeText, timeColor, timeUntil],
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
        t={t}
      />
      {!shouldCollapse && (
        <StationTimes
          station={station}
          mainStation={mainStation}
          isSmallHeight={isSmallHeight}
          delayDisplay={delayDisplay}
          timeUntilDisplay={timeUntilDisplay}
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
  t: TFunction<"translation", "StationDisplay">;
}> = ({ station, mainStation, current, shouldCollapse, delayDisplay, timeUntilDisplay, t }) => (
  <Typography
    level={mainStation ? "body-md" : "body-sm"}
    color={current ? "success" : undefined}
    sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
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
    {station.MaxSpeed > 0 && (
      <>
        {" "}
        <Tooltip arrow title={t("MaxSpeed")}>
          <Typography
            level="body-xs"
            variant="outlined"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
            <SpeedIcon />
            {station.MaxSpeed}
          </Typography>
        </Tooltip>
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
        {timeUntilDisplay}
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
}> = ({ station, mainStation, isSmallHeight, delayDisplay, timeUntilDisplay }) => (
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
    {timeUntilDisplay}
  </Typography>
);

export default memo(StationDisplay, equals);
