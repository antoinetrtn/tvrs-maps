import { useMemo, useCallback, useRef } from "react";
import { countryDataMap } from "../data/gameData";
import { createGlobeLabelElement } from "../utils/globeLabelBuilder";
import {
  getLearnLabelLimit,
  getPlayVisibleCountryKeys,
} from "../config/gameConfig";
import {
  getFlagEmoji,
  getLabelRenderRadius,
} from "../utils/utils";

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

function getLabelRadius({
  isDepartmentMode,
  isLearnMode,
  zoomLevel,
  isMobile,
}) {
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

function resolveLabelEntry(
  { key, data, modeName, hideCountryLine = false },
  ctx,
) {
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

  let dLng = Math.abs(data.lng - pov.lng);
  if (dLng > 180) dLng = 360 - dLng;
  const distToCenter = Math.hypot(dLng, data.lat - pov.lat);

  const labelRadius = getLabelRadius({
    isDepartmentMode,
    isLearnMode,
    zoomLevel,
    isMobile: !!perfProfile?.isMobile,
  });
  if (!isSelected && distToCenter > labelRadius) return null;

  const learnShowCapitals = modeName === "capitals";
  const cacheKey = `${key}_${modeName}`;
  const cached = labelsCacheRef.current[cacheKey];
  if (
    cached &&
    cached.isSelected === isSelected &&
    cached.lang === lang &&
    cached.isFound === isFound &&
    cached.globalMode === mode &&
    cached.mode === modeName &&
    cached.learnShowCapitals === learnShowCapitals &&
    cached.hideCountryLine === hideCountryLine &&
    cached.isError === (isSelected && isError) &&
    cached.isPanelOpen === isPanelOpen
  ) {
    cached.distToCenter = distToCenter;
    return cached;
  }

  const newLabel = {
    admin: key,
    lat: data.lat,
    lng: data.lng,
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
  globeTheme,
  t,
  globeEl,
  isLight,
  isPanelOpen = false,
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

    let labelsToProcess = [];

    if (isHomeScreen) {
      if (selectedCountry) {
        labelsToProcess.push({
          key: selectedCountry,
          data: countryDataMap[selectedCountry],
          modeName: mode,
        });
      }
    } else if (isDepartmentMode) {
      getLabelSourceKeys().forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: gameDataMap[k],
          modeName: "departments",
        });
      });
    } else if (isRiversMountainsMode) {
      getLabelSourceKeys().forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: gameDataMap[k],
          modeName: "rivers_mountains",
        });
      });
    } else if (mode === "learn") {
      const modeName = learnSubMode === "capitals" ? "capitals" : "countries";
      getLabelSourceKeys().forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: gameDataMap[k],
          modeName,
          hideCountryLine: learnSubMode === "capitals",
        });
      });
    } else {
      const keys = isEndScreen
        ? Object.keys(countryDataMap)
        : getPlayVisibleCountryKeys(selectedCountry, foundList);
      keys.forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: countryDataMap[k],
          modeName: mode,
        });
      });
    }

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
    };

    const filtered = labelsToProcess
      .map((entry) => resolveLabelEntry(entry, labelCtx))
      .filter((d) => d !== null)
      .sort((a, b) => {
        if (a.isSelected) return -1;
        if (b.isSelected) return 1;
        return a.distToCenter - b.distToCenter;
      });

    if (mode === "learn") {
      const limit = getLearnLabelLimit(perfProfile);
      return filtered.slice(0, limit);
    }

    if (isDepartmentMode) {
      const limit = perfProfile?.isMobile ? 28 : 56;
      return filtered.slice(0, limit);
    }
    return perfProfile?.maxLabels
      ? filtered.slice(0, perfProfile.maxLabels)
      : filtered;
  }, [
    foundList,
    countrySizes,
    zoomLevel,
    cameraPOV,
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
        isLight,
        gameDataMap,
        globeTheme,
        mode,
        t,
        isPanelOpen,
      });
    },
    [
      REGION_COLORS_LABELS,
      UI_COLORS,
      isHomeScreen,
      isEndScreen,
      isLight,
      gameDataMap,
      globeTheme,
      mode,
      t,
      isPanelOpen,
    ],
  );

  const getHtmlAltitude = useCallback(
    (d) => {
      if (selectedCountry && d.admin === selectedCountry) return 0.0085;
      return 0.002;
    },
    [selectedCountry],
  );

  return {
    labelsData,
    createLabelElement,
    getHtmlAltitude,
  };
}