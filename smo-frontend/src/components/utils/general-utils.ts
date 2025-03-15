export function getThumbnailUrl(vehicle: string): string {
  return `/assets/thumbnails/vehicles/${vehicle
    .replace(/.+\/(.+)$/, "$1")
    .replace(" Variant", "")
    .replace(/:[A-Z]:$/, "")}.png`;
}

export function formatVehicleName(vehicle: string, long = false): string {
  return (long ? vehicle : vehicle.replace(/.+\/(.+?)(@.+)?$/, "$1"))
    .replace(
      /(.+)_(\d{2})\s*(\d{2})\s*(\d{2})[\s-]*(\d{2})\s*(\d{3})[-_]?(\d)\s*(:(\w:\d+))?/,
      "$2 $3 $4-$5 $6-$7 ($1) $9",
    )
    .replace(/:([A-Z]):$/, " ($1)")
    .trim();
}

// Utility type to filter keys by value type
export type FilterFlags<Base, Condition> = {
  [K in keyof Base]: Base[K] extends Condition ? K : never;
}[keyof Base];
