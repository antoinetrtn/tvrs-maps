// Cross-fade between globe layers (world ↔ US states ↔ departments).
//
// The outgoing layer stays in the data for MODE_TRANSITION_MS and dissolves in
// MODE_TRANSITION_STEPS discrete steps (pixel/stepped identity, no tweened glow)
// while the incoming layer — already part of the final data — appears the same way.

export const MODE_TRANSITION_MS = 420;
export const MODE_TRANSITION_STEPS = 5;

export const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Transition record still within its window (does not mutate it). */
export const isModeTransitionLive = (trans) =>
  Boolean(trans?.active) && nowMs() - trans.startTime < trans.duration;

/** 0 → 1 quantized to MODE_TRANSITION_STEPS steps (the last step is the final state, no transition). */
export const stepProgress = (raw, steps = MODE_TRANSITION_STEPS) =>
  Math.min(1, Math.max(0, Math.floor(raw * steps) / steps));
