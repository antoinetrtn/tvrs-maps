import { useCallback } from "react";

import { focusAnswerInputSafely } from "../utils/answerField";

const refocusInput = (inputRef) => {
  if (!inputRef?.current) return;
  if (focusAnswerInputSafely(inputRef)) return;
  setTimeout(() => focusAnswerInputSafely(inputRef), 50);
};

export function useCountrySelectHandler({
  selectedCountry,
  setSelectedCountry,
  resetNavigationTrail,
  setPopupError,
  extInputRef,
  onAfterSelect,
  isLearnMode = false,
}) {
  return useCallback(
    (c) => {
      if (c === selectedCountry && c !== null) {
        setPopupError(false);
        if (!isLearnMode) {
          refocusInput(extInputRef);
        }
        return;
      }
      setSelectedCountry(c);
      resetNavigationTrail(c);
      setPopupError(false);
      if (c) {
        if (!isLearnMode) {
          refocusInput(extInputRef);
        } else if (document.activeElement && typeof document.activeElement.blur === "function") {
          document.activeElement.blur();
        }
        onAfterSelect?.(c);
      }
    },
    [
      selectedCountry,
      setSelectedCountry,
      resetNavigationTrail,
      setPopupError,
      extInputRef,
      onAfterSelect,
      isLearnMode,
    ]
  );
}
