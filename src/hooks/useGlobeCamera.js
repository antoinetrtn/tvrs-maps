import { useEffect, useRef, useState } from "react";

import { GLITCH_EFFECT_SETTINGS } from "../config/designSystem";
import { getActiveModeConfig } from "../config/gameConfig";
import {
  BREAKPOINTS,
  GAME_START_VIEW_JITTER_DEG,
  GAME_START_VIEWPOINTS,
  getDataPanelLayoutWidth,
} from "../config/gameConstants";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { readClampedGlobePov, syncGlobeCameraAndZoomLimits } from "../utils/globeAltitude";
import { polygonGlitchUniforms } from "../utils/polygonGlitchShader";
import { getCanonicalPosition } from "../utils/utils";

const ORBIT_POLE_GUARD_ANGLE = 0.03;

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
    ? isMobile
      ? 2.0
      : 1.25
    : customPOV
      ? customModeAltitude
      : isMobile
        ? 1.8
        : 0.68;
  const preservedAltitude =
    currentPOV && Number.isFinite(currentPOV.altitude) ? currentPOV.altitude : fallbackAltitude;
  const isKeyboardOpen = isMobile && isKeyboardMode;
  const keyboardHeight = Math.max(0, maxWindowHeight - viewport.height);
  const keyboardRatio = keyboardHeight / maxWindowHeight;
  const bottomHUDRatio = isMobile ? 0.15 : 0;
  const occlusionRatio = isKeyboardOpen ? keyboardRatio : bottomHUDRatio;
  const visibleHeightDegrees = 36 * preservedAltitude;
  const latOffset = isHomeScreen ? 0 : -visibleHeightDegrees * (occlusionRatio * 0.7);

  return {
    lat: (useLat ?? 0) + latOffset,
    lng: useLng ?? 0,
    altitude: hasPreviousSelection
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
    const overviewAltitude = viewport.width < 768 ? 2.5 : 1;
    if (!wasHomeScreen) {
      const currentPOV = globeEl.current.pointOfView();
      globeEl.current.pointOfView(
        { lat: 18, lng: currentPOV?.lng ?? 20, altitude: overviewAltitude },
        1000
      );
    } else {
      globeEl.current.pointOfView({ altitude: overviewAltitude }, 1000);
    }
    return;
  }

  if (customPOV) {
    globeEl.current.pointOfView(customPOV, wasHomeScreen ? 1100 : 700);
    return;
  }

  if (wasHomeScreen) {
    const startView = getRandomGameStartView();
    globeEl.current.pointOfView(
      {
        lat: startView.lat,
        lng: startView.lng,
        altitude: viewport.width < BREAKPOINTS.mobile ? 1.8 : 1.35,
      },
      700
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
  selectionTransition,
  canonicalPositions = {},
}) {
  const {
    transitioningPreviousCountryRef,
    transitioningIncomingCountryRef,
    selectionTransitionStartRef,
  } = selectionTransition.refs;
  const { setTransitioningPreviousCountryState, setTransitioningIncomingCountryState } =
    selectionTransition.setters;
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
          // of the device's capped pixel ratio (mobile 1.25 vs desktop 2.0).
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

    if (selectedCountry && globeEl.current) {
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
          const duration = isHomeScreen
            ? 1800
            : onlyViewportNudge
              ? 180
              : perfProfile?.isMobile
                ? 320
                : 420;
          globeEl.current.pointOfView(target, duration);
          lastTargetRef.current = target;
        }
      }
    } else if (selectionChanged && globeEl.current) {
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

    if (selectionChanged) {
      if (mode !== "learn") {
        transitioningPreviousCountryRef.current = previousSelectedCountryRef.current;
        setTransitioningPreviousCountryState(previousSelectedCountryRef.current);
      } else {
        transitioningPreviousCountryRef.current = null;
        setTransitioningPreviousCountryState(null);
      }
      transitioningIncomingCountryRef.current = null;
      setTransitioningIncomingCountryState(null);
      selectionTransitionStartRef.current = performance.now();
    }

    wasHomeScreenRef.current = isHomeScreen;
    previousSelectedCountryRef.current = selectedCountry;
  }, [
    selectedCountry,
    viewport.width,
    viewport.height,
    viewport.top,
    isHomeScreen,
    perfProfile,
    isKeyboardMode,
    isEndScreen,
    gameDataMap,
    mode,
    learnSubMode,
    globeEl,
    setTransitioningPreviousCountryState,
    setTransitioningIncomingCountryState,
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

  // Ensure reliable home overview camera + right-side positioning (for left UI card) when returning to accueil on desktop.
  // This recovers the movement animation and visual composition if the main selected effect didn't trigger it.
  useEffect(() => {
    if (isHomeScreen && globeEl.current) {
      const overviewAltitude = viewport.width < BREAKPOINTS.mobile ? 2.5 : 1.1;
      // Slight positive lng to bias the view nicely with left-padded UI (globe "on the right").
      globeEl.current.pointOfView({ lat: 16, lng: 28, altitude: overviewAltitude }, 950);
    }
  }, [isHomeScreen, globeEl, viewport.width]);

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
