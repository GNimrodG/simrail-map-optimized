import L from "leaflet";
import { type FunctionComponent, useMemo, useRef, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import { Station } from "../../utils/types";
import { useSetting } from "../../utils/use-setting";
import TrainIcon from "./icons/train.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface UnplayableStationProps {
  station: Station;
}

const UnplayableStation: FunctionComponent<UnplayableStationProps> = ({ station }) => {
  const markerRef = useRef<L.Marker>(null);
  const [layerOpacities] = useSetting("layerOpacities");

  const icon = useMemo(() => {
    return new L.DivIcon({
      html: `${TrainIcon}<span class="tooltip">${station.Name}</span>`,
      iconSize: [30, 30],
      popupAnchor: [0, -15],
      className: `icon station bot ${station.RemoteControlled ? "remote-controlled" : "non-playable"}`,
    });
  }, [station.Name, station.RemoteControlled]);

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <Marker
      ref={markerRef}
      position={[station.Latitude, station.Longitude]}
      icon={icon}
      opacity={layerOpacities["unplayable-stations"]}
      eventHandlers={{
        popupopen: () => setIsPopupOpen(true),
        popupclose: () => setIsPopupOpen(false),
      }}>
      <Popup autoPan={false}>
        {isPopupOpen && (
          <StationMarkerPopup station={station} userData={null} onClosePopup={() => markerRef.current?.closePopup()} />
        )}
      </Popup>
    </Marker>
  );
};

export default UnplayableStation;
