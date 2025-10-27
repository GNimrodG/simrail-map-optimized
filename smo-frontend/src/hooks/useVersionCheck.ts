import { useEffect, useState } from "react";

import { VERSION } from "../version";

export const useVersionCheck = () => {
  const [isOutdated, setIsOutdated] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
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
    checkVersion();

    // Check periodically (every 5 minutes)
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { isOutdated, currentVersion: VERSION, latestVersion };
};
