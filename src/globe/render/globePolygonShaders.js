import { getBiomeTexture } from "./biomeTexture";
import { getCapitalLightsTexture } from "./capitalLightsTexture";
import { getFeatureMaskTexture } from "./featureMask";
import {
  COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY,
  DISCOVERY_DEFS,
  GLSL_BAYER_4X4_FN,
  GLSL_DISCOVERY_LAND_FN,
} from "./globeShaders";
import {
  PAINTED_GLSL_BODY,
  PAINTED_GLSL_DECLARATIONS,
  paintedTerrainUniforms,
} from "./paintedTerrain";
import { polygonGlitchUniforms } from "./polygonGlitchShader";

// Painted France goes in right before the found-land reveal mask (globeShaders.js).
const PAINTED_ANCHOR = "      // Found land (solo tone or Conquête";

/** WebGPU: per-material ignition values read through materialReference (holder or globals). */
export function defineIgniteReferences(material, igniteHolder) {
  const g = polygonGlitchUniforms;
  const refs = {
    igniteSelf: () => (igniteHolder ? igniteHolder.self.value : 0),
    igniteOrigin: () => (igniteHolder ? igniteHolder.origin.value : g.uIgniteOrigin.value),
    igniteStart: () => (igniteHolder ? igniteHolder.start.value : g.uIgniteStart.value),
    igniteRadius: () => (igniteHolder ? igniteHolder.radius.value : g.uIgniteRadius.value),
    igniteDuration: () => (igniteHolder ? igniteHolder.duration.value : g.uIgniteDuration.value),
    revealStart: () => (igniteHolder ? igniteHolder.revealStart.value : g.uRevealStart.value),
    landRadius: () => (igniteHolder ? igniteHolder.landRadius.value : g.uLandRadius.value),
  };
  Object.entries(refs).forEach(([name, get]) => {
    Object.defineProperty(material.userData, name, { get, enumerable: true });
  });
}

export function applyCountrySurfaceGrainShader(
  shader,
  { isGhostCountry = false, igniteHolder = null } = {}
) {
  // A country mid-reveal reads its own holder (origin, timeline, radii); others the globals.
  const g = polygonGlitchUniforms;
  shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
  shader.uniforms.uTime = polygonGlitchUniforms.uTime;
  shader.uniforms.uShowcaseLights = polygonGlitchUniforms.uShowcaseLights;
  shader.uniforms.uIsRegionalMode = polygonGlitchUniforms.uIsRegionalMode;
  shader.uniforms.uFeatureMode = polygonGlitchUniforms.uFeatureMode;
  shader.uniforms.uFeatureMap = { value: getFeatureMaskTexture() };
  shader.uniforms.uIgniteOrigin = igniteHolder ? igniteHolder.origin : g.uIgniteOrigin;
  shader.uniforms.uIgniteStart = igniteHolder ? igniteHolder.start : g.uIgniteStart;
  shader.uniforms.uIgniteRadius = igniteHolder ? igniteHolder.radius : g.uIgniteRadius;
  shader.uniforms.uIgniteDuration = igniteHolder ? igniteHolder.duration : g.uIgniteDuration;
  shader.uniforms.uRevealStart = igniteHolder ? igniteHolder.revealStart : g.uRevealStart;
  shader.uniforms.uLandRadius = igniteHolder ? igniteHolder.landRadius : g.uLandRadius;
  shader.uniforms.uReducedMotion = polygonGlitchUniforms.uReducedMotion;
  shader.uniforms.uHomeWake = polygonGlitchUniforms.uHomeWake;
  shader.uniforms.uIsGhost = { value: isGhostCountry ? 1.0 : 0.0 };
  shader.uniforms.uIgniteSelf = igniteHolder ? igniteHolder.self : { value: 0.0 };
  shader.uniforms.uCapitalLightsMap = { value: getCapitalLightsTexture() };
  shader.uniforms.uBiomeMap = { value: getBiomeTexture() };
  Object.assign(shader.uniforms, paintedTerrainUniforms);
  shader.vertexShader = `
    varying vec3 vDitherWorldNormal;
    varying vec3 vDitherWorldPos;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    uniform float uPixelScale;
    ${shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vDitherWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vDitherWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWorldPos = vDitherWorldPos;
      vViewDir = cameraPosition - vDitherWorldPos;
      `
    )}
  `;
  shader.fragmentShader = `
    varying vec3 vDitherWorldNormal;
    varying vec3 vDitherWorldPos;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    uniform float uPixelScale;
    uniform float uTime;
    uniform float uShowcaseLights;
    uniform float uIsRegionalMode;
    uniform float uFeatureMode;
    uniform sampler2D uFeatureMap;
    uniform float uIsGhost;
    uniform float uIgniteSelf;
    uniform vec3 uIgniteOrigin;
    uniform float uIgniteStart;
    uniform float uIgniteRadius;
    uniform float uIgniteDuration;
    uniform float uRevealStart;
    uniform float uLandRadius;
    uniform float uReducedMotion;
    uniform float uHomeWake;
    uniform sampler2D uCapitalLightsMap;
    uniform sampler2D uBiomeMap;
${PAINTED_GLSL_DECLARATIONS}    ${GLSL_BAYER_4X4_FN}
    float cityCellHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    ${DISCOVERY_DEFS}
    ${GLSL_DISCOVERY_LAND_FN}
    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY.replace(
        PAINTED_ANCHOR,
        PAINTED_GLSL_BODY + PAINTED_ANCHOR
      )
    )}
  `;
}

export function applyCountryBorderDitherShader(shader) {
  shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
  shader.vertexShader = `
    varying vec3 vBorderWorldPos;
    uniform float uPixelScale;
    ${shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vBorderWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
    )}
  `;
  shader.fragmentShader = `
    varying vec3 vBorderWorldPos;
    uniform float uPixelScale;
    ${GLSL_BAYER_4X4_FN}
    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      vec3 borderDir = normalize(vBorderWorldPos);
      float borderLat = asin(clamp(borderDir.y, -1.0, 1.0));
      float borderLng = atan(borderDir.z, borderDir.x);
      float bayer = bayer4x4(floor(vec2(borderLng * 180.0, borderLat * 180.0)));
      float arcPhase = dot(vBorderWorldPos, vec3(0.24, 0.36, 0.48));
      float borderStep = step(0.35, fract(arcPhase + bayer * 0.35));
      float isFoundBorder = step(0.28, gl_FragColor.g)
        * step(gl_FragColor.b * 1.30, gl_FragColor.g)
        * step(gl_FragColor.r * 2.2, gl_FragColor.b);
      vec3 borderColor = mix(gl_FragColor.rgb, vec3(0.98, 0.76, 0.28), isFoundBorder);
      gl_FragColor.rgb = borderColor * mix(0.92, 1.12, borderStep);
      `
    )}
  `;
}
