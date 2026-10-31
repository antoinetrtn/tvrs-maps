/**
 * TSL port of the country glitch shader (globeShaders.js GLITCH_* +
 * polygonGlitchShader.js) for the WebGPU renderer. Same uniforms, same maths;
 * the per-material uniform nodes are exposed as `material.userData.shader
 * .uniforms` so every existing JS writer (`.value = …`) keeps working.
 */
import * as THREE from "three";
import {
  abs,
  acos,
  asin,
  atan,
  clamp,
  cos,
  dot,
  float,
  floor,
  Fn,
  fract,
  If,
  length,
  materialReference,
  max,
  mix,
  mod,
  modelViewProjection,
  normalize,
  positionLocal,
  positionWorld,
  select,
  sin,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

import { getCapitalLightsTexture } from "../capitalLightsTexture";
import { DISCOVERY } from "../discoveryTimeline";
import { getFeatureMaskTexture } from "../featureMask";
import { SELECT_CITY_ALPHA_VALUE, SELECT_CITY_AMBER_RGB } from "../globeShaders";
import { getSelectionOutlineTexture, selectionOutlineBox } from "../selectionOutline";
import {
  BLACKOUT_TINT_HOME_RGB,
  BLACKOUT_TINT_RGB,
  SELECT_EDGE_RGB_VALUE,
  SELECT_HALO_ALPHA_VALUE,
  SELECT_LAND_TINT_RGB,
  SELECT_PULSE_S_VALUE,
  SELECT_PULSE_STEPS_VALUE,
} from "../selectionStyle";
import { discoveryLandStep } from "./igniteNodes";
import { fromDisplay, hash, litDisplayColor, mirrorUniform } from "./tslCommon";

const PI = 3.14159;
const CITY_AMBER = vec3(...SELECT_CITY_AMBER_RGB);
const EDGE_RGB = vec3(...SELECT_EDGE_RGB_VALUE);
const LAND_TINT = vec3(...SELECT_LAND_TINT_RGB);
const RAD2DEG = 57.29577951;

let sharedNodes = null;
/** Shared uniforms (time, pixel scale, success timeline, tear tints). */
function getSharedNodes(polygonGlitchUniforms) {
  if (!sharedNodes) {
    sharedNodes = {
      uTime: mirrorUniform(polygonGlitchUniforms.uTime),
      uPixelScale: mirrorUniform(polygonGlitchUniforms.uPixelScale),
      uSuccessStart: mirrorUniform(polygonGlitchUniforms.uSuccessStart),
      uSelectStart: mirrorUniform(polygonGlitchUniforms.uSelectStart),
      uShowcaseLights: mirrorUniform(polygonGlitchUniforms.uShowcaseLights),
      uIsRegionalMode: mirrorUniform(polygonGlitchUniforms.uIsRegionalMode),
      uFeatureMode: mirrorUniform(polygonGlitchUniforms.uFeatureMode),
      uSuccessDuration: mirrorUniform(polygonGlitchUniforms.uSuccessDuration),
      uRevealStart: mirrorUniform(polygonGlitchUniforms.uRevealStart),
      uLandRadius: mirrorUniform(polygonGlitchUniforms.uLandRadius),
      uIgniteOrigin: mirrorUniform(polygonGlitchUniforms.uIgniteOrigin),
      uReducedMotion: mirrorUniform(polygonGlitchUniforms.uReducedMotion),
      uGlitchTintA: mirrorUniform(polygonGlitchUniforms.uGlitchTintA),
      uGlitchTintB: mirrorUniform(polygonGlitchUniforms.uGlitchTintB),
      uSelOutlineBox: mirrorUniform(selectionOutlineBox),
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

/**
 * Discovery reveal, success window (GLSL computeDiscoveryEffect twin): stepped land front
 * from the capital towards the found tone, amber outline (walls) ahead of it. No flash.
 */
function discoveryEffect(u, staticColor, foundColor, dir, cell, isWall) {
  const revealT = u.uTime.sub(u.uRevealStart);
  const dist = acos(clamp(dot(dir, u.uIgniteOrigin), -1.0, 1.0));
  const landStep = discoveryLandStep({
    revealT,
    dist,
    radius: u.uLandRadius,
    cell,
    reduced: u.uReducedMotion,
  });
  const color = mix(staticColor, foundColor, landStep);
  const outlineIn = floor(clamp(revealT.div(DISCOVERY.OUTLINE_S), 0.0, 1.0).mul(2.0)).div(2.0);
  const outline = isWall
    .mul(outlineIn)
    .mul(float(1).sub(landStep))
    .mul(float(1).sub(u.uReducedMotion));
  return mix(color, CITY_AMBER.div(u.uSideShade.max(0.001)), outline.mul(DISCOVERY.OUTLINE_ALPHA));
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
  // Flat selection (GLSL parity): surface pixel outline from the per-selection mask.
  const box = u.uSelOutlineBox;
  const ocRaw = vec2(atan(sphereDir.x, sphereDir.z).mul(RAD2DEG), sphereLat.mul(RAD2DEG))
    .sub(box.xy)
    .div(box.z);
  const oc = vec2(mod(ocRaw.x, float(360).div(box.z)), ocRaw.y);
  const ocCell = floor(oc);
  const inBox = step(oc.x, box.w).mul(step(0.0, oc.y)).mul(step(oc.y, box.w));
  const edgeV = texture(getSelectionOutlineTexture(), ocCell.add(0.5).div(max(box.w, 1.0)))
    .r.mul(inBox)
    .mul(float(1).sub(side));
  const edgeOn = step(hash(ocCell.add(7.0)), lightProg.mul(2.0)).mul(
    float(1).sub(transitionActive)
  );
  const edgeOuter = step(0.9, edgeV).mul(edgeOn);
  const edgeHalo = step(0.15, edgeV)
    .mul(float(1).sub(step(0.9, edgeV)))
    .mul(edgeOn);
  // Halo breathes in a few flat steps (pixel-art, no strobe); still under reduced motion.
  const pulseWave = sin(time.mul(6.2831853 / SELECT_PULSE_S_VALUE))
    .mul(0.5)
    .add(0.5);
  const pulse = mix(
    floor(pulseWave.mul(SELECT_PULSE_STEPS_VALUE).add(0.5)).div(SELECT_PULSE_STEPS_VALUE),
    float(0.6),
    u.uReducedMotion
  );
  const haloAmt = edgeHalo.mul(edgeV).mul(SELECT_HALO_ALPHA_VALUE).mul(pulse.mul(0.65).add(0.35));
  const selLand = vec3(dot(lit, vec3(0.299, 0.587, 0.114))).mul(LAND_TINT);
  const staticVec = mix(
    mix(
      mix(mix(lit, selLand, float(1).sub(side)), wallTone, wallOn),
      CITY_AMBER,
      cityOn.mul(SELECT_CITY_ALPHA_VALUE)
    ),
    EDGE_RGB,
    haloAmt
  );
  const foundRestingColor = vec3(0.48, 0.34, 0.15);

  const finalStatic = mix(staticVec, EDGE_RGB, edgeOuter);
  const finalColor = vec3(finalStatic).toVar();
  If(on(u.uIsError), () => {
    finalColor.assign(errorEffect(time, blockUv, positionWorld));
  })
    .ElseIf(on(u.uIsSuccess), () => {
      finalColor.assign(
        discoveryEffect(
          u,
          finalStatic,
          foundRestingColor,
          sphereDir,
          selCell,
          max(side, step(0.9, edgeV))
        )
      );
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
    selUv,
    transitionActive,
    glitchAmp,
    fragPx,
    blockUv,
    staticVec: finalStatic,
    finalColor,
    isCityPx,
    pixelOn: step(0.01, cityOn.add(wallOn).add(edgeOuter)),
    sideShade,
    foundRestingColor,
    unfoundRestColor: unfoundRestColor(u, lit),
  };
}

/** GLSL parity: resting unfound land (surface blackout formula) the deselect settles to. */
function unfoundRestColor(u, lit) {
  const showcase = u.uShowcaseLights;
  const regional = u.uIsRegionalMode;
  const restBlackout = float(1).sub(showcase).mul(float(1).sub(regional));
  const restGrey = vec3(dot(lit, vec3(0.299, 0.587, 0.114))).mul(
    mix(vec3(...BLACKOUT_TINT_RGB), vec3(...BLACKOUT_TINT_HOME_RGB), showcase)
  );
  return mix(lit, restGrey, restBlackout.mul(0.88)).mul(
    mix(float(1.0), mix(float(0.36), float(0.74), regional), float(1).sub(showcase))
  );
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
    const { transitionActive, staticVec, sideShade, foundRestingColor, isCityPx, pixelOn, selUv } =
      base;
    const { unfoundRestColor: restColor } = base;
    const deselectDone = step(0.994, u.uFadeProgress);
    const { glitchColor } = glitchDissolve(u, base);
    const settleColor = mix(
      restColor.mul(sideShade),
      foundRestingColor.mul(sideShade),
      step(0.5, u.uIsFound)
    ).toVar();

    const feedback = on(u.uIsError).or(on(u.uIsSuccess));
    const isFoundSurface = on(u.uIsFound);
    const transiting = on(transitionActive);

    const rgb = vec3(mix(staticVec, restColor, deselectDone).mul(sideShade)).toVar();
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

    If(on(u.uFeatureMode), () => {
      const featSample = texture(getFeatureMaskTexture(), selUv).r;
      const isFeatCore = step(0.9, featSample);
      const isFeatHalo = step(0.2, featSample).mul(float(1.0).sub(isFeatCore));
      const isFeatFound = step(0.1, featSample).mul(float(1.0).sub(step(0.2, featSample)));
      const featPulseWave = sin(u.uTime.mul(6.2831853 / SELECT_PULSE_S_VALUE))
        .mul(0.5)
        .add(0.5);
      const featPulse = mix(
        floor(featPulseWave.mul(SELECT_PULSE_STEPS_VALUE).add(0.5)).div(SELECT_PULSE_STEPS_VALUE),
        float(0.6),
        u.uReducedMotion
      );
      const featHaloAmt = isFeatHalo
        .mul(featSample)
        .mul(SELECT_HALO_ALPHA_VALUE)
        .mul(featPulse.mul(0.65).add(0.35));

      const capSample = texture(getCapitalLightsTexture(), selUv);
      const mRelief = capSample.b;
      const rVal = capSample.a;
      const rCore = step(0.65, rVal);
      const rCrest = step(0.76, mRelief);
      const rSpur = float(1.0).sub(rCrest).mul(step(0.38, mRelief));
      const rShimmer = sin(u.uTime.mul(2.2).add(selUv.x.mul(140.0).add(selUv.y.mul(90.0))))
        .mul(0.22)
        .add(0.78);
      const fCrest = vec3(0.92, 0.78, 0.48);
      const fSpur = vec3(0.68, 0.5, 0.24);
      const fRiver = mix(vec3(0.22, 0.68, 0.92), vec3(0.45, 0.88, 1.0), rShimmer);

      rgb.assign(mix(rgb, fSpur, isFeatFound.mul(rSpur)));
      rgb.assign(mix(rgb, fCrest, isFeatFound.mul(rCrest)));
      rgb.assign(mix(rgb, fRiver, isFeatFound.mul(rCore)));
      rgb.assign(mix(rgb, EDGE_RGB, featHaloAmt));
      rgb.assign(mix(rgb, EDGE_RGB, isFeatCore));
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
