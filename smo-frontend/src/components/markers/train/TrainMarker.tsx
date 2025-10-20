import { DivIcon, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";

import { useIsDocumentFocused } from "../../../hooks/useIsDocumentFocused";
import { useSetting } from "../../../hooks/useSetting";
import { useSteamProfileData } from "../../../hooks/useSteamProfileData";
import SelectedTrainContext from "../../../utils/selected-train-context";
import { Train } from "../../../utils/types";
import { getColorTrainMarker } from "../../../utils/ui";
import PersonIcon from "../../icons/person.svg?raw";
import ReactLeafletDriftMarker from "../../utils/ReactLeafletDriftMarker";
import BotIcon from "../icons/bot.svg?raw";
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
      html: avatar.startsWith("http")
        ? `<img src="${avatar}" /><span class="tooltip">${trainNo}</span>`
        : `${PersonIcon}<span class="tooltip">${trainNo}</span>`,
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
  const map = useMap();
  const focused = useIsDocumentFocused();
  const { selectedTrain } = useContext(SelectedTrainContext);
  const { userData } = useSteamProfileData(train.TrainData.ControlledBySteamID);
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(DEFAULT_ICON);
  const [useAltTracking] = useSetting("useAltTracking");
  const [disableSlidingMarkers] = useSetting("disableSlidingMarkers");
  const [reduceBackgroundUpdates] = useSetting("reduceBackgroundUpdates");
  const [layerOpacities] = useSetting("layerOpacities");

  const trainMarkerColor = useMemo(() => getColorTrainMarker(train.TrainData.Velocity), [train.TrainData.Velocity]);

  const isSelected = useMemo(
    () => selectedTrain?.trainNo === train.TrainNoLocal,
    [selectedTrain?.trainNo, train.TrainNoLocal],
  );

  const shouldFollow = useMemo(
    () => isSelected && selectedTrain?.follow && !selectedTrain.paused && useAltTracking,
    [isSelected, selectedTrain?.follow, selectedTrain?.paused, useAltTracking],
  );

  useEffect(() => {
    setIcon(
      getIcon(
        train.TrainNoLocal,
        trainMarkerColor,
        train.TrainData.InBorderStationArea,
        isSelected,
        userData?.Avatar || userData?.PersonaName,
      ),
    );
  }, [
    isSelected,
    train.TrainData.InBorderStationArea,
    train.TrainNoLocal,
    trainMarkerColor,
    userData?.Avatar,
    userData?.PersonaName,
  ]);

  useEffect(() => {
    if (!map || !shouldFollow || (!disableSlidingMarkers && (!reduceBackgroundUpdates || focused))) {
      return;
    }

    if (reduceBackgroundUpdates && !focused) {
      map.setView([train.TrainData.Latitude, train.TrainData.Longitude], map.getZoom(), { animate: false });
      return;
    }

    map.flyTo([train.TrainData.Latitude, train.TrainData.Longitude], map.getZoom(), { animate: true, duration: 0.5 });
  }, [
    disableSlidingMarkers,
    reduceBackgroundUpdates,
    focused,
    map,
    shouldFollow,
    train.TrainData.Latitude,
    train.TrainData.Longitude,
  ]);

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const popup = !isSelected && (
    <Popup autoPan={false}>
      {isPopupOpen && <TrainMarkerPopup train={train} userData={userData} showTrainRouteButton />}
    </Popup>
  );

  if (disableSlidingMarkers || (reduceBackgroundUpdates && !focused)) {
    return (
      <Marker
        position={[train.TrainData.Latitude, train.TrainData.Longitude]}
        icon={icon}
        eventHandlers={{
          popupopen: () => setIsPopupOpen(true),
          popupclose: () => setIsPopupOpen(false),
        }}
        pane="trainsPane">
        {popup}
      </Marker>
    );
  }

  return (
    <ReactLeafletDriftMarker
      key={train.Id}
      duration={1000}
      position={[train.TrainData.Latitude, train.TrainData.Longitude]}
      keepAtCenter={shouldFollow}
      icon={icon}
      opacity={layerOpacities["trains"]}
      eventHandlers={{
        popupopen: () => setIsPopupOpen(true),
        popupclose: () => setIsPopupOpen(false),
      }}
      pane="trainsPane">
      {popup}
    </ReactLeafletDriftMarker>
  );
};

export default TrainMarker;
