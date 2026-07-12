import { useMemo, useCallback } from "react";
import * as THREE from "three";
import { countryDataMap } from "../data/gameData";
import { getOpaqueThreeColor } from "../config/designSystem";

const _lerpColor1 = new THREE.Color();
const _lerpColor2 = new THREE.Color();

export function useGlobeRings({
  mode,
  isDepartmentMode,
  isRiversMountainsMode,
  selectedCountry,
  isError,
  UI_COLORS,
  gameDataMap,
  foundSet,
  isHomeScreen,
  REGION_COLORS_LABELS,
  REGION_COLORS,
  isLight,
}) {
  const lerpColor = useCallback(
    (a, b, amount) => {
      try {
        const colorA = getOpaqueThreeColor(a);
        const colorB = getOpaqueThreeColor(b);
        _lerpColor1.set(colorA);
        _lerpColor2.set(colorB);
        _lerpColor1.lerp(_lerpColor2, Math.max(0, Math.min(1, amount)));
        return `#${_lerpColor1.getHexString()}`;
      } catch (e) {
        return getOpaqueThreeColor(a);
      }
    },
    [],
  );

  const ringsData = useMemo(() => {
    if (!selectedCountry) return [];

    const mapped = isDepartmentMode
      ? gameDataMap[selectedCountry]
      : isRiversMountainsMode
        ? gameDataMap[selectedCountry]
        : countryDataMap[selectedCountry];

    if (mapped?.type === "river") return [];
    if (!mapped || mapped.lat === undefined || mapped.lng === undefined) {
      return [];
    }

    const region = mapped.region || "Unknown";
    const isFound =
      foundSet.has(selectedCountry) || mode === "learn" || isHomeScreen;

    const baseColor = isError
      ? UI_COLORS.error
      : !isFound
        ? UI_COLORS.textMuted
        : UI_COLORS.selectionRingColor ||
          REGION_COLORS_LABELS[region] ||
          REGION_COLORS[region] ||
          UI_COLORS.accent;

    const softColor = lerpColor(
      baseColor,
      UI_COLORS.paper,
      isLight ? 0.35 : 0.2,
    );

    if (isDepartmentMode || isRiversMountainsMode) {
      return [
        {
          lat: mapped.lat,
          lng: mapped.lng,
          color: baseColor,
          maxRadius: 0.32,
          speed: 0.16,
          repeat: 2800,
        },
      ];
    }

    return [
      {
        lat: mapped.lat,
        lng: mapped.lng,
        color: baseColor,
        maxRadius: 0.3,
        speed: 0.6,
        repeat: 800,
      },
      {
        lat: mapped.lat,
        lng: mapped.lng,
        color: softColor,
        maxRadius: 1.8,
        speed: 2.2,
        repeat: 1800,
      },
      {
        lat: mapped.lat,
        lng: mapped.lng,
        color: softColor,
        maxRadius: 3.5,
        speed: 3.8,
        repeat: 1800,
      },
    ];
  }, [
    selectedCountry,
    isDepartmentMode,
    isRiversMountainsMode,
    gameDataMap,
    foundSet,
    mode,
    isHomeScreen,
    isError,
    UI_COLORS,
    REGION_COLORS_LABELS,
    REGION_COLORS,
    isLight,
    lerpColor,
  ]);

  const getRingColorWrapped = useCallback((d) => d.color, []);
  const getRingMaxRadiusWrapped = useCallback((d) => d.maxRadius, []);
  const getRingSpeedWrapped = useCallback((d) => d.speed, []);
  const getRingRepeatWrapped = useCallback((d) => d.repeat, []);

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
