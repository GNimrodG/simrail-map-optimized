import * as turf from "@turf/turf";
import { Feature, Polygon } from "geojson";
import L from "leaflet";

import { Signal, signalsData$, SignalWithTrain, Station } from "./data-manager";
import { normalizeString } from "./ui";

const STATION_PREFIX_OVERRIDES = new Map<string, string[]>([
  ["Spł1", ["Spł1", "SPł1"]], // Sosnowiec Południowy
  ["Pi", ["Pl"]], // Pilichowice
  ["Op", ["OP"]], // Opoczno Południe
  ["Ga", ["GA", "Ga"]], // Gajówka APO
  ["BT", ["BT", "Bt"]], // Kraków Batowice
]);

export function getSignalsForStation(station: Station, allowNumPrefix = false): SignalWithTrain[] {
  const stationPrefixList = (STATION_PREFIX_OVERRIDES.get(station.Prefix) || [station.Prefix]).map((x) => x + "_");
  const normalizedPrefixes = (STATION_PREFIX_OVERRIDES.get(station.Prefix) || [station.Prefix]).map(normalizeString);
  const altStationPrefixRegex = `^${allowNumPrefix ? "(\\d+_)?" : ""}(${normalizedPrefixes.join("|")})\\d?_`;
  const signals = signalsData$.value?.filter(
    (signal) =>
      stationPrefixList.some((x) => signal.name.startsWith(x)) || RegExp(altStationPrefixRegex).exec(signal.name),
  );

  if ((!signals || signals.length < 2) && !allowNumPrefix) {
    // try again with number prefix
    return getSignalsForStation(station, true);
  }

  return signals || [];
}

export function getStationGeometry(station: Station): L.LatLngExpression[] {
  const stationSignals = getSignalsForStation(station);

  if (stationSignals?.length) {
    if (stationSignals.length === 1) {
      // we have only one signal and the station, make a line between them and buffer it
      const line = turf.lineString([
        [station.Latititude, station.Longitude],
        [stationSignals[0].lat, stationSignals[0].lon],
      ]);

      const bufferedLine = turf.buffer(line, 0.05);

      return bufferedLine?.geometry.type === "Polygon"
        ? bufferedLine?.geometry.coordinates[0].map(([lat, lon]) => [lat, lon])
        : [];
    } else {
      // add polygon around the station using the signals
      const geoms = turf.featureCollection(
        [[station.Latititude, station.Longitude], ...stationSignals.map((signal) => [signal.lat, signal.lon])].map(
          (x) => turf.point(x),
        ),
      );

      let maxEdge = 0.6;
      let stationArea = turf.concave(geoms, { maxEdge: maxEdge });

      try {
        while (
          (!stationArea ||
            stationArea.geometry.type !== "Polygon" ||
            !geoms.features.every((x) => turf.booleanPointInPolygon(x, stationArea!))) &&
          maxEdge < 10
        ) {
          maxEdge += 0.1;
          stationArea = turf.concave(geoms, { maxEdge: maxEdge }) as Feature<Polygon> | null;
        }
      } catch (e) {
        console.log("Error in concave hull calculation", e);
        stationArea = null;
      }

      if (!stationArea || !geoms.features.every((x) => turf.booleanPointInPolygon(x, stationArea!))) {
        console.warn("Failed to create concave hull, falling back to convex hull");
        stationArea = turf.convex(geoms) as Feature<Polygon>;
      }

      const paddedConvex = turf.buffer(stationArea, 0.05)!;

      return paddedConvex.geometry.type === "Polygon"
        ? paddedConvex?.geometry.coordinates[0].map(([lat, lon]) => [lat, lon])
        : [];
    }
  }

  return [];
}

export function goToSignal(signal: Signal, map: L.Map) {
  map.flyTo([signal.lat, signal.lon], 18, { animate: true, duration: 1 });

  // add circle around the signal for 3 seconds for better visibility
  const circle = L.circle([signal.lat, signal.lon], {
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.5,
    radius: 5,
  }).addTo(map);
  setTimeout(() => map?.removeLayer(circle), 3000);
}
