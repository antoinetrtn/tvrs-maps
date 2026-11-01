import { useCallback, useMemo, useRef } from "react";

import { getLearnLabelLimit, getPlayVisibleCountryKeys } from "../../config/gameConfig";
import { countryDataMap } from "../../data/gameData";
import { getCanonicalPosition, getFlagEmoji, getLabelRenderRadius } from "../../utils/utils";
import { createGlobeLabelElement } from "../render/globeLabelBuilder";

function getLabelVisibilityThreshold({
  isDepartmentMode,
  isLearnMode,
  isSelected,
  isHomeScreen,
  isRivMount,
  size,
}) {
  if (isDepartmentMode) return 1.05;
  if (isSelected) return 10;
  if (isHomeScreen) return 1.8;
  if (isRivMount) return 2.5;
  if (isLearnMode) return Math.min(2.1, 0.55 + size * 1.4);
  return Math.min(3.0, 0.8 + size * 2.0);
}

function getLabelRadius({ isDepartmentMode, isLearnMode, zoomLevel, isMobile }) {
  if (isDepartmentMode) {
    return isLearnMode
      ? Math.max(8, 16 / Math.max(0.35, zoomLevel))
      : Math.max(10, 22 / Math.max(0.18, zoomLevel));
  }
  if (isLearnMode) {
    return getLabelRenderRadius(zoomLevel, isMobile) * 0.62;
  }
  return getLabelRenderRadius(zoomLevel, isMobile);
}

const LEARN_SUBMODE_NAMES = {
  capitals: "capitals",
  us_states: "us_states",
  departments: "departments",
};

function getLearnModeName(learnSubMode) {
  if (learnSubMode && Object.hasOwn(LEARN_SUBMODE_NAMES, learnSubMode)) {
    return LEARN_SUBMODE_NAMES[learnSubMode];
  }
  return "countries";
}

function getLabelCoords(data, key, ctxCanonical) {
  const canonical = ctxCanonical[key] || getCanonicalPosition(data, null);
  const lat =
    data.lat !== undefined && data.lat !== null ? data.lat : canonical ? canonical.lat : 0;
  const lng =
    data.lng !== undefined && data.lng !== null ? data.lng : canonical ? canonical.lng : 0;
  return { lat, lng };
}

function getCenterDistance(lat, lng, pov) {
  let dLng = Math.abs(lng - pov.lng);
  if (dLng > 180) dLng = 360 - dLng;
  return Math.hypot(dLng, lat - pov.lat);
}

function isCachedLabelMatch(
  cached,
  isSelected,
  lang,
  isFound,
  mode,
  modeName,
  learnShowCapitals,
  hideCountryLine,
  isError,
  isPanelOpen
) {
  if (!cached) return false;
  return (
    cached.isSelected === isSelected &&
    cached.lang === lang &&
    cached.isFound === isFound &&
    cached.globalMode === mode &&
    cached.mode === modeName &&
    cached.learnShowCapitals === learnShowCapitals &&
    cached.hideCountryLine === hideCountryLine &&
    cached.isError === (isSelected && isError) &&
    cached.isPanelOpen === isPanelOpen
  );
}

function buildNewLabel({
  key,
  data,
  useLat,
  useLng,
  lang,
  size,
  distToCenter,
  isSelected,
  isFound,
  isError,
  mode,
  modeName,
  learnShowCapitals,
  hideCountryLine,
  isPanelOpen,
}) {
  return {
    admin: key,
    lat: useLat,
    lng: useLng,
    country: lang === "fr" ? data.name_fr || key : data.name_en || key,
    capital: lang === "fr" ? data.capital_fr || data.capital : data.capital,
    region: data.region,
    flag: getFlagEmoji(data.iso2),
    iso2: data.iso2,
    code: data.code,
    size,
    distToCenter,
    isSelected,
    isFound,
    isError: isSelected && isError,
    globalMode: mode,
    mode: modeName,
    learnShowCapitals,
    hideCountryLine,
    lang,
    isPanelOpen,
  };
}

function collectHomeScreenLabels(selectedCountry, gameDataMap, mode) {
  if (!selectedCountry) return [];
  return [
    {
      key: selectedCountry,
      data: gameDataMap[selectedCountry] || countryDataMap[selectedCountry],
      modeName: mode,
    },
  ];
}

function collectDepartmentLabels(getLabelSourceKeys, gameDataMap, mode, learnSubMode) {
  const modeName =
    mode === "us_states" || learnSubMode === "us_states" ? "us_states" : "departments";
  return getLabelSourceKeys().map((k) => ({
    key: k,
    data: gameDataMap[k],
    modeName,
  }));
}

function collectRiverMountainLabels(getLabelSourceKeys, gameDataMap) {
  return getLabelSourceKeys().map((k) => ({
    key: k,
    data: gameDataMap[k],
    modeName: "rivers_mountains",
  }));
}

function collectLearnLabels(getLabelSourceKeys, gameDataMap, learnSubMode) {
  const modeName = getLearnModeName(learnSubMode);
  const hideCountryLine = learnSubMode === "capitals";
  return getLabelSourceKeys().map((k) => ({
    key: k,
    data: gameDataMap[k],
    modeName,
    hideCountryLine,
  }));
}

function collectStandardPlayLabels(isEndScreen, selectedCountry, foundList, mode) {
  const keys = isEndScreen
    ? Object.keys(countryDataMap)
    : getPlayVisibleCountryKeys(selectedCountry, foundList);
  return keys.map((k) => ({
    key: k,
    data: countryDataMap[k],
    modeName: mode,
  }));
}

function collectLabelsToProcess({
  isHomeScreen,
  isDepartmentMode,
  isRiversMountainsMode,
  mode,
  learnSubMode,
  selectedCountry,
  gameDataMap,
  getLabelSourceKeys,
  isEndScreen,
  foundList,
}) {
  if (isHomeScreen) {
    return collectHomeScreenLabels(selectedCountry, gameDataMap, mode);
  }
  if (isDepartmentMode) {
    return collectDepartmentLabels(getLabelSourceKeys, gameDataMap, mode, learnSubMode);
  }
  if (isRiversMountainsMode) {
    return collectRiverMountainLabels(getLabelSourceKeys, gameDataMap);
  }
  if (mode === "learn") {
    return collectLearnLabels(getLabelSourceKeys, gameDataMap, learnSubMode);
  }
  return collectStandardPlayLabels(isEndScreen, selectedCountry, foundList, mode);
}

function sliceLabelsToLimit(filtered, mode, isDepartmentMode, perfProfile) {
  if (mode === "learn") {
    return filtered.slice(0, getLearnLabelLimit(perfProfile));
  }
  if (isDepartmentMode) {
    const limit = perfProfile?.isMobile ? 28 : 56;
    return filtered.slice(0, limit);
  }
  return perfProfile?.maxLabels ? filtered.slice(0, perfProfile.maxLabels) : filtered;
}

function sortLabels(a, b) {
  if (a.isSelected) return -1;
  if (b.isSelected) return 1;
  return a.distToCenter - b.distToCenter;
}

function resolveLabelEntry({ key, data, modeName, hideCountryLine = false }, ctx) {
  if (!data) return null;

  const {
    mode,
    selectedCountry,
    foundSet,
    countrySizes,
    isHomeScreen,
    isEndScreen,
    isDepartmentMode,
    zoomLevel,
    pov,
    perfProfile,
    lang,
    isError,
    isPanelOpen,
    labelsCacheRef,
    canonicalPositions: ctxCanonical = {},
  } = ctx;

  const isSelected = key === selectedCountry;
  const isFound = foundSet.has(key);
  const size = countrySizes[key] || 0.5;
  const isPlayMode = mode !== "learn" && !isHomeScreen && !isEndScreen;
  if (isPlayMode && !isFound && !isSelected) return null;

  const isRivMount = modeName === "rivers_mountains";
  const isLearnMode = mode === "learn";
  const visibilityThreshold = getLabelVisibilityThreshold({
    isDepartmentMode,
    isLearnMode,
    isSelected,
    isHomeScreen,
    isRivMount,
    size,
  });
  if (zoomLevel > visibilityThreshold) return null;

  const { lat: useLat, lng: useLng } = getLabelCoords(data, key, ctxCanonical);
  const distToCenter = getCenterDistance(useLat, useLng, pov);

  const labelRadius = getLabelRadius({
    isDepartmentMode,
    isLearnMode,
    zoomLevel,
    isMobile: Boolean(perfProfile?.isMobile),
  });
  if (!isSelected && distToCenter > labelRadius) return null;

  const learnShowCapitals = modeName === "capitals";
  const cacheKey = `${key}_${modeName}`;
  const cached = labelsCacheRef.current[cacheKey];
  if (
    isCachedLabelMatch(
      cached,
      isSelected,
      lang,
      isFound,
      mode,
      modeName,
      learnShowCapitals,
      hideCountryLine,
      isError,
      isPanelOpen
    )
  ) {
    cached.distToCenter = distToCenter;
    return cached;
  }

  const newLabel = buildNewLabel({
    key,
    data,
    useLat,
    useLng,
    lang,
    size,
    distToCenter,
    isSelected,
    isFound,
    isError,
    mode,
    modeName,
    learnShowCapitals,
    hideCountryLine,
    isPanelOpen,
  });
  labelsCacheRef.current[cacheKey] = newLabel;
  return newLabel;
}

export function useGlobeLabels({
  mode,
  isHomeScreen,
  isEndScreen,
  isDepartmentMode,
  isRiversMountainsMode,
  selectedCountry,
  foundSet,
  foundList,
  cameraPOV,
  zoomLevel,
  perfProfile,
  gameDataMap,
  learnSubMode,
  countrySizes,
  lang,
  isError,
  REGION_COLORS_LABELS,
  UI_COLORS,
  t,
  globeEl,
  isPanelOpen = false,
  canonicalPositions = {},
}) {
  const labelsCacheRef = useRef({});
  const labelSourceKeysRef = useRef({ map: null, keys: [] });

  const getLabelSourceKeys = () => {
    if (labelSourceKeysRef.current.map === gameDataMap) {
      return labelSourceKeysRef.current.keys;
    }
    const keys = Object.keys(gameDataMap);
    labelSourceKeysRef.current = { map: gameDataMap, keys };
    return keys;
  };

  const labelsData = useMemo(() => {
    if (perfProfile?.maxLabels === 0 || !globeEl.current) return [];

    const labelsToProcess = collectLabelsToProcess({
      isHomeScreen,
      isDepartmentMode,
      isRiversMountainsMode,
      mode,
      learnSubMode,
      selectedCountry,
      gameDataMap,
      getLabelSourceKeys,
      isEndScreen,
      foundList,
    });

    const labelCtx = {
      mode,
      selectedCountry,
      foundSet,
      countrySizes,
      isHomeScreen,
      isEndScreen,
      isDepartmentMode,
      zoomLevel,
      pov: cameraPOV,
      perfProfile,
      lang,
      isError,
      isPanelOpen,
      labelsCacheRef,
      canonicalPositions,
    };

    const filtered = labelsToProcess
      .map((entry) => resolveLabelEntry(entry, labelCtx))
      .filter((d) => d !== null)
      .sort(sortLabels);

    return sliceLabelsToLimit(filtered, mode, isDepartmentMode, perfProfile);
  }, [
    foundList,
    countrySizes,
    zoomLevel,
    cameraPOV,
    cameraPOV?.lat,
    cameraPOV?.lng,
    lang,
    perfProfile?.maxLabels,
    perfProfile?.isMobile,
    mode,
    selectedCountry,
    isHomeScreen,
    isEndScreen,
    isDepartmentMode,
    isRiversMountainsMode,
    gameDataMap,
    foundSet,
    learnSubMode,
    isError,
    globeEl,
    isPanelOpen,
  ]);

  const createLabelElement = useCallback(
    (d) => {
      return createGlobeLabelElement(d, {
        REGION_COLORS_LABELS,
        UI_COLORS,
        isHomeScreen,
        isEndScreen,
        gameDataMap,
        mode,
        t,
        isPanelOpen,
      });
    },
    [REGION_COLORS_LABELS, UI_COLORS, isHomeScreen, isEndScreen, gameDataMap, mode, t, isPanelOpen]
  );

  const getHtmlAltitude = useCallback(
    (d) => {
      if (selectedCountry && d.admin === selectedCountry) return 0.0085;
      return 0.002;
    },
    [selectedCountry]
  );

  return {
    labelsData,
    createLabelElement,
    getHtmlAltitude,
  };
}
