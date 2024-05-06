import { readLocalStorageValue } from "@mantine/hooks";
import { io } from "socket.io-client";

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

export interface Signal {
  name: string;
  lat: number;
  lon: number;
  extra: string;
  accuracy: number;
}

export interface SignalWithTrain extends Signal {
  train: Train;
}

export interface TrainRoute {
  route: string;
  points: [number, number][];
}

const SERVER_URL = import.meta.env.PROD ? "wss://api.smo.data-unknown.com" : "ws://localhost:3000";

let serverData: ServerStatus[] = [];

const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log("Connected to server");
  const selectedServer = readLocalStorageValue({ key: "selectedServer" }) || "en1";
  socket.emit("switch-server", selectedServer, (success: boolean) => {
    if (success) {
      console.log("Switched to server", selectedServer);
    }
  });
});

export function selectServer(serverCode: string) {
  socket.emit("switch-server", serverCode, (success: boolean) => {
    if (success) {
      console.log(`User switched to server ${serverCode}`);
    } else {
      console.error(`User failed to switch to server ${serverCode}`);
    }
  });
}

socket.on("servers", (servers: ServerStatus[]) => {
  serverData = servers;
});

socket.on("disconnect", () => {
  console.warn("Disconnected from server");
});

export function getServerStatus() {
  return serverData;
}

export type ServerListCallback = (servers: ServerStatus[]) => void;

export function onServerList(callback: ServerListCallback) {
  socket.on("servers", callback);
  if (serverData.length) {
    callback(serverData);
  }
}

export function offServerList(callback: ServerListCallback) {
  socket.off("servers", callback);
}

export type DataCallback = (data: {
  trains: Train[];
  stations: Station[];
  signals: SignalWithTrain[];
  timezone: number;
  time: number;
}) => void;

export function onData(callback: DataCallback) {
  socket.on("data", callback);
}

export function offData(callback: DataCallback) {
  socket.off("data", callback);
}

export async function fetchTimetable(train: string) {
  return new Promise<Timetable | null>((resolve) => {
    socket.emit("get-train-timetable", train, (timetable: Timetable) => {
      resolve(timetable);
    });
  });
}

export async function fetchRoutePoints(trainRoute: string) {
  return new Promise<[number, number][] | null>((resolve) => {
    socket.emit("get-train-route-points", trainRoute, (route: [number, number][]) => {
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
