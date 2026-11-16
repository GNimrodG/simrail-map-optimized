import * as turf from "@turf/turf";
import { Feature, Polygon } from "geojson";
import type L from "leaflet";

import { getSignalsForStation } from "./geom-utils";
import { Station } from "./types";

// A module of its own, loaded when needed: turf (with jsts and d3-geo) is the largest dependency of the map.

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
          (stationArea?.geometry.type !== "Polygon" ||
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
