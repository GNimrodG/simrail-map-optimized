import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import { type FunctionComponent } from "react";

import MoonIcon from "./icons/MoonIcon";
import SunIcon from "./icons/SunIcon";

const ThemeToggle: FunctionComponent = () => {
  const { mode, setMode } = useColorScheme();

  return (
    <IconButton
      variant="soft"
      color="neutral"
      onClick={() => setMode(mode === "light" ? "dark" : "light")}>
      {mode === "light" ? <MoonIcon /> : <SunIcon />}
    </IconButton>
  );
};

export default ThemeToggle;
