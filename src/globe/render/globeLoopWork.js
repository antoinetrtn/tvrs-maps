/** True while the globe bookkeeping loop still has per-frame work to do. */
export const loopHasWork = (w) =>
  w.needsSharedTime ||
  w.hasSelectedCountry ||
  w.currentIsError ||
  w.currentIsSuccess ||
  Boolean(w.modeTransitionRef?.current?.active) ||
  Boolean(w.transitioningPreviousCountryRef?.current) ||
  !w.glowSettled ||
  w.needsGraticuleStyleRef.current;
