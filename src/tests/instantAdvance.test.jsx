import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FEEDBACK_TIMING } from "../config/gameConstants";
import { useGameSession } from "../hooks/useGameSession";

// A west -> east chain so "closest unfound" is deterministic.
const DATA = Object.fromEntries(
  ["A", "B", "C", "D", "E", "F"].map((k, i) => [
    k,
    { lat: 46, lng: 2 + i * 3, region: "Europe", name_fr: `Pays${k}`, name_en: `Land${k}` },
  ])
);
const KEYS = Object.keys(DATA);

function useHarness(applier = { current: null }) {
  const [selectedCountry, setSelectedCountry] = useState("A");
  const session = useGameSession({
    mode: "countries",
    allCountryKeys: KEYS,
    totalPossible: KEYS.length,
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
    globeFeedbackApplierRef: applier,
  });
  return { ...session, selectedCountry };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0); // weighted auto-navigation -> nearest
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("instant advance: progression decoupled from the cosmetic success flash", () => {
  it("found list and next target update synchronously, the island flash ends after successFlashMs", () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      result.current.specificCountryGuess("PaysA");
    });
    expect(result.current.foundList).toEqual(["A"]);
    expect(result.current.selectedCountry).not.toBe("A");
    expect(KEYS).toContain(result.current.selectedCountry);
    expect(result.current.popupSuccess).toBe(true);
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs - 1);
    });
    expect(result.current.popupSuccess).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.popupSuccess).toBe(false);
  });

  it("ten rapid submissions (valid/invalid alternating, one render each) resolve one by one", () => {
    const { result } = renderHook(() => useHarness());
    // "ok" = the current target's name, "again" = the answer just found, "bad" = nonsense.
    const plan = ["ok", "bad", "ok", "bad", "ok", "again", "ok", "bad", "ok", "bad"];
    let last = null;
    const out = plan.map((p) => {
      const target = result.current.selectedCountry;
      const value = p === "ok" ? `Pays${target}` : p === "again" ? `Pays${last}` : "zz";
      let r;
      act(() => {
        r = result.current.specificCountryGuess(value);
      });
      if (p === "ok") last = target;
      return r;
    });
    expect(out).toEqual([
      "SUCCESS",
      "ERROR",
      "SUCCESS",
      "ERROR",
      "SUCCESS",
      "ALREADY_FOUND", // re-sent during its flash: a repeat, not a mistake
      "SUCCESS",
      "ERROR",
      "SUCCESS",
      "ERROR",
    ]);
    expect(result.current.foundList).toHaveLength(5);
    expect(new Set(result.current.foundList).size).toBe(5);
    expect(result.current.foundList).not.toContain(result.current.selectedCountry);
    expect(result.current.mistakes).toBe(4);
  });

  it("a burst inside one render queues onto the next target instead of erroring", () => {
    const { result } = renderHook(() => useHarness());
    const out = [];
    act(() => {
      const guess = result.current.specificCountryGuess;
      out.push(guess("PaysA"), guess("PaysB"));
    });
    expect(out[0]).toBe("SUCCESS");
    expect(out[1]).toBe("QUEUED");
    expect(result.current.foundList).toEqual(["A", "B"]);
    expect(result.current.mistakes).toBe(0);
  });

  it("an error on the next target during the previous flash is not cleared by the flash end", () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      result.current.specificCountryGuess("PaysA");
    });
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs - 100);
      result.current.specificCountryGuess("zz");
    });
    expect(result.current.popupError).toBe(true);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.popupError).toBe(true);
  });

  it("flash end only turns off the found country's success uniforms (once, epoch-guarded)", () => {
    const calls = [];
    const applier = { current: (admin, fb) => calls.push([admin, fb.isSuccess]) };
    const { result } = renderHook(() => useHarness(applier));
    act(() => {
      result.current.specificCountryGuess("PaysA");
    });
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 10);
    });
    expect(calls.filter(([a, s]) => a === "A" && s === false)).toHaveLength(1);
    expect(calls.some(([a]) => a === "B")).toBe(false);
  });

  it("restart during the flash: no late write into the new game", () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      result.current.specificCountryGuess("PaysA");
    });
    act(() => {
      result.current.resetGame("countries");
    });
    const sel = result.current.selectedCountry;
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 10);
    });
    expect(result.current.foundList).toEqual([]);
    expect(result.current.selectedCountry).toBe(sel);
  });

  it("the last find still lets its flash play before the end screen", () => {
    const { result } = renderHook(() => useHarness());
    for (let i = 0; i < KEYS.length; i += 1) {
      act(() => {
        result.current.specificCountryGuess(`Pays${result.current.selectedCountry}`);
      });
    }
    expect(result.current.foundList).toHaveLength(KEYS.length);
    expect(result.current.showEndScreen).toBe(false);
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 10);
    });
    expect(result.current.showEndScreen).toBe(true);
  });
});
