import Sheet from "@mui/joy/Sheet";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";

import { signalsData$, trainsData$ } from "../utils/data-manager";
import MapLinesContext from "../utils/map-lines-context";
import SelectedTrainContext from "../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../utils/steam";
import { useSetting } from "../utils/use-setting";
import useBehaviorSubj from "../utils/useBehaviorSubj";
import TrainMarkerPopup from "./markers/TrainMarkerPopup";

const SelectedTrainInfo: FunctionComponent = () => {
  const map = useMap();
  const { selectedTrain } = useContext(SelectedTrainContext);
  const { setMapLines } = useContext(MapLinesContext);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [useAltTracking] = useSetting("useAltTracking");

  const trains = useBehaviorSubj(trainsData$);

  const [showLineToNextSignal] = useSetting("showLineToNextSignal");

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
        if (!useAltTracking) {
          map.panTo([train.TrainData.Latititute, train.TrainData.Longitute], {
            animate: true,
            duration: 1,
          });
        }

        if (showLineToNextSignal && train.TrainData.SignalInFront) {
          const signalId = train.TrainData.SignalInFront.split("@")[0];
          const signal = signalsData$.value.find((signal) => signal.name === signalId);

          if (signal) {
            setMapLines({
              signal: train.TrainNoLocal,
              lines: [
                {
                  index: 0,
                  color: "#0FF0F0",
                  label: signal.name,
                  coords: [
                    [train.TrainData.Latititute, train.TrainData.Longitute],
                    [signal.lat, signal.lon],
                  ],
                },
              ],
            });
          }
        }
      }
    }
  }, [map, selectedTrain, setMapLines, showLineToNextSignal, trains, useAltTracking]);

  return (
    selectedTrain &&
    selectedTrainData && (
      <Sheet
        variant="outlined"
        sx={{
          p: isCollapsed ? 1 : 2,
          borderRadius: "var(--joy-radius-sm)",
        }}>
        <TrainMarkerPopup
          train={selectedTrainData}
          userData={selectedTrainUserData}
          showTrainRouteButton
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((isCollapsed) => !isCollapsed)}
        />
      </Sheet>
    )
  );
};

export default SelectedTrainInfo;
