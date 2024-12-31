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
  const [autoZoomLimits] = useSetting("autoZoomLimits");
  const { selectedTrain } = useContext(SelectedTrainContext);

  const trains = useBehaviorSubj(trainsData$);
  const signals = useBehaviorSubj(signalsData$);
  const stations = useBehaviorSubj(stationsData$);

  useEffect(() => {
    if (!map || !autoZoom || !selectedTrain?.follow || selectedTrain.paused) return;

    const handleZoom = () => {
      if (!map) return;

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
        map.zoomOut(totalVisibleObjects / autoZoomLimits[0] / 4);
      } else if (totalVisibleObjects > autoZoomLimits[1]) {
        map.zoomIn(totalVisibleObjects / autoZoomLimits[1] / 4);
      }
    };

    map.on("moveend", handleZoom);
    return () => {
      map.off("moveend", handleZoom);
    };
  }, [autoZoom, map, selectedTrain, signals, stations, trains, autoZoomLimits]);

  return (
    <Checkbox label={t("Settings.autoZoom.Label")} checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} />
  );
};

export default AutoZoomHandler;
