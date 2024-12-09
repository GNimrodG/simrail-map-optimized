import Box from "@mui/joy/Box";
import { styled, useTheme } from "@mui/joy/styles";
import Typography from "@mui/joy/Typography";
import { CSSProperties, type FunctionComponent, useMemo } from "react";

export interface StationLayoutGraphicProps {
  cell: string;
  showText: boolean;
}

function getTextAlign(align: string): CSSProperties["textAlign"] {
  switch (align) {
    case "l":
    case "left":
      return "left";
    case "r":
    case "right":
      return "right";
    case "c":
    case "center":
    default:
      return "center";
  }
}

const BaseBox = styled("div", { shouldForwardProp: (p) => p !== "color" })<{ color?: string }>(({ color }) => ({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  display: "flex",
  ["--line-width"]: "4px",
  ["--line-color"]: color,
  minHeight: "1rem",
}));

const BaseLine = styled("div")({
  width: "var(--line-width)",
  height: "var(--line-width)",
  backgroundColor: "var(--line-color)",
});

const BaseSvg = styled("svg")({
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  minHeight: "1rem",
});

// 60 = orange
// 100 = yellow
// VMAX = green

const StationLayoutGraphic: FunctionComponent<StationLayoutGraphicProps> = ({ cell, showText }) => {
  const theme = useTheme();

  const [shapes, texts] = useMemo(() => {
    const shapes: JSX.Element[] = [];
    const texts: JSX.Element[] = [];
    for (const cellPart of cell.split(",")) {
      const [shape, ...rest] = cellPart.split(":");
      let color = rest?.[0] || theme.palette.neutral[600];
      if (color === "g") color = theme.palette.success.solidHoverBg;
      if (color === "o") color = theme.palette.warning.solidHoverBg;
      if (color === "r") color = theme.palette.danger.solidHoverBg;
      if (color === "b") color = theme.palette.primary.solidHoverBg;
      if (color === "y") color = "#ff0"; // yellow
      const align = getTextAlign(rest?.[0] || "center");
      const key = `slc_${cell}_${shape}`;
      switch (shape) {
        case "h": // horizontal
          shapes.push(
            <BaseBox key={key} color={color} sx={{ alignItems: "center" }}>
              <BaseLine sx={{ width: "100%" }} />
            </BaseBox>,
          );
          break;
        case "v": // vertical
          shapes.push(
            <BaseBox key={key} color={color} sx={{ justifyContent: "center" }}>
              <BaseLine sx={{ height: "100%" }} />
            </BaseBox>,
          );
          break;
        case "l": // left
          shapes.push(
            <BaseBox key={key} color={color} sx={{ alignItems: "center" }}>
              <BaseLine sx={{ width: "calc(50% + var(--line-width) / 2)" }} />
            </BaseBox>,
          );
          break;
        case "r": // right
          shapes.push(
            <BaseBox key={key} color={color} sx={{ alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <BaseLine sx={{ width: "calc(50% + var(--line-width) / 2)" }} />
            </BaseBox>,
          );
          break;
        case "t": // top
          shapes.push(
            <BaseBox key={key} color={color} sx={{ justifyContent: "center" }}>
              <BaseLine sx={{ height: "calc(100% - 2rem - var(--line-width) / 2)" }} />
            </BaseBox>,
          );
          break;
        case "b": // bottom
          shapes.push(
            <BaseBox key={key} color={color} sx={{ alignItems: "flex-end", justifyContent: "center" }}>
              <BaseLine sx={{ height: "calc(2rem + var(--line-width) / 2)" }} />
            </BaseBox>,
          );
          break;
        case "tl": // top-left to center
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="0" x2="50" y2="50" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "tr": // top-right to center
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="100" y1="0" x2="50" y2="50" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "bl": // bottom-left to center
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="100" x2="50" y2="50" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "br": // bottom-right to center
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="100" y1="100" x2="50" y2="50" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "lb": // left to bottom
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="50" x2="50" y2="100" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "lt": // left to top
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="50" x2="50" y2="0" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "rb": // right to bottom
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="100" y1="50" x2="50" y2="100" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "rt": // right to top
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="100" y1="50" x2="50" y2="0" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "lbf": // left to bottom to right
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="50" x2="100" y2="100" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "ltf": // left to top to right
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="50" x2="100" y2="0" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "rtf": // right to top to left
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="100" y1="50" x2="0" y2="0" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "rbf": // right to bottom to left
          shapes.push(
            <BaseSvg key={key} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="100" y1="50" x2="0" y2="100" stroke={color} strokeWidth="6" />
            </BaseSvg>,
          );
          break;
        case "MB": // main building
          texts.push(
            <Box
              key={`slt_${cell}_${shape}`}
              sx={{
                position: "relative",
                border: (theme) => `4px double ${theme.palette.neutral[600]}`,
                width: "80%",
                height: "50%",
              }}>
              <Box
                sx={{
                  position: "absolute",
                  top: "30%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "60%",
                  height: "4px",
                  backgroundColor: (theme) => theme.palette.neutral[600],
                }}
              />
              {/* dot above the slab */}
              <Box
                sx={{
                  position: "absolute",
                  top: "65%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "4px",
                  height: "4px",
                  backgroundColor: (theme) => theme.palette.neutral[600],
                  borderRadius: "50%",
                }}
              />
            </Box>,
          );
          break;
        case "B": // building
          texts.push(
            <Box
              key={`slt_${cell}_${shape}`}
              sx={{
                position: "relative",
                border: (theme) => `4px double ${theme.palette.neutral[600]}`,
                width: "80%",
                height: "50%",
              }}
            />,
          );
          break;
        default:
          texts.push(
            <Typography
              key={`slt_${cell}_${shape}_${texts.length}`}
              textAlign={align}
              level="body-sm"
              sx={{
                width: "100%",
                textSizeAdjust: "auto",
                whiteSpace: "nowrap",
                height: "1em",
              }}>
              {shape}
            </Typography>,
          );
          break;
      }
    }

    return [shapes, texts];
  }, [
    cell,
    theme.palette.danger.solidHoverBg,
    theme.palette.neutral,
    theme.palette.primary.solidHoverBg,
    theme.palette.success.solidHoverBg,
    theme.palette.warning.solidHoverBg,
  ]);

  return (
    <Box
      key={`slc_${cell}`}
      component="td"
      sx={{
        minWidth: "50px",
        minHeight: "1rem",
        position: "relative",
        width: "100%",
        height: "100%",
      }}>
      {shapes}

      {showText && (
        <BaseBox
          sx={{
            alignItems: "center",
            justifyContent: "space-around",
            flexDirection: "column",
          }}>
          {texts}
        </BaseBox>
      )}
    </Box>
  );
};

export default StationLayoutGraphic;
