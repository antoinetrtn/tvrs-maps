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

// Vertices coordinate definitions for custom polygon effects
export const GLITCH_VERTEX_DECLARATIONS = `
  varying vec3 vLocalPosition;
`;

export const GLITCH_VERTEX_BODY = `
  vLocalPosition = position;
`;

// Uniforms declarations for country polygon shader
export const GLITCH_FRAGMENT_DECLARATIONS = `
  varying vec3 vLocalPosition;
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
`;

// GLSL fragment logic for selected/transitioning country polygon glitching
export const GLITCH_FRAGMENT_BODY = `
  vec2 noiseUv = vLocalPosition.xy * 8.0 + vec2(vLocalPosition.z * 4.0);
  float t = uTime * 28.0;
  float noise = hash(noiseUv + sin(t));

  // Dynamic static range: bright static in light theme, dark static in dark theme
  float baseMin = (uIsLight > 0.5) ? 0.65 : 0.12;
  float baseMax = (uIsLight > 0.5) ? 0.98 : 0.68;
  float scanline = sin(vLocalPosition.y * 15.0 + uTime * 5.0) * ((uIsLight > 0.5) ? 0.03 : 0.07);

  float staticColor = mix(baseMin, baseMax, noise) + scanline;
  vec3 staticVec = vec3(staticColor);
  vec3 neonGreen = vec3(0.05, 0.92, 0.52);

  vec3 finalColor = gl_FragColor.rgb;

  if (uIsSide > 0.5) {
    // SIDES / WALLS GEOMETRY
    if (uIsError > 0.5) {
      // Error on side walls: fast pulsing orange-red flash and scanline sweep with noise
      float pulse = sin(uTime * 18.0) * 0.35 + 0.65;
      float sweep = step(fract(vLocalPosition.y * 1.5 - uTime * 4.0), 0.35) * 0.40;
      float errorNoise = hash(noiseUv + sin(uTime * 45.0));
      float noisyIntensity = (pulse + sweep) * mix(0.7, 1.3, errorNoise);
      vec3 errorRed = vec3(1.0, 0.27, 0.0);
      if (uTheme > 0.9 && uTheme < 1.1) {
        finalColor = errorRed * noisyIntensity;
      } else {
        finalColor = mix(finalColor, errorRed * (noisyIntensity + 0.4), 0.85);
      }
    } else if (uIsSuccess > 0.5) {
      // Success on side walls: neon green pulse and scanline sweep
      float pulse = sin(uTime * 15.0) * 0.4 + 0.6;
      float sweep = step(fract(vLocalPosition.y * 0.2 - uTime * 2.0), 0.15) * 0.35;
      if (uTheme > 0.9 && uTheme < 1.1) {
        finalColor = vec3(pulse + sweep);
      } else {
        finalColor = mix(finalColor, neonGreen * (pulse + sweep + 0.5), 0.85);
      }
    } else {
      // Normal selected side: holographic laser wall barrier!
      vec2 uv = gl_FragCoord.xy;
      float beamPattern = sin(uv.y * 0.4 - uTime * 15.0) * 0.5 + 0.5;
      float wallNoise = fract(sin(dot(uv + uTime, vec2(12.9898,78.233))) * 43758.5453);
      vec3 beamColor = vec3(1.0);
      finalColor = mix(gl_FragColor.rgb, beamColor, 0.3 + 0.7 * beamPattern * (0.8 + 0.2 * wallNoise));
    }
  } else {
    // TOP CAP GEOMETRY
    // 100% monochrome static/noise glitch (shared across blackout & satellite themes)
    finalColor = staticVec;

    if (uIsError > 0.5) {
      // Error on cap: fast pulsing orange-red flash and scanline sweep with noise
      float pulse = sin(uTime * 18.0) * 0.35 + 0.65;
      float sweep = step(fract(vLocalPosition.y * 1.5 - uTime * 4.0), 0.35) * 0.40;
      float errorNoise = hash(noiseUv + sin(uTime * 45.0));
      float noisyIntensity = (pulse + sweep) * mix(0.7, 1.3, errorNoise);
      vec3 errorRed = vec3(1.0, 0.27, 0.0);
      if (uTheme > 0.9 && uTheme < 1.1) {
        finalColor = errorRed * noisyIntensity;
      } else {
        finalColor = mix(finalColor, errorRed * (noisyIntensity + 0.4), 0.85);
      }
    }

    if (uIsSuccess > 0.5) {
      // Success on cap: s'illumine with an animated high-contrast flash/pulse
      float pulse = sin(uTime * 15.0) * 0.4 + 0.6;
      float sweep = step(fract(vLocalPosition.y * 0.2 - uTime * 2.0), 0.15) * 0.35;
      if (uTheme > 0.9 && uTheme < 1.1) {
        finalColor = vec3(pulse + sweep);
      } else {
        finalColor = mix(finalColor, neonGreen * (pulse + sweep + 0.5), 0.85);
      }
    }
  }

  gl_FragColor.rgb = mix(finalColor, uTargetColor, uFadeProgress);

  // Smooth alpha fadeout in satellite mode for unfound countries
  float finalAlpha = 1.0;
  if (uTheme < 0.5) { // satellite theme
    if (uIsFound < 0.5) {
      finalAlpha = mix(1.0, 0.0, uFadeProgress);
    }
  }
  gl_FragColor.a = finalAlpha;
`;
