import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import MoonIcon from "../icons/MoonIcon";
import SunIcon from "../icons/SunIcon";

const ThemeToggle: FunctionComponent = () => {
  const { t } = useTranslation();
  const { mode, setMode } = useColorScheme();

  return (
    <Tooltip title={t("ToggleTheme")} placement="left" variant="outlined" arrow>
      <IconButton
        variant="outlined"
        sx={{ backgroundColor: "var(--joy-palette-background-surface)" }}
        color="neutral"
        onClick={() => setMode(mode === "light" ? "dark" : "light")}
      >
        {mode === "light" ? <MoonIcon /> : <SunIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
