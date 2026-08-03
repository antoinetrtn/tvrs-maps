import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  getOpaqueThreeColor,
  getThemeColors,
  getThemeDepartmentColor,
  getThemeRegionColor,
  getThemeRegionColorAttenuated,
  getThemeRegionColorLabel,
  GLITCH_EFFECT_SETTINGS,
  GLOBE_STYLE,
} from "../../config/designSystem";
import { GAME_REGIONS, getPolygonAltitudeFor } from "../../config/gameConfig";
import { countryDataMap } from "../../data/gameData";
import { getFeatureAdmin } from "../../utils/utils";
import { getPolygonMaterialForFeature } from "../render/globePolygonMaterial";
import {
  FOUND_HIGHLIGHT,
  getFeatureMonochromeShade,
  getTransitionState,
  isSameAdmin,
  mutedFoundGreen,
  resolveCountryCapColor,
  resolveFoundCountryColor,
  resolveFoundCountryStroke,
  resolveGhostCountryColor,
  resolveModeTransitionColor,
  resolveModeTransitionStroke,
  resolveModeTransitionStrokeWidth,
  resolvePolygonStrokeWidth,
  resolveRegionalLandColor,
  resolveRestingColorForFeature,
  shouldUseRegionalUnfoundLand,
} from "../render/polygonColorResolver";
import {
  clearAnimatedPolygonMaterials,
  unregisterAnimatedPolygonMaterial,
} from "../render/polygonGlitchShader";

const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });
const _lerpColor1 = new THREE.Color();
const _lerpColor2 = new THREE.Color();

export function useGlobePolygons({
  mode,
  theme,
  globeTheme,
  isLight,
  globeLightingEnabled,
  perfProfile,
  selectedCountry,
  foundSet,
  _foundList,
  isHomeScreen,
  isEndScreen,
  gameDataMap = countryDataMap,
  isDepartmentMode,
  isUsStatesMode,
  isPerfectScore,
  isError,
  isSuccess,
  selectionTransition,
  modeTransitionRef,
}) {
  const isRegionalMode = isDepartmentMode || isUsStatesMode;
  const { transitioningPreviousCountryState, transitioningIncomingCountryState } =
    selectionTransition.state;
  const polygonMaterialCacheRef = useRef({ cap: new Map(), side: new Map() });
  const sharedMaterialsRef = useRef(new Map());

  const safeColor = useCallback((c) => getOpaqueThreeColor(c), []);

  const lerpColor = useCallback(
    (a, b, amount) => {
      try {
        _lerpColor1.set(safeColor(a));
        _lerpColor2.set(safeColor(b));
        _lerpColor1.lerp(_lerpColor2, Math.max(0, Math.min(1, amount)));
        return `#${_lerpColor1.getHexString()}`;
      } catch {
        return safeColor(a);
      }
    },
    [safeColor]
  );

  const { REGION_COLORS, REGION_COLORS_ATTENUATED, REGION_COLORS_LABELS } = useMemo(() => {
    const surface = {},
      attenuated = {},
      labels = {};
    GAME_REGIONS.forEach((r) => {
      surface[r] = getThemeRegionColor(globeTheme, theme, r);
      attenuated[r] = getThemeRegionColorAttenuated(globeTheme, theme, r);
      labels[r] = getThemeRegionColorLabel(globeTheme, theme, r);
    });
    return {
      REGION_COLORS: surface,
      REGION_COLORS_ATTENUATED: attenuated,
      REGION_COLORS_LABELS: labels,
    };
  }, [globeTheme, theme]);

  const UI_COLORS = useMemo(() => getThemeColors(globeTheme, theme), [theme, globeTheme]);

  const getRegionSurfaceColor = useCallback(
    (region) => getThemeRegionColor(globeTheme, theme, region),
    [globeTheme, theme]
  );

  const getRegionSurfaceColorDimmed = useCallback(
    (region) => getThemeRegionColorAttenuated(globeTheme, theme, region),
    [globeTheme, theme]
  );

  const getRegionalLandColor = useCallback(
    (regionCode) =>
      resolveRegionalLandColor(regionCode, {
        globeTheme,
        regionColorsLabels: REGION_COLORS_LABELS,
        regionColorsAttenuated: REGION_COLORS_ATTENUATED,
        fallbackAccent: UI_COLORS.accent,
        fallbackRegionColor: getRegionSurfaceColor(regionCode),
      }),
    [globeTheme, REGION_COLORS_LABELS, REGION_COLORS_ATTENUATED, UI_COLORS, getRegionSurfaceColor]
  );

  const getPolygonColor = useCallback(
    (d) => {
      const transState = getTransitionState(modeTransitionRef);
      if (transState) {
        const transColor = resolveModeTransitionColor({
          d,
          transState,
          countryDataMap,
          gameDataMap,
          globeTheme,
          theme,
          REGION_COLORS_LABELS,
          REGION_COLORS_ATTENUATED,
          UI_COLORS,
          getRegionSurfaceColor,
          getRegionSurfaceColorDimmed,
          getFeatureMonochromeShade,
          lerpColor,
        });
        if (transColor) return transColor;
      }

      if (isRegionalMode) {
        const admin = getFeatureAdmin(d);
        if (d.isGhostCountry)
          return resolveGhostCountryColor(d, countryDataMap, {
            globeTheme,
            systemTheme: theme,
            regionColorsLabels: REGION_COLORS_LABELS,
            regionColorsAttenuated: REGION_COLORS_ATTENUATED,
            fallbackAccent: UI_COLORS.accent,
            fallbackRegionColor: getRegionSurfaceColorDimmed(
              countryDataMap[admin]?.region || "Americas"
            ),
          });
        if (isEndScreen && !foundSet.has(admin)) return UI_COLORS.error;

        const isDeptFound = foundSet.has(admin);
        const isDeptSelected = isSameAdmin(admin, selectedCountry, gameDataMap);

        if (mode === "learn") {
          if (isDeptSelected) {
            if (isError) return UI_COLORS.error;
            return FOUND_HIGHLIGHT;
          }
          const regionCode = gameDataMap[admin]?.region || d.properties?.region || "Americas";
          const baseColor = getRegionSurfaceColorDimmed(regionCode);
          return getFeatureMonochromeShade(admin, baseColor, lerpColor, UI_COLORS);
        }

        if (isDeptFound) {
          if (isDeptSelected) {
            if (isError) return UI_COLORS.error;
            return FOUND_HIGHLIGHT;
          }
          const regionCode = gameDataMap[admin]?.region || d.properties?.region || "Unknown";
          const deptTint = getThemeDepartmentColor(
            globeTheme,
            theme,
            regionCode,
            UI_COLORS.mapBase
          );
          return mutedFoundGreen(deptTint, lerpColor);
        }

        if (isDeptSelected) {
          if (isError) return UI_COLORS.error;
          return UI_COLORS.accent;
        }

        const regionCode = gameDataMap[admin]?.region || d.properties?.region || "Americas";
        const baseColor = getRegionSurfaceColorDimmed(regionCode);
        return getFeatureMonochromeShade(admin, baseColor, lerpColor, UI_COLORS);
      }

      const admin = getFeatureAdmin(d);
      const region = countryDataMap[admin]?.region || "Unknown";
      const resolved = resolveCountryCapColor({
        admin,
        region,
        mode,
        foundSet,
        selectedCountry,
        isError,
        isSuccess,
        isEndScreen,
        isPerfectScore,
        isLearn: mode === "learn",
        isLight,
        UI_COLORS,
        lerpColor,
        mapBase: UI_COLORS.mapBase,
      });

      if (
        shouldUseRegionalUnfoundLand({
          isEndScreen,
          isFound: foundSet.has(admin),
          isSelected: isSameAdmin(admin, selectedCountry, gameDataMap),
        })
      ) {
        return resolveRegionalLandColor(region, {
          globeTheme,
          regionColorsLabels: REGION_COLORS_LABELS,
          regionColorsAttenuated: REGION_COLORS_ATTENUATED,
          fallbackAccent: UI_COLORS.accent,
          fallbackRegionColor: getRegionSurfaceColor(region),
        });
      }

      return resolved;
    },
    [
      selectedCountry,
      mode,
      foundSet,
      getRegionalLandColor,
      UI_COLORS,
      isError,
      isSuccess,
      isRegionalMode,
      isEndScreen,
      isPerfectScore,
      gameDataMap,
      globeTheme,
      theme,
      isLight,
      lerpColor,
      modeTransitionRef,
      getRegionSurfaceColor,
      getRegionSurfaceColorDimmed,
      REGION_COLORS_ATTENUATED,
      REGION_COLORS_LABELS,
    ]
  );

  const getPolygonStroke = useCallback(
    (d) => {
      const transState = getTransitionState(modeTransitionRef);
      if (transState) {
        const transStroke = resolveModeTransitionStroke({
          d,
          transState,
          gameDataMap,
          globeTheme,
          REGION_COLORS_LABELS,
          UI_COLORS,
          isLight,
          lerpColor,
        });
        if (transStroke) return transStroke;
      }

      const admin = getFeatureAdmin(d);
      const isSelected = isSameAdmin(admin, selectedCountry, gameDataMap);

      if (isSelected) {
        if (isError) return UI_COLORS.error;
        if (isSuccess) return GLITCH_EFFECT_SETTINGS.selectionHighlight;
        if (mode === "learn" || foundSet.has(admin)) {
          return resolveFoundCountryStroke({
            isLight,
            isSelected: true,
            UI_COLORS,
            lerpColor,
          });
        }
        return UI_COLORS.accent;
      }

      if (globeTheme === "satellite") {
        if (foundSet.has(admin)) {
          return resolveFoundCountryStroke({ isLight, isSelected, UI_COLORS, lerpColor });
        }
        return UI_COLORS.mapBorder;
      }

      if (isHomeScreen) {
        if (isRegionalMode && !d.isGhostCountry) {
          // Fall through to show correct regional borders on the home screen
        } else {
          return isLight
            ? lerpColor(UI_COLORS.mapSea, UI_COLORS.mapBorderMuted, 0.45)
            : UI_COLORS.mapBorder;
        }
      }
      if (isRegionalMode) {
        if (d.isGhostCountry)
          return isLight
            ? lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.12)
            : lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.22);
        if (foundSet.has(admin)) {
          if (isPerfectScore) return UI_COLORS.gold;
          return resolveFoundCountryStroke({ isLight, isSelected, UI_COLORS, lerpColor });
        }
        return isLight
          ? lerpColor(UI_COLORS.black, UI_COLORS.mapBase, 0.35)
          : UI_COLORS.accent || UI_COLORS.paper;
      }

      const isFound = foundSet.has(admin);

      if (isFound) {
        return resolveFoundCountryStroke({ isLight, isSelected, UI_COLORS, lerpColor });
      }

      return lerpColor(UI_COLORS.borderUnfound, UI_COLORS.paper, isLight ? 0.35 : 0.28);
    },
    [
      selectedCountry,
      UI_COLORS,
      isError,
      isSuccess,
      foundSet,
      mode,
      isHomeScreen,
      isLight,
      isRegionalMode,
      lerpColor,
      isPerfectScore,
      globeTheme,
      REGION_COLORS_LABELS,
      gameDataMap,
      modeTransitionRef,
    ]
  );

  const getPolygonSideColor = useCallback(
    (d) => {
      if (isRegionalMode) {
        if (d.isGhostCountry) return UI_COLORS.mapSea;
        return lerpColor(getPolygonColor(d), UI_COLORS.black, isLight ? 0.012 : 0.02);
      }

      const admin = getFeatureAdmin(d);
      const isSelected = isSameAdmin(admin, selectedCountry, gameDataMap);
      const darken = isSelected
        ? isLight
          ? GLOBE_STYLE.lighting.sideDarken.selectedLight
          : GLOBE_STYLE.lighting.sideDarken.selectedDark
        : foundSet.has(admin) || (mode === "learn" && isSelected)
          ? isLight
            ? GLOBE_STYLE.lighting.sideDarken.foundLight
            : GLOBE_STYLE.lighting.sideDarken.foundDark
          : isLight
            ? GLOBE_STYLE.lighting.sideDarken.baseLight
            : GLOBE_STYLE.lighting.sideDarken.baseDark;

      return lerpColor(getPolygonColor(d), UI_COLORS.black, darken);
    },
    [
      getPolygonColor,
      isLight,
      UI_COLORS,
      selectedCountry,
      gameDataMap,
      foundSet,
      mode,
      isRegionalMode,
      lerpColor,
    ]
  );

  const getBaseColorForCountryAndKind = useCallback(
    (admin, kind) => {
      const data = countryDataMap[admin];
      const region = data?.region || "Unknown";
      const isFound = foundSet.has(admin);

      if (isFound && !isEndScreen) {
        return resolveFoundCountryColor();
      }

      if (
        kind === "cap" &&
        shouldUseRegionalUnfoundLand({
          isEndScreen,
          isFound,
          isSelected: isSameAdmin(admin, selectedCountry, gameDataMap),
        })
      ) {
        return getRegionalLandColor(region);
      }

      let baseColor;
      if (isEndScreen) {
        baseColor = isFound
          ? isPerfectScore
            ? UI_COLORS.gold
            : UI_COLORS.success
          : UI_COLORS.error;
      } else {
        baseColor = resolveCountryCapColor({
          admin,
          region,
          mode,
          foundSet,
          selectedCountry,
          isError,
          isSuccess,
          isEndScreen,
          isPerfectScore,
          isLearn: mode === "learn",
          isLight,
          UI_COLORS,
          lerpColor,
          mapBase: UI_COLORS.mapBase,
        });
      }

      const capColor = lerpColor(baseColor, UI_COLORS.black, isLight ? 0.32 : 0.16);
      if (kind === "side") {
        return lerpColor(capColor, UI_COLORS.black, isLight ? 0.04 : 0.08);
      }
      return capColor;
    },
    [
      foundSet,
      mode,
      selectedCountry,
      isError,
      isSuccess,
      UI_COLORS,
      isLight,
      lerpColor,
      isEndScreen,
      isPerfectScore,
      getRegionalLandColor,
      gameDataMap,
    ]
  );

  const getPolygonMaterial = useCallback(
    (d, kind) => {
      const admin = getFeatureAdmin(d) || "unknown";
      const cache = polygonMaterialCacheRef.current[kind];
      const color = kind === "cap" ? getPolygonColor(d) : getPolygonSideColor(d);
      const isFound = foundSet.has(admin);
      const isLearnSelected = mode === "learn" && admin === selectedCountry;
      const isHighlightedOnGlobe = isFound || isLearnSelected || admin === selectedCountry;

      const restingColor = resolveRestingColorForFeature({
        d,
        kind,
        admin,
        isFound,
        isEndScreen,
        isPerfectScore,
        isRegionalMode,
        globeTheme,
        isLight,
        UI_COLORS,
        REGION_COLORS_LABELS,
        REGION_COLORS_ATTENUATED,
        countryDataMap,
        gameDataMap,
        getRegionalLandColor,
        getFeatureMonochromeShade,
        lerpColor,
      });

      const material = getPolygonMaterialForFeature({
        d,
        kind,
        color,
        admin,
        selectedCountry,
        showFoundOnGlobe: isFound,
        isHighlightedOnGlobe,
        isLearnSelected,
        isFound,
        mode,
        foundSet,
        isEndScreen,
        isHomeScreen,
        isError,
        isSuccess,
        transitioningPreviousCountryState,
        transitioningIncomingCountryState,
        isDepartmentMode: isRegionalMode,
        globeTheme,
        isLight,
        globeLightingEnabled,
        perfProfile,
        UI_COLORS,
        safeColor,
        sharedMaterialsRef,
        getBaseColorForCountryAndKind,
        mapBase: UI_COLORS.mapBase,
        lerpColor,
        restingColor,
      });

      cache.set(admin, material);
      return material;
    },
    [
      getPolygonColor,
      getPolygonSideColor,
      isLight,
      globeLightingEnabled,
      UI_COLORS,
      selectedCountry,
      isRegionalMode,
      foundSet,
      globeTheme,
      mode,
      perfProfile,
      isHomeScreen,
      transitioningPreviousCountryState,
      transitioningIncomingCountryState,
      getBaseColorForCountryAndKind,
      safeColor,
      isError,
      isSuccess,
      isEndScreen,
      lerpColor,
      getRegionalLandColor,
      isPerfectScore,
      gameDataMap,
      REGION_COLORS_ATTENUATED,
      REGION_COLORS_LABELS,
    ]
  );

  const getPolygonCapMaterial = useCallback(
    (d) => getPolygonMaterial(d, "cap"),
    [getPolygonMaterial]
  );

  const getPolygonSideMaterial = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = isSameAdmin(admin, selectedCountry, gameDataMap);
      const isPrev = isSameAdmin(admin, transitioningPreviousCountryState, gameDataMap);
      const isIncoming = isSameAdmin(admin, transitioningIncomingCountryState, gameDataMap);
      return isSelected || isPrev || isIncoming ? getPolygonMaterial(d, "side") : invisibleMaterial;
    },
    [
      selectedCountry,
      transitioningPreviousCountryState,
      transitioningIncomingCountryState,
      getPolygonMaterial,
      gameDataMap,
    ]
  );

  useEffect(() => {
    const materialCache = polygonMaterialCacheRef.current;
    const sharedPool = sharedMaterialsRef.current;
    return () => {
      materialCache.cap.clear();
      materialCache.side.clear();
      sharedPool.forEach((material) => {
        unregisterAnimatedPolygonMaterial(material);
        material.dispose();
      });
      sharedPool.clear();
      clearAnimatedPolygonMaterials();
    };
  }, [isLight, globeTheme, globeLightingEnabled, mode, isRegionalMode]);

  const getPolygonAltitude = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = isSameAdmin(admin, selectedCountry, gameDataMap);
      const isPrev = isSameAdmin(admin, transitioningPreviousCountryState, gameDataMap);
      const isIncoming = isSameAdmin(admin, transitioningIncomingCountryState, gameDataMap);
      return getPolygonAltitudeFor({
        isDepartmentMode: isRegionalMode,
        isGhostCountry: Boolean(isRegionalMode && d.isGhostCountry),
        isSelected: isSelected || isPrev || isIncoming,
        globeTheme,
      });
    },
    [
      isRegionalMode,
      selectedCountry,
      transitioningPreviousCountryState,
      transitioningIncomingCountryState,
      globeTheme,
      gameDataMap,
    ]
  );

  const getPolygonStrokeWidth = useCallback(
    (d) => {
      const transState = getTransitionState(modeTransitionRef);
      if (transState) {
        const transWidth = resolveModeTransitionStrokeWidth({
          d,
          transState,
          perfProfile,
          UI_COLORS,
        });
        if (transWidth !== null) return transWidth;
      }
      return resolvePolygonStrokeWidth({
        admin: getFeatureAdmin(d),
        isGhostCountry: d.isGhostCountry,
        selectedCountry,
        isRegionalMode,
        foundSet,
        mode,
        isLight,
        globeLightingEnabled,
        perfProfile,
        UI_COLORS,
      });
    },
    [
      modeTransitionRef,
      selectedCountry,
      isRegionalMode,
      foundSet,
      mode,
      isLight,
      globeLightingEnabled,
      perfProfile,
      UI_COLORS,
    ]
  );

  const getPolygonCurvatureResolution = useCallback(
    (d, customSizes) => {
      const sz = customSizes ? customSizes[getFeatureAdmin(d) || "unknown"] : undefined;
      const b = perfProfile?.polygonCapCurvatureResolution ?? 1.5;
      return sz === undefined ? b : sz < 4 ? b * 2.2 : sz > 15 ? b * 0.3 : sz >= 8 ? b * 0.45 : b;
    },
    [perfProfile?.polygonCapCurvatureResolution]
  );

  const wrapColor = useCallback((fn) => (d) => safeColor(fn(d)), [safeColor]);
  const getPolygonCapColorWrapped = useMemo(
    () => wrapColor(getPolygonColor),
    [wrapColor, getPolygonColor]
  );
  const getPolygonSideColorWrapped = useMemo(
    () => wrapColor(getPolygonSideColor),
    [wrapColor, getPolygonSideColor]
  );
  const getPolygonStrokeColorWrapped = useMemo(
    () => wrapColor(getPolygonStroke),
    [wrapColor, getPolygonStroke]
  );

  return {
    getPolygonCapMaterial,
    getPolygonSideMaterial,
    getPolygonAltitude,
    getPolygonStrokeWidth,
    getPolygonCurvatureResolution,
    getPolygonCapColorWrapped,
    getPolygonSideColorWrapped,
    getPolygonStrokeColorWrapped,
    polygonMaterialCacheRef,
    sharedMaterialsRef,
    REGION_COLORS,
    REGION_COLORS_ATTENUATED,
    REGION_COLORS_LABELS,
    UI_COLORS,
    getBaseColorForCountryAndKind,
    lerpColor,
    getPolygonColor,
    getPolygonSideColor,
    getPolygonStroke,
  };
}
