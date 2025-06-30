import { useEffect, useState } from "react";

import { dataProvider } from "../utils/data-manager";
import { SteamProfileResponse } from "../utils/types";

/**
 * Custom hook to fetch Steam profile data asynchronously
 * @param steamId - The Steam ID to fetch profile data for
 * @param providedUserData - Optional pre-existing user data to use instead of fetching
 * @returns Object containing userData and loading state
 */
export function useSteamProfileData(
  steamId: string | null | undefined,
  providedUserData?: SteamProfileResponse | null,
) {
  const [userData, setUserData] = useState<SteamProfileResponse | null>(providedUserData || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!steamId || providedUserData) {
      setUserData(providedUserData || null);
      return;
    }

    const abortController = new AbortController();
    setLoading(true);

    dataProvider
      .getSteamProfileData(steamId)
      .then((data) => {
        if (!abortController.signal.aborted) {
          setUserData(data ?? { PersonaName: steamId, Avatar: "" });
        }
      })
      .catch((e) => {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch Steam profile data: ", e);
          setUserData(null);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [steamId, providedUserData]);

  return { userData, loading };
}
