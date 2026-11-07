import { useEffect, useRef } from "react";

/**
 * Game generation counter, bumped by the caller on every (re)start and here on unmount.
 * Delayed callbacks (success auto-advance) capture it and bail when it changed, so a
 * timer from a previous game never writes foundList/selection into the next one.
 */
export function useGameEpoch() {
  const epochRef = useRef(0);
  useEffect(
    () => () => {
      epochRef.current += 1;
    },
    []
  );
  return epochRef;
}
