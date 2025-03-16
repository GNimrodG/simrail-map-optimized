import { LeafletEventHandlerFn, Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useCallback, useEffect, useMemo, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { signalsData$, SignalWithTrain } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import { goToSignal } from "../../utils/geom-utils";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import { useSetting } from "../../utils/use-setting";
import SignalMarker from "../markers/SignalMarker";

const MIN_ZOOM = 11;

function getVisibleSignals(signals: SignalWithTrain[], map: LeafletMap | null) {
  try {
    if ((map?.getZoom() || 0) < MIN_ZOOM) {
      return [];
    }

    const mapBounds = map?.getBounds();

    if (!mapBounds) {
      console.error("Map bounds not available for passive signals!");
      return [];
    }

    return signals.filter((signal) => mapBounds?.contains([signal.lat, signal.lon]));
  } catch (e) {
    console.error("Failed to filter visible passive signals: ", e);
    return []; // Fallback to not showing any passive signals
  }
}

const PassiveSignalsLayer: FunctionComponent = () => {
  const map = useMap();
  const [layerOpacities] = useSetting("layerOpacities");

  const signals = useBehaviorSubj(signalsData$);

  const passiveSignals = useMemo(
    () => signals.filter((signal) => !signal.train && !signal.trainAhead && !signal.nextSignalWithTrainAhead),
    [signals],
  );

  const [visibleSignals, setVisibleSignals] = useState<SignalWithTrain[]>([]);

  useEffect(() => {
    const handler: LeafletEventHandlerFn = debounce(() => {
      setVisibleSignals(getVisibleSignals(passiveSignals, map));
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
  }, [map, passiveSignals]);

  useEffect(() => {
    setVisibleSignals(getVisibleSignals(passiveSignals, map));
  }, [passiveSignals, map]);

  const handleSignalSelect = useCallback(
    (signalId: string) => {
      const signal = signals.find((s) => s.name === signalId);
      if (signal) {
        goToSignal(signal, map);
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
          opacity={layerOpacities["passive-signals"]}
          signal={signal}
          onSignalSelect={handleSignalSelect}
        />
      ))}
    </LayerGroup>
  );
};

export default PassiveSignalsLayer;
