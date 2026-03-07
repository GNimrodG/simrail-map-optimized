import type { LeafletEventHandlerFn } from "leaflet";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import isEqual from "lodash/isEqual";
import { type FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";
import { BehaviorSubject, distinctUntilChanged, map } from "rxjs";

import useBehaviorSubj from "../../hooks/useBehaviorSubj";
import { useSetting } from "../../hooks/useSetting";
import { dataProvider } from "../../utils/data-manager";
import { getVisibleSignals, goToSignal } from "../../utils/geom-utils";
import { SignalStatus, Train } from "../../utils/types";
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
  const trains = useBehaviorSubj(dataProvider.trainsData$);

  const trainLookup = useMemo(() => {
    const lookup = new Map<string, Train>();
    for (const train of trains) {
      lookup.set(train.TrainNoLocal, train);
    }
    return lookup;
  }, [trains]);

  const signalTrainsByName = useMemo(() => {
    const byName = new Map<string, Train[] | null>();

    for (const signal of visibleSignals) {
      const signalTrains = signal.Trains?.map((trainNo) => trainLookup.get(trainNo)).filter(
        (train): train is Train => !!train,
      );
      byName.set(signal.Name, signalTrains || null);
    }

    return byName;
  }, [trainLookup, visibleSignals]);

  // Store the handler in a ref to prevent recreating it on every render
  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>(null);

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
          trains={signalTrainsByName.get(signal.Name) || null}
          onSignalSelect={handleSignalSelect}
          pane="passiveSignalsPane"
        />
      ))}
    </LayerGroup>
  );
};

export default PassiveSignalsLayer;
