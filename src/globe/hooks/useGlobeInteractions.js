import { useCallback, useRef } from "react";

import { BREAKPOINTS } from "../../config/gameConstants";
import { perfTracker } from "../../utils/perfTracker";
import { clientToGlobeCoords, featureContainsLngLat, getLngLatDistance } from "../../utils/utils";
import { clampGlobeAltitude } from "../render/globeAltitude";

// Double-tap-and-drag zoom: the second tap must land quickly and close to the first.
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_RADIUS_PX = 24;

/**
 * True when a single-finger touchstart completes a double tap (time + distance
 * window) and is not the tail of a two-finger pinch.
 */
export function isDoubleTapZoomStart({ now, touch, lastTapAt, lastTapPos, hadMultiTouch }) {
  if (hadMultiTouch || !touch || !lastTapPos || !lastTapAt) return false;
  if (now - lastTapAt >= DOUBLE_TAP_MS) return false;
  return (
    Math.hypot(touch.clientX - lastTapPos.x, touch.clientY - lastTapPos.y) < DOUBLE_TAP_RADIUS_PX
  );
}

/** The wrapper "nudge" parallax is a mouse/pen effect only: on touch it fights OrbitControls. */
const allowsGlobeNudge = (pointerType) => pointerType !== "touch";

export function shouldRestoreInputFocusOnPointerUp({ pointerType, isHomeScreen } = {}) {
  if (isHomeScreen) {
    return false;
  }
  return pointerType === "mouse" || pointerType === "pen";
}

export function useGlobeInteractions({
  globeEl,
  globeContentWrapperRef,
  isHomeScreen,
  isKeyboardMode,
  viewport,
  perfProfile,
  onCountrySelect,
  onPreserveInputFocus,
  mode,
  gameDataMap,
  selectableFeatureIndex,
  isDepartmentMode,
  isRiversMountainsMode,
}) {
  const tapRef = useRef(null);
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef(null);
  const hadMultiTouchRef = useRef(false);
  const isZoomDragging = useRef(false);
  const startY = useRef(0);
  const savedControlsEnabledRef = useRef(true);

  const pointerNudgeRafRef = useRef(null);
  const pendingNudgeRef = useRef(null);

  const selectCountry = useCallback(
    (admin) => {
      if (onCountrySelect) {
        if (!admin || gameDataMap[admin]) {
          onCountrySelect(admin);
        }
      }
    },
    [gameDataMap, onCountrySelect]
  );

  const selectCountryAtLngLat = useCallback(
    (lng, lat) => {
      const t0 = performance.now();
      const recordLatency = () => {
        const t1 = performance.now();
        perfTracker.recordSelect(t1 - t0);
      };

      if (isRiversMountainsMode) {
        let best = null;
        Object.entries(gameDataMap).forEach(([admin, data]) => {
          if (!data) return;

          let dist;
          if (data.type === "river" && Array.isArray(data.path) && data.path.length > 0) {
            dist = data.path.reduce((min, [pLat, pLng]) => {
              const d = getLngLatDistance(lng, lat, pLng, pLat);
              return d < min ? d : min;
            }, Infinity);
          } else if (data.lat !== undefined && data.lng !== undefined) {
            dist = getLngLatDistance(lng, lat, data.lng, data.lat);
          } else {
            return;
          }
          if (!best || dist < best.dist) best = { admin, dist };
        });

        const bestData = best ? gameDataMap[best.admin] : null;
        if (bestData) {
          const threshold = bestData.type === "river" ? 5.5 : 6.0;
          if (best.dist < threshold) {
            selectCountry(best.admin);
            recordLatency();
            return;
          }
        }
        if (mode !== "learn") {
          selectCountry(null);
          recordLatency();
          return;
        }
      }

      const isUsStatesMode = mode === "us_states" || mode?.includes("us_states");
      const match = selectableFeatureIndex.find((entry) => featureContainsLngLat(entry, lng, lat));
      if (match) {
        selectCountry(match.admin);
        recordLatency();
        return;
      }

      // Special polar region handling: everything south of 60°S (without a matched island) is Antarctica
      if (lat <= -60.0 && gameDataMap["Antarctica"]) {
        selectCountry("Antarctica");
        recordLatency();
        return;
      }

      let best = null;
      Object.entries(gameDataMap).forEach(([admin, data]) => {
        if (!data || data.lat === undefined || data.lng === undefined) return;
        const dist = getLngLatDistance(lng, lat, data.lng, data.lat);
        if (!best || dist < best.dist) best = { admin, dist };
      });

      const maxDist = isDepartmentMode ? 2.5 : isUsStatesMode ? 4.5 : 6.0;
      if (best && best.dist < maxDist) {
        selectCountry(best.admin);
      } else if (mode !== "learn") {
        selectCountry(null);
      }
      recordLatency();
    },
    [
      gameDataMap,
      isDepartmentMode,
      isRiversMountainsMode,
      selectableFeatureIndex,
      selectCountry,
      mode,
    ]
  );

  const resetGlobeNudge = useCallback(() => {
    const wrapper = globeContentWrapperRef.current;
    if (!wrapper) return;
    if (pointerNudgeRafRef.current != null) {
      cancelAnimationFrame(pointerNudgeRafRef.current);
      pointerNudgeRafRef.current = null;
    }
    pendingNudgeRef.current = null;
    wrapper.style.transition = "transform var(--dur-slow) var(--ease-out)";
    wrapper.style.setProperty("--globe-nudge-x", "0px");
    wrapper.style.setProperty("--globe-nudge-y", "0px");
  }, [globeContentWrapperRef]);

  const restoreRotateAfterZoomDrag = useCallback(() => {
    if (!isZoomDragging.current) return;
    isZoomDragging.current = false;
    try {
      const controls = globeEl.current?.controls?.();
      if (controls) controls.enableRotate = savedControlsEnabledRef.current;
    } catch {}
  }, [globeEl]);

  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches.length > 1) {
        // Two fingers: hand the pinch to OrbitControls, untouched.
        hadMultiTouchRef.current = true;
        restoreRotateAfterZoomDrag();
        lastTapRef.current = 0;
        lastTapPosRef.current = null;
        return;
      }
      if (e.touches.length !== 1) return;
      const now = Date.now();
      const touch = e.touches[0];
      const isDoubleTap = isDoubleTapZoomStart({
        now,
        touch,
        lastTapAt: lastTapRef.current,
        lastTapPos: lastTapPosRef.current,
        hadMultiTouch: hadMultiTouchRef.current,
      });
      hadMultiTouchRef.current = false;
      if (isDoubleTap) {
        isZoomDragging.current = true;
        startY.current = touch.clientY;
        try {
          const controls = globeEl.current?.controls?.();
          if (controls) {
            savedControlsEnabledRef.current = controls.enableRotate;
            controls.enableRotate = false;
          }
        } catch {}
        e.preventDefault();
        // A third tap must start a fresh double-tap window.
        lastTapRef.current = 0;
        lastTapPosRef.current = null;
        return;
      }
      lastTapRef.current = now;
      lastTapPosRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [globeEl, restoreRotateAfterZoomDrag]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!isZoomDragging.current || !globeEl.current) return;
      if (e.touches.length > 1) {
        hadMultiTouchRef.current = true;
        lastTapRef.current = 0;
        restoreRotateAfterZoomDrag();
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - startY.current;
      const currentPOV = globeEl.current.pointOfView();
      const zoomSpeed = 0.005;
      const newAlt = clampGlobeAltitude(currentPOV.altitude - deltaY * zoomSpeed);
      globeEl.current.pointOfView({ altitude: newAlt }, 0);
      startY.current = touch.clientY;
      e.preventDefault();
    },
    [globeEl, restoreRotateAfterZoomDrag]
  );

  const handleTouchEnd = useCallback(
    (e) => {
      restoreRotateAfterZoomDrag();
      // Lifting one finger of a pinch must not count as the first tap of a
      // double tap (it would turn the next touch into a zoom-drag).
      if (hadMultiTouchRef.current || (e?.touches?.length ?? 0) > 0) {
        lastTapRef.current = 0;
        lastTapPosRef.current = null;
      }
    },
    [restoreRotateAfterZoomDrag]
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (event.pointerType === "touch" && isKeyboardMode && viewport.width < BREAKPOINTS.desktop) {
        event.preventDefault();
        onPreserveInputFocus?.();
      }

      tapRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: performance.now(),
      };

      if (globeContentWrapperRef.current && !isHomeScreen && allowsGlobeNudge(event.pointerType)) {
        globeContentWrapperRef.current.style.transition = "transform 80ms linear";
      }
    },
    [isHomeScreen, isKeyboardMode, onPreserveInputFocus, viewport.width, globeContentWrapperRef]
  );

  const handlePointerMove = useCallback(
    (event) => {
      // No per-move globe hit-test: its result was never used (selection is
      // resolved on pointerup), and it cost a raycast + point-in-polygon scan
      // on every move event during drags.
      const tap = tapRef.current;
      const wrapper = globeContentWrapperRef.current;
      if (!tap || tap.pointerId !== event.pointerId || !wrapper || isHomeScreen) return;
      // Touch: no wrapper translation — OrbitControls already moves the globe
      // under the finger; translating the canvas too feels rubbery and snaps
      // back on lift.
      if (!allowsGlobeNudge(event.pointerType)) return;

      const dx = event.clientX - tap.x;
      const dy = event.clientY - tap.y;
      const strength = perfProfile?.isMobile ? 0.035 : 0.045;
      const limit = perfProfile?.isMobile ? 9 : 16;
      const nudgeX = Math.max(-limit, Math.min(limit, dx * strength));
      const nudgeY = Math.max(-limit, Math.min(limit, dy * strength));
      pendingNudgeRef.current = { x: nudgeX, y: nudgeY };
      if (pointerNudgeRafRef.current == null) {
        pointerNudgeRafRef.current = requestAnimationFrame(() => {
          pointerNudgeRafRef.current = null;
          const w = globeContentWrapperRef.current;
          const n = pendingNudgeRef.current;
          if (!w || !n) return;
          w.style.setProperty("--globe-nudge-x", `${n.x.toFixed(2)}px`);
          w.style.setProperty("--globe-nudge-y", `${n.y.toFixed(2)}px`);
        });
      }
    },
    [isHomeScreen, perfProfile?.isMobile, globeContentWrapperRef]
  );

  const handlePointerUp = useCallback(
    (event) => {
      const shouldRestoreFocus = shouldRestoreInputFocusOnPointerUp({
        pointerType: event.pointerType,
        isHomeScreen,
      });
      const tap = tapRef.current;
      tapRef.current = null;
      resetGlobeNudge();
      if (isHomeScreen) return;
      if (!tap || tap.pointerId !== event.pointerId) return;

      if (shouldRestoreFocus) {
        onPreserveInputFocus?.();
      }

      const dx = event.clientX - tap.x;
      const dy = event.clientY - tap.y;
      const moved = Math.hypot(dx, dy);
      const elapsed = performance.now() - tap.t;
      if (moved > 10 || elapsed > 600 || !globeEl.current?.toGlobeCoords) return;

      if (event.pointerType === "touch" && isKeyboardMode && viewport.width < BREAKPOINTS.desktop) {
        event.preventDefault();
        onPreserveInputFocus?.();
      }

      let clientX = event.clientX;
      let clientY = event.clientY;
      if (window.visualViewport) {
        clientX += window.visualViewport.offsetLeft || 0;
        clientY += window.visualViewport.offsetTop || 0;
      }

      const coords = clientToGlobeCoords(globeEl, clientX, clientY);
      if (coords) {
        selectCountryAtLngLat(coords.lng, coords.lat);
      } else {
        selectCountry(null);
      }
    },
    [
      isHomeScreen,
      isKeyboardMode,
      onPreserveInputFocus,
      resetGlobeNudge,
      selectCountryAtLngLat,
      selectCountry,
      viewport.width,
      globeEl,
    ]
  );

  const handleBackgroundClick = useCallback(() => {
    if (!isHomeScreen) {
      selectCountry(null);
    }
  }, [isHomeScreen, selectCountry]);

  const handleGlobeClick = useCallback(
    (obj) => {
      if (!isHomeScreen) {
        selectCountry(obj.admin);
      }
    },
    [isHomeScreen, selectCountry]
  );

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleBackgroundClick,
    handleGlobeClick,
    selectCountry,
    selectCountryAtLngLat,
    resetGlobeNudge,
  };
}
