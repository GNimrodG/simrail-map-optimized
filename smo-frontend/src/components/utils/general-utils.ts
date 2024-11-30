export function getThumbnailUrl(vehicle: string): string {
  return `/thumbnails/vehicles/${vehicle.replace(/.+\/(.+)$/, "$1").replace(" Variant", "")}.png`;
}
