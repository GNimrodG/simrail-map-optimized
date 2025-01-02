import { Fill, Icon, Stroke, Style, Text } from "ol/style";
import { type FunctionComponent, useEffect, useState } from "react";

import { Station } from "../../utils/data-manager";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import { useSetting } from "../../utils/use-setting";
import Marker from "../map/Marker";
import Popup from "../map/Popup";
import BotIcon from "./icons/bot.svg?raw";
import StationMarkerPopup from "./StationMarkerPopup";

export interface StationMarkerProps {
  station: Station;
}

const DEFAULT_ICON = new Style({
  image: new Icon({
    size: [40, 40],
    src: "data:image/svg+xml;utf8," + BotIcon.replace("<svg", `<svg class="icon station bot"`),
  }),
});

function getIcon(stationName: string, opacity: number, avatar?: string) {
  if (avatar) {
    return new Style({
      image: new Icon({
        // html: `<img src="${avatar}" /><span class="tooltip">${stationName}</span>`,
        src: avatar,
        size: [40, 40],
        opacity,
        // className: "icon station player",
      }),
      text: new Text({
        text: stationName,
        font: "bold 12px sans-serif",
        offsetY: 30,
        fill: new Fill({ color: "black" }),
        stroke: new Stroke({ color: "white", width: 1 }),
      }),
    });
  }

  return new Style({
    image: new Icon({
      // html: `${BotIcon}<span class="tooltip">${stationName}</span>`,
      src: "data:image/svg+xml;utf8," + BotIcon.replace("<svg", `<svg class="icon station bot"`),
      size: [40, 40],
      opacity,
    }),
    text: new Text({
      text: stationName,
      font: "bold 12px sans-serif",
      offsetY: 30,
      fill: new Fill({ color: "black" }),
      stroke: new Stroke({ color: "white", width: 1 }),
    }),
  });
}

const StationMarker: FunctionComponent<StationMarkerProps> = ({ station }) => {
  // const markerRef = useRef<L.Marker>(null);
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<Style>(DEFAULT_ICON);
  const [layerOpacities] = useSetting("layerOpacities");

  useEffect(() => {
    if (!station.DispatchedBy?.[0]?.SteamId) {
      setIcon(getIcon(station.Name, layerOpacities["stations"]));
      setUserData(null);
      return;
    }

    getSteamProfileInfo(station.DispatchedBy[0].SteamId).then((profile) => {
      setUserData(profile);
      setIcon(getIcon(station.Name, layerOpacities["stations"], profile.avatar));
    });
  }, [station.DispatchedBy, station.Name]);

  return (
    <Marker
      // ref={markerRef}
      key={station.id}
      position={[station.Latititude, station.Longitude]}
      icon={icon}>
      <Popup>
        <StationMarkerPopup
          station={station}
          userData={userData}
          onClosePopup={() => {
            console.log("TODO: close popup");
          }}
        />
      </Popup>
    </Marker>
  );
};

export default StationMarker;
