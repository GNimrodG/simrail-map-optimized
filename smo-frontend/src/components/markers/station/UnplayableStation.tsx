import L from "leaflet";
import { type FunctionComponent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";

import { getOsmNodeName } from "../../../utils/osm-utils";
import { Station } from "../../../utils/types";
import { useOsmData } from "../../../utils/use-osm-data";
import { useSetting } from "../../../utils/use-setting";
import TrainIcon from "../icons/train.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface UnplayableStationProps {
  station: Station;
}

const UnplayableStation: FunctionComponent<UnplayableStationProps> = ({ station }) => {
  const { i18n } = useTranslation();
  const markerRef = useRef<L.Marker>(null);
  const [layerOpacities] = useSetting("layerOpacities");
  const osmData = useOsmData(station.Name, station.Prefix);
  const [translateStationNames] = useSetting("translateStationNames");

  const icon = useMemo(() => {
    return new L.DivIcon({
      html: `${TrainIcon}<span class="tooltip">${translateStationNames && osmData ? getOsmNodeName(osmData, i18n.language) : station.Name}</span>`,
      iconSize: [30, 30],
      popupAnchor: [0, -15],
      className: `icon station bot ${station.RemoteControlled ? "remote-controlled" : "non-playable"}`,
    });
  }, [translateStationNames, osmData, i18n.language, station.Name, station.RemoteControlled]);

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
      }}
      pane="unplayableStationsPane">
      <Popup autoPan={false}>
        {isPopupOpen && (
          <StationMarkerPopup
            station={station}
            userData={null}
            onClosePopup={() => markerRef.current?.closePopup()}
            stationOsmData={osmData}
          />
        )}
      </Popup>
    </Marker>
  );
};

export default UnplayableStation;
