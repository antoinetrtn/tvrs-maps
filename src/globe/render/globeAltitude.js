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

/** Camera distance (scene units) of the overview ceiling — the zoom-out limit. */
export const GLOBE_MAX_DISTANCE = GLOBE_RADIUS * (1 + GLOBE_MAX_ALTITUDE);

/** Far plane: several times the max distance, so the globe is never clipped. */
const GLOBE_CAMERA_FAR = Math.max(2000, GLOBE_MAX_DISTANCE * 4);

/** Tolerance before readClampedGlobePov writes the camera back (avoids micro-snaps). */
const POV_CLAMP_TOLERANCE = 0.002;

/** Bounded OrbitControls speed curve (replaces globe.gl's unbounded per-change curve). */
const CONTROL_SPEED = {
  rotateMin: 0.18,
  rotateMax: { mobile: 0.65, desktop: 0.8 },
  zoomMin: 0.35,
  zoomMax: { mobile: 0.7, desktop: 0.85 },
};

export function clampGlobeAltitude(altitude) {
  if (!Number.isFinite(altitude)) return 2.5;
  return Math.max(currentMinAltitude, Math.min(GLOBE_MAX_ALTITUDE, altitude));
}

function applyGlobeZoomLimits(controls) {
  if (!controls) return;
  controls.minDistance = GLOBE_RADIUS * (1 + currentMinAltitude);
  controls.maxDistance = GLOBE_MAX_DISTANCE;
}

export function syncGlobeCameraAndZoomLimits(globeEl, controls) {
  const camera = globeEl?.camera?.();
  if (!camera) return null;
  camera.near = GLOBE_CAMERA_NEAR;
  camera.far = GLOBE_CAMERA_FAR;
  camera.clearViewOffset?.();
  camera.updateProjectionMatrix();
  applyGlobeZoomLimits(controls);
  return camera;
}

const smoothstep01 = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Pull the orbit camera back inside [minDistance, maxDistance] if it escaped. */
function clampControlsCameraDistance(controls) {
  const position = controls.object?.position;
  if (!position || typeof position.length !== "function") return;
  const distance = position.length();
  if (!Number.isFinite(distance) || distance <= 0) return;
  const clamped = Math.max(controls.minDistance, Math.min(controls.maxDistance, distance));
  if (Math.abs(clamped - distance) > 1e-6) position.setLength(clamped);
}

/**
 * Enforce zoom limits and a bounded, altitude-aware speed curve on the orbit
 * controls. globe.gl's own `change` listener sets rotateSpeed = alt × 0.3 and
 * zoomSpeed = √alt × 0.5 (unbounded); calling this from a later `change`
 * listener overrides it on every frame, including mid-pinch / mid-wheel.
 */
export function syncGlobeControlsForAltitude(
  controls,
  altitude,
  { isMobile = false, isRegionalMap = false } = {}
) {
  if (!controls) return null;
  applyGlobeZoomLimits(controls);
  clampControlsCameraDistance(controls);
  controls.zoomToCursor = Boolean(isRegionalMap);

  const clampedAlt = clampGlobeAltitude(altitude);
  const span = GLOBE_MAX_ALTITUDE - currentMinAltitude;
  const t = smoothstep01(span > 0 ? (clampedAlt - currentMinAltitude) / span : 0);
  const device = isMobile ? "mobile" : "desktop";
  const { rotateMin, rotateMax, zoomMin, zoomMax } = CONTROL_SPEED;
  controls.rotateSpeed = rotateMin + (rotateMax[device] - rotateMin) * t;
  controls.zoomSpeed = zoomMin + (zoomMax[device] - zoomMin) * t;
  return { rotateSpeed: controls.rotateSpeed, zoomSpeed: controls.zoomSpeed };
}

/**
 * Read the camera point of view, clamped to the altitude range. Writes the
 * camera back only when it is really out of range (beyond a small tolerance)
 * or non-finite — every write cancels globe.gl's in-flight POV tween.
 */
export function readClampedGlobePov(globeEl) {
  if (!globeEl?.pointOfView) return null;
  const pov = globeEl.pointOfView();
  if (!pov) return null;
  const finiteCoords = Number.isFinite(pov.lat) && Number.isFinite(pov.lng);
  const lat = Number.isFinite(pov.lat) ? Math.max(-90, Math.min(90, pov.lat)) : 0;
  const lng = Number.isFinite(pov.lng) ? pov.lng : 0;
  const altitude = clampGlobeAltitude(pov.altitude);
  const outOfRange =
    !Number.isFinite(pov.altitude) ||
    pov.altitude < currentMinAltitude - POV_CLAMP_TOLERANCE ||
    pov.altitude > GLOBE_MAX_ALTITUDE + POV_CLAMP_TOLERANCE;
  if (!finiteCoords || outOfRange) {
    globeEl.pointOfView({ lat, lng, altitude }, 0);
  }
  return { ...pov, lat, lng, altitude };
}

// ── Programmatic POV tweens ──
// globe.gl exposes no "stop" for its pointOfView tween; we track the ones we
// start so a user gesture can cancel them instead of fighting the animation.
let povTweenEndsAt = 0;
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** pointOfView() wrapper that records when the camera tween will end. */
export function animateGlobePov(globeEl, pov, durationMs = 0) {
  if (!globeEl?.pointOfView || !pov) return;
  const ms = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  povTweenEndsAt = ms ? nowMs() + ms : 0;
  globeEl.pointOfView(pov, ms);
}

export function isGlobePovTweenActive() {
  return povTweenEndsAt > nowMs();
}

/**
 * Stop an in-flight POV tween where the camera currently is. The setter reads
 * the current pose first, ends the tween, then writes that pose back in the
 * same tick, so nothing visibly jumps.
 */
export function cancelGlobePovTween(globeEl) {
  const wasActive = isGlobePovTweenActive();
  povTweenEndsAt = 0;
  if (!wasActive || !globeEl?.pointOfView) return false;
  const pov = globeEl.pointOfView();
  if (!pov || !Number.isFinite(pov.lat) || !Number.isFinite(pov.lng)) return false;
  globeEl.pointOfView(
    { lat: pov.lat, lng: pov.lng, altitude: clampGlobeAltitude(pov.altitude) },
    0
  );
  return true;
}
