import L from "leaflet";
import { type FunctionComponent, useMemo, useRef } from "react";
import { Marker, Popup } from "react-leaflet";

import { Station } from "../../utils/data-manager";
import TrainIcon from "./icons/train.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface UnplayableStationProps {
  station: Station;
}

const UnplayableStation: FunctionComponent<UnplayableStationProps> = ({ station }) => {
  const markerRef = useRef<L.Marker>(null);
  const icon = useMemo(() => {
    return new L.DivIcon({
      html: `${TrainIcon}<span class="tooltip">${station.Name}</span>`,
      iconSize: [30, 30],
      popupAnchor: [0, -15],
      className: `icon station bot non-playable`,
    });
  }, [station.Name]);

  return (
    <Marker
      ref={markerRef}
      position={[station.Latititude, station.Longitude]}
      icon={icon}>
      <Popup autoPan={false}>
        <StationMarkerPopup
          station={station}
          userData={null}
          onClosePopup={() => markerRef.current?.closePopup()}
        />
      </Popup>
    </Marker>
  );
};

export default UnplayableStation;
