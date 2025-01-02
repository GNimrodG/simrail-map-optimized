import * as turf from "@turf/turf";
import { Feature, Polygon } from "geojson";
import { Feature as OlFeature, Map as OlMap } from "ol";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

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

export function getStationGeometry(station: Station): OlFeature {
  const stationSignals = getSignalsForStation(station);

  if (stationSignals?.length) {
    if (stationSignals.length === 1) {
      // we have only one signal and the station, make a line between them and buffer it
      const line = turf.lineString([
        [station.Latititude, station.Longitude],
        [stationSignals[0].lat, stationSignals[0].lon],
      ]);

      const bufferedLine = turf.buffer(line, 0.05);

      return new OlFeature(
        bufferedLine?.geometry.type === "Polygon"
          ? bufferedLine?.geometry.coordinates[0].map(([lat, lon]) => [lat, lon])
          : [],
      );
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

      return new OlFeature(
        paddedConvex.geometry.type === "Polygon"
          ? paddedConvex?.geometry.coordinates[0].map(([lat, lon]) => [lat, lon])
          : [],
      );
    }
  }

  return new OlFeature();
}

export function goToSignal(signal: Signal, map: OlMap) {
  map.getView().animate({ center: wgsToMercator([signal.lat, signal.lon]), zoom: 18, duration: 1 });

  // add circle around the signal for 3 seconds for better visibility
  const circle = new OlFeature(
    turf
      .circle(wgsToMercator([signal.lat, signal.lon]), 0.0005)
      .geometry.coordinates[0].map(([lat, lon]) => [lat, lon]),
  );

  const circleLayer = new VectorLayer({
    source: new VectorSource({
      features: [circle],
    }),
    style: new Style({
      fill: new Fill({ color: "#f03" }),
      stroke: new Stroke({ color: "#f00", width: 2 }),
    }),
  });

  map.addLayer(circleLayer);
  // const circle = L.circle([signal.lat, signal.lon], {
  //   color: "red",
  //   fillColor: "#f03",
  //   fillOpacity: 0.5,
  //   radius: 5,
  // }).addTo(map);
  setTimeout(() => map?.removeLayer(circleLayer), 3000);
}

export function wgsToMercator([lat, lon]: [number, number]): [number, number] {
  return [
    (lon * 20037508.34) / 180,
    ((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * 20037508.34) / 180,
  ];
}

export function goToStation(station: Station, map: L.Map) {
  map.flyTo([station.Latititude, station.Longitude], 16, { animate: true, duration: 1 });

  // add polygon around the station using the signals
  const polygon = L.polygon(getStationGeometry(station), {
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.5,
  }).addTo(map);
  setTimeout(() => map?.removeLayer(polygon), 3000);
}
