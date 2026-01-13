import { BehaviorSubject, Observable } from "rxjs";

import {
  ServerStatus,
  SignalStatus,
  SimplifiedTimtableEntry,
  Station,
  UserProfileResponse,
  SteamProfileStats,
  TimeData,
  Timetable,
  Train,
} from "../utils/types";

export interface IDataProvider {
  isConnected$: BehaviorSubject<boolean>;

  selectServer(serverCode: string): void;

  serverData$: BehaviorSubject<ServerStatus[]>;

  selectedServerData$: BehaviorSubject<ServerStatus | null>;

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

  /**
   * Get lines for a specific signal in WKT format.
   * @param signal The name of the signal to get lines for.
   * @return A promise that resolves to an array of WKT lines or null if not found.
   */
  getLinesForSignal(signal: string): Promise<string[] | null>;

  /**
   * Get lines for a connection between two signals in WKT format.
   * @param prevSignal The name of the previous signal.
   * @param nextSignal The name of the next signal.
   * @return A promise that resolves to an array of WKT lines or null if not found.
   */
  getLinesForSignalConnection(prevSignal: string, nextSignal: string): Promise<string[] | null>;

  getSteamProfileData(steamId: string): Promise<UserProfileResponse | null>;
  getSteamProfileStats(steamId: string): Promise<SteamProfileStats | null>;
  getXboxProfileData(xboxId: string): Promise<UserProfileResponse | null>;
}
