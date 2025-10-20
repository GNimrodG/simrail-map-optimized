import { useDocumentVisibility, useLocalStorage } from "@mantine/hooks";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useIsDocumentFocused } from "../hooks/useIsDocumentFocused";
import { useSetting } from "../hooks/useSetting";
import InfoIcon from "./icons/InfoIcon";
import XMarkIcon from "./icons/xmark-solid.svg?react";

const NOTIFICATION_SEEN_KEY = "backgroundUpdatesNotificationSeen";

const BackgroundUpdatesNotification: FunctionComponent = () => {
  const { t } = useTranslation();
  const focused = useIsDocumentFocused();
  const visibility = useDocumentVisibility();
  const [reduceBackgroundUpdates, setReduceBackgroundUpdates] = useSetting("reduceBackgroundUpdates");
  const [hasSeenNotification, setHasSeenNotification] = useLocalStorage({
    key: NOTIFICATION_SEEN_KEY,
    defaultValue: false,
  });
  const [showNotification, setShowNotification] = useState(false);
  const [hasBeenUnfocused, setHasBeenUnfocused] = useState(false);

  // Track when the tab becomes unfocused but still visible for the first time
  useEffect(() => {
    if (!focused && !hasBeenUnfocused && reduceBackgroundUpdates && visibility === "visible") {
      setHasBeenUnfocused(true);
    }
  }, [focused, hasBeenUnfocused, reduceBackgroundUpdates, visibility]);

  // Show notification when tab regains focus after being unfocused
  useEffect(() => {
    if (hasBeenUnfocused && !hasSeenNotification && reduceBackgroundUpdates && !showNotification) {
      setShowNotification(true);
    }
  }, [focused, hasBeenUnfocused, hasSeenNotification, reduceBackgroundUpdates, showNotification]);

  const handleDismiss = () => {
    setShowNotification(false);
    setHasSeenNotification(true);
  };

  const handleDisableFeature = () => {
    setReduceBackgroundUpdates(false);
    handleDismiss();
  };

  if (!showNotification) return null;

  return (
    <Stack sx={{ position: "fixed", top: 0, right: 0, pt: 1, mr: 8, zIndex: 1000 }} alignItems="end">
      <Alert
        variant="soft"
        color="primary"
        invertedColors
        startDecorator={
          <Box sx={{ width: "3rem", height: "4rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Box sx={{ fontSize: "2rem" }}>
              <InfoIcon style={{ height: "2rem", width: "2rem" }} />
            </Box>
          </Box>
        }
        endDecorator={
          <IconButton
            variant="plain"
            size="sm"
            color="primary"
            onClick={handleDismiss}
            sx={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}>
            <XMarkIcon />
          </IconButton>
        }
        sx={{ alignItems: "flex-start", gap: "1rem", width: "min(90vw, 450px)" }}>
        <Box sx={{ flex: 1 }}>
          <Typography level="title-lg" sx={{ mb: 1 }}>
            {t("BackgroundUpdatesNotification.Title")}
          </Typography>
          <Typography level="body-md" sx={{ mb: 1.5 }}>
            {t("BackgroundUpdatesNotification.Description")}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="sm" variant="solid" color="primary" onClick={handleDismiss}>
              {t("BackgroundUpdatesNotification.GotIt")}
            </Button>
            <Button size="sm" variant="outlined" color="primary" onClick={handleDisableFeature}>
              {t("BackgroundUpdatesNotification.TurnOff")}
            </Button>
          </Stack>
        </Box>
      </Alert>
    </Stack>
  );
};

export default BackgroundUpdatesNotification;
