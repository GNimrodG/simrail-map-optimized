import { useLocalStorage } from "@mantine/hooks";
import { useMemo } from "react";

const SETTINGS = {
  selectedServer: "int1",
  visibleLayers: ["stations", "trains", "active-signals", "selected-route", "unplayable-stations"] as string[],
  useAltTracking: false,
  expandScheduleDefault: false,
  hideTrainPictures: false,
  showLineToNextSignal: false,
  showSpeedInfoCollapsed: true,
  showSignalInfoCollapsed: true,
  showNextStationInfoCollapsed: false,
  showDelayInfoCollapsed: true,
  alternativeTheme: false,
  disableSlidingMarkers: false,
  layerOpacities: {
    "orm-infra": 1,
    "orm-maxspeed": 1,
    "orm-signals": 1,
    "orm-electrification": 1,
    "stations": 1,
    "trains": 1,
    "passive-signals": 1,
    "active-signals": 1,
    "selected-route": 1,
    "unplayable-stations": 1,
    "stoppingpoints": 1,
  } as Record<string, number>,
  disableLowSpeedWarning: false,
  autoZoom: false,
  autoZoomLimits: [200, 250] as [number, number],
  translateStationNames: false,
  reduceBackgroundUpdates: true,
  stationTimetableDefaultViewMode: "table" as "table" | "cards" | "grouped" | "lastUsed",
  groupTimetableByLineNumber: false,
  timetableGroupedMaxEntriesDefault: 50,
  timetableGroupedMaxEntriesSmall: 5,
  timetableGroupedMaxEntriesLarge: 10,
  timetableGroupedHidePassed: false,
} as const;

export type TSettings = typeof SETTINGS;

// Export all settings keys for use in other hooks
export const ALL_SETTINGS_KEYS = Object.keys(SETTINGS) as Array<keyof typeof SETTINGS>;

// Cleans up to the base type
type CleanType<Base> = Base extends true
  ? boolean
  : Base extends false
    ? boolean
    : Base extends number
      ? number
      : Base extends string
        ? string
        : Base extends ReadonlyArray<infer U>
          ? U[]
          : Base;

export function useSetting<T extends keyof typeof SETTINGS>(key: T) {
  return useLocalStorage(
    useMemo(
      () => ({
        key,
        defaultValue: SETTINGS[key] as CleanType<(typeof SETTINGS)[T]>,
      }),
      [key],
    ),
  );
}
