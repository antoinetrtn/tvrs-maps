import { useMemo } from "react";

import {
  isDepartmentView,
  isLearnRiversMountainsView,
  isUsStatesView,
} from "../../config/gameConfig";
import { countryDataMap } from "../../data/gameData";

export function useGlobeMapData({
  mode,
  isHomeScreen,
  learnSubMode,
  activeDataMap,
  foundList,
  perfProfile,
}) {
  const isDepartmentMode = isDepartmentView(mode, {
    isHomeScreen,
    learnSubMode,
  });
  const isUsStatesMode = isUsStatesView(mode, {
    isHomeScreen,
    learnSubMode,
  });
  const isRiversMountainsMode =
    mode === "rivers_mountains" || isLearnRiversMountainsView(mode, { learnSubMode });
  const gameDataMap =
    isDepartmentMode || isRiversMountainsMode || isUsStatesMode
      ? activeDataMap || {}
      : countryDataMap;

  const foundSet = useMemo(() => {
    if (isHomeScreen) {
      return new Set();
    }
    return new Set(foundList);
  }, [foundList, isHomeScreen]);

  const globeRendererConfig = useMemo(
    () => ({
      antialias: perfProfile?.antialias !== false,
      logarithmicDepthBuffer: false,
      powerPreference: "high-performance",
    }),
    [perfProfile?.antialias]
  );

  return {
    isDepartmentMode,
    isUsStatesMode,
    isRiversMountainsMode,
    gameDataMap,
    foundSet,
    globeRendererConfig,
  };
}
