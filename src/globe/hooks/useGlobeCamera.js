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
import { readClampedGlobePov, syncGlobeCameraAndZoomLimits } from "../render/globeAltitude";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";

const ORBIT_POLE_GUARD_ANGLE = 0.005;

// A new run lands on a random region anchor (jittered) instead of always the
// same Europe-facing view.
const getRandomGameStartView = () => {
  const base = GAME_START_VIEWPOINTS[Math.floor(Math.random() * GAME_START_VIEWPOINTS.length)];
  const jitter = () => (Math.random() * 2 - 1) * GAME_START_VIEW_JITTER_DEG;
  return { lat: base.lat + jitter(), lng: base.lng + jitter() };
};

const getCustomModePointOfView = (mode, learnSubMode, width) => {
  const config = getActiveModeConfig(mode, learnSubMode);
  if (config && config.viewPoint) {
    const isMobile = width < BREAKPOINTS.mobile;
    return {
      lat: config.viewPoint.lat,
      lng: config.viewPoint.lng,
      altitude: isMobile ? config.viewPoint.altitude.mobile : config.viewPoint.altitude.desktop,
    };
  }
  return null;
};

const buildSelectedCountryCameraTarget = ({
  data,
  viewport,
  isHomeScreen,
  isKeyboardMode,
  customPOV,
  hasPreviousSelection,
  currentPOV,
  maxWindowHeight,
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
  const keyboardHeight = Math.max(0, maxWindowHeight - viewport.height);
  const keyboardRatio = keyboardHeight / maxWindowHeight;
  const bottomHUDRatio = isMobile ? 0.15 : 0;
  const occlusionRatio = isKeyboardOpen ? keyboardRatio : bottomHUDRatio;
  const visibleHeightDegrees = 36 * preservedAltitude;
  const latOffset = isHomeScreen ? 0 : -visibleHeightDegrees * (occlusionRatio * 0.7);

  // Antarctica special handling: place target over South Pole cap with wider altitude
  const isAntarctica =
    data?.iso2 === "AQ" || data?.admin === "Antarctica" || (useLat && useLat <= -80);
  const targetLat = isAntarctica ? -85 : (useLat ?? 0) + latOffset;
  const targetLng =
    isAntarctica && currentPOV && Number.isFinite(currentPOV.lng) ? currentPOV.lng : (useLng ?? 0);
  const antarcticaAltitude = isHomeScreen ? (isMobile ? 2.0 : 1.5) : isMobile ? 1.7 : 1.35;

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

  useEffect(() => {
    let controlsReference = null;
    let changeHandler = null;
    let startHandler = null;
    let endHandler = null;

    if (globeEl.current) {
      try {
        const renderer = globeEl.current.renderer();
        if (renderer) {
          const pixelRatio = perfProfile?.pixelRatio || 1;
          renderer.setPixelRatio(pixelRatio);
          renderer.sortObjects = true;
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
          controls.zoomToCursor = false;
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
            setCameraPOV({ lat: pov.lat, lng: pov.lng });
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
    const customPOV = getCustomModePointOfView(mode, learnSubMode, viewport.width);
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
          maxWindowHeight: maxWindowHeightRef.current,
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
    } else if ((selectionChanged || isHomeScreen !== wasHomeScreenRef.current) && globeEl.current) {
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
    globeEl,
  ]);

  const isMobileSize = viewport.width < BREAKPOINTS.desktop;
  const isKeyboardLikelyOpening =
    isMobileSize &&
    window.innerHeight < maxWindowHeightRef.current * 0.85 &&
    window.innerWidth === maxWindowWidthRef.current;

  if (!isKeyboardLikelyOpening) {
    maxWindowWidthRef.current = window.innerWidth;
    maxWindowHeightRef.current = window.innerHeight;
  }

  const panelLayoutWidth =
    isPanelOpen && !isHomeScreen && viewport.width >= BREAKPOINTS.desktop
      ? getDataPanelLayoutWidth(viewport.width)
      : 0;
  const globePanelShift = panelLayoutWidth > 0 ? -panelLayoutWidth / 2 : 0;
  const globeWidth = Math.max(320, maxWindowWidthRef.current);
  const globeHeight = maxWindowHeightRef.current;
  const homeGlobeOffset =
    isHomeScreen && !isKeyboardMode && maxWindowWidthRef.current >= 769
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
