/**
 * The picture of a vehicle (e.g. "4E/EU07-092:R" or "412W/412W_v4_364-9 Variant:G:53@Coal"). The locomotive pictures
 * are the game's own thumbnails, the wagon ones are rendered from the game's models.
 */
export function getThumbnailUrl(vehicle: string): string {
  const name = vehicle
    .replace(/.+\/(.+)$/, "$1")
    .replace(/:[A-Z]+(:[\d.]+)?(@.+)?$/, "") // brake mode, load and cargo (":R", ":P:0", ":GP:0", ":G:35.8@WoodLogs")
    .replace(" Variant", "")
    .replace(/^ED250.+$/, "ED250-018");
  // the coaches in their 1980s livery are separate models ("11xa/80s/111A_… Variant", sometimes "… Variant 80s")
  const livery80s = vehicle.includes("/80s/") && !name.endsWith(" 80s") ? " 80s" : "";
  return `/assets/thumbnails/vehicles/${name}${livery80s}.png`;
}

/**
 * The pictures to try for a vehicle, best first: with its cargo ("412W_v4_364-9@Coal.png"), the vehicle itself, then
 * the generic one of its type ("412W.png").
 */
export function getThumbnailUrls(vehicle: string): string[] {
  const url = getThumbnailUrl(vehicle);
  const cargo = /@(.+)$/.exec(vehicle)?.[1];
  const type = vehicle.replace(/.+\/(.+)$/, "$1").split(/[_ :]/)[0];
  const urls = [url, `/assets/thumbnails/vehicles/${type}.png`];
  if (cargo) {
    urls.unshift(url.replace(/\.png$/, `@${cargo}.png`));
  }
  return [...new Set(urls)];
}

export function formatVehicleName(vehicle: string, long = false): string {
  return (long ? vehicle : vehicle.replace(/.+\/(.+?)(@.+)?$/, "$1"))
    .replace(
      /(.+)_(\d{2})\s*(\d{2})\s*(\d{2})[\s-]*(\d{2})\s*(\d{3})[-_]?(\d)\s*(:(\w:\d+))?/,
      "$2 $3 $4-$5 $6-$7 ($1) [$9]",
    )
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
