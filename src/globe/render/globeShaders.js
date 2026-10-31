import { DISCOVERY_DEFS, discoveryLandFn, GLSL_DISCOVERY_LAND_FN } from "./discoveryShaderChunks";
export { DISCOVERY_DEFS, GLSL_DISCOVERY_LAND_FN };
import * as FEAT from "./featureModeShaderChunks";
import { SELECTION_STYLE_DEFS } from "./selectionStyle";
/**
 * ==========================================
 * GLOBE GLSL SHADERS
 * ==========================================
 *
 * Raw GLSL for the custom "inner glow" atmosphere halo rendered behind the globe.
 * Extracted from GlobeMap.jsx so the (verbose, rarely-touched) shader source does
 * not clutter the component. Uniforms are driven from GlobeMap.
 */

/**
 * Exact 4x4 Bayer matrix lookup in [0, 15/16].
 * Periodic mod 4 in x and y, matching SpaceBackground.jsx's BAYER_4X4 matrix.
 */
export function evaluateBayer4x4(x, y) {
  const xi = ((Math.floor(x) % 4) + 4) % 4;
  const yi = ((Math.floor(y) % 4) + 4) % 4;
  const p0x = xi % 2;
  const p0y = yi % 2;
  const p1x = Math.floor(xi / 2) % 2;
  const p1y = Math.floor(yi / 2) % 2;
  const b0 = p0x * 2 + p0y * (3 - 4 * p0x);
  const b1 = p1x * 2 + p1y * (3 - 4 * p1x);
  return (4 * b0 + b1) / 16;
}

export const GLSL_BAYER_4X4_FN = `
  float bayer2x2(vec2 v) {
    return v.x * 2.0 + v.y * (3.0 - 4.0 * v.x);
  }
  float bayer4x4(vec2 px) {
    vec2 p0 = floor(mod(px, 2.0));
    vec2 p1 = floor(mod(floor(px * 0.5), 2.0));
    return (4.0 * bayer2x2(p0) + bayer2x2(p1)) / 16.0;
  }
`;

// View-space normal/position to the fragment stage (per-pixel perspective Fresnel).
export const FRESNEL_VERTEX_SHADER = `
  varying vec3 vAtmosphereNormal;
  varying vec3 vAtmosphereViewPos;
  void main() {
    vAtmosphereNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vAtmosphereViewPos = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Soft atmospheric rim: brightest near the horizon, fading to fully transparent
// toward the centre of the disc and out into space. Rendered on a BackSide sphere.
export const FRESNEL_FRAGMENT_SHADER = `
  varying vec3 vAtmosphereNormal;
  varying vec3 vAtmosphereViewPos;
  uniform vec3 glowColor;
  uniform float coef;
  uniform float power;
  ${GLSL_BAYER_4X4_FN}
  void main() {
    vec3 normal = normalize(vAtmosphereNormal);
    vec3 viewDir = normalize(vAtmosphereViewPos);

    // View/normal dot on the BackSide sphere: positive on the back hemisphere.
    float x = clamp(dot(normal, viewDir), 0.0, 1.0);

    // Soft gradient: max at the horizon (x = 0.62), 0 in space (x = 0).
    float edgeFade = smoothstep(0.0, 0.62, x);

    float exponent = max(1.8, power * 2.0);
    float rawIntensity = pow(edgeFade, exponent) * coef;

    vec2 rimCell = floor((normal.xy * 0.5 + 0.5) * 960.0);
    float bayer = bayer4x4(rimCell);
    float dithered = floor(rawIntensity * 5.0 + bayer) / 5.0;
    float intensity = mix(rawIntensity, dithered, 0.82);

    gl_FragColor = vec4(glowColor, intensity);
  }
`;

// Vertices coordinate definitions for custom polygon effects.
// World-space is required: mesh-local bounds vary wildly per country (Algeria vs
// Luxembourg) and low-frequency local UVs produced globe-sized static bands.
// Dim amber of a selected (not yet found) country's city pixels — shared by the
// selection shader and the found ignition so the hand-off is seamless.

export const SELECT_CITY_AMBER_RGB = [0.78, 0.52, 0.18];
export const SELECT_CITY_ALPHA_VALUE = 0.6;
const SELECT_CITY_DEFS = `
  ${SELECTION_STYLE_DEFS}
  #define SELECT_CITY_AMBER vec3(${SELECT_CITY_AMBER_RGB.join(", ")})
  #define SELECT_CITY_ALPHA ${SELECT_CITY_ALPHA_VALUE.toFixed(2)}
`;

export const GLITCH_VERTEX_DECLARATIONS = `
  varying vec3 vWorldPosition;
`;

export const GLITCH_VERTEX_BODY = `
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

// Uniforms declarations for country polygon shader
export const GLITCH_FRAGMENT_DECLARATIONS = `
  varying vec3 vWorldPosition;
  uniform float uTime;
  uniform float uFadeProgress;
  uniform vec3 uTargetColor;
  uniform float uIsError;
  uniform float uIsSuccess;
  uniform float uIsSelection;
  uniform float uIsSide;
  uniform float uIsFound;
  uniform float uSelectInTransition;
  uniform float uPixelScale;
  uniform float uSideShade;
  uniform float uSuccessStart;
  uniform float uSelectStart;
  uniform float uShowcaseLights;
  uniform float uIsRegionalMode;
${FEAT.FEATURE_DECLARATIONS}
  uniform sampler2D uCapitalLightsMap;
  uniform sampler2D uBiomeMap;
  uniform sampler2D uSelOutlineMap;
  uniform vec4 uSelOutlineBox;
  ${SELECT_CITY_DEFS}
  uniform float uSuccessDuration;
  uniform float uRevealStart;
  uniform float uLandRadius;
  uniform vec3 uIgniteOrigin;
  uniform float uReducedMotion;
  ${DISCOVERY_DEFS}
  uniform vec3 uGlitchTintA;
  uniform vec3 uGlitchTintB;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  vec3 computeErrorEffect(vec3 finalColor, float time, vec2 noiseUv, vec3 worldPos) {
    float pulse = sin(time * 24.0) * 0.4 + 0.6;
    float sweep = step(fract(worldPos.y * 0.24 - time * 6.0), 0.2) * 0.5;
    float errorNoise = hash(noiseUv + sin(time * 60.0));
    float noisyIntensity = (pulse + sweep) * mix(0.6, 1.4, errorNoise);
    vec3 errorRed = vec3(1.0, 0.05, 0.01) * (noisyIntensity + 0.3);

    // Ultra-strong red-cyan chromatic split on fail
    float chroma = (errorNoise - 0.5) * 0.62;
    vec3 splitColor;
    splitColor.r = clamp(errorRed.r + chroma * 0.5, 0.0, 1.0);
    splitColor.g = clamp(errorRed.g - abs(chroma) * 0.6, 0.0, 1.0);
    splitColor.b = clamp(errorRed.b - chroma * 0.5, 0.0, 1.0);

    // Neon stroboscopic dropouts
    if (errorNoise > 0.85) {
      splitColor = mix(splitColor, vec3(0.0, 1.0, 1.0), 0.75); // Cyan flash
    } else if (errorNoise < 0.15) {
      splitColor = mix(splitColor, vec3(1.0, 0.0, 1.0), 0.75); // Magenta flash
    }

    return splitColor;
  }
  ${discoveryLandFn("hash")}
  // Discovery reveal, success window (selection shader still active until auto-advance):
  // the land front leaves the capital in square-pixel steps towards the found tone, the
  // surface pixel outline turns amber ahead of it. No full-country flash.
  vec3 computeDiscoveryEffect(vec3 staticColor, vec3 foundColor, vec3 dir, vec2 cell, float isWall) {
    float revealT = uTime - uRevealStart;
    float dist = acos(clamp(dot(dir, uIgniteOrigin), -1.0, 1.0));
    float landStep = discoveryLandStep(revealT, dist, uLandRadius, cell);
    vec3 color = mix(staticColor, foundColor, landStep);
    float outlineIn = floor(clamp(revealT / DISC_OUTLINE_S, 0.0, 1.0) * 2.0) / 2.0;
    float outline = isWall * outlineIn * (1.0 - landStep) * (1.0 - uReducedMotion);
    return mix(color, SELECT_CITY_AMBER / max(uSideShade, 0.001), outline * DISC_OUTLINE_ALPHA);
  }
  vec3 computeSelectionEffect(float time) {
    float pulse = sin(time * 3.2) * 0.08 + 0.92;
    return vec3(0.92, 0.68, 0.24) * (pulse * 0.72 + 0.16);
  }
`;

// GLSL fragment logic for selected/transitioning country polygon glitching
export const GLITCH_FRAGMENT_BODY = `
  vec3 litRestingColor = gl_FragColor.rgb;

  float transitionActive = step(0.006, uFadeProgress) * (1.0 - step(0.994, uFadeProgress));
  float selectInScale = mix(1.0, 0.52, step(0.5, uSelectInTransition));
  float glitchAmp = transitionActive * (0.4 + 0.6 * sin(uFadeProgress * 3.14159)) * selectInScale;

  vec3 sphereDir = normalize(vWorldPosition);
  float sphereLat = asin(clamp(sphereDir.y, -1.0, 1.0));
  float sphereLng = atan(sphereDir.z, sphereDir.x);
  vec2 fragPx = vec2(sphereLng * cos(sphereLat * 0.65), sphereLat) * 520.0;
  vec2 blockUv = floor(fragPx * 0.85);

  // Selection: the country's real city-light pixels (same texture cells as the found
  // ignition) glow dim amber in stepped order, border traced in square pixels.
  float isWall = step(0.5, uIsSide);
  // Flat selection (no extrusion): pixel outline read from the per-selection mask, on
  // a lat/lng grid of uSelOutlineBox.zw degrees (square cells on the globe, see selectionOutline.js).
  vec2 selDeg = vec2(degrees(atan(sphereDir.x, sphereDir.z)), degrees(sphereLat));
  vec2 selCellSize = uSelOutlineBox.zw;
  vec2 selOc = (selDeg - uSelOutlineBox.xy) / selCellSize;
  selOc.x = mod(selOc.x, 360.0 / selCellSize.x);
  vec2 selOcCell = floor(selOc);
  float selInBox = step(0.0, selOc.x) * step(selOc.x, 1024.0) * step(0.0, selOc.y) * step(selOc.y, 1024.0);
  vec2 selOcUv = (selOcCell + 0.5) / 1024.0;
  float selEdgeV = texture2D(uSelOutlineMap, selOcUv).r * selInBox * (1.0 - isWall);
  float selectIn = clamp((uTime - uSelectStart) / 0.5, 0.0, 1.0);
  float lightProg = (transitionActive > 0.5) ? 1.0 - floor(uFadeProgress * 5.0) / 5.0 : floor(selectIn * 6.0) / 6.0;
  vec2 selUv = vec2(atan(sphereDir.x, sphereDir.z) / 6.2831853 + 0.5, sphereLat / 3.14159265 + 0.5);
  vec2 selCell = floor(selUv * vec2(3600.0, 1800.0));
  float isCityPx = step(0.25, texture2D(uCapitalLightsMap, selUv).r) * (1.0 - isWall);
  float cityOn = isCityPx * step(hash(selCell + 3.7), lightProg * 1.15 - 0.15);
  float wallOn = isWall * step(hash(floor(fragPx * 0.5) + 7.0), lightProg * 2.0);
  float edgeOn = step(hash(selOcCell + 7.0), lightProg * 2.0);
  float edgeOuter = step(0.9, selEdgeV) * edgeOn;
  float edgeHalo = step(0.15, selEdgeV) * (1.0 - step(0.9, selEdgeV)) * edgeOn;
  // Halo breathes in a few flat steps (pixel-art, no strobe); still under reduced motion.
  float pulseWave = 0.5 + 0.5 * sin(uTime * 6.2831853 / SELECT_PULSE_S);
  float pulse = mix(floor(pulseWave * SELECT_PULSE_STEPS + 0.5) / SELECT_PULSE_STEPS, 0.6, uReducedMotion);
  float haloAmt = edgeHalo * selEdgeV * SELECT_HALO_ALPHA * (0.35 + 0.65 * pulse);
  // Warm night umber under the selection instead of the cold map grey.
  vec3 selLand = vec3(dot(litRestingColor, vec3(0.299, 0.587, 0.114))) * SELECT_LAND_TINT;
  vec3 wallTone = vec3(1.0, 0.74, 0.3) / max(uSideShade, 0.001);
  vec3 staticVec = mix(mix(litRestingColor, selLand, 1.0 - isWall), wallTone, wallOn);
  staticVec = mix(staticVec, SELECT_CITY_AMBER, cityOn * SELECT_CITY_ALPHA);
  staticVec = mix(staticVec, SELECT_EDGE_RGB, haloAmt);
  staticVec = mix(staticVec, SELECT_EDGE_RGB, edgeOuter);
  vec3 foundRestingColor = vec3(0.48, 0.34, 0.15);
  // Resting unfound land, same formula as the surface blackout pass (unfoundLand): the
  // deselect fade settles to it instead of the raw lit grey (grey flash on deselect).
  float restBlackout = (1.0 - uShowcaseLights) * (1.0 - uIsRegionalMode);
  vec3 restGrey = vec3(dot(litRestingColor, vec3(0.299, 0.587, 0.114)))
    * mix(BLACKOUT_TINT, BLACKOUT_TINT_HOME, uShowcaseLights);
  vec3 unfoundRestColor = mix(litRestingColor, restGrey, restBlackout * 0.88)
    * mix(1.0, mix(0.36, 0.74, uIsRegionalMode), 1.0 - uShowcaseLights);
  vec4 biomeS = texture2D(uBiomeMap, selUv);
  float ndv = clamp(dot(sphereDir, normalize(cameraPosition - vWorldPosition)), 0.0, 1.0);
  unfoundRestColor = mix(unfoundRestColor, biomeS.rgb * (0.88 + 0.18 * (1.0 - ndv)),
    uShowcaseLights * uIsRegionalMode * biomeS.a * (1.0 - isWall) * 0.92);
  float deselectDone = step(0.994, uFadeProgress);

  vec3 finalColor = gl_FragColor.rgb;
  if (uIsError > 0.5) {
    finalColor = computeErrorEffect(gl_FragColor.rgb, uTime, blockUv, vWorldPosition);
  } else if (uIsSuccess > 0.5) {
    float discEdge = max(isWall, step(0.9, selEdgeV));
    finalColor = computeDiscoveryEffect(staticVec, foundRestingColor, sphereDir, selCell, discEdge);
  } else if (uIsSelection > 0.5) {
    finalColor = computeSelectionEffect(uTime);
  } else if (uIsFound > 0.5) {
    finalColor = foundRestingColor;
  } else {
    finalColor = staticVec;
  }
  finalColor *= mix(1.0, uSideShade, step(0.5, uIsSide));

  vec3 glitchColor = finalColor;
  bool isFoundSurface = (uIsFound > 0.5);

  float sideShade = mix(1.0, uSideShade, step(0.5, uIsSide));
  vec3 settleColor = mix(unfoundRestColor * sideShade, foundRestingColor * sideShade, step(0.5, uIsFound));

  if (uIsError > 0.5 || uIsSuccess > 0.5) {
    gl_FragColor.rgb = glitchColor;
  } else if (isFoundSurface) {
    gl_FragColor.rgb = foundRestingColor * sideShade;
  } else if (transitionActive > 0.5) {
    gl_FragColor.rgb = mix(settleColor, staticVec * sideShade, step(0.01, cityOn + wallOn + edgeOuter + edgeHalo));
  } else {
    gl_FragColor.rgb = mix(staticVec, unfoundRestColor, deselectDone) * sideShade;
  }
  if (uIsSuccess > 0.5) {
    gl_FragColor.rgb = mix(gl_FragColor.rgb, SELECT_CITY_AMBER, isCityPx * SELECT_CITY_ALPHA);
  }

${FEAT.FEATURE_GLITCH_CHUNK}
  gl_FragColor.a = 1.0;
`;

export const COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY = `#include <dithering_fragment>
${SELECT_CITY_DEFS}
      vec3 sphereNormal = normalize(vDitherWorldPos);
      vec3 geomNormal = normalize(vDitherWorldNormal);
      float isSideWall = step(abs(dot(geomNormal, sphereNormal)), 0.55);

      vec3 viewDir = normalize(cameraPosition - vDitherWorldPos);
      float ndv = clamp(dot(sphereNormal, viewDir), 0.0, 1.0);
      float limbFactor = mix(0.95, 1.02, smoothstep(0.0, 0.65, ndv));
      float rimSheen = pow(1.0 - ndv, 3.2) * 0.045;

      float cLat = asin(clamp(sphereNormal.y, -1.0, 1.0));
      float cLng = atan(sphereNormal.x, sphereNormal.z);
      vec2 cartUv = vec2(cLng / 6.2831853 + 0.5, cLat / 3.14159265 + 0.5);
      vec2 topoGrid = cartUv * vec2(72.0, 36.0);
      vec2 topoDist = abs(fract(topoGrid + 0.5) - 0.5) / max(fwidth(topoGrid), vec2(0.001));
      float parallelLine = clamp(1.0 - topoDist.y, 0.0, 1.0);
      float crossTick = clamp(1.0 - max(topoDist.x, topoDist.y) * 0.6, 0.0, 1.0);

      float surfaceLuma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
      float maxC = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
      float minC = min(gl_FragColor.r, min(gl_FragColor.g, gl_FragColor.b));
      float chroma = maxC - minC;
      float isSoloFound = step(0.45, gl_FragColor.g)
        * step(gl_FragColor.b * 1.32, gl_FragColor.g)
        * step(gl_FragColor.r * 2.2, gl_FragColor.b);
      float isConquestOwned = (1.0 - isSoloFound) * step(0.15, chroma) * step(0.36, maxC);
      float isAwakenedCap = max(isSoloFound, isConquestOwned) * (1.0 - uIsGhost);
      float lumaThreshold = mix(0.44, 0.64, uIsRegionalMode);
      float lumaMask = 1.0 - smoothstep(lumaThreshold, lumaThreshold + 0.14, surfaceLuma);
      float isUnfoundDarkCap = (1.0 - isAwakenedCap) * (1.0 - uIsGhost) * lumaMask;
      // Discovery ignition: inside the freshly found country's radius, city pixels switch
      // on one by one as a front expands from the capital (per-pixel jitter, no blur).
      vec2 igniteCell = floor(cartUv * vec2(3600.0, 1800.0));
      float igniteDist = acos(clamp(dot(sphereNormal, uIgniteOrigin), -1.0, 1.0));
      float igniteT = (uTime - uIgniteStart) / max(uIgniteDuration, 0.001);
      float igniteActive = step(igniteDist, uIgniteRadius) * step(0.0, igniteT) * step(igniteT, 1.0)
        * (1.0 - uReducedMotion) * (1.0 - uIsRegionalMode);
      float igniteFront = igniteT * uIgniteRadius * 1.2;
      float igniteJitter = cityCellHash(igniteCell + vec2(5.3, 11.9)) * uIgniteRadius * 0.2;
      float igniteD = igniteDist + igniteJitter;
      float ignitePixelOn = step(igniteD, igniteFront);
      // Only the freshly found country (uIgniteSelf) restarts from dark; already-lit
      // neighbours inside the radius keep their lights and only catch a faint spark.
      float igniteFlash = igniteActive * ignitePixelOn * (1.0 - step(igniteD, igniteFront - uIgniteRadius * DISC_SPARK_WIDTH))
        * mix(0.35, 1.0, uIgniteSelf) * DISC_SPARK_GAIN;
      // Until its front passes, the found country's pixels stay unlit (also during the
      // CITY_DELAY_S lead, igniteT < 0): no full-country pop before the wave.
      float igniteWindow = step(igniteDist, uIgniteRadius) * step(igniteT, 1.0)
        * (1.0 - uReducedMotion) * (1.0 - uIsRegionalMode);
      float igniteMask = mix(1.0, ignitePixelOn, igniteWindow * uIgniteSelf);
      // Discovery reveal (homepage-style, centred on the capital): the found land powers
      // up pixel by pixel ahead of the cities; outline amber ahead of the front, then one
      // light amber halo along the border before settling on the normal found state.
      float revealT = uTime - uRevealStart;
      float revealOn = uIgniteSelf * step(0.0, revealT) * step(revealT, DISC_REVEAL_S) * (1.0 - uIsRegionalMode);
      float landMask = mix(1.0, discoveryLandStep(revealT, igniteDist, uLandRadius, igniteCell), revealOn);
      float haloT = (revealT - DISC_HALO_START_S) / (DISC_REVEAL_S - DISC_HALO_START_S);
      float haloAmt = revealOn * (1.0 - uReducedMotion) * step(0.0, haloT) * step(haloT, 1.0)
        * ceil((1.0 - haloT) * DISC_HALO_STEPS) / DISC_HALO_STEPS * DISC_HALO_ALPHA;
      float outlineAmt = revealOn * (1.0 - uReducedMotion) * (1.0 - landMask) * DISC_OUTLINE_ALPHA;
      float haloBand = revealOn * discoveryHaloBand(revealT, igniteDist, uLandRadius, igniteCell);
      // Homepage wake-up: one discovery ignition stretched over the whole world. The same
      // jittered pixel front rings out from Paris (proximity order, as if every country
      // were found in turn): land powers up, cities follow with a gold spark, then awake.
      float homeDist = acos(clamp(dot(sphereNormal, vec3(0.027, 0.753, 0.6575)), -1.0, 1.0))
        + cityCellHash(igniteCell + vec2(5.3, 11.9)) * 0.14;
      float homeLandAt = homeDist / 3.6;
      float homeWakeAt = homeLandAt + 0.022;
      float homeOn = max(uReducedMotion, uIsRegionalMode);
      float homeIgnite = max(step(homeWakeAt, uHomeWake), homeOn);
      float homeLandOn = max(step(homeLandAt, uHomeWake), homeOn);
      float homeFlash = uShowcaseLights * (1.0 - homeOn) * homeIgnite
        * (1.0 - step(homeLandAt + 0.07, uHomeWake));
      igniteFlash = max(igniteFlash, homeFlash);
      float showcaseNow = uShowcaseLights * homeIgnite;
      float showcaseLand = uShowcaseLights * homeLandOn;
      float cityPower = clamp(max(isAwakenedCap * igniteMask, showcaseNow * isUnfoundDarkCap), 0.0, 1.0)
        * (1.0 - uIsGhost);
      // Relief and rivers wake with the land front (cities follow behind it).
      float terrainPower = clamp(max(isAwakenedCap * landMask, showcaseNow * isUnfoundDarkCap), 0.0, 1.0)
        * (1.0 - uIsGhost);

      // Blackout: unfound land in world modes is a desaturated, power-less grey derived
      // from the base terrain colour (no hard-coded terrain hue), cities/rivers switched off.
      float blackoutAmt = (1.0 - showcaseLand) * isUnfoundDarkCap * (1.0 - uIsRegionalMode);
      float unfoundDimTarget = mix(0.36, 0.74, uIsRegionalMode);
      float blackoutDim = mix(mix(1.0, unfoundDimTarget, (1.0 - showcaseLand) * isUnfoundDarkCap), 0.42, uIsGhost);
      // Warm umber in game only: Home/End keep the original cool grey (wake-up untouched).
      vec3 blackoutGrey = vec3(surfaceLuma) * mix(BLACKOUT_TINT, BLACKOUT_TINT_HOME, uShowcaseLights);
      vec3 unfoundLand = mix(gl_FragColor.rgb, blackoutGrey, blackoutAmt * 0.88) * blackoutDim;
      vec3 soloAwakenedLand = vec3(0.48, 0.34, 0.15) + vec3(0.15, 0.10, 0.04) * (1.0 - ndv);
      vec3 conquestAwakenedLand = gl_FragColor.rgb * 0.84 + gl_FragColor.rgb * 0.22 * (1.0 - ndv);
      vec3 landSurface = mix(mix(unfoundLand, conquestAwakenedLand, isConquestOwned), soloAwakenedLand, isSoloFound);
      // Pixel-art biome palette (baked, NearestFilter): revealed on found caps and
      // the illuminated home, only hinted on blacked-out caps, off on ghosts.
      vec4 biomeSample = texture2D(uBiomeMap, cartUv);
      vec3 biomeTone = biomeSample.rgb;
      vec3 biomeLand = biomeTone * (0.88 + 0.18 * (1.0 - ndv));
      float biomeAllowed = biomeSample.a * (1.0 - uIsGhost);
      float biomeReveal = max(max(isSoloFound, isConquestOwned), showcaseLand * isUnfoundDarkCap) * biomeAllowed;
      float biomeHint = (1.0 - showcaseLand) * isUnfoundDarkCap * biomeAllowed * (1.0 - uIsRegionalMode);
      landSurface = mix(landSurface, biomeTone * 0.3, biomeHint * 0.34);
      landSurface = mix(landSurface, biomeLand, biomeReveal * 0.92);
      // Conquête: translucent owner tint over the realistic palette (relief/forests stay visible).
      vec3 ownerHue = gl_FragColor.rgb / max(maxC, 0.001);
      float ownerLuma = dot(landSurface, vec3(0.299, 0.587, 0.114));
      vec3 ownerTint = ownerHue * (0.30 + ownerLuma * 1.1);
      landSurface = mix(landSurface, ownerTint, isConquestOwned * biomeAllowed * 0.5);
      // Found land (solo tone or Conquête player colour) follows the same reveal mask.
      landSurface = mix(DISC_DARK_LAND, landSurface, mix(1.0, landMask, isAwakenedCap));
      vec3 engrave = landSurface * (parallelLine * 0.04 + crossTick * 0.09) + vec3(rimSheen);
      vec3 baseLit = landSurface * limbFactor + engrave;

      vec2 cityCellId = floor(cartUv * vec2(3600.0, 1800.0));
      vec4 capitalSample = texture2D(uCapitalLightsMap, cartUv);
      float cityDensity = capitalSample.r;
      float cityAura = capitalSample.g;
      float mountainRelief = capitalSample.b;
      float riverVal = capitalSample.a;
      float cityHash = cityCellHash(cityCellId);
      float cityHash2 = cityCellHash(cityCellId + vec2(37.2, 91.7));

      vec2 regSub = fract(cartUv * vec2(3600.0, 1800.0));
      vec2 regCellId = floor(cartUv * vec2(14400.0, 7200.0));
      float regSubHash = cityCellHash(regCellId);
      float regCenterDot = step(0.28, regSub.x) * step(regSub.x, 0.72) * step(0.28, regSub.y) * step(regSub.y, 0.72);
      float regMicroSpark = regCenterDot + (1.0 - regCenterDot) * step(0.84, regSubHash) * 0.65;

      float reliefMask = (1.0 - uIsGhost) * mix(1.0, 0.36 * cityPower, uIsRegionalMode);
      float spurMask = reliefMask * (1.0 - uIsRegionalMode);
      float rawCrest = step(0.76, mountainRelief);
      float rawSpur = (1.0 - rawCrest) * step(0.38, mountainRelief);
      float rawValley = (1.0 - max(rawCrest, rawSpur)) * step(0.12, mountainRelief);
      float ridgeCrest = rawCrest * reliefMask;
      float ridgeSpur = rawSpur * spurMask;
      float valleyGap = rawValley * spurMask;
      vec3 darkReliefLit = baseLit * (1.0 - valleyGap * 0.16)
        + vec3(0.055, 0.058, 0.062) * ridgeCrest
        + vec3(0.028, 0.030, 0.032) * ridgeSpur;
      vec3 soloCrestTone = mix(vec3(0.62, 0.48, 0.28), vec3(0.92, 0.78, 0.48), isSoloFound);
      vec3 soloSpurTone = mix(vec3(0.36, 0.29, 0.19), vec3(0.68, 0.50, 0.24), isSoloFound);
      vec3 awakenedCrestTone = mix(soloCrestTone, min(vec3(1.0), baseLit * 1.65 + vec3(0.24, 0.22, 0.16)), isConquestOwned);
      vec3 awakenedSpurTone = mix(soloSpurTone, min(vec3(1.0), baseLit * 1.28 + vec3(0.10, 0.09, 0.06)), isConquestOwned);
      vec3 awakeReliefLit = baseLit * (1.0 - valleyGap * 0.28);
      awakeReliefLit = mix(awakeReliefLit, awakenedSpurTone, ridgeSpur * (0.68 + 0.18 * cityHash));
      awakeReliefLit = mix(awakeReliefLit, awakenedCrestTone, ridgeCrest * 0.86);
      vec3 reliefLit = mix(darkReliefLit, awakeReliefLit, terrainPower);

      float riverMask = (1.0 - uIsGhost) * mix(1.0, 0.52 * cityPower, uIsRegionalMode);
      float riverCore = step(0.65, riverVal) * riverMask;
      float riverBank = (1.0 - step(0.65, riverVal)) * step(0.25, riverVal) * riverMask * (1.0 - uIsRegionalMode);
      float riverShimmer = 0.78 + 0.22 * sin(uTime * 2.2 + (cartUv.x * 140.0 + cartUv.y * 90.0));
      vec3 darkRiverTone = mix(vec3(0.08, 0.14, 0.19), vec3(0.10, 0.105, 0.11), blackoutAmt);
      vec3 darkRiverLit = mix(reliefLit * (1.0 - riverBank * 0.10), darkRiverTone, riverCore * mix(0.58, 0.34, blackoutAmt));
      vec3 soloRiverColor = mix(vec3(0.14, 0.46, 0.58), vec3(0.38, 0.80, 0.88), riverShimmer);
      vec3 conquestRiverColor = mix(vec3(0.05, 0.12, 0.34), vec3(0.36, 0.66, 0.98), riverShimmer * 0.6);
      vec3 awakeRiverTone = mix(soloRiverColor, conquestRiverColor, isConquestOwned);
      vec3 awakeRiverLit = mix(reliefLit * (1.0 - riverBank * 0.22), awakeRiverTone, riverCore * 0.88);
      vec3 terrainLit = mix(darkRiverLit, awakeRiverLit, terrainPower);

${FEAT.FEATURE_SURFACE_CHUNK}
      float isRegionalPin = step(0.975, cityAura);
      float worldAura = (isRegionalPin > 0.5 && cityDensity < 0.25) ? 0.0 : cityAura;
      float effectiveAura = mix(worldAura, isRegionalPin * 0.28, uIsRegionalMode) * (1.0 - uFeatureMode);

      float trafficWave = 0.80 + 0.20 * sin(uTime * 2.8 - worldAura * 8.5 + cityHash * 6.2831853);
      float satTwinkle = 0.78 + 0.22 * sin(uTime * 4.2 + cityHash2 * 6.2831853);
      float tierPinpoint = step(0.82, cityDensity);
      float tierArterial = (1.0 - tierPinpoint) * step(0.55, cityDensity);
      float tierTentacle = (1.0 - max(tierPinpoint, tierArterial)) * step(0.25, cityDensity);

      vec3 auraColor = mix(
        vec3(0.68, 0.40, 0.12),
        max(activeTerrainLit * 1.35, vec3(0.75, 0.55, 0.22)),
        isConquestOwned * 0.5
      );
      vec3 withAura = mix(activeTerrainLit, max(activeTerrainLit, auraColor), effectiveAura * 0.32 * cityPower);
      vec3 colorOuterTentacle = mix(
        vec3(0.94, 0.54, 0.16),
        vec3(1.0, 0.84, 0.48),
        isConquestOwned * 0.45
      );
      vec3 colorMainArterial = mix(
        mix(vec3(0.98, 0.72, 0.18), vec3(1.0, 0.84, 0.34), cityHash2),
        vec3(1.0, 0.94, 0.72),
        isConquestOwned * 0.55
      );
      vec3 colorMetroHeart = mix(
        vec3(1.0, 0.94, 0.70),
        vec3(1.0, 0.99, 0.92),
        smoothstep(0.82, 1.0, max(cityDensity, isRegionalPin))
      );
      vec3 worldSparkColor = tierPinpoint * colorMetroHeart
        + tierArterial * colorMainArterial
        + tierTentacle * colorOuterTentacle;
      vec3 sparkColor = mix(worldSparkColor, colorMetroHeart, uIsRegionalMode);
      float worldSparkAlpha = (
        tierPinpoint * 0.98 +
        tierArterial * (0.78 + 0.16 * cityHash2) * trafficWave +
        tierTentacle * (0.50 + 0.24 * cityHash2) * satTwinkle
      );
      float regionalSparkAlpha = isRegionalPin * regMicroSpark * (0.88 + 0.12 * satTwinkle);
      float sparkAlpha = mix(worldSparkAlpha, regionalSparkAlpha, uIsRegionalMode) * cityPower * (1.0 - uFeatureMode);
      // Leading edge of the ignition wave burns in the existing win gold.
      sparkColor = mix(sparkColor, vec3(0.96, 0.68, 0.22) * 1.25, igniteFlash);
      vec3 capRgb = mix(withAura, sparkColor, clamp(sparkAlpha, 0.0, 1.0));
      // Ahead of the front, the found country's city pixels keep their dim selection
      // glow, so the ignition only brightens them (no blackout, no restart).
      float preLit = isAwakenedCap * (1.0 - igniteMask) * (1.0 - uIsRegionalMode) * step(0.25, cityDensity);
      capRgb = mix(capRgb, SELECT_CITY_AMBER, preLit * SELECT_CITY_ALPHA);
      capRgb = mix(capRgb, SELECT_CITY_AMBER, haloBand * isAwakenedCap * DISC_HALO_ALPHA);

      vec3 sideRgb = landSurface * 0.58;
      sideRgb = mix(sideRgb, SELECT_CITY_AMBER, max(haloAmt, outlineAmt) * isAwakenedCap);
      gl_FragColor.rgb = mix(capRgb, sideRgb, isSideWall);`;
