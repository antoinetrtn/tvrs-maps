import { FEEDBACK_TIMING } from "../../config/gameConstants";

/**
 * Progressive discovery reveal (homepage-style), shared by the WebGL GLSL and the
 * WebGPU TSL shaders so both renderers run the exact same timeline. Seconds after
 * the correct guess (uRevealStart):
 *   0     -> OUTLINE_S        country outline (side walls) turns amber
 *   0     -> LAND_S           land lights up pixel by pixel from the capital, 3 steps
 *   CITY_DELAY_S -> +CITY_S   city pixels ignite (dim selection lanterns just brighten)
 *   HALO_START_S -> REVEAL_S  one light amber halo along the border, then normal found state
 */
export const DISCOVERY = {
  REVEAL_S: FEEDBACK_TIMING.discoveryRevealMs / 1000,
  OUTLINE_S: 0.12,
  OUTLINE_ALPHA: 0.6,
  LAND_S: 0.9,
  LAND_STEP_S: 0.12,
  LAND_STEPS: 3,
  // Front reaches the farthest polygon vertex (radius * LAND_REACH) before LAND_S - LAND_STEP_S.
  LAND_REACH: 1.1,
  LAND_JITTER: 0.08,
  CITY_DELAY_S: 0.15,
  CITY_S: 1.35,
  SPARK_WIDTH: 0.08,
  SPARK_GAIN: 0.6,
  HALO_START_S: 1.4,
  HALO_ALPHA: 0.25,
  HALO_STEPS: 4,
  REDUCED_FADE_S: 0.3,
  // Pre-reveal land tone of a found country = the selected-country look just before the guess.
  DARK_LAND_RGB: [0.224, 0.282, 0.263],
};

/** GLSL float literal. */
export const glf = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
