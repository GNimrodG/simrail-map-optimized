import Sheet from "@mui/joy/Sheet";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";

import { trainsData$ } from "../utils/data-manager";
import SelectedTrainContext from "../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../utils/steam";
import useBehaviorSubj from "../utils/useBehaviorSubj";
import TrainMarkerPopup from "./markers/TrainMarkerPopup";

const SelectedTrainInfo: FunctionComponent = () => {
  const map = useMap();
  const { selectedTrain } = useContext(SelectedTrainContext);

  const trains = useBehaviorSubj(trainsData$);

  const [selectedTrainUserData, setSelectedTrainUserData] = useState<ProfileResponse | null>(null);

  const selectedTrainData = useMemo(() => {
    if (!selectedTrain) return null;

    const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
    if (!train) return null;

    if (!train.TrainData.ControlledBySteamID) {
      setSelectedTrainUserData(null);
      return train;
    }

    getSteamProfileInfo(train.TrainData.ControlledBySteamID).then((profile) => {
      setSelectedTrainUserData(profile);
    });

    return train;
  }, [selectedTrain, trains]);

  useEffect(() => {
    if (selectedTrain?.follow && map) {
      const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
      if (train) {
        map.panTo([train.TrainData.Latititute, train.TrainData.Longitute], {
          animate: true,
          duration: 1,
        });
      }
    }
  }, [map, selectedTrain, trains]);

  return (
    selectedTrain &&
    selectedTrainData && (
      <Sheet
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: "var(--joy-radius-sm)",
        }}>
        <TrainMarkerPopup
          train={selectedTrainData}
          userData={selectedTrainUserData}
          showTrainRouteButton
        />
      </Sheet>
    )
  );
};

export default SelectedTrainInfo;
