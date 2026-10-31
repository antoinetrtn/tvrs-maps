import { useEffect, useState } from "react";

import { MODE_TRANSITION_STEPS, nowMs } from "../render/modeTransition";

/**
 * Re-renders once per transition step (and once more when it ends) so the
 * polygon accessors are re-evaluated at each quantized progress value.
 * Returns a counter to use as a dependency of those accessors.
 */
export default function useModeTransitionSteps(transitionRef, live) {
  const [step, setStep] = useState(0);
  const startTime = live ? transitionRef.current.startTime : 0;

  useEffect(() => {
    if (!startTime) return undefined;
    const { duration } = transitionRef.current;
    const timers = [];
    for (let k = 1; k <= MODE_TRANSITION_STEPS; k += 1) {
      const at = startTime + (k * duration) / MODE_TRANSITION_STEPS + 12;
      timers.push(setTimeout(() => setStep((n) => n + 1), Math.max(0, at - nowMs())));
    }
    return () => timers.forEach(clearTimeout);
  }, [startTime, transitionRef]);

  return step;
}
