import L from "leaflet";
import { type FunctionComponent, useEffect, useRef, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import { Station } from "../../utils/types";
import { useSetting } from "../../utils/use-setting";
import BotIcon from "./icons/bot.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface StationMarkerProps {
  station: Station;
}

const DEFAULT_ICON = new L.DivIcon({
  iconSize: [40, 40],
  html: BotIcon,
  className: "icon station bot",
});

function getIcon(stationName: string, avatar?: string) {
  if (avatar) {
    return new L.DivIcon({
      html: `<img src="${avatar}" /><span class="tooltip">${stationName}</span>`,
      iconSize: [40, 40],
      popupAnchor: [0, -20],
      className: "icon station player",
    });
  }

  return new L.DivIcon({
    html: `${BotIcon}<span class="tooltip">${stationName}</span>`,
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    className: "icon station bot",
  });
}

const StationMarker: FunctionComponent<StationMarkerProps> = ({ station }) => {
  const markerRef = useRef<L.Marker>(null);
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<L.Icon<Partial<L.IconOptions>>>(DEFAULT_ICON);
  const [layerOpacities] = useSetting("layerOpacities");

  useEffect(() => {
    if (!station.DispatchedBy?.[0]?.SteamId) {
      setIcon(getIcon(station.Name));
      setUserData(null);
      return;
    }

    getSteamProfileInfo(station.DispatchedBy[0].SteamId).then((profile) => {
      setUserData(profile);
      setIcon(getIcon(station.Name, profile.avatar));
    });
  }, [station.DispatchedBy, station.Name]);

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
      }}>
      <Popup autoPan={false}>
        {isPopupOpen && (
          <StationMarkerPopup
            station={station}
            userData={userData}
            onClosePopup={() => markerRef.current?.closePopup()}
          />
        )}
      </Popup>
    </Marker>
  );
};

export default StationMarker;
