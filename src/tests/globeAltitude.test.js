import { describe, expect, it, vi } from "vitest";

import { isDoubleTapZoomStart } from "../globe/hooks/useGlobeInteractions";
import {
  animateGlobePov,
  CAMERA_FOV_DEG,
  cancelGlobePovTween,
  clampGlobeAltitude,
  computeAltitudeDampingFactor,
  computeAltitudeZoomSpeed,
  computeEffectiveCameraFov,
  computeMapFlattenFactor,
  computeSurfaceTrackingRotateSpeed,
  GLOBE_MAX_ALTITUDE,
  GLOBE_MAX_DISTANCE,
  GLOBE_MIN_ALTITUDE,
  installLockedControlSpeeds,
  isGlobePovTweenActive,
  MAP_FLATTEN_MIN_FOV_DEG,
  MAP_FLATTEN_START_ALTITUDE,
  readClampedGlobePov,
  REGIONAL_MIN_ALTITUDE,
  setGlobeMinAltitude,
  SURFACE_TRACK_GAIN,
  syncCameraMapProjection,
  syncGlobeCameraAndZoomLimits,
  syncGlobeControlsForAltitude,
} from "../globe/render/globeAltitude";
import {
  computeZoomDetentIndex,
  createZoomHapticTracker,
  primeHapticsOnUserGesture,
  triggerSubtleHapticTick,
  ZOOM_HAPTIC_BOUNDARY_MS,
  ZOOM_HAPTIC_DETENTS,
  ZOOM_HAPTIC_TICK_MS,
} from "../utils/haptics";

describe("globeAltitude", () => {
  describe("clampGlobeAltitude", () => {
    it("clamps below the zoom floor", () => {
      setGlobeMinAltitude(GLOBE_MIN_ALTITUDE);
      expect(clampGlobeAltitude(0)).toBe(GLOBE_MIN_ALTITUDE);
      expect(clampGlobeAltitude(0.1)).toBe(GLOBE_MIN_ALTITUDE);
      expect(clampGlobeAltitude(-0.5)).toBe(GLOBE_MIN_ALTITUDE);
    });

    it("allows increased max zoom (lower min alt) for small features without traversing", () => {
      expect(GLOBE_MIN_ALTITUDE).toBeLessThan(0.26);
      expect(GLOBE_MIN_ALTITUDE).toBeGreaterThanOrEqual(0.18);
    });

    it("clamps above the overview ceiling", () => {
      expect(clampGlobeAltitude(10)).toBe(GLOBE_MAX_ALTITUDE);
    });

    it("preserves valid in-range altitude", () => {
      expect(clampGlobeAltitude(0.68)).toBe(0.68);
      expect(clampGlobeAltitude(1.5)).toBe(1.5);
      expect(clampGlobeAltitude(3.8)).toBe(3.8);
    });

    it("falls back to default 2.5 when given non-finite values", () => {
      expect(clampGlobeAltitude(NaN)).toBe(2.5);
      expect(clampGlobeAltitude(Infinity)).toBe(2.5);
      expect(clampGlobeAltitude(undefined)).toBe(2.5);
      expect(clampGlobeAltitude(null)).toBe(2.5);
    });
  });

  describe("syncGlobeCameraAndZoomLimits", () => {
    it("sets maxDistance === 500, camera.far >= 2000, and camera.near", () => {
      const mockCamera = {
        near: 0,
        far: 0,
        clearViewOffset: vi.fn(),
        updateProjectionMatrix: vi.fn(),
      };
      const mockControls = {
        minDistance: 0,
        maxDistance: 0,
      };
      const mockGlobeEl = {
        camera: () => mockCamera,
      };

      const result = syncGlobeCameraAndZoomLimits(mockGlobeEl, mockControls);

      expect(result).toBe(mockCamera);
      expect(mockControls.maxDistance).toBe(500);
      expect(mockControls.maxDistance).toBe(GLOBE_MAX_DISTANCE);
      expect(mockCamera.far).toBeGreaterThanOrEqual(2000);
      expect(mockCamera.near).toBe(1);
      expect(mockCamera.clearViewOffset).toHaveBeenCalled();
      expect(mockCamera.updateProjectionMatrix).toHaveBeenCalled();
    });

    it("handles null / missing globeEl or camera safely", () => {
      expect(syncGlobeCameraAndZoomLimits(null, {})).toBeNull();
      expect(syncGlobeCameraAndZoomLimits({}, {})).toBeNull();
      expect(syncGlobeCameraAndZoomLimits({ camera: () => null }, {})).toBeNull();
    });
  });

  describe("syncGlobeControlsForAltitude & 1:1 surface-tracking physics", () => {
    const createMockControls = (initialDistance = 250) => {
      let currentDistance = initialDistance;
      return {
        rotateSpeed: 1,
        zoomSpeed: 1,
        dampingFactor: 0.1,
        zoomToCursor: false,
        minDistance: 122,
        maxDistance: 500,
        object: {
          position: {
            length: () => currentDistance,
            setLength: (newDist) => {
              currentDistance = newDist;
            },
          },
        },
      };
    };

    it("enforces zoomToCursor based on isRegionalMap", () => {
      const controls = createMockControls();

      syncGlobeControlsForAltitude(controls, 1.0, { isRegionalMap: false });
      expect(controls.zoomToCursor).toBe(false);

      syncGlobeControlsForAltitude(controls, 1.0, { isRegionalMap: true });
      expect(controls.zoomToCursor).toBe(true);
    });

    it("computes exact 1:1 surface-tracking rotateSpeed at close zoom so a 100px drag moves ~100px on screen", () => {
      setGlobeMinAltitude(GLOBE_MIN_ALTITUDE);
      const clientHeight = 800;
      const dragPx = 100;
      const ds = dragPx / clientHeight;

      // World min altitude (0.22)
      const fovAt022 = computeEffectiveCameraFov(GLOBE_MIN_ALTITUDE);
      const speed022 = computeSurfaceTrackingRotateSpeed(GLOBE_MIN_ALTITUDE, {
        fovDeg: fovAt022,
        isMobile: true,
      });
      // OrbitControls rotates by dPhi = 2 * PI * rotateSpeed * ds
      const dPhi022 = 2 * Math.PI * speed022 * ds;
      // Visible surface height in globe radii is 2 * altitude * tan(fov/2)
      const visibleRadii022 = 2 * GLOBE_MIN_ALTITUDE * Math.tan((fovAt022 * Math.PI) / 360);
      const screenDisplacementPx022 = (dPhi022 / visibleRadii022) * clientHeight;
      expect(screenDisplacementPx022).toBeCloseTo(dragPx * SURFACE_TRACK_GAIN, 1);
      expect(speed022).toBeLessThan(0.025);

      // Regional min altitude (0.08)
      setGlobeMinAltitude(REGIONAL_MIN_ALTITUDE);
      const fovAt008 = computeEffectiveCameraFov(REGIONAL_MIN_ALTITUDE);
      const speed008 = computeSurfaceTrackingRotateSpeed(REGIONAL_MIN_ALTITUDE, {
        fovDeg: fovAt008,
        isMobile: true,
      });
      const dPhi008 = 2 * Math.PI * speed008 * ds;
      const visibleRadii008 = 2 * REGIONAL_MIN_ALTITUDE * Math.tan((fovAt008 * Math.PI) / 360);
      const screenDisplacementPx008 = (dPhi008 / visibleRadii008) * clientHeight;
      expect(screenDisplacementPx008).toBeCloseTo(dragPx * SURFACE_TRACK_GAIN, 1);
      expect(speed008).toBeLessThan(0.01);
      setGlobeMinAltitude(GLOBE_MIN_ALTITUDE);
    });

    it("locks rotateSpeed and zoomSpeed against external clobbering by globe.gl's internal change listener", () => {
      const controls = createMockControls();
      const synced = syncGlobeControlsForAltitude(controls, GLOBE_MIN_ALTITUDE, { isMobile: true });
      expect(controls.rotateSpeed).toBeCloseTo(synced.rotateSpeed, 5);
      expect(controls.zoomSpeed).toBeCloseTo(synced.zoomSpeed, 5);

      // Simulate globe.gl's internal listener trying to overwrite rotateSpeed = pov.altitude * 0.3
      controls.rotateSpeed = GLOBE_MIN_ALTITUDE * 0.3;
      controls.zoomSpeed = Math.sqrt(GLOBE_MIN_ALTITUDE) * 0.5;

      // Locked descriptors preserve our 1:1 surface-tracking speed
      expect(controls.rotateSpeed).toBeCloseTo(synced.rotateSpeed, 5);
      expect(controls.zoomSpeed).toBeCloseTo(synced.zoomSpeed, 5);

      // Max altitude reaches bounded ceiling
      const maxMobile = syncGlobeControlsForAltitude(controls, GLOBE_MAX_ALTITUDE, {
        isMobile: true,
      });
      expect(maxMobile.rotateSpeed).toBeCloseTo(0.62, 1);
      expect(maxMobile.zoomSpeed).toBeCloseTo(0.68, 2);
      expect(computeAltitudeDampingFactor(GLOBE_MIN_ALTITUDE, { isMobile: true })).toBeGreaterThan(
        computeAltitudeDampingFactor(GLOBE_MAX_ALTITUDE, { isMobile: true })
      );
      expect(computeAltitudeZoomSpeed(GLOBE_MIN_ALTITUDE, { isMobile: true })).toBeLessThan(0.1);
      installLockedControlSpeeds(null);
    });

    it("clamps escaped camera distance back inside [minDistance, maxDistance]", () => {
      const escapedHighControls = createMockControls(750);
      syncGlobeControlsForAltitude(escapedHighControls, 2.5);
      expect(escapedHighControls.object.position.length()).toBe(500);

      const escapedLowControls = createMockControls(50);
      syncGlobeControlsForAltitude(escapedLowControls, 2.5);
      expect(escapedLowControls.object.position.length()).toBe(escapedLowControls.minDistance);
    });

    it("returns null if controls is missing", () => {
      expect(syncGlobeControlsForAltitude(null, 1.0)).toBeNull();
    });
  });

  describe("readClampedGlobePov", () => {
    it("returns null when globeEl or pointOfView is missing", () => {
      expect(readClampedGlobePov(null)).toBeNull();
      expect(readClampedGlobePov({})).toBeNull();
    });

    it("reads and clamps POV if altitude is out of range, writing back via pointOfView(..., 0)", () => {
      const povSpy = vi.fn().mockReturnValue({ lat: 48.8, lng: 2.3, altitude: 8.5 });
      const globeEl = { pointOfView: povSpy };

      const result = readClampedGlobePov(globeEl);
      expect(result.altitude).toBe(GLOBE_MAX_ALTITUDE);
      expect(result.lat).toBe(48.8);
      expect(result.lng).toBe(2.3);

      expect(povSpy).toHaveBeenCalledWith({ lat: 48.8, lng: 2.3, altitude: GLOBE_MAX_ALTITUDE }, 0);
    });

    it("does not call pointOfView writeback when POV is already within tolerance", () => {
      const povSpy = vi.fn().mockReturnValue({ lat: 20.0, lng: 10.0, altitude: 1.5 });
      const globeEl = { pointOfView: povSpy };

      const result = readClampedGlobePov(globeEl);
      expect(result.altitude).toBe(1.5);
      expect(povSpy).toHaveBeenCalledTimes(1); // only the read call
    });

    it("clamps latitude to [-90, 90] and writes back when non-finite coordinates occur", () => {
      const povSpyFinite = vi.fn().mockReturnValue({ lat: 105.0, lng: -45.0, altitude: 1.5 });
      const globeElFinite = { pointOfView: povSpyFinite };

      const resultFinite = readClampedGlobePov(globeElFinite);
      expect(resultFinite.lat).toBe(90);

      const povSpyNonFinite = vi.fn().mockReturnValue({ lat: NaN, lng: 10.0, altitude: 1.5 });
      const globeElNonFinite = { pointOfView: povSpyNonFinite };

      const resultNonFinite = readClampedGlobePov(globeElNonFinite);
      expect(resultNonFinite.lat).toBe(0);
      expect(povSpyNonFinite).toHaveBeenCalledWith({ lat: 0, lng: 10.0, altitude: 1.5 }, 0);
    });
  });

  describe("animateGlobePov and cancelGlobePovTween", () => {
    it("records tween activity and allows cancellation", () => {
      const povSpy = vi.fn().mockReturnValue({ lat: 12.0, lng: 45.0, altitude: 2.0 });
      const globeEl = { pointOfView: povSpy };

      expect(isGlobePovTweenActive()).toBe(false);

      // Start tween with 1000ms duration
      animateGlobePov(globeEl, { lat: 30, lng: 50, altitude: 1.0 }, 1000);
      expect(isGlobePovTweenActive()).toBe(true);
      expect(povSpy).toHaveBeenCalledWith({ lat: 30, lng: 50, altitude: 1.0 }, 1000);

      // Cancel tween
      const canceled = cancelGlobePovTween(globeEl);
      expect(canceled).toBe(true);
      expect(isGlobePovTweenActive()).toBe(false);
      // Writes current pose back at 0 duration to freeze position cleanly
      expect(povSpy).toHaveBeenCalledWith({ lat: 12.0, lng: 45.0, altitude: 2.0 }, 0);

      // Subsequent cancel returns false
      expect(cancelGlobePovTween(globeEl)).toBe(false);
    });

    it("handles zero duration or invalid globeEl safely", () => {
      const globeEl = { pointOfView: vi.fn() };
      animateGlobePov(globeEl, { lat: 0, lng: 0, altitude: 1 }, 0);
      expect(isGlobePovTweenActive()).toBe(false);

      expect(cancelGlobePovTween(null)).toBe(false);
    });
  });

  describe("progressive map flattening (Google Maps feel at close zoom)", () => {
    it("keeps flattenFactor at 0 when zoomed out and ramps to 1 at minAltitude", () => {
      expect(computeMapFlattenFactor(2.5)).toBe(0);
      expect(computeMapFlattenFactor(MAP_FLATTEN_START_ALTITUDE)).toBe(0);
      const mid = computeMapFlattenFactor(0.6);
      expect(mid).toBeGreaterThan(0.2);
      expect(mid).toBeLessThan(0.9);
      expect(computeMapFlattenFactor(GLOBE_MIN_ALTITUDE)).toBeCloseTo(1, 5);
    });

    it("progressively narrows camera FOV from 50 deg to 26 deg as player zooms in", () => {
      expect(computeEffectiveCameraFov(2.5)).toBe(CAMERA_FOV_DEG);
      expect(computeEffectiveCameraFov(GLOBE_MIN_ALTITUDE)).toBeCloseTo(MAP_FLATTEN_MIN_FOV_DEG, 4);
      const mockCam = {
        fov: CAMERA_FOV_DEG,
        up: { set: vi.fn() },
        updateProjectionMatrix: vi.fn(),
      };
      const res = syncCameraMapProjection({ camera: () => mockCam }, GLOBE_MIN_ALTITUDE);
      expect(res.flattenFactor).toBeCloseTo(1, 4);
      expect(mockCam.fov).toBeCloseTo(MAP_FLATTEN_MIN_FOV_DEG, 4);
      expect(mockCam.up.set).toHaveBeenCalledWith(0, 1, 0);
      expect(mockCam.updateProjectionMatrix).toHaveBeenCalled();
    });
  });

  describe("Figma-style subtle zoom-detent haptics", () => {
    it("maps altitude logarithmically to discrete detent indices", () => {
      expect(computeZoomDetentIndex(GLOBE_MIN_ALTITUDE)).toBe(0);
      expect(computeZoomDetentIndex(GLOBE_MAX_ALTITUDE)).toBe(ZOOM_HAPTIC_DETENTS);
      const midDetent = computeZoomDetentIndex(1.0);
      expect(midDetent).toBeGreaterThan(3);
      expect(midDetent).toBeLessThan(ZOOM_HAPTIC_DETENTS - 2);
      expect(computeZoomDetentIndex(NaN)).toBeNull();
    });

    it("pulses only during active user zoom gestures, enforces cooldown, and gives a firmer tick on min/max bounds", () => {
      const pulses = [];
      const tracker = createZoomHapticTracker({
        cooldownMs: 50,
        vibrate: (ms) => {
          pulses.push(ms);
          return true;
        },
      });

      // Inactive camera movement (1-finger pan or programmatic tween) never pulses
      expect(tracker.onAltitudeChange(2.5, { now: 100 }).pulsed).toBe(false);
      expect(tracker.onAltitudeChange(1.5, { now: 180 }).pulsed).toBe(false);
      expect(pulses).toEqual([]);

      // User starts a wheel / pinch zoom gesture
      tracker.markZoomGesture(200);
      // Crossing into a closer detent triggers a 2ms micro-pulse
      const step1 = tracker.onAltitudeChange(1.1, { now: 210 });
      expect(step1.pulsed).toBe(true);
      expect(step1.duration).toBe(ZOOM_HAPTIC_TICK_MS);

      // Immediate crossing within cooldown (< 50ms) is suppressed
      const cooldownStep = tracker.onAltitudeChange(0.8, { now: 230 });
      expect(cooldownStep.pulsed).toBe(false);
      expect(cooldownStep.reason).toBe("cooldown");

      // After cooldown, hitting the exact minAltitude floor triggers a 5ms boundary stop tick
      const floorStep = tracker.onAltitudeChange(GLOBE_MIN_ALTITUDE, { now: 275 });
      expect(floorStep.pulsed).toBe(true);
      expect(floorStep.duration).toBe(ZOOM_HAPTIC_BOUNDARY_MS);
      expect(floorStep.boundary).toBe("min");

      // Synchronous 2-finger pinch distance & wheel delta steppers
      expect(tracker.onPinchDistance(100, { now: 500, stepPx: 14 }).pulsed).toBe(false);
      const pinchTick = tracker.onPinchDistance(118, { now: 560, stepPx: 14 });
      expect(pinchTick.pulsed).toBe(true);
      expect(pinchTick.duration).toBe(ZOOM_HAPTIC_TICK_MS);
      expect(tracker.onWheelDelta(20, { now: 620, stepDelta: 36 }).pulsed).toBe(false);
      const wheelTick = tracker.onWheelDelta(20, { now: 680, stepDelta: 36 });
      expect(wheelTick.pulsed).toBe(true);

      // Clearing gesture stops further pulses
      tracker.clearZoomGesture();
      expect(tracker.onAltitudeChange(1.8, { now: 800 }).pulsed).toBe(false);
      // Passing isZoomGesture: true directly activates the gesture window (double-tap-drag zoom)
      expect(tracker.onAltitudeChange(1.2, { now: 900, isZoomGesture: true }).pulsed).toBe(true);
      expect(ZOOM_HAPTIC_TICK_MS).toBe(42);
      expect(ZOOM_HAPTIC_BOUNDARY_MS).toBe(65);
      expect(typeof primeHapticsOnUserGesture).toBe("function");
      primeHapticsOnUserGesture();
      // When navigator.vibrate is absent (iOS Safari), falls back to the hidden switch toggle
      expect(triggerSubtleHapticTick(ZOOM_HAPTIC_TICK_MS, {})).toBe(true);
      expect(
        triggerSubtleHapticTick(ZOOM_HAPTIC_TICK_MS, {
          vibrate: (ms) => ms === ZOOM_HAPTIC_TICK_MS,
        })
      ).toBe(true);
    });
  });

  describe("isDoubleTapZoomStart", () => {
    it("returns true for a fast second tap within radius", () => {
      const start = isDoubleTapZoomStart({
        now: 1000,
        touch: { clientX: 105, clientY: 108 },
        lastTapAt: 850, // 150ms ago (< 280ms)
        lastTapPos: { x: 100, y: 100 }, // distance ~9.4px (< 24px)
        hadMultiTouch: false,
      });
      expect(start).toBe(true);
    });

    it("returns false if previous interaction had multi-touch (e.g. pinch)", () => {
      const start = isDoubleTapZoomStart({
        now: 1000,
        touch: { clientX: 105, clientY: 108 },
        lastTapAt: 850,
        lastTapPos: { x: 100, y: 100 },
        hadMultiTouch: true,
      });
      expect(start).toBe(false);
    });

    it("returns false if time elapsed exceeds window (>= 280ms)", () => {
      const start = isDoubleTapZoomStart({
        now: 1300,
        touch: { clientX: 105, clientY: 108 },
        lastTapAt: 1000, // 300ms ago (>= 280ms)
        lastTapPos: { x: 100, y: 100 },
        hadMultiTouch: false,
      });
      expect(start).toBe(false);
    });

    it("returns false if second tap lands too far away (>= 24px)", () => {
      const start = isDoubleTapZoomStart({
        now: 1000,
        touch: { clientX: 130, clientY: 100 }, // distance = 30px (>= 24px)
        lastTapAt: 850,
        lastTapPos: { x: 100, y: 100 },
        hadMultiTouch: false,
      });
      expect(start).toBe(false);
    });

    it("returns false if any required argument is missing", () => {
      expect(isDoubleTapZoomStart({})).toBe(false);
      expect(isDoubleTapZoomStart({ now: 1000, touch: { clientX: 0, clientY: 0 } })).toBe(false);
    });
  });
});
