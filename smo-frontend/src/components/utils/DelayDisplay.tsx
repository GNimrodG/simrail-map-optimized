import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import moment from "moment";
import { type FunctionComponent, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";

import TimeDisplay from "./TimeDisplay";

export interface DelayDisplayProps {
  scheduledDeparture?: string | null;
  delay: number | null | undefined;
  translationKey?: string;
  alwaysShowTime?: boolean;
}

function getDelayedDeparture(departureTime: string | null | undefined, delay: number) {
  if (!departureTime || delay === null) {
    return null;
  }

  const originalDeparture = new Date(departureTime);

  return originalDeparture.getTime() + Math.round(delay / 60) * 60 * 1000;
}

const DelayDisplay: FunctionComponent<DelayDisplayProps> = ({
  scheduledDeparture,
  delay,
  translationKey = "StationDisplay",
  alwaysShowTime = false,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: translationKey });

  const actualDeparture = useMemo(
    () => (typeof delay === "number" && getDelayedDeparture(scheduledDeparture, delay)) || null,
    [scheduledDeparture, delay],
  );

  const delayMinutes = typeof delay === "number" ? Math.round(delay / 60) : 0;
  const delayColor = delayMinutes <= 0 ? "success" : delayMinutes < 6 ? "warning" : "danger";
  const normalizedDelayMinutes = Math.abs(delayMinutes);

  return (
    typeof delay === "number" && (
      <>
        {!!actualDeparture && (alwaysShowTime || normalizedDelayMinutes >= 1) && (
          <Typography level="body-sm" color={delayColor}>
            <TimeDisplay time={actualDeparture} noSeconds />
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
    )
  );
};

export default memo(DelayDisplay);
