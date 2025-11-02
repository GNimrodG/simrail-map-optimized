import { useLocalStorage } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { getCookieConsentValue } from "react-cookie-consent";

import { ALL_SETTINGS_KEYS } from "./useSetting";

const STORAGE_KEY = "settings-seen-keys";

export function useNewSettingsNotification() {
  const [seenKeys, setSeenKeys] = useLocalStorage<string[]>({
    key: STORAGE_KEY,
    defaultValue: [],
  });

  const [hasNewSettings, setHasNewSettings] = useState(false);

  useEffect(() => {
    // Check if there are any new settings the user hasn't seen
    const unseenSettings = ALL_SETTINGS_KEYS.filter((key) => !seenKeys.includes(key));
    setHasNewSettings(unseenSettings.length > 0);
  }, [seenKeys]);

  const markAsSeen = () => {
    setHasNewSettings(false);

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
