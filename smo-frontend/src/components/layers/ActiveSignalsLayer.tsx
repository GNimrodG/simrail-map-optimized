import { containsCoordinate } from "ol/extent";
import OlMap from "ol/Map";
import { type FunctionComponent, useCallback, useEffect, useMemo, useState } from "react";

import { signalsData$, SignalWithTrain } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import { goToSignal, wgsToMercator } from "../../utils/geom-utils";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import { useSetting } from "../../utils/use-setting";
import LayerGroup from "../map/LayerGroup";
import { useMap } from "../map/MapProvider";
import SignalMarker from "../markers/SignalMarker";

const MIN_ZOOM = 8;

function getVisibleSignals(signals: SignalWithTrain[], map: OlMap | null) {
  try {
    if ((map?.getView().getZoom() || 0) < MIN_ZOOM) {
      return [];
    }

    const mapBounds = map?.getView().calculateExtent(map.getSize());

    if (!mapBounds) {
      console.error("Map bounds not available for active signals!");
      return signals;
    }

    return signals.filter((signal) => containsCoordinate(mapBounds, wgsToMercator([signal.lat, signal.lon])));
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
    if (!map) return;

    const handler = debounce(() => {
      setVisibleSignals(getVisibleSignals(activeSignals, map));
    }, 1000);

    if (map) {
      map.on("pointerdrag", handler);
      map.on("moveend", handler);

      return () => {
        map.un("pointerdrag", handler);
        map.un("moveend", handler);
      };
    }
  }, [map, activeSignals]);

  useEffect(() => {
    setVisibleSignals(getVisibleSignals(activeSignals, map));
  }, [activeSignals, map]);

  const handleSignalSelect = useCallback(
    (signalId: string) => {
      const signal = signals.find((s) => s.name === signalId);
      if (signal) {
      goToSignal(signal, map!);
      } else {
        console.error(`Signal ${signalId} not found`);
      }
    },
    [signals, map],
  );

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
