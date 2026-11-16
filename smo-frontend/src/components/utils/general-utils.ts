import { afterFirst, afterLast, beforeFirst } from "../../utils/text";

/**
 * The picture of a vehicle (e.g. "4E/EU07-092:R" or "412W/412W_v4_364-9 Variant:G:53@Coal"). The locomotive pictures
 * are the game's own thumbnails, the wagon ones are rendered from the game's models.
 */
export function getThumbnailUrl(vehicle: string): string {
  const name = afterLast(vehicle, "/")
    .replace(/:[A-Z]+(:[\d.]+)?(@.+)?$/, "") // brake mode, load and cargo (":R", ":P:0", ":GP:0", ":G:35.8@WoodLogs")
    .replace(" Variant", "")
    .replace(/^ED250.+$/, "ED250-018");
  // the coaches in their 1980s livery are separate models ("11xa/80s/111A_… Variant", sometimes "… Variant 80s")
  const livery80s = vehicle.includes("/80s/") && !name.endsWith(" 80s") ? " 80s" : "";
  return `/assets/thumbnails/vehicles/${name}${livery80s}.webp`;
}

/**
 * The pictures to try for a vehicle, best first: with its cargo ("412W_v4_364-9@Coal.webp"), the vehicle itself, then
 * the generic one of its type ("412W.webp").
 */
export function getThumbnailUrls(vehicle: string): string[] {
  const url = getThumbnailUrl(vehicle);
  const cargo = afterFirst(vehicle, "@");
  const type = afterLast(vehicle, "/").split(/[_ :]/)[0];
  const urls = [url, `/assets/thumbnails/vehicles/${type}.webp`];
  if (cargo) {
    urls.unshift(url.replace(/\.webp$/, `@${cargo}.webp`));
  }
  return [...new Set(urls)];
}

// a UIC wagon number after the name ("…_33 51 4980 004-4:G:30"), its groups' spacing varies
const UIC_NUMBER = /_(\d{2})\s*(\d{2})\s*(\d{2})[\s-]*(\d{2})\s*(\d{3})[-_]?(\d)\s*(?::(\w:\d+))?/g;

/** "Name_33 51 4980 004-4:G:30…" as "33 51 49-80 004-4 (Name) [G:30]…", with the last such number in the name */
function formatUicNumber(text: string): string {
  const match = [...text.matchAll(UIC_NUMBER)].findLast((m) => m.index > 0);
  if (!match) return text;
  const [whole, a, b, c, d, serial, check, load] = match;
  const name = text.slice(0, match.index);
  return `${a} ${b} ${c}-${d} ${serial}-${check} (${name}) [${load ?? ""}]` + text.slice(match.index + whole.length);
}

export function formatVehicleName(vehicle: string, long = false): string {
  // the short name: after the folder, without the cargo
  const shortName = afterLast(vehicle, "/");
  return formatUicNumber(long || shortName === vehicle ? vehicle : beforeFirst(shortName, "@"))
    .replace("[]", "")
    .replace(/:([A-Z]):?$/, " [$1]")
    .replace(/:([A-Z]):(\d+)$/, " [$1:$2]")
    .replaceAll("_", " ")
    .trim();
}

/**
 * A short summary of a consist, e.g. "EU07 + 5x B", or null when it's empty.
 */
export function summarizeConsist(vehicles: string[] | null | undefined): string | null {
  if (!vehicles?.length) return null;

  const counts = vehicles.reduce((acc, vehicle) => {
    const [shortName] = vehicle.split("/");
    const key = (shortName ?? vehicle).trim();
    if (!key) return acc;
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  if (counts.size === 0) return null;

  return Array.from(counts.entries())
    .map(([name, count]) => (count > 1 ? `${count}x ${name}` : name))
    .join(" + ");
}

// Utility type to filter keys by value type
export type FilterFlags<Base, Condition> = {
  [K in keyof Base]: Base[K] extends Condition ? K : never;
}[keyof Base];
