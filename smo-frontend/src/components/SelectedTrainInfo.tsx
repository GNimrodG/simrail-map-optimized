import Sheet from "@mui/joy/Sheet";
import { type FunctionComponent, lazy, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { debounceTime, fromEvent, merge, throttleTime } from "rxjs";

import { signalsData$, trainsData$ } from "../utils/data-manager";
import { wgsToMercator } from "../utils/geom-utils";
import MapLinesContext from "../utils/map-lines-context";
import SelectedTrainContext from "../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../utils/steam";
import useBehaviorSubj from "../utils/use-behaviorSubj";
import { useSetting } from "../utils/use-setting";
import Loading from "./Loading";
import { useMap } from "./map/MapProvider";

const TrainMarkerPopup = lazy(() => import("./markers/TrainMarkerPopup"));

const SelectedTrainInfo: FunctionComponent = () => {
  const map = useMap();
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
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
    const dragSub = merge(
      fromEvent(map, "pointerdrag").pipe(throttleTime(1000)), // pause immediately on the first drag
      fromEvent(map, "pointerdrag").pipe(debounceTime(100)), // keep pausing while dragging
    ).subscribe(() => {
      if (!isPaused) setPaused(true);
      clearTimeout(timeout);
      timeout = setTimeout(clearPause, 5000);
    });

    return () => {
      dragSub.unsubscribe();
      clearTimeout(timeout);
    };
  }, [selectedTrain?.trainNo, selectedTrain?.follow, map, setSelectedTrain]);

  // Follow selected train
  useEffect(() => {
    if (selectedTrain?.follow && map) {
      const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
      if (train) {
        if (!useAltTracking && !selectedTrain.paused) {
          map.getView().animate({
            center: wgsToMercator([train.TrainData.Latititute, train.TrainData.Longitute]),
            duration: 1000,
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
