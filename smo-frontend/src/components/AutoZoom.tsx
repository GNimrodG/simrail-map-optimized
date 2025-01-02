import Checkbox from "@mui/joy/Checkbox";
import { useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";

import { signalsData$, stationsData$, trainsData$ } from "../utils/data-manager";
import SelectedTrainContext from "../utils/selected-train-context";
import useBehaviorSubj from "../utils/use-behaviorSubj";
import { useSetting } from "../utils/use-setting";

const AutoZoomHandler = () => {
  const { t } = useTranslation();
  const map = useMap();
  const [autoZoom, setAutoZoom] = useSetting("autoZoom");
  const [autoZoomLimits, setAutoZoomLimits] = useSetting("autoZoomLimits");
  const { selectedTrain } = useContext(SelectedTrainContext);

  const trains = useBehaviorSubj(trainsData$);
  const signals = useBehaviorSubj(signalsData$);
  const stations = useBehaviorSubj(stationsData$);

  useEffect(() => {
    if (!map || !autoZoom || !selectedTrain?.follow || selectedTrain.paused) return;

    const handleZoom = () => {
      if (!map) return;

      try {
        const bounds = map.getBounds();
        const visibleTrains = trains.filter((train) =>
          bounds.contains([train.TrainData.Latititute, train.TrainData.Longitute]),
        );
        const visibleSignals = signals.filter((signal) => bounds.contains([signal.lat, signal.lon]));
        const visibleStations = stations.filter((station) => bounds.contains([station.Latititude, station.Longitude]));
        const selectedTrainData = selectedTrain
          ? trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo)
          : null;

        const selectedTrainSpeed = selectedTrainData ? selectedTrainData.TrainData.Velocity : 0;

        const totalVisibleObjects =
          visibleTrains.length * 4 + // trains are more important
          visibleStations.length * 2 + // stations are more important
          visibleSignals.length +
          (200 - selectedTrainSpeed); // the slower the more important, max speed is 200

        if (totalVisibleObjects < autoZoomLimits[0]) {
          const zoomOutFactor = autoZoomLimits[0] / totalVisibleObjects / 4;
          if (zoomOutFactor > 0.1) {
            map.zoomOut(zoomOutFactor);
          }
        } else if (totalVisibleObjects > autoZoomLimits[1]) {
          const zoomInFactor = totalVisibleObjects / autoZoomLimits[1] / 4;
          if (zoomInFactor > 0.1) {
            map.zoomIn(zoomInFactor);
          }
        }
      } catch (error) {
        if (error instanceof Error && (error.message === "too much recursion" || error.message === "regexp too big")) {
          if (autoZoomLimits[0] !== 200 || autoZoomLimits[1] !== 250) {
            // reset the autoZoomLimits to default values
            map.off("moveend", handleZoom);
            setAutoZoomLimits([200, 250]);

            console.error("AutoZoomHandler: too much recursion, resetting autoZoomLimits to default values");
          }
          // else do nothing
        }

        console.error("AutoZoomHandler: ", error);
      }
    };

    map.on("moveend", handleZoom);
    return () => {
      map.off("moveend", handleZoom);
    };
  }, [autoZoom, map, selectedTrain, signals, stations, trains, autoZoomLimits, setAutoZoomLimits]);

  return (
    <Checkbox label={t("Settings.autoZoom.Label")} checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} />
  );
};

export default AutoZoomHandler;
