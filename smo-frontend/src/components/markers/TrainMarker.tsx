import { Circle, Fill, Icon, Stroke, Style, Text } from "ol/style";
import { StyleLike } from "ol/style/Style";
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
import { getCssVarValue } from "../utils/general-utils";
import { getRoundedImage } from "../utils/image";
import BotIcon from "./icons/bot.svg?raw";
import TrainMarkerPopup from "./TrainMarkerPopup";

export interface TrainMarkerProps {
  train: Train;
}

const BOT_ICON_SRC = "data:image/svg+xml;utf8," + BotIcon;

const DEFAULT_ICON = new Style({
  image: new Icon({
    size: [40, 40],
    src: BOT_ICON_SRC,
  }),
});

function getIcon(
  trainNo: string,
  colorClass: string,
  inBorderStationArea: boolean,
  isSelected: boolean,
  opacity: number,
  avatar?: string,
): StyleLike {
  const text = new Text({
    text: trainNo,
    offsetY: 36,
    font: getCssVarValue("--joy-fontSize-md") + " Inter",
    fill: new Fill({ color: getCssVarValue("--joy-palette-text-primary") }),
    backgroundFill: new Fill({
      color: isSelected
        ? getCssVarValue("--joy-palette-primary-500")
        : getCssVarValue("--joy-palette-background-surface"),
    }),
    backgroundStroke: new Stroke({ color: getCssVarValue("--joy-palette-neutral-outlinedBorder"), width: 1 }),
    padding: [2, 4, 2, 4], // Add padding to create space for the border radius
  });

  const background = new Style({
    image: new Circle({
      fill: new Fill({ color: getCssVarValue("--joy-palette-background-surface") }),
      radius: 20,
    }),
  });

  const overlay = new Style({
    image: new Circle({
      stroke: new Stroke({ color: getCssVarValue(`--joy-palette-${colorClass}-600`), width: 4 }),
      radius: 18,
    }),
  });

  if (avatar) {
    const image = getRoundedImage(avatar);

    return [
      background,
      new Style({
        image: new Icon({
          img: image,
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
        src: BOT_ICON_SRC,
        size: [25, 26],
        color: getCssVarValue(inBorderStationArea ? "--joy-palette-warning-400" : "--joy-palette-text-primary"),
        opacity,
      }),
      text,
    }),
    overlay,
  ];
}

const TrainMarker: FunctionComponent<TrainMarkerProps> = ({ train }) => {
  const map = useMap();
  const { selectedTrain } = useContext(SelectedTrainContext);
  const [userData, setUserData] = useState<ProfileResponse | null>(null);
  const [icon, setIcon] = useState<StyleLike>(DEFAULT_ICON);
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
    <Popup className="train-popup" offset={[0, -30]}>
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
