const GLOBE_RADIUS = 100;

const GLOBE_CAMERA_NEAR = 1;

const GLOBE_MIN_CAMERA_DISTANCE =
  GLOBE_RADIUS + Math.max(0.001, GLOBE_CAMERA_NEAR * 1.1);

export const GLOBE_MIN_ALTITUDE =
  GLOBE_MIN_CAMERA_DISTANCE / GLOBE_RADIUS - 1;

export const GLOBE_MAX_ALTITUDE = 4;

export function clampGlobeAltitude(altitude) {
  if (!Number.isFinite(altitude)) return 2.5;
  return Math.max(
    GLOBE_MIN_ALTITUDE,
    Math.min(GLOBE_MAX_ALTITUDE, altitude),
  );
}

function applyGlobeZoomLimits(controls, cameraNear = GLOBE_CAMERA_NEAR) {
  if (!controls) return;
  controls.minDistance =
    GLOBE_RADIUS + Math.max(0.001, cameraNear * 1.1);
  controls.maxDistance = GLOBE_RADIUS * 100;
}

export function syncGlobeCameraAndZoomLimits(globeEl, controls) {
  const camera = globeEl?.camera?.();
  if (!camera) return null;
  camera.near = GLOBE_CAMERA_NEAR;
  camera.far = 1200;
  camera.clearViewOffset?.();
  camera.updateProjectionMatrix();
  applyGlobeZoomLimits(controls, camera.near);
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