import Alert from "@mui/joy/Alert";
import IconButton from "@mui/joy/IconButton";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState } from "react";
import { useTranslation } from "react-i18next";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { useNow, useServerRestarts } from "../hooks/useServerRestarts";
import { useSetting } from "../hooks/useSetting";
import { dataProvider } from "../utils/data-manager";
import XMarkIcon from "./icons/xmark-solid.svg?react";

// The warning shows up this long before the predicted restart
const WARNING_BEFORE_MINUTES = 30;

/**
 * A small, dismissible warning shortly before the selected server's predicted restart.
 */
const ServerRestartWarning: FunctionComponent = () => {
  const { t } = useTranslation();
  const [disableServerRestartWarning] = useSetting("disableServerRestartWarning");
  const selectedServer = useBehaviorSubj(dataProvider.selectedServerData$);
  const nextRestarts = useServerRestarts();
  const now = useNow(15_000);
  // the restart (its predicted time) the user closed the warning for, the next restart warns again
  const [dismissedRestart, setDismissedRestart] = useState<number | null>(null);

  const nextRestart = selectedServer?.IsActive ? nextRestarts.get(selectedServer.ServerCode) : undefined;

  if (
    disableServerRestartWarning ||
    !nextRestart ||
    nextRestart.valueOf() - now > WARNING_BEFORE_MINUTES * 60_000 ||
    dismissedRestart === nextRestart.valueOf()
  )
    return null;

  return (
    <Tooltip title={t("ServerRestartWarning.Tooltip")} arrow placement="left">
      <Alert
        size="sm"
        variant="soft"
        color="warning"
        endDecorator={
          <IconButton
            variant="plain"
            size="sm"
            color="warning"
            aria-label={t("ServerRestartWarning.Dismiss")}
            onClick={() => setDismissedRestart(nextRestart.valueOf())}
            sx={{ "--IconButton-size": "1.5rem", "& svg": { width: "0.75rem", height: "0.75rem" } }}>
            <XMarkIcon />
          </IconButton>
        }
        sx={{ py: 0.5, pr: 0.5, maxWidth: "min(90vw, 320px)" }}>
        <Typography level="body-sm" translate="no">
          {nextRestart.valueOf() <= now
            ? t("ServerRestartWarning.Due", { time: nextRestart.format("LT") })
            : t("ServerRestartWarning.Soon", { time: nextRestart.format("LT"), relative: nextRestart.fromNow() })}
        </Typography>
      </Alert>
    </Tooltip>
  );
};

export default ServerRestartWarning;
