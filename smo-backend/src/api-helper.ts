const SERVERS_OPEN_URL = "https://panel.simrail.eu:8084/servers-open";
const TRAINS_URL_PREFIX = "https://panel.simrail.eu:8084/trains-open?serverCode=";
const STATIONS_URL_PREFIX = "https://panel.simrail.eu:8084/stations-open?serverCode=";

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
