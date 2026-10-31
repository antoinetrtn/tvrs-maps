/**
 * Whether three-render-objects must keep its permanent hover raycast.
 *
 * With `enablePointerInteraction` on, the renderer raycasts the whole scene
 * (~1 000 meshes, no BVH) every 50 ms, even when the pointer is still, which
 * was ~60 % of the active CPU time in game. The only consumers of that hover
 * result are the `onObjectClick` / `onPathClick` handlers of the Mountains &
 * Rivers layers (they rely on the hovered object at click time). Country /
 * state / department selection never needs it: it is resolved on `pointerup`
 * by `useGlobeInteractions` (`toGlobeCoords` + point-in-polygon).
 * Both click handlers ignore the home screen.
 *
 * @param {{ isHomeScreen?: boolean, isRiversMountainsMode?: boolean, profileEnabled?: boolean }} opts
 * @returns {boolean}
 */
export function isGlobeHoverRaycastNeeded({
  isHomeScreen = false,
  isRiversMountainsMode = false,
  profileEnabled = true,
} = {}) {
  return profileEnabled !== false && !isHomeScreen && Boolean(isRiversMountainsMode);
}
