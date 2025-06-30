import type { LeafletEventHandlerFn } from "leaflet";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import { type FunctionComponent, useEffect, useRef, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import useBehaviorSubj from "../../hooks/useBehaviorSubj";
import { dataProvider } from "../../utils/data-manager";
import { getVisibleStations } from "../../utils/geom-utils";
import { Station } from "../../utils/types";
import UnplayableStation from "../markers/station/UnplayableStation";

const UnplayableStationsLayer: FunctionComponent = () => {
  const map = useMap();

  const unplayableStations = useBehaviorSubj(dataProvider.unplayableStations$);
  const [visibleStations, setVisibleStations] = useState<Station[]>(
    getVisibleStations(dataProvider.unplayableStations$.value, map),
  );

  // Store the handler in a ref to prevent recreating it on every render
  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>();

  useEffect(() => {
    if (!map) return; // Early return if map is not available

    // Create the debounced handler once
    if (!handlerRef.current) {
      handlerRef.current = debounce(function (this: L.Map) {
        setVisibleStations(getVisibleStations(dataProvider.unplayableStations$.value, this));
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
      setVisibleStations(getVisibleStations(unplayableStations, map));
    }
  }, [unplayableStations, map]);

  return (
    <LayerGroup pane="unplayableStationsPane">
      {visibleStations.map((station) => (
        <UnplayableStation key={station.Name} station={station} />
      ))}
    </LayerGroup>
  );
};

export default UnplayableStationsLayer;
