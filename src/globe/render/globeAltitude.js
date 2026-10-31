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

export function getGlobeMinAltitude() {
  return currentMinAltitude;
}

export const CAMERA_FOV_DEG = 50; // three-globe default vertical FOV
export const MAP_FLATTEN_START_ALTITUDE = 1.25;
export const MAP_FLATTEN_MIN_FOV_DEG = 26;
export const SURFACE_TRACK_GAIN = 1.05;
const FRAME_MARGIN = 1.12;

const smoothstep01 = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * Progressive "flat map / unwrap" factor in [0, 1] as the player zooms in close
 * (Google Maps style transition from 3D globe at altitude >= 1.25 to planar-feeling
 * map projection down to minAltitude).
 */
export function computeMapFlattenFactor(altitude) {
  if (!Number.isFinite(altitude) || altitude >= MAP_FLATTEN_START_ALTITUDE) return 0;
  const clamped = Math.max(currentMinAltitude, altitude);
  const span = Math.max(0.05, MAP_FLATTEN_START_ALTITUDE - currentMinAltitude);
  return smoothstep01((MAP_FLATTEN_START_ALTITUDE - clamped) / span);
}

/**
 * Effective vertical camera FOV in degrees. Progressively narrows from 50° down to
 * 26° when zooming in close so the visible country patch loses spherical perspective
 * barrel distortion and reads like a flat 2D Mercator map plane while keeping
 * three-globe raycasting and continuous -180° <-> +180° wrap-around intact.
 */
export function computeEffectiveCameraFov(altitude) {
  const flattenFactor = computeMapFlattenFactor(altitude);
  return CAMERA_FOV_DEG - (CAMERA_FOV_DEG - MAP_FLATTEN_MIN_FOV_DEG) * flattenFactor;
}

export function syncCameraMapProjection(globeEl, altitude) {
  const camera = globeEl?.camera?.();
  if (!camera) return null;
  const flattenFactor = computeMapFlattenFactor(altitude);
  const targetFov = computeEffectiveCameraFov(altitude);
  if (typeof camera.fov === "number" && Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix?.();
  }
  if (camera.up && typeof camera.up.set === "function") {
    camera.up.set(0, 1, 0);
  }
  return { flattenFactor, fov: targetFov };
}

/**
 * Exact 1:1 surface-tracking OrbitControls rotateSpeed.
 *
 * Because the camera orbits the center of the Earth (radius R = 100) from distance
 * D = R * (1 + altitude), the distance from the camera to the surface under the
 * cursor is h = R * altitude, and the visible surface height on screen is:
 *   H_surface = 2 * R * altitude * tan(fov / 2)
 * A vertical drag of fraction ds = dy / clientHeight should move the surface by
 * arc-length dL = R * dPhi = ds * H_surface, which requires:
 *   dPhi = 2 * altitude * tan(fov / 2) * ds
 * Since Three.js OrbitControls rotates by dPhi = 2 * PI * rotateSpeed * ds, exact
 * 1:1 finger-to-surface tracking requires:
 *   rotateSpeed = (altitude * tan(fov / 2)) / PI
 */
export function computeSurfaceTrackingRotateSpeed(
  altitude,
  { fovDeg = computeEffectiveCameraFov(altitude), isMobile = false } = {}
) {
  const clampedAlt = clampGlobeAltitude(altitude);
  const safeFov = Number.isFinite(fovDeg) && fovDeg > 1 ? fovDeg : CAMERA_FOV_DEG;
  const halfFovTan = Math.tan((safeFov * Math.PI) / 360);
  const exact1to1Speed = (clampedAlt * halfFovTan) / Math.PI;
  const maxRotate = isMobile ? 0.65 : 0.8;
  return Math.max(0.004, Math.min(maxRotate, exact1to1Speed * SURFACE_TRACK_GAIN));
}

/**
 * Proportional zoom speed scaled smoothly with altitude so pinch-zoom and trackpad
 * wheel zoom near the surface never jump violently across altitudes.
 */
export function computeAltitudeZoomSpeed(altitude, { isMobile = false } = {}) {
  const clampedAlt = clampGlobeAltitude(altitude);
  const maxZoom = isMobile ? 0.68 : 0.85;
  const minZoom = isMobile ? 0.055 : 0.07;
  const proportional = clampedAlt * (isMobile ? 0.32 : 0.38);
  return Math.max(minZoom, Math.min(maxZoom, proportional));
}

/**
 * Altitude-aware damping factor: tighter damping when zoomed in close so the map
 * stops where the user's finger stops instead of coasting past small countries.
 */
export function computeAltitudeDampingFactor(altitude, { isMobile = false } = {}) {
  const flattenFactor = computeMapFlattenFactor(altitude);
  const farDamping = isMobile ? 0.12 : 0.08;
  const closeDamping = isMobile ? 0.28 : 0.22;
  return farDamping + (closeDamping - farDamping) * flattenFactor;
}

const LOCKED_SPEED_SYMBOL = Symbol.for("tvrs.lockedControlsSpeed");

/**
 * Installs property interceptors on the OrbitControls instance so globe.gl's own
 * internal `controls.addEventListener("change", () => { controls.rotateSpeed = pov.altitude * 0.3; ... })`
 * cannot overwrite our 1:1 surface-tracking rotateSpeed and proportional zoomSpeed.
 */
export function installLockedControlSpeeds(controls, initialRotate = 0.3, initialZoom = 0.3) {
  if (!controls || typeof controls !== "object") return;
  if (controls[LOCKED_SPEED_SYMBOL]) return;

  let lockedRotate = Number.isFinite(controls.rotateSpeed) ? controls.rotateSpeed : initialRotate;
  let lockedZoom = Number.isFinite(controls.zoomSpeed) ? controls.zoomSpeed : initialZoom;

  try {
    Object.defineProperty(controls, LOCKED_SPEED_SYMBOL, {
      value: {
        setRotate(v) {
          if (Number.isFinite(v) && v > 0) lockedRotate = v;
        },
        setZoom(v) {
          if (Number.isFinite(v) && v > 0) lockedZoom = v;
        },
      },
      configurable: true,
      enumerable: false,
    });

    Object.defineProperty(controls, "rotateSpeed", {
      get() {
        return lockedRotate;
      },
      set(_ignoredExternalAssignment) {
        // Ignore direct assignments from globe.gl's internal change listener (pov.altitude * 0.3)
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(controls, "zoomSpeed", {
      get() {
        return lockedZoom;
      },
      set(_ignoredExternalAssignment) {
        // Ignore direct assignments from globe.gl's internal change listener (Math.sqrt(pov.altitude) * 0.5)
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Fallback if object is non-configurable in a mock
  }
}

function setControlSpeedsInternal(controls, rotateSpeed, zoomSpeed) {
  installLockedControlSpeeds(controls, rotateSpeed, zoomSpeed);
  const lock = controls?.[LOCKED_SPEED_SYMBOL];
  if (lock) {
    lock.setRotate(rotateSpeed);
    lock.setZoom(zoomSpeed);
  } else if (controls) {
    controls.rotateSpeed = rotateSpeed;
    controls.zoomSpeed = zoomSpeed;
  }
}

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

export function clampGlobeAltitude(altitude) {
  if (!Number.isFinite(altitude)) return 2.5;
  return Math.max(currentMinAltitude, Math.min(GLOBE_MAX_ALTITUDE, altitude));
}

function applyGlobeZoomLimits(controls) {
  if (!controls) return;
  controls.minDistance = GLOBE_RADIUS * (1 + currentMinAltitude);
  controls.maxDistance = GLOBE_MAX_DISTANCE;
  controls.screenSpacePanning = true;
}

export function syncGlobeCameraAndZoomLimits(globeEl, controls) {
  const camera = globeEl?.camera?.();
  if (!camera) return null;
  camera.near = GLOBE_CAMERA_NEAR;
  camera.far = GLOBE_CAMERA_FAR;
  if (camera.up && typeof camera.up.set === "function") {
    camera.up.set(0, 1, 0);
  }
  camera.clearViewOffset?.();
  camera.updateProjectionMatrix();
  applyGlobeZoomLimits(controls);
  return camera;
}

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
 * Enforce zoom limits and an exact 1:1 surface-tracking speed curve on the orbit
 * controls. Also locks `rotateSpeed` and `zoomSpeed` against globe.gl's internal
 * listener so close-zoom panning tracks the user's finger 1:1 instead of flinging
 * the globe around the Earth's center.
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
  const flattenFactor = computeMapFlattenFactor(clampedAlt);
  const fovDeg = computeEffectiveCameraFov(clampedAlt);
  const polarMargin = 0.005 + 0.075 * flattenFactor;
  controls.minPolarAngle = polarMargin;
  controls.maxPolarAngle = Math.PI - polarMargin;

  const rotateSpeed = computeSurfaceTrackingRotateSpeed(clampedAlt, { fovDeg, isMobile });
  const zoomSpeed = computeAltitudeZoomSpeed(clampedAlt, { isMobile });
  setControlSpeedsInternal(controls, rotateSpeed, zoomSpeed);
  controls.dampingFactor = computeAltitudeDampingFactor(clampedAlt, { isMobile });

  return {
    rotateSpeed: controls.rotateSpeed,
    zoomSpeed: controls.zoomSpeed,
    dampingFactor: controls.dampingFactor,
    fovDeg,
  };
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
  syncCameraMapProjection(globeEl, pov.altitude);
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
  const clampedAlt = clampGlobeAltitude(pov.altitude);
  globeEl.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: clampedAlt }, 0);
  syncCameraMapProjection(globeEl, clampedAlt);
  return true;
}
