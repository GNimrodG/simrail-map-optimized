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
  const [userData, setUserData] = useState<UserProfileResponse | null>(providedUserData || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((!steamId && !xboxId) || providedUserData) {
      setUserData(providedUserData || null);
      return;
    }

    const abortController = new AbortController();
    setLoading(true);

    (!!steamId && steamId !== "null"
      ? dataProvider.getSteamProfileData(steamId)
      : xboxId
        ? dataProvider.getXboxProfileData(xboxId)
        : Promise.resolve(null)
    )
      .then((data) => {
        if (!abortController.signal.aborted) {
          setUserData(data ?? { PersonaName: steamId ?? xboxId ?? "", Avatar: "" });
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
  }, [steamId, xboxId, providedUserData]);

  return { userData, loading };
}
