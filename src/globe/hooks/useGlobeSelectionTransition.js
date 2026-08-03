import { useMemo, useRef, useState } from "react";

/** Refs + state for polygon select-in / deselect-out glitch transitions. */
export function useGlobeSelectionTransition(selectedCountry, mode) {
  const transitioningPreviousCountryRef = useRef(null);
  const [transitioningPreviousCountryState, setTransitioningPreviousCountryState] = useState(null);
  const transitioningIncomingCountryRef = useRef(null);
  const [transitioningIncomingCountryState, setTransitioningIncomingCountryState] = useState(null);
  const selectionTransitionStartRef = useRef(0);

  const prevSelectedCountryRef = useRef(selectedCountry);

  let currentPrevState = transitioningPreviousCountryState;
  let currentIncomingState = transitioningIncomingCountryState;

  if (prevSelectedCountryRef.current !== selectedCountry) {
    const prev = prevSelectedCountryRef.current;
    prevSelectedCountryRef.current = selectedCountry;

    if (mode !== "learn") {
      transitioningPreviousCountryRef.current = prev;
      setTransitioningPreviousCountryState(prev);
      currentPrevState = prev;
    } else {
      transitioningPreviousCountryRef.current = null;
      setTransitioningPreviousCountryState(null);
      currentPrevState = null;
    }
    transitioningIncomingCountryRef.current = null;
    setTransitioningIncomingCountryState(null);
    currentIncomingState = null;
    selectionTransitionStartRef.current = performance.now();
  }

  return useMemo(
    () => ({
      refs: {
        transitioningPreviousCountryRef,
        transitioningIncomingCountryRef,
        selectionTransitionStartRef,
      },
      state: {
        transitioningPreviousCountryState: currentPrevState,
        transitioningIncomingCountryState: currentIncomingState,
      },
      setters: {
        setTransitioningPreviousCountryState,
        setTransitioningIncomingCountryState,
      },
    }),
    [currentPrevState, currentIncomingState]
  );
}
