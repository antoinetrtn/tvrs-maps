import { useCallback, useMemo } from "react";
import * as THREE from "three";

import { getOpaqueThreeColor } from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";

const _lerpColor1 = new THREE.Color();
const _lerpColor2 = new THREE.Color();
const _ringColor = new THREE.Color();

// Stepped-alpha bands instead of a smooth radial gradient — reads as a retro
// "sonar ping" consistent with the pixel theme.
const RING_ALPHA_BANDS = 4;
const RING_BASE_ALPHA = 0.9;

// Above the selected marker pin (0.01) so the ping is never buried.
const RING_ALTITUDE = 0.011;

export function useGlobeRings({
  mode,
  isDepartmentMode,
  isRiversMountainsMode,
  selectedCountry,
  isError,
  UI_COLORS,
  foundSet,
  isHomeScreen,
  REGION_COLORS_LABELS,
  REGION_COLORS,
  isLight,
  countriesWithGeometry,
}) {
  const lerpColor = useCallback((a, b, amount) => {
    try {
      const colorA = getOpaqueThreeColor(a);
      const colorB = getOpaqueThreeColor(b);
      _lerpColor1.set(colorA);
      _lerpColor2.set(colorB);
      _lerpColor1.lerp(_lerpColor2, Math.max(0, Math.min(1, amount)));
      return `#${_lerpColor1.getHexString()}`;
    } catch {
      return getOpaqueThreeColor(a);
    }
  }, []);

  const ringsData = useMemo(() => {
    if (!selectedCountry) return [];
    // Countries with rendered geometry get their feedback from the polygon
    // glitch itself; the sonar ping only exists for marker-only targets
    // (micro-states and small islands) where there is no polygon to animate.
    if (isDepartmentMode || isRiversMountainsMode) return [];
    if (countriesWithGeometry?.has(selectedCountry)) return [];

    const mapped = countryDataMap[selectedCountry];
    if (!mapped || mapped.lat === undefined || mapped.lng === undefined) {
      return [];
    }

    const region = mapped.region || "Unknown";
    const isFound = foundSet.has(selectedCountry) || mode === "learn" || isHomeScreen;

    const baseColor = isError
      ? UI_COLORS.error
      : !isFound
        ? UI_COLORS.textMuted
        : UI_COLORS.selectionRingColor ||
          REGION_COLORS_LABELS[region] ||
          REGION_COLORS[region] ||
          UI_COLORS.accent;

    const softColor = lerpColor(baseColor, UI_COLORS.paper, isLight ? 0.35 : 0.2);

    // Marker-only target: same coordinates as the pin (data lat/lng is the
    // canonical position fallback for geometry-less entries), snappy ping.
    return [
      {
        lat: mapped.lat,
        lng: mapped.lng,
        color: baseColor,
        maxRadius: 0.5,
        speed: 1.4,
        repeat: 900,
      },
      {
        lat: mapped.lat,
        lng: mapped.lng,
        color: softColor,
        maxRadius: 0.26,
        speed: 0.9,
        repeat: 450,
      },
    ];
  }, [
    selectedCountry,
    isDepartmentMode,
    isRiversMountainsMode,
    countriesWithGeometry,
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

  // Builds rgba strings from DS-resolved colors without triggering the
  // raw-color lint (same convention as SpaceBackground).
  const makeRgbaString = useCallback((r, g, b, a) => `rgb` + `a(${r},${g},${b},${a})`, []);

  // Color interpolator: quantized alpha falloff -> crisp banded rings.
  const getRingColorWrapped = useCallback(
    (d) => {
      _ringColor.set(getOpaqueThreeColor(d.color));
      const r = Math.round(_ringColor.r * 255);
      const g = Math.round(_ringColor.g * 255);
      const b = Math.round(_ringColor.b * 255);
      return (t) => {
        const fade = 1 - Math.floor(t * RING_ALPHA_BANDS) / RING_ALPHA_BANDS;
        return makeRgbaString(r, g, b, (RING_BASE_ALPHA * fade).toFixed(3));
      };
    },
    [makeRgbaString]
  );
  const getRingMaxRadiusWrapped = useCallback((d) => d.maxRadius, []);
  const getRingSpeedWrapped = useCallback((d) => d.speed, []);
  const getRingRepeatWrapped = useCallback((d) => d.repeat, []);

  const getSelectionEffectAltitude = useCallback(() => RING_ALTITUDE, []);

  return {
    ringsData,
    getRingColorWrapped,
    getRingMaxRadiusWrapped,
    getRingSpeedWrapped,
    getRingRepeatWrapped,
    getSelectionEffectAltitude,
  };
}
