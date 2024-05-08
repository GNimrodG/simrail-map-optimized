import { LeafletEventHandlerFn, Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useEffect, useMemo, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { SignalWithTrain } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import SignalMarker from "../markers/SignalMarker";

export interface ActiveSignalsLayerProps {
  signals: SignalWithTrain[];
}

const MIN_ZOOM = 11;

function getVisibleSignals(signals: SignalWithTrain[], map: LeafletMap | null) {
  if ((map?.getZoom() || 0) < MIN_ZOOM) {
    return [];
  }

  const mapBounds = map?.getBounds();
  return signals.filter((signal) => mapBounds?.contains([signal.lat, signal.lon]));
}

const PassiveSignalsLayer: FunctionComponent<ActiveSignalsLayerProps> = ({ signals }) => {
  const map = useMap();

  const passiveSignals = useMemo(
    () =>
      signals.filter(
        (signal) => !signal.train && !signal.trainAhead && !signal.nextSignalWithTrainAhead
      ),
    [signals]
  );
  const [visibleSignals, setVisibleSignals] = useState<SignalWithTrain[]>(
    getVisibleSignals(passiveSignals, map)
  );

  useEffect(() => {
    const handler: LeafletEventHandlerFn = debounce(() => {
      setVisibleSignals(getVisibleSignals(passiveSignals, map));
    }, 300);

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

  const handleSignalSelect = (signalId: string) => {
    const signal = signals.find((s) => s.name === signalId);
    if (signal) {
      map?.panTo([signal.lat, signal.lon], { animate: true, duration: 1 });
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
        />
      ))}
    </LayerGroup>
  );
};

export default PassiveSignalsLayer;
