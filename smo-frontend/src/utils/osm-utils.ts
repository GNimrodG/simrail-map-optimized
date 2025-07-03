import { BehaviorSubject } from "rxjs";

import { getDebouncedFetcher } from "./data-utils";
import { RateLimiter } from "./rate-limiter";
import { OsmNode } from "./types";

/**
 * Fetch OSM objects with railway=halt and no railway:ref, in a given bounding box.
 * @param south - The southern latitude of the bbox.
 * @param west - The western longitude of the bbox.
 * @param north - The northern latitude of the bbox.
 * @param east - The eastern longitude of the bbox.
 * @param abortSignal - Optional AbortSignal to cancel the request.
 * @returns The Overpass API response as JSON.
 */
export async function fetchRailwayHaltsWithoutRef(
  south: number,
  west: number,
  north: number,
  east: number,
  abortSignal?: AbortSignal,
): Promise<{ elements: OsmNode[] }> {
  const query = `
    [out:json][timeout:60];
    (
      node["railway"="halt"][!"railway:ref"](${south},${west},${north},${east});
    );
    out center;
  `;

  try {
    const response = await executeOsmQuery(query, abortSignal);
    if (!response?.elements?.length) {
      return { elements: [] };
    }

    return response;
  } catch (error) {
    // Handle abort errors gracefully
    if (error instanceof Error && (error.name === "AbortError" || error.message === "Operation was aborted")) {
      console.debug("fetchRailwayHaltsWithoutRef: operation was aborted");
      return { elements: [] };
    }

    console.error("Error fetching railway halts:", error);
    return { elements: [] }; // Return empty array on error
  }
}

/**
 * Fetch OSM data for a station by its name.
 * @param name - The name of the station to search for.
 * @param prefix - Optional railway reference prefix for fallback search.
 * @param abortSignal - Optional AbortSignal to cancel the request.
 * @returns The OSM node representing the station, or null if not found.
 */
export async function fetchOsmDataForStation(
  name: string,
  prefix?: string,
  abortSignal?: AbortSignal,
): Promise<OsmNode | null> {
  try {
    // Check if already aborted before making the call
    if (abortSignal?.aborted) {
      console.debug("fetchOsmDataForStation: operation was already aborted");
      return null;
    }

    const response = await fetchOsmDataByStationName(name);

    if (!response && prefix) {
      // Check if aborted before fallback
      if (abortSignal?.aborted) {
        return null;
      }

      const fallbackResponse = await fetchOsmDataByRailwayRef(prefix);
      if (!fallbackResponse) {
        return null; // Return null if no data found
      }

      return fallbackResponse || null;
    }

    return response || null;
  } catch (error) {
    // Handle abort errors gracefully
    if (error instanceof Error && (error.name === "AbortError" || error.message === "Operation was aborted")) {
      console.debug("fetchOsmDataForStation: operation was aborted");
      return null;
    }

    console.debug("Error fetching OSM data for station:", error);
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
    if (!response?.elements?.length) {
      console.warn("No OSM data found for the requested stations.");
      return new Map();
    }

    const elementsMap = new Map<string, OsmNode>();
    response.elements.forEach((element: OsmNode) => {
      elementsMap.set(element.tags.name, element);
    });

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
    if (!response?.elements?.length) {
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

// Configure rate limiter for Overpass API (1 request per second)
const osmRateLimiter = new RateLimiter({
  minInterval: 1000, // 1 second
  maxConcurrent: 1,
  debug: false, // Set to true for debugging
});

async function executeOsmQuery(query: string, abortSignal?: AbortSignal) {
  if (!query || query.trim() === "") {
    return null; // Return null if the query is empty
  }

  // Check if already aborted
  if (abortSignal?.aborted) {
    console.debug("OSM query: operation was already aborted");
    return null;
  }

  try {
    // Apply rate limiting with abort signal
    await osmRateLimiter.throttle(abortSignal);

    // Check again after throttling
    if (abortSignal?.aborted) {
      console.debug("OSM query: operation was aborted after throttling");
      return null;
    }

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "data=" + encodeURIComponent(query),
      signal: abortSignal,
    });

    if (!response.ok) {
      isOsmAvailable$.next(false);
      throw new Error("Overpass API request failed: " + response.statusText);
    }

    isOsmAvailable$.next(true);
    const data = (await response.json()) as { elements: OsmNode[] };
    return data;
  } catch (error) {
    // Handle abort errors gracefully
    if (error instanceof Error && error.name === "AbortError") {
      console.debug("OSM query: request was aborted");
      return null;
    }

    // Handle rate limiter abort errors
    if (error instanceof Error && error.message === "Operation was aborted") {
      console.debug("OSM query: operation was aborted during rate limiting");
      return null;
    }

    // Re-throw other errors
    throw error;
  }
}

export function getOsmNodeName(stop: OsmNode, lng: string): string {
  if (stop.tags[`name:${lng}`] && stop.tags[`name:${lng}`] !== stop.tags.name) {
    // If the name in the current language is different from the default name, return it
    return stop.tags[`name:${lng}`];
  }

  return stop.tags.name;
}
