import type { LeafletEventHandlerFn } from "leaflet";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import { type FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import useBehaviorSubj from "../../hooks/useBehaviorSubj";
import { useSetting } from "../../hooks/useSetting";
import { dataProvider } from "../../utils/data-manager";
import {
  createSignalLookup,
  DependentSignalType,
  findMainSignal,
  getMainSignalAspect,
} from "../../utils/dependent-signals";
import { getVisibleSignals, goToSignal } from "../../utils/geom-utils";
import { SignalStatus, Train } from "../../utils/types";
import DependentSignalMarker from "../markers/signal/DependentSignalMarker";

const MIN_ZOOM = 11;

export interface DependentSignalsLayerProps {
  /** The layer ("repeater-signals", "distant-signals") and the pane ("repeaterSignalsPane", ...) are named after it */
  type: DependentSignalType;
}

/** The repeater or the distant signals, showing what their main signals show. */
const DependentSignalsLayer: FunctionComponent<DependentSignalsLayerProps> = ({ type }) => {
  const map = useMap();
  const [layerOpacities] = useSetting("layerOpacities");

  const signals = useBehaviorSubj(dataProvider.signalsData$);
  const trains = useBehaviorSubj(dataProvider.trainsData$);

  const dependentSignals = useMemo(() => signals.filter((signal) => signal.Type === type), [signals, type]);
  const [visibleSignals, setVisibleSignals] = useState<SignalStatus[]>([]);

  const signalLookup = useMemo(() => createSignalLookup(signals), [signals]);
  const trainLookup = useMemo(
    () => new Map<string, Train>(trains.map((train) => [train.TrainNoLocal, train])),
    [trains],
  );

  const dependentSignalsRef = useRef(dependentSignals);
  dependentSignalsRef.current = dependentSignals;
  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>(null);

  useEffect(() => {
    if (!map) return;

    if (!handlerRef.current) {
      handlerRef.current = debounce(function (this: L.Map) {
        setVisibleSignals(getVisibleSignals(dependentSignalsRef.current, this, MIN_ZOOM));
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
    setVisibleSignals(getVisibleSignals(dependentSignals, map, MIN_ZOOM));
  }, [dependentSignals, map]);

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
    <LayerGroup pane={`${type}SignalsPane`}>
      {visibleSignals.map((signal) => {
        const mainSignal = findMainSignal(signal.Name, type, signalLookup);
        return (
          <DependentSignalMarker
            key={type + "_" + signal.Name}
            signal={signal}
            type={type}
            mainSignal={mainSignal?.Name ?? null}
            aspect={getMainSignalAspect(mainSignal, trainLookup)}
            onSignalSelect={handleSignalSelect}
            opacity={layerOpacities[`${type}-signals`]}
          />
        );
      })}
    </LayerGroup>
  );
};

export default DependentSignalsLayer;
