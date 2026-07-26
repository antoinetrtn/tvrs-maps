import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGameSession } from "../hooks/useGameSession";

const ACTIVE_DATA_MAP = {
  France: { lat: 46, lng: 2, region: "Europe" },
  Germany: { lat: 51, lng: 10, region: "Europe" },
  Spain: { lat: 40, lng: -4, region: "Europe" },
};

function buildProps(overrides = {}) {
  return {
    mode: "countries",
    allCountryKeys: Object.keys(ACTIVE_DATA_MAP),
    totalPossible: Object.keys(ACTIVE_DATA_MAP).length,
    gameDuration: 300,
    lang: "en",
    userProfile: null,
    setUserProfile: vi.fn(),
    localRecords: {},
    session: null,
    updateGameRecord: vi.fn(),
    addAchievementToQueue: vi.fn(),
    t: (key) => key,
    globeTheme: "blackout",
    theme: "dark",
    selectedCountry: null,
    setSelectedCountry: vi.fn(),
    activeDataMap: ACTIVE_DATA_MAP,
    extInputRef: { current: null },
    effectiveKeyboardMode: false,
    globeFeedbackApplierRef: { current: null },
    ...overrides,
  };
}

function pressArrow(target, { key = "ArrowRight", shiftKey = false, repeat = false } = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey,
    repeat,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function mountInput() {
  const input = document.createElement("input");
  document.body.appendChild(input);
  return input;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("useGameSession Shift+Arrow country navigation", () => {
  it("navigates to the next country on Shift+ArrowRight outside a text field", () => {
    const props = buildProps();
    renderHook(() => useGameSession(props));

    const event = pressArrow(document.body, { key: "ArrowRight", shiftKey: true });

    expect(props.setSelectedCountry).toHaveBeenCalledWith("France");
    expect(event.defaultPrevented).toBe(true);
  });

  it("navigates to the previous country on Shift+ArrowLeft outside a text field", () => {
    const props = buildProps();
    renderHook(() => useGameSession(props));

    pressArrow(document.body, { key: "ArrowLeft", shiftKey: true });

    expect(props.setSelectedCountry).toHaveBeenCalledWith("Spain");
  });

  it("fires from the game answer input when it is empty", () => {
    const input = mountInput();
    const props = buildProps({ extInputRef: { current: input } });
    renderHook(() => useGameSession(props));

    const event = pressArrow(input, { key: "ArrowRight", shiftKey: true });

    expect(props.setSelectedCountry).toHaveBeenCalledWith("France");
    expect(event.defaultPrevented).toBe(true);
  });

  it("lets native text selection win when the game answer input has content", () => {
    const input = mountInput();
    input.value = "fra";
    const props = buildProps({ extInputRef: { current: input } });
    renderHook(() => useGameSession(props));

    const event = pressArrow(input, { key: "ArrowRight", shiftKey: true });

    expect(props.setSelectedCountry).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("never hijacks Shift+Arrow in other text fields", () => {
    const gameInput = mountInput();
    const otherInput = mountInput();
    const props = buildProps({ extInputRef: { current: gameInput } });
    renderHook(() => useGameSession(props));

    const event = pressArrow(otherInput, { key: "ArrowRight", shiftKey: true });

    expect(props.setSelectedCountry).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing in learn mode", () => {
    const props = buildProps({ mode: "learn" });
    renderHook(() => useGameSession(props));

    pressArrow(document.body, { key: "ArrowRight", shiftKey: true });

    expect(props.setSelectedCountry).not.toHaveBeenCalled();
  });

  it("ignores held-key repeats", () => {
    const props = buildProps();
    renderHook(() => useGameSession(props));

    pressArrow(document.body, { key: "ArrowRight", shiftKey: true, repeat: true });

    expect(props.setSelectedCountry).not.toHaveBeenCalled();
  });

  it("keeps the plain-arrow shortcut working outside text fields during play", () => {
    const props = buildProps({ selectedCountry: "France" });
    const { result } = renderHook(() => useGameSession(props));

    act(() => {
      result.current.setIsPlaying(true);
    });
    pressArrow(document.body, { key: "ArrowRight" });

    expect(props.setSelectedCountry).toHaveBeenCalled();
    expect(props.setSelectedCountry.mock.calls[0][0]).not.toBe("France");
  });
});
