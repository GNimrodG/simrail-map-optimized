import { BehaviorSubject, Observable } from "rxjs";

import {
  ServerRestartPrediction,
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
  simRailApiAvailable$: BehaviorSubject<boolean | null>;

  selectServer(serverCode: string): void;

  serverData$: BehaviorSubject<ServerStatus[]>;

  selectedServerData$: BehaviorSubject<ServerStatus | null>;

  /** The next restart prediction of every server. */
  nextServerRestarts$: BehaviorSubject<ServerRestartPrediction[]>;

  stationsData$: BehaviorSubject<Station[]>;
  unplayableStations$: BehaviorSubject<Station[]>;

  /**
   * Get the timetable entries of many stations (e.g. a station with its sub-stations), in one request.
   * @param stationNames The names of the stations.
   * @return A promise that resolves to the entries of each station, in the same order (null where unavailable).
   */
  getStationTimetables(stationNames: string[]): Promise<(SimplifiedTimtableEntry[] | null)[]>;

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
   * Get lines for many connections between two signals in WKT format, in one request.
   * @param connections The [previous signal, next signal] pairs.
   * @return A promise that resolves to the WKT lines of each connection, in the same order (null where unavailable).
   */
  getLinesForSignalConnections(connections: [string, string][]): Promise<(string[] | null)[]>;

  /**
   * Get the playable area of the map (around the tracks trains run on outside the border stations).
   * @return A promise that resolves to the area, or null if it's unavailable.
   */
  fetchPlayableArea(): Promise<GeoJSON.Polygon | GeoJSON.MultiPolygon | null>;

  getSteamProfileData(steamId: string): Promise<UserProfileResponse | null>;
  getSteamProfileStats(steamId: string): Promise<SteamProfileStats | null>;
  getXboxProfileData(xboxId: string): Promise<UserProfileResponse | null>;
}
