import { DivIcon, Icon } from "leaflet";

type MarkerIcon = Icon | DivIcon;

// rotated copies of each icon by whole degrees, so the thousands of signals share a few hundred icons
const rotatedIcons = new WeakMap<MarkerIcon, Map<number, DivIcon>>();

/**
 * The icon turned to the signal's real orientation: its top points in the direction of travel the signal applies to
 * (Heading, degrees clockwise from north). Leaflet positions the marker element with a transform, so the picture is
 * rotated in an inner element. Without a heading (signals learned from trains) or when disabled, the icon as it is.
 */
export function getOrientedSignalIcon(
  icon: MarkerIcon,
  heading: number | null | undefined,
  enabled: boolean,
): MarkerIcon {
  if (!enabled || heading == null) {
    return icon;
  }

  const degrees = Math.round(heading) % 360;
  if (degrees === 0) {
    return icon;
  }

  let byDegrees = rotatedIcons.get(icon);
  if (!byDegrees) {
    byDegrees = new Map();
    rotatedIcons.set(icon, byDegrees);
  }

  let rotated = byDegrees.get(degrees);
  if (!rotated) {
    const options = icon.options as DivIcon["options"];
    const picture = icon instanceof DivIcon ? (options.html as string) : `<img src="${options.iconUrl}" alt="">`;
    // around the point on the map: the signal head when there are boards under it, else the middle
    const anchor = options.iconAnchor as [number, number] | undefined;
    const origin = anchor ? `${anchor[0]}px ${anchor[1]}px` : "50% 50%";
    rotated = new DivIcon({
      ...options,
      html: `<div class="signal-orientation" style="transform: rotate(${degrees}deg); transform-origin: ${origin}">${picture}</div>`,
    });
    byDegrees.set(degrees, rotated);
  }

  return rotated;
}
