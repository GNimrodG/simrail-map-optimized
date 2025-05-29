import type { LeafletEventHandlerFn } from "leaflet";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import isEqual from "lodash/isEqual";
import { type FunctionComponent, useCallback, useEffect, useRef, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";
import { BehaviorSubject, distinctUntilChanged, map } from "rxjs";

import { dataProvider } from "../../utils/data-manager";
import { getVisibleSignals, goToSignal } from "../../utils/geom-utils";
import { SignalStatus } from "../../utils/types";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import { useSetting } from "../../utils/use-setting";
import SignalMarker from "../markers/signal/SignalMarker";

const MIN_ZOOM = 11;

const passiveSignals$ = new BehaviorSubject<SignalStatus[]>([]);

dataProvider.signalsData$
  .pipe(
    map((signals) =>
      signals.filter(
        (signal) => !signal.Trains?.length && !signal.TrainsAhead?.length && !signal.NextSignalWithTrainAhead,
      ),
    ),
    distinctUntilChanged(isEqual),
  )
  .subscribe((signals) => passiveSignals$.next(signals));

const PassiveSignalsLayer: FunctionComponent = () => {
  const map = useMap();
  const [layerOpacities] = useSetting("layerOpacities");
  const [visibleSignals, setVisibleSignals] = useState<SignalStatus[]>([]);

  const passiveSignals = useBehaviorSubj(passiveSignals$);

  // Store the handler in a ref to prevent recreating it on every render
  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>();

  // Combined effect for initial and map change updates
  useEffect(() => {
    if (!map) return; // Early return if map is not available

    // Create the debounced handler once
    if (!handlerRef.current) {
      handlerRef.current = debounce(function (this: L.Map) {
        setVisibleSignals(getVisibleSignals(passiveSignals$.value, this, MIN_ZOOM));
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
    setVisibleSignals(getVisibleSignals(passiveSignals, map, MIN_ZOOM));
  }, [passiveSignals, map]);

  const handleSignalSelect = useCallback(
    (signalId: string) => {
      const signal = dataProvider.signalsData$.value.find((s) => s.Name === signalId);
      if (signal) {
        goToSignal(signal, map);
      } else {
        console.error(`Signal ${signalId} not found`);
      }
    },
    [map],
  );

  return (
    <LayerGroup pane="passiveSignalsPane">
      {visibleSignals.map((signal) => (
        <SignalMarker
          key={"signal_" + signal.Name}
          opacity={layerOpacities["passive-signals"]}
          signal={signal}
          onSignalSelect={handleSignalSelect}
          pane="passiveSignalsPane"
        />
      ))}
    </LayerGroup>
  );
};

export default PassiveSignalsLayer;
