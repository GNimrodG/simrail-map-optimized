import { Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { Train, trainsData$ } from "../../utils/data-manager";
import useBehaviorSubj from "../../utils/useBehaviorSubj";
import TrainMarker from "../markers/TrainMarker";

function getVisibleTrains(trains: Train[], map: LeafletMap | null) {
  const bounds = map?.getBounds();
  return trains.filter(
    (train) =>
      train.TrainData.Latititute &&
      train.TrainData.Longitute &&
      bounds?.contains([train.TrainData.Latititute, train.TrainData.Longitute])
  );
}

const TrainsLayer: FunctionComponent = () => {
  const map = useMap();

  const trains = useBehaviorSubj(trainsData$);

  const [visibleTrains, setVisibleTrains] = useState<Train[]>(getVisibleTrains(trains, map));

  useEffect(() => {
    const handler = () => {
      setVisibleTrains(getVisibleTrains(trains, map));
    };

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
  }, [map, trains]);

  useEffect(() => {
    setVisibleTrains(getVisibleTrains(trains, map));
  }, [trains, map]);

  return (
    <LayerGroup>
      {visibleTrains.map((train) => (
        <TrainMarker
          key={train.id}
          train={train}
        />
      ))}
    </LayerGroup>
  );
};

export default TrainsLayer;
