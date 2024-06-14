import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent } from "react";

import MoonIcon from "../icons/MoonIcon";
import SunIcon from "../icons/SunIcon";

const ThemeToggle: FunctionComponent = () => {
  const { mode, setMode } = useColorScheme();

  return (
    <Tooltip
      title="Toggle theme"
      placement="left"
      variant="outlined"
      arrow>
      <IconButton
        variant="outlined"
        sx={{ backgroundColor: "var(--joy-palette-background-surface)" }}
        color="neutral"
        onClick={() => setMode(mode === "light" ? "dark" : "light")}>
        {mode === "light" ? <MoonIcon /> : <SunIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
