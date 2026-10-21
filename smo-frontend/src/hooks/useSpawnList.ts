import { useEffect, useState } from "react";

import { dataProvider } from "../utils/data-manager";
import type { SpawnListEntry } from "../utils/types";
import useBehaviorSubj from "./useBehaviorSubj";

/** How many hours ahead the spawn list goes. */
export const SPAWN_LIST_HOURS = 2;

const REFRESH_INTERVAL_MS = 30_000;
const SHARED_FOR_MS = 15_000;

// the panel and the station popups share one request per server
const requests = new Map<string, { requestedAt: number; promise: Promise<SpawnListEntry[] | null> }>();

function getSpawnList(serverCode: string) {
  const cached = requests.get(serverCode);
  if (cached && Date.now() - cached.requestedAt < SHARED_FOR_MS) return cached.promise;

  const promise = dataProvider.fetchSpawnList(serverCode, SPAWN_LIST_HOURS);
  requests.set(serverCode, { requestedAt: Date.now(), promise });
  return promise;
}

/**
 * The spawn list of the selected server, refreshed while `enabled`. Null while it's loading.
 */
export default function useSpawnList(enabled = true): SpawnListEntry[] | null {
  const selectedServer = useBehaviorSubj(dataProvider.selectedServerData$);
  const serverCode = selectedServer?.ServerCode;
  const [state, setState] = useState<{ serverCode: string; entries: SpawnListEntry[] } | null>(null);

  useEffect(() => {
    if (!enabled || !serverCode) return;

    let cancelled = false;
    const load = () =>
      getSpawnList(serverCode)
        .then((entries) => {
          if (!cancelled) setState({ serverCode, entries: entries ?? [] });
        })
        .catch((e) => console.error("Failed to load the spawn list", e));

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, serverCode]);

  return state && state.serverCode === serverCode ? state.entries : null;
}
