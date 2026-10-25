/**
 * ==========================================
 * GLOBE GLSL SHADERS
 * ==========================================
 *
 * Raw GLSL for the custom "inner glow" atmosphere halo rendered behind the globe.
 * Extracted from GlobeMap.jsx so the (verbose, rarely-touched) shader source does
 * not clutter the component. The matching uniforms (glowColor / coef / power) are
 * driven from GlobeMap's lighting + animation code.
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

// Pass the view-space normal and position through to the fragment stage so the
// fragment shader can compute a true perspective Fresnel term per pixel.
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

    // True perspective dot product between view direction and surface normal.
    // For BackSide rendering, normal points outwards, and viewDir points from camera
    // to the vertex (which is also generally away from the camera).
    // Thus, the dot product is positive on the back hemisphere.
    float x = clamp(dot(normal, viewDir), 0.0, 1.0);

    // Ultra-soft gradual atmospheric gradient fading from maximum at the horizon (x = 0.62)
    // to 0.0 at the outer limit of space (x = 0.0).
    float edgeFade = smoothstep(0.0, 0.62, x);

    // Higher exponent creates a more gentle, soft, and diffuse gradient transition
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
  uniform float uIsLight;
  uniform float uTheme;
  uniform float uIsSide;
  uniform float uIsFound;
  uniform float uSelectInTransition;
  uniform vec3 uFoundGreen;
  uniform float uPixelScale;
  uniform float uSideShade;
  uniform float uSuccessStart;
  uniform float uSuccessDuration;
  uniform float uIsSatellite;
  uniform vec3 uGlitchTintA;
  uniform vec3 uGlitchTintB;
  ${GLSL_BAYER_4X4_FN}
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  vec3 computeErrorEffect(vec3 finalColor, float time, float theme, vec2 noiseUv, vec3 worldPos) {
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

    if (theme > 0.9 && theme < 1.1) {
      return splitColor;
    } else {
      return mix(finalColor, splitColor, 0.95);
    }
  }
  vec3 computeSuccessEffect(vec3 finalColor, float time, float theme, vec2 blockUv, vec3 worldPos) {
    // Progress 0 -> 1 over the success flash (uSuccessStart is stamped on the guess).
    float p = clamp((time - uSuccessStart) / uSuccessDuration, 0.0, 1.0);
    // Chunky pixel blocks lock onto the found green, noisiest blocks resolving last.
    float blockNoise = hash(blockUv * 0.5 + 17.0);
    float resolved = step(blockNoise, smoothstep(0.0, 0.78, p));
    // White-hot flicker on the blocks still resolving.
    float flick = mix(0.7, 1.35, hash(blockUv + floor(time * 60.0)));
    bool isMonoAwakening = (theme > 0.5) && (uIsSatellite < 0.5);
    vec3 targetTone = isMonoAwakening ? vec3(0.96, 0.68, 0.22) : uFoundGreen;
    vec3 hot = mix(vec3(1.0, 0.97, 0.86), targetTone, 0.25) * flick;
    // Single fast scanline sweep down the country during the burst.
    float sweep = step(fract(worldPos.y * 0.18 - p * 2.8), 0.22)
      * (1.0 - smoothstep(0.3, 0.8, p)) * 0.7;
    // Ends on targetTone so the handoff to the found state is seamless.
    vec3 baseGreen = mix(hot, targetTone, resolved) + targetTone * sweep;

    // Extremely strong lime-cyan-magenta chromatic split during the resolve phase
    if (p < 0.85) {
      float burstChroma = (1.0 - p) * 0.55 * (hash(blockUv + time * 12.0) - 0.5);
      baseGreen.r = clamp(baseGreen.r + burstChroma * 0.6, 0.0, 1.0);
      baseGreen.g = clamp(baseGreen.g + abs(burstChroma) * 0.3, 0.0, 1.0);
      baseGreen.b = clamp(baseGreen.b - burstChroma * 0.8, 0.0, 1.0);
    }

    return baseGreen;
  }
  vec3 computeSelectionEffect(vec3 finalColor, vec3 greenColor, float time, float theme, vec3 worldPos) {
    float pulse = sin(time * 5.5) * 0.18 + 0.82;
    float sweep = step(fract(worldPos.y * 0.05 - time * 0.9), 0.1) * 0.18;
    if (theme > 0.9 && theme < 1.1) {
      return greenColor * (pulse * 0.32 + sweep * 0.15 + 0.22);
    } else {
      return mix(finalColor, greenColor * (pulse * 0.42 + sweep + 0.3), 0.52);
    }
  }
`;

// GLSL fragment logic for selected/transitioning country polygon glitching
export const GLITCH_FRAGMENT_BODY = `
  vec3 litRestingColor = gl_FragColor.rgb;

  // Screen-space static — medium grain (~4–5px), uniform per country.
  float transitionActive = step(0.006, uFadeProgress) * (1.0 - step(0.994, uFadeProgress));
  float selectInScale = mix(1.0, 0.52, step(0.5, uSelectInTransition));
  float glitchAmp = transitionActive * (0.4 + 0.6 * sin(uFadeProgress * 3.14159)) * selectInScale;
  float t = uTime * (28.0 + glitchAmp * 62.0);

  // 3D sphere-anchored surface coordinates so scanlines, dither, and glitch blocks
  // live on the globe surface and rotate/zoom naturally with the Earth.
  vec3 sphereDir = normalize(vWorldPosition);
  float sphereLat = asin(clamp(sphereDir.y, -1.0, 1.0));
  float sphereLng = atan(sphereDir.z, sphereDir.x);
  vec2 fragPx = vec2(sphereLng * cos(sphereLat * 0.65), sphereLat) * 520.0;
  float bayer = bayer4x4(floor(fragPx));

  vec2 blockUv = floor(fragPx * 0.85);
  vec2 noiseUv = fragPx * 2.4;
  float noiseCoarse = hash(blockUv + sin(t));
  float noiseFine = hash(floor(noiseUv) + vec2(cos(t * 1.6), sin(t * 0.95)));
  float noise = mix(noiseFine, noiseCoarse, 0.35 * transitionActive);

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float ndv = clamp(dot(sphereDir, viewDir), 0.0, 1.0);
  float sphereShade = mix(0.95, 1.02, smoothstep(0.0, 0.65, ndv));

  float baseMin = (uIsLight > 0.5) ? 0.76 : 0.36;
  float baseMax = (uIsLight > 0.5) ? 0.94 : 0.54;
  float scanline = sin(fragPx.y * 2.2 + uTime * (5.0 + glitchAmp * 14.0))
    * ((uIsLight > 0.5) ? 0.018 : 0.026);
  float bayerStipple = (bayer - 0.46875) * ((uIsLight > 0.5) ? 0.025 : 0.035) * transitionActive;

  float staticColor = mix(baseMin, baseMax, noise) * sphereShade + scanline + bayerStipple;
  vec3 staticVec = vec3(staticColor);
  vec3 foundRestingColor = ((uTheme > 0.5) && (uIsSatellite < 0.5)) ? vec3(0.48, 0.34, 0.15) : uFoundGreen;

  // Caps and extruded side walls share one effect pipeline; sides are shaded
  // slightly darker below so the extrusion keeps its depth cue.
  vec3 finalColor = gl_FragColor.rgb;
  if (uIsError > 0.5) {
    finalColor = computeErrorEffect(gl_FragColor.rgb, uTime, uTheme, blockUv, vWorldPosition);
  } else if (uIsSuccess > 0.5) {
    finalColor = computeSuccessEffect(gl_FragColor.rgb, uTime, uTheme, blockUv, vWorldPosition);
  } else if (uIsSelection > 0.5) {
    finalColor = computeSelectionEffect(gl_FragColor.rgb, uFoundGreen, uTime, uTheme, vWorldPosition);
  } else if (uIsFound > 0.5) {
    finalColor = foundRestingColor;
  } else {
    finalColor = staticVec;
  }
  finalColor *= mix(1.0, uSideShade, step(0.5, uIsSide));

  // Deselection dissolve: noisy digital dither + tears + chroma split
  vec2 dissolveBlock = floor(fragPx * 0.21)
    + vec2(sin(uTime * 58.0), cos(uTime * 41.0)) * glitchAmp * 3.5;
  float transitionNoise = hash(dissolveBlock);
  float transitionNoise2 = hash(dissolveBlock * 1.9 + uTime * 3.7);
  transitionNoise = mix(transitionNoise, transitionNoise2, 0.55 * max(glitchAmp, 0.35));
  transitionNoise = mix(transitionNoise, bayer, 0.28);

  float horizontalTear = step(0.78, sin(fragPx.y * 0.038 + uTime * (48.0 + glitchAmp * 95.0)));
  float verticalGlitch = step(0.86, hash(vec2(floor(fragPx.x * 0.07), floor(uTime * 24.0))));

  float glitchThreshold = uFadeProgress;
  if (transitionActive > 0.5) {
    // Softer threshold noise + gentler tears → the dissolve edge breaks up
    // evenly instead of ripping the country apart in big chunks.
    glitchThreshold += (transitionNoise - 0.5) * (0.46 + glitchAmp * 0.30);
    if (horizontalTear > 0.5) {
      glitchThreshold = clamp(glitchThreshold - 0.16, 0.0, 1.0);
    }
    if (verticalGlitch > 0.5) {
      glitchThreshold = clamp(glitchThreshold + 0.12, 0.0, 1.0);
    }
  }

  float finalProgress = clamp(uFadeProgress, 0.0, 1.0);

  vec3 glitchColor = finalColor;
  bool isFoundSurface = (uIsFound > 0.5);
  bool isSoftSelectIn =
    (uSelectInTransition > 0.5) &&
    (uIsFound < 0.5) &&
    (uIsError < 0.5) &&
    (uIsSuccess < 0.5);

  if (transitionActive > 0.5 && !isFoundSurface) {
    // Retro TV chroma aberration & vertical dropouts
    float chroma = (transitionNoise - 0.5) * 0.28 * glitchAmp;
    glitchColor.r = clamp(finalColor.r + chroma, 0.0, 1.0);
    glitchColor.g = clamp(finalColor.g * (1.0 - glitchAmp * 0.15), 0.0, 1.0);
    glitchColor.b = clamp(finalColor.b - chroma, 0.0, 1.0);
    
    // Horizontal scanline/tear overlay with neon color aberrations
    if (horizontalTear > 0.5) {
      vec3 tearColor = mix(uGlitchTintA, uGlitchTintB, hash(blockUv + floor(uTime * 30.0)));
      glitchColor = mix(glitchColor, tearColor, 0.42 * glitchAmp);
    }
    if (verticalGlitch > 0.5) {
      glitchColor = mix(glitchColor, vec3(0.0), 0.25 * glitchAmp);
    }
  }

  float sideShade = mix(1.0, uSideShade, step(0.5, uIsSide));
  vec3 settleColor = mix(litRestingColor, foundRestingColor * sideShade, step(0.5, uIsFound));

  // Clean uniform surface without noisy surface blotches

  float blockVal = hash(blockUv * 0.38 + sin(uTime * 8.0) * 0.05);
  blockVal = mix(blockVal, bayer, 0.22);

  if (uIsError > 0.5 || uIsSuccess > 0.5) {
    gl_FragColor.rgb = glitchColor;
  } else if (isFoundSurface) {
    gl_FragColor.rgb = foundRestingColor * sideShade;
  } else if (transitionActive > 0.5) {
    if (uIsSatellite > 0.5) {
      gl_FragColor.rgb = glitchColor;
    } else {
      if (blockVal < glitchThreshold) {
        gl_FragColor.rgb = settleColor;
      } else {
        if (blockVal < glitchThreshold + 0.12) {
          vec3 edgeGlow = mix(vec3(0.0, 1.0, 0.95), vec3(1.0, 0.0, 0.85), hash(blockUv + floor(uTime * 15.0)));
          gl_FragColor.rgb = mix(glitchColor, edgeGlow * 1.6, 0.65);
        } else {
          gl_FragColor.rgb = glitchColor;
        }
      }
    }
  } else if (isSoftSelectIn && transitionActive > 0.5) {
    float reveal = 1.0 - uFadeProgress;
    float grain = smoothstep(0.1, 0.6, reveal);
    gl_FragColor.rgb = mix(settleColor, staticVec * sideShade, grain * 0.5);
  } else {
    gl_FragColor.rgb = staticVec * sideShade;
  }

  // Clean cartographic finish

  if (uIsError > 0.5 || uIsSuccess > 0.5 || isFoundSurface) {
    gl_FragColor.a = 1.0;
  } else {
    if (transitionActive > 0.5) {
      if (uIsSatellite > 0.5) {
        if (blockVal < uFadeProgress) {
          gl_FragColor.a = 0.0;
        } else {
          if (blockVal < uFadeProgress + 0.12) {
            vec3 edgeGlow = mix(vec3(0.0, 1.0, 0.95), vec3(1.0, 0.0, 0.85), hash(blockUv + floor(uTime * 15.0)));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, edgeGlow * 1.6, 0.65);
          }
          gl_FragColor.a = 1.0 - uFadeProgress * uFadeProgress;
        }
      } else {
        gl_FragColor.a = 1.0;
      }
    } else {
      gl_FragColor.a = (uIsSatellite > 0.5) ? (1.0 - finalProgress) : 1.0;
    }
  }
`;

export const COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY = `#include <dithering_fragment>
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
      float isAwakenedCap = max(isSoloFound, isConquestOwned);
      float isUnfoundDarkCap = (1.0 - isAwakenedCap) * (1.0 - smoothstep(0.44, 0.58, surfaceLuma));
      float cityPower = clamp(max(isAwakenedCap, uShowcaseLights * isUnfoundDarkCap), 0.0, 1.0);

      float blackoutDim = mix(1.0, 0.38, (1.0 - uShowcaseLights) * isUnfoundDarkCap);
      vec3 unfoundLand = gl_FragColor.rgb * blackoutDim;
      vec3 soloAwakenedLand = vec3(0.48, 0.34, 0.15) + vec3(0.15, 0.10, 0.04) * (1.0 - ndv);
      vec3 conquestAwakenedLand = gl_FragColor.rgb * 0.84 + gl_FragColor.rgb * 0.22 * (1.0 - ndv);
      vec3 landSurface = mix(
        mix(unfoundLand, conquestAwakenedLand, isConquestOwned),
        soloAwakenedLand,
        isSoloFound
      );
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

      float ridgeCrest = step(0.76, mountainRelief);
      float ridgeSpur = (1.0 - ridgeCrest) * step(0.38, mountainRelief);
      float valleyGap = (1.0 - max(ridgeCrest, ridgeSpur)) * step(0.12, mountainRelief);
      vec3 darkReliefLit = baseLit * (1.0 - valleyGap * 0.16)
        + vec3(0.055, 0.058, 0.062) * ridgeCrest
        + vec3(0.028, 0.030, 0.032) * ridgeSpur;
      vec3 soloCrestTone = mix(vec3(0.62, 0.48, 0.28), vec3(0.92, 0.78, 0.48), isSoloFound);
      vec3 soloSpurTone = mix(vec3(0.36, 0.29, 0.19), vec3(0.68, 0.50, 0.24), isSoloFound);
      vec3 awakenedCrestTone = mix(
        soloCrestTone,
        min(vec3(1.0), baseLit * 1.65 + vec3(0.24, 0.22, 0.16)),
        isConquestOwned
      );
      vec3 awakenedSpurTone = mix(
        soloSpurTone,
        min(vec3(1.0), baseLit * 1.28 + vec3(0.10, 0.09, 0.06)),
        isConquestOwned
      );
      vec3 awakeReliefLit = baseLit * (1.0 - valleyGap * 0.28);
      awakeReliefLit = mix(awakeReliefLit, awakenedSpurTone, ridgeSpur * (0.68 + 0.18 * cityHash));
      awakeReliefLit = mix(awakeReliefLit, awakenedCrestTone, ridgeCrest * 0.86);
      vec3 reliefLit = mix(darkReliefLit, awakeReliefLit, cityPower);

      float riverCore = step(0.65, riverVal);
      float riverBank = (1.0 - riverCore) * step(0.25, riverVal);
      float riverShimmer = 0.78 + 0.22 * sin(uTime * 2.2 + (cartUv.x * 140.0 + cartUv.y * 90.0));
      vec3 darkRiverLit = mix(
        reliefLit * (1.0 - riverBank * 0.10),
        vec3(0.08, 0.14, 0.19),
        riverCore * 0.58
      );
      vec3 soloRiverColor = mix(vec3(0.14, 0.46, 0.58), vec3(0.38, 0.80, 0.88), riverShimmer);
      vec3 conquestRiverColor = mix(vec3(0.10, 0.20, 0.32), vec3(0.76, 0.94, 1.0), riverShimmer);
      vec3 awakeRiverTone = mix(soloRiverColor, conquestRiverColor, isConquestOwned);
      vec3 awakeRiverLit = mix(
        reliefLit * (1.0 - riverBank * 0.22),
        awakeRiverTone,
        riverCore * 0.88
      );
      vec3 terrainLit = mix(darkRiverLit, awakeRiverLit, cityPower);

      float trafficWave = 0.80 + 0.20 * sin(uTime * 2.8 - cityAura * 8.5 + cityHash * 6.2831853);
      float satTwinkle = 0.78 + 0.22 * sin(uTime * 4.2 + cityHash2 * 6.2831853);
      float tierPinpoint = step(0.82, cityDensity);
      float tierArterial = (1.0 - tierPinpoint) * step(0.55, cityDensity);
      float tierTentacle = (1.0 - max(tierPinpoint, tierArterial)) * step(0.25, cityDensity);

      vec3 auraColor = mix(
        vec3(0.68, 0.40, 0.12),
        max(terrainLit * 1.35, vec3(0.75, 0.55, 0.22)),
        isConquestOwned * 0.5
      );
      vec3 withAura = mix(terrainLit, max(terrainLit, auraColor), cityAura * 0.32 * cityPower);
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
        smoothstep(0.82, 1.0, cityDensity)
      );
      vec3 sparkColor = tierPinpoint * colorMetroHeart
        + tierArterial * colorMainArterial
        + tierTentacle * colorOuterTentacle;
      float sparkAlpha = (
        tierPinpoint * 0.98 +
        tierArterial * (0.78 + 0.16 * cityHash2) * trafficWave +
        tierTentacle * (0.50 + 0.24 * cityHash2) * satTwinkle
      ) * cityPower;
      vec3 capRgb = mix(withAura, sparkColor, clamp(sparkAlpha, 0.0, 1.0));

      vec3 sideRgb = landSurface * 0.58;
      gl_FragColor.rgb = mix(capRgb, sideRgb, isSideWall);`;
