import L from "leaflet";
import { type FunctionComponent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";

import { getOsmNodeName } from "../../../utils/osm-utils";
import { getSteamProfileInfo, ProfileResponse } from "../../../utils/steam";
import { OsmNode, Station } from "../../../utils/types";
import { useOsmData } from "../../../utils/use-osm-data";
import { useSetting } from "../../../utils/use-setting";
import BotIcon from "../icons/bot.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface StationMarkerProps {
  station: Station;
}

const DEFAULT_ICON = new L.DivIcon({
  iconSize: [40, 40],
  html: BotIcon,
  className: "icon station bot",
});

function getIcon(stationName: string, avatar?: string, osmData?: OsmNode | null, lng?: string) {
  if (avatar) {
    return new L.DivIcon({
      html: `<img src="${avatar}" /><span class="tooltip">${osmData ? getOsmNodeName(osmData, lng!) : stationName}</span>`,
      iconSize: [40, 40],
      popupAnchor: [0, -20],
      className: "icon station player",
    });
  }

  return new L.DivIcon({
    html: `${BotIcon}<span class="tooltip">${osmData ? getOsmNodeName(osmData, lng!) : stationName}</span>`,
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    className: "icon station bot",
  });
}

const StationMarker: FunctionComponent<StationMarkerProps> = ({ station }) => {
  const { i18n } = useTranslation();
  const markerRef = useRef<L.Marker>(null);
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<L.Icon<Partial<L.IconOptions>>>(DEFAULT_ICON);
  const [layerOpacities] = useSetting("layerOpacities");
  const osmData = useOsmData(station.Name, station.Prefix);
  const [translateStationNames] = useSetting("translateStationNames");

  useEffect(() => {
    if (!station.DispatchedBy?.[0]?.SteamId) {
      setIcon(getIcon(station.Name, undefined, translateStationNames ? osmData : undefined, i18n.language));
      setUserData(null);
      return;
    }

    getSteamProfileInfo(station.DispatchedBy[0].SteamId).then((profile) => {
      setUserData(profile);
      setIcon(getIcon(station.Name, profile.avatar, translateStationNames ? osmData : undefined, i18n.language));
    });
  }, [i18n.language, osmData, station.DispatchedBy, station.Name, translateStationNames]);

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <Marker
      ref={markerRef}
      key={station.Id}
      position={[station.Latitude, station.Longitude]}
      icon={icon}
      opacity={layerOpacities["stations"]}
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
