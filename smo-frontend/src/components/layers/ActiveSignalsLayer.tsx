import { LeafletEventHandlerFn, Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useEffect, useMemo, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { signalsData$, SignalWithTrain } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import { goToSignal } from "../../utils/geom-utils";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import { useSetting } from "../../utils/use-setting";
import SignalMarker from "../markers/SignalMarker";

const MIN_ZOOM = 8;

function getVisibleSignals(signals: SignalWithTrain[], map: LeafletMap | null) {
  try {
    if ((map?.getZoom() || 0) < MIN_ZOOM) {
      return [];
    }

    const mapBounds = map?.getBounds();

    if (!mapBounds) {
      console.error("Map bounds not available for active signals!");
      return signals;
    }

    return signals.filter((signal) => mapBounds?.contains([signal.lat, signal.lon]));
  } catch (e) {
    console.error("Failed to filter visible active signals: ", e);
    return signals; // Fallback to showing all active signals
  }
}

const ActiveSignalsLayer: FunctionComponent = () => {
  const map = useMap();
  const [layerOpacities] = useSetting("layerOpacities");

  const signals = useBehaviorSubj(signalsData$);

  const activeSignals = useMemo(
    () => signals.filter((signal) => !!signal.train || !!signal.trainAhead || !!signal.nextSignalWithTrainAhead),
    [signals],
  );

  const [visibleSignals, setVisibleSignals] = useState<SignalWithTrain[]>([]);

  useEffect(() => {
    const handler: LeafletEventHandlerFn = debounce(() => {
      setVisibleSignals(getVisibleSignals(activeSignals, map));
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
  }, [map, activeSignals]);

  useEffect(() => {
    setVisibleSignals(getVisibleSignals(activeSignals, map));
  }, [activeSignals, map]);

  const handleSignalSelect = (signalId: string) => {
    const signal = signals.find((s) => s.name === signalId);
    if (signal) {
      goToSignal(signal, map);
    } else {
      console.error(`Signal ${signalId} not found`);
    }
  };

  return (
    <LayerGroup>
      {visibleSignals.map((signal) => (
        <SignalMarker
          key={signal.name}
          signal={signal}
          onSignalSelect={handleSignalSelect}
          opacity={layerOpacities["active-signals"]}
        />
      ))}
    </LayerGroup>
  );
};

export default ActiveSignalsLayer;
