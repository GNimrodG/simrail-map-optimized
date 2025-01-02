import { containsCoordinate } from "ol/extent";
import OlMap from "ol/Map";
import { type FunctionComponent, useContext, useEffect, useState } from "react";

import { Train, trainsData$ } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import { wgsToMercator } from "../../utils/geom-utils";
import SelectedTrainContext from "../../utils/selected-train-context";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import LayerGroup from "../map/LayerGroup";
import { useMap } from "../map/MapProvider";
import TrainMarker from "../markers/TrainMarker";

function getVisibleTrains(trains: Train[], map: OlMap | null, selectedTrainNo?: string) {
  try {
    const bounds = map?.getView().calculateExtent(map.getSize());

    if (!bounds) {
      console.error("Map bounds not available for trains!");
      return trains;
    }

    return trains.filter(
      (train) =>
        train.TrainNoLocal === selectedTrainNo ||
        (!!train.TrainData.Latititute &&
          !!train.TrainData.Longitute &&
          containsCoordinate(bounds, wgsToMercator([train.TrainData.Latititute, train.TrainData.Longitute]))),
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
      map.on("pointerdrag", handler);
      map.on("moveend", handler);

      return () => {
        map.un("pointerdrag", handler);
        map.un("moveend", handler);
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
