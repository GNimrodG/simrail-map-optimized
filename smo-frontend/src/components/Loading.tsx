import LinearProgress, { LinearProgressProps } from "@mui/joy/LinearProgress";
import { type FunctionComponent } from "react";

const Loading: FunctionComponent<LinearProgressProps> = ({ sx, ...props }) => {
  return (
    <LinearProgress
      {...props}
      sx={{
        ...sx,
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
      }}
    />
  );
};

export default Loading;
