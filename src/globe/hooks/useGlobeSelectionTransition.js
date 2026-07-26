import { useMemo, useRef, useState } from "react";

/** Refs + state for polygon select-in / deselect-out glitch transitions. */
export function useGlobeSelectionTransition() {
  const transitioningPreviousCountryRef = useRef(null);
  const [transitioningPreviousCountryState, setTransitioningPreviousCountryState] = useState(null);
  const transitioningIncomingCountryRef = useRef(null);
  const [transitioningIncomingCountryState, setTransitioningIncomingCountryState] = useState(null);
  const selectionTransitionStartRef = useRef(0);

  return useMemo(
    () => ({
      refs: {
        transitioningPreviousCountryRef,
        transitioningIncomingCountryRef,
        selectionTransitionStartRef,
      },
      state: {
        transitioningPreviousCountryState,
        transitioningIncomingCountryState,
      },
      setters: {
        setTransitioningPreviousCountryState,
        setTransitioningIncomingCountryState,
      },
    }),
    [transitioningPreviousCountryState, transitioningIncomingCountryState]
  );
}
