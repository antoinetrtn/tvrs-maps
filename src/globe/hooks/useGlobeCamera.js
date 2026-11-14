import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { getActiveModeConfig } from "../../config/gameConfig";
import { BREAKPOINTS, getDataPanelLayoutWidth } from "../../config/gameConstants";
import { bindCameraTestGlobe } from "../../dev/cameraTestHook";
import { bindSwitchTraceGlobe } from "../../dev/switchTrace";
import { prefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { createZoomHapticTracker, primeHapticsOnUserGesture } from "../../utils/haptics";
import {
  cancelGlobePovTween,
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
import { isHomeCardFlyActive } from "../render/homeCardFly";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";
import { setSelectionOutlineDpr } from "../render/selectionOutline";
import {
  applyIdleCameraPointOfView,
  flyHomeCardCamera,
  getCustomModePointOfView,
  getHomeCardPointOfView,
  getKeyboardShift,
  handleSelectedCountryCamera,
} from "./cameraTargetBuilder";
import { CAMERA_MS, cameraDuration } from "./cameraTiming";

export { getKeyboardShift };

const ORBIT_POLE_GUARD_ANGLE = 0.005;
const MAX_GLOBE_PIXEL_RATIO = 2;
const TOOLBAR_HEIGHT_TOLERANCE_PX = 140;

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
    if (isHomeCardFlyActive()) return;
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
  const { isPanelOpen = false, mode = "countries", cameraMode } = props;
  const modeForCamera = cameraMode ?? mode;
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [cameraPOV, setCameraPOV] = useState({ lat: 0, lng: 0 });

  const lastTargetRef = useRef(null),
    wasHomeScreenRef = useRef(isHomeScreen);
  const isInteractingRef = useRef(false),
    isRegionalMapRef = useRef(false);
  const maxWindowWidthRef = useRef(window.innerWidth),
    maxWindowHeightRef = useRef(window.innerHeight);
  const previousSelectedCountryRef = useRef(null),
    previousModeKeyRef = useRef(null),
    wasRegionalMapRef = useRef(false);
  const isRegionalMap = Boolean(getActiveModeConfig(modeForCamera, learnSubMode)?.bounds);
  isRegionalMapRef.current = isRegionalMap;
  const isMobileRef = useRef(false);
  isMobileRef.current = Boolean(perfProfile?.isMobile);
  const zoomHapticTrackerRef = useRef(null);
  zoomHapticTrackerRef.current ||= createZoomHapticTracker();

  useEffect(() => {
    if (isRegionalMap) {
      setGlobeMinAltitude(REGIONAL_MIN_ALTITUDE);
    } else if (!isGlobePovTweenActive()) {
      setGlobeMinAltitude(GLOBE_MIN_ALTITUDE);
    } else {
      const raiseId = setTimeout(() => setGlobeMinAltitude(GLOBE_MIN_ALTITUDE), CAMERA_MS.home);
      const controls = globeEl.current?.controls?.();
      if (controls) {
        syncGlobeCameraAndZoomLimits(globeEl.current, controls);
        syncGlobeControlsForAltitude(controls, readGlobeAltitude(globeEl.current), {
          isMobile: isMobileRef.current,
          isRegionalMap,
        });
      }
      return () => clearTimeout(raiseId);
    }
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
          setSelectionOutlineDpr(pixelRatio);
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

  const homeModeFlyUntilRef = useRef(0);
  const isHomeModeFlyActive = () =>
    homeModeFlyUntilRef.current >
    (typeof performance !== "undefined" ? performance.now() : Date.now());

  // Layout effect so a home card click starts the camera fly before paint / layer work.
  useLayoutEffect(() => {
    if (globeEl.current) {
      bindCameraTestGlobe(globeEl.current);
      bindSwitchTraceGlobe(globeEl.current);
    }
    const selectionChanged = selectedCountry !== previousSelectedCountryRef.current;
    const customPOV = getCustomModePointOfView(modeForCamera, learnSubMode, viewport, isPanelOpen);
    const modeKey = `${modeForCamera}|${learnSubMode}`;
    const prevKey = previousModeKeyRef.current;
    const modeChanged = prevKey !== modeKey;
    const isInitial = prevKey == null;
    previousModeKeyRef.current = modeKey;
    const isEnteringHomeFromGame = isHomeScreen && !wasHomeScreenRef.current;
    const reduced = prefersReducedMotion();
    const camMs = (ms) => cameraDuration(ms, reduced);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();

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
    } else if (isHomeScreen && modeChanged && !isInitial && globeEl.current) {
      const targetIsRegional = Boolean(getActiveModeConfig(modeForCamera, learnSubMode)?.bounds);
      // Lower the zoom floor before computing the target so France/USA altitudes are not clamped.
      if (targetIsRegional) setGlobeMinAltitude(REGIONAL_MIN_ALTITUDE);
      const target = getHomeCardPointOfView({
        mode: modeForCamera,
        learnSubMode,
        viewport,
        isPanelOpen,
      });
      const ms = camMs(CAMERA_MS.home);
      flyHomeCardCamera(globeEl.current, target, ms);
      lastTargetRef.current = target;
      homeModeFlyUntilRef.current = now + ms;
      if (ms > 0) {
        window.setTimeout(() => {
          const pov = readClampedGlobePov(globeEl.current);
          if (!pov) return;
          setZoomLevel(pov.altitude);
          setCameraPOV({ lat: pov.lat, lng: pov.lng });
        }, ms);
      }
    } else if (selectedCountry && globeEl.current && !isHomeModeFlyActive()) {
      handleSelectedCountryCamera({
        globeEl,
        selectedCountry,
        previousSelectedCountry: previousSelectedCountryRef.current,
        gameDataMap,
        customPOV,
        selectionChanged,
        props,
        lastTargetRef,
        isInteractingRef,
        isHomeScreen,
        perfProfile,
        camMs,
      });
    } else if (
      (selectionChanged || modeChanged || isHomeScreen !== wasHomeScreenRef.current) &&
      globeEl.current &&
      !isHomeModeFlyActive()
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
    wasRegionalMapRef.current = isRegionalMap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCountry,
    viewport.width,
    isHomeScreen,
    perfProfile,
    isKeyboardMode,
    isEndScreen,
    gameDataMap,
    mode,
    cameraMode,
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
