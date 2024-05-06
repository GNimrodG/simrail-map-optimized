import { Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { Train } from "../../utils/data-manager";
import TrainMarker from "../markers/TrainMarker";

export interface TrainsLayerProps {
  trains: Train[];
}

function getVisibleTrains(trains: Train[], map: LeafletMap | null) {
  const bounds = map?.getBounds();
  return trains.filter(
    (train) =>
      train.TrainData.Latititute &&
      train.TrainData.Longitute &&
      bounds?.contains([train.TrainData.Latititute, train.TrainData.Longitute])
  );
}

const TrainsLayer: FunctionComponent<TrainsLayerProps> = ({ trains }) => {
  const map = useMap();

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
