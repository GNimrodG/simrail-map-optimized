import { useEffect, useState } from "react";

import { dataProvider } from "../utils/data-manager";
import { UserProfileResponse } from "../utils/types";

/**
 * Custom hook to fetch Steam or Xbox profile data asynchronously
 * @param steamId - The Steam ID to fetch profile data for. If not provided, {@link xboxId} will be used instead (for Xbox profiles).
 * @param xboxId - The Xbox ID to fetch profile data for when a Steam ID is not available.
 * @param providedUserData - Optional pre-existing user data to use instead of fetching
 * @returns Object containing userData and loading state
 */
export function useProfileData(
  steamId: string | null | undefined,
  xboxId?: string | null | undefined,
  providedUserData?: UserProfileResponse | null,
) {
  // the last fetched profile and the player it's for: the previous player's stays while the next one loads
  const playerKey = steamId || xboxId ? `${steamId}|${xboxId}` : null;
  const [result, setResult] = useState<{ key: string; userData: UserProfileResponse | null } | null>(null);

  useEffect(() => {
    if (!playerKey || providedUserData) {
      return;
    }

    const abortController = new AbortController();

    (!!steamId && steamId !== "null"
      ? dataProvider.getSteamProfileData(steamId)
      : xboxId
        ? dataProvider.getXboxProfileData(xboxId)
        : Promise.resolve(null)
    )
      .then((data) => {
        if (!abortController.signal.aborted) {
          setResult({ key: playerKey, userData: data ?? { PersonaName: steamId ?? xboxId ?? "", Avatar: "" } });
        }
      })
      .catch((e) => {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch Steam profile data: ", e);
          setResult({ key: playerKey, userData: null });
        }
      });

    return () => {
      abortController.abort();
    };
  }, [playerKey, steamId, xboxId, providedUserData]);

  if (providedUserData) {
    return { userData: providedUserData, loading: false };
  }
  if (!playerKey) {
    return { userData: null, loading: false };
  }
  return { userData: result?.userData ?? null, loading: result?.key !== playerKey };
}
