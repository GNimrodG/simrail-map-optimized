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

const SERVER_URL = "ws://localhost:3000";

let serverData: ServerStatus[] = [];

const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log("Connected to server");
  socket.emit(
    "switch-server",
    localStorage.getItem("selectedServer")?.replace(/(^")|("$)/g, "") || "en1",
    (success: boolean) => {
      if (success) {
        console.log(
          "Switched to server",
          localStorage.getItem("selectedServer")?.replace(/(^")|("$)/g, "") || "en1"
        );
      }
    }
  );
});

export function selectServer(serverCode: string) {
  socket.emit("switch-server", serverCode, (success: boolean) => {
    if (success) {
      console.log(`Switched to server ${serverCode}`);
    } else {
      console.error(`Failed to switch to server ${serverCode}`);
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

export type DataCallback = (data: {
  trains: Train[];
  stations: Station[];
  trainRoutes: TrainRoute[];
  signals: SignalWithTrain[];
}) => void;

export function onData(callback: DataCallback) {
  socket.on("data", callback);
}

export function offData(
  callback: (data: {
    trains: Train[];
    stations: Station[];
    trainRoutes: TrainRoute[];
    signals: SignalWithTrain[];
  }) => void
) {
  socket.off("data", callback);
}
