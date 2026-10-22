// The side views of the vehicles for the consist strip (vagonWEB style): true orthographic side renders of the game's
// models (.claude/skills/render-vehicle-thumbnails, render_prefabs.py --side), all at the same scale with the rails at
// the same height, so a consist is drawn to length. A multiple unit's view has all its cars.
// /assets/sideviews/index.json has every picture's size (and the generic picture of each type), so the strip is laid
// out before the pictures load.

export const SIDE_VIEW_PX_PER_M = 20; // the scale they're rendered at
const BASE_URL = "/assets/sideviews/";

export interface SideView {
  url: string;
  /** the vehicle's length over the buffers, m */
  length: number;
  /** the picture's height in m (the same for every picture: from the rails to the raised pantographs) */
  height: number;
}

type Manifest = Record<string, { file: string; w: number; h: number }>;

let manifest: Promise<Manifest> | null = null;

export function loadSideViews(): Promise<Manifest> {
  manifest ??= fetch(`${BASE_URL}index.json`)
    .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : {}))
    .catch(() => ({}));
  return manifest;
}

/**
 * The names to look a vehicle up by, best first (e.g. "412W/412W_v4_364-9 Variant:G:53@Coal"): with its cargo
 * ("412W_v4_364-9@Coal"), the vehicle itself ("412W_v4_364-9"), its type ("412W", "EU07" for "EU07-092"). The same
 * names as the thumbnails (getThumbnailUrl), but every Pendolino livery has its own.
 */
export function sideViewNames(vehicle: string): string[] {
  const name = vehicle
    .replace(/.+\/(.+)$/, "$1")
    .replace(/:[A-Z]+(:[\d.]+)?(@.+)?$/, "") // brake mode, load and cargo (":R", ":P:0", ":G:35.8@WoodLogs")
    .replace(" Variant", "");
  const full = vehicle.includes("/80s/") && !name.endsWith(" 80s") ? `${name} 80s` : name;
  const cargo = /@(.+)$/.exec(vehicle)?.[1];
  const type = name.split(/[_ :]/)[0];
  return [...new Set([...(cargo ? [`${full}@${cargo}`] : []), full, type, type.split("-")[0]])];
}

export function findSideView(manifest: Manifest, vehicle: string): SideView | null {
  for (const name of sideViewNames(vehicle)) {
    const entry = manifest[name];
    if (entry) {
      return {
        url: encodeURI(BASE_URL + entry.file), // "@" as it is (a cargo's picture): "%40" isn't decoded everywhere
        length: entry.w / SIDE_VIEW_PX_PER_M,
        height: entry.h / SIDE_VIEW_PX_PER_M,
      };
    }
  }
  return null;
}
