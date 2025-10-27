import Sheet from "@mui/joy/Sheet";
import { type FunctionComponent, lazy, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";
import { debounceTime, fromEvent, throttleTime } from "rxjs";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { useIsDocumentFocused } from "../hooks/useIsDocumentFocused";
import { useSetting } from "../hooks/useSetting";
import { useSteamProfileData } from "../hooks/useSteamProfileData";
import { dataProvider } from "../utils/data-manager";
import MapLinesContext from "../utils/map-lines-context";
import SelectedTrainContext from "../utils/selected-train-context";
import Loading from "./Loading";

const TrainMarkerPopup = lazy(() => import("./markers/train/TrainMarkerPopup"));

const SelectedTrainInfo: FunctionComponent = () => {
  const map = useMap();
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { setMapLines } = useContext(MapLinesContext);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [useAltTracking] = useSetting("useAltTracking");

  const trains = useBehaviorSubj(dataProvider.trainsData$);

  const [showLineToNextSignal] = useSetting("showLineToNextSignal");

  const selectedTrainData = useMemo(() => {
    if (!selectedTrain) return null;

    const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
    if (!train) return null;

    return train;
  }, [selectedTrain, trains]);

  const { userData: selectedTrainUserData } = useSteamProfileData(selectedTrainData?.TrainData.ControlledBySteamID);

  // Pause following when dragging the map and resume after a delay
  useEffect(() => {
    if (!map || !selectedTrain?.follow) {
      return;
    }

    let isPaused = false;
    let timeout: number;

    const setPaused = (paused: boolean) => {
      isPaused = paused;
      setSelectedTrain(
        selectedTrain?.trainNo ? { trainNo: selectedTrain.trainNo, follow: selectedTrain.follow, paused } : null,
      );
    };

    setPaused(false);

    const clearPause = () => {
      setPaused(false);
    };

    // Pause following when dragging the map
    const startSub = fromEvent(map, "dragstart")
      .pipe(throttleTime(100))
      .subscribe(() => {
        if (isPaused) {
          clearTimeout(timeout);
          timeout = setTimeout(clearPause, 5000);
          return;
        }

        setPaused(true);
      });

    // This is to prevent the train from jumping back to the center of the map while dragging
    const middleSub = fromEvent(map, "drag")
      .pipe(debounceTime(100))
      .subscribe(() => {
        if (isPaused) {
          clearTimeout(timeout);
          timeout = setTimeout(clearPause, 5000);
        }
      });

    // Resume following after dragging ends
    const endSub = fromEvent(map, "dragend")
      .pipe(debounceTime(500))
      .subscribe(() => {
        if (isPaused) {
          clearTimeout(timeout);
          timeout = setTimeout(clearPause, 5000);
        }
      });

    return () => {
      startSub.unsubscribe();
      middleSub.unsubscribe();
      endSub.unsubscribe();
      clearTimeout(timeout);
    };
  }, [selectedTrain?.trainNo, selectedTrain?.follow, map, setSelectedTrain]);

  const focused = useIsDocumentFocused();
  const [reduceBackgroundUpdates] = useSetting("reduceBackgroundUpdates");

  // Follow selected train
  useEffect(() => {
    if (selectedTrain?.follow && map) {
      const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
      if (train) {
        if (!useAltTracking && !selectedTrain.paused) {
          if (reduceBackgroundUpdates && !focused) {
            map.setView([train.TrainData.Latitude, train.TrainData.Longitude], map.getZoom(), { animate: false });
          } else {
            map.panTo([train.TrainData.Latitude, train.TrainData.Longitude], {
              animate: true,
              duration: 1,
            });
          }
        }

        if (showLineToNextSignal && train.TrainData.SignalInFront) {
          const signalId = train.TrainData.SignalInFront.split("@")[0];
          const signal = dataProvider.signalsData$.value.find((signal) => signal.Name === signalId);

          if (signal) {
            setMapLines({
              signal: train.TrainNoLocal,
              lines: [
                {
                  index: 0,
                  color: "#0FF0F0",
                  label: signal.Name,
                  coords: [
                    [train.TrainData.Latitude, train.TrainData.Longitude],
                    [signal.Location.Y, signal.Location.X],
                  ],
                },
              ],
            });
          } else {
            setMapLines(null);
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
        sx={(theme) => ({
          p: isCollapsed ? 1 : 2,
          mr: 1,
          borderRadius: "var(--joy-radius-sm)",
          // fix for the attribution overlapping on small screens
          [theme.breakpoints.down("lg")]: {
            mb: 3,
          },
          [theme.breakpoints.down("md")]: {
            mb: 5,
          },
          [theme.breakpoints.down("sm")]: {
            mb: 7,
          },
        })}>
        <Suspense fallback={<Loading />}>
          <TrainMarkerPopup
            train={selectedTrainData}
            userData={selectedTrainUserData}
            showTrainRouteButton
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed((isCollapsed) => !isCollapsed)}
          />
        </Suspense>
      </Sheet>
    )
  );
};

export default SelectedTrainInfo;
