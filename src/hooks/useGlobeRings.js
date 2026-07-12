import { useMemo, useCallback } from "react";
import { countryDataMap } from "../data/gameData";
import { getOpaqueThreeColor } from "../config/designSystem";

export function useGlobeRings({
  mode,
  isDepartmentMode,
  isRiversMountainsMode,
  selectedCountry,
  isError,
  UI_COLORS,
  gameDataMap,
}) {
  const ringsData = useMemo(() => {
    if (!selectedCountry) return [];

    let targetData = isDepartmentMode
      ? gameDataMap[selectedCountry]
      : isRiversMountainsMode
        ? gameDataMap[selectedCountry]
        : countryDataMap[selectedCountry];

    if (
      !targetData ||
      targetData.lat === undefined ||
      targetData.lng === undefined
    ) {
      return [];
    }

    return [
      {
        admin: selectedCountry,
        lat: targetData.lat,
        lng: targetData.lng,
      },
    ];
  }, [selectedCountry, isDepartmentMode, isRiversMountainsMode, gameDataMap]);

  const getRingColorWrapped = useCallback(
    () =>
      getOpaqueThreeColor(
        isError ? UI_COLORS.errorGlowStrong : UI_COLORS.accentGlowStrong,
      ),
    [isError, UI_COLORS],
  );

  const getRingMaxRadiusWrapped = useCallback(
    () => (isDepartmentMode || isRiversMountainsMode ? 1.6 : 3.6),
    [isDepartmentMode, isRiversMountainsMode],
  );

  const getRingSpeedWrapped = useCallback(() => 2.4, []);
  const getRingRepeatWrapped = useCallback(() => 2, []);

  const getSelectionEffectAltitude = useCallback(
    () => (isDepartmentMode || isRiversMountainsMode ? 0.0035 : 0.0055),
    [isDepartmentMode, isRiversMountainsMode],
  );

  return {
    ringsData,
    getRingColorWrapped,
    getRingMaxRadiusWrapped,
    getRingSpeedWrapped,
    getRingRepeatWrapped,
    getSelectionEffectAltitude,
  };
}
