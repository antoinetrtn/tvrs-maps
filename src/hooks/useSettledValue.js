import { useEffect, useState } from "react";

/**
 * Returns `value` only once it has stopped changing for `delayMs`.
 * While `active` is false the value is passed through untouched.
 *
 * Used so the home globe keeps its current layer while the card carousel is
 * moving, and only swaps layers (mountains, rivers, departments…) once the
 * gesture has settled: the heavy scene update no longer lands mid-swipe.
 */
export default function useSettledValue(value, delayMs, active = true) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (!active || delayMs <= 0) {
      setSettled(value); // keep in sync so re-activating never shows a stale value
      return undefined;
    }
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs, active]);

  return active && delayMs > 0 ? settled : value;
}
