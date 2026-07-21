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
    float intensity = pow(edgeFade, exponent) * coef;

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
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  vec3 computeErrorEffect(vec3 finalColor, float time, float theme, vec2 noiseUv, vec3 worldPos) {
    float pulse = sin(time * 18.0) * 0.35 + 0.65;
    float sweep = step(fract(worldPos.y * 0.12 - time * 4.0), 0.35) * 0.40;
    float errorNoise = hash(noiseUv + sin(time * 45.0));
    float noisyIntensity = (pulse + sweep) * mix(0.7, 1.3, errorNoise);
    vec3 errorRed = vec3(1.0, 0.27, 0.0);
    if (theme > 0.9 && theme < 1.1) {
      return errorRed * noisyIntensity;
    } else {
      return mix(finalColor, errorRed * (noisyIntensity + 0.4), 0.85);
    }
  }
  vec3 computeSuccessEffect(vec3 finalColor, float time, float theme, vec2 blockUv, vec3 worldPos) {
    // Progress 0 -> 1 over the success flash (uSuccessStart is stamped on the guess).
    float p = clamp((time - uSuccessStart) / uSuccessDuration, 0.0, 1.0);
    // Chunky pixel blocks lock onto the found green, noisiest blocks resolving last.
    float blockNoise = hash(blockUv * 0.5 + 17.0);
    float resolved = step(blockNoise, smoothstep(0.0, 0.78, p));
    // White-hot flicker on the blocks still resolving.
    float flick = mix(0.8, 1.25, hash(blockUv + floor(time * 60.0)));
    vec3 hot = mix(vec3(1.0), uFoundGreen, 0.35) * flick;
    // Single fast scanline sweep down the country during the burst.
    float sweep = step(fract(worldPos.y * 0.12 - p * 2.4), 0.16)
      * (1.0 - smoothstep(0.35, 0.75, p)) * 0.6;
    // Ends exactly on uFoundGreen so the handoff to the found state is seamless.
    return mix(hot, uFoundGreen, resolved) + uFoundGreen * sweep;
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

  // DPR-normalized screen coords: same visual grain size on mobile and desktop.
  vec2 fragPx = gl_FragCoord.xy * uPixelScale;

  vec2 blockUv = floor(fragPx * 0.24);
  vec2 noiseUv = fragPx * 0.28;
  float noiseCoarse = hash(blockUv + sin(t));
  float noiseFine = hash(noiseUv + vec2(cos(t * 1.6), sin(t * 0.95)));
  float noise = mix(noiseCoarse, noiseFine, 0.4);

  float baseMin = (uIsLight > 0.5) ? 0.65 : 0.12;
  float baseMax = (uIsLight > 0.5) ? 0.98 : 0.68;
  float scanline = sin(fragPx.y * 1.05 + uTime * (6.0 + glitchAmp * 14.0))
    * ((uIsLight > 0.5) ? 0.03 : 0.048);

  float staticColor = mix(baseMin, baseMax, noise) + scanline;
  vec3 staticVec = vec3(staticColor);

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
    finalColor = uFoundGreen;
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

  float horizontalTear = step(0.78, sin(fragPx.y * 0.038 + uTime * (48.0 + glitchAmp * 95.0)));
  float verticalGlitch = step(0.86, hash(vec2(floor(fragPx.x * 0.07), floor(uTime * 24.0))));

  float glitchThreshold = uFadeProgress;
  if (transitionActive > 0.5) {
    glitchThreshold += (transitionNoise - 0.5) * (0.62 + glitchAmp * 0.38);
    if (horizontalTear > 0.5) {
      glitchThreshold = clamp(glitchThreshold - 0.28, 0.0, 1.0);
    }
    if (verticalGlitch > 0.5) {
      glitchThreshold = clamp(glitchThreshold + 0.22, 0.0, 1.0);
    }
  }

  float glitchFade = step(transitionNoise, glitchThreshold);
  float mixBias = transitionActive > 0.5 ? mix(0.06, 0.18, uFadeProgress) : 0.12;
  float finalProgress = mix(glitchFade, uFadeProgress, mixBias);

  vec3 glitchColor = finalColor;
  bool isFoundSurface = (uIsFound > 0.5);
  bool isSoftSelectIn =
    (uSelectInTransition > 0.5) &&
    (uIsFound < 0.5) &&
    (uIsError < 0.5) &&
    (uIsSuccess < 0.5);

  if (transitionActive > 0.5 && !isFoundSurface && !isSoftSelectIn) {
    float chroma = (transitionNoise - 0.5) * 0.18 * glitchAmp;
    glitchColor.r = clamp(finalColor.r + chroma, 0.0, 1.0);
    glitchColor.b = clamp(finalColor.b - chroma, 0.0, 1.0);
    if (horizontalTear > 0.5) {
      glitchColor = mix(glitchColor, vec3(1.0), 0.32 * glitchAmp);
    }
    if (verticalGlitch > 0.5) {
      glitchColor = mix(glitchColor, vec3(0.0), 0.2 * glitchAmp);
    }
  }

  float sideShade = mix(1.0, uSideShade, step(0.5, uIsSide));
  vec3 settleColor = mix(litRestingColor, uFoundGreen * sideShade, step(0.5, uIsFound));

  if (uIsError > 0.5 || uIsSuccess > 0.5) {
    gl_FragColor.rgb = glitchColor;
  } else if (isFoundSurface) {
    gl_FragColor.rgb = uFoundGreen * sideShade;
  } else if (isSoftSelectIn && transitionActive > 0.5) {
    float reveal = 1.0 - uFadeProgress;
    float grain = smoothstep(0.1, 0.6, reveal);
    gl_FragColor.rgb = mix(settleColor, staticVec * sideShade, grain * 0.5);
  } else if (isSoftSelectIn) {
    gl_FragColor.rgb = staticVec * sideShade;
  } else {
    gl_FragColor.rgb = mix(glitchColor, settleColor, finalProgress);
  }

  // Caps stay fully opaque through the deselect. The dissolve now morphs the
  // cap's COLOR toward its resting tint (litRestingColor) and hands off to the base
  // material; fading alpha to 0 here used to punch a one-frame black hole through
  // to the globe — the "blink" against the grayscale countries.
  gl_FragColor.a = 1.0;
`;
