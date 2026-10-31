// GLSL chunks for the progressive discovery reveal (shared defines + land/halo helpers).
import { DISCOVERY, glf } from "./discoveryTimeline";

const D = DISCOVERY;
// Discovery reveal constants (discoveryTimeline.js), shared verbatim with the TSL port.
export const DISCOVERY_DEFS = `
  #define DISC_REVEAL_S ${glf(D.REVEAL_S)}
  #define DISC_OUTLINE_S ${glf(D.OUTLINE_S)}
  #define DISC_OUTLINE_ALPHA ${glf(D.OUTLINE_ALPHA)}
  #define DISC_LAND_S ${glf(D.LAND_S)}
  #define DISC_LAND_STEP_S ${glf(D.LAND_STEP_S)}
  #define DISC_LAND_STEPS ${glf(D.LAND_STEPS)}
  #define DISC_LAND_REACH ${glf(D.LAND_REACH)}
  #define DISC_LAND_JITTER ${glf(D.LAND_JITTER)}
  #define DISC_SPARK_WIDTH ${glf(D.SPARK_WIDTH)}
  #define DISC_SPARK_GAIN ${glf(D.SPARK_GAIN)}
  #define DISC_HALO_START_S ${glf(D.HALO_START_S)}
  #define DISC_HALO_ALPHA ${glf(D.HALO_ALPHA)}
  #define DISC_HALO_STEPS ${glf(D.HALO_STEPS)}
  #define DISC_REDUCED_FADE_S ${glf(D.REDUCED_FADE_S)}
  #define DISC_DARK_LAND vec3(${D.DARK_LAND_RGB.map(glf).join(", ")})
`;

/**
 * Land front of the discovery reveal (GLSL, mirrored in webgpu/igniteNodes.js):
 * 0 -> 1 in DISC_LAND_STEPS square-pixel steps as the jittered front leaves the capital.
 * Expects uTime, uRevealStart, uReducedMotion and a cell hash named HASH_FN.
 */
export const discoveryLandFn = (hashFn) => `
  float discoveryLandStep(float revealT, float dist, float radius, vec2 cell) {
    float r = max(radius, 0.001);
    float d = dist + ${hashFn}(cell + vec2(5.3, 11.9)) * r * DISC_LAND_JITTER;
    float at = d / (r * DISC_LAND_REACH) * (DISC_LAND_S - DISC_LAND_STEP_S);
    float s = clamp((revealT - at) / DISC_LAND_STEP_S, 0.0, 1.0);
    float stepped = max(floor(s * DISC_LAND_STEPS) / DISC_LAND_STEPS, step(DISC_LAND_S, revealT));
    float reduced = clamp(revealT / DISC_REDUCED_FADE_S, 0.0, 1.0);
    return mix(stepped, reduced, uReducedMotion);
  }
  // One light ring sweeping from the capital out to the border (HALO_START_S -> REVEAL_S),
  // jittered per pixel like the land front, dying on the border.
  float discoveryHaloBand(float revealT, float dist, float radius, vec2 cell) {
    float r = max(radius, 0.001);
    float d = dist + ${hashFn}(cell + vec2(5.3, 11.9)) * r * DISC_LAND_JITTER;
    float h = (revealT - DISC_HALO_START_S) / (DISC_REVEAL_S - DISC_HALO_START_S);
    float front = h * r * DISC_LAND_REACH;
    float band = step(d, front) * (1.0 - step(d, front - r * 0.16));
    return band * step(0.0, h) * step(h, 1.0) * (1.0 - uReducedMotion);
  }
`;
export const GLSL_DISCOVERY_LAND_FN = discoveryLandFn("cityCellHash");
