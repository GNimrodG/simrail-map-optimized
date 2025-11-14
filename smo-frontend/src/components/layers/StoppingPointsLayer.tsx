import { LeafletEventHandlerFn } from "leaflet";
import { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import { LRUCache } from "lru-cache";
import { type FunctionComponent, useCallback, useEffect, useRef, useState } from "react";
import { LayerGroup, useMap } from "react-leaflet";

import { fetchRailwayHaltsWithoutRef } from "../../utils/osm-utils";
import { OsmNode } from "../../utils/types";
import StoppingPointMarker from "../markers/stopping-points/StoppingPointMarker";

const BUFFER_FACTOR = 0.2; // 20% buffer for map bounds
const MIN_ZOOM = 12; // Minimum zoom level to show stopping points

// Cache key generation helper
const getBoundsCacheKey = (bounds: L.LatLngBounds): string => {
  return `${bounds.getSouth().toFixed(2)},${bounds.getWest().toFixed(2)},${bounds.getNorth().toFixed(2)},${bounds.getEast().toFixed(2)}`;
};

function getVisibleStoppingPoints(map: L.Map, fetchedHalts: OsmNode[]): OsmNode[] {
  try {
    if ((map?.getZoom() || 0) < MIN_ZOOM) {
      return [];
    }

    const mapBounds = map?.getBounds();

    if (!mapBounds) {
      console.error("Map bounds not available for stopping-points!");
      return fetchedHalts;
    }

    // Combine static and fetched data
    const allStoppingPoints = [...fetchedHalts];

    // Early return for empty arrays
    if (!allStoppingPoints.length) return [];

    // Add buffer to bounds (about 20% expansion) to prevent disappearing on edges
    const bufferLat = (mapBounds.getNorth() - mapBounds.getSouth()) * BUFFER_FACTOR;
    const bufferLng = (mapBounds.getEast() - mapBounds.getWest()) * BUFFER_FACTOR;

    // Extract bounds values with buffer for smoother transitions
    const north = mapBounds.getNorth() + bufferLat;
    const south = mapBounds.getSouth() - bufferLat;
    const east = mapBounds.getEast() + bufferLng;
    const west = mapBounds.getWest() - bufferLng;

    // Filter stopping points using direct coordinate comparison
    return allStoppingPoints.filter((stop: OsmNode) => {
      return stop.lat <= north && stop.lat >= south && stop.lon <= east && stop.lon >= west;
    });
  } catch (e) {
    console.error("Failed to filter visible stopping points: ", e);
    return [...fetchedHalts]; // Fallback to showing all stopping points
  }
}

const cache = new LRUCache<string, OsmNode[]>({
  max: 100, // Cache with a max size of 100 entries
});

const StoppingPointsLayer: FunctionComponent = () => {
  const map = useMap();
  const fetchedHaltsRef = useRef<OsmNode[]>([]);
  const [visibleStoppingPoints, setVisibleStoppingPoints] = useState<OsmNode[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(map?.getZoom() || 0);

  // Store the current abort controller to cancel ongoing requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Store the handler in a ref to prevent recreating it on every render
  const handlerRef = useRef<DebouncedFunc<LeafletEventHandlerFn>>();
  const fetchHandlerRef = useRef<DebouncedFunc<() => Promise<void>>>();
  const zoomHandlerRef = useRef<() => void>();

  // Function to fetch railway halts for current bounds
  const fetchHaltsForCurrentBounds = useCallback(async () => {
    if (!map) return;

    // Don't fetch data when zoomed out too far
    if (map.getZoom() < MIN_ZOOM) {
      fetchedHaltsRef.current = [];
      setVisibleStoppingPoints([]);
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const bounds = map.getBounds();
      const cacheKey = getBoundsCacheKey(bounds);

      // Check if we have cached data for these bounds
      if (cache.has(cacheKey)) {
        // Check if request was aborted before using cached data
        if (abortController.signal.aborted) {
          return;
        }

        fetchedHaltsRef.current = cache.get(cacheKey)!;
        setVisibleStoppingPoints(getVisibleStoppingPoints(map, fetchedHaltsRef.current));
        return;
      }

      // Fetch from API if not cached
      const south = bounds.getSouth();
      const west = bounds.getWest();
      const north = bounds.getNorth();
      const east = bounds.getEast();

      const response = await fetchRailwayHaltsWithoutRef(south, west, north, east, abortController.signal);

      // Check if request was aborted after fetch
      if (abortController.signal.aborted) {
        return;
      }

      // Cache the results
      cache.set(cacheKey, response.elements);
      fetchedHaltsRef.current = response.elements;
      setVisibleStoppingPoints(getVisibleStoppingPoints(map, fetchedHaltsRef.current));
    } catch (error) {
      // Don't log errors for aborted requests
      if (error instanceof Error && error.name === "AbortError") {
        console.debug("Railway halts fetch was aborted");
        return;
      }
      console.error("Error fetching railway halts:", error);
    } finally {
      // Clear the abort controller if this is still the current one
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [map]);

  useEffect(() => {
    if (!map) return; // Early return if map is not available

    // Create the zoom handler (not debounced for immediate response)
    if (!zoomHandlerRef.current) {
      zoomHandlerRef.current = () => {
        setCurrentZoom(map.getZoom());
        // Update visible points immediately
        setVisibleStoppingPoints(getVisibleStoppingPoints(map, fetchedHaltsRef.current));
      };
    }

    // Create the debounced handlers once
    if (!handlerRef.current) {
      handlerRef.current = debounce(function (this: L.Map) {
        setVisibleStoppingPoints(getVisibleStoppingPoints(this, fetchedHaltsRef.current));
      }, 500);
    }

    if (!fetchHandlerRef.current) {
      fetchHandlerRef.current = debounce(fetchHaltsForCurrentBounds, 1000);
    }

    // Map event handling
    const handler = handlerRef.current;
    const fetchHandler = fetchHandlerRef.current;
    const zoomHandler = zoomHandlerRef.current;

    map.on("move", handler);
    map.on("zoom", handler);
    map.on("zoom", zoomHandler); // Update zoom state immediately
    map.on("resize", handler);

    // Also trigger API fetch on significant map movements
    map.on("moveend", fetchHandler);
    map.on("zoomend", fetchHandler);

    // Set initial zoom
    setCurrentZoom(map.getZoom());

    // Initial fetch
    fetchHandler();

    return () => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      handler.cancel(); // Cancel any pending debounced calls
      fetchHandler.cancel();
      map.off("move", handler);
      map.off("zoom", handler);
      map.off("zoom", zoomHandler);
      map.off("resize", handler);
      map.off("moveend", fetchHandler);
      map.off("zoomend", fetchHandler);
    };
  }, [map, fetchHaltsForCurrentBounds]);

  // Don't render anything if zoomed out too far
  if (currentZoom < MIN_ZOOM) {
    return null;
  }

  return (
    <LayerGroup pane="stoppingPointsPane">
      {visibleStoppingPoints.map((stop) => (
        <StoppingPointMarker key={stop.id} stop={stop} />
      ))}
    </LayerGroup>
  );
};

export default StoppingPointsLayer;
