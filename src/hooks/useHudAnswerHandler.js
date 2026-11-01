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
          return Boolean(handleInput(val));
        }
        return false;
      }

      const res = specificCountryGuess(val);
      return Boolean(res);
    },
    [mode, selectedCountry, handleSearch, specificCountryGuess, handleInput, setPopupError]
  );
}
