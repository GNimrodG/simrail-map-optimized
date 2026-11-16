import { useContext, useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { useSetting } from "../hooks/useSetting";
import { dataProvider } from "../utils/data-manager";
import { goToStation } from "../utils/geom-utils";
import SelectedTrainContext from "../utils/selected-train-context";
import { isSteamId } from "../utils/steam-id";

/**
 * Follows the user's own train, or shows their station, when they take one over on the selected server (by the Steam
 * ID of the mySteamId setting). Only when that changes: the user can still look around or follow another train
 * meanwhile, and a page opened with a train or station in its URL keeps that one.
 */
const AutoFollowMe = () => {
  const map = useMap();
  const [mySteamId] = useSetting("mySteamId");
  const [autoFollowMe] = useSetting("autoFollowMe");
  const trains = useBehaviorSubj(dataProvider.trainsData$);
  const stations = useBehaviorSubj(dataProvider.stationsData$);
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);

  // what the user controlled at the last check ("train:<id>" / "station:<id>"), undefined before the first one
  const lastTarget = useRef<string | null | undefined>(undefined);
  const [openedWithHash] = useState(() => globalThis.location.hash.length > 1);

  const enabled = autoFollowMe && isSteamId(mySteamId);
  const myTrain = enabled ? trains?.find((train) => train.TrainData.ControlledBySteamID === mySteamId) : undefined;
  const myStation =
    enabled && !myTrain ? stations?.find((station) => station.DispatchedBy?.[0]?.SteamId === mySteamId) : undefined;
  const target = myTrain ? `train:${myTrain.Id}` : myStation ? `station:${myStation.Id}` : null;
  const dataLoaded = !!trains && !!stations;

  useEffect(() => {
    if (!map || !dataLoaded) return;

    const previous = lastTarget.current;
    lastTarget.current = target;
    if (!target || target === previous) return;
    if (previous === undefined && openedWithHash) return;

    if (myTrain) {
      setSelectedTrain({ trainNo: myTrain.TrainNoLocal, follow: true, paused: false });
    } else if (myStation) {
      setSelectedTrain(selectedTrain ? { ...selectedTrain, follow: false } : null);
      goToStation(myStation, map);
    }
  }, [map, dataLoaded, target, openedWithHash, myTrain, myStation, selectedTrain, setSelectedTrain]);

  return null;
};

export default AutoFollowMe;
