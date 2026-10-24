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
import { prefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { createZoomHapticTracker, primeHapticsOnUserGesture } from "../../utils/haptics";
import { getCanonicalPosition } from "../../utils/utils";
import {
  animateGlobePov,
  cancelGlobePovTween,
  clampGlobeAltitude,
  frameBoundsAltitude,
  getGlobeMinAltitude,
  GLOBE_MAX_ALTITUDE,
  GLOBE_MIN_ALTITUDE,
  isGlobePovTweenActive,
  readClampedGlobePov,
  REGIONAL_MIN_ALTITUDE,
  setGlobeMinAltitude,
  syncCameraMapProjection,
  syncGlobeCameraAndZoomLimits,
  syncGlobeControlsForAltitude,
} from "../render/globeAltitude";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";
import { CAMERA_MS, cameraDuration, selectCameraDuration } from "./cameraTiming";
import { getHomeDesktopPov } from "./homePov";

const ORBIT_POLE_GUARD_ANGLE = 0.005;
const MAX_GLOBE_PIXEL_RATIO = 2;
const TOOLBAR_HEIGHT_TOLERANCE_PX = 140;
const REGIONAL_PICK_ZOOM = 0.6;

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

export const getKeyboardShift = ({ viewport, isKeyboardMode, isHomeScreen, canvasHeight }) => {
  if (isHomeScreen || !isKeyboardMode || viewport.width >= BREAKPOINTS.mobile) return 0;
  const visibleCenter = (viewport.top || 0) + viewport.height / 2;
  return Math.min(0, Math.round(visibleCenter - canvasHeight / 2));
};

const buildSelectedCountryCameraTarget = (opts) => {
  const { data, viewport, isHomeScreen, isKeyboardMode, customPOV } = opts;
  const { hasPreviousSelection, currentPOV, canonicalPositions = {} } = opts;
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
  const occlusionRatio = isKeyboardOpen ? 0 : isMobile ? 0.15 : 0;
  const latOffset = isHomeScreen ? 0 : -36 * preservedAltitude * (occlusionRatio * 0.7);

  const isAntarctica =
    data?.iso2 === "AQ" || data?.admin === "Antarctica" || (useLat && useLat <= -80);
  const targetLat = isAntarctica ? -85 : (useLat ?? 0) + latOffset;
  const targetLng =
    isAntarctica && currentPOV && Number.isFinite(currentPOV.lng) ? currentPOV.lng : (useLng ?? 0);
  const antarcticaAltitude = isHomeScreen ? (isMobile ? 2.0 : 1.5) : isMobile ? 1.7 : 1.35;

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
  const reduced = prefersReducedMotion();
  if (isEndScreen) {
    animateGlobePov(
      globeEl.current,
      customPOV || { lat: 20, lng: 0, altitude: viewport.width < BREAKPOINTS.mobile ? 2.2 : 1.8 },
      cameraDuration(CAMERA_MS.endScreen, reduced)
    );
    return;
  }
  if (isHomeScreen) {
    const isMobile = viewport.width < BREAKPOINTS.mobile;
    const targetPov = isMobile ? { lat: 18, lng: 20, altitude: 2.2 } : getHomeDesktopPov(viewport);
    animateGlobePov(globeEl.current, targetPov, cameraDuration(CAMERA_MS.home, reduced));
    return;
  }
  if (customPOV) {
    const ms = wasHomeScreen ? CAMERA_MS.gameStart : CAMERA_MS.customPov;
    animateGlobePov(globeEl.current, customPOV, cameraDuration(ms, reduced));
    return;
  }
  if (wasHomeScreen) {
    const startView = getRandomGameStartView();
    const alt = viewport.width < BREAKPOINTS.mobile ? 1.8 : 1.35;
    animateGlobePov(
      globeEl.current,
      { ...startView, altitude: alt },
      cameraDuration(CAMERA_MS.gameStart, reduced)
    );
  }
};

const readGlobeAltitude = (globe) => {
  try {
    return globe?.pointOfView?.()?.altitude;
  } catch {
    return undefined;
  }
};

const createOrbitControlHandlers = (ctx) => {
  const { globeEl, controls, isInteractingRef, isMobileRef, isRegionalMapRef } = ctx;
  const { isHomeScreen, setZoomLevel, setCameraPOV, zoomHapticTracker } = ctx;
  const changeHandler = () => {
    const currentAlt = readGlobeAltitude(globeEl.current);
    syncGlobeControlsForAltitude(controls, currentAlt, {
      isMobile: isMobileRef.current,
      isRegionalMap: isRegionalMapRef.current,
    });
    syncCameraMapProjection(globeEl.current, currentAlt);
    if (zoomHapticTracker && isInteractingRef.current && !isGlobePovTweenActive()) {
      zoomHapticTracker.onAltitudeChange(currentAlt, {
        minAltitude: getGlobeMinAltitude(),
        maxAltitude: GLOBE_MAX_ALTITUDE,
      });
    }
    if (isInteractingRef.current) return;
    const pov = readClampedGlobePov(globeEl.current);
    if (!pov) return;
    setZoomLevel((prev) => (Math.abs(prev - pov.altitude) > 0.08 ? pov.altitude : prev));
    setCameraPOV((prev) => {
      const threshold = isHomeScreen ? 15 : 10;
      return Math.abs(prev.lat - pov.lat) > threshold || Math.abs(prev.lng - pov.lng) > threshold
        ? { lat: pov.lat, lng: pov.lng }
        : prev;
    });
  };

  const startHandler = () => {
    isInteractingRef.current = true;
    cancelGlobePovTween(globeEl.current);
  };

  const endHandler = () => {
    isInteractingRef.current = false;
    zoomHapticTracker?.clearZoomGesture();
    const pov = readClampedGlobePov(globeEl.current);
    if (!pov) return;
    setZoomLevel(pov.altitude);
    setCameraPOV((prev) =>
      prev.lat === pov.lat && prev.lng === pov.lng ? prev : { lat: pov.lat, lng: pov.lng }
    );
  };

  return { changeHandler, startHandler, endHandler };
};

export function useGlobeCamera(props) {
  const { globeEl, selectedCountry, shouldAutoRotate, viewport, isHomeScreen } = props;
  const { isKeyboardMode, isEndScreen, learnSubMode, gameDataMap, perfProfile } = props;
  const { isPanelOpen = false, mode = "countries" } = props;
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [cameraPOV, setCameraPOV] = useState({ lat: 0, lng: 0 });

  const lastTargetRef = useRef(null),
    wasHomeScreenRef = useRef(isHomeScreen);
  const isInteractingRef = useRef(false),
    isRegionalMapRef = useRef(false);
  const maxWindowWidthRef = useRef(window.innerWidth),
    maxWindowHeightRef = useRef(window.innerHeight);
  const previousSelectedCountryRef = useRef(null),
    previousModeKeyRef = useRef(null);
  const isRegionalMap = Boolean(getActiveModeConfig(mode, learnSubMode)?.bounds);
  isRegionalMapRef.current = isRegionalMap;
  const isMobileRef = useRef(false);
  isMobileRef.current = Boolean(perfProfile?.isMobile);
  const zoomHapticTrackerRef = useRef(null);
  zoomHapticTrackerRef.current ||= createZoomHapticTracker();

  useEffect(() => {
    setGlobeMinAltitude(isRegionalMap ? REGIONAL_MIN_ALTITUDE : GLOBE_MIN_ALTITUDE);
    const controls = globeEl.current?.controls?.();
    if (!controls) return;
    syncGlobeCameraAndZoomLimits(globeEl.current, controls);
    syncGlobeControlsForAltitude(controls, readGlobeAltitude(globeEl.current), {
      isMobile: isMobileRef.current,
      isRegionalMap,
    });
    if (!isRegionalMap) readClampedGlobePov(globeEl.current);
  }, [isRegionalMap, globeEl]);

  useEffect(() => {
    let controlsRef = null,
      domRef = null;
    let changeHandler = null,
      startHandler = null,
      endHandler = null;
    let wheelHandler = null,
      touchZoomHandler = null;

    let retryTimer = null;
    const attachControlsAndListeners = (attempt = 0) => {
      if (!globeEl.current) return;
      try {
        const renderer = globeEl.current.renderer?.();
        if (renderer) {
          const pixelRatio = Math.min(perfProfile?.pixelRatio || 1, MAX_GLOBE_PIXEL_RATIO);
          if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
          renderer.sortObjects = true;
          if (import.meta.env.PROD) renderer.debug.checkShaderErrors = false;
          polygonGlitchUniforms.uPixelScale.value =
            GLITCH_EFFECT_SETTINGS.referencePixelRatio / pixelRatio;
        }
        const controls = globeEl.current.controls?.();
        if (controls) {
          controlsRef = controls;
          controls.autoRotate = shouldAutoRotate;
          controls.autoRotateSpeed = 0.3;
          controls.enableZoom = true;
          controls.enableDamping = true;
          controls.dampingFactor = perfProfile?.isMobile ? 0.12 : 0.08;
          controls.minPolarAngle = ORBIT_POLE_GUARD_ANGLE;
          controls.maxPolarAngle = Math.PI - ORBIT_POLE_GUARD_ANGLE;
          syncGlobeCameraAndZoomLimits(globeEl.current, controls);
          syncGlobeControlsForAltitude(controls, readGlobeAltitude(globeEl.current), {
            isMobile: Boolean(perfProfile?.isMobile),
            isRegionalMap: isRegionalMapRef.current,
          });
          const zoomHapticTracker = zoomHapticTrackerRef.current;
          ({ changeHandler, startHandler, endHandler } = createOrbitControlHandlers({
            globeEl,
            controls,
            isInteractingRef,
            isMobileRef,
            isRegionalMapRef,
            isHomeScreen,
            setZoomLevel,
            setCameraPOV,
            zoomHapticTracker,
          }));
          controls.addEventListener("change", changeHandler);
          controls.addEventListener("start", startHandler);
          controls.addEventListener("end", endHandler);
          domRef = controls.domElement || globeEl.current.renderer?.()?.domElement;
          if (domRef?.addEventListener) {
            wheelHandler = (e) => zoomHapticTracker?.onWheelDelta(e?.deltaY);
            touchZoomHandler = (e) => {
              if (e?.type === "touchstart") primeHapticsOnUserGesture();
              const t = e?.touches;
              if ((t?.length ?? 0) >= 2) {
                zoomHapticTracker?.onPinchDistance(
                  Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
                );
              }
            };
            domRef.addEventListener("wheel", wheelHandler, { passive: true });
            domRef.addEventListener("touchstart", touchZoomHandler, { passive: true });
            domRef.addEventListener("touchmove", touchZoomHandler, { passive: true });
          }
          syncGlobeCameraAndZoomLimits(globeEl.current, controlsRef);
        } else if (attempt < 15) {
          retryTimer = setTimeout(() => attachControlsAndListeners(attempt + 1), 60);
        }
      } catch {}
    };
    attachControlsAndListeners(0);

    return () => {
      if (retryTimer != null) clearTimeout(retryTimer);
      try {
        controlsRef?.removeEventListener("change", changeHandler);
        controlsRef?.removeEventListener("start", startHandler);
        controlsRef?.removeEventListener("end", endHandler);
        domRef?.removeEventListener("wheel", wheelHandler);
        domRef?.removeEventListener("touchstart", touchZoomHandler);
        domRef?.removeEventListener("touchmove", touchZoomHandler);
      } catch {}
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
        const currentPOV = globeEl.current.pointOfView();
        const target = buildSelectedCountryCameraTarget({
          ...props,
          data,
          customPOV,
          hasPreviousSelection,
          currentPOV,
        });
        const pt = lastTargetRef.current;
        const targetChanged =
          !pt ||
          Math.abs(pt.lat - target.lat) >= 0.001 ||
          Math.abs(pt.lng - target.lng) >= 0.001 ||
          Math.abs(pt.altitude - target.altitude) >= 0.001;
        const onlyViewportNudge =
          !selectionChanged &&
          pt &&
          previousSelectedCountryRef.current === selectedCountry &&
          targetChanged;

        if (selectionChanged || (onlyViewportNudge && !isInteractingRef.current)) {
          const duration = selectCameraDuration({
            isHomeScreen,
            onlyViewportNudge,
            isMobile: Boolean(perfProfile?.isMobile),
          });
          animateGlobePov(
            globeEl.current,
            target,
            cameraDuration(duration, prefersReducedMotion())
          );
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
