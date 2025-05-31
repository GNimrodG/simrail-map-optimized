import { BehaviorSubject, Observable } from "rxjs";

import {
  ServerStatus,
  SignalStatus,
  SimplifiedTimtableEntry,
  Station,
  SteamProfileResponse,
  SteamProfileStats,
  TimeData,
  Timetable,
  Train,
} from "../utils/types";

export interface IDataProvider {
  isConnected$: BehaviorSubject<boolean>;

  selectServer(serverCode: string): void;

  serverData$: BehaviorSubject<ServerStatus[]>;

  stationsData$: BehaviorSubject<Station[]>;
  unplayableStations$: BehaviorSubject<Station[]>;

  getStationTimetable(stationName: string): Promise<SimplifiedTimtableEntry[] | null>;

  trainsData$: BehaviorSubject<Train[]>;
  signalsData$: BehaviorSubject<SignalStatus[]>;
  trainDelays$: BehaviorSubject<Map<string, Record<number, number>>>;

  getDelaysForTrainId$(trainId: string): Observable<Record<number, number>>;
  getDelaysForTrainSync(trainId: string): Record<number, number> | null;

  timeData$: BehaviorSubject<TimeData | null>;

  fetchTimetable(trainNoLocal: string): Promise<Timetable | null>;

  fetchRoutePoints(trainNoLocal: string): Promise<string[] | null>;

  deletePrevSignal(signal: string, prevSignal: string): void;
  deleteNextSignal(signal: string, nextSignal: string): void;

  markSignalNextFinalized(signal: string, finalized: boolean): void;
  markSignalPrevFinalized(signal: string, finalized: boolean): void;

  deleteSignal(signal: string): void;

  getSteamProfileData(steamId: string): Promise<SteamProfileResponse | null>;
  getSteamProfileStats(steamId: string): Promise<SteamProfileStats | null>;
}
