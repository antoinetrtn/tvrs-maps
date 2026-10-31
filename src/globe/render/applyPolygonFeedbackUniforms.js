import { countryDataMap } from "../../data/gameData";
import { SECONDARY_CITIES_BY_COUNTRY } from "./capitalLightsData";
import { angularDistance, getCountryLandRadius } from "./countryLandRadius";
import { DISCOVERY } from "./discoveryTimeline";
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
    // Stamp the discovery reveal start (outline -> land front -> cities -> halo).
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

/**
 * Discovery reveal: aim the land front and the city-lights wave at the found country's
 * capital. Land radius = farthest polygon vertex (full coverage, even Russia/Canada);
 * city radius = farthest stamped secondary city (+ tentacle margin), widened to the land
 * radius when the country is bigger. Cities start CITY_DELAY_S behind the land front.
 * Returns the stamped target (or null when the country has no capital).
 */
export function stampCityIgnition(admin, time = performance.now() / 1000) {
  const info = countryDataMap[admin];
  if (!info || !Number.isFinite(info.lat) || !Number.isFinite(info.lng)) return null;
  const { lat, lng } = info;
  let cityRadius = 0.05;
  (SECONDARY_CITIES_BY_COUNTRY[admin] || []).forEach(([sLat, sLng]) => {
    cityRadius = Math.max(cityRadius, angularDistance(lat, lng, sLat, sLng) + 0.04);
  });
  cityRadius = Math.min(cityRadius, 0.6);
  const landRadius = Math.min(
    Math.max(getCountryLandRadius(admin, lat, lng) ?? cityRadius * 1.3, 0.02),
    Math.PI
  );
  const radius = Math.min(Math.max(cityRadius, landRadius), Math.PI);
  const cosLat = Math.cos(lat * DEG);
  const g = polygonGlitchUniforms;
  g.uIgniteOrigin.value.set(
    cosLat * Math.sin(lng * DEG),
    Math.sin(lat * DEG),
    cosLat * Math.cos(lng * DEG)
  );
  g.uIgniteRadius.value = radius;
  g.uIgniteDuration.value = DISCOVERY.CITY_S;
  g.uIgniteStart.value = time + DISCOVERY.CITY_DELAY_S;
  g.uRevealStart.value = time;
  g.uLandRadius.value = landRadius;
  g.uReducedMotion.value =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 1
      : 0;
  markIgnitingCountry(admin);
  return { radius, landRadius, start: g.uIgniteStart.value, revealStart: time };
}
