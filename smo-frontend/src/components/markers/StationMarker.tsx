import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { DivIcon, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";

import { Station } from "../../utils/data-manager";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import SteamProfileDisplay from "../SteamProfileDisplay";
import BotIcon from "./icons/bot.svg?raw";

export interface StationMarkerProps {
  station: Station;
}

const BOT_ICON = new DivIcon({
  iconSize: [40, 40],
  html: BotIcon,
  className: "icon station bot",
});

const StationMarker: FunctionComponent<StationMarkerProps> = ({ station }) => {
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(BOT_ICON);

  useEffect(() => {
    if (!station.DispatchedBy?.[0]?.SteamId) {
      setIcon(BOT_ICON);
      setUserData(null);
      return;
    }

    getSteamProfileInfo(station.DispatchedBy[0].SteamId).then((profile) => {
      setUserData(profile);
      setIcon(
        new Icon({
          iconUrl: profile.avatar,
          iconSize: [40, 40],
          popupAnchor: [0, -20],
          className: "icon station player",
        })
      );
    });
  }, [station.DispatchedBy]);

  return (
    <Marker
      key={station.id}
      position={[station.Latititude, station.Longitude]}
      icon={icon}>
      <Popup>
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
      <Tooltip
        offset={[0, 20]}
        direction="bottom"
        permanent>
        {station.Name}
      </Tooltip>
    </Marker>
  );
};

export default StationMarker;
