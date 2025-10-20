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
  isPredicted?: boolean;
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
  isPredicted = false,
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
          <Typography
            level={isPredicted ? "body-xs" : "body-sm"}
            color={delayColor}
            sx={{ opacity: isPredicted ? 0.6 : 1 }}>
            <TimeDisplay time={actualDeparture} noSeconds />
          </Typography>
        )}{" "}
        <Tooltip
          arrow
          color={delayColor}
          title={
            isPredicted
              ? t(
                  normalizedDelayMinutes === 0
                    ? "Predicted.OnTime"
                    : delayMinutes < 0
                      ? "Predicted.Early"
                      : "Predicted.Delay",
                  {
                    delay: moment.duration({ m: normalizedDelayMinutes }).humanize(),
                  },
                )
              : t(normalizedDelayMinutes === 0 ? "OnTime" : delayMinutes < 0 ? "Early" : "Delay", {
                  delay: moment.duration({ m: normalizedDelayMinutes }).humanize(),
                })
          }>
          <Typography variant={isPredicted ? "soft" : "outlined"} level="body-xs" color={delayColor}>
            {delayMinutes > 0 ? "+" : ""}
            {delayMinutes}'
          </Typography>
        </Tooltip>
      </>
    )
  );
};

export default memo(DelayDisplay);
