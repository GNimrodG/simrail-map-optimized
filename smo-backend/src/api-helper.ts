import logger from "./logger";

const SERVERS_OPEN_URL = "https://panel.simrail.eu:8084/servers-open";
const TRAINS_URL_PREFIX = "https://panel.simrail.eu:8084/trains-open?serverCode=";
const STATIONS_URL_PREFIX = "https://panel.simrail.eu:8084/stations-open?serverCode=";
const TIMEZONE_URL_PREFIX = "https://api.simrail.eu:8082/api/getTimeZone?serverCode=";
const TIME_URL_PREFIX = "https://api.simrail.eu:8082/api/getTime?serverCode=";
const TIMETABLE_URL_PREFIX = "https://api.simrail.eu:8082/api/getAllTimetables?serverCode=";

// TODO: Make this a common library
export interface ServerStatus {
  ServerCode: string;
  ServerName: string;
  ServerRegion: string;
  IsActive: boolean;
  id: string;
}

export interface Train {
  TrainNoLocal: string;
  TrainName: string;
  StartStation: string;
  EndStation: string;
  Vehicles: string[];
  ServerCode: string;
  TrainData: TrainData;
  id: string;
  Type: "user" | "bot";
}

export interface TrainData {
  ControlledBySteamID: string;
  InBorderStationArea: boolean;
  Latititute: number;
  Longitute: number;
  Velocity: number;
  SignalInFront: string;
  DistanceToSignalInFront: number;
  SignalInFrontSpeed: number;
  VDDelayedTimetableIndex: number;
}

export interface Station {
  Name: string;
  Prefix: string;
  DifficultyLevel: number;
  Latititude: number;
  Longitude: number;
  MainImageURL: string;
  AdditionalImage1URL: string;
  AdditionalImage2URL: string;
  DispatchedBy: [
    {
      ServerCode: string;
      SteamId: string;
    }
  ];
  id: string;
}

export async function fetchServersOpen() {
  return fetch(SERVERS_OPEN_URL)
    .then((res) => res.json())
    .then((data) =>
      typeof data === "object" && !!data && "result" in data && "data" in data && data.result
        ? (data.data as ServerStatus[])
        : []
    );
}

export async function fetchTrains(serverCode: string) {
  return fetch(TRAINS_URL_PREFIX + serverCode)
    .then((res) => res.json())
    .then((data) =>
      typeof data === "object" && !!data && "result" in data && "data" in data && data.result
        ? (data.data as Train[])
        : []
    );
}

export async function fetchStations(serverCode: string) {
  return fetch(STATIONS_URL_PREFIX + serverCode)
    .then((res) => res.json())
    .then((data) =>
      typeof data === "object" && !!data && "result" in data && "data" in data && data.result
        ? (data.data as Station[])
        : []
    );
}

const timeZoneCache = new Map<string, { timezone: number; fetchedAt: number }>();
const TIMEZONE_CACHE_EXPIRY = 24 * 60 * 60 * 1000;

export async function fetchTimezone(serverCode: string): Promise<number> {
  if (
    timeZoneCache.has(serverCode) &&
    Date.now() - timeZoneCache.get(serverCode)!.fetchedAt < TIMEZONE_CACHE_EXPIRY
  ) {
    return timeZoneCache.get(serverCode)!.timezone;
  }

  const start = Date.now();
  return fetch(TIMEZONE_URL_PREFIX + serverCode)
    .then((res) => {
      logger.debug(`Fetched timezone in ${Date.now() - start}ms for ${serverCode}`, {
        module: "FETCH-TIMEZONE",
      });
      return res;
    })
    .then((res) => res.text())
    .then((data) => parseInt(data))
    .then((data) => {
      if (isNaN(data)) {
        throw new Error("Invalid timezone");
      }

      timeZoneCache.set(serverCode, { timezone: data, fetchedAt: Date.now() });
      return data;
    })
    .catch((e) => {
      logger.error(e, { module: "FETCH-TIMEZONE", serverCode });
      return 0;
    });
}

const timeCache = new Map<string, { time: number; at: number }>();
const TIME_CACHE_EXPIRY = 5 * 60 * 1000;

export async function fetchTime(serverCode: string): Promise<number> {
  if (timeCache.has(serverCode) && Date.now() - timeCache.get(serverCode)!.at < TIME_CACHE_EXPIRY) {
    return timeCache.get(serverCode)!.time + Date.now() - timeCache.get(serverCode)!.at;
  }

  const start = Date.now();
  return fetch(TIME_URL_PREFIX + serverCode)
    .then((res) => {
      logger.debug(`Fetched time in ${Date.now() - start}ms for ${serverCode}`, {
        module: "FETCH-TIME",
      });
      return res;
    })
    .then((res) => res.text())
    .then((data) => parseInt(data))
    .then((data) => {
      if (isNaN(data)) {
        throw new Error("Invalid time");
      }

      timeCache.set(serverCode, { time: data, at: Date.now() });
      return data;
    })
    .catch((e) => {
      logger.error(e, { module: "FETCH-TIME", serverCode });
      return 0;
    });
}

export interface Timetable {
  trainNoLocal: string;
  trainNoInternational: string;
  trainName: string;
  startStation: string;
  startsAt: `${number}:${number}:${number}`;
  endStation: string;
  endsAt: `${number}:${number}:${number}`;
  locoType: string;
  trainLength: number;
  trainWeight: number;
  continuesAs: string;
  timetable: TimetableEntry[];
}

export interface TimetableEntry {
  nameOfPoint: string;
  nameForPerson: string;
  pointId: string;
  supervisedBy: string;
  radioChannels: string;
  displayedTrainNumber: string;
  arrivalTime: `${number}-${number}-${number} ${number}:${number}:${number}` | null;
  departureTime: `${number}-${number}-${number} ${number}:${number}:${number}` | null;
  stopType: "NoStopOver" | "CommercialStop" | "NoncommercialStop";
  line: number;
  platform: string | null;
  track: number | null;
  trainType: string;
  mileage: number;
  maxSpeed: number;
  stationCategory: "A" | "B" | "C" | "D" | null;
}

// only fetches the timetable if it's not in the cache or if it's older than 5 minutes
const timetableCache = new Map<string, { data: Record<string, Timetable>; fetchedAt: number }>();
const TIMETABLE_CACHE_EXPIRY = 30 * 60 * 1000;

export async function fetchTimetable(serverCode: string): Promise<Record<string, Timetable>> {
  if (
    timetableCache.has(serverCode) &&
    Date.now() - timetableCache.get(serverCode)!.fetchedAt < TIMETABLE_CACHE_EXPIRY
  ) {
    return timetableCache.get(serverCode)!.data;
  }

  const start = Date.now();
  return fetch(TIMETABLE_URL_PREFIX + serverCode)
    .then((res) => {
      logger.debug(`Fetched timetable in ${Date.now() - start}ms for ${serverCode}`, {
        module: "FETCH-TIMETABLE",
      });
      return res;
    })
    .then((res) => res.json())
    .then((data) => data as Timetable[])
    .then((data) => {
      const parsedData = data.reduce<Record<string, Timetable>>(
        (prev, curr) => ({ ...prev, [curr.trainNoLocal]: curr }),
        {}
      );

      timetableCache.set(serverCode, {
        data: parsedData,
        fetchedAt: Date.now(),
      });

      return parsedData;
    });
}
