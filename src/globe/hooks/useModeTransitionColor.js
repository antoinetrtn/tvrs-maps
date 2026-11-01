import { useCallback } from "react";

import { countryDataMap } from "../../data/gameData";
import { getFeatureAdmin } from "../../utils/utils";
import {
  getTransitionState,
  resolveGhostCountryColor,
  resolveModeTransitionColor,
  resolveModeTransitionStrokeWidth,
  resolvePolygonStrokeWidth,
} from "../render/polygonColorResolver";

/** Mode (layer) transition: stepped cross-fade of the outgoing / incoming layers. */
export function useModeTransitionColor({
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
}) {
  return useCallback(
    (d) => {
      const transState = getTransitionState(modeTransitionRef, transitionStep);
      if (!transState) return getBasePolygonColor(d);
      const transColor = resolveModeTransitionColor({
        d,
        transState,
        countryDataMap,
        gameDataMap,
        REGION_COLORS_LABELS,
        REGION_COLORS_ATTENUATED,
        UI_COLORS,
        getRegionSurfaceColor,
        getRegionSurfaceColorDimmed,
        getGhostColor: getGhostWorldColor,
        getFeatureMonochromeShade,
        lerpColor,
      });
      if (transColor) return transColor;
      if (transState.isExitingRegional && !d.isGhostCountry) {
        // World country coming back from the dimmed regional look.
        const region = countryDataMap[getFeatureAdmin(d)]?.region || "Americas";
        return lerpColor(getGhostWorldColor(region), getBasePolygonColor(d), transState.progress);
      }
      return getBasePolygonColor(d);
    },
    [
      getBasePolygonColor,
      modeTransitionRef,
      transitionStep,
      gameDataMap,
      REGION_COLORS_LABELS,
      REGION_COLORS_ATTENUATED,
      UI_COLORS,
      getRegionSurfaceColor,
      getRegionSurfaceColorDimmed,
      getGhostWorldColor,
      getFeatureMonochromeShade,
      lerpColor,
    ]
  );
}

/** Rest of the world in regional modes: dimmed toward the sea. */
export function useGhostWorldColor({ getRegionSurfaceColorDimmed, lerpColor, UI_COLORS }) {
  return useCallback(
    (region) =>
      resolveGhostCountryColor(null, countryDataMap, {
        fallbackRegionColor: getRegionSurfaceColorDimmed(region),
        lerpColor,
        mapSea: UI_COLORS.mapSea,
      }),
    [getRegionSurfaceColorDimmed, lerpColor, UI_COLORS]
  );
}

export function useModeTransitionStrokeWidth({
  modeTransitionRef,
  transitionStep,
  selectedCountry,
  isRegionalMode,
  foundSet,
  mode,
  globeLightingEnabled,
  perfProfile,
  UI_COLORS,
}) {
  return useCallback(
    (d) => {
      const transState = getTransitionState(modeTransitionRef, transitionStep);
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
        globeLightingEnabled,
        perfProfile,
        UI_COLORS,
      });
    },
    [
      modeTransitionRef,
      transitionStep,
      selectedCountry,
      isRegionalMode,
      foundSet,
      mode,
      globeLightingEnabled,
      perfProfile,
      UI_COLORS,
    ]
  );
}
