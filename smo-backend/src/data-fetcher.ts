import { Station, Train, fetchServersOpen, fetchStations, fetchTrains } from "./api-helper";
import logger from "./logger";

const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || "") || 1000;
const localData = new Map<string, { trains: Train[]; stations: Station[]; lastUpdated: number }>();

let timeoutHandle: NodeJS.Timeout | null = null;
let onRefreshData: ((data: typeof localData) => void) | null = null;

logger.info(`Refresh interval: ${REFRESH_INTERVAL}`);

export async function refreshData() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  timeoutHandle = null;

  try {
    const start = Date.now();
    logger.info("Refreshing data...");
    const servers = await fetchServersOpen();
    logger.info(`Fetching data for ${servers.length} servers...`);
    for (const server of servers) {
      const trains = await fetchTrains(server.ServerCode);
      const stations = await fetchStations(server.ServerCode);
      localData.set(server.ServerCode, { trains, stations, lastUpdated: Date.now() });
    }

    const end = Date.now();

    logger.info(`Data refreshed in ${end - start}ms`, { level: "success" });

    onRefreshData?.(localData);

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

export function onDataRefreshed(callback: (data: typeof localData) => void) {
  onRefreshData = callback;
}

export function getServerData(serverCode: string) {
  return localData.get(serverCode);
}

export function getServerCodes() {
  return Array.from(localData.keys());
}
