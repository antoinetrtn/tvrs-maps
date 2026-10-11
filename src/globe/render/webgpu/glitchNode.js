/**
 * TSL port of the country glitch shader (globeShaders.js GLITCH_* +
 * polygonGlitchShader.js) for the WebGPU renderer. Same uniforms, same maths;
 * the per-material uniform nodes are exposed as `material.userData.shader
 * .uniforms` so every existing JS writer (`.value = …`) keeps working.
 */
import * as THREE from "three";
import {
  abs,
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
  positionLocal,
  positionWorld,
  screenCoordinate,
  select,
  sin,
  smoothstep,
  step,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

import { fromDisplay, hash, litDisplayColor, mirrorUniform } from "./tslCommon";

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
  const hot = mix(vec3(1.0), u.uFoundGreen, 0.2).mul(flick);
  const sweep = step(fract(worldPos.y.mul(0.18).sub(p.mul(2.8))), 0.22)
    .mul(float(1).sub(smoothstep(0.3, 0.8, p)))
    .mul(0.7);
  const baseGreen = mix(hot, u.uFoundGreen, resolved).add(u.uFoundGreen.mul(sweep)).toVar();
  If(p.lessThan(0.85), () => {
    const burstChroma = float(1)
      .sub(p)
      .mul(0.55)
      .mul(hash(blockUv.add(time.mul(12))).sub(0.5));
    baseGreen.assign(
      vec3(
        clamp(baseGreen.x.add(burstChroma.mul(0.6)), 0, 1),
        clamp(baseGreen.y.add(abs(burstChroma).mul(0.3)), 0, 1),
        clamp(baseGreen.z.sub(burstChroma.mul(0.8)), 0, 1)
      )
    );
  });
  return baseGreen;
}

function selectionEffect(finalColor, green, time, theme, worldPos) {
  const pulse = sin(time.mul(5.5)).mul(0.18).add(0.82);
  const sweep = step(fract(worldPos.y.mul(0.05).sub(time.mul(0.9))), 0.1).mul(0.18);
  const isBlackout = theme.greaterThan(0.9).and(theme.lessThan(1.1));
  return select(
    isBlackout,
    green.mul(pulse.mul(0.32).add(sweep.mul(0.15)).add(0.22)),
    mix(finalColor, green.mul(pulse.mul(0.42).add(sweep).add(0.3)), 0.52)
  );
}

const edgeGlowAt = (blockUv, time) =>
  mix(vec3(0.0, 1.0, 0.95), vec3(1.0, 0.0, 0.85), hash(blockUv.add(floor(time.mul(15)))));

/** Fragment output node equivalent to GLITCH_FRAGMENT_BODY. */
function createGlitchOutputNode(u) {
  return Fn(() => {
    const on = (x) => x.greaterThan(0.5);
    const time = u.uTime;
    const lit = litDisplayColor();
    const worldPos = positionWorld;

    const transitionActive = step(0.006, u.uFadeProgress).mul(
      float(1).sub(step(0.994, u.uFadeProgress))
    );
    const selectInScale = mix(1.0, 0.52, step(0.5, u.uSelectInTransition));
    const glitchAmp = transitionActive
      .mul(sin(u.uFadeProgress.mul(PI)).mul(0.6).add(0.4))
      .mul(selectInScale);
    const t = time.mul(glitchAmp.mul(62).add(28));

    const fragPx = screenCoordinate.xy.mul(u.uPixelScale);
    const blockUv = floor(fragPx.mul(0.24));
    const noiseUv = fragPx.mul(0.28);
    const noiseCoarse = hash(blockUv.add(sin(t)));
    const noiseFine = hash(noiseUv.add(vec2(cos(t.mul(1.6)), sin(t.mul(0.95)))));
    const noise = mix(noiseCoarse, noiseFine, 0.4);

    const light = on(u.uIsLight);
    const baseMin = select(light, float(0.65), float(0.12));
    const baseMax = select(light, float(0.98), float(0.68));
    const scanline = sin(fragPx.y.mul(1.05).add(time.mul(glitchAmp.mul(14).add(6)))).mul(
      select(light, float(0.03), float(0.048))
    );
    const staticVec = vec3(mix(baseMin, baseMax, noise).add(scanline)).toVar();

    const finalColor = vec3(staticVec).toVar();
    If(on(u.uIsError), () => {
      finalColor.assign(errorEffect(lit, time, u.uTheme, blockUv, worldPos));
    })
      .ElseIf(on(u.uIsSuccess), () => {
        finalColor.assign(successEffect(u, time, blockUv, worldPos));
      })
      .ElseIf(on(u.uIsSelection), () => {
        finalColor.assign(selectionEffect(lit, u.uFoundGreen, time, u.uTheme, worldPos));
      })
      .ElseIf(on(u.uIsFound), () => {
        finalColor.assign(u.uFoundGreen);
      });
    const sideShade = mix(1.0, u.uSideShade, step(0.5, u.uIsSide));
    finalColor.mulAssign(sideShade);

    const dissolveBlock = floor(fragPx.mul(0.21)).add(
      vec2(sin(time.mul(58)), cos(time.mul(41)))
        .mul(glitchAmp)
        .mul(3.5)
    );
    const tn1 = hash(dissolveBlock);
    const tn2 = hash(dissolveBlock.mul(1.9).add(time.mul(3.7)));
    const transitionNoise = mix(tn1, tn2, glitchAmp.max(0.35).mul(0.55));
    const horizontalTear = step(
      0.78,
      sin(fragPx.y.mul(0.038).add(time.mul(glitchAmp.mul(95).add(48))))
    );
    const verticalGlitch = step(0.86, hash(vec2(floor(fragPx.x.mul(0.07)), floor(time.mul(24)))));

    const glitchThreshold = u.uFadeProgress.toVar();
    If(on(transitionActive), () => {
      glitchThreshold.addAssign(transitionNoise.sub(0.5).mul(glitchAmp.mul(0.3).add(0.46)));
      If(on(horizontalTear), () => {
        glitchThreshold.assign(clamp(glitchThreshold.sub(0.16), 0, 1));
      });
      If(on(verticalGlitch), () => {
        glitchThreshold.assign(clamp(glitchThreshold.add(0.12), 0, 1));
      });
    });
    const finalProgress = clamp(u.uFadeProgress, 0, 1);

    const glitchColor = vec3(finalColor).toVar();
    const isFoundSurface = on(u.uIsFound);
    If(on(transitionActive).and(isFoundSurface.not()), () => {
      const chroma = transitionNoise.sub(0.5).mul(0.28).mul(glitchAmp);
      glitchColor.assign(
        vec3(
          clamp(finalColor.x.add(chroma), 0, 1),
          clamp(finalColor.y.mul(float(1).sub(glitchAmp.mul(0.15))), 0, 1),
          clamp(finalColor.z.sub(chroma), 0, 1)
        )
      );
      If(on(horizontalTear), () => {
        const tear = mix(vec3(0, 0.8, 1), vec3(1, 0, 0.8), hash(blockUv.add(floor(time.mul(30)))));
        glitchColor.assign(mix(glitchColor, tear, glitchAmp.mul(0.42)));
      });
      If(on(verticalGlitch), () => {
        glitchColor.assign(mix(glitchColor, vec3(0), glitchAmp.mul(0.25)));
      });
    });

    const settleColor = mix(lit, u.uFoundGreen.mul(sideShade), step(0.5, u.uIsFound)).toVar();
    const surfaceNoise = hash(fragPx.mul(0.42).add(vec2(0.12, 0.45)))
      .sub(0.5)
      .mul(0.06);
    staticVec.addAssign(surfaceNoise);
    settleColor.addAssign(surfaceNoise.mul(0.7));
    const blockVal = hash(blockUv.mul(0.38).add(sin(time.mul(8)).mul(0.05)));

    const rgb = vec3(staticVec.mul(sideShade)).toVar();
    const satellite = on(u.uIsSatellite);
    If(on(u.uIsError).or(on(u.uIsSuccess)), () => {
      rgb.assign(glitchColor);
    })
      .ElseIf(isFoundSurface, () => {
        rgb.assign(u.uFoundGreen.mul(sideShade));
      })
      .ElseIf(on(transitionActive), () => {
        rgb.assign(glitchColor);
        If(satellite.not(), () => {
          If(blockVal.lessThan(glitchThreshold), () => {
            rgb.assign(settleColor);
          }).ElseIf(blockVal.lessThan(glitchThreshold.add(0.12)), () => {
            rgb.assign(mix(glitchColor, edgeGlowAt(blockUv, time).mul(1.6), 0.65));
          });
        });
      });
    // (The GLSL soft select-in branch is unreachable: it needs transitionActive,
    // already handled above.)

    rgb.addAssign(
      hash(fragPx.mul(0.38).add(vec2(0.4, 0.7)))
        .sub(0.5)
        .mul(0.055)
    );

    const alpha = float(1).toVar();
    If(on(u.uIsError).or(on(u.uIsSuccess)).or(isFoundSurface).not(), () => {
      If(on(transitionActive), () => {
        If(satellite, () => {
          If(blockVal.lessThan(u.uFadeProgress), () => {
            alpha.assign(0);
          }).Else(() => {
            If(blockVal.lessThan(u.uFadeProgress.add(0.12)), () => {
              rgb.assign(mix(rgb, edgeGlowAt(blockUv, time).mul(1.6), 0.65));
            });
            alpha.assign(float(1).sub(u.uFadeProgress.mul(u.uFadeProgress)));
          });
        });
      }).Else(() => {
        alpha.assign(select(satellite, float(1).sub(finalProgress), float(1)));
      });
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
