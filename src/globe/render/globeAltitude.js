const GLOBE_RADIUS = 100;

const GLOBE_CAMERA_NEAR = 1;

/** UX floor — well above the hull; keeps dept. France view (0.3) reachable.
 * Increased max zoom (lower value) for better inspection of small islands/rivers
 * while the (1 + minAlt) * radius formula + readClamped prevents traversing the globe.
 */
export const GLOBE_MIN_ALTITUDE = 0.22;

/** Closer floor for regional maps (departments, US states): tiny areas such as
 * the Paris inner ring need to be reachable without fighting the controls. */
export const REGIONAL_MIN_ALTITUDE = 0.08;

let currentMinAltitude = GLOBE_MIN_ALTITUDE;

/** Switch the zoom floor (world vs regional map). */
export function setGlobeMinAltitude(altitude) {
  currentMinAltitude = altitude;
}

const CAMERA_FOV_DEG = 50; // three-globe default vertical FOV
const FRAME_MARGIN = 1.12;

/**
 * Altitude (in globe radii) that fits a lat/lng box in a viewport of the given
 * aspect ratio. Close to the surface the visible half-extent is ≈ altitude ×
 * tan(fov/2) (in radii), so altitude ≈ angular half-size / tan(fov/2).
 * `visibleHeightRatio` removes the part of the screen covered by the HUD.
 */
export function frameBoundsAltitude(bounds, aspect, visibleHeightRatio = 1) {
  const tanHalf = Math.tan(((CAMERA_FOV_DEG / 2) * Math.PI) / 180);
  const midLat = ((bounds.latMin + bounds.latMax) / 2) * (Math.PI / 180);
  const halfLat = ((bounds.latMax - bounds.latMin) / 2) * (Math.PI / 180);
  const halfLng = ((bounds.lngMax - bounds.lngMin) / 2) * (Math.PI / 180) * Math.cos(midLat);
  const vertical = halfLat / (tanHalf * Math.max(0.3, visibleHeightRatio));
  const horizontal = halfLng / (tanHalf * Math.max(0.2, aspect));
  return clampGlobeAltitude(Math.max(vertical, horizontal) * FRAME_MARGIN);
}

export const GLOBE_MAX_ALTITUDE = 4;

export function clampGlobeAltitude(altitude) {
  if (!Number.isFinite(altitude)) return 2.5;
  return Math.max(currentMinAltitude, Math.min(GLOBE_MAX_ALTITUDE, altitude));
}

function applyGlobeZoomLimits(controls) {
  if (!controls) return;
  controls.minDistance = GLOBE_RADIUS * (1 + currentMinAltitude);
  controls.maxDistance = GLOBE_RADIUS * 100;
}

export function syncGlobeCameraAndZoomLimits(globeEl, controls) {
  const camera = globeEl?.camera?.();
  if (!camera) return null;
  camera.near = GLOBE_CAMERA_NEAR;
  camera.far = 1200;
  camera.clearViewOffset?.();
  camera.updateProjectionMatrix();
  applyGlobeZoomLimits(controls);
  return camera;
}

export function readClampedGlobePov(globeEl) {
  if (!globeEl) return null;
  const pov = globeEl.pointOfView();
  const altitude = clampGlobeAltitude(pov.altitude);
  if (Math.abs(altitude - pov.altitude) > 0.0005) {
    globeEl.pointOfView({ altitude }, 0);
  }
  return { ...pov, altitude };
}
