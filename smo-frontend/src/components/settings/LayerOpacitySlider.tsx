import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Slider, { sliderClasses } from "@mui/joy/Slider";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "../../utils/use-setting";

export interface LayerOpacitySliderProps {
  layerId: string;
  layerType: "Overlay" | "Background";
}

const ValueLabelComponent: FunctionComponent<{ children: React.ReactNode }> = (props) => {
  return (
    <Box
      {...props}
      sx={(theme) => ({
        "zIndex": 1,
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "whiteSpace": "nowrap",
        "fontFamily": theme.vars.fontFamily.body,
        "fontWeight": theme.vars.fontWeight.md,
        "bottom": 0,
        "transformOrigin": "bottom center",
        "transform": "translateY(calc((var(--Slider-thumbSize) + var(--Slider-valueLabelArrowSize)) * -1)) scale(0)",
        "position": "absolute",
        "backgroundColor": theme.vars.palette.background.tooltip,
        "boxShadow": theme.shadow.sm,
        "borderRadius": theme.vars.radius.xs,
        "color": "#fff",
        "&::before": {
          display: "var(--Slider-valueLabelArrowDisplay)",
          position: "absolute",
          content: '""',
          color: theme.vars.palette.background.tooltip,
          bottom: 0,
          border: "calc(var(--Slider-valueLabelArrowSize) / 2) solid",
          borderColor: "currentColor",
          borderRightColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: "transparent",
          left: "50%",
          transform: "translate(-50%, 100%)",
          backgroundColor: "transparent",
        },
        [`&.${sliderClasses.valueLabelOpen}`]: {
          transform: "translateY(calc((var(--Slider-thumbSize) + var(--Slider-valueLabelArrowSize)) * -1)) scale(1)",
        },
        "fontSize": theme.fontSize.sm,
        "lineHeight": theme.lineHeight.md,
        "paddingInline": "0.375rem",
        "minWidth": "24px",
      })}>
      {(+(props.children?.toString() || 0)).toFixed(0)}%
    </Box>
  );
};

const LayerOpacitySlider: FunctionComponent<LayerOpacitySliderProps> = ({ layerId, layerType = "Overlay" }) => {
  const { t } = useTranslation("translation");
  const [value, setValue] = useSetting("layerOpacities");

  const marks: { value: number; label: string }[] = [
    { value: 0, label: "0%" },
    { value: 100, label: "100%" },
  ];

  return (
    <FormControl>
      <FormLabel>{t(`Layers.${layerType}.${layerId}`)}</FormLabel>
      <Slider
        name={layerId}
        min={0}
        max={100}
        step={1}
        marks={marks}
        size="sm"
        slots={{
          valueLabel: ValueLabelComponent,
        }}
        valueLabelDisplay="auto"
        value={value[layerId] * 100}
        onChange={(_e, v) => setValue({ ...value, [layerId]: (v as number) / 100 })}
      />
    </FormControl>
  );
};

export default LayerOpacitySlider;
