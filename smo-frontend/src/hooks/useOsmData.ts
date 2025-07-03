import { LRUCache } from "lru-cache";
import { useEffect, useState } from "react";

import { fetchOsmDataForStation } from "../utils/osm-utils";
import { OsmNode } from "../utils/types";

const cache = new LRUCache<string, OsmNode>({ max: 100 }); // Cache with a max size of 100 entries

export function useOsmData(name: string, prefix?: string): OsmNode | null {
  const [osmData, setOsmData] = useState<OsmNode | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const fetchData = async () => {
      const cachedData = cache.get(name);
      if (cachedData) {
        setOsmData(cachedData);
        return;
      }

      const data = await fetchOsmDataForStation(name, prefix, signal);
      if (data) cache.set(name, data); // Cache the fetched data
      if (signal.aborted) return;
      setOsmData(data);
    };

    fetchData();

    return () => {
      abortController.abort(); // Clean up on unmount
    };
  }, [name, prefix]);

  return osmData;
}
