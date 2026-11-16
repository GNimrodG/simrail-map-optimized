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
  ["Witonia", ["4971_Wi"]],
  ["Glinnik", ["1057_Gl"]],
  ["Głowno", ["1092_Gn"]],
  ["Rokiciny", ["3594_Ro"]],
  ["Gajewniki", ["919_Ga"]],
  ["Zgierz Północ", ["5314_ZP"]],
  ["Żakowice Południowe", ["5377_ZP"]],
  ["Żychlin", ["5248_Zy"]],
]);

export function getSignalsForStation(station: Station, allowNumPrefix = false): SignalStatus[] {
  const stationPrefixList = (STATION_PREFIX_OVERRIDES.get(station.Name) || [station.Prefix]).map((x) => x + "_");
  const normalizedPrefixes = (STATION_PREFIX_OVERRIDES.get(station.Name) || [station.Prefix]).map(normalizeString);
  const altStationPrefixRegex = new RegExp(
    String.raw`^${allowNumPrefix ? String.raw`(\d+_)?` : ""}(${normalizedPrefixes.join("|")})\d?_`,
  );
  const signals = dataProvider.signalsData$.value?.filter(
    (signal) => stationPrefixList.some((x) => signal.Name.startsWith(x)) || altStationPrefixRegex.test(signal.Name),
  );

  if ((!signals || signals.length < 2) && !allowNumPrefix) {
    // try again with number prefix
    return getSignalsForStation(station, true);
  }

  return signals || [];
}

/** How a station's signals are named: its prefix overrides, or a pattern made from its prefix */
interface StationMatcher {
  station: Station;
  prefixes: string[] | undefined;
  pattern: RegExp | undefined;
}

// Built once per station list, with the stations of the signals already looked up: the list changes when a
// dispatcher joins or leaves, the lookups happen on every train update.
let stationMatchers:
  { lists: [Station[], Station[]]; matchers: StationMatcher[]; found: Map<string, Station | null> } | undefined;

function getStationMatchers() {
  const unplayable = dataProvider.unplayableStations$.value;
  const stations = dataProvider.stationsData$.value;
  if (stationMatchers?.lists[0] !== unplayable || stationMatchers.lists[1] !== stations) {
    stationMatchers = {
      lists: [unplayable, stations],
      matchers: [...unplayable, ...stations].map((station) => {
        const prefixes = STATION_PREFIX_OVERRIDES.get(station.Name);
        return {
          station,
          prefixes,
          pattern: prefixes ? undefined : new RegExp(String.raw`^${station.Prefix}\d?_|^\d+_${station.Prefix}\d?_`),
        };
      }),
      found: new Map(),
    };
  }
  return stationMatchers;
}

export function findStationForSignal(signalName: string) {
  if (!signalName) {
    return null;
  }

  const { matchers, found } = getStationMatchers();
  const known = found.get(signalName);
  if (known !== undefined) {
    return known;
  }

  const station = findStationForSignalIn(signalName, matchers);
  found.set(signalName, station);
  return station;
}

function findStationForSignalIn(signalName: string, matchers: StationMatcher[]) {
  const options: Station[] = [];

  for (const { station, prefixes, pattern } of matchers) {
    if (prefixes) {
      if (prefixes.some((x) => signalName.startsWith(x))) {
        options.push(station);
      }
    } else if (pattern?.test(signalName)) {
      options.push(station); // we can't return early here because there are some cases where the prefix overlaps (Skierniewice (3877_Sk) and Stawiska (Sk))
    }
  }

  if (options.length === 1) {
    return options[0];
  }

  for (const station of options) {
    if (STATION_PREFIX_OVERRIDES.has(station.Name)) {
      const prefixes = STATION_PREFIX_OVERRIDES.get(station.Name)!;
      if (prefixes.some((x) => signalName.startsWith(x))) {
        return station;
      }
    } else if (signalName.startsWith(`${station.Prefix}_`)) {
      return station;
    }
  }

  return null;
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

/** The station geometry code, loaded on first use: turf (with jsts and d3-geo) is the largest dependency of the map */
export function loadStationGeometry() {
  return import("./station-geometry");
}

export function goToStation(station: Station, map: L.Map) {
  map.flyTo([station.Latitude, station.Longitude], 16, { animate: true, duration: 1 });

  // add polygon around the station using the signals
  loadStationGeometry()
    .then(({ getStationGeometry }) => {
      const polygon = L.polygon(getStationGeometry(station), {
        color: "red",
        fillColor: "#f03",
        fillOpacity: 0.5,
      }).addTo(map);
      setTimeout(() => map?.removeLayer(polygon), 3000);
    })
    .catch((e) => console.error("Failed to outline the station", e));
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

export function getVisibleStations(stations: Station[], map: L.Map | null, minZoom?: number) {
  try {
    const mapZoom = map?.getZoom() || 0;
    if (minZoom && mapZoom < minZoom) {
      return [];
    }

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
