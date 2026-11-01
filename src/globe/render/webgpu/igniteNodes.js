/**
 * TSL twin of the GLSL discovery-ignition block (globeShaders.js): city pixels of the
 * freshly found country switch on one by one as a front expands from its capital.
 */
import { acos, ceil, clamp, dot, float, floor, max, mix, step, vec2, vec3 } from "three/tsl";

import { DISCOVERY as D } from "../discoveryTimeline";
import { polygonGlitchUniforms } from "../polygonGlitchShader";
import { hash, mirrorUniform } from "./tslCommon";

let igniteNodes = null;

/** TSL twin of GLSL discoveryLandStep (globeShaders.js): stepped land front from the capital. */
export function discoveryLandStep({ revealT, dist, radius, cell, reduced }) {
  const r = max(radius, 0.001);
  const d = dist.add(
    hash(cell.add(vec2(5.3, 11.9)))
      .mul(r)
      .mul(D.LAND_JITTER)
  );
  const at = d.div(r.mul(D.LAND_REACH)).mul(D.LAND_S - D.LAND_STEP_S);
  const s = clamp(revealT.sub(at).div(D.LAND_STEP_S), 0.0, 1.0);
  const stepped = max(floor(s.mul(D.LAND_STEPS)).div(D.LAND_STEPS), step(D.LAND_S, revealT));
  const fade = clamp(revealT.div(D.REDUCED_FADE_S), 0.0, 1.0);
  return mix(stepped, fade, reduced);
}

/** TSL twin of GLSL discoveryHaloBand: one light ring from the capital dying on the border. */
function discoveryHaloBand({ revealT, dist, radius, cell, reduced }) {
  const r = max(radius, 0.001);
  const d = dist.add(
    hash(cell.add(vec2(5.3, 11.9)))
      .mul(r)
      .mul(D.LAND_JITTER)
  );
  const h = revealT.sub(D.HALO_START_S).div(D.REVEAL_S - D.HALO_START_S);
  const front = h.mul(r).mul(D.LAND_REACH);
  const band = step(d, front).mul(float(1.0).sub(step(d, front.sub(r.mul(0.16)))));
  return band.mul(step(0.0, h)).mul(step(h, 1.0)).mul(float(1.0).sub(reduced));
}

function makeGlobals() {
  return {
    origin: mirrorUniform(polygonGlitchUniforms.uIgniteOrigin),
    start: mirrorUniform(polygonGlitchUniforms.uIgniteStart),
    radius: mirrorUniform(polygonGlitchUniforms.uIgniteRadius),
    duration: mirrorUniform(polygonGlitchUniforms.uIgniteDuration),
    revealStart: mirrorUniform(polygonGlitchUniforms.uRevealStart),
    landRadius: mirrorUniform(polygonGlitchUniforms.uLandRadius),
    reduced: mirrorUniform(polygonGlitchUniforms.uReducedMotion),
  };
}

/**
 * City ignition + discovery reveal for the grain surface. `refs` (materialReference nodes)
 * carry the per-country origin/timeline so two quick finds keep their own reveal; when
 * absent the global uniforms are used.
 */
export function buildIgnition({ cartUv, sphereNormal, uTimeNode, uRegionalNode, uSelfNode, refs }) {
  if (!igniteNodes) {
    igniteNodes = makeGlobals();
  }
  const ig = { ...igniteNodes, ...refs };
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
  // Only the freshly found country (uSelfNode) restarts from dark; lit neighbours get a faint spark.
  const self = uSelfNode || float(0.0);
  const igniteFlash = active
    .mul(pixelOn)
    .mul(float(1.0).sub(step(d, front.sub(ig.radius.mul(D.SPARK_WIDTH)))))
    .mul(mix(float(0.35), float(1.0), self))
    .mul(D.SPARK_GAIN);
  // Until its front passes, the found country's pixels stay unlit (also during the
  // CITY_DELAY_S lead, t < 0): no full-country pop before the wave (GLSL igniteWindow).
  const igniteWindow = step(dist, ig.radius)
    .mul(step(t, 1.0))
    .mul(float(1.0).sub(ig.reduced))
    .mul(float(1.0).sub(uRegionalNode));
  const igniteMask = mix(float(1.0), pixelOn, igniteWindow.mul(self));
  // Discovery reveal: stepped land front, amber outline ahead of it, one border halo.
  const revealT = uTimeNode.sub(ig.revealStart);
  const revealOn = self
    .mul(step(0.0, revealT))
    .mul(step(revealT, D.REVEAL_S))
    .mul(float(1.0).sub(uRegionalNode));
  const landMask = mix(
    float(1.0),
    discoveryLandStep({ revealT, dist, radius: ig.landRadius, cell, reduced: ig.reduced }),
    revealOn
  );
  const haloT = revealT.sub(D.HALO_START_S).div(D.REVEAL_S - D.HALO_START_S);
  const motion = revealOn.mul(float(1.0).sub(ig.reduced));
  const haloAmt = motion
    .mul(step(0.0, haloT))
    .mul(step(haloT, 1.0))
    .mul(ceil(float(1.0).sub(haloT).mul(D.HALO_STEPS)).div(D.HALO_STEPS))
    .mul(D.HALO_ALPHA);
  const outlineAmt = motion.mul(float(1.0).sub(landMask)).mul(D.OUTLINE_ALPHA);
  const haloBand = revealOn.mul(
    discoveryHaloBand({ revealT, dist, radius: ig.landRadius, cell, reduced: ig.reduced })
  );
  return { igniteFlash, igniteMask, landMask, haloAmt, outlineAmt, haloBand };
}

/** Leading edge of the ignition wave burns in the existing win gold. */
export function igniteSpark(baseColor, igniteFlash) {
  return mix(baseColor, vec3(0.96, 0.68, 0.22).mul(1.25), igniteFlash || float(0.0));
}

let homeNodes = null;

/** Homepage wake-up (GLSL twin): one ignition front ringing out from Paris over the world. */
export function homeShowcase({ cartUv, sphereNormal, uShowcaseNode, uRegionalNode }) {
  const n = (homeNodes ||= {
    reduced: mirrorUniform(polygonGlitchUniforms.uReducedMotion),
    wake: mirrorUniform(polygonGlitchUniforms.uHomeWake),
  });
  const cell = floor(cartUv.mul(vec2(3600.0, 1800.0)));
  const dist = acos(clamp(dot(sphereNormal, vec3(0.027, 0.753, 0.6575)), -1.0, 1.0)).add(
    hash(cell.add(vec2(5.3, 11.9))).mul(0.14)
  );
  const landAt = dist.div(3.6);
  const wakeAt = landAt.add(0.022);
  const on = max(n.reduced, uRegionalNode);
  const homeIgnite = max(step(wakeAt, n.wake), on);
  const homeLandOn = max(step(landAt, n.wake), on);
  const homeFlash = uShowcaseNode
    .mul(float(1.0).sub(on))
    .mul(homeIgnite)
    .mul(float(1.0).sub(step(landAt.add(0.07), n.wake)));
  return {
    showcaseNow: uShowcaseNode.mul(homeIgnite),
    showcaseLand: uShowcaseNode.mul(homeLandOn),
    homeFlash,
  };
}
