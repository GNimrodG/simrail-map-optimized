import { useMediaQuery } from "@mantine/hooks";
import { ColorPaletteProp, useTheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import moment from "moment";
import { type FunctionComponent, useState } from "react";
import { useTranslation } from "react-i18next";

import { TimetableEntry } from "../../utils/data-manager";
import { timeSubj$ } from "../../utils/time";
import useObservable from "../../utils/use-observable";
import TimeDiffDisplay from "../utils/TimeDiffDisplay";
import TimeDisplay from "../utils/TimeDisplay";

export interface StationDisplayProps {
  station: TimetableEntry;
  mainStation?: boolean;
  pastStation?: boolean;
}

const STOP_TYPE_TECHNICAL: Partial<Record<TimetableEntry["stopType"], string>> = {
  CommercialStop: "PH",
  NoncommercialStop: "PT",
};

const STOP_TYPE_COLOR: Partial<Record<TimetableEntry["stopType"], ColorPaletteProp>> = {
  CommercialStop: "primary",
  NoncommercialStop: "neutral",
};

const StationDisplay: FunctionComponent<StationDisplayProps> = ({ station, mainStation, pastStation }) => {
  const { t } = useTranslation("translation", { keyPrefix: "StationDisplay" });
  const theme = useTheme();
  const isSmallHeight = useMediaQuery(`(max-height: ${theme.breakpoints.values.md}px)`);
  const [timeUntil, setTimeUntil] = useState<number | null>(null);

  useObservable(timeSubj$, (time) => {
    if (!pastStation) {
      setTimeUntil(moment(time).diff(moment(station.arrivalTime), "m"));
    } else {
      setTimeUntil(null);
    }
  });

  const shouldCollapse =
    (isSmallHeight &&
      !!station.arrivalTime &&
      (!station.departureTime || station.departureTime === station.arrivalTime)) ||
    (!!station.departureTime && (!station.arrivalTime || station.departureTime === station.arrivalTime));

  const timeColor = !timeUntil ? "neutral" : timeUntil < 0 ? "success" : timeUntil > 15 ? "danger" : "warning";

  const timeUntilDisplay = (
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
  );

  return (
    <>
      <Typography level={mainStation ? "body-md" : "body-sm"}>
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
              <TimeDisplay time={station.arrivalTime!} noSeconds />
            </Typography>
            {timeUntil !== null && timeUntilDisplay}
          </>
        )}
      </Typography>
      <Typography level={mainStation ? "body-sm" : "body-xs"}>
        {!shouldCollapse && station.arrivalTime && <TimeDisplay time={station.arrivalTime} noSeconds={isSmallHeight} />}
        {!shouldCollapse && station.departureTime && station.departureTime !== station.arrivalTime && (
          <>
            {station.arrivalTime && " - "}
            <TimeDisplay time={station.departureTime} noSeconds={isSmallHeight} />
            {station.arrivalTime && (
              <>
                {" "}
                (
                <TimeDiffDisplay start={station.arrivalTime} end={station.departureTime} />)
              </>
            )}
          </>
        )}
        {!shouldCollapse && timeUntil !== null && timeUntilDisplay}
      </Typography>
    </>
  );
};

export default StationDisplay;
