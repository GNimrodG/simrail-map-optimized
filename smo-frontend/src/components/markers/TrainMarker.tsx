import { DivIcon, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import { Train } from "../../utils/data-manager";
import SelectedTrainContext from "../../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker } from "../../utils/ui";
import { useSetting } from "../../utils/use-setting";
import ReactLeafletDriftMarker from "../utils/ReactLeafletDriftMarker";
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
  isSelected: boolean,
  avatar?: string,
) {
  if (avatar) {
    return new DivIcon({
      html: `<img src="${avatar}" /><span class="tooltip">${trainNo}</span>`,
      iconSize: [40, 40],
      popupAnchor: [0, -20],
      className: `icon train player ${colorClass} ${isSelected ? "selected" : ""}`,
    });
  }

  return new DivIcon({
    html: `${BotIcon}<span class="tooltip">${trainNo}</span>`,
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    className: `icon train bot ${colorClass} ${inBorderStationArea ? "non-playable" : ""} ${
      isSelected ? "selected" : ""
    }`,
  });
}

const TrainMarker: FunctionComponent<TrainMarkerProps> = ({ train }) => {
  const { selectedTrain } = useContext(SelectedTrainContext);
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(DEFAULT_ICON);
  const [useAltTracking] = useSetting("useAltTracking");
  const [disableSlidingMarkers] = useSetting("disableSlidingMarkers");
  const [layerOpacities] = useSetting("layerOpacities");

  useEffect(() => {
    if (!train.TrainData.ControlledBySteamID) {
      setUserData(null);
      return;
    }

    getSteamProfileInfo(train.TrainData.ControlledBySteamID).then((profile) => {
      setUserData(profile);
    });
  }, [train.TrainData.ControlledBySteamID]);

  const trainMarkerColor = useMemo(() => getColorTrainMarker(train.TrainData.Velocity), [train.TrainData.Velocity]);

  const isSelected = useMemo(
    () => selectedTrain?.trainNo === train.TrainNoLocal,
    [selectedTrain?.trainNo, train.TrainNoLocal],
  );

  const shouldFollow = useMemo(
    () => isSelected && selectedTrain?.follow && useAltTracking,
    [selectedTrain?.follow, isSelected, useAltTracking],
  );

  useEffect(() => {
    setIcon(
      getIcon(train.TrainNoLocal, trainMarkerColor, train.TrainData.InBorderStationArea, isSelected, userData?.avatar),
    );
  }, [isSelected, train.TrainData.InBorderStationArea, train.TrainNoLocal, trainMarkerColor, userData?.avatar]);

  const popup = !isSelected && (
    <Popup autoPan={false}>
      <TrainMarkerPopup train={train} userData={userData} showTrainRouteButton />
    </Popup>
  );

  if (disableSlidingMarkers) {
    return (
      <Marker position={[train.TrainData.Latititute, train.TrainData.Longitute]} icon={icon}>
        {popup}
      </Marker>
    );
  }

  return (
    <ReactLeafletDriftMarker
      key={train.id}
      duration={1000}
      position={[train.TrainData.Latititute, train.TrainData.Longitute]}
      keepAtCenter={shouldFollow}
      icon={icon}
      opacity={layerOpacities["trains"]}
    >
      {popup}
    </ReactLeafletDriftMarker>
  );
};

export default TrainMarker;
