import { DivIcon } from "leaflet";
import { type FunctionComponent } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { Station } from "../../utils/data-manager";
import TrainIcon from "./icons/train.svg?raw";

export interface UnplayableStationProps {
  station: Station;
}

const ICON = new DivIcon({
  iconSize: [30, 30],
  html: TrainIcon,
  className: "icon station bot non-playable",
});

const UnplayableStation: FunctionComponent<UnplayableStationProps> = ({ station }) => {
  return (
    <Marker
      position={[station.Latititude, station.Longitude]}
      icon={ICON}>
      <Tooltip
        offset={[0, 10]}
        direction="bottom"
        permanent>
        {station.Name}
      </Tooltip>
    </Marker>
  );
};

export default UnplayableStation;
