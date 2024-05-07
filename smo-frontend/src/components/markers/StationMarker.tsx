import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { DivIcon, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import { Station } from "../../utils/data-manager";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import SteamProfileDisplay from "../SteamProfileDisplay";
import BotIcon from "./icons/bot.svg?raw";

export interface StationMarkerProps {
  station: Station;
}

const DEFAULT_ICON = new DivIcon({
  iconSize: [40, 40],
  html: BotIcon,
  className: "icon station bot",
});

function getIcon(stationName: string, avatar?: string) {
  if (avatar) {
    return new DivIcon({
      html: `<img src="${avatar}" /><span class="tooltip">${stationName}</span>`,
      iconSize: [40, 40],
      popupAnchor: [0, -20],
      className: "icon station player",
    });
  }

  return new DivIcon({
    html: `${BotIcon}<span class="tooltip">${stationName}</span>`,
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    className: "icon station bot",
  });
}

const StationMarker: FunctionComponent<StationMarkerProps> = ({ station }) => {
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(DEFAULT_ICON);

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

  return (
    <Marker
      key={station.id}
      position={[station.Latititude, station.Longitude]}
      icon={icon}>
      <Popup autoPan={false}>
        <Stack
          alignItems="center"
          spacing={1}>
          <img
            style={{ width: 300 }}
            src={station.MainImageURL}
            alt={station.Name}
          />
          <Typography
            level="h4"
            endDecorator={<Chip>{station.Prefix}</Chip>}>
            {station.Name}
          </Typography>
          <Typography>Difficulty: {station.DifficultyLevel}</Typography>
          {userData && station.DispatchedBy?.[0]?.SteamId && (
            <SteamProfileDisplay
              profile={userData}
              steamId={station.DispatchedBy[0].SteamId}
            />
          )}
        </Stack>
      </Popup>
    </Marker>
  );
};

export default StationMarker;
