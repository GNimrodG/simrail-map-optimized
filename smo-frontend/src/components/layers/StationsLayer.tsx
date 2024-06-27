import { Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { Station, stationsData$ } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import useBehaviorSubj from "../../utils/useBehaviorSubj";
import StationMarker from "../markers/StationMarker";

function getVisibleStations(stations: Station[], map: LeafletMap | null) {
  const bounds = map?.getBounds();
  return stations.filter((station) => bounds?.contains([station.Latititude, station.Longitude]));
}

const StationsLayer: FunctionComponent = () => {
  const map = useMap();

  const stations = useBehaviorSubj(stationsData$);

  const [visibleStations, setVisibleStations] = useState<Station[]>([]);

  useEffect(() => {
    const handler = debounce(() => {
      setVisibleStations(getVisibleStations(stations, map));
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
  }, [map, stations]);

  useEffect(() => {
    setVisibleStations(getVisibleStations(stations, map));
  }, [stations, map]);

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
