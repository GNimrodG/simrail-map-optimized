import { useMediaQuery } from "@mantine/hooks";
import { ColorPaletteProp, useTheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { TFunction } from "i18next";
import equals from "lodash/isEqual";
import moment from "moment";
import { type FunctionComponent, memo, ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { filter } from "rxjs";

import { TimetableEntry } from "../../utils/data-manager";
import { timeSubj$ } from "../../utils/time";
import useSubject from "../../utils/use-subject";
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

const STOP_TYPE_TECHNICAL: Partial<Record<TimetableEntry["stopType"], string>> = {
  CommercialStop: "PH",
  NoncommercialStop: "PT",
};

const STOP_TYPE_COLOR: Partial<Record<TimetableEntry["stopType"], ColorPaletteProp>> = {
  CommercialStop: "primary",
  NoncommercialStop: "neutral",
};

function getDelayedDeparture(station: TimetableEntry, delay: number) {
  if (!station.departureTime || delay === null) {
    return null;
  }

  const originalDeparture = new Date(station.departureTime);

  return originalDeparture.getTime() + Math.round(delay / 60) * 60 * 1000;
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
      const arrivalTime = moment(station.arrivalTime);
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
      !!station.arrivalTime &&
      (!station.departureTime || station.departureTime === station.arrivalTime)) ||
    (!!station.departureTime && (!station.arrivalTime || station.departureTime === station.arrivalTime));

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

  const delayedDeparture = useMemo(
    () => (typeof delay === "number" && getDelayedDeparture(station, delay)) || null,
    [station, delay],
  );

  const delayMinutes = typeof delay === "number" ? Math.round(delay / 60) : 0;
  const delayColor = delayMinutes <= 0 ? "success" : delayMinutes < 6 ? "warning" : "danger";
  const normalizedDelayMinutes = Math.abs(delayMinutes);

  const delayDisplay = useMemo(
    () =>
      typeof delay === "number" && (
        <>
          {" "}
          {normalizedDelayMinutes >= 1 && (
            <Typography level="body-sm" color={delayColor}>
              <TimeDisplay time={delayedDeparture!} noSeconds />
            </Typography>
          )}{" "}
          <Tooltip
            arrow
            title={t(normalizedDelayMinutes === 0 ? "OnTime" : delayMinutes < 0 ? "Early" : "Delay", {
              delay: moment.duration({ m: normalizedDelayMinutes }).humanize(),
            })}>
            <Typography variant="outlined" level="body-xs" color={delayColor}>
              {delayMinutes > 0 ? "+" : ""}
              {delayMinutes}'
            </Typography>
          </Tooltip>
        </>
      ),
    [delay, delayedDeparture, delayMinutes, delayColor, t, normalizedDelayMinutes],
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
        t={t}
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
  t: TFunction;
}> = ({ station, mainStation, current, shouldCollapse, delayDisplay, timeUntilDisplay, timeUntil, t }) => (
  <Typography level={mainStation ? "body-md" : "body-sm"} color={current ? "success" : undefined}>
    {station.nameOfPoint}
    {station.track && station.platform && (
      <Typography level={mainStation ? "body-sm" : "body-xs"}>
        {" "}
        {station.track}/{station.platform}
      </Typography>
    )}
    {STOP_TYPE_TECHNICAL[station.stopType] && (
      <>
        {" "}
        <Tooltip arrow title={t(`StopType.${station.stopType}`)}>
          <Typography variant="outlined" level="body-sm" color={STOP_TYPE_COLOR[station.stopType]}>
            {STOP_TYPE_TECHNICAL[station.stopType]}
          </Typography>
        </Tooltip>
      </>
    )}
    {shouldCollapse && (
      <>
        {" "}
        <Typography level="body-sm">
          {station.arrivalTime && <TimeDisplay time={station.arrivalTime} noSeconds />}
        </Typography>
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
    {station.arrivalTime && <TimeDisplay time={station.arrivalTime} noSeconds={isSmallHeight} />}
    {station.departureTime && station.departureTime !== station.arrivalTime && (
      <>
        {station.arrivalTime && " - "}
        <TimeDisplay time={station.departureTime} noSeconds={isSmallHeight} />
        {station.arrivalTime && (
          <>
            {" "}
            <TimeDiffDisplay start={station.arrivalTime} end={station.departureTime} />
          </>
        )}
        {delayDisplay}
      </>
    )}
    {timeUntil !== null && timeUntilDisplay}
  </Typography>
);

export default memo(StationDisplay, equals);
