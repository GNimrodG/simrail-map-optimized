import { DivIcon, DivIconOptions, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { Popup, Tooltip } from "react-leaflet";
import ReactLeafletDriftMarker from "react-leaflet-drift-marker";

import { Train } from "../../utils/data-manager";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker } from "../../utils/ui";
import BotIcon from "./icons/bot.svg?raw";
import TrainMarkerPopup from "./TrainMarkerPopup";

export interface TrainMarkerProps {
  train: Train;
}

const BOT_ICON_OPTIONS: DivIconOptions = {
  iconSize: [40, 40],
  html: BotIcon,
  className: "icon train bot",
};

const TrainMarker: FunctionComponent<TrainMarkerProps> = ({ train }) => {
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(new DivIcon(BOT_ICON_OPTIONS));

  useEffect(() => {
    if (!train.TrainData.ControlledBySteamID) {
      setUserData(null);
      return;
    }

    getSteamProfileInfo(train.TrainData.ControlledBySteamID).then((profile) => {
      setUserData(profile);
    });
  }, [train.TrainData.ControlledBySteamID]);

  useEffect(() => {
    if (!userData) {
      setIcon(
        new DivIcon({
          ...BOT_ICON_OPTIONS,
          className: `${BOT_ICON_OPTIONS.className} ${getColorTrainMarker(
            train.TrainData.Velocity
          )} ${train.TrainData.InBorderStationArea ? "non-playable" : ""}`,
        })
      );
      return;
    }

    setIcon(
      new Icon({
        iconUrl: userData.avatar,
        iconSize: [40, 40],
        popupAnchor: [0, -20],
        className: "icon train player " + getColorTrainMarker(train.TrainData.Velocity),
      })
    );
  }, [train.TrainData.InBorderStationArea, train.TrainData.Velocity, userData]);

  return (
    <ReactLeafletDriftMarker
      key={train.id}
      duration={1000}
      position={[train.TrainData.Latititute, train.TrainData.Longitute]}
      icon={icon}>
      <Popup>
        <TrainMarkerPopup
          train={train}
          userData={userData}
        />
      </Popup>
      <Tooltip
        offset={[0, 20]}
        direction="bottom"
        permanent>
        {train.TrainNoLocal}
      </Tooltip>
    </ReactLeafletDriftMarker>
  );
};

export default TrainMarker;
