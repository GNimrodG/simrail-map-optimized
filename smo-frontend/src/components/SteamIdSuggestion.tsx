import { readLocalStorageValue, useLocalStorage } from "@mantine/hooks";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "../hooks/useSetting";
import InfoIcon from "./icons/InfoIcon";
import XMarkIcon from "./icons/xmark-solid.svg?react";
import SteamIdForm from "./settings/SteamIdForm";

const SUGGESTION_SHOWN_KEY = "steamIdSuggestionShown";

/**
 * Suggests setting the user's Steam ID (to follow their own train or station) once, at startup, to the users who
 * haven't set it. It's marked as shown as soon as it appears, so it doesn't come back on the next visit even if it
 * was left open.
 */
const SteamIdSuggestion: FunctionComponent = () => {
  const { t } = useTranslation();
  const [mySteamId] = useSetting("mySteamId");
  const [, setShown] = useLocalStorage({ key: SUGGESTION_SHOWN_KEY, defaultValue: false });

  // decided once per page load, from the stored values
  const [visible, setVisible] = useState(
    () =>
      !readLocalStorageValue({ key: SUGGESTION_SHOWN_KEY, defaultValue: false }) &&
      !readLocalStorageValue({ key: "mySteamId", defaultValue: "" }),
  );

  useEffect(() => {
    if (visible) setShown(true);
  }, [visible, setShown]);

  if (!visible || mySteamId) return null;

  const close = () => setVisible(false);

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
          onClick={close}
          sx={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}>
          <XMarkIcon />
        </IconButton>
      }
      sx={{ alignItems: "flex-start", gap: "1rem", width: "min(90vw, 450px)", position: "relative" }}>
      <Box sx={{ flex: 1 }}>
        <Typography level="title-lg" sx={{ mb: 1 }}>
          {t("SteamIdSuggestion.Title")}
        </Typography>
        <Typography level="body-md" sx={{ mb: 1.5 }}>
          {t("SteamIdSuggestion.Description")}
        </Typography>
        <Stack spacing={1}>
          <SteamIdForm onSaved={close} />
          <Box>
            <Button size="sm" variant="plain" color="neutral" onClick={close}>
              {t("SteamIdSuggestion.NoThanks")}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Alert>
  );
};

export default SteamIdSuggestion;
