import { useEffect, useRef, useState } from "react";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { getActiveModeConfig } from "../../config/gameConfig";
import {
  BREAKPOINTS,
  GAME_START_VIEW_JITTER_DEG,
  GAME_START_VIEWPOINTS,
  getDataPanelLayoutWidth,
} from "../../config/gameConstants";
import { countryDataMap } from "../../data/gameData";
import { riversMountainsDataMap } from "../../data/riversMountainsData";
import { getCanonicalPosition } from "../../utils/utils";
import {
  clampGlobeAltitude,
  frameBoundsAltitude,
  GLOBE_MIN_ALTITUDE,
  readClampedGlobePov,
  REGIONAL_MIN_ALTITUDE,
  setGlobeMinAltitude,
  syncGlobeCameraAndZoomLimits,
} from "../render/globeAltitude";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";

const ORBIT_POLE_GUARD_ANGLE = 0.005;
// Hard ceiling on the WebGL backing-store density (fill-rate on DPR-3 phones).
const MAX_GLOBE_PIXEL_RATIO = 2;
// iOS Safari's collapsing toolbar changes innerHeight by roughly 50-110px while
// scrolling/gesturing; resizing the WebGL canvas for that causes a visible
// flash. Height shrinks below this are ignored unless the width also changed.
const TOOLBAR_HEIGHT_TOLERANCE_PX = 140;

// Selecting a department zooms to this fraction of the region framing.
const REGIONAL_PICK_ZOOM = 0.6;

// A new run lands on a random region anchor (jittered) instead of always the
// same Europe-facing view.
const getRandomGameStartView = () => {
  const base = GAME_START_VIEWPOINTS[Math.floor(Math.random() * GAME_START_VIEWPOINTS.length)];
  const jitter = () => (Math.random() * 2 - 1) * GAME_START_VIEW_JITTER_DEG;
  return { lat: base.lat + jitter(), lng: base.lng + jitter() };
};

const getCustomModePointOfView = (mode, learnSubMode, viewport, isPanelOpen) => {
  const config = getActiveModeConfig(mode, learnSubMode);
  if (!config?.viewPoint) return null;
  const isMobile = viewport.width < BREAKPOINTS.mobile;
  if (config.bounds && viewport.width > 0 && viewport.height > 0) {
    // Fit the region to the visible area: the side panel eats ~30% of the
    // width on desktop, the bottom HUD ~20% of the height on mobile.
    const panelFactor = isPanelOpen && viewport.width >= BREAKPOINTS.desktop ? 0.7 : 1;
    const aspect = (viewport.width * panelFactor) / viewport.height;
    const visibleHeight = isMobile ? 0.8 : 1;
    const { latMin, latMax, lngMin, lngMax } = config.bounds;
    return {
      lat: (latMin + latMax) / 2 - (isMobile ? (latMax - latMin) * 0.12 : 0),
      lng: (lngMin + lngMax) / 2,
      altitude: frameBoundsAltitude(config.bounds, aspect, visibleHeight),
    };
  }
  return {
    lat: config.viewPoint.lat,
    lng: config.viewPoint.lng,
    altitude: isMobile ? config.viewPoint.altitude.mobile : config.viewPoint.altitude.desktop,
  };
};

/**
 * Mobile keyboard: vertical px shift that moves the canvas centre onto the
 * centre of the visible viewport (visualViewport), so the selected country —
 * always aimed at the canvas centre — lands in the visible part of the screen.
 */
export const getKeyboardShift = ({ viewport, isKeyboardMode, isHomeScreen, canvasHeight }) => {
  if (isHomeScreen || !isKeyboardMode || viewport.width >= BREAKPOINTS.mobile) return 0;
  const visibleCenter = (viewport.top || 0) + viewport.height / 2;
  return Math.min(0, Math.round(visibleCenter - canvasHeight / 2));
};

const buildSelectedCountryCameraTarget = ({
  data,
  viewport,
  isHomeScreen,
  isKeyboardMode,
  customPOV,
  hasPreviousSelection,
  currentPOV,
  canonicalPositions = {},
}) => {
  // GLOBAL RULE: force camera target to exact shape position (centroid or path midpoint)
  const canonical =
    (data && canonicalPositions[data.admin || ""]) || getCanonicalPosition(data || {});
  const useLat = canonical ? canonical.lat : data?.lat;
  const useLng = canonical ? canonical.lng : data?.lng;

  const isMobile = viewport.width < BREAKPOINTS.mobile;
  const customModeAltitude = customPOV ? customPOV.altitude : null;
  const fallbackAltitude = isHomeScreen
    ? (customModeAltitude ?? (isMobile ? 2.0 : 1.25))
    : (customModeAltitude ?? (isMobile ? 1.8 : 0.68));
  const preservedAltitude =
    currentPOV && Number.isFinite(currentPOV.altitude) ? currentPOV.altitude : fallbackAltitude;
  const isKeyboardOpen = isMobile && isKeyboardMode;
  const bottomHUDRatio = isMobile ? 0.15 : 0;
  // Keyboard open: the globe wrapper itself is shifted in screen space to the
  // visible viewport (getKeyboardShift), so no latitude fudge on top of it.
  const occlusionRatio = isKeyboardOpen ? 0 : bottomHUDRatio;
  const visibleHeightDegrees = 36 * preservedAltitude;
  const latOffset = isHomeScreen ? 0 : -visibleHeightDegrees * (occlusionRatio * 0.7);

  // Antarctica special handling: place target over South Pole cap with wider altitude
  const isAntarctica =
    data?.iso2 === "AQ" || data?.admin === "Antarctica" || (useLat && useLat <= -80);
  const targetLat = isAntarctica ? -85 : (useLat ?? 0) + latOffset;
  const targetLng =
    isAntarctica && currentPOV && Number.isFinite(currentPOV.lng) ? currentPOV.lng : (useLng ?? 0);
  const antarcticaAltitude = isHomeScreen ? (isMobile ? 2.0 : 1.5) : isMobile ? 1.7 : 1.35;

  // Regional maps: the first selection keeps the whole-region framing; later
  // picks glide in towards the department/state (never back out).
  if (customPOV && !isHomeScreen && !isAntarctica) {
    return {
      lat: targetLat,
      lng: targetLng,
      altitude: clampGlobeAltitude(
        Math.min(
          preservedAltitude,
          customPOV.altitude * (hasPreviousSelection ? REGIONAL_PICK_ZOOM : 1)
        )
      ),
    };
  }

  return {
    lat: targetLat,
    lng: targetLng,
    altitude: isAntarctica
      ? antarcticaAltitude
      : hasPreviousSelection
        ? isHomeScreen
          ? fallbackAltitude
          : preservedAltitude
        : Math.min(preservedAltitude, fallbackAltitude),
  };
};

const applyIdleCameraPointOfView = ({
  globeEl,
  viewport,
  isEndScreen,
  isHomeScreen,
  customPOV,
  wasHomeScreen,
}) => {
  if (isEndScreen) {
    globeEl.current.pointOfView(
      customPOV
        ? customPOV
        : { lat: 20, lng: 0, altitude: viewport.width < BREAKPOINTS.mobile ? 2.2 : 1.8 },
      1200
    );
    return;
  }

  if (isHomeScreen) {
    const isMobile = viewport.width < BREAKPOINTS.mobile;
    const targetPov = isMobile
      ? { lat: 18, lng: 20, altitude: 2.2 }
      : { lat: 16, lng: 28, altitude: 1.1 };
    globeEl.current?.pointOfView?.(targetPov, 850);
    return;
  }

  if (customPOV) {
    globeEl.current?.pointOfView?.(customPOV, wasHomeScreen ? 650 : 500);
    return;
  }

  if (wasHomeScreen) {
    const startView = getRandomGameStartView();
    globeEl.current?.pointOfView?.(
      {
        lat: startView.lat,
        lng: startView.lng,
        altitude: viewport.width < BREAKPOINTS.mobile ? 1.8 : 1.35,
      },
      650
    );
  }
};

export function useGlobeCamera({
  globeEl,
  selectedCountry,
  shouldAutoRotate,
  viewport,
  isHomeScreen,
  isKeyboardMode,
  isEndScreen,
  learnSubMode,
  gameDataMap,
  perfProfile,
  isPanelOpen = false,
  mode = "countries",
  selectionTransition: _selectionTransition,
  canonicalPositions = {},
}) {
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [cameraPOV, setCameraPOV] = useState({ lat: 0, lng: 0 });

  const lastTargetRef = useRef(null);
  const wasHomeScreenRef = useRef(isHomeScreen);
  const isInteractingRef = useRef(false);
  const maxWindowWidthRef = useRef(window.innerWidth);
  const maxWindowHeightRef = useRef(window.innerHeight);
  const previousSelectedCountryRef = useRef(null);
  const previousModeKeyRef = useRef(null);
  const isRegionalMapRef = useRef(false);
  const isRegionalMap = Boolean(getActiveModeConfig(mode, learnSubMode)?.bounds);
  isRegionalMapRef.current = isRegionalMap;

  // Regional maps: allow a closer zoom floor and zoom towards the pointer, so
  // small departments are easy to reach with the wheel or a pinch.
  useEffect(() => {
    setGlobeMinAltitude(isRegionalMap ? REGIONAL_MIN_ALTITUDE : GLOBE_MIN_ALTITUDE);
    const controls = globeEl.current?.controls?.();
    if (!controls) return;
    controls.zoomToCursor = isRegionalMap;
    syncGlobeCameraAndZoomLimits(globeEl.current, controls);
    if (!isRegionalMap) readClampedGlobePov(globeEl.current);
  }, [isRegionalMap, globeEl]);

  useEffect(() => {
    let controlsReference = null;
    let changeHandler = null;
    let startHandler = null;
    let endHandler = null;

    if (globeEl.current) {
      try {
        const renderer = globeEl.current.renderer();
        if (renderer) {
          const pixelRatio = Math.min(perfProfile?.pixelRatio || 1, MAX_GLOBE_PIXEL_RATIO);
          if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
          renderer.sortObjects = true;
          // Shader error checking calls getProgramInfoLog synchronously after
          // every link, stalling the main thread on each new material variant.
          if (import.meta.env.PROD) renderer.debug.checkShaderErrors = false;
          // Keep the screen-space glitch grain the same visual size regardless
          // of the device's capped pixel ratio.
          polygonGlitchUniforms.uPixelScale.value =
            GLITCH_EFFECT_SETTINGS.referencePixelRatio / pixelRatio;
        }

        const controls = globeEl.current.controls();
        if (controls) {
          controlsReference = controls;
          controls.autoRotate = shouldAutoRotate;
          controls.autoRotateSpeed = 0.3;
          controls.enableZoom = true;
          controls.enableDamping = true;
          controls.dampingFactor = perfProfile?.isMobile ? 0.12 : 0.08;
          controls.rotateSpeed = perfProfile?.isMobile ? 0.75 : 0.9;
          controls.zoomSpeed = perfProfile?.isMobile ? 0.75 : 1;
          controls.zoomToCursor = isRegionalMapRef.current;
          controls.minPolarAngle = ORBIT_POLE_GUARD_ANGLE;
          controls.maxPolarAngle = Math.PI - ORBIT_POLE_GUARD_ANGLE;
          syncGlobeCameraAndZoomLimits(globeEl.current, controls);

          changeHandler = () => {
            if (isInteractingRef.current) return;
            const pov = readClampedGlobePov(globeEl.current);
            if (!pov) return;
            setZoomLevel((prev) => {
              if (Math.abs(prev - pov.altitude) > 0.08) return pov.altitude;
              return prev;
            });
            setCameraPOV((prev) => {
              const threshold = isHomeScreen ? 15 : 10;
              if (
                Math.abs(prev.lat - pov.lat) > threshold ||
                Math.abs(prev.lng - pov.lng) > threshold
              ) {
                return { lat: pov.lat, lng: pov.lng };
              }
              return prev;
            });
          };

          startHandler = () => {
            isInteractingRef.current = true;
          };

          endHandler = () => {
            isInteractingRef.current = false;
            const pov = readClampedGlobePov(globeEl.current);
            if (!pov) return;
            setZoomLevel(pov.altitude);
            // Keep the previous object when nothing moved, so a tap without a
            // drag doesn't re-render the whole globe tree.
            setCameraPOV((prev) =>
              prev.lat === pov.lat && prev.lng === pov.lng ? prev : { lat: pov.lat, lng: pov.lng }
            );
          };

          controls.addEventListener("change", changeHandler);
          controls.addEventListener("start", startHandler);
          controls.addEventListener("end", endHandler);
        }

        syncGlobeCameraAndZoomLimits(globeEl.current, controlsReference);
      } catch {}
    }

    return () => {
      if (controlsReference) {
        try {
          if (changeHandler) controlsReference.removeEventListener("change", changeHandler);
          if (startHandler) controlsReference.removeEventListener("start", startHandler);
          if (endHandler) controlsReference.removeEventListener("end", endHandler);
        } catch {}
      }
    };
  }, [shouldAutoRotate, perfProfile?.pixelRatio, perfProfile?.isMobile, isHomeScreen, globeEl]);

  useEffect(() => {
    const selectionChanged = selectedCountry !== previousSelectedCountryRef.current;
    const customPOV = getCustomModePointOfView(mode, learnSubMode, viewport, isPanelOpen);
    const modeKey = `${mode}|${learnSubMode}`;
    const modeChanged = previousModeKeyRef.current !== modeKey;
    previousModeKeyRef.current = modeKey;
    const isEnteringHomeFromGame = isHomeScreen && !wasHomeScreenRef.current;

    if (isEnteringHomeFromGame && globeEl.current) {
      applyIdleCameraPointOfView({
        globeEl,
        viewport,
        isEndScreen,
        isHomeScreen,
        customPOV,
        wasHomeScreen: false,
      });
      lastTargetRef.current = null;
    } else if (selectedCountry && globeEl.current) {
      const data =
        gameDataMap[selectedCountry] ||
        countryDataMap[selectedCountry] ||
        riversMountainsDataMap[selectedCountry];

      if (data && data.lat !== undefined) {
        const hasPreviousSelection = Boolean(previousSelectedCountryRef.current);
        const target = buildSelectedCountryCameraTarget({
          data,
          viewport,
          isHomeScreen,
          isKeyboardMode,
          customPOV,
          hasPreviousSelection,
          currentPOV: globeEl.current.pointOfView(),
          canonicalPositions,
        });
        const previousTarget = lastTargetRef.current;
        const targetChanged =
          !previousTarget ||
          Math.abs(previousTarget.lat - target.lat) >= 0.001 ||
          Math.abs(previousTarget.lng - target.lng) >= 0.001 ||
          Math.abs(previousTarget.altitude - target.altitude) >= 0.001;
        const onlyViewportNudge =
          !selectionChanged &&
          previousTarget &&
          previousSelectedCountryRef.current === selectedCountry &&
          targetChanged;

        if (selectionChanged || onlyViewportNudge) {
          // A viewport nudge (keyboard open/close on mobile) recenters the same
          // country: glide it a touch slower on mobile so a large keyboard
          // offset doesn't snap the globe. Real selection changes keep their
          // snappier timing.
          const duration = isHomeScreen
            ? 650
            : onlyViewportNudge
              ? perfProfile?.isMobile
                ? 340
                : 180
              : perfProfile?.isMobile
                ? 320
                : 420;
          globeEl.current.pointOfView(target, duration);
          lastTargetRef.current = target;
        }
      }
    } else if (
      (selectionChanged || modeChanged || isHomeScreen !== wasHomeScreenRef.current) &&
      globeEl.current
    ) {
      applyIdleCameraPointOfView({
        globeEl,
        viewport,
        isEndScreen,
        isHomeScreen,
        customPOV,
        wasHomeScreen: wasHomeScreenRef.current,
      });
      lastTargetRef.current = null;
    }

    wasHomeScreenRef.current = isHomeScreen;
    previousSelectedCountryRef.current = selectedCountry;
  }, [
    selectedCountry,
    viewport.width,
    // NOTE: viewport.height / viewport.top are intentionally NOT dependencies.
    // visualViewport fires a burst of resize events while the keyboard slides
    // in/out; reacting to each one re-fired the camera animation and made the
    // globe stutter. The keyboard offset is instead recomputed only when the
    // debounced isKeyboardMode boolean flips (open → once, close → once).
    isHomeScreen,
    perfProfile,
    isKeyboardMode,
    isEndScreen,
    gameDataMap,
    mode,
    learnSubMode,
    isPanelOpen,
    globeEl,
  ]);

  const isMobileSize = viewport.width < BREAKPOINTS.desktop;
  const isKeyboardLikelyOpening =
    isMobileSize &&
    window.innerHeight < maxWindowHeightRef.current * 0.85 &&
    window.innerWidth === maxWindowWidthRef.current;

  if (!isKeyboardLikelyOpening) {
    const widthChanged = window.innerWidth !== maxWindowWidthRef.current;
    const heightDrop = maxWindowHeightRef.current - window.innerHeight;
    maxWindowWidthRef.current = window.innerWidth;
    if (widthChanged || heightDrop < 0 || heightDrop > TOOLBAR_HEIGHT_TOLERANCE_PX) {
      maxWindowHeightRef.current = window.innerHeight;
    }
  }

  const panelLayoutWidth =
    isPanelOpen && !isHomeScreen && viewport.width >= BREAKPOINTS.desktop
      ? getDataPanelLayoutWidth(viewport.width)
      : 0;
  const globePanelShift = {
    x: panelLayoutWidth > 0 ? -panelLayoutWidth / 2 : 0,
    y: getKeyboardShift({
      viewport,
      isKeyboardMode,
      isHomeScreen,
      canvasHeight: maxWindowHeightRef.current,
    }),
  };
  const globeWidth = Math.max(320, maxWindowWidthRef.current);
  const globeHeight = maxWindowHeightRef.current;
  // Same canvas size on home and in game: the extra width is symmetric (the
  // wrapper is shifted by -offset), so the globe stays centered either way,
  // and starting a game no longer reallocates the WebGL drawing buffer.
  const homeGlobeOffset =
    !isKeyboardMode && maxWindowWidthRef.current >= 769
      ? Math.round(maxWindowWidthRef.current * 0.14)
      : 0;
  const globeRenderWidth = globeWidth + homeGlobeOffset * 2;

  return {
    zoomLevel,
    cameraPOV,
    maxWindowWidthRef,
    maxWindowHeightRef,
    globeRenderWidth,
    globeHeight,
    homeGlobeOffset,
    globePanelShift,
  };
}
