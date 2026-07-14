import { useCallback } from "react";
import { FEEDBACK_TIMING } from "../config/gameConstants";

export function useHudAnswerHandler({
  mode,
  selectedCountry,
  handleSearch,
  specificCountryGuess,
  handleInput,
  setPopupError,
  setPopupWarning,
}) {
  return useCallback(
    (val) => {
      if (mode === "learn") {
        const res = handleSearch(val);
        if (!res) {
          setPopupError(true);
          setTimeout(() => setPopupError(false), FEEDBACK_TIMING.flashMs);
        }
        return res;
      }

      let res;
      if (selectedCountry) {
        res = specificCountryGuess(val);
      } else {
        res = handleInput(val);
        if (res === "ALREADY_FOUND") {
          setPopupWarning(true);
          setTimeout(() => setPopupWarning(false), FEEDBACK_TIMING.flashMs);
        } else if (res === "ERROR") {
          setPopupError(true);
          setTimeout(() => setPopupError(false), FEEDBACK_TIMING.flashMs);
        }
      }
      return (
        res === "SUCCESS" ||
        res === true ||
        res === "ERROR" ||
        res === "ALREADY_FOUND"
      );
    },
    [
      mode,
      selectedCountry,
      handleSearch,
      specificCountryGuess,
      handleInput,
      setPopupError,
      setPopupWarning,
    ],
  );
}