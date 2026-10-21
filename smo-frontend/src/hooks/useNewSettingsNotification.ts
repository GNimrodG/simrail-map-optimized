import { useLocalStorage } from "@mantine/hooks";
import { useState } from "react";
import { getCookieConsentValue } from "react-cookie-consent";

import { ALL_SETTINGS_KEYS } from "./useSetting";

const STORAGE_KEY = "settings-seen-keys";

export function useNewSettingsNotification() {
  const [seenKeys, setSeenKeys] = useLocalStorage<string[]>({
    key: STORAGE_KEY,
    defaultValue: [],
  });

  // dismissed for this visit even when the seen settings can't be stored (cookies not accepted)
  const [dismissed, setDismissed] = useState(false);

  // Check if there are any new settings the user hasn't seen
  const hasNewSettings = !dismissed && ALL_SETTINGS_KEYS.some((key) => !seenKeys.includes(key));

  const markAsSeen = () => {
    setDismissed(true);

    // Only store in localStorage if cookies are accepted
    const cookiesAccepted = getCookieConsentValue("smo_data_unknown_gdpr_consent") === "true";
    if (!cookiesAccepted) {
      return;
    }

    // Store all current settings keys as seen
    setSeenKeys([...ALL_SETTINGS_KEYS]);
  };

  return {
    hasNewSettings,
    markAsSeen,
  };
}
