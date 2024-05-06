import { Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { Station } from "../../utils/data-manager";
import StationMarker from "../markers/StationMarker";

export interface StationsLayerProps {
  stations: Station[];
}

function getVisibleStations(stations: Station[], map: LeafletMap | null) {
  const bounds = map?.getBounds();
  return stations.filter((station) => bounds?.contains([station.Latititude, station.Longitude]));
}

const StationsLayer: FunctionComponent<StationsLayerProps> = ({ stations }) => {
  const map = useMap();
  const [visibleStations, setVisibleStations] = useState<Station[]>(
    getVisibleStations(stations, map)
  );

  useEffect(() => {
    const handler = () => {
      setVisibleStations(getVisibleStations(stations, map));
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
  }, [map, stations]);

  return (
    <LayerGroup>
      {visibleStations?.map((stationIcon) => (
        <StationMarker
          key={stationIcon.id}
          station={stationIcon}
        />
      ))}
    </LayerGroup>
  );
};

export default StationsLayer;
