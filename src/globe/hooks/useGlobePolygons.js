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
import {
  GAME_REGIONS,
  getFeatureCapResolution,
  getPolygonAltitudeFor,
  POLYGON_ALTITUDE,
} from "../../config/gameConfig";
import { countryDataMap } from "../../data/gameData";
import { getFeatureAdmin } from "../../utils/utils";
import { getPolygonMaterialForFeature } from "../render/globePolygonMaterial";
import {
  getFeatureMonochromeShade,
  getTransitionState,
  isQuietOwnedFocusFor,
  isSameAdmin,
  mutedFoundGreen,
  resolveCountryCapColor,
  resolveEndMissedColor,
  resolveFoundCountryColor,
  resolveFoundCountryStroke,
  resolveModeTransitionStroke,
  resolveOwnerBaseColor,
  resolveRegionalLandColor,
  resolveRestingColorForFeature,
  shouldUseRegionalUnfoundLand,
} from "../render/polygonColorResolver";
import {
  clearAnimatedPolygonMaterials,
  unregisterAnimatedPolygonMaterial,
} from "../render/polygonGlitchShader";
import {
  useGhostWorldColor,
  useModeTransitionColor,
  useModeTransitionStrokeWidth,
} from "./useModeTransitionColor";

const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });
const _lerpColor1 = new THREE.Color();
const _lerpColor2 = new THREE.Color();

export function useGlobePolygons({
  mode,
  globeLightingEnabled,
  perfProfile,
  selectedCountry,
  foundSet: rawFoundSet,
  _foundList,
  conquestOverlay = null, // Conquête: { colors, strokes } by countryId
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
  transitionStep = 0,
}) {
  const isRegionalMode = isDepartmentMode || isUsStatesMode;
  // Discovery reveal starts on the correct guess, not after the auto-advance delay: the
  // guessed country renders as found right away so its own land/cities reveal (grain
  // shader, discoveryTimeline.js) runs from t = 0 instead of a full-country flash.
  const foundSet = useMemo(() => {
    if (!isSuccess || !selectedCountry || isRegionalMode || rawFoundSet.has(selectedCountry)) {
      return rawFoundSet;
    }
    const next = new Set(rawFoundSet);
    next.add(selectedCountry);
    return next;
  }, [rawFoundSet, isSuccess, selectedCountry, isRegionalMode]);
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
      surface[r] = getThemeRegionColor(r);
      attenuated[r] = getThemeRegionColorAttenuated(r);
      labels[r] = getThemeRegionColorLabel(r);
    });
    return {
      REGION_COLORS: surface,
      REGION_COLORS_ATTENUATED: attenuated,
      REGION_COLORS_LABELS: labels,
    };
  }, []);

  const UI_COLORS = useMemo(() => getThemeColors(), []);

  const getRegionSurfaceColor = useCallback((region) => getThemeRegionColor(region), []);

  const getRegionSurfaceColorDimmed = useCallback(
    (region) => getThemeRegionColorAttenuated(region),
    []
  );

  const getGhostWorldColor = useGhostWorldColor({
    getRegionSurfaceColorDimmed,
    lerpColor,
    UI_COLORS,
  });

  const getRegionalLandColor = useCallback(
    (regionCode) =>
      resolveRegionalLandColor(regionCode, {
        regionColorsLabels: REGION_COLORS_LABELS,
        regionColorsAttenuated: REGION_COLORS_ATTENUATED,
        fallbackAccent: UI_COLORS.accent,
        fallbackRegionColor: getRegionSurfaceColor(regionCode),
      }),
    [REGION_COLORS_LABELS, REGION_COLORS_ATTENUATED, UI_COLORS, getRegionSurfaceColor]
  );

  const isQuietOwnedFocus = useCallback(
    (admin) => isQuietOwnedFocusFor(conquestOverlay, admin, gameDataMap),
    [conquestOverlay, gameDataMap]
  );

  const getBasePolygonColor = useCallback(
    (d) => {
      const ownerColor = conquestOverlay?.colors?.[getFeatureAdmin(d)] || conquestOverlay?.neutral;
      if (ownerColor) return ownerColor; // Conquête: owner, lockout or neutral world

      if (isRegionalMode) {
        const admin = getFeatureAdmin(d);
        if (d.isGhostCountry)
          return getGhostWorldColor(countryDataMap[admin]?.region || "Americas");
        if (isEndScreen && !foundSet.has(admin))
          return resolveEndMissedColor({
            mapBase: UI_COLORS.mapBase,
            UI_COLORS,
            lerpColor,
          });

        const isDeptFound = foundSet.has(admin);
        const isDeptSelected = isSameAdmin(admin, selectedCountry, gameDataMap);

        if (mode === "learn") {
          if (isDeptSelected) {
            if (isError) return UI_COLORS.error;
            return GLITCH_EFFECT_SETTINGS.selectionHighlight;
          }
          const regionCode = gameDataMap[admin]?.region || d.properties?.region || "Americas";
          const baseColor = getRegionSurfaceColorDimmed(regionCode);
          return getFeatureMonochromeShade(admin, baseColor, lerpColor, UI_COLORS);
        }

        if (isDeptFound) {
          if (isDeptSelected) {
            if (isError) return UI_COLORS.error;
            return GLITCH_EFFECT_SETTINGS.selectionHighlight;
          }
          const deptTint = getThemeDepartmentColor();
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
          regionColorsLabels: REGION_COLORS_LABELS,
          regionColorsAttenuated: REGION_COLORS_ATTENUATED,
          fallbackAccent: UI_COLORS.accent,
          fallbackRegionColor: getRegionSurfaceColor(region),
        });
      }

      return resolved;
    },
    [
      conquestOverlay,
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
      lerpColor,
      getRegionSurfaceColor,
      getRegionSurfaceColorDimmed,
      getGhostWorldColor,
      REGION_COLORS_ATTENUATED,
      REGION_COLORS_LABELS,
    ]
  );

  const getPolygonColor = useModeTransitionColor({
    getBasePolygonColor,
    getGhostWorldColor,
    getRegionSurfaceColor,
    getRegionSurfaceColorDimmed,
    getFeatureMonochromeShade,
    modeTransitionRef,
    transitionStep,
    gameDataMap,
    REGION_COLORS_LABELS,
    REGION_COLORS_ATTENUATED,
    UI_COLORS,
    lerpColor,
  });

  const getPolygonStroke = useCallback(
    (d) => {
      const transState = getTransitionState(modeTransitionRef, transitionStep);
      if (transState) {
        const transStroke = resolveModeTransitionStroke({
          d,
          transState,
          gameDataMap,
          REGION_COLORS_LABELS,
          UI_COLORS,
          lerpColor,
        });
        if (transStroke) return transStroke;
      }

      const admin = getFeatureAdmin(d);
      if (conquestOverlay?.strokes?.[admin]) return conquestOverlay.strokes[admin];
      const isSelected =
        !isQuietOwnedFocus(admin) && isSameAdmin(admin, selectedCountry, gameDataMap);

      if (isSelected) {
        if (isError) return UI_COLORS.error;
        if (isSuccess) return GLITCH_EFFECT_SETTINGS.selectionHighlight;
        if (mode === "learn" || foundSet.has(admin)) {
          return resolveFoundCountryStroke({
            isSelected: true,
            UI_COLORS,
            lerpColor,
          });
        }
        return UI_COLORS.accent;
      }

      if (isHomeScreen) {
        if (isRegionalMode && !d.isGhostCountry) {
          // Fall through to show correct regional borders on the home screen
        } else {
          return UI_COLORS.mapBorder;
        }
      }
      if (isRegionalMode) {
        if (d.isGhostCountry) return lerpColor(UI_COLORS.mapSea, UI_COLORS.paper, 0.13);
        if (foundSet.has(admin)) {
          if (isPerfectScore) return UI_COLORS.gold;
          return resolveFoundCountryStroke({ isSelected, UI_COLORS, lerpColor });
        }
        return UI_COLORS.accent || UI_COLORS.paper;
      }

      const isFound = foundSet.has(admin);

      if (isFound) {
        return resolveFoundCountryStroke({ isSelected, UI_COLORS, lerpColor });
      }

      return lerpColor(UI_COLORS.borderUnfound, UI_COLORS.paper, 0.28);
    },
    [
      conquestOverlay,
      selectedCountry,
      UI_COLORS,
      isError,
      isSuccess,
      foundSet,
      mode,
      isHomeScreen,
      isRegionalMode,
      lerpColor,
      isPerfectScore,
      REGION_COLORS_LABELS,
      gameDataMap,
      modeTransitionRef,
      transitionStep,
      isQuietOwnedFocus,
    ]
  );

  const getPolygonSideColor = useCallback(
    (d) => {
      if (isRegionalMode) {
        if (d.isGhostCountry) return UI_COLORS.mapSea;
        return lerpColor(getPolygonColor(d), UI_COLORS.black, 0.02);
      }

      const admin = getFeatureAdmin(d);
      const isSelected =
        !isQuietOwnedFocus(admin) && isSameAdmin(admin, selectedCountry, gameDataMap);
      const darken = isSelected
        ? GLOBE_STYLE.lighting.sideDarken.selected
        : foundSet.has(admin) || (mode === "learn" && isSelected)
          ? GLOBE_STYLE.lighting.sideDarken.found
          : GLOBE_STYLE.lighting.sideDarken.base;

      return lerpColor(getPolygonColor(d), UI_COLORS.black, darken);
    },
    [
      conquestOverlay,
      getPolygonColor,
      UI_COLORS,
      selectedCountry,
      gameDataMap,
      foundSet,
      mode,
      isRegionalMode,
      lerpColor,
      isQuietOwnedFocus,
    ]
  );

  const getBaseColorForCountryAndKind = useCallback(
    (admin, kind) => {
      const owner = conquestOverlay?.colors?.[admin];
      if (owner) return resolveOwnerBaseColor(owner, kind, { lerpColor, UI_COLORS });

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

      const baseColor = resolveCountryCapColor({
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
        UI_COLORS,
        lerpColor,
        mapBase: UI_COLORS.mapBase,
      });

      const capColor = lerpColor(baseColor, UI_COLORS.black, 0.16);
      if (kind === "side") {
        return lerpColor(capColor, UI_COLORS.black, 0.08);
      }
      return capColor;
    },
    [
      conquestOverlay,
      foundSet,
      mode,
      selectedCountry,
      isError,
      isSuccess,
      UI_COLORS,
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
      const quiet = isQuietOwnedFocus(admin);
      // Conquête: un pays possédé ne rejoue pas la dissolution de (dé)sélection (pas de flash).
      const owned = Boolean(conquestOverlay?.colors?.[admin]);
      const prevTransition = owned ? null : transitioningPreviousCountryState;
      const incomingTransition = owned ? null : transitioningIncomingCountryState;
      const isFound = foundSet.has(admin);
      const isLearnSelected = !quiet && mode === "learn" && admin === selectedCountry;
      const isHighlightedOnGlobe =
        !quiet && (isFound || isLearnSelected || admin === selectedCountry);

      const restingColor = resolveRestingColorForFeature({
        d,
        kind,
        admin,
        isFound,
        isEndScreen,
        isPerfectScore,
        isRegionalMode,
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
        selectedCountry: quiet ? null : selectedCountry,
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
        transitioningPreviousCountryState: prevTransition,
        transitioningIncomingCountryState: incomingTransition,
        isDepartmentMode: isRegionalMode,
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
      conquestOverlay,
      getPolygonColor,
      getPolygonSideColor,
      globeLightingEnabled,
      UI_COLORS,
      selectedCountry,
      isRegionalMode,
      foundSet,
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
      modeTransitionRef,
      transitionStep,
      isQuietOwnedFocus,
    ]
  );

  const getPolygonCapMaterial = useCallback(
    (d) => getPolygonMaterial(d, "cap"),
    [getPolygonMaterial]
  );

  // Flat selection: no visible side walls (the outline lives on the cap surface).
  const getPolygonSideMaterial = useCallback(() => invisibleMaterial, []);

  // Per-country lookup is cheap to rebuild: reset it on every mode switch.
  useEffect(() => {
    const materialCache = polygonMaterialCacheRef.current;
    return () => {
      materialCache.cap.clear();
      materialCache.side.clear();
    };
  }, [globeLightingEnabled, mode, isRegionalMode]);

  // The shared material pool owns compiled GPU programs: disposing it on mode
  // switches forced shader recompiles; only theme/lighting invalidates it.
  useEffect(() => {
    const sharedPool = sharedMaterialsRef.current;
    return () => {
      sharedPool.forEach((material) => {
        unregisterAnimatedPolygonMaterial(material);
        material.dispose();
      });
      sharedPool.clear();
      clearAnimatedPolygonMaterials();
    };
  }, [globeLightingEnabled]);

  const getPolygonAltitude = useCallback(
    (d) => {
      if (d.isExitingDepartmentFeature) return POLYGON_ALTITUDE.exitingRegional;
      if (d.isParentCountryFeature && isRegionalMode) return POLYGON_ALTITUDE.parentBackdrop;
      const admin = getFeatureAdmin(d);
      const isSelected = isSameAdmin(admin, selectedCountry, gameDataMap);
      const isPrev = isSameAdmin(admin, transitioningPreviousCountryState, gameDataMap);
      const isIncoming = isSameAdmin(admin, transitioningIncomingCountryState, gameDataMap);
      return getPolygonAltitudeFor({
        isDepartmentMode: isRegionalMode,
        isGhostCountry: Boolean(isRegionalMode && d.isGhostCountry),
        isSelected: isSelected || isPrev || isIncoming,
      });
    },
    [
      isRegionalMode,
      selectedCountry,
      transitioningPreviousCountryState,
      transitioningIncomingCountryState,
      gameDataMap,
    ]
  );

  const getPolygonStrokeWidth = useModeTransitionStrokeWidth({
    modeTransitionRef,
    transitionStep,
    selectedCountry,
    isRegionalMode,
    foundSet,
    mode,
    globeLightingEnabled,
    perfProfile,
    UI_COLORS,
  });

  const getPolygonCurvatureResolution = useCallback(
    (d) => getFeatureCapResolution(d, perfProfile?.polygonCapCurvatureResolution ?? 1.5),
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
    isQuietOwnedFocus,
  };
}
