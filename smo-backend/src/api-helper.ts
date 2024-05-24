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

export function getBaseTrain(train?: Train | null): BaseTrain | null {
  if (!train) return null;

  return {
    TrainNoLocal: train.TrainNoLocal,
    TrainName: train.TrainName,
    TrainData: getBaseTrainData(train),
  };
}

export function getBaseTrainData(train: Train): BaseTrainData {
  return {
    Velocity: train.TrainData.Velocity,
    SignalInFront: train.TrainData.SignalInFront,
    DistanceToSignalInFront: train.TrainData.DistanceToSignalInFront,
    SignalInFrontSpeed: train.TrainData.SignalInFrontSpeed,
  };
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

export async function fetchTimezone(serverCode: string): Promise<number> {
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
        logger.error("Invalid timezone", { module: "FETCH-TIMEZONE", serverCode });
        return 0;
      }

      return data;
    })
    .catch((e) => {
      logger.error(e, { module: "FETCH-TIMEZONE", serverCode });
      return 0;
    });
}

export async function fetchTime(serverCode: string): Promise<number> {
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
        logger.error("Invalid time", { module: "FETCH-TIME", serverCode });
        return 0;
      }

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

export async function fetchTimetable(serverCode: string): Promise<Record<string, Timetable>> {
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

      return parsedData;
    });
}
