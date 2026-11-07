import fs from "node:fs";
import path from "node:path";

import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FEEDBACK_TIMING } from "../config/gameConstants";
import { useGameSession } from "../hooks/useGameSession";

// eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed repo paths
const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");
const looksCss = read("../components/ui/ButtonLooks.css");
const buttonCss = read("../components/ui/Button.css");
const hudCss = read("../components/GameHUD.css");

/** Top-level (not inside an @media block) rule selectors of a stylesheet. */
function topLevelSelectors(css) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") {
      if (depth === 0) out.push(buf.trim());
      depth += 1;
      buf = "";
    } else if (ch === "}") {
      depth -= 1;
      buf = "";
    } else if (depth === 0) buf += ch;
  }
  return out;
}

const DATA = {
  France: { lat: 46, lng: 2, region: "Europe", name_fr: "France", name_en: "France" },
  Belgium: { lat: 50.6, lng: 4.6, region: "Europe", name_fr: "Belgique", name_en: "Belgium" },
};

function useHarness() {
  const [selectedCountry, setSelectedCountry] = useState("France");
  const session = useGameSession({
    mode: "countries",
    allCountryKeys: Object.keys(DATA),
    totalPossible: 2,
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
  return { ...session, selectedCountry, setSelectedCountry };
}

describe("buttons: coherent hover / press / reduced motion", () => {
  it("no look applies :hover outside @media (hover: hover) (no sticky hover on touch)", () => {
    const bare = topLevelSelectors(looksCss).filter((s) => s.includes(":hover"));
    expect(bare).toEqual([]);
  });

  it("hud island no longer scales (kit identity: stepped press, no scale)", () => {
    expect(looksCss).not.toMatch(/scale\(/);
    expect(looksCss).toMatch(/\.ui-btn--hud-island:active[\s\S]*?px-press-flash/);
  });

  it("reduced motion freezes press offset and flash on the kit and its looks", () => {
    const rm = buttonCss.slice(buttonCss.indexOf("prefers-reduced-motion"));
    expect(rm).toMatch(/:active[\s\S]*?transform: none;[\s\S]*?animation: none;/);
    const rmLooks = looksCss.slice(looksCss.lastIndexOf("prefers-reduced-motion"));
    expect(rmLooks).toContain(".ui-btn--hud-island:active");
    expect(rmLooks).toMatch(/transform: none;\s*animation: none;/);
  });

  it("focus-visible ring kept on both primitives", () => {
    expect(buttonCss).toMatch(/\.ui-btn:focus-visible,\s*\.ui-icon-btn:focus-visible/);
  });
});

describe("answer feedback", () => {
  it("success / error / warning carry a glyph, not colour alone, with empty alt text", () => {
    for (const state of ["success", "error", "warning"]) {
      expect(hudCss).toMatch(
        new RegExp(`\\.input-island\\.${state}::after \\{\\s*content: "[^"]+" / "";`)
      );
    }
  });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a restart during the success flash discards the stale auto-advance timer", () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      expect(result.current.specificCountryGuess("France")).toBe("SUCCESS");
    });
    act(() => {
      result.current.resetGame("countries");
    });
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 50);
    });
    expect(result.current.foundList).toEqual([]);
  });

  it("repeated Enter on the same correct answer counts once", () => {
    const { result } = renderHook(() => useHarness());
    const outcomes = [];
    act(() => {
      outcomes.push(result.current.specificCountryGuess("France"));
    });
    act(() => {
      outcomes.push(result.current.specificCountryGuess("France"));
      outcomes.push(result.current.specificCountryGuess("France"));
    });
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 50);
    });
    expect(outcomes[0]).toBe("SUCCESS");
    expect(outcomes.slice(1).every((o) => o !== "SUCCESS")).toBe(true);
    expect(result.current.foundList).toEqual(["France"]);
    expect(result.current.mistakes).toBe(0);
  });

  it("unmount during the success flash is safe (no late state write)", () => {
    const { result, unmount } = renderHook(() => useHarness());
    act(() => {
      result.current.specificCountryGuess("France");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    unmount();
    act(() => {
      vi.advanceTimersByTime(FEEDBACK_TIMING.successFlashMs + 50);
    });
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
