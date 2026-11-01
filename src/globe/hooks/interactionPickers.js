import { featureContainsLngLat } from "../../utils/utils";
import { snapMicroAtScreen } from "../microSnap";
import { pickRiverOrRelief } from "../pickFallback";

export function pickRiversMountainsCountry(gameDataMap, lng, lat, mode, selectCountry) {
  const riverPick = pickRiverOrRelief(gameDataMap, lng, lat);
  if (riverPick) {
    selectCountry(riverPick);
    return true;
  }
  if (mode !== "learn") {
    selectCountry(null);
    return true;
  }
  return false;
}

export function pickFeatureOrMicro({
  lng,
  lat,
  screen,
  globeEl,
  gameDataMap,
  selectableFeatureIndex,
  isDepartmentMode,
  isUsStatesMode,
  project,
}) {
  const match = selectableFeatureIndex.find((entry) => featureContainsLngLat(entry, lng, lat));
  if (project && !isDepartmentMode && !isUsStatesMode) {
    const micro = snapMicroAtScreen({
      globeEl,
      project,
      gameDataMap,
      lng,
      lat,
      screen,
      insideOther: Boolean(match),
    });
    if (micro) return micro.admin;
  }
  if (match) return match.admin;
  if (lat <= -60.0 && Object.hasOwn(gameDataMap, "Antarctica") && gameDataMap["Antarctica"]) {
    return "Antarctica";
  }
  return null;
}

export function applyFallbackSelection(target, mode, selectCountry) {
  if (target) {
    selectCountry(target);
  } else if (mode !== "learn") {
    selectCountry(null);
  }
}

export function getDegreeFallbackRadius(isDepartmentMode, isUsStatesMode) {
  if (isDepartmentMode) return 2.5;
  if (isUsStatesMode) return 4.5;
  return 6.0;
}
