import { useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { countryDataMap } from "../data/gameData";
import {
  GLOBE_STYLE,
  GLITCH_EFFECT_SETTINGS,
  getOpaqueThreeColor,
  getThemeColors,
  getThemeRegionColor,
  getThemeRegionColorAttenuated,
  getThemeRegionColorLabel,
  getThemeDepartmentColor,
} from "../config/designSystem";
import { getPolygonAltitudeFor, GAME_REGIONS } from "../config/gameConfig";
import { getPolygonMaterialForFeature } from "../utils/globePolygonMaterial";
import {
  clearAnimatedPolygonMaterials,
  unregisterAnimatedPolygonMaterial,
} from "../utils/polygonGlitchShader";
import {
  FOUND_HIGHLIGHT,
  mutedFoundGreen,
  resolveCountryCapColor,
  resolveFoundCountryColor,
  resolveFoundCountryStroke,
  resolveRegionalLandColor,
  shouldUseRegionalUnfoundLand,
} from "../utils/polygonColorResolver";
import { getFeatureAdmin } from "../utils/utils";

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
  foundList,
  isHomeScreen,
  isEndScreen,
  isDepartmentMode,
  isPerfectScore,
  isError,
  isSuccess,
  selectionTransition,
}) {
  const { transitioningPreviousCountryState, transitioningIncomingCountryState } =
    selectionTransition.state;
  const polygonMaterialCacheRef = useRef({ cap: new Map(), side: new Map() });
  const sharedMaterialsRef = useRef(new Map());

  const safeColor = useCallback((c) => getOpaqueThreeColor(c), []);

  const lerpColor = useCallback(
    (a, b, amount) => {
      try {
        const colorA = safeColor(a);
        const colorB = safeColor(b);
        _lerpColor1.set(colorA);
        _lerpColor2.set(colorB);
        _lerpColor1.lerp(_lerpColor2, Math.max(0, Math.min(1, amount)));
        return `#${_lerpColor1.getHexString()}`;
      } catch (e) {
        return safeColor(a);
      }
    },
    [safeColor],
  );

  const { REGION_COLORS, REGION_COLORS_ATTENUATED, REGION_COLORS_LABELS } =
    useMemo(() => {
      const surface = {};
      const attenuated = {};
      const labels = {};
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

  const UI_COLORS = useMemo(() => {
    return getThemeColors(globeTheme, theme);
  }, [theme, globeTheme]);

  const getRegionSurfaceColor = useCallback(
    (region) => {
      return REGION_COLORS[region] || UI_COLORS.success;
    },
    [REGION_COLORS, UI_COLORS.success],
  );

  const getPolygonColor = useCallback(
    (d) => {
      if (isDepartmentMode) {
        const admin = getFeatureAdmin(d);
        if (d.isGhostCountry) return UI_COLORS.mapBase;
        if (isEndScreen && !foundSet.has(admin)) return UI_COLORS.error;

        const isDeptFound = foundSet.has(admin);
        const isDeptSelected = admin === selectedCountry;

        if (mode === "learn") {
          if (isDeptSelected) {
            if (isError) return UI_COLORS.error;
            return FOUND_HIGHLIGHT;
          }
          const regionCode = d.properties?.region || "Europe";
          return resolveRegionalLandColor(regionCode, {
            globeTheme,
            regionColorsLabels: REGION_COLORS_LABELS,
            regionColorsAttenuated: REGION_COLORS_ATTENUATED,
            fallbackAccent: UI_COLORS.accent,
            fallbackRegionColor: getRegionSurfaceColor(regionCode),
          });
        }

        if (isDeptFound) {
          if (isDeptSelected) {
            if (isError) return UI_COLORS.error;
            return FOUND_HIGHLIGHT;
          }
          const regionCode = d.properties?.region || "Unknown";
          const deptTint = getThemeDepartmentColor(
            globeTheme,
            theme,
            regionCode,
            UI_COLORS.mapBase,
          );
          return mutedFoundGreen(deptTint, lerpColor);
        }

        if (isDeptSelected) {
          if (isError) return UI_COLORS.error;
          return UI_COLORS.mapBase;
        }

        const regionCode = d.properties?.region || "Europe";
        return resolveRegionalLandColor(regionCode, {
          globeTheme,
          regionColorsLabels: REGION_COLORS_LABELS,
          regionColorsAttenuated: REGION_COLORS_ATTENUATED,
          fallbackAccent: UI_COLORS.accent,
          fallbackRegionColor: getRegionSurfaceColor(regionCode),
        });
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
          isSelected: admin === selectedCountry,
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
      REGION_COLORS,
      REGION_COLORS_ATTENUATED,
      REGION_COLORS_LABELS,
      UI_COLORS,
      isError,
      isSuccess,
      isHomeScreen,
      isDepartmentMode,
      isEndScreen,
      isPerfectScore,
      getRegionSurfaceColor,
      globeTheme,
      theme,
      isLight,
      lerpColor,
    ],
  );

  const getPolygonStroke = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = admin === selectedCountry;

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

      if (isHomeScreen) {
        return isLight
          ? lerpColor(UI_COLORS.mapSea, UI_COLORS.mapBorderMuted, 0.45)
          : UI_COLORS.mapBorder;
      }
      if (isDepartmentMode) {
        if (d.isGhostCountry)
          return isLight
            ? lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.12)
            : lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.08);
        if (foundSet.has(admin)) {
          if (isPerfectScore) return UI_COLORS.gold;
          return resolveFoundCountryStroke({
            isLight,
            isSelected,
            UI_COLORS,
            lerpColor,
          });
        }
        return isLight ? UI_COLORS.mapBorderMuted : UI_COLORS.mapBorder;
      }

      const isFound = foundSet.has(admin);

      if (isFound) {
        return resolveFoundCountryStroke({
          isLight,
          isSelected,
          UI_COLORS,
          lerpColor,
        });
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
      isDepartmentMode,
      lerpColor,
      isPerfectScore,
      globeTheme,
      REGION_COLORS_LABELS,
    ],
  );

  const getPolygonSideColor = useCallback(
    (d) => {
      if (isDepartmentMode) {
        if (d.isGhostCountry) return UI_COLORS.mapSea;
        return lerpColor(
          getPolygonColor(d),
          UI_COLORS.black,
          isLight ? 0.012 : 0.02,
        );
      }

      const admin = getFeatureAdmin(d);
      const region = countryDataMap[admin]?.region || "Unknown";

      if (foundSet.has(admin) && !isEndScreen) {
        return resolveFoundCountryColor();
      }

      let baseColor;
      if (isEndScreen) {
        if (foundSet.has(admin)) {
          baseColor = isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        } else {
          baseColor = UI_COLORS.error;
        }
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

      const darken =
        admin === selectedCountry
          ? isLight
            ? GLOBE_STYLE.lighting.sideDarken.selectedLight
            : GLOBE_STYLE.lighting.sideDarken.selectedDark
          : foundSet.has(admin) || (mode === "learn" && admin === selectedCountry)
            ? isLight
              ? GLOBE_STYLE.lighting.sideDarken.foundLight
              : GLOBE_STYLE.lighting.sideDarken.foundDark
            : isLight
              ? GLOBE_STYLE.lighting.sideDarken.baseLight
              : GLOBE_STYLE.lighting.sideDarken.baseDark;

      return lerpColor(baseColor, UI_COLORS.black, darken);
    },
    [
      foundSet,
      UI_COLORS,
      selectedCountry,
      isError,
      isSuccess,
      isLight,
      isEndScreen,
      isPerfectScore,
      mode,
      isDepartmentMode,
      lerpColor,
      getPolygonColor,
      globeTheme,
      theme,
    ],
  );

  const getBaseColorForCountryAndKind = useCallback(
    (admin, kind) => {
      const data = countryDataMap[admin];
      const region = data?.region || "Unknown";
      const isFound = foundSet.has(admin);

      let baseColor;
      if (isEndScreen) {
        if (isFound) {
          baseColor = isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        } else {
          baseColor = UI_COLORS.error;
        }
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

      if (isFound && !isEndScreen) {
        return resolveFoundCountryColor();
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
    ]
  );

  const getPolygonMaterial = useCallback(
    (d, kind) => {
      const admin = getFeatureAdmin(d) || "unknown";
      const cache = polygonMaterialCacheRef.current[kind];
      const color =
        kind === "cap" ? getPolygonColor(d) : getPolygonSideColor(d);
      const isFound = foundSet.has(admin);
      const isLearnSelected = mode === "learn" && admin === selectedCountry;
      const isHighlightedOnGlobe =
        isFound || isLearnSelected || admin === selectedCountry;

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
        isDepartmentMode,
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
      isDepartmentMode,
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
    ],
  );

  const getPolygonCapMaterial = useCallback(
    (d) => getPolygonMaterial(d, "cap"),
    [getPolygonMaterial],
  );

  const getPolygonSideMaterial = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      if (admin === selectedCountry) {
        return getPolygonMaterial(d, "side");
      }
      return invisibleMaterial;
    },
    [selectedCountry, getPolygonMaterial],
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
  }, [isLight, globeTheme, globeLightingEnabled, mode, isDepartmentMode]);

  const getPolygonAltitude = useCallback(
    (d) => {
      const admin = getFeatureAdmin(d);
      const isSelected = admin === selectedCountry;
      return getPolygonAltitudeFor({
        isDepartmentMode,
        isGhostCountry: !!(isDepartmentMode && d.isGhostCountry),
        isSelected,
      });
    },
    [isDepartmentMode, selectedCountry],
  );

  const getPolygonStrokeWidth = useCallback(
    (d) => {
      const strokeScale = perfProfile?.isMobile ? 0.94 : 1;
      const admin = getFeatureAdmin(d);
      const isSelected = admin === selectedCountry;
      if (isDepartmentMode && d.isGhostCountry) {
        return 0.15 * strokeScale;
      }
      if (isSelected) {
        const isGreenFill = foundSet.has(admin) || mode === "learn";
        if (isGreenFill) return 14 * strokeScale;
        return 7.5 * strokeScale;
      }
      if (isDepartmentMode) return 1.1 * strokeScale;
      if (foundSet.has(admin)) {
        const base = 0.95 * strokeScale;
        return base + (isLight ? 0.15 : 0.25);
      }
      const thickness =
        Number(UI_COLORS.strokeWidthDesktop) ||
        Number(UI_COLORS.strokeWidthMobile) ||
        0.75;

      if (!UI_COLORS.isBlackoutTheme && (isLight || globeLightingEnabled)) {
        return (thickness + 0.2) * strokeScale;
      }
      return thickness * strokeScale;
    },
    [
      globeLightingEnabled,
      isLight,
      perfProfile?.isMobile,
      selectedCountry,
      isDepartmentMode,
      foundSet,
      mode,
      UI_COLORS,
    ],
  );

  const getPolygonCurvatureResolution = useCallback(
    (d, customSizes) => {
      const admin = getFeatureAdmin(d) || "unknown";
      const baseRes = perfProfile?.polygonCapCurvatureResolution ?? 1.5;
      const size = customSizes ? customSizes[admin] : undefined;
      if (size === undefined) return baseRes;

      if (size < 4) {
        return baseRes * 2.2;
      }
      if (size > 15) {
        return baseRes * 0.3;
      }
      if (size >= 8) {
        return baseRes * 0.45;
      }
      return baseRes;
    },
    [perfProfile?.polygonCapCurvatureResolution],
  );

  const getPolygonCapColorWrapped = useCallback(
    (d) => safeColor(getPolygonColor(d)),
    [safeColor, getPolygonColor],
  );
  const getPolygonSideColorWrapped = useCallback(
    (d) => safeColor(getPolygonSideColor(d)),
    [safeColor, getPolygonSideColor],
  );
  const getPolygonStrokeColorWrapped = useCallback(
    (d) => safeColor(getPolygonStroke(d)),
    [safeColor, getPolygonStroke],
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
