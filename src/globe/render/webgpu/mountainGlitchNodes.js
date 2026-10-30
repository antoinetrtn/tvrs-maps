/** Node twin of LowPolyBiomes' mountain glitch material (WebGPU renderer only). */
import {
  clamp,
  float,
  Fn,
  fract,
  If,
  mix,
  positionLocal,
  select,
  sin,
  step,
  vec2,
  vec3,
} from "three/tsl";
import { MeshPhongNodeMaterial } from "three/webgpu";

import { displayOutput, hash, mirrorUniform } from "./tslCommon";

let mountainShared = null;
/** Node twin of LowPolyBiomes' mountain glitch material. */
export function createMountainGlitchNodeMaterial(mountainGlitchUniforms, isLight) {
  const mat = new MeshPhongNodeMaterial({ flatShading: true, shininess: 0, specular: 0x000000 });
  mat.outputNode = mountainGlitchOutputNode(mountainGlitchUniforms, isLight);
  mat.customProgramCacheKey = () => `mountain-glitch-gpu-${isLight ? "light" : "dark"}`;
  return mat;
}

/** Mountain glitch (LowPolyBiomes glitchMat onBeforeCompile). */
function mountainGlitchOutputNode(mountainGlitchUniforms, isLight) {
  if (!mountainShared) {
    mountainShared = {
      uTime: mirrorUniform(mountainGlitchUniforms.uTime),
      uIsError: mirrorUniform(mountainGlitchUniforms.uIsError),
      uIsSuccess: mirrorUniform(mountainGlitchUniforms.uIsSuccess),
      uFoundGreen: mirrorUniform(mountainGlitchUniforms.uFoundGreen),
    };
  }
  const u = mountainShared;
  // A constant, not a uniform: light/dark materials get distinct pipelines
  // through customProgramCacheKey (see LowPolyBiomes).
  const uIsLight = float(isLight ? 1 : 0);
  return Fn(() => {
    const p = positionLocal;
    const light = uIsLight.greaterThan(0.5);
    const noiseUv = p.xy.mul(8.0).add(vec2(p.z.mul(4.0)));
    const noise = hash(noiseUv.add(sin(u.uTime.mul(28.0))));
    const baseMin = select(light, float(0.65), float(0.12));
    const baseMax = select(light, float(0.98), float(0.68));
    const scanline = sin(p.y.mul(15.0).add(u.uTime.mul(5.0))).mul(
      select(light, float(0.03), float(0.07))
    );
    const finalColor = vec3(mix(baseMin, baseMax, noise).add(scanline)).toVar();
    const pulse = sin(u.uTime.mul(18.0)).mul(0.35).add(0.65);
    const sweep = step(fract(p.y.mul(1.5).sub(u.uTime.mul(4.0))), 0.35).mul(0.4);
    const fxNoise = hash(noiseUv.add(sin(u.uTime.mul(45.0))));
    const intensity = pulse.add(sweep).mul(mix(0.7, 1.3, fxNoise));
    If(u.uIsError.greaterThan(0.5), () => {
      finalColor.assign(vec3(1.0, 0.27, 0.0).mul(intensity.add(0.4)));
    });
    If(u.uIsSuccess.greaterThan(0.5), () => {
      finalColor.assign(u.uFoundGreen.mul(intensity));
    });
    return displayOutput(clamp(finalColor, 0, 1));
  })();
}
