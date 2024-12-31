import { useLocalStorage } from "@mantine/hooks";
import { useMemo } from "react";

const SETTINGS = {
  selectedServer: "en1",
  visibleLayers: ["stations", "trains", "active-signals", "selected-route", "unplayable-stations"] as string[],
  useAltTracking: false,
  expandScheduleDefault: false,
  hideTrainPictures: false,
  showLineToNextSignal: false,
  showSpeedInfoCollapsed: true,
  showSignalInfoCollapsed: true,
  showNextStationInfoCollapsed: false,
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
  } as Record<string, number>,
  disableLowSpeedWarning: false,
  autoZoom: false,
  autoZoomLimits: [200, 250] as [number, number],
} as const;

export type TSettings = typeof SETTINGS;

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
