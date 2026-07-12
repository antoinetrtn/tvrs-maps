import { useMemo, useCallback, useRef } from "react";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { createGlobeLabelElement } from "../utils/globeLabelBuilder";
import {
  getFlagEmoji,
  getLabelRenderRadius,
} from "../utils/utils";

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
  learnToggles,
  countrySizes,
  lang,
  isError,
  REGION_COLORS_LABELS,
  UI_COLORS,
  globeTheme,
  t,
  globeEl,
}) {
  const {
    showCountryLabels: learnShowCountryLabels = true,
    showCapitals: learnShowCapitals = false,
    showRivers: learnShowRivers = false,
    showMountains: learnShowMountains = false,
  } = learnToggles || {};

  const labelsCacheRef = useRef({});

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
      Object.keys(gameDataMap).forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: gameDataMap[k],
          modeName: "departments",
        });
      });
    } else if (isRiversMountainsMode) {
      Object.keys(gameDataMap).forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: gameDataMap[k],
          modeName: "rivers_mountains",
        });
      });
    } else if (mode === "learn") {
      if (learnShowCountryLabels || learnShowCapitals) {
        Object.keys(countryDataMap).forEach((k) => {
          labelsToProcess.push({
            key: k,
            data: countryDataMap[k],
            modeName: learnShowCountryLabels ? "countries" : "capitals",
            hideCountryLine: !learnShowCountryLabels,
          });
        });
      }
      if (learnShowRivers) {
        Object.keys(riversMountainsDataMap).forEach((k) => {
          if (riversMountainsDataMap[k].type === "river") {
            labelsToProcess.push({
              key: k,
              data: riversMountainsDataMap[k],
              modeName: "rivers_mountains",
            });
          }
        });
      }
      if (learnShowMountains) {
        Object.keys(riversMountainsDataMap).forEach((k) => {
          if (
            riversMountainsDataMap[k].type === "mountain" ||
            riversMountainsDataMap[k].type === "mountain_range"
          ) {
            labelsToProcess.push({
              key: k,
              data: riversMountainsDataMap[k],
              modeName: "rivers_mountains",
            });
          }
        });
      }
    } else {
      const keys =
        isEndScreen
          ? Object.keys(countryDataMap)
          : perfProfile?.isMobile
            ? selectedCountry
              ? [...new Set([selectedCountry, ...foundList.slice(-1)])]
              : foundList.slice(-2)
            : selectedCountry && !foundList.includes(selectedCountry)
              ? [...foundList, selectedCountry]
              : foundList;
      keys.forEach((k) => {
        labelsToProcess.push({
          key: k,
          data: countryDataMap[k],
          modeName: mode,
        });
      });
    }

    const pov = cameraPOV;

    const filtered = labelsToProcess
      .map(({ key, data, modeName, hideCountryLine = false }) => {
        if (!data) return null;

        const isSelected = key === selectedCountry;
        const isFound = foundSet.has(key);
        const size = countrySizes[key] || 0.5;

        const isPlayMode = mode !== "learn" && !isHomeScreen && !isEndScreen;
        if (isPlayMode && !isFound && !isSelected) {
          return null;
        }

        const isRivMount = modeName === "rivers_mountains";
        const visibilityThreshold = isDepartmentMode
          ? 1.05
          : isSelected
            ? 10
            : isHomeScreen
              ? 1.8
              : isRivMount
                ? 2.5
                : Math.min(3.0, 0.8 + size * 2.0);

        if (zoomLevel > visibilityThreshold) return null;

        let dLng = Math.abs(data.lng - pov.lng);
        if (dLng > 180) dLng = 360 - dLng;
        const distToCenter = Math.hypot(dLng, data.lat - pov.lat);

        const isLearnMode = mode === "learn";
        const labelRadius = isLearnMode
          ? 85
          : isDepartmentMode
            ? 7
            : getLabelRenderRadius(zoomLevel, !!perfProfile?.isMobile);
        if (!isSelected && distToCenter > labelRadius) return null;

        const cacheKey = `${key}_${modeName}`;
        const cached = labelsCacheRef.current[cacheKey];
        if (
          cached &&
          cached.isSelected === isSelected &&
          cached.lang === lang &&
          cached.isFound === isFound &&
          cached.mode === mode &&
          cached.learnShowCapitals === learnShowCapitals &&
          cached.hideCountryLine === hideCountryLine &&
          cached.isError === (isSelected && isError)
        ) {
          cached.distToCenter = distToCenter;
          return cached;
        }

        const newLabel = {
          admin: key,
          lat: data.lat,
          lng: data.lng,
          country: lang === "fr" ? data.name_fr || key : data.name_en || key,
          capital:
            lang === "fr" ? data.capital_fr || data.capital : data.capital,
          region: data.region,
          flag: getFlagEmoji(data.iso2),
          code: data.code,
          size,
          distToCenter,
          isSelected,
          isFound,
          isError: isSelected && isError,
          mode: modeName,
          learnShowCapitals,
          hideCountryLine,
          lang,
        };
        labelsCacheRef.current[cacheKey] = newLabel;
        return newLabel;
      })
      .filter((d) => d !== null)
      .sort((a, b) => {
        if (a.isSelected) return -1;
        if (b.isSelected) return 1;
        if (mode === "learn") {
          return a.admin.localeCompare(b.admin);
        }
        return a.distToCenter - b.distToCenter;
      });

    if (isDepartmentMode)
      return filtered.slice(0, perfProfile?.isMobile ? 10 : 18);
    if (mode === "learn") {
      const limit = perfProfile?.isMobile ? 120 : 180;
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
    isDepartmentMode,
    isRiversMountainsMode,
    gameDataMap,
    foundSet,
    learnShowCountryLabels,
    learnShowCapitals,
    learnShowRivers,
    learnShowMountains,
    isError,
    globeEl,
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
