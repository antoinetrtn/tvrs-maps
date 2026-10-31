/**
 * TSL port of the country glitch shader (globeShaders.js GLITCH_* +
 * polygonGlitchShader.js) for the WebGPU renderer. Same uniforms, same maths;
 * the per-material uniform nodes are exposed as `material.userData.shader
 * .uniforms` so every existing JS writer (`.value = …`) keeps working.
 */
import * as THREE from "three";
import {
  abs,
  asin,
  atan,
  cameraPosition,
  clamp,
  cos,
  float,
  floor,
  Fn,
  fract,
  If,
  length,
  materialReference,
  mix,
  modelViewProjection,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

import { bayer4x4, fromDisplay, hash, litDisplayColor, mirrorUniform } from "./tslCommon";

const PI = 3.14159;

let sharedNodes = null;
/** Shared uniforms (time, found green, pixel scale, success timeline). */
function getSharedNodes(polygonGlitchUniforms) {
  if (!sharedNodes) {
    sharedNodes = {
      uTime: mirrorUniform(polygonGlitchUniforms.uTime),
      uPixelScale: mirrorUniform(polygonGlitchUniforms.uPixelScale),
      uSuccessStart: mirrorUniform(polygonGlitchUniforms.uSuccessStart),
      uSuccessDuration: mirrorUniform(polygonGlitchUniforms.uSuccessDuration),
      uFoundGreen: mirrorUniform(polygonGlitchUniforms.uFoundGreen),
      uGlitchTintA: mirrorUniform(polygonGlitchUniforms.uGlitchTintA),
      uGlitchTintB: mirrorUniform(polygonGlitchUniforms.uGlitchTintB),
    };
  }
  return sharedNodes;
}

const PER_MATERIAL = [
  "uFadeProgress",
  "uTargetColor",
  "uIsError",
  "uIsSuccess",
  "uIsSelection",
  "uIsLight",
  "uTheme",
  "uIsSide",
  "uIsFound",
  "uSelectInTransition",
  "uSideShade",
  "uIsSatellite",
];

let outputNode = null;
let apexNode = null;
const getApexNode = () => (apexNode ||= hideConeApexVertexNode());

/**
 * Per-material values live on `material.userData.glitch` and are read through
 * materialReference nodes: WebGPU shares one compiled pipeline (and its
 * bindings) between materials with the same structure, so per-material
 * `uniform()` nodes would all end up reading the first material's values.
 * Returns `{ uniforms }` handles (`.value` get/set) like the GLSL shader object.
 */
export function attachGlitchNodes(material, polygonGlitchUniforms, initial) {
  const store = {};
  Object.entries(initial).forEach(([name, value]) => {
    store[name] = value?.isColor ? new THREE.Color().copy(value) : value;
  });
  material.userData.glitch = store;
  const shared = getSharedNodes(polygonGlitchUniforms);
  const uniforms = { ...shared };
  Object.keys(store).forEach((name) => {
    uniforms[name] = {
      get value() {
        return store[name];
      },
      set value(v) {
        store[name] = v;
      },
    };
  });
  if (!outputNode) {
    const u = { ...shared };
    PER_MATERIAL.forEach((name) => {
      u[name] = materialReference(
        `userData.glitch.${name}`,
        name === "uTargetColor" ? "color" : "float"
      );
    });
    outputNode = createGlitchOutputNode(u);
  }
  material.outputNode = outputNode;
  material.vertexNode = getApexNode();
  return { uniforms };
}

function errorEffect(finalColor, time, theme, noiseUv, worldPos) {
  const pulse = sin(time.mul(24)).mul(0.4).add(0.6);
  const sweep = step(fract(worldPos.y.mul(0.24).sub(time.mul(6))), 0.2).mul(0.5);
  const errorNoise = hash(noiseUv.add(sin(time.mul(60))));
  const noisyIntensity = pulse.add(sweep).mul(mix(0.6, 1.4, errorNoise));
  const errorRed = vec3(1.0, 0.05, 0.01).mul(noisyIntensity.add(0.3));
  const chroma = errorNoise.sub(0.5).mul(0.62);
  const split = vec3(
    clamp(errorRed.x.add(chroma.mul(0.5)), 0, 1),
    clamp(errorRed.y.sub(abs(chroma).mul(0.6)), 0, 1),
    clamp(errorRed.z.sub(chroma.mul(0.5)), 0, 1)
  ).toVar();
  If(errorNoise.greaterThan(0.85), () => {
    split.assign(mix(split, vec3(0, 1, 1), 0.75));
  }).ElseIf(errorNoise.lessThan(0.15), () => {
    split.assign(mix(split, vec3(1, 0, 1), 0.75));
  });
  const isBlackout = theme.greaterThan(0.9).and(theme.lessThan(1.1));
  return select(isBlackout, split, mix(finalColor, split, 0.95));
}

function successEffect(u, time, blockUv, worldPos) {
  const p = clamp(time.sub(u.uSuccessStart).div(u.uSuccessDuration), 0, 1);
  const blockNoise = hash(blockUv.mul(0.5).add(17.0));
  const resolved = step(blockNoise, smoothstep(0.0, 0.78, p));
  const flick = mix(0.7, 1.35, hash(blockUv.add(floor(time.mul(60)))));
  const isMonoAwakening = u.uTheme.greaterThan(0.5).and(u.uIsSatellite.lessThan(0.5));
  const targetTone = select(isMonoAwakening, vec3(0.96, 0.68, 0.22), u.uFoundGreen);
  const hot = mix(vec3(1.0, 0.97, 0.86), targetTone, 0.25).mul(flick);
  const sweep = step(fract(worldPos.y.mul(0.18).sub(p.mul(2.8))), 0.22)
    .mul(float(1).sub(smoothstep(0.3, 0.8, p)))
    .mul(0.7);
  const baseTone = mix(hot, targetTone, resolved).add(targetTone.mul(sweep)).toVar();
  If(p.lessThan(0.85), () => {
    const burstChroma = float(1)
      .sub(p)
      .mul(0.45)
      .mul(hash(blockUv.add(time.mul(12))).sub(0.5));
    baseTone.assign(
      vec3(
        clamp(baseTone.x.add(burstChroma.mul(0.6)), 0, 1),
        clamp(baseTone.y.add(abs(burstChroma).mul(0.25)), 0, 1),
        clamp(baseTone.z.sub(burstChroma.mul(0.7)), 0, 1)
      )
    );
  });
  return baseTone;
}

function selectionEffect(finalColor, green, time, theme, isSatellite) {
  const pulse = sin(time.mul(3.2)).mul(0.08).add(0.92);
  const isMonoAwakening = theme.greaterThan(0.5).and(isSatellite.lessThan(0.5));
  const targetTone = select(isMonoAwakening, vec3(0.92, 0.68, 0.24), green);
  const isBlackout = theme.greaterThan(0.9).and(theme.lessThan(1.1));
  return select(
    isMonoAwakening,
    targetTone.mul(pulse.mul(0.72).add(0.16)),
    select(
      isBlackout,
      targetTone.mul(pulse.mul(0.36).add(0.26)),
      mix(finalColor, targetTone.mul(pulse.mul(0.48).add(0.36)), 0.56)
    )
  );
}

const edgeGlowAt = (bayer) => mix(vec3(0.96, 0.68, 0.22), vec3(1.0, 0.88, 0.48), step(0.5, bayer));

const on = (x) => x.greaterThan(0.5);

/** Warm pixel-dithered Atlas Lantern selection base colour. */
function glitchBase(u, lit) {
  const time = u.uTime;
  const transitionActive = step(0.006, u.uFadeProgress).mul(
    float(1).sub(step(0.994, u.uFadeProgress))
  );
  const selectInScale = mix(1.0, 0.52, step(0.5, u.uSelectInTransition));
  const glitchAmp = transitionActive
    .mul(sin(u.uFadeProgress.mul(PI)).mul(0.6).add(0.4))
    .mul(selectInScale);

  const sphereDir = normalize(positionWorld);
  const sphereLat = asin(clamp(sphereDir.y, -1.0, 1.0));
  const sphereLng = atan(sphereDir.z, sphereDir.x);
  const fragPx = vec2(sphereLng.mul(cos(sphereLat.mul(0.65))), sphereLat).mul(520.0);
  const bayer = bayer4x4(floor(fragPx));
  const coarseBayer = bayer4x4(floor(fragPx.mul(0.5)));
  const blockUv = floor(fragPx.mul(0.85));

  const viewDir = normalize(cameraPosition.sub(positionWorld));
  const ndv = clamp(importDot(sphereDir, viewDir), 0.0, 1.0);
  const sphereShade = mix(0.95, 1.02, smoothstep(0.0, 0.65, ndv));

  const light = on(u.uIsLight);
  const lanternPulse = sin(time.mul(3.2)).mul(0.07).add(0.93);
  const stippleStep = step(0.5, coarseBayer);
  const lanternDark = mix(vec3(0.3, 0.22, 0.12), vec3(0.39, 0.28, 0.15), stippleStep);
  const lanternLight = mix(vec3(0.82, 0.72, 0.52), vec3(0.9, 0.8, 0.6), stippleStep);
  const lanternBase = select(light, lanternLight, lanternDark);
  const rimWarmth = pow(float(1.0).sub(ndv), 2.0).mul(
    select(light, vec3(0.16, 0.11, 0.04), vec3(0.34, 0.22, 0.07))
  );
  const staticVec = lanternBase.mul(sphereShade).mul(lanternPulse).add(rimWarmth).toVar();
  const isMonoAwakening = on(u.uTheme).and(on(u.uIsSatellite).not());
  const foundRestingColor = select(isMonoAwakening, vec3(0.48, 0.34, 0.15), u.uFoundGreen);

  const finalColor = vec3(staticVec).toVar();
  If(on(u.uIsError), () => {
    finalColor.assign(errorEffect(lit, time, u.uTheme, blockUv, positionWorld));
  })
    .ElseIf(on(u.uIsSuccess), () => {
      finalColor.assign(successEffect(u, time, blockUv, positionWorld));
    })
    .ElseIf(on(u.uIsSelection), () => {
      finalColor.assign(selectionEffect(lit, u.uFoundGreen, time, u.uTheme, u.uIsSatellite));
    })
    .ElseIf(on(u.uIsFound), () => {
      finalColor.assign(foundRestingColor);
    });
  const sideShade = mix(1.0, u.uSideShade, step(0.5, u.uIsSide));
  finalColor.mulAssign(sideShade);
  return {
    transitionActive,
    glitchAmp,
    fragPx,
    blockUv,
    staticVec,
    finalColor,
    sideShade,
    bayer,
    foundRestingColor,
  };
}

function importDot(a, b) {
  return a.x.mul(b.x).add(a.y.mul(b.y)).add(a.z.mul(b.z));
}

/** Ordered pixel-art Bayer dither dissolve with warm amber frontier embers. */
function glitchDissolve(u, base) {
  const { finalColor } = base;
  const glitchThreshold = clamp(u.uFadeProgress, 0, 1).toVar();
  const glitchColor = vec3(finalColor).toVar();
  return { glitchThreshold, glitchColor };
}

/** Fragment output node equivalent to GLITCH_FRAGMENT_BODY. */
function createGlitchOutputNode(u) {
  return Fn(() => {
    const lit = litDisplayColor();
    const base = glitchBase(u, lit);
    const { transitionActive, fragPx, staticVec, sideShade, bayer, foundRestingColor } = base;
    const { glitchThreshold, glitchColor } = glitchDissolve(u, base);

    const settleColor = mix(lit, foundRestingColor.mul(sideShade), step(0.5, u.uIsFound)).toVar();
    const cellNoise = hash(floor(fragPx.mul(0.25)));
    const blockVal = mix(bayer, cellNoise, 0.32);
    const edgeGlow = edgeGlowAt(bayer);

    const feedback = on(u.uIsError).or(on(u.uIsSuccess));
    const isFoundSurface = on(u.uIsFound);
    const transiting = on(transitionActive);
    const satellite = on(u.uIsSatellite);

    const rgb = vec3(staticVec.mul(sideShade)).toVar();
    If(feedback, () => {
      rgb.assign(glitchColor);
    })
      .ElseIf(isFoundSurface, () => {
        rgb.assign(foundRestingColor.mul(sideShade));
      })
      .ElseIf(transiting.and(satellite), () => {
        rgb.assign(glitchColor);
      })
      .ElseIf(transiting.and(blockVal.lessThan(glitchThreshold)), () => {
        rgb.assign(settleColor);
      })
      .ElseIf(transiting.and(blockVal.lessThan(glitchThreshold.add(0.11))), () => {
        rgb.assign(mix(glitchColor, edgeGlow, 0.72));
      })
      .ElseIf(transiting, () => {
        rgb.assign(glitchColor);
      });

    const alpha = float(1).toVar();
    const fade = u.uFadeProgress;
    const satDissolve = feedback.or(isFoundSurface).not().and(transiting).and(satellite);
    If(satDissolve.and(blockVal.lessThan(fade)), () => {
      alpha.assign(0);
    }).ElseIf(satDissolve, () => {
      rgb.assign(select(blockVal.lessThan(fade.add(0.11)), mix(rgb, edgeGlow, 0.72), rgb));
      alpha.assign(float(1).sub(fade.mul(fade)));
    });
    If(feedback.or(isFoundSurface).or(transiting).not().and(satellite), () => {
      alpha.assign(float(1).sub(clamp(fade, 0, 1)));
    });

    return vec4(fromDisplay(clamp(rgb, 0, 1)), alpha);
  })();
}

/** GLSL: `if (length(position) < 10.0) gl_Position = vec4(9999.0, …)` — drops
 * the cone apex (globe centre) vertices of the conic polygon geometry. */
function hideConeApexVertexNode() {
  return select(
    length(positionLocal).lessThan(10.0),
    vec4(9999.0, 9999.0, 9999.0, 1.0),
    modelViewProjection
  );
}
