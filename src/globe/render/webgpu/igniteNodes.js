/**
 * TSL twin of the GLSL discovery-ignition block (globeShaders.js): city pixels of the
 * freshly found country switch on one by one as a front expands from its capital.
 */
import { acos, clamp, dot, float, floor, max, mix, step, vec2, vec3 } from "three/tsl";

import { polygonGlitchUniforms } from "../polygonGlitchShader";
import { hash, mirrorUniform } from "./tslCommon";

let igniteNodes = null;

export function buildIgnition({ cartUv, sphereNormal, uTimeNode, uRegionalNode }) {
  const ig = (igniteNodes ||= {
    origin: mirrorUniform(polygonGlitchUniforms.uIgniteOrigin),
    start: mirrorUniform(polygonGlitchUniforms.uIgniteStart),
    radius: mirrorUniform(polygonGlitchUniforms.uIgniteRadius),
    duration: mirrorUniform(polygonGlitchUniforms.uIgniteDuration),
    reduced: mirrorUniform(polygonGlitchUniforms.uReducedMotion),
  });
  const cell = floor(cartUv.mul(vec2(3600.0, 1800.0)));
  const dist = acos(clamp(dot(sphereNormal, ig.origin), -1.0, 1.0));
  const t = uTimeNode.sub(ig.start).div(max(ig.duration, 0.001));
  const active = step(dist, ig.radius)
    .mul(step(0.0, t))
    .mul(step(t, 1.0))
    .mul(float(1.0).sub(ig.reduced))
    .mul(float(1.0).sub(uRegionalNode));
  const front = t.mul(ig.radius).mul(1.2);
  const d = dist.add(
    hash(cell.add(vec2(5.3, 11.9)))
      .mul(ig.radius)
      .mul(0.2)
  );
  const pixelOn = step(d, front);
  const igniteFlash = active
    .mul(pixelOn)
    .mul(float(1.0).sub(step(d, front.sub(ig.radius.mul(0.14)))));
  const igniteMask = mix(float(1.0), pixelOn, active);
  return { igniteFlash, igniteMask };
}

/** Leading edge of the ignition wave burns in the existing win gold. */
export function igniteSpark(baseColor, igniteFlash) {
  return mix(baseColor, vec3(0.96, 0.68, 0.22).mul(1.25), igniteFlash || float(0.0));
}
