import type { LeafletEventHandlerFn } from "leaflet";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import { type FunctionComponent, useEffect, useRef, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { dataProvider } from "../../utils/data-manager";
import { getVisibleStations } from "../../utils/geom-utils";
import { Station } from "../../utils/types";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import StationMarker from "../markers/station/StationMarker";

const StationsLayer: FunctionComponent = () => {
  const map = useMap();

  const stations = useBehaviorSubj(dataProvider.stationsData$);

  const [visibleStations, setVisibleStations] = useState<Station[]>([]);

  // Store the handler in a ref to prevent recreating it on every render
  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>();

  useEffect(() => {
    if (!map) return; // Early return if map is not available

    // Create the debounced handler once
    if (!handlerRef.current) {
      handlerRef.current = debounce(function (this: L.Map) {
        setVisibleStations(getVisibleStations(dataProvider.stationsData$.value, this));
      }, 500);
    }

    // Map event handling
    const handler = handlerRef.current;
    map.on("move", handler);
    map.on("zoom", handler);
    map.on("resize", handler);

    return () => {
      handler.cancel(); // Cancel any pending debounced calls
      map.off("move", handler);
      map.off("zoom", handler);
      map.off("resize", handler);
    };
  }, [map]);

  useEffect(() => {
    if (map) {
      setVisibleStations(getVisibleStations(stations, map));
    }
  }, [stations, map]);

  return (
    <LayerGroup pane="stationsPane">
      {visibleStations?.map((station) => <StationMarker key={"station_" + station.Id} station={station} />)}
    </LayerGroup>
  );
};

export default StationsLayer;
