import type { Map as LeafletMap } from "leaflet";

/** Leaflet's own state of a running zoom animation (not in its typings). */
type ZoomAnimationState = { _animatingZoom?: boolean; _animateToZoom?: number };

/**
 * Whether the map is in the middle of an animated zoom. Moving the map without animation then (`panTo`/`setView`
 * with `animate: false`) stops the animation at the old zoom level, so code that keeps re-centering the map has to
 * leave it alone (or use {@link getTargetZoom}) until it ends.
 */
export function isZooming(map: LeafletMap): map is LeafletMap & ZoomAnimationState {
  return !!(map as LeafletMap & ZoomAnimationState)._animatingZoom;
}

/**
 * The zoom level the map is at, or is zooming to when a zoom animation is running (`getZoom()` still gives the old
 * level until the animation ends).
 */
export function getTargetZoom(map: LeafletMap): number {
  const state = map as LeafletMap & ZoomAnimationState;
  return state._animatingZoom && state._animateToZoom !== undefined ? state._animateToZoom : map.getZoom();
}
