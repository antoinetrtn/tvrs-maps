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
  uniform float uIsLight;
  uniform float uTheme;
  uniform float uIsSide;
  uniform float uIsFound;
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
  vec3 computeSuccessEffect(vec3 finalColor, vec3 greenColor, float time, float theme, vec3 worldPos) {
    float pulse = sin(time * 15.0) * 0.4 + 0.6;
    float sweep = step(fract(worldPos.y * 0.08 - time * 2.0), 0.15) * 0.35;
    if (theme > 0.9 && theme < 1.1) {
      return vec3(pulse + sweep);
    } else {
      return mix(finalColor, greenColor * (pulse + sweep + 0.5), 0.85);
    }
  }
`;

// GLSL fragment logic for selected/transitioning country polygon glitching
export const GLITCH_FRAGMENT_BODY = `
  // Screen-space static — medium grain (~4–5px), uniform per country.
  float transitionActive = step(0.006, uFadeProgress) * (1.0 - step(0.994, uFadeProgress));
  float glitchAmp = transitionActive * (0.4 + 0.6 * sin(uFadeProgress * 3.14159));
  float t = uTime * (28.0 + glitchAmp * 62.0);

  vec2 blockUv = floor(gl_FragCoord.xy * 0.24);
  vec2 noiseUv = gl_FragCoord.xy * 0.28;
  float noiseCoarse = hash(blockUv + sin(t));
  float noiseFine = hash(noiseUv + vec2(cos(t * 1.6), sin(t * 0.95)));
  float noise = mix(noiseCoarse, noiseFine, 0.4);

  float baseMin = (uIsLight > 0.5) ? 0.65 : 0.12;
  float baseMax = (uIsLight > 0.5) ? 0.98 : 0.68;
  float scanline = sin(gl_FragCoord.y * 1.05 + uTime * (6.0 + glitchAmp * 14.0))
    * ((uIsLight > 0.5) ? 0.03 : 0.048);

  float staticColor = mix(baseMin, baseMax, noise) + scanline;
  vec3 staticVec = vec3(staticColor);
  vec3 neonGreen = vec3(0.05, 0.92, 0.52);

  vec3 finalColor = gl_FragColor.rgb;

  if (uIsSide > 0.5) {
    if (uIsError > 0.5) {
      finalColor = computeErrorEffect(finalColor, uTime, uTheme, blockUv, vWorldPosition);
    } else if (uIsSuccess > 0.5) {
      finalColor = computeSuccessEffect(finalColor, neonGreen, uTime, uTheme, vWorldPosition);
    } else {
      vec2 uv = gl_FragCoord.xy;
      float beamPattern = sin(uv.y * 0.4 - uTime * 15.0) * 0.5 + 0.5;
      float wallNoise = fract(sin(dot(uv + uTime, vec2(12.9898,78.233))) * 43758.5453);
      vec3 beamColor = vec3(1.0);
      finalColor = mix(gl_FragColor.rgb, beamColor, 0.3 + 0.7 * beamPattern * (0.8 + 0.2 * wallNoise));
    }
  } else {
    finalColor = staticVec;

    if (uIsError > 0.5) {
      finalColor = computeErrorEffect(finalColor, uTime, uTheme, blockUv, vWorldPosition);
    }

    if (uIsSuccess > 0.5) {
      finalColor = computeSuccessEffect(finalColor, neonGreen, uTime, uTheme, vWorldPosition);
    }
  }

  // Deselection dissolve: noisy digital dither + tears + chroma split
  vec2 dissolveBlock = floor(gl_FragCoord.xy * 0.21)
    + vec2(sin(uTime * 58.0), cos(uTime * 41.0)) * glitchAmp * 3.5;
  float transitionNoise = hash(dissolveBlock);
  float transitionNoise2 = hash(dissolveBlock * 1.9 + uTime * 3.7);
  transitionNoise = mix(transitionNoise, transitionNoise2, 0.55 * max(glitchAmp, 0.35));

  float horizontalTear = step(0.78, sin(gl_FragCoord.y * 0.038 + uTime * (48.0 + glitchAmp * 95.0)));
  float verticalGlitch = step(0.86, hash(vec2(floor(gl_FragCoord.x * 0.07), floor(uTime * 24.0))));

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
  if (transitionActive > 0.5 && uIsSide < 0.5) {
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

  gl_FragColor.rgb = mix(glitchColor, uTargetColor, finalProgress);

  float finalAlpha = 1.0;
  if (uTheme < 0.5) {
    if (uIsFound < 0.5) {
      finalAlpha = mix(1.0, 0.0, finalProgress);
    }
  }
  gl_FragColor.a = finalAlpha;
`;
