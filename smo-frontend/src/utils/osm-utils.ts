import { BehaviorSubject } from "rxjs";

import { getDebouncedFetcher } from "./data-utils";
import { OsmNode } from "./types";

/**
 * Fetch OSM objects with railway=halt and no railway:ref, in a given bounding box.
 * @param south - The southern latitude of the bbox.
 * @param west - The western longitude of the bbox.
 * @param north - The northern latitude of the bbox.
 * @param east - The eastern longitude of the bbox.
 * @returns The Overpass API response as JSON.
 */
export async function fetchRailwayHaltsWithoutRef(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<{ elements: OsmNode[] }> {
  const query = `
    [out:json][timeout:60];
    (
      node["railway"="halt"][!"railway:ref"](${south},${west},${north},${east});
    );
    out center;
  `;

  try {
    const response = await executeOsmQuery(query);
    if (!response.elements || response.elements.length === 0) {
      return { elements: [] };
    }

    return response;
  } catch (error) {
    console.error("Error fetching railway halts:", error);
    return { elements: [] }; // Return empty array on error
  }
}

/**
 * Fetch OSM data for a station by its name.
 * @param name - The name of the station to search for.
 * @returns The OSM node representing the station, or null if not found.
 */
export async function fetchOsmDataForStation(name: string, prefix?: string): Promise<OsmNode | null> {
  try {
    const response = await fetchOsmDataByStationName(name);

    if (!response && prefix) {
      const fallbackResponse = await fetchOsmDataByRailwayRef(prefix);
      if (!fallbackResponse) {
        console.warn(`No OSM data found for station: ${name}`);
        return null; // Return null if no data found
      }

      return fallbackResponse || null;
    }

    return response || null;
  } catch (error) {
    console.error("Error fetching OSM data for station:", error);
    return null; // Return null on error
  }
}

const fetchOsmDataByStationName = getDebouncedFetcher<OsmNode | null>(async (keys) => {
  const query = `
    [out:json][timeout:60];
    (${keys.map((key) => `node["name"="${key}"]["railway"="station"];`).join("\n")});
    out tags;
    `;

  return executeOsmQuery(query).then((response) => {
    if (!response.elements || response.elements.length === 0) {
      console.warn("No OSM data found for the requested stations.");
      return new Map();
    }

    const elementsMap = new Map<string, OsmNode>();
    response.elements.forEach((element: OsmNode) => {
      elementsMap.set(element.tags.name, element);
    });

    console.log("Fetched OSM data for stations:", elementsMap);

    return elementsMap;
  });
}, 500);

const fetchOsmDataByRailwayRef = getDebouncedFetcher<OsmNode | null>(async (keys) => {
  const query = `
    [out:json][timeout:60];
    (${keys.map((key) => `node["railway:ref"="${key}"]["railway"="station"](49.0,14.0,55.0,24.2);`).join("\n")});
    out tags;
    `;

  return executeOsmQuery(query).then((response) => {
    if (!response.elements || response.elements.length === 0) {
      console.warn("No OSM data found for the requested railway references.");
      return new Map();
    }

    const elementsMap = new Map<string, OsmNode>();
    response.elements.forEach((element: OsmNode) => {
      elementsMap.set(element.tags["railway:ref"], element);
    });

    return elementsMap;
  });
}, 500);

export const isOsmAvailable$ = new BehaviorSubject<boolean>(true);

isOsmAvailable$.subscribe((available) => {
  if (!available) {
    console.warn("Overpass API is currently unavailable.");
  }
});

async function executeOsmQuery(query: string) {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "data=" + encodeURIComponent(query),
  });

  if (!response.ok) {
    isOsmAvailable$.next(false);
    throw new Error("Overpass API request failed: " + response.statusText);
  }

  isOsmAvailable$.next(true);
  const data = (await response.json()) as { elements: OsmNode[] };
  return data;
}

export function getOsmNodeName(stop: OsmNode, lng: string): string {
  if (stop.tags[`name:${lng}`] && stop.tags[`name:${lng}`] !== stop.tags.name) {
    // If the name in the current language is different from the default name, return it
    return stop.tags[`name:${lng}`];
  }

  return stop.tags.name;
}
