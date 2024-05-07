import { DivIcon } from "leaflet";
import { type FunctionComponent, useMemo } from "react";
import { Marker } from "react-leaflet";

import { Station } from "../../utils/data-manager";
import TrainIcon from "./icons/train.svg?raw";

export interface UnplayableStationProps {
  station: Station;
}

const UnplayableStation: FunctionComponent<UnplayableStationProps> = ({ station }) => {
  const icon = useMemo(() => {
    return new DivIcon({
      html: `${TrainIcon}<span class="tooltip">${station.Name}</span>`,
      iconSize: [30, 30],
      popupAnchor: [0, -15],
      className: `icon station bot non-playable`,
    });
  }, [station.Name]);

  return (
    <Marker
      interactive={false}
      position={[station.Latititude, station.Longitude]}
      icon={icon}></Marker>
  );
};

export default UnplayableStation;
