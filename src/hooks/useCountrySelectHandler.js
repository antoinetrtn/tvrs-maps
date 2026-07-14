import { useCallback } from "react";

const refocusInput = (inputRef) => {
  if (!inputRef?.current) return;
  inputRef.current.focus();
  setTimeout(() => inputRef.current?.focus(), 50);
  setTimeout(() => inputRef.current?.focus(), 150);
};

export function useCountrySelectHandler({
  selectedCountry,
  setSelectedCountry,
  resetNavigationTrail,
  setPopupError,
  extInputRef,
  onAfterSelect,
}) {
  return useCallback(
    (c) => {
      if (c === selectedCountry && c !== null) {
        setPopupError(false);
        refocusInput(extInputRef);
        return;
      }
      setSelectedCountry(c);
      resetNavigationTrail(c);
      setPopupError(false);
      if (c) {
        refocusInput(extInputRef);
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
    ],
  );
}