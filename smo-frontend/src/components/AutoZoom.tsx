import { useContext, useEffect } from "react";
import { useMap } from "react-leaflet";

import { useSetting } from "../hooks/useSetting";
import { dataProvider } from "../utils/data-manager";
import SelectedTrainContext from "../utils/selected-train-context";

const AutoZoomHandler = () => {
  const map = useMap();
  const [autoZoom] = useSetting("autoZoom");
  const [autoZoomLimits, setAutoZoomLimits] = useSetting("autoZoomLimits");
  const { selectedTrain } = useContext(SelectedTrainContext);

  useEffect(() => {
    if (!map || !autoZoom || !selectedTrain?.follow || selectedTrain.paused) return;

    const handleZoom = () => {
      if (!map) return;

      try {
        const bounds = map.getBounds();
        const visibleTrains = dataProvider.trainsData$.value.filter((train) =>
          bounds.contains([train.TrainData.Latitude, train.TrainData.Longitude]),
        );
        const visibleSignals = dataProvider.signalsData$.value.filter((signal) =>
          bounds.contains([signal.Location.Y, signal.Location.X]),
        );
        const visibleStations = [...dataProvider.stationsData$.value, ...dataProvider.unplayableStations$.value].filter(
          (station) => bounds.contains([station.Latitude, station.Longitude]),
        );
        const selectedTrainData = selectedTrain
          ? dataProvider.trainsData$.value.find((train) => train.TrainNoLocal === selectedTrain.trainNo)
          : null;

        const selectedTrainSpeed = selectedTrainData ? selectedTrainData.TrainData.Velocity : 0;

        const totalVisibleObjects =
          visibleTrains.length * 4 + // trains are more important
          visibleStations.length * 4 + // stations are more important
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
  }, [autoZoom, map, selectedTrain, autoZoomLimits, setAutoZoomLimits]);

  return null;
};

export default AutoZoomHandler;
