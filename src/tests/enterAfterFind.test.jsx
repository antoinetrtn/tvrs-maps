import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FEEDBACK_TIMING } from "../config/gameConstants";
import { useGameSession } from "../hooks/useGameSession";

const DATA = {
  France: { lat: 46, lng: 2, region: "Europe", name_fr: "France", name_en: "France" },
  Belgium: { lat: 50.6, lng: 4.6, region: "Europe", name_fr: "Belgique", name_en: "Belgium" },
};

function useHarness() {
  const [selectedCountry, setSelectedCountry] = useState("France");
  const session = useGameSession({
    mode: "countries",
    allCountryKeys: Object.keys(DATA),
    totalPossible: 3,
    gameDuration: 300,
    lang: "fr",
    userProfile: { unlockedBadges: [], stats: {} },
    setUserProfile: vi.fn(),
    localRecords: {},
    session: null,
    updateGameRecord: vi.fn(),
    addAchievementToQueue: vi.fn(),
    t: (k) => k,
    selectedCountry,
    setSelectedCountry,
    activeDataMap: DATA,
    extInputRef: { current: null },
    effectiveKeyboardMode: false,
    globeFeedbackApplierRef: { current: null },
  });
  return { ...session, selectedCountry };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Entrée juste après avoir trouvé un pays", () => {
  it("rejoue sur le pays suivant une réponse validée pendant le flash de réussite", () => {
    const { result } = renderHook(() => useHarness());

    let res;
    act(() => {
      res = result.current.specificCountryGuess("France");
    });
    expect(res).toBe("SUCCESS");

    // Le joueur enchaîne avant l'auto-avance : la sélection pointe encore la France.
    act(() => {
      res = result.current.specificCountryGuess("Belgique");
    });
    expect(res).toBe("QUEUED");
    expect(result.current.mistakes).toBe(0);

    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 50);
    });
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 50);
    });

    expect(result.current.foundList).toEqual(["France", "Belgium"]);
    expect(result.current.mistakes).toBe(0);
  });

  it("une mauvaise réponse en file reste une erreur sur le pays suivant", () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      result.current.specificCountryGuess("France");
    });
    act(() => {
      result.current.specificCountryGuess("Zzz");
    });
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 50);
    });
    expect(result.current.foundList).toEqual(["France"]);
    expect(result.current.mistakes).toBe(1);
  });
});
