import { BehaviorSubject } from "rxjs";

import UnplayableStations from "../assets/unplayable-stations.json";

/**
 * Whether the spawn list is open, and the station it's filtered to (null: all border stations) with the timetable
 * point names that belong to it.
 */
export const spawnListRequest$ = new BehaviorSubject<{ station: string | null; names: string[] } | null>(null);

/**
 * The timetable point names that belong to a station: its own name, its sub-stations and the points around it that
 * the station timetable leaves out (so spawns into e.g. a freight part of the station count for it).
 */
export function getStationPointNames(station: string): string[] {
  const unplayableStation = UnplayableStations.find((s) => s.Name === station);
  return [station, ...(unplayableStation?.SubStations ?? []), ...(unplayableStation?.IgnoredStations ?? [])];
}

export const openSpawnList = (station: string | null = null) =>
  spawnListRequest$.next({ station, names: station ? getStationPointNames(station) : [] });

export const closeSpawnList = () => spawnListRequest$.next(null);
