import { FEEDBACK_TIMING } from "../config/gameConstants";

/**
 * Ends the cosmetic success flash of `key` after successFlashMs. Game progression (found
 * list, next target) has already happened; this only releases the pending guard, turns
 * the per-country success uniforms off and clears the "success" island state, without
 * clobbering an error/warning raised meanwhile on the next target. Bails when the game
 * epoch changed (restart / unmount) so an old game never mutates the new one.
 */
export function scheduleSuccessFlashEnd({
  key,
  epochRef,
  pendingRef,
  feedbackRef,
  applierRef,
  setFeedback,
}) {
  const epoch = epochRef.current;
  return setTimeout(() => {
    if (epoch !== epochRef.current) return;
    pendingRef.current.delete(key);
    if (feedbackRef.current.isSuccess) feedbackRef.current.isSuccess = false;
    applierRef?.current?.(key, { isError: false, isSuccess: false });
    setFeedback((f) => (f === "success" ? null : f));
  }, FEEDBACK_TIMING.successFlashMs);
}

/** True when the input matches a find still in its flash window (other than `selected`). */
export function isRepeatOfPendingFind(pending, selected, matches) {
  for (const key of pending) if (key !== selected && matches(key)) return true;
  return false;
}

/** Wrong answer on the target: mistake + error flash (globe and island) for flashMs. */
export function handleGuessErrorFeedback({
  selectedCountry,
  registerMistake,
  triggerGlobeFeedback,
  setPopupError,
}) {
  registerMistake();
  triggerGlobeFeedback(selectedCountry, { isError: true, isSuccess: false });
  setPopupError(true);
  setTimeout(() => {
    triggerGlobeFeedback(selectedCountry, { isError: false, isSuccess: false });
    setPopupError(false);
  }, FEEDBACK_TIMING.flashMs);
}
