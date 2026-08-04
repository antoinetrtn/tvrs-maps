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
// World-space and local-space coordinates are required for country effects and capital radar.
export const GLITCH_VERTEX_DECLARATIONS = `
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
`;

export const GLITCH_VERTEX_BODY = `
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vLocalPosition = position;
`;

// Uniforms declarations for country polygon shader
export const GLITCH_FRAGMENT_DECLARATIONS = `
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
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
  uniform vec3 uCapitalPos;
  uniform float uPixelScale;
  uniform float uSideShade;
  uniform float uSuccessStart;
  uniform float uSuccessDuration;
  uniform float uIsSatellite;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  vec3 computeErrorEffect(vec3 finalColor, float time, float theme, vec2 noiseUv, vec3 worldPos) {
    // Horizontal TV signal breakdown / bad reception CRT distortion
    float pulse = sin(time * 24.0) * 0.35 + 0.65;
    
    // Jittering horizontal scanline sync distortion
    float scanJitter = sin(worldPos.y * 36.0 + sin(time * 48.0) * 8.0) * 0.5 + 0.5;
    float tearBar = step(0.72, sin(worldPos.y * 70.0 + time * 32.0)) * 0.6;
    
    float errorNoise = hash(noiseUv + sin(time * 60.0));
    float noisyIntensity = (pulse + scanJitter * 0.5 + tearBar) * mix(0.7, 1.3, errorNoise);
    vec3 errorRed = vec3(1.0, 0.06, 0.02) * (noisyIntensity + 0.25);

    // Intense RGB CRT color split on bad reception
    float chroma = (errorNoise - 0.5) * 0.55;
    vec3 splitColor;
    splitColor.r = clamp(errorRed.r + chroma * 0.6, 0.0, 1.0);
    splitColor.g = clamp(errorRed.g - abs(chroma) * 0.7, 0.0, 1.0);
    splitColor.b = clamp(errorRed.b - chroma * 0.6, 0.0, 1.0);

    // Stroboscopic signal dropouts
    if (errorNoise > 0.86) {
      splitColor = mix(splitColor, vec3(0.0, 0.95, 1.0), 0.7); // Cyan glitch flash
    } else if (errorNoise < 0.14) {
      splitColor = mix(splitColor, vec3(1.0, 0.0, 0.9), 0.7); // Magenta glitch flash
    }

    if (theme > 0.9 && theme < 1.1) {
      return splitColor;
    } else {
      return mix(finalColor, splitColor, 0.92);
    }
  }
  vec3 computeSuccessEffect(
    vec3 finalColor, float time, float theme, vec2 blockUv, vec3 worldPos, vec3 localPos, vec3 capitalPos
  ) {
    // Progress 0 -> 1 over the success flash (uSuccessStart is stamped on the guess).
    float p = clamp((time - uSuccessStart) / uSuccessDuration, 0.0, 1.0);

    // Capital-centered 3D distance on unit sphere
    vec3 normLocal = length(localPos) > 0.001 ? normalize(localPos) : vec3(0.0, 1.0, 0.0);
    vec3 normCap = length(capitalPos) > 0.001 ? normalize(capitalPos) : vec3(0.0, 1.0, 0.0);
    float distFromCap = length(normLocal - normCap);

    // 1. Glowing Capital Radar Beacon Dot (bright white-hot point at capital)
    float capitalDot = smoothstep(0.05, 0.005, distFromCap) * (1.0 - smoothstep(0.8, 1.0, p));
    float capitalFlash = capitalDot * (sin(time * 26.0) * 0.3 + 1.4);

    // 2. Bold Expanding Concentric Radar Waves
    float waveProgress1 = fract(p * 1.6);
    float waveProgress2 = fract(p * 1.6 + 0.45);

    float ringFront1 = waveProgress1 * 0.5;
    float ringFront2 = waveProgress2 * 0.5;

    float ringWidth = 0.045;
    float radarRing1 = smoothstep(ringWidth, 0.0, abs(distFromCap - ringFront1)) * (1.0 - waveProgress1);
    float radarRing2 = smoothstep(ringWidth, 0.0, abs(distFromCap - ringFront2)) * (1.0 - waveProgress2);

    float radarWaves = max(radarRing1, radarRing2) * (1.0 - smoothstep(0.8, 1.0, p));

    // 3. Dynamic Sonar Ripples radiating outward
    float radarRipples = sin(distFromCap * 70.0 - p * 24.0) * 0.5 + 0.5;
    float rippleMask = smoothstep(0.55, 0.0, distFromCap) * (1.0 - smoothstep(0.75, 1.0, p));
    radarRipples = pow(radarRipples, 2.5) * rippleMask * 0.5;

    // 4. Rotating Radar Beam Sweep around Capital
    float atanAngle = atan(normLocal.x - normCap.x, normLocal.z - normCap.z);
    float beamSweep = sin(atanAngle * 2.0 + time * 10.0) * 0.5 + 0.5;
    beamSweep = pow(beamSweep, 3.5) * smoothstep(0.5, 0.0, distFromCap) * (1.0 - smoothstep(0.75, 1.0, p));

    // Chunky pixel blocks lock onto the found green
    float blockNoise = hash(blockUv * 0.5 + 17.0);
    float resolved = step(blockNoise, smoothstep(0.15, 0.88, p));

    // High-contrast CRT Radar Colors:
    // Dark CRT green background during radar sweep phase so bright rings POP with high contrast
    vec3 radarBackground = mix(vec3(0.04, 0.22, 0.08), uFoundGreen * 0.45, p * 0.5);
    vec3 brightRadarLine = vec3(0.75, 1.0, 0.88); // White-cyan glowing radar line
    vec3 whiteCapitalBeacon = vec3(1.0, 1.0, 0.95); // White-hot capital dot

    // Composite radar pattern on dark background
    vec3 activeRadarPattern = radarBackground;
    activeRadarPattern = mix(
      activeRadarPattern,
      brightRadarLine,
      clamp(radarWaves * 1.5 + radarRipples * 0.6 + beamSweep * 0.5, 0.0, 1.0)
    );
    activeRadarPattern = mix(
      activeRadarPattern,
      whiteCapitalBeacon,
      clamp(capitalFlash * 1.6, 0.0, 1.0)
    );

    // Smooth resolve from active radar pattern into final solid uFoundGreen
    vec3 baseGreen = mix(activeRadarPattern, uFoundGreen, resolved);

    // Mild chromatic split during initial radar ping phase (p < 0.4)
    if (p < 0.4) {
      float burstChroma = (0.4 - p) * 0.35 * (hash(blockUv + time * 12.0) - 0.5);
      baseGreen.r = clamp(baseGreen.r + burstChroma * 0.5, 0.0, 1.0);
      baseGreen.g = clamp(baseGreen.g + abs(burstChroma) * 0.2, 0.0, 1.0);
      baseGreen.b = clamp(baseGreen.b - burstChroma * 0.6, 0.0, 1.0);
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
    finalColor = computeSuccessEffect(
      gl_FragColor.rgb, uTime, uTheme, blockUv, vWorldPosition, vLocalPosition, uCapitalPos
    );
  } else if (uIsSelection > 0.5) {
    finalColor = computeSelectionEffect(gl_FragColor.rgb, uFoundGreen, uTime, uTheme, vWorldPosition);
  } else if (uIsFound > 0.5) {
    finalColor = uFoundGreen;
  } else {
    finalColor = staticVec;
  }
  finalColor *= mix(1.0, uSideShade, step(0.5, uIsSide));

  // Deselection dissolve: smooth cross-fade with organic digital dither
  float dissolveFade = smoothstep(0.0, 1.0, uFadeProgress);
  float glitchFadeFactor = 1.0 - dissolveFade;

  // Toned-down tears & edge glow during deselection fade
  float horizontalTear = step(0.86, sin(fragPx.y * 0.038 + uTime * (32.0 + glitchAmp * 40.0))) * glitchFadeFactor;
  float verticalGlitch = step(0.92, hash(vec2(floor(fragPx.x * 0.07), floor(uTime * 18.0)))) * glitchFadeFactor;

  float finalProgress = clamp(uFadeProgress, 0.0, 1.0);

  vec3 glitchColor = finalColor;
  bool isFoundSurface = (uIsFound > 0.5);
  bool isSoftSelectIn =
    (uSelectInTransition > 0.5) &&
    (uIsFound < 0.5) &&
    (uIsError < 0.5) &&
    (uIsSuccess < 0.5);

  if (transitionActive > 0.5 && !isFoundSurface) {
    // Retro TV chroma aberration decaying smoothly during deselection
    float chroma = (hash(floor(fragPx * 0.21)) - 0.5) * 0.16 * glitchFadeFactor;
    glitchColor.r = clamp(finalColor.r + chroma, 0.0, 1.0);
    glitchColor.g = clamp(finalColor.g * (1.0 - glitchFadeFactor * 0.1), 0.0, 1.0);
    glitchColor.b = clamp(finalColor.b - chroma, 0.0, 1.0);
    
    // Subtile horizontal tear accent
    if (horizontalTear > 0.5) {
      vec3 tearColor = mix(vec3(0.0, 0.7, 0.9), vec3(0.9, 0.0, 0.7), hash(blockUv + floor(uTime * 20.0)));
      glitchColor = mix(glitchColor, tearColor, 0.22 * glitchFadeFactor);
    }
  }

  float sideShade = mix(1.0, uSideShade, step(0.5, uIsSide));
  vec3 settleColor = mix(litRestingColor, uFoundGreen * sideShade, step(0.5, uIsFound));

  // Micro-grain noise sur la surface de tous les pays
  float countrySurfaceNoise = (hash(fragPx * 0.42 + vec2(0.12, 0.45)) - 0.5) * 0.06;
  staticVec += vec3(countrySurfaceNoise);
  settleColor += vec3(countrySurfaceNoise * 0.7);

  float blockVal = hash(blockUv * 0.38 + sin(uTime * 8.0) * 0.05);
  float isDeselecting = step(0.006, uFadeProgress);

  if (uIsError > 0.5 || uIsSuccess > 0.5) {
    gl_FragColor.rgb = glitchColor;
  } else if (isFoundSurface) {
    gl_FragColor.rgb = uFoundGreen * sideShade;
  } else if (isDeselecting > 0.5) {
    if (uIsSatellite > 0.5) {
      gl_FragColor.rgb = glitchColor;
    } else {
      // Smooth blend between glitch texture and resting color as uFadeProgress goes 0 -> 1
      float blendFactor = smoothstep(0.0, 0.95, uFadeProgress);
      vec3 blendedTransition = mix(glitchColor, settleColor, blendFactor);

      // Soft dither edge highlight that smoothly fades away during early transition
      if (blockVal >= uFadeProgress && blockVal < uFadeProgress + 0.08 && uFadeProgress < 0.85) {
        vec3 softEdge = mix(
          vec3(0.0, 0.85, 0.8),
          vec3(0.85, 0.0, 0.7),
          hash(blockUv + floor(uTime * 15.0))
        );
        blendedTransition = mix(blendedTransition, softEdge, (1.0 - blendFactor) * 0.3);
      }
      gl_FragColor.rgb = blendedTransition;
    }
  } else if (isSoftSelectIn && transitionActive > 0.5) {
    float reveal = 1.0 - uFadeProgress;
    float grain = smoothstep(0.1, 0.6, reveal);
    gl_FragColor.rgb = mix(settleColor, staticVec * sideShade, grain * 0.5);
  } else {
    gl_FragColor.rgb = staticVec * sideShade;
  }

  // Grain TV tactile micro-subtil sur l'intégralité des faces des pays
  float surfaceGrain = (hash(fragPx * 0.38 + vec2(0.4, 0.7)) - 0.5) * 0.055;
  gl_FragColor.rgb += vec3(surfaceGrain);

  if (uIsError > 0.5 || uIsSuccess > 0.5 || isFoundSurface) {
    gl_FragColor.a = 1.0;
  } else if (isDeselecting > 0.5) {
    if (uIsSatellite > 0.5) {
      // Smooth opacity fade out in satellite mode
      float satAlpha = clamp(1.0 - dissolveFade, 0.0, 1.0);
      gl_FragColor.a = satAlpha;
    } else {
      gl_FragColor.a = 1.0;
    }
  } else {
    gl_FragColor.a = (uIsSatellite > 0.5) ? (1.0 - finalProgress) : 1.0;
  }
`;
