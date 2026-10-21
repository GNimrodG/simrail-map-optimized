import L from "leaflet";
import { type FunctionComponent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";

import { useProfileData } from "../../../hooks/useProfileData";
import { useSetting } from "../../../hooks/useSetting";
import { getOsmNodeName, getStationOsmData } from "../../../utils/osm-utils";
import { OsmTagged, Station } from "../../../utils/types";
import PersonIcon from "../../icons/person.svg?raw";
import BotIcon from "../icons/bot.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface StationMarkerProps {
  station: Station;
  layerId: string;
}

function getIcon(stationName: string, lng: string, avatar?: string, osmData?: OsmTagged | null) {
  if (avatar) {
    return new L.DivIcon({
      html: avatar.toString().startsWith("http")
        ? `<img src="${avatar}" /><span class="tooltip">${osmData ? getOsmNodeName(osmData, lng) : stationName}</span>`
        : `${PersonIcon}<span class="tooltip">${osmData ? getOsmNodeName(osmData, lng) : stationName}</span>`,
      iconSize: [40, 40],
      popupAnchor: [0, -20],
      className: "icon station player",
    });
  }

  return new L.DivIcon({
    html: `${BotIcon}<span class="tooltip">${osmData ? getOsmNodeName(osmData, lng) : stationName}</span>`,
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    className: "icon station bot",
  });
}

const StationMarker: FunctionComponent<StationMarkerProps> = ({ station, layerId }) => {
  const { i18n } = useTranslation();
  const markerRef = useRef<L.Marker>(null);
  const [layerOpacities] = useSetting("layerOpacities");
  const opacity = layerOpacities[layerId] ?? layerOpacities.stations ?? 1;
  const osmData = getStationOsmData(station.Name);
  const [translateStationNames] = useSetting("translateStationNames");

  const { userData } = useProfileData(station.DispatchedBy?.[0]?.SteamId, station.DispatchedBy?.[0]?.XboxId);

  const avatar = userData?.Avatar || userData?.PersonaName || station.DispatchedBy?.[0]?.XboxId || undefined;
  const icon = useMemo(
    () => getIcon(station.Name, i18n.language, avatar, translateStationNames ? osmData : undefined),
    [station.Name, i18n.language, avatar, translateStationNames, osmData],
  );

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <Marker
      ref={markerRef}
      key={station.Id}
      position={[station.Latitude, station.Longitude]}
      icon={icon}
      opacity={opacity}
      eventHandlers={{
        popupopen: () => setIsPopupOpen(true),
        popupclose: () => setIsPopupOpen(false),
      }}
      pane="stationsPane">
      <Popup autoPan={false}>
        {isPopupOpen && (
          <StationMarkerPopup
            station={station}
            userData={userData}
            onClosePopup={() => markerRef.current?.closePopup()}
            stationOsmData={osmData}
          />
        )}
      </Popup>
    </Marker>
  );
};

export default StationMarker;
