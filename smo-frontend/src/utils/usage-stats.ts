import { readLocalStorageValue } from "@mantine/hooks";

import { SETTINGS as DEFAULT_SETTINGS } from "../hooks/settings-defaults";
import { isSentryLoaded$ } from "./data-manager";

/**
 * Usage statistics: which map layers and settings are used, as Sentry metrics (counters), so the defaults and the
 * settings menu can follow what people actually use. Only with the cookie consent (Sentry is only loaded after it),
 * and only the settings' values: nothing about the user.
 *
 * - `usage.setting` (once per page load, per setting): `setting`, `value` and `changed` (whether it differs from the
 *   default).
 * - `usage.layer` (once per page load, per layer): `layer`, `visible` and `opacity`.
 * - `usage.setting_change` / `usage.layer_toggle` when a setting or a layer is changed: `setting`, `value` /
 *   `layer`, `visible`.
 */

type SettingKey = keyof typeof DEFAULT_SETTINGS;

function sendCount(name: string, attributes: Record<string, string | number | boolean>) {
  if (!isSentryLoaded$.getValue()) return;

  import("@sentry/react")
    .then((Sentry) => Sentry.metrics.count(name, 1, { attributes }))
    .catch((error) => console.error("Failed to send a usage metric", error));
}

/** A setting's value as a short string (the arrays and objects have their own metrics or are summarized). */
function describe(value: unknown): string {
  if (Array.isArray(value)) return value.join("-");
  if (value !== null && typeof value === "object") return "object";
  return String(value);
}

/**
 * Sends the current settings and layers once (call it right after Sentry has started).
 */
export function reportUsageSnapshot() {
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    if (key === "visibleLayers" || key === "layerOpacities") continue; // as layers below

    const value = readLocalStorageValue({ key, defaultValue: DEFAULT_SETTINGS[key] });
    sendCount("usage.setting", {
      setting: key,
      value: describe(value),
      changed: JSON.stringify(value) !== JSON.stringify(DEFAULT_SETTINGS[key]),
    });
  }

  const visible = new Set(
    readLocalStorageValue<string[]>({ key: "visibleLayers", defaultValue: [...DEFAULT_SETTINGS.visibleLayers] }),
  );
  const opacities = readLocalStorageValue<Record<string, number>>({
    key: "layerOpacities",
    defaultValue: DEFAULT_SETTINGS.layerOpacities,
  });
  const layers = new Set([...visible, ...Object.keys(DEFAULT_SETTINGS.layerOpacities)]);
  for (const layer of layers) {
    sendCount("usage.layer", {
      layer,
      visible: visible.has(layer),
      opacity: Math.round((opacities[layer] ?? 1) * 10) / 10,
    });
  }
}

/**
 * Counts a change of a setting (a layer turned on or off for `visibleLayers`). Nothing when the value stays the same.
 */
export function reportSettingChange(key: SettingKey, previous: unknown, next: unknown) {
  if (JSON.stringify(previous) === JSON.stringify(next)) return;

  if (key === "visibleLayers" && Array.isArray(previous) && Array.isArray(next)) {
    for (const layer of next.filter((l) => !previous.includes(l)))
      sendCount("usage.layer_toggle", { layer, visible: true });
    for (const layer of previous.filter((l) => !next.includes(l)))
      sendCount("usage.layer_toggle", { layer, visible: false });
    return;
  }

  if (key === "layerOpacities") return; // a slider: every step would count

  sendCount("usage.setting_change", { setting: key, value: describe(next) });
}
