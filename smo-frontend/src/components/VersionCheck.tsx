import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { useVersionCheck } from "../hooks/useVersionCheck";

const VersionCheck: FunctionComponent = () => {
  const { t } = useTranslation();
  const { isOutdated, currentVersion, latestVersion } = useVersionCheck();

  if (!isOutdated) {
    return null;
  }

  const handleRefresh = () => {
    globalThis.location.reload();
  };

  return (
    <Sheet
      sx={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        p: 3,
        borderRadius: "md",
        boxShadow: "lg",
        maxWidth: 400,
      }}
      variant="outlined"
      color="warning">
      <Stack spacing={2}>
        <Typography level="h4" color="warning">
          {t("VersionCheck.UpdateAvailable")}
        </Typography>
        <Typography level="body-md">
          {t("VersionCheck.UpdateMessage", {
            current: currentVersion,
            latest: latestVersion,
          })}
        </Typography>
        <Button onClick={handleRefresh} color="warning">
          {t("VersionCheck.RefreshNow")}
        </Button>
        <Typography level="body-xs">{t("VersionCheck.RefreshDescription")}</Typography>
      </Stack>
    </Sheet>
  );
};

export default VersionCheck;
