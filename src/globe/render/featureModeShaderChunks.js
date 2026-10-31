/**
 * Rivers & Mountains mode GLSL (uFeatureMode / uFeatureMap, see featureMask.js).
 * TSL twin: webgpu/featureNodes.js. Relies on the SELECT_* defines of globeShaders.
 */

export const FEATURE_DECLARATIONS = `
  uniform float uFeatureMode;
  uniform sampler2D uFeatureMap;`;

/** Glitch (selected/transitioning cap) pass: found features + selected outline/halo. */
export const FEATURE_GLITCH_CHUNK = `
  if (uFeatureMode > 0.5) {
    float featSample = texture2D(uFeatureMap, selUv).r;
    float isFeatCore = step(0.90, featSample);
    float isFeatHover = step(0.84, featSample) * (1.0 - isFeatCore);
    float isFeatHalo = step(0.20, featSample) * (1.0 - step(0.84, featSample));
    float isFeatFound = step(0.10, featSample) * (1.0 - step(0.20, featSample));
    float featPulseWave = 0.5 + 0.5 * sin(uTime * 6.2831853 / SELECT_PULSE_S);
    float featPulse = mix(floor(featPulseWave * SELECT_PULSE_STEPS + 0.5) / SELECT_PULSE_STEPS, 0.6, uReducedMotion);
    float featHaloAmt = isFeatHalo * featSample * SELECT_HALO_ALPHA * (0.35 + 0.65 * featPulse);

    vec4 capSample = texture2D(uCapitalLightsMap, selUv);
    float mRelief = capSample.b;
    float rVal = capSample.a;
    float rCore = step(0.65, rVal);
    float rCrest = step(0.76, mRelief);
    float rSpur = (1.0 - rCrest) * step(0.38, mRelief);
    float rShimmer = 0.78 + 0.22 * sin(uTime * 2.2 + (selUv.x * 140.0 + selUv.y * 90.0));
    vec3 fCrest = vec3(0.92, 0.78, 0.48);
    vec3 fSpur = vec3(0.68, 0.50, 0.24);
    vec3 fRiver = mix(vec3(0.22, 0.68, 0.92), vec3(0.45, 0.88, 1.0), rShimmer);

    gl_FragColor.rgb = mix(gl_FragColor.rgb, fSpur, isFeatFound * rSpur);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fCrest, isFeatFound * rCrest);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fRiver, isFeatFound * rCore);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, SELECT_EDGE_RGB, featHaloAmt);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, SELECT_EDGE_RGB, isFeatHover * 0.6);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, SELECT_EDGE_RGB, isFeatCore);
  }
`;

/** Surface pass: land darker, rivers/relief readable, found tint, selected outline/halo. */
export const FEATURE_SURFACE_CHUNK = `
      // Feature mode (rivers & mountains): land darker so features pop, readable cool blue
      // river core and warm light crest/spur relief across ALL land caps.
      // Only features of the game dataset are drawn (mask >= 20/255); the decorative
      // extra rivers / ranges stay hidden in this simplified view.
      float featMember = step(0.05, texture2D(uFeatureMap, cartUv).r);
      float featSpur = ridgeSpur * featMember;
      float featCrest = ridgeCrest * featMember;
      float featRiverCore = riverCore * featMember;
      vec3 featBaseLit = baseLit * 0.60 * (1.0 - valleyGap * 0.20);
      vec3 featSpurTone = vec3(0.62, 0.50, 0.35);
      vec3 featCrestTone = vec3(0.88, 0.76, 0.56);
      vec3 featReliefLit = mix(featBaseLit, featSpurTone, featSpur * (0.75 + 0.15 * cityHash));
      featReliefLit = mix(featReliefLit, featCrestTone, featCrest * 0.92);

      vec3 featRiverColor = mix(vec3(0.24, 0.58, 0.84), vec3(0.40, 0.78, 0.96), riverShimmer);
      vec3 featRiverLit = mix(featReliefLit * (1.0 - riverBank * featMember * 0.15), featRiverColor, featRiverCore * 0.92);

      vec3 activeTerrainLit = mix(terrainLit, featRiverLit, uFeatureMode);

      float featSample = texture2D(uFeatureMap, cartUv).r * uFeatureMode;
      float isFeatCore = step(0.90, featSample);
      float isFeatHover = step(0.84, featSample) * (1.0 - isFeatCore);
      float isFeatHalo = step(0.20, featSample) * (1.0 - step(0.84, featSample));
      float isFeatFound = step(0.10, featSample) * (1.0 - step(0.20, featSample));

      float featPulseWave = 0.5 + 0.5 * sin(uTime * 6.2831853 / SELECT_PULSE_S);
      float featPulse = mix(floor(featPulseWave * SELECT_PULSE_STEPS + 0.5) / SELECT_PULSE_STEPS, 0.6, uReducedMotion);
      float featHaloAmt = isFeatHalo * featSample * SELECT_HALO_ALPHA * (0.35 + 0.65 * featPulse);

      vec3 foundReliefCrest = vec3(0.92, 0.78, 0.48);
      vec3 foundReliefSpur = vec3(0.68, 0.50, 0.24);
      vec3 foundRiverColor = mix(vec3(0.22, 0.68, 0.92), vec3(0.45, 0.88, 1.0), riverShimmer);

      vec3 featFoundLit = mix(activeTerrainLit, foundReliefSpur, ridgeSpur * isFeatFound);
      featFoundLit = mix(featFoundLit, foundReliefCrest, ridgeCrest * isFeatFound);
      featFoundLit = mix(featFoundLit, foundRiverColor, riverCore * isFeatFound);
      activeTerrainLit = mix(activeTerrainLit, featFoundLit, isFeatFound);

      activeTerrainLit = mix(activeTerrainLit, SELECT_EDGE_RGB, featHaloAmt);
      activeTerrainLit = mix(activeTerrainLit, SELECT_EDGE_RGB, isFeatHover * 0.6);
      activeTerrainLit = mix(activeTerrainLit, SELECT_EDGE_RGB, isFeatCore);
`;
