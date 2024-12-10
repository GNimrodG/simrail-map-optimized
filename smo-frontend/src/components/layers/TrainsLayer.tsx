import { Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { Train, trainsData$ } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import SelectedTrainContext from "../../utils/selected-train-context";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import TrainMarker from "../markers/TrainMarker";

function getVisibleTrains(trains: Train[], map: LeafletMap | null, selectedTrainNo?: string) {
  try {
    const bounds = map?.getBounds();

    if (!bounds) {
      console.error("Map bounds not available for trains!");
      return trains;
    }

    return trains.filter(
      (train) =>
        train.TrainNoLocal === selectedTrainNo ||
        (!!train.TrainData.Latititute &&
          !!train.TrainData.Longitute &&
          bounds?.contains([train.TrainData.Latititute, train.TrainData.Longitute])),
    );
  } catch (e) {
    console.error("Failed to filter visible trains: ", e);
    return trains; // Fallback to showing all trains
  }
}

const TrainsLayer: FunctionComponent = () => {
  const map = useMap();
  const { selectedTrain } = useContext(SelectedTrainContext);

  const trains = useBehaviorSubj(trainsData$);

  const [visibleTrains, setVisibleTrains] = useState<Train[]>([]);

  useEffect(() => {
    const handler = debounce(() => {
      setVisibleTrains(getVisibleTrains(trains, map, selectedTrain?.trainNo));
    }, 1000);

    if (map) {
      map.on("move", handler);
      map.on("zoom", handler);
      map.on("resize", handler);

      return () => {
        map.off("move", handler);
        map.off("zoom", handler);
        map.off("resize", handler);
      };
    }
  }, [map, trains, selectedTrain?.trainNo]);

  useEffect(() => {
    setVisibleTrains(getVisibleTrains(trains, map, selectedTrain?.trainNo));
  }, [trains, map, selectedTrain?.trainNo]);

  return (
    <LayerGroup>
      {visibleTrains.map((train) => (
        <TrainMarker key={train.id} train={train} />
      ))}
    </LayerGroup>
  );
};

export default TrainsLayer;
