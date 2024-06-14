import { readLocalStorageValue } from "@mantine/hooks";
import { LRUCache } from "lru-cache";
import { BehaviorSubject } from "rxjs";
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
    }
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

const SERVER_URL = import.meta.env.PROD ? "wss://api.smo.data-unknown.com" : "ws://localhost:3000";

export const isConnected$ = new BehaviorSubject(false);

const socket = io(SERVER_URL, {
  parser: msgpackParser,
});

socket.on("connect", () => {
  isConnected$.next(true);
  console.log("Connected to server as", socket.id);
  const selectedServer = readLocalStorageValue({ key: "selectedServer" }) || "en1";
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

export async function fetchTimetable(train: string) {
  return new Promise<Timetable | null>((resolve) => {
    const cached = timetableCache.get(train);

    if (cached) {
      console.log("Got cached timetable for train ", train);
      resolve(cached);
      return;
    }

    socket.emit("get-train-timetable", train, (timetable: Timetable) => {
      console.log("Got timetable for train ", train);
      timetableCache.set(train, timetable);
      resolve(timetable);
    });
  });
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
