import {
  ServerStatus,
  Station,
  Train,
  fetchServersOpen,
  fetchStations,
  fetchTrains,
} from "./api-helper";
import logger from "./logger";

const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || "") || 1000;
let serverData: ServerStatus[] = [];
const localData = new Map<string, { trains: Train[]; stations: Station[]; lastUpdated: number }>();

let timeoutHandle: NodeJS.Timeout | null = null;
type RefreshDataCallback = (servers: ServerStatus[], data: typeof localData) => void;
let onRefreshData: RefreshDataCallback | null = null;

logger.info(`Refresh interval: ${REFRESH_INTERVAL}`);

export async function refreshData() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  timeoutHandle = null;

  try {
    const start = Date.now();
    logger.info("Refreshing data...");
    serverData = await fetchServersOpen();
    logger.info(`Fetching data for ${serverData.length} servers...`);
    for (const server of serverData) {
      const trains = await fetchTrains(server.ServerCode);
      const stations = await fetchStations(server.ServerCode);
      localData.set(server.ServerCode, { trains, stations, lastUpdated: Date.now() });
    }

    const end = Date.now();

    logger.info(`Data refreshed in ${end - start}ms`, { level: "success" });

    onRefreshData?.(serverData, localData);

    if (!timeoutHandle) {
      timeoutHandle = setTimeout(refreshData, REFRESH_INTERVAL);
    }
  } catch (error) {
    logger.error(`Error refreshing data: ${error}`);

    if (!timeoutHandle) {
      timeoutHandle = setTimeout(refreshData, REFRESH_INTERVAL);
    }
  }
}

export function onDataRefreshed(callback: RefreshDataCallback) {
  onRefreshData = callback;
}

export function getServerData(serverCode: string) {
  return localData.get(serverCode);
}

export function getServerCodes() {
  return Array.from(localData.keys());
}

export function getServerStatus() {
  return serverData;
}
