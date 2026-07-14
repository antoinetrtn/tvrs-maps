const GLOBE_RADIUS = 100;

const GLOBE_CAMERA_NEAR = 1;

/** UX floor — well above the hull; keeps dept. France view (0.3) reachable. */
export const GLOBE_MIN_ALTITUDE = 0.2;

export const GLOBE_MAX_ALTITUDE = 4;

export function clampGlobeAltitude(altitude) {
  if (!Number.isFinite(altitude)) return 2.5;
  return Math.max(
    GLOBE_MIN_ALTITUDE,
    Math.min(GLOBE_MAX_ALTITUDE, altitude),
  );
}

function applyGlobeZoomLimits(controls) {
  if (!controls) return;
  controls.minDistance = GLOBE_RADIUS * (1 + GLOBE_MIN_ALTITUDE);
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