import { DivIcon, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useEffect, useMemo, useState } from "react";
import { Popup } from "react-leaflet";
import ReactLeafletDriftMarker from "react-leaflet-drift-marker";

import { Train } from "../../utils/data-manager";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker } from "../../utils/ui";
import BotIcon from "./icons/bot.svg?raw";
import TrainMarkerPopup from "./TrainMarkerPopup";

export interface TrainMarkerProps {
  train: Train;
}

const DEFAULT_ICON = new DivIcon({
  iconSize: [40, 40],
  html: BotIcon,
  className: "icon train bot",
});

function getIcon(
  trainNo: string,
  colorClass: string,
  inBorderStationArea: boolean,
  avatar?: string
) {
  if (avatar) {
    return new DivIcon({
      html: `<img src="${avatar}" /><span class="tooltip">${trainNo}</span>`,
      iconSize: [40, 40],
      popupAnchor: [0, -20],
      className: `icon train player ${colorClass}`,
    });
  }

  return new DivIcon({
    html: `${BotIcon}<span class="tooltip">${trainNo}</span>`,
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    className: `icon train bot ${colorClass} ${inBorderStationArea ? "non-playable" : ""}`,
  });
}

const TrainMarker: FunctionComponent<TrainMarkerProps> = ({ train }) => {
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(DEFAULT_ICON);

  useEffect(() => {
    if (!train.TrainData.ControlledBySteamID) {
      setUserData(null);
      return;
    }

    getSteamProfileInfo(train.TrainData.ControlledBySteamID).then((profile) => {
      setUserData(profile);
    });
  }, [train.TrainData.ControlledBySteamID]);

  const trainMarkerColor = useMemo(
    () => getColorTrainMarker(train.TrainData.Velocity),
    [train.TrainData.Velocity]
  );

  useEffect(() => {
    setIcon(
      getIcon(
        train.TrainNoLocal,
        trainMarkerColor,
        train.TrainData.InBorderStationArea,
        userData?.avatar
      )
    );
  }, [train.TrainData.InBorderStationArea, train.TrainNoLocal, trainMarkerColor, userData?.avatar]);

  return (
    <ReactLeafletDriftMarker
      key={train.id}
      duration={1000}
      position={[train.TrainData.Latititute, train.TrainData.Longitute]}
      icon={icon}>
      <Popup autoPan={false}>
        <TrainMarkerPopup
          train={train}
          userData={userData}
          showTrainRouteButton
        />
      </Popup>
    </ReactLeafletDriftMarker>
  );
};

export default TrainMarker;
