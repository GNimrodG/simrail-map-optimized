import { readLocalStorageValue } from "@mantine/hooks";
import { LRUCache } from "lru-cache";
import { BehaviorSubject, map } from "rxjs";
import { io } from "socket.io-client";
import msgpackParser from "socket.io-msgpack-parser";

export interface ServerStatus {
  ServerCode: string;
  ServerName: string;
  ServerRegion: string;
  IsActive: boolean;
  id: string;
}

export interface BaseTrain {
  TrainNoLocal: string;
  TrainName: string;
  TrainData: BaseTrainData;
}

export interface BaseTrainData {
  Velocity: number;
  SignalInFront: string;
  DistanceToSignalInFront: number;
  SignalInFrontSpeed: number;
}

export interface Train extends BaseTrain {
  StartStation: string;
  EndStation: string;
  Vehicles: string[];
  ServerCode: string;
  TrainData: TrainData;
  id: string;
  Type: "user" | "bot";
}

export interface TrainData extends BaseTrainData {
  ControlledBySteamID: string;
  InBorderStationArea: boolean;
  Latititute: number;
  Longitute: number;
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
    },
  ];
  id: string;
}

export interface Signal {
  name: string;
  lat: number;
  lon: number;
  extra: string;
  accuracy: number;
  type?: string | null;
  role?: string | null;
  prevFinalized: boolean;
  nextFinalized: boolean;
  prevSignals: string[];
  nextSignals: string[];
}

export interface SignalWithTrain extends Signal {
  train: BaseTrain;
  trainAhead: BaseTrain;
  nextSignalWithTrainAhead: string | null;
}

export interface TrainRoute {
  route: string;
  points: [number, number][];
}

export interface TimeData {
  time: number;
  timezone: number;
  lastUpdated: number;
}

const SERVER_URL =
  new URLSearchParams(location.search).get("server") ||
  (import.meta.env.PROD ? "wss://api.smo.data-unknown.com" : "ws://localhost:3000");

const _SERVER_URL = new URL(SERVER_URL);

const SERVER_API_URL = (_SERVER_URL.protocol === "wss:" ? "https://" : "http://") + _SERVER_URL.host;

export function deletePrevSignal(signal: string, prevSignal: string) {
  fetch(`${SERVER_API_URL}/signals/${encodeURIComponent(signal)}/prev`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: localStorage.getItem("adminPassword"), prevSignal }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        console.log(`Deleted signal connection ${prevSignal}->${signal}`);
      } else {
        console.error(`Failed to delete signal connection ${prevSignal}->${signal}`, data.error);
      }
    })
    .catch((e) => {
      console.error(`Failed to delete signal connection ${prevSignal}->${signal}`, e);
    });
}

export function deleteNextSignal(signal: string, nextSignal: string) {
  fetch(`${SERVER_API_URL}/signals/${encodeURIComponent(signal)}/next`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: localStorage.getItem("adminPassword"), nextSignal }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        console.log(`Deleted signal connection ${signal}->${nextSignal}`);
      } else {
        console.error(`Failed to delete signal connection ${signal}->${nextSignal}`, data.error);
      }
    })
    .catch((e) => {
      console.error(`Failed to delete signal connection ${signal}->${nextSignal}`, e);
    });
}

export function updateSignal(
  signal: string,
  type: string | null,
  role: string | null,
  prevFinalized: boolean,
  nextFinalized: boolean,
) {
  fetch(`${SERVER_API_URL}/signals/${encodeURIComponent(signal)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: localStorage.getItem("adminPassword"),
      type,
      role,
      prevFinalized,
      nextFinalized,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        console.log(`Updated signal ${signal} type to ${type}`);
      } else {
        console.error(`Failed to update signal ${signal} type to ${type}`, data.error);
      }
    })
    .catch((e) => {
      console.error(`Failed to update signal ${signal} type to ${type}`, e);
    });
}

export function deleteSignal(signal: string) {
  fetch(`${SERVER_API_URL}/signals/${encodeURIComponent(signal)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: localStorage.getItem("adminPassword") }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        console.log(`Deleted signal ${signal}`);
      } else {
        console.error(`Failed to delete signal ${signal}`, data.error);
      }
    })
    .catch((e) => {
      console.error(`Failed to delete signal ${signal}`, e);
    });
}

export const isConnected$ = new BehaviorSubject(false);

const socket = io(SERVER_URL, {
  parser: msgpackParser,
});

socket.on("connect", () => {
  isConnected$.next(true);
  console.log("Connected to server as", socket.id);
  const selectedServer = readLocalStorageValue({ key: "selectedServer" }) || "int1";
  socket.emit("switch-server", selectedServer, (success: boolean) => {
    if (success) {
      console.log("Switched to server", selectedServer);
    }
  });
});

export function selectServer(serverCode: string) {
  stationsData$.next([]);
  trainsData$.next([]);
  signalsData$.next([]);
  timeData$.next(null);
  socket.emit("switch-server", serverCode, (success: boolean) => {
    if (success) {
      console.log(`User switched to server ${serverCode}`);
    } else {
      console.error(`User failed to switch to server ${serverCode}`);
    }
  });
}

export const serverData$ = new BehaviorSubject<ServerStatus[]>([]);

socket.on("servers", (servers: ServerStatus[]) => {
  serverData$.next(servers);
});

export const stationsData$ = new BehaviorSubject<Station[]>([]);

socket.on("stations", (stations: Station[]) => {
  stationsData$.next(stations);
});

export const trainsData$ = new BehaviorSubject<Train[]>([]);

socket.on("trains", (trains: Train[]) => {
  trainsData$.next(trains);
});

export const trainsAvgSpeed$ = trainsData$.pipe(
  map((trains) =>
    trains.length === 0 ? null : trains.reduce((acc, train) => acc + train.TrainData.Velocity, 0) / trains.length,
  ),
);

export const signalsData$ = new BehaviorSubject<SignalWithTrain[]>([]);

socket.on("signals", (signals: SignalWithTrain[]) => {
  signalsData$.next(signals);
});

export const timeData$ = new BehaviorSubject<TimeData | null>(null);

socket.on("time", (time: TimeData) => {
  timeData$.next(time);
});

socket.on("disconnect", (e, d) => {
  isConnected$.next(false);
  console.warn("Disconnected from server", e, d);
});

export interface Data {
  trains: Train[];
  stations: Station[];
  signals: SignalWithTrain[];
  timezone: number;
  time: number;
}

const timetableCache = new LRUCache<string, Timetable>({ max: 10, ttl: 1000 * 60 * 60 }); // 1 hour
const timetablePromiseCache = new LRUCache<string, Promise<Timetable | null>>({
  max: 10,
  ttl: 1000 * 60 * 60,
});

export async function fetchTimetable(train: string) {
  const cached = timetableCache.get(train);

  if (cached) {
    console.log("Got cached timetable for train", train);
    return cached;
  }

  const cachedPromise = timetablePromiseCache.get(train);

  if (cachedPromise) {
    console.log("Got cached timetable promise for train", train);
    return cachedPromise;
  }

  const promise = new Promise<Timetable | null>((resolve) => {
    socket.emit("get-train-timetable", train, (timetable: Timetable) => {
      console.log("Got timetable for train", train);
      timetableCache.set(train, timetable);
      resolve(timetable);
    });

    setTimeout(() => {
      resolve(null);
    }, 30000); // 30 seconds timeout
  });

  promise.finally(() => {
    timetablePromiseCache.delete(train);
  });

  timetablePromiseCache.set(train, promise);

  return promise;
}

export async function fetchRoutePoints(trainRoute: string) {
  return new Promise<[number, number][] | null>((resolve) => {
    socket.emit("get-train-route-points", trainRoute, (route: [number, number][]) => {
      console.log("Got route points", trainRoute, route.length);
      resolve(route);
    });
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

const trainDelays$ = new BehaviorSubject<Map<string, Record<number, number>>>(new Map());

socket.on("delays", (data: Record<string, Record<number, number>>) => {
  const trainDelays = new Map<string, Record<number, number>>(Object.entries(data));

  trainDelays$.next(trainDelays);
});

export function getDelaysForTrain$(train: Train) {
  return getDelaysForTrainId$(train.id);
}

export function getDelaysForTrainId$(trainId: string) {
  return trainDelays$.pipe(map((delays) => delays.get(trainId) || {}));
}
