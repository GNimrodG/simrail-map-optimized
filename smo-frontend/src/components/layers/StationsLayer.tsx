import { containsCoordinate } from "ol/extent";
import OlMap from "ol/Map";
import { type FunctionComponent, useEffect, useState } from "react";

import { Station, stationsData$ } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import { wgsToMercator } from "../../utils/geom-utils";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import LayerGroup from "../map/LayerGroup";
import { useMap } from "../map/MapProvider";
import StationMarker from "../markers/StationMarker";

function getVisibleStations(stations: Station[], map: OlMap | null) {
  try {
    const bounds = map?.getView().calculateExtent(map.getSize());

    if (!bounds) {
      console.error("Map bounds not available for stations!");
      return stations;
    }

    return stations.filter((station) =>
      containsCoordinate(bounds, wgsToMercator([station.Latititude, station.Longitude])),
    );
  } catch (e) {
    console.error("Failed to filter visible stations: ", e);
    return stations; // Fallback to showing all stations
  }
}

const StationsLayer: FunctionComponent = () => {
  const map = useMap();

  const stations = useBehaviorSubj(stationsData$);

  const [visibleStations, setVisibleStations] = useState<Station[]>([]);

  useEffect(() => {
    const handler = debounce(() => {
      setVisibleStations(getVisibleStations(stations, map));
    }, 500);

    if (map) {
      map.on("pointerdrag", handler);
      map.on("moveend", handler);

      return () => {
        map.un("pointerdrag", handler);
        map.un("moveend", handler);
      };
    }
  }, [map, stations]);

  useEffect(() => {
    setVisibleStations(getVisibleStations(stations, map));
  }, [stations, map]);

  return (
    <LayerGroup zIndex={50}>
      {visibleStations?.map((stationIcon) => <StationMarker key={stationIcon.id} station={stationIcon} />)}
    </LayerGroup>
  );
};

export default StationsLayer;
