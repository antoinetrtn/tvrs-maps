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
  select,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

import { getCapitalLightsTexture } from "../capitalLightsTexture";
import { SELECT_CITY_ALPHA_VALUE, SELECT_CITY_AMBER_RGB } from "../globeShaders";
import { fromDisplay, hash, litDisplayColor, mirrorUniform } from "./tslCommon";

const PI = 3.14159;
const CITY_AMBER = vec3(...SELECT_CITY_AMBER_RGB);

let sharedNodes = null;
/** Shared uniforms (time, pixel scale, success timeline, tear tints). */
function getSharedNodes(polygonGlitchUniforms) {
  if (!sharedNodes) {
    sharedNodes = {
      uTime: mirrorUniform(polygonGlitchUniforms.uTime),
      uPixelScale: mirrorUniform(polygonGlitchUniforms.uPixelScale),
      uSuccessStart: mirrorUniform(polygonGlitchUniforms.uSuccessStart),
      uSelectStart: mirrorUniform(polygonGlitchUniforms.uSelectStart),
      uSuccessDuration: mirrorUniform(polygonGlitchUniforms.uSuccessDuration),
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
  "uIsSide",
  "uIsFound",
  "uSelectInTransition",
  "uSideShade",
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

function errorEffect(time, noiseUv, worldPos) {
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
  return split;
}

function successEffect(u, time, blockUv, worldPos) {
  const p = clamp(time.sub(u.uSuccessStart).div(u.uSuccessDuration), 0, 1);
  const blockNoise = hash(blockUv.mul(0.5).add(17.0));
  const resolved = step(blockNoise, smoothstep(0.0, 0.78, p));
  const flick = mix(0.7, 1.35, hash(blockUv.add(floor(time.mul(60)))));
  const targetTone = vec3(0.96, 0.68, 0.22);
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

function selectionEffect(time) {
  const pulse = sin(time.mul(3.2)).mul(0.08).add(0.92);
  return vec3(0.92, 0.68, 0.24).mul(pulse.mul(0.72).add(0.16));
}

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
  const blockUv = floor(fragPx.mul(0.85));

  // Selection (GLSL parity): the country's real city-light pixels (same texture cells
  // as the found ignition) glow dim amber in stepped order, border in square pixels.
  const side = step(0.5, u.uIsSide);
  const selectIn = clamp(time.sub(u.uSelectStart).div(0.5), 0, 1);
  const lightProg = select(
    on(transitionActive),
    float(1).sub(floor(u.uFadeProgress.mul(5.0)).div(5.0)),
    floor(selectIn.mul(6.0)).div(6.0)
  );
  const selUv = vec2(
    atan(sphereDir.x, sphereDir.z).div(6.2831853).add(0.5),
    sphereLat.div(3.14159265).add(0.5)
  );
  const selCell = floor(selUv.mul(vec2(3600.0, 1800.0)));
  const isCityPx = step(0.25, texture(getCapitalLightsTexture(), selUv).r).mul(float(1).sub(side));
  const cityOn = isCityPx.mul(step(hash(selCell.add(3.7)), lightProg.mul(1.15).sub(0.15)));
  const wallOn = side.mul(step(hash(floor(fragPx.mul(0.5)).add(7.0)), lightProg.mul(2.0)));
  const wallTone = vec3(1.0, 0.74, 0.3).div(u.uSideShade.max(0.001));
  const staticVec = mix(
    mix(lit, wallTone, wallOn),
    CITY_AMBER,
    cityOn.mul(SELECT_CITY_ALPHA_VALUE)
  );
  const foundRestingColor = vec3(0.48, 0.34, 0.15);

  const finalColor = vec3(staticVec).toVar();
  If(on(u.uIsError), () => {
    finalColor.assign(errorEffect(time, blockUv, positionWorld));
  })
    .ElseIf(on(u.uIsSuccess), () => {
      finalColor.assign(successEffect(u, time, blockUv, positionWorld));
    })
    .ElseIf(on(u.uIsSelection), () => {
      finalColor.assign(selectionEffect(time));
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
    isCityPx,
    pixelOn: step(0.01, cityOn.add(wallOn)),
    sideShade,
    foundRestingColor,
  };
}

/** Smooth crossfade state (no checkerboard). */
function glitchDissolve(u, base) {
  const { finalColor } = base;
  const glitchColor = vec3(finalColor).toVar();
  return { glitchColor };
}

/** Fragment output node equivalent to GLITCH_FRAGMENT_BODY. */
function createGlitchOutputNode(u) {
  return Fn(() => {
    const lit = litDisplayColor();
    const base = glitchBase(u, lit);
    const { transitionActive, staticVec, sideShade, foundRestingColor, isCityPx, pixelOn } = base;
    const { glitchColor } = glitchDissolve(u, base);
    const settleColor = mix(lit, foundRestingColor.mul(sideShade), step(0.5, u.uIsFound)).toVar();

    const feedback = on(u.uIsError).or(on(u.uIsSuccess));
    const isFoundSurface = on(u.uIsFound);
    const transiting = on(transitionActive);

    const rgb = vec3(staticVec.mul(sideShade)).toVar();
    If(feedback, () => {
      rgb.assign(glitchColor);
    })
      .ElseIf(isFoundSurface, () => {
        rgb.assign(foundRestingColor.mul(sideShade));
      })
      .ElseIf(transiting, () => {
        rgb.assign(mix(settleColor, staticVec.mul(sideShade), pixelOn));
      });
    If(on(u.uIsSuccess), () => {
      rgb.assign(mix(rgb, CITY_AMBER, isCityPx.mul(SELECT_CITY_ALPHA_VALUE)));
    });

    return vec4(fromDisplay(clamp(rgb, 0, 1)), 1.0);
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
