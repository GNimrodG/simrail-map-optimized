import { CircularProgress } from "@mui/joy";
import Sheet from "@mui/joy/Sheet";
import { type FunctionComponent } from "react";

const Loading: FunctionComponent = () => {
  return (
    <Sheet
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}>
      <CircularProgress />
    </Sheet>
  );
};

export default Loading;
