import type { Map as LeafletMap } from "leaflet";
import debounce from "lodash/debounce";
import { type FunctionComponent, useContext, useEffect, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { dataProvider } from "../../utils/data-manager";
import SelectedTrainContext from "../../utils/selected-train-context";
import { Train } from "../../utils/types";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import TrainMarker from "../markers/TrainMarker";

function getVisibleTrains(trains: Train[], map: LeafletMap | null, selectedTrainNo?: string) {
  try {
    const mapBounds = map?.getBounds();

    if (!mapBounds) {
      console.error("Map bounds not available for trains!");
      return trains;
    }

    // Early return for empty arrays
    if (!trains.length) return [];

    // Extract bounds values once for better performance
    const north = mapBounds.getNorth();
    const south = mapBounds.getSouth();
    const east = mapBounds.getEast();
    const west = mapBounds.getWest();

    // Filter signals using direct coordinate comparison instead of method calls
    return trains.filter((train) => {
      // If a train is selected, always show it
      if (selectedTrainNo && train.TrainNoLocal === selectedTrainNo) {
        return true;
      }

      // Check if the train's coordinates are within the map bounds
      const lat = train.TrainData.Latitude;
      const lng = train.TrainData.Longitude;
      // Sometimes the coordinates are not available, so we need to check for that
      return !!lat && !!lng && lat <= north && lat >= south && lng <= east && lng >= west;
    });
  } catch (e) {
    console.error("Failed to filter visible trains: ", e);
    return trains; // Fallback to showing all trains
  }
}

const TrainsLayer: FunctionComponent = () => {
  const map = useMap();
  const { selectedTrain } = useContext(SelectedTrainContext);

  const trains = useBehaviorSubj(dataProvider.trainsData$);

  const [visibleTrains, setVisibleTrains] = useState<Train[]>([]);

  useEffect(() => {
    if (!map) return; // Early return if map is not available

    const handler = debounce(function (this: LeafletMap) {
      setVisibleTrains(getVisibleTrains(dataProvider.trainsData$.value, this, selectedTrain?.trainNo));
    }, 500);

    // Map event handling
    map.on("move", handler);
    map.on("zoom", handler);
    map.on("resize", handler);

    return () => {
      handler.cancel(); // Cancel any pending debounced calls
      map.off("move", handler);
      map.off("zoom", handler);
      map.off("resize", handler);
    };
  }, [map, selectedTrain?.trainNo]);

  useEffect(() => {
    if (map) {
      setVisibleTrains(getVisibleTrains(trains, map, selectedTrain?.trainNo));
    }
  }, [trains, map, selectedTrain?.trainNo]);

  return (
    <LayerGroup>
      {visibleTrains.map((train) => (
        <TrainMarker key={"train_" + train.Id} train={train} />
      ))}
    </LayerGroup>
  );
};

export default TrainsLayer;
