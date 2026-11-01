import { getActiveModeConfig } from "../../config/gameConfig";
import {
  BREAKPOINTS,
  GAME_START_VIEW_JITTER_DEG,
  GAME_START_VIEWPOINTS,
} from "../../config/gameConstants";
import { countryDataMap } from "../../data/gameData";
import { riversMountainsDataMap } from "../../data/riversMountainsData";
import { prefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { getCanonicalPosition } from "../../utils/utils";
import { animateGlobePov, clampGlobeAltitude, frameBoundsAltitude } from "../render/globeAltitude";
import { CAMERA_MS, cameraDuration, selectCameraDuration } from "./cameraTiming";
import { getHomeDesktopPov } from "./homePov";

const REGIONAL_PICK_ZOOM = 0.6;

const getRandomGameStartView = () => {
  const base = GAME_START_VIEWPOINTS[Math.floor(Math.random() * GAME_START_VIEWPOINTS.length)];
  const jitter = () => (Math.random() * 2 - 1) * GAME_START_VIEW_JITTER_DEG;
  return { lat: base.lat + jitter(), lng: base.lng + jitter() };
};

export const getCustomModePointOfView = (mode, learnSubMode, viewport, isPanelOpen) => {
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

function resolveTargetCoordinates({
  data,
  canonical,
  currentPOV,
  preservedAltitude,
  isMobile,
  isKeyboardMode,
  isHomeScreen,
}) {
  const useLat = canonical ? canonical.lat : data?.lat;
  const useLng = canonical ? canonical.lng : data?.lng;
  const isKeyboardOpen = isMobile && isKeyboardMode;
  const occlusionRatio = !isKeyboardOpen && isMobile ? 0.15 : 0;
  const latOffset = isHomeScreen ? 0 : -36 * preservedAltitude * (occlusionRatio * 0.7);

  const isAntarctica =
    data?.iso2 === "AQ" || data?.admin === "Antarctica" || (useLat && useLat <= -80);
  const targetLat = isAntarctica ? -85 : (useLat ?? 0) + latOffset;
  const targetLng =
    isAntarctica && currentPOV && Number.isFinite(currentPOV.lng) ? currentPOV.lng : (useLng ?? 0);

  return { targetLat, targetLng, isAntarctica };
}

function resolveTargetAltitude({
  isAntarctica,
  customPOV,
  isHomeScreen,
  isMobile,
  preservedAltitude,
  fallbackAltitude,
  hasPreviousSelection,
}) {
  let antarcticaAltitude = 1.35;
  if (isHomeScreen) {
    antarcticaAltitude = isMobile ? 2.0 : 1.5;
  } else if (isMobile) {
    antarcticaAltitude = 1.7;
  }

  if (customPOV && !isAntarctica) {
    if (isHomeScreen) {
      return customPOV.altitude;
    }
    const zoomMultiplier = hasPreviousSelection ? REGIONAL_PICK_ZOOM : 1;
    return clampGlobeAltitude(Math.min(preservedAltitude, customPOV.altitude * zoomMultiplier));
  }

  if (isAntarctica) {
    return antarcticaAltitude;
  }
  if (!hasPreviousSelection) {
    return Math.min(preservedAltitude, fallbackAltitude);
  }
  return isHomeScreen ? fallbackAltitude : preservedAltitude;
}

function resolveDefaultTargetAltitude(isHomeScreen, isMobile) {
  if (isHomeScreen) {
    return isMobile ? 2.0 : 1.25;
  }
  return isMobile ? 1.8 : 0.68;
}

const buildSelectedCountryCameraTarget = (opts) => {
  const { data, viewport, isHomeScreen, isKeyboardMode, customPOV } = opts;
  const { hasPreviousSelection, currentPOV, canonicalPositions = {} } = opts;
  const canonical = canonicalPositions[data?.admin] || getCanonicalPosition(data || {});

  const isMobile = viewport.width < BREAKPOINTS.mobile;
  const customModeAltitude = customPOV ? customPOV.altitude : null;
  const defaultAltitude = resolveDefaultTargetAltitude(isHomeScreen, isMobile);
  const fallbackAltitude = customModeAltitude ?? defaultAltitude;
  const preservedAltitude =
    currentPOV && Number.isFinite(currentPOV.altitude) ? currentPOV.altitude : fallbackAltitude;

  const { targetLat, targetLng, isAntarctica } = resolveTargetCoordinates({
    data,
    canonical,
    currentPOV,
    preservedAltitude,
    isMobile,
    isKeyboardMode,
    isHomeScreen,
  });

  const altitude = resolveTargetAltitude({
    isAntarctica,
    customPOV,
    isHomeScreen,
    isMobile,
    preservedAltitude,
    fallbackAltitude,
    hasPreviousSelection,
  });

  return {
    lat: targetLat,
    lng: targetLng,
    altitude,
  };
};

export const applyIdleCameraPointOfView = ({
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
  if (customPOV) {
    const ms = wasHomeScreen && !isHomeScreen ? CAMERA_MS.gameStart : CAMERA_MS.customPov;
    animateGlobePov(globeEl.current, customPOV, cameraDuration(ms, reduced));
    return;
  }
  if (isHomeScreen) {
    const isMobile = viewport.width < BREAKPOINTS.mobile;
    const targetPov = isMobile ? { lat: 18, lng: 20, altitude: 2.2 } : getHomeDesktopPov(viewport);
    animateGlobePov(globeEl.current, targetPov, cameraDuration(CAMERA_MS.home, reduced));
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

export function handleSelectedCountryCamera({
  globeEl,
  selectedCountry,
  previousSelectedCountry,
  gameDataMap,
  customPOV,
  selectionChanged,
  props,
  lastTargetRef,
  isInteractingRef,
  isHomeScreen,
  perfProfile,
  camMs,
}) {
  const data =
    gameDataMap[selectedCountry] ||
    (customPOV ? null : countryDataMap[selectedCountry] || riversMountainsDataMap[selectedCountry]);

  if (data?.lat !== undefined) {
    const hasPreviousSelection = Boolean(previousSelectedCountry);
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
      !selectionChanged && pt && previousSelectedCountry === selectedCountry && targetChanged;

    if (selectionChanged || (onlyViewportNudge && !isInteractingRef.current)) {
      const duration = selectCameraDuration({
        isHomeScreen,
        onlyViewportNudge,
        isMobile: Boolean(perfProfile?.isMobile),
      });
      animateGlobePov(globeEl.current, target, camMs(duration));
      lastTargetRef.current = target;
    }
  } else if (customPOV) {
    animateGlobePov(globeEl.current, customPOV, camMs(CAMERA_MS.customPov));
    lastTargetRef.current = customPOV;
  }
}
