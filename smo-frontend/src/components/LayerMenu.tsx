import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, useState } from "react";
import { useTranslation } from "react-i18next";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { isOsmAvailable$ } from "../utils/osm-utils";
import LayersIcon from "./icons/LayersIcon";

const BACKGROUND_LAYERS = ["orm-infra", "orm-maxspeed", "orm-signals", "orm-electrification"];

const MARKER_LAYER_GROUPS = [
  { id: "stations", layers: ["bot-stations", "user-stations"] },
  { id: "trains", layers: ["bot-trains", "user-trains"] },
];

const LAYERS = [
  "active-signals",
  "passive-signals",
  "selected-route",
  "unplayable-stations",
  "stoppingpoints",
  "stats",
];

export interface LayerMenuProps {
  visibleLayers: string[];
  setVisibleLayers: (value: ((layers: string[]) => string[]) | string[]) => void;
}

const LayerMenu: FunctionComponent<LayerMenuProps> = ({ visibleLayers, setVisibleLayers }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const isOsmAvailable = useBehaviorSubj(isOsmAvailable$);
  const hasPartiallyVisibleMarkerGroup = MARKER_LAYER_GROUPS.some((group) => {
    const visibleLayerCount = group.layers.filter((layer) => visibleLayers.includes(layer)).length;
    return visibleLayerCount === 1;
  });

  const renderOverlayLayer = (layer: string) => (
    <Checkbox
      key={layer}
      checked={visibleLayers.includes(layer)}
      onChange={(e) => {
        const checked = e.target.checked;
        setVisibleLayers((layers) =>
          checked ? [...layers, layer] : layers.filter((visibleLayer) => visibleLayer !== layer),
        );
      }}
      label={t(`Layers.Overlay.${layer}`)}
      size="sm"
      disabled={!isOsmAvailable && layer === "stoppingpoints"}
    />
  );

  const toggleLayerGroup = (groupLayers: string[]) => {
    setVisibleLayers((layers) => {
      const allVisible = groupLayers.every((layer) => layers.includes(layer));
      const layersOutsideGroup = layers.filter((layer) => !groupLayers.includes(layer));
      return allVisible ? layersOutsideGroup : [...layersOutsideGroup, ...groupLayers];
    });
  };

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
          {MARKER_LAYER_GROUPS.map((group) => {
            const allVisible = group.layers.every((layer) => visibleLayers.includes(layer));
            const someVisible = group.layers.some((layer) => visibleLayers.includes(layer));

            return (
              <Stack key={group.id} spacing={0.5}>
                <Checkbox
                  checked={allVisible}
                  indeterminate={someVisible && !allVisible}
                  onChange={() => toggleLayerGroup(group.layers)}
                  label={t(`Layers.Groups.${group.id}`)}
                  size="sm"
                  sx={{ fontWeight: "lg" }}
                />
                <Stack
                  spacing={0.5}
                  sx={{
                    ml: 0.75,
                    pl: 1,
                    borderLeft: "2px solid",
                    borderColor: "divider",
                  }}>
                  {group.layers.map(renderOverlayLayer)}
                </Stack>
              </Stack>
            );
          })}
          {LAYERS.map(renderOverlayLayer)}
        </Stack>
      }>
      <IconButton
        variant="outlined"
        sx={{
          backgroundColor: "var(--joy-palette-background-surface)",
          position: "relative",
        }}
        onClick={() => setIsOpen((isOpen) => !isOpen)}
        color="neutral">
        <LayersIcon />
        {hasPartiallyVisibleMarkerGroup && (
          <Box
            sx={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "var(--joy-palette-danger-500)",
              border: "2px solid var(--joy-palette-background-surface)",
            }}
          />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default LayerMenu;
