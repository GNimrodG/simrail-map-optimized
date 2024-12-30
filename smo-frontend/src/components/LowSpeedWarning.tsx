import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState } from "react";
import { useTranslation } from "react-i18next";

import { trainsAvgSpeed$ } from "../utils/data-manager";
import useObservable from "../utils/use-observable";
import { useSetting } from "../utils/use-setting";
import InfoIcon from "./icons/InfoIcon";
import WarningIcon from "./icons/WarningIcon";

const LOW_SPEED_THRESHOLD = 40;

const LowSpeedWarning: FunctionComponent = () => {
  const { t } = useTranslation();
  const [disableLowSpeedWarning] = useSetting("disableLowSpeedWarning");
  const [trainsAvgSpeed, setTrainsAvgSpeed] = useState<number | null>(null);

  useObservable(trainsAvgSpeed$, setTrainsAvgSpeed);

  if (disableLowSpeedWarning || trainsAvgSpeed === null || trainsAvgSpeed > LOW_SPEED_THRESHOLD) return null;

  return (
    <Stack sx={{ position: "fixed", top: 0, left: 0, right: 0, pt: 1, mr: 8, zIndex: 1000 }} alignItems="end">
      <Alert
        variant="soft"
        color="warning"
        invertedColors
        startDecorator={
          <Box sx={{ width: "3rem", height: "4rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <WarningIcon width="2rem" height="2rem" />
          </Box>
        }
        sx={{ alignItems: "flex-start", gap: "1rem", width: "min(90vw, 400px)" }}>
        <Box sx={{ flex: 1 }}>
          <Typography level="title-md">
            {t("LowSpeedWarning.Title")}{" "}
            <Tooltip title={t("LowSpeedWarning.Tooltip")} arrow placement="left">
              <Stack
                sx={{
                  position: "absolute",
                  right: (theme) => theme.spacing(1),
                  top: (theme) => theme.spacing(1),
                  color: "neutral.200",
                }}
                alignItems="center"
                justifyContent="center">
                <InfoIcon />
              </Stack>
            </Tooltip>
          </Typography>
          <Typography level="body-md">
            {t("LowSpeedWarning.Description", { speed: trainsAvgSpeed.toFixed(0) })}
          </Typography>
        </Box>
      </Alert>
    </Stack>
  );
};

export default LowSpeedWarning;
