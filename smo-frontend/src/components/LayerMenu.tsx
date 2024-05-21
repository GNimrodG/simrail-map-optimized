import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, useState } from "react";

import LayersIcon from "./icons/LayersIcon";

const BACKGROUND_LAYERS = [
  { name: "OpenRailwayMap - Infrastructure", key: "orm-infra" },
  { name: "OpenRailwayMap - Maxspeed", key: "orm-maxspeed" },
  { name: "OpenRailwayMap - Signals", key: "orm-signals" },
  { name: "OpenRailwayMap - Electrification", key: "orm-electrification" },
];

const LAYERS = [
  { name: "Stations", key: "stations" },
  { name: "Trains", key: "trains" },
  { name: "Active Signals", key: "active-signals" },
  { name: "Passive Signals", key: "passive-signals" },
  { name: "Selected Route", key: "selected-route" },
  { name: "Unplayable Stations", key: "unplayable-stations" },
  { name: "Stats", key: "stats" },
];

export interface LayerMenuProps {
  visibleLayers: string[];
  setVisibleLayers: (value: ((layers: string[]) => string[]) | string[]) => void;
}

const LayerMenu: FunctionComponent<LayerMenuProps> = ({ visibleLayers, setVisibleLayers }) => {
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
              key={layer.key}
              value={layer.key}
              label={layer.name}
              size="sm"
              name="background-layers"
              checked={visibleLayers.includes(layer.key)}
              onChange={(e) => {
                setVisibleLayers((visibleLayers: string[]) => [
                  ...visibleLayers.filter((l) => !BACKGROUND_LAYERS.find((bl) => bl.key === l)),
                  ...(!visibleLayers.includes(e.target.value) ? [layer.key] : []),
                ]);
              }}
            />
          ))}
          {LAYERS.map((layer) => (
            <Checkbox
              key={layer.key}
              checked={visibleLayers.includes(layer.key)}
              onChange={(e) => {
                if (e.target.checked) {
                  setVisibleLayers([...visibleLayers, layer.key]);
                } else {
                  setVisibleLayers(visibleLayers.filter((l) => l !== layer.key));
                }
              }}
              label={layer.name}
              size="sm"
            />
          ))}
        </Stack>
      }>
      <IconButton
        variant="outlined"
        sx={{
          backgroundColor: "var(--joy-palette-background-surface)",
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1000,
        }}
        onClick={() => setIsOpen((isOpen) => !isOpen)}
        color="neutral">
        <LayersIcon />
      </IconButton>
    </Tooltip>
  );
};

export default LayerMenu;
