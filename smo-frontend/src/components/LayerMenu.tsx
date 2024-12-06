import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, useState } from "react";
import { useTranslation } from "react-i18next";

import LayersIcon from "./icons/LayersIcon";

const BACKGROUND_LAYERS = ["orm-infra", "orm-maxspeed", "orm-signals", "orm-electrification"];

const LAYERS = [
  "stations",
  "trains",
  "active-signals",
  "passive-signals",
  "selected-route",
  "unplayable-stations",
  "stats",
];

export interface LayerMenuProps {
  visibleLayers: string[];
  setVisibleLayers: (value: ((layers: string[]) => string[]) | string[]) => void;
}

const LayerMenu: FunctionComponent<LayerMenuProps> = ({ visibleLayers, setVisibleLayers }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Tooltip
      arrow
      variant="outlined"
      placement="left-end"
      describeChild
      open={isOpen}
      keepMounted
      title={
        <Stack spacing={1}>
          {BACKGROUND_LAYERS.map((layer) => (
            <Checkbox
              slotProps={{
                checkbox: { sx: { borderRadius: "50%" } },
              }}
              key={layer}
              value={layer}
              label={t(`Layers.Background.${layer}`)}
              size="sm"
              name="background-layers"
              checked={visibleLayers.includes(layer)}
              onChange={(e) => {
                setVisibleLayers((visibleLayers: string[]) => [
                  ...visibleLayers.filter((l) => !BACKGROUND_LAYERS.find((bl) => bl === l)),
                  ...(!visibleLayers.includes(e.target.value) ? [layer] : []),
                ]);
              }}
            />
          ))}
          {LAYERS.map((layer) => (
            <Checkbox
              key={layer}
              checked={visibleLayers.includes(layer)}
              onChange={(e) => {
                if (e.target.checked) {
                  setVisibleLayers([...visibleLayers, layer]);
                } else {
                  setVisibleLayers(visibleLayers.filter((l) => l !== layer));
                }
              }}
              label={t(`Layers.Overlay.${layer}`)}
              size="sm"
            />
          ))}
        </Stack>
      }
    >
      <IconButton
        variant="outlined"
        sx={{ backgroundColor: "var(--joy-palette-background-surface)" }}
        onClick={() => setIsOpen((isOpen) => !isOpen)}
        color="neutral"
      >
        <LayersIcon />
      </IconButton>
    </Tooltip>
  );
};

export default LayerMenu;
