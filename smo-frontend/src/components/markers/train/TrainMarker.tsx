import { DivIcon, Icon, IconOptions, type Marker as LeafletMarker } from "leaflet";
import { type FunctionComponent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";

import { useIsDocumentFocused } from "../../../hooks/useIsDocumentFocused";
import { useSetting } from "../../../hooks/useSetting";
import { useProfileData } from "../../../hooks/useProfileData";
import SelectedTrainContext from "../../../utils/selected-train-context";
import { Train } from "../../../utils/types";
import { getColorTrainMarker } from "../../../utils/ui";
import PersonIcon from "../../icons/person.svg?raw";
import ReactLeafletDriftMarker from "../../utils/ReactLeafletDriftMarker";
import BotIcon from "../icons/bot.svg?raw";
import TrainMarkerPopup from "./TrainMarkerPopup";

export interface TrainMarkerProps {
  train: Train;
  layerId: string;
}

// Rotated with the --heading CSS variable on the marker element (see useEffect below),
// so a heading change never rebuilds the icon
const HEADING_ARROW = `<span class="heading"></span>`;

const DEFAULT_ICON = new DivIcon({
  iconSize: [40, 40],
  html: BotIcon + HEADING_ARROW,
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
        ? `<img src="${avatar}" /><span class="tooltip">${trainNo}</span>${HEADING_ARROW}`
        : `${PersonIcon}<span class="tooltip">${trainNo}</span>${HEADING_ARROW}`,
      iconSize: [40, 40],
      popupAnchor: [0, -20],
      className: `icon train player ${colorClass} ${isSelected ? "selected" : ""}`,
    });
  }

  return new DivIcon({
    html: `${BotIcon}<span class="tooltip">${trainNo}</span>${HEADING_ARROW}`,
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    className: `icon train bot ${colorClass} ${inBorderStationArea ? "non-playable" : ""} ${
      isSelected ? "selected" : ""
    }`,
  });
}

const TrainMarker: FunctionComponent<TrainMarkerProps> = ({ train, layerId }) => {
  const map = useMap();
  const focused = useIsDocumentFocused();
  const { selectedTrain } = useContext(SelectedTrainContext);
  const { userData } = useProfileData(train.TrainData.ControlledBySteamID, train.TrainData.ControlledByXboxID);
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(DEFAULT_ICON);
  const [useAltTracking] = useSetting("useAltTracking");
  const [disableSlidingMarkers] = useSetting("disableSlidingMarkers");
  const [showTrainHeadings] = useSetting("showTrainHeadings");
  const [reduceBackgroundUpdates] = useSetting("reduceBackgroundUpdates");
  const [layerOpacities] = useSetting("layerOpacities");
  const opacity = layerOpacities[layerId] ?? layerOpacities.trains ?? 1;

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
        userData?.Avatar || userData?.PersonaName || train.TrainData.ControlledByXboxID || undefined,
      ),
    );
  }, [
    isSelected,
    train.TrainData.InBorderStationArea,
    train.TrainNoLocal,
    trainMarkerColor,
    userData?.Avatar,
    userData?.PersonaName,
    train.TrainData.ControlledByXboxID,
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

  const markerRef = useRef<LeafletMarker | null>(null);
  // callback ref, so it fits both the plain and the drift marker
  const setMarkerRef = useCallback((marker: LeafletMarker | null) => {
    markerRef.current = marker;
  }, []);
  // with the setting off the heading stays null, so heading updates don't even run the effect below
  const heading = showTrainHeadings ? train.TrainData.Heading : null;

  // Runs after react-leaflet swapped the icon element (child effects run first), so it also re-applies
  // the heading to a freshly created icon element. Only the CSS variable changes, the icon is not rebuilt.
  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;

    if (heading == null) {
      element.classList.remove("has-heading");
      return;
    }

    element.style.setProperty("--heading", `${heading}deg`);
    element.classList.add("has-heading");
  }, [heading, icon, disableSlidingMarkers, reduceBackgroundUpdates, focused]);

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const popup = !isSelected && (
    <Popup autoPan={false}>
      {isPopupOpen && <TrainMarkerPopup train={train} userData={userData} showTrainRouteButton />}
    </Popup>
  );

  if (disableSlidingMarkers || (reduceBackgroundUpdates && !focused)) {
    return (
      <Marker
        ref={setMarkerRef}
        position={[train.TrainData.Latitude, train.TrainData.Longitude]}
        icon={icon}
        opacity={opacity}
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
      ref={setMarkerRef}
      key={train.Id}
      duration={1000}
      position={[train.TrainData.Latitude, train.TrainData.Longitude]}
      keepAtCenter={shouldFollow}
      icon={icon}
      opacity={opacity}
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
