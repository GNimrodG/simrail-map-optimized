export function getThumbnailUrl(vehicle: string): string {
  return `/assets/thumbnails/vehicles/${vehicle.replace(/.+\/(.+)$/, "$1").replace(" Variant", "")}.png`;
}

// Utility type to filter keys by value type
export type FilterFlags<Base, Condition> = {
  [K in keyof Base]: Base[K] extends Condition ? K : never;
}[keyof Base];
