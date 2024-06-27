import { useLocalStorage } from "@mantine/hooks";
import { useMemo } from "react";

const SETTINGS = {
  selectedServer: "en1" as string,
  visibleLayers: [
    "stations",
    "trains",
    "active-signals",
    "selected-route",
    "unplayable-stations",
  ] as string[],
  useAltTracking: false,
  expandScheduleDefault: false,
  hideTrainPictures: false,
  showLineToNextSignal: false,
  showSpeedInfoCollapsed: true,
  showSignalInfoCollapsed: true,
  showNextStationInfoCollapsed: false,
  alternativeTheme: false,
} as const;

export type TSettings = typeof SETTINGS;

export function useSetting<T extends keyof typeof SETTINGS>(key: T) {
  return useLocalStorage(useMemo(() => ({ key, defaultValue: SETTINGS[key] }), [key]));
}
