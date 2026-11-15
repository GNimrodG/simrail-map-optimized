import { useLocalStorage } from "@mantine/hooks";
import { type SetStateAction, useCallback, useEffect, useMemo, useRef } from "react";

import { reportSettingChange } from "../utils/usage-stats";
import { SETTINGS } from "./settings-defaults";

export type TSettings = typeof SETTINGS;

export { SETTINGS as DEFAULT_SETTINGS } from "./settings-defaults";

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
  type Value = CleanType<(typeof SETTINGS)[T]>;
  const [value, setValue, removeValue] = useLocalStorage(
    useMemo(
      () => ({
        key,
        defaultValue: SETTINGS[key] as Value,
      }),
      [key],
    ),
  );

  // the latest value, to tell what a change changed (for the usage stats)
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const set = useCallback(
    (next: SetStateAction<Value>) => {
      const resolved = typeof next === "function" ? (next as (previous: Value) => Value)(latest.current) : next;
      reportSettingChange(key, latest.current, resolved);
      setValue(next);
    },
    [key, setValue],
  );

  return [value, set, removeValue] as const;
}
