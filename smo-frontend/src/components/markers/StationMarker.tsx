import { Fill, Icon, RegularShape, Stroke, Style, Text } from "ol/style";
import { StyleLike } from "ol/style/Style";
import { type FunctionComponent, useEffect, useRef, useState } from "react";

import { Station } from "../../utils/data-manager";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import { useSetting } from "../../utils/use-setting";
import Marker from "../map/Marker";
import Popup, { PopupRef } from "../map/Popup";
import { getCssVarValue } from "../utils/general-utils";
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
  const text = new Text({
    text: stationName,
    offsetY: 36,
    font: getCssVarValue("--joy-fontSize-md") + " Inter",
    fill: new Fill({ color: getCssVarValue("--joy-palette-text-primary") }),
    backgroundFill: new Fill({ color: getCssVarValue("--joy-palette-background-surface") }),
    backgroundStroke: new Stroke({ color: getCssVarValue("--joy-palette-neutral-outlinedBorder"), width: 1 }),
    padding: [4, 8, 4, 8], // Add padding to create space for the border radius
  });

  const background = new Style({
    image: new RegularShape({
      fill: new Fill({ color: getCssVarValue("--joy-palette-background-surface") }),
      radius: 25,
      points: 4,
      angle: Math.PI / 4,
    }),
  });

  const overlay = new Style({
    image: new RegularShape({
      stroke: new Stroke({
        color: getCssVarValue(avatar ? "--joy-palette-primary-600" : "--joy-palette-warning-600"),
        width: 3,
      }),
      radius: 25,
      points: 4,
      angle: Math.PI / 4,
    }),
  });

  if (avatar) {
    return [
      background,
      new Style({
        image: new Icon({
          src: avatar,
          size: [32, 32],
          opacity,
        }),
        text,
      }),
      overlay,
    ];
  }

  return [
    background,
    new Style({
      image: new Icon({
        src: "data:image/svg+xml;utf8," + BotIcon,
        size: [24, 24],
        opacity,
      }),
      text,
    }),
    overlay,
  ];
}

const StationMarker: FunctionComponent<StationMarkerProps> = ({ station }) => {
  const popupRef = useRef<PopupRef>(null);
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<StyleLike>(DEFAULT_ICON);
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
  }, [layerOpacities, station.DispatchedBy, station.Name]);

  return (
    <Marker key={station.id} position={[station.Latititude, station.Longitude]} icon={icon}>
      <Popup offset={[0, -30]} ref={popupRef}>
        <StationMarkerPopup station={station} userData={userData} onClosePopup={() => popupRef.current?.close()} />
      </Popup>
    </Marker>
  );
};

export default StationMarker;
