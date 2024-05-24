export interface ProfileResponse {
  avatar: string;
  personaname: string;
}

const cache = new Map<string, ProfileResponse>();

export const getSteamProfileInfo = (steamId: string): Promise<ProfileResponse> =>
  cache.has(steamId)
    ? Promise.resolve(cache.get(steamId)!)
    : fetch("https://simrail-edr.emeraldnetwork.xyz/steam/" + steamId)
        .then((r) => r.json())
        .then((data) => {
          cache.set(steamId, data);
          return data as ProfileResponse;
        })
        .catch((e) => {
          console.error("Failed to fetch steam profile info", e);
          // retry after 5 seconds
          return new Promise((resolve) =>
            setTimeout(() => resolve(getSteamProfileInfo(steamId)), 5000)
          );
        });
