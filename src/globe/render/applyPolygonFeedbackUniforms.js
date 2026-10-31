import { countryDataMap } from "../../data/gameData";
import { SECONDARY_CITIES_BY_COUNTRY } from "./capitalLightsData";
import { getFoundGreenThreeColor } from "./foundGreenPalette";
import { markIgnitingCountry, polygonGlitchUniforms } from "./polygonGlitchShader";

/** Push success/error flags to cached polygon shaders without waiting for React. */
export function applyPolygonFeedbackUniforms({
  polygonMaterialCacheRef,
  admin,
  isError = false,
  isSuccess = false,
  mountainGlitchUniforms,
}) {
  if (!admin || !polygonMaterialCacheRef?.current) return;

  const time = performance.now() / 1000;
  polygonGlitchUniforms.uTime.value = time;
  if (isSuccess) {
    // Stamp the success flash start so the shader's pixel-resolve runs 0 -> 1.
    polygonGlitchUniforms.uSuccessStart.value = time;
    stampCityIgnition(admin, time);
  }

  ["cap", "side"].forEach((kind) => {
    const mat = polygonMaterialCacheRef.current[kind]?.get(admin);
    const shader = mat?.userData?.shader;
    if (!shader?.uniforms) return;
    if (shader.uniforms.uIsError) {
      shader.uniforms.uIsError.value = isError ? 1.0 : 0.0;
    }
    if (shader.uniforms.uIsSuccess) {
      shader.uniforms.uIsSuccess.value = isSuccess ? 1.0 : 0.0;
    }
    if (shader.uniforms.uIsSelection) {
      shader.uniforms.uIsSelection.value = 0.0;
    }
  });

  if (mountainGlitchUniforms) {
    mountainGlitchUniforms.uTime.value = time;
    mountainGlitchUniforms.uIsError.value = isError ? 1.0 : 0.0;
    mountainGlitchUniforms.uIsSuccess.value = isSuccess ? 1.0 : 0.0;
    if (isError || isSuccess) {
      mountainGlitchUniforms.uFoundGreen.value.copy(getFoundGreenThreeColor());
    }
  }
}

const DEG = Math.PI / 180;
const angularDistance = (lat1, lng1, lat2, lng2) => {
  const a =
    Math.sin(lat1 * DEG) * Math.sin(lat2 * DEG) +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lng2 - lng1) * DEG);
  return Math.acos(Math.min(1, Math.max(-1, a)));
};

/**
 * Discovery ignition: aim the gold city-lights wave at the found country's capital.
 * Radius = farthest stamped secondary city (+ tentacle margin), so the whole urban
 * network of the country lights up; starts once the success flash settles.
 * Returns the stamped target (or null when the country has no capital lights).
 */
export function stampCityIgnition(admin, time = performance.now() / 1000) {
  const info = countryDataMap[admin];
  if (!info || !Number.isFinite(info.lat) || !Number.isFinite(info.lng)) return null;
  const { lat, lng } = info;
  let radius = 0.05;
  (SECONDARY_CITIES_BY_COUNTRY[admin] || []).forEach(([sLat, sLng]) => {
    radius = Math.max(radius, angularDistance(lat, lng, sLat, sLng) + 0.04);
  });
  radius = Math.min(radius, 0.6);
  markIgnitingCountry(admin);
  const cosLat = Math.cos(lat * DEG);
  polygonGlitchUniforms.uIgniteOrigin.value.set(
    cosLat * Math.sin(lng * DEG),
    Math.sin(lat * DEG),
    cosLat * Math.cos(lng * DEG)
  );
  polygonGlitchUniforms.uIgniteRadius.value = radius;
  polygonGlitchUniforms.uIgniteStart.value =
    time + polygonGlitchUniforms.uSuccessDuration.value * 0.5;
  polygonGlitchUniforms.uReducedMotion.value =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 1
      : 0;
  return { radius, start: polygonGlitchUniforms.uIgniteStart.value };
}
