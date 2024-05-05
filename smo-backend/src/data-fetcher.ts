import {
  ServerStatus,
  Station,
  Timetable,
  Train,
  fetchServersOpen,
  fetchStations,
  fetchTime,
  fetchTimetable,
  fetchTimezone,
  fetchTrains,
} from "./api-helper";
import logger from "./logger";
import { Server as SocketIOServer } from "socket.io";

const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || "") || 1000;
let serverData: ServerStatus[] = [];

interface LocalData {
  trains: Train[];
  stations: Station[];
  timezone: number;
  time: number;
  timeTables: Record<string, Timetable>;
  lastUpdated: number;
}

const localData = new Map<string, LocalData>();

let timeoutHandle: NodeJS.Timeout | null = null;
type ServerListCallback = (servers: ServerStatus[]) => void;
type ServerDataCallback = (server: string, data: LocalData) => void;
type AllDataCallback = (data: typeof localData) => void;
let onServerData: ServerListCallback | null = null;
let onRefreshData: ServerDataCallback | null = null;
let onAllData: AllDataCallback | null = null;

logger.info(`Refresh interval: ${REFRESH_INTERVAL}`);

let avgRefreshTime = 0;

let _io: SocketIOServer;

export async function refreshData(io: SocketIOServer = _io) {
  _io = io;

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  timeoutHandle = null;

  try {
    const start = Date.now();
    logger.info("Refreshing data...");
    serverData = await fetchServersOpen();
    onServerData?.(serverData);

    logger.info(`Fetching data for ${serverData.length} servers...`);
    for (const server of serverData) {
      const serverData = await fetchServer(server.ServerCode);
      localData.set(server.ServerCode, serverData);
      onRefreshData?.(server.ServerCode, serverData);
    }

    const time = Date.now() - start;
    if (avgRefreshTime === 0) {
      avgRefreshTime = time;
    } else {
      avgRefreshTime = (avgRefreshTime + time) / 2;
    }

    logger.info(`Data refreshed in ${time}ms (avg: ${avgRefreshTime}ms)`, { level: "success" });

    onAllData?.(localData);

    if (!timeoutHandle) {
      logger.info(`Next refresh in ${Math.max(REFRESH_INTERVAL - time, 0)}ms`);
      timeoutHandle = setTimeout(refreshData, Math.max(REFRESH_INTERVAL - time, 0));
    }
  } catch (error) {
    logger.error(`Error refreshing data: ${error}`);

    if (!timeoutHandle) {
      timeoutHandle = setTimeout(refreshData, REFRESH_INTERVAL);
    }
  }
}

async function fetchServer(server: string) {
  const [trains, stations, timeTables, timezone, time] = await Promise.all([
    fetchTrains(server),
    fetchStations(server),
    fetchTimetable(server),
    fetchTimezone(server),
    fetchTime(server),
  ]);
  const serverData: LocalData = {
    trains,
    stations,
    lastUpdated: Date.now(),
    timezone,
    time,
    timeTables,
  };
  return serverData;
}

export function onServerDataRefreshed(callback: ServerListCallback) {
  onServerData = callback;
}

export function onDataRefreshed(callback: ServerDataCallback) {
  onRefreshData = callback;
}

export function onAllDataRefreshed(callback: AllDataCallback) {
  onAllData = callback;
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

export function getTimetableForTrain(serverCode: string, trainNoLocal: string) {
  return localData.get(serverCode)?.timeTables[trainNoLocal] || null;
}
