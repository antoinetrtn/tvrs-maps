import { useRef, useCallback } from "react";
import {
  getLngLatDistance,
  featureContainsLngLat,
  clientToGlobeCoords,
} from "../utils/utils";

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
    [gameDataMap, onCountrySelect],
  );

  const selectCountryAtLngLat = useCallback(
    (lng, lat) => {
      if (isRiversMountainsMode) {
        let best = null;
        Object.entries(gameDataMap).forEach(([admin, data]) => {
          if (!data) return;

          let dist;
          if (
            data.type === "river" &&
            Array.isArray(data.path) &&
            data.path.length > 0
          ) {
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
            return;
          }
        }
        if (mode !== "learn") {
          selectCountry(null);
          return;
        }
      }

      if (isDepartmentMode) {
        let best = null;
        Object.entries(gameDataMap).forEach(([admin, data]) => {
          if (data.lat === undefined || data.lng === undefined) return;
          const dist = getLngLatDistance(lng, lat, data.lng, data.lat);
          if (!best || dist < best.dist) best = { admin, dist };
        });
        selectCountry(best && best.dist < 2.2 ? best.admin : null);
        return;
      }

      const match = selectableFeatureIndex.find((entry) =>
        featureContainsLngLat(entry, lng, lat),
      );
      if (match) {
        selectCountry(match.admin);
        return;
      }

      let best = null;
      Object.entries(gameDataMap).forEach(([admin, data]) => {
        if (data.lat === undefined || data.lng === undefined) return;
        const dist = getLngLatDistance(lng, lat, data.lng, data.lat);
        if (!best || dist < best.dist) best = { admin, dist };
      });
      if (best && best.dist < 6) {
        selectCountry(best.admin);
      } else {
        selectCountry(null);
      }
    },
    [
      gameDataMap,
      isDepartmentMode,
      isRiversMountainsMode,
      selectableFeatureIndex,
      selectCountry,
      mode,
    ],
  );

  const resetGlobeNudge = useCallback(() => {
    const wrapper = globeContentWrapperRef.current;
    if (!wrapper) return;
    if (pointerNudgeRafRef.current != null) {
      cancelAnimationFrame(pointerNudgeRafRef.current);
      pointerNudgeRafRef.current = null;
    }
    pendingNudgeRef.current = null;
    wrapper.style.transition =
      "transform 520ms cubic-bezier(0.18, 0.9, 0.22, 1.18)";
    wrapper.style.setProperty("--globe-nudge-x", "0px");
    wrapper.style.setProperty("--globe-nudge-y", "0px");
  }, [globeContentWrapperRef]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const now = Date.now();
    const touch = e.touches[0];
    if (now - lastTapRef.current < 300) {
      isZoomDragging.current = true;
      startY.current = touch.clientY;
      try {
        const controls = globeEl.current?.controls?.();
        if (controls) {
          savedControlsEnabledRef.current = controls.enableRotate;
          controls.enableRotate = false;
        }
      } catch (_) {}
      e.preventDefault();
    }
    lastTapRef.current = now;
  }, [globeEl]);

  const handleTouchMove = useCallback((e) => {
    if (!isZoomDragging.current || !globeEl.current) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startY.current;
    const currentPOV = globeEl.current.pointOfView();
    const zoomSpeed = 0.005;
    const newAlt = Math.max(
      0.1,
      Math.min(4, currentPOV.altitude - deltaY * zoomSpeed),
    );
    globeEl.current.pointOfView({ altitude: newAlt }, 0);
    startY.current = touch.clientY;
    e.preventDefault();
  }, [globeEl]);

  const handleTouchEnd = useCallback(() => {
    if (isZoomDragging.current) {
      try {
        const controls = globeEl.current?.controls?.();
        if (controls) {
          controls.enableRotate = savedControlsEnabledRef.current;
        }
      } catch (_) {}
    }
    isZoomDragging.current = false;
  }, [globeEl]);

  const handlePointerDown = useCallback(
    (event) => {
      if (
        event.pointerType === "touch" &&
        isKeyboardMode &&
        viewport.width < 1024
      ) {
        event.preventDefault();
        onPreserveInputFocus?.();
      }

      tapRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: performance.now(),
      };

      if (globeContentWrapperRef.current && !isHomeScreen) {
        globeContentWrapperRef.current.style.transition =
          "transform 80ms linear";
      }
    },
    [isHomeScreen, isKeyboardMode, onPreserveInputFocus, viewport.width, globeContentWrapperRef],
  );

  const handlePointerMove = useCallback(
    (event) => {
      const tap = tapRef.current;
      const wrapper = globeContentWrapperRef.current;
      if (!tap || tap.pointerId !== event.pointerId || !wrapper || isHomeScreen)
        return;

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
    [isHomeScreen, perfProfile?.isMobile, globeContentWrapperRef],
  );

  const handlePointerUp = useCallback(
    (event) => {
      const tap = tapRef.current;
      tapRef.current = null;
      resetGlobeNudge();
      if (isHomeScreen) return;
      if (!tap || tap.pointerId !== event.pointerId) return;

      const dx = event.clientX - tap.x;
      const dy = event.clientY - tap.y;
      const moved = Math.hypot(dx, dy);
      const elapsed = performance.now() - tap.t;
      if (moved > 10 || elapsed > 600 || !globeEl.current?.toGlobeCoords)
        return;

      if (
        event.pointerType === "touch" &&
        isKeyboardMode &&
        viewport.width < 1024
      ) {
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
    ],
  );

  const handleBackgroundClick = useCallback(() => {
    if (!isHomeScreen) {
      selectCountry(null);
    }
  }, [isHomeScreen, selectCountry]);

  const handleGlobeClick = useCallback((obj) => {
    if (!isHomeScreen) {
      selectCountry(obj.admin);
    }
  }, [isHomeScreen, selectCountry]);

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