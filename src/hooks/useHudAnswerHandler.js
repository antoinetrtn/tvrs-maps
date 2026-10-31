import { useCallback } from "react";

import { FEEDBACK_TIMING } from "../config/gameConstants";

export function useHudAnswerHandler({
  mode,
  selectedCountry,
  handleSearch,
  specificCountryGuess,
  handleInput,
  setPopupError,
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

      if (!selectedCountry) {
        if (import.meta.env.DEV && (val === "WIN100" || val === "LOSE100")) {
          return handleInput(val) === true;
        }
        return false;
      }

      const res = specificCountryGuess(val);
      return (
        res === "SUCCESS" ||
        res === true ||
        res === "ERROR" ||
        res === "ALREADY_FOUND" ||
        res === "QUEUED"
      );
    },
    [mode, selectedCountry, handleSearch, specificCountryGuess, handleInput, setPopupError]
  );
}
