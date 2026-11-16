/** What the user typed as their Steam ID: a 64-bit ID, or a custom profile URL name that still has to be resolved */
export type SteamIdInput = { steamId: string } | { vanityName: string };

// 64-bit Steam IDs of individual accounts: 7656119 followed by 10 digits
const STEAM_ID_PATTERN = /^7656119\d{10}$/;
const PROFILES_URL_PATTERN = /steamcommunity\.com\/profiles\/(\d{17})(?:[/?#]|$)/i;
const VANITY_URL_PATTERN = /steamcommunity\.com\/id\/([\w-]{2,32})(?:[/?#]|$)/i;

export function isSteamId(value: string): boolean {
  return STEAM_ID_PATTERN.test(value);
}

/**
 * Reads a Steam profile link (steamcommunity.com/profiles/<id> or steamcommunity.com/id/<name>) or a raw 64-bit
 * Steam ID.
 * @return The ID or the custom URL name, or null when the text is neither.
 */
export function parseSteamIdInput(input: string): SteamIdInput | null {
  const text = input.trim();

  if (isSteamId(text)) return { steamId: text };

  const profile = PROFILES_URL_PATTERN.exec(text);
  if (profile && isSteamId(profile[1])) return { steamId: profile[1] };

  const vanity = VANITY_URL_PATTERN.exec(text);
  if (vanity) return { vanityName: vanity[1] };

  return null;
}
