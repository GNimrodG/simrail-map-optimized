import type { LeafletEventHandlerFn } from "leaflet";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import { type FunctionComponent, useEffect, useRef, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import useBehaviorSubj from "../../hooks/useBehaviorSubj";
import { dataProvider } from "../../utils/data-manager";
import { getVisibleStations } from "../../utils/geom-utils";
import { Station } from "../../utils/types";
import StationMarker from "../markers/station/StationMarker";

type StationMarkerType = "bot" | "user";

function filterStationsByMarkerType(stations: Station[], markerType: StationMarkerType) {
  return stations.filter((station) => (station.DispatchedBy.length > 0 ? "user" : "bot") === markerType);
}

export interface StationsLayerProps {
  markerType: StationMarkerType;
}

const StationsLayer: FunctionComponent<StationsLayerProps> = ({ markerType }) => {
  const map = useMap();

  const stations = useBehaviorSubj(dataProvider.stationsData$);

  const [visibleStations, setVisibleStations] = useState<Station[]>([]);

  // Store the handler in a ref to prevent recreating it on every render
  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>(null);

  useEffect(() => {
    if (!map) return; // Early return if map is not available

    // Create the debounced handler once
    if (!handlerRef.current) {
      handlerRef.current = debounce(function (this: L.Map) {
        setVisibleStations(
          getVisibleStations(filterStationsByMarkerType(dataProvider.stationsData$.value, markerType), this),
        );
      }, 500);
    }

    // Map event handling
    const handler = handlerRef.current;
    map.on("move", handler);
    map.on("zoom", handler);
    map.on("resize", handler);

    return () => {
      handler.cancel(); // Cancel any pending debounced calls
      handlerRef.current = null;
      map.off("move", handler);
      map.off("zoom", handler);
      map.off("resize", handler);
    };
  }, [map, markerType]);

  useEffect(() => {
    if (map) {
      setVisibleStations(getVisibleStations(filterStationsByMarkerType(stations, markerType), map));
    }
  }, [stations, map, markerType]);

  return (
    <LayerGroup pane="stationsPane">
      {visibleStations?.map((station) => (
        <StationMarker key={"station_" + station.Id} station={station} layerId={`${markerType}-stations`} />
      ))}
    </LayerGroup>
  );
};

export default StationsLayer;
