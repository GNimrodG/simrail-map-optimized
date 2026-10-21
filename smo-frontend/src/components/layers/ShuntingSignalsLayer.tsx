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

const MIN_ZOOM = 13; // there are a lot of them in the stations

// the shunting signals (Tm), active or not: SignalMarker shows their state
const shuntingSignals$ = new BehaviorSubject<SignalStatus[]>([]);

dataProvider.signalsData$
  .pipe(
    map((signals) => signals.filter((signal) => signal.Type === "shunting")),
    distinctUntilChanged(isEqual),
  )
  .subscribe((signals) => shuntingSignals$.next(signals));

const ShuntingSignalsLayer: FunctionComponent = () => {
  const map = useMap();
  const [layerOpacities] = useSetting("layerOpacities");
  const [visibleSignals, setVisibleSignals] = useState<SignalStatus[]>([]);

  const shuntingSignals = useBehaviorSubj(shuntingSignals$);
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

  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>(null);

  useEffect(() => {
    if (!map) return;

    if (!handlerRef.current) {
      handlerRef.current = debounce(function (this: L.Map) {
        setVisibleSignals(getVisibleSignals(shuntingSignals$.value, this, MIN_ZOOM));
      }, 500);
    }

    const handler = handlerRef.current;
    map.on("move zoom resize", handler);

    return () => {
      handler.cancel();
      map.off("move zoom resize", handler);
    };
  }, [map]);

  useEffect(() => {
    setVisibleSignals(getVisibleSignals(shuntingSignals, map, MIN_ZOOM));
  }, [shuntingSignals, map]);

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
    <LayerGroup pane="shuntingSignalsPane">
      {visibleSignals.map((signal) => (
        <SignalMarker
          key={"signal_" + signal.Name}
          opacity={layerOpacities["shunting-signals"]}
          signal={signal}
          trains={signalTrainsByName.get(signal.Name) || null}
          onSignalSelect={handleSignalSelect}
          pane="shuntingSignalsPane"
        />
      ))}
    </LayerGroup>
  );
};

export default ShuntingSignalsLayer;
