import { useLocalStorage } from "@mantine/hooks";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMap, useMapEvent } from "react-leaflet";

import { useSetting } from "../hooks/useSetting";
import InfoIcon from "./icons/InfoIcon";
import XMarkIcon from "./icons/xmark-solid.svg?react";

const NOTIFICATION_SEEN_KEY = "signalOrientationNotificationSeen";
const SIGNAL_LAYERS = ["active-signals", "passive-signals", "distant-signals", "repeater-signals", "shunting-signals"];
const SIGNAL_ZOOM = 11; // where the passive signals show up
const AUTO_CLOSE_MS = 60_000;

/**
 * Tells the users once, when they first see signals, that the signal icons follow the signals' orientation.
 * It closes by itself after a minute (the bar at the bottom), paused while the mouse is over it or after a tap.
 */
const SignalOrientationNotification: FunctionComponent = () => {
  const { t } = useTranslation();
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvent("zoomend", () => setZoom(map.getZoom()));

  const [rotateSignalIcons, setRotateSignalIcons] = useSetting("rotateSignalIcons");
  const [visibleLayers] = useSetting("visibleLayers");
  const [hasSeenNotification, setHasSeenNotification] = useLocalStorage({
    key: NOTIFICATION_SEEN_KEY,
    defaultValue: false,
  });
  const [hovered, setHovered] = useState(false);
  // touch screens have no hover: a tap keeps it open until it's closed
  const [tapped, setTapped] = useState(false);

  const seesSignals = zoom >= SIGNAL_ZOOM && visibleLayers.some((layer) => SIGNAL_LAYERS.includes(layer));
  if (hasSeenNotification || !rotateSignalIcons || !seesSignals) return null;

  const handleDismiss = () => setHasSeenNotification(true);

  const handleNorthAligned = () => {
    setRotateSignalIcons(false);
    handleDismiss();
  };

  return (
    <Alert
      variant="soft"
      color="primary"
      invertedColors
      startDecorator={
        <Box sx={{ width: "3rem", height: "4rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <InfoIcon style={{ height: "2rem", width: "2rem" }} />
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
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onPointerDown={(e) => e.pointerType !== "mouse" && setTapped(true)}
      sx={{
        alignItems: "flex-start",
        gap: "1rem",
        width: "min(90vw, 450px)",
        position: "relative",
        overflow: "hidden",
      }}>
      {/* the time left until it closes */}
      <Box
        aria-hidden
        onAnimationEnd={handleDismiss}
        sx={{
          "position": "absolute",
          "left": 0,
          "bottom": 0,
          "width": "100%",
          "height": "4px",
          "backgroundColor": "var(--joy-palette-primary-solidBg)",
          "transformOrigin": "left",
          "animation": `signal-orientation-countdown ${AUTO_CLOSE_MS}ms linear forwards`,
          "animationPlayState": hovered || tapped ? "paused" : "running",
          "@keyframes signal-orientation-countdown": {
            from: { transform: "scaleX(1)" },
            to: { transform: "scaleX(0)" },
          },
        }}
      />
      <Box sx={{ flex: 1 }}>
        <Typography level="title-lg" sx={{ mb: 1 }}>
          {t("SignalOrientationNotification.Title")}
        </Typography>
        <Typography level="body-md" sx={{ mb: 1.5 }}>
          {t("SignalOrientationNotification.Description")}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="sm" variant="solid" color="primary" onClick={handleDismiss}>
            {t("SignalOrientationNotification.GotIt")}
          </Button>
          <Button size="sm" variant="outlined" color="primary" onClick={handleNorthAligned}>
            {t("SignalOrientationNotification.NorthAligned")}
          </Button>
        </Stack>
      </Box>
    </Alert>
  );
};

export default SignalOrientationNotification;
