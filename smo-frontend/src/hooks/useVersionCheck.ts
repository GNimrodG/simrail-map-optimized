import { useEffect, useState } from "react";

import { VERSION } from "../version";

/** The server version this tab already reloaded for by itself (sessionStorage), so a reload that still gets the old
 * build shows the dialog instead of reloading again and again. */
const AUTO_UPDATE_KEY = "smo-auto-update";

/**
 * Loads the latest version: unregisters the service workers and clears their caches (waiting for both, or the reload
 * can still be served the old build), then reloads the page.
 */
export const forceUpdate = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if (globalThis.caches) {
      const names = await globalThis.caches.keys();
      await Promise.all(names.map((name) => globalThis.caches.delete(name)));
    }
  } catch (error) {
    console.error("Error clearing the cached version:", error);
  }
  globalThis.location.reload();
};

/** Reads one sessionStorage value, null when storage isn't available. */
const readSession = (key: string) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Writes one sessionStorage value, false when storage isn't available. */
const writeSession = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const useVersionCheck = () => {
  const [isOutdated, setIsOutdated] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    /** @param onLoad whether the page just opened: the only time a reload interrupts nothing (later on, the user may
     * be following the map while playing, even from a background tab on another screen) */
    const checkVersion = async (onLoad: boolean) => {
      try {
        // Fetch the version.txt file with cache-busting query parameter
        const response = await fetch(`/version.txt?t=${Date.now()}`);
        if (!response.ok) {
          console.warn("Failed to fetch version.txt");
          return;
        }

        const serverVersion = (await response.text()).trim();
        setLatestVersion(serverVersion);

        // Compare versions
        if (serverVersion !== VERSION) {
          // already out when the page opens: update right away (once per version, see AUTO_UPDATE_KEY); one that
          // comes out while the page is open asks first
          if (
            onLoad &&
            readSession(AUTO_UPDATE_KEY) !== serverVersion &&
            writeSession(AUTO_UPDATE_KEY, serverVersion)
          ) {
            console.info(`Updating from ${VERSION} to ${serverVersion}.`);
            await forceUpdate();
            return;
          }
          setIsOutdated(true);
          console.warn(
            `Version mismatch detected. Current: ${VERSION}, Server: ${serverVersion}. Please refresh the page.`,
          );
        }
      } catch (error) {
        console.error("Error checking version:", error);
      }
    };

    // Check on mount
    void checkVersion(true);

    // Check periodically (every 5 minutes)
    const interval = setInterval(() => checkVersion(false), 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { isOutdated, currentVersion: VERSION, latestVersion };
};
