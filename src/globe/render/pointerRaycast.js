/**
 * Whether three-render-objects must keep its permanent hover raycast.
 *
 * With the 3D mountain and river path layers removed, no modes rely on
 * permanent hover raycast. Country / state / department / feature selection
 * is resolved on `pointerup` by `useGlobeInteractions` (`toGlobeCoords`).
 *
 * @param {{ isHomeScreen?: boolean, isRiversMountainsMode?: boolean, profileEnabled?: boolean }} [_opts]
 * @returns {boolean}
 */
export function isGlobeHoverRaycastNeeded(_opts = {}) {
  return false;
}
