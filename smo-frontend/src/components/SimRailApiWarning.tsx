import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { dataProvider } from "../utils/data-manager";
import WarningIcon from "./icons/WarningIcon";

const SimRailApiWarning: FunctionComponent = () => {
  const { t } = useTranslation();
  const isAvailable = useBehaviorSubj(dataProvider.simRailApiAvailable$);

  if (isAvailable !== false) return null;

  return (
    <Alert
      variant="soft"
      color="danger"
      invertedColors
      startDecorator={
        <Box sx={{ width: "3rem", height: "4rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <WarningIcon width="2rem" height="2rem" />
        </Box>
      }
      sx={{ alignItems: "flex-start", gap: "1rem", width: "min(90vw, 450px)" }}>
      <Box sx={{ flex: 1 }}>
        <Typography level="title-md">{t("SimRailApiWarning.Title")}</Typography>
        <Typography level="body-md">{t("SimRailApiWarning.Description")}</Typography>
      </Box>
    </Alert>
  );
};

export default SimRailApiWarning;
