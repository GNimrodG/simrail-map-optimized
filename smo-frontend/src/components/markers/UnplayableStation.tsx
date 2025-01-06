import { Fill, Icon, RegularShape, Stroke, Style, Text } from "ol/style";
import { type FunctionComponent, useMemo, useRef } from "react";

import { Station } from "../../utils/data-manager";
import { useSetting } from "../../utils/use-setting";
import Marker from "../map/Marker";
import Popup, { PopupRef } from "../map/Popup";
import { getCssVarValue } from "../utils/general-utils";
import TrainIcon from "./icons/train.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface UnplayableStationProps {
  station: Station;
}

const UnplayableStation: FunctionComponent<UnplayableStationProps> = ({ station }) => {
  const popupRef = useRef<PopupRef>(null);
  const [layerOpacities] = useSetting("layerOpacities");

  const icon = useMemo(() => {
    const text = new Text({
      text: station.Name,
      offsetY: 36,
      font: getCssVarValue("--joy-fontSize-sm") + " Inter",
      fill: new Fill({ color: getCssVarValue("--joy-palette-text-primary") }),
      backgroundFill: new Fill({ color: getCssVarValue("--joy-palette-background-surface") }),
      backgroundStroke: new Stroke({ color: getCssVarValue("--joy-palette-neutral-outlinedBorder"), width: 1 }),
      padding: [4, 8, 4, 8], // Add padding to create space for the border radius
    });

    const background = new Style({
      image: new RegularShape({
        fill: new Fill({ color: getCssVarValue("--joy-palette-background-surface") }),
        stroke: new Stroke({
          color: getCssVarValue("--joy-palette-warning-600"),
          width: 4,
        }),
        radius: 20,
        points: 4,
        angle: Math.PI / 4,
      }),
    });

    return [
      background,
      new Style({
        image: new Icon({
          src: "data:image/svg+xml;utf8," + TrainIcon,
          color: getCssVarValue("--joy-palette-warning-400"),
          size: [16, 16],
          opacity: layerOpacities["unplayable-stations"],
        }),
        text,
      }),
    ];
  }, [layerOpacities, station.Name]);

  return (
    <Marker position={[station.Latititude, station.Longitude]} icon={icon}>
      <Popup ref={popupRef} offset={[0, -25]}>
        <StationMarkerPopup station={station} userData={null} onClosePopup={() => popupRef.current?.close()} />
      </Popup>
    </Marker>
  );
};

export default UnplayableStation;
