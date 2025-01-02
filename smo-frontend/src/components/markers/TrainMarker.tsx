import { Fill, Icon, Stroke, Style, Text } from "ol/style";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";

import { Train } from "../../utils/data-manager";
import { wgsToMercator } from "../../utils/geom-utils";
import SelectedTrainContext from "../../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker } from "../../utils/ui";
import { useSetting } from "../../utils/use-setting";
import { useMap } from "../map/MapProvider";
import Marker from "../map/Marker";
import Popup from "../map/Popup";
import BotIcon from "./icons/bot.svg?raw";
import TrainMarkerPopup from "./TrainMarkerPopup";

export interface TrainMarkerProps {
  train: Train;
}

const DEFAULT_ICON = new Style({
  image: new Icon({
    size: [40, 40],
    src: "data:image/svg+xml;utf8," + BotIcon,
  }),
});

const FONT_FAMILY =
  'var(--joy-fontFamily-body, "Inter",var(--joy-fontFamily-fallback, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol") )';

function getIcon(
  trainNo: string,
  colorClass: string,
  inBorderStationArea: boolean,
  isSelected: boolean,
  opacity: number,
  avatar?: string,
) {
  const text = new Text({
    text: trainNo,
    font: "26px " + FONT_FAMILY,
    offsetY: 30,
    fill: new Fill({ color: "white" }),
    stroke: new Stroke({ color: "white", width: 1 }),
    backgroundFill: new Fill({ color: "black" }),
    backgroundStroke: new Stroke({ color: "black", width: 1 }),
  });

  if (avatar) {
    return new Style({
      image: new Icon({
        // html: `<img src="${avatar}" /><span class="tooltip">${trainNo}</span>`,
        src: avatar,
        size: [24, 24],
        opacity,
        // className: `icon train player ${colorClass} ${isSelected ? "selected" : ""}`,
      }),
      text,
    });
  }

  return new Style({
    image: new Icon({
      // html: `${BotIcon}<span class="tooltip">${trainNo}</span>`,
      src: "data:image/svg+xml;utf8," + BotIcon,
      size: [24, 24],
      opacity,
      // className: `icon train bot ${colorClass} ${inBorderStationArea ? "non-playable" : ""} ${
      //   isSelected ? "selected" : ""
      // }`,
    }),
    text,
  });
}

const TrainMarker: FunctionComponent<TrainMarkerProps> = ({ train }) => {
  const map = useMap();
  const { selectedTrain } = useContext(SelectedTrainContext);
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<Style>(DEFAULT_ICON);
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
        layerOpacities["trains"],
        userData?.avatar,
      ),
    );
  }, [
    isSelected,
    layerOpacities,
    train.TrainData.InBorderStationArea,
    train.TrainNoLocal,
    trainMarkerColor,
    userData?.avatar,
  ]);

  useEffect(() => {
    if (!shouldFollow || !disableSlidingMarkers) {
      return;
    }

    map
      ?.getView()
      .animate({ center: wgsToMercator([train.TrainData.Latititute, train.TrainData.Longitute]), duration: 500 });
  }, [disableSlidingMarkers, map, shouldFollow, train.TrainData.Latititute, train.TrainData.Longitute]);

  const popup = !isSelected && (
    <Popup>
      <TrainMarkerPopup train={train} userData={userData} showTrainRouteButton />
    </Popup>
  );

  useEffect(() => {
    console.log("TrainMarker: created", train.TrainNoLocal);
    return () => console.log("TrainMarker: destroyed", train.TrainNoLocal);
  }, [train.TrainNoLocal]);

  if (disableSlidingMarkers) {
    return (
      <Marker position={[train.TrainData.Latititute, train.TrainData.Longitute]} icon={icon}>
        {popup}
      </Marker>
    );
  }

  return (
    <Marker
      key={train.id}
      duration={1000}
      position={[train.TrainData.Latititute, train.TrainData.Longitute]}
      keepAtCenter={shouldFollow}
      icon={icon}>
      {popup}
    </Marker>
  );
};

export default TrainMarker;
