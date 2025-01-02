import { Fill, Icon, Stroke, Style, Text } from "ol/style";
import { type FunctionComponent, useMemo } from "react";

import { Station } from "../../utils/data-manager";
import { useSetting } from "../../utils/use-setting";
import Marker from "../map/Marker";
import Popup from "../map/Popup";
import TrainIcon from "./icons/train.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface UnplayableStationProps {
  station: Station;
}

const UnplayableStation: FunctionComponent<UnplayableStationProps> = ({ station }) => {
  // const markerRef = useRef<L.Marker>(null);
  const [layerOpacities] = useSetting("layerOpacities");

  const icon = useMemo(() => {
    return new Style({
      image: new Icon({
        // html: `${TrainIcon}<span class="tooltip">${station.Name}</span>`,
        src: "data:image/svg+xml;utf8," + TrainIcon.replace("<svg", `<svg class="icon station bot non-playable"`),
        size: [16, 16],
        opacity: layerOpacities["unplayable-stations"],
      }),
      text: new Text({
        text: station.Name,
        font: "bold 12px sans-serif",
        offsetY: 20,
        fill: new Fill({ color: "black" }),
        stroke: new Stroke({ color: "white", width: 2 }),
      }),
    });
  }, [layerOpacities, station.Name]);

  return (
    <Marker position={[station.Latititude, station.Longitude]} icon={icon}>
      <Popup>
        <StationMarkerPopup
          station={station}
          userData={null}
          onClosePopup={() => {
            console.log("TODO: close popup");
          }}
        />
      </Popup>
    </Marker>
  );
};

export default UnplayableStation;
