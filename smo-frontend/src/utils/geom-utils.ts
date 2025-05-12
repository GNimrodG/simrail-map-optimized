import * as turf from "@turf/turf";
import { Feature, Polygon } from "geojson";
import L from "leaflet";

import { dataProvider } from "./data-manager";
import { Signal, SignalStatus, Station } from "./types";
import { normalizeString } from "./ui";

const STATION_PREFIX_OVERRIDES = new Map<string, string[]>([
  ["Sosnowiec Południowy", ["Spł1", "SPł1"]],
  ["Pilichowice", ["Pl"]],
  ["Opoczno Południe", ["OP"]],
  ["Gajówka APO", ["GA", "Ga"]],
  ["Kraków Batowice", ["BT", "Bt"]],
  ["Płyćwia", ["3251_Pl"]],
  ["Koniecpol", ["1830_Ko"]],
  ["Żyrardów", ["5431_Zy"]],
  ["Skierniewice", ["3877_Sk"]],
  ["Koluszki", ["1803_KO"]],
  ["Kraków Olsza", ["1998_KO", "1998_Ko"]],
]);

export function getSignalsForStation(station: Station, allowNumPrefix = false): SignalStatus[] {
  const stationPrefixList = (STATION_PREFIX_OVERRIDES.get(station.Name) || [station.Prefix]).map((x) => x + "_");
  const normalizedPrefixes = (STATION_PREFIX_OVERRIDES.get(station.Name) || [station.Prefix]).map(normalizeString);
  const altStationPrefixRegex = `^${allowNumPrefix ? "(\\d+_)?" : ""}(${normalizedPrefixes.join("|")})\\d?_`;
  const signals = dataProvider.signalsData$.value?.filter(
    (signal) =>
      stationPrefixList.some((x) => signal.Name.startsWith(x)) || RegExp(altStationPrefixRegex).exec(signal.Name),
  );

  if ((!signals || signals.length < 2) && !allowNumPrefix) {
    // try again with number prefix
    return getSignalsForStation(station, true);
  }

  return signals || [];
}

export function findStationForSignal(signalName: string) {
  const options: Station[] = [];

  for (const station of [...dataProvider.unplayableStations$.value, ...dataProvider.stationsData$.value]) {
    if (STATION_PREFIX_OVERRIDES.has(station.Name)) {
      const prefixes = STATION_PREFIX_OVERRIDES.get(station.Name)!;
      if (prefixes.some((x) => signalName.startsWith(x))) {
        options.push(station);
      }
    } else if (RegExp(`^${station.Prefix}\\d?_|^\\d+_${station.Prefix}\\d?_`).exec(signalName)) {
      options.push(station); // we can't return early here because there are some cases where the prefix overlaps (Skierniewice (3877_Sk) and Stawiska (Sk))
    }
  }

  if (options.length === 1) {
    return options[0];
  }

  for (const station of options) {
    if (signalName.startsWith(`${station.Prefix}_`)) {
      return station;
    }
  }

  return null;
}

export function getStationGeometry(station: Station): L.LatLngExpression[] {
  const stationSignals = getSignalsForStation(station);

  if (stationSignals?.length) {
    if (stationSignals.length === 1) {
      // we have only one signal and the station, make a line between them and buffer it
      const line = turf.lineString([
        [station.Latitude, station.Longitude],
        [stationSignals[0].Location.Y, stationSignals[0].Location.X],
      ]);

      const bufferedLine = turf.buffer(line, 0.05);

      return bufferedLine?.geometry.type === "Polygon"
        ? bufferedLine?.geometry.coordinates[0].map(([lat, lon]) => [lat, lon])
        : [];
    } else {
      // add polygon around the station using the signals
      const geoms = turf.featureCollection(
        [
          [station.Latitude, station.Longitude],
          ...stationSignals.map((signal) => [signal.Location.Y, signal.Location.X]),
        ].map((x) => turf.point(x)),
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
        console.warn("Error in concave hull calculation", e);
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
  map.flyTo([signal.Location.Y, signal.Location.X], 18, { animate: true, duration: 1 });

  // add circle around the signal for 3 seconds for better visibility
  const circle = L.circle([signal.Location.Y, signal.Location.X], {
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.5,
    radius: 5,
  }).addTo(map);
  setTimeout(() => map?.removeLayer(circle), 3000);
}

export function goToStation(station: Station, map: L.Map) {
  map.flyTo([station.Latitude, station.Longitude], 16, { animate: true, duration: 1 });

  // add polygon around the station using the signals
  const polygon = L.polygon(getStationGeometry(station), {
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.5,
  }).addTo(map);
  setTimeout(() => map?.removeLayer(polygon), 3000);
}

export function getVisibleSignals(signals: SignalStatus[], map: L.Map | null, minZoom: number) {
  try {
    if ((map?.getZoom() || 0) < minZoom) {
      return [];
    }

    const mapBounds = map?.getBounds();

    if (!mapBounds) {
      console.error("Map bounds not available for signals!");
      return signals;
    }

    // Early return for empty arrays
    if (!signals.length) {
      console.warn("No signals available!");
      return [];
    }

    // Extract bounds values once for better performance
    const north = mapBounds.getNorth();
    const south = mapBounds.getSouth();
    const east = mapBounds.getEast();
    const west = mapBounds.getWest();

    // Filter signals using direct coordinate comparison instead of method calls
    return signals.filter((signal) => {
      const lat = signal.Location.Y;
      const lng = signal.Location.X;
      return lat <= north && lat >= south && lng <= east && lng >= west;
    });
  } catch (e) {
    console.error("Failed to filter visible signals: ", e);
    return signals; // Fallback to showing all active signals
  }
}

export function getVisibleStations(stations: Station[], map: L.Map | null) {
  try {
    const mapBounds = map?.getBounds();

    if (!mapBounds) {
      console.error("Map bounds not available for stations!");
      return stations;
    }

    // Early return for empty arrays
    if (!stations.length) return [];

    // Extract bounds values once for better performance
    const north = mapBounds.getNorth();
    const south = mapBounds.getSouth();
    const east = mapBounds.getEast();
    const west = mapBounds.getWest();

    // Filter signals using direct coordinate comparison instead of method calls
    return stations.filter((station) => {
      const lat = station.Latitude;
      const lng = station.Longitude;
      return lat <= north && lat >= south && lng <= east && lng >= west;
    });
  } catch (e) {
    console.error("Failed to filter visible stations: ", e);
    return stations; // Fallback to showing all stations
  }
}
