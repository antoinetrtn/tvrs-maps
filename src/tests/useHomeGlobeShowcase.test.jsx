import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_AUTOROTATE_INTERVAL_MS, HOME_GLOBE_SETTLE_MS } from "../config/gameConstants";
import { useGlobeSelectionTransition } from "../globe/hooks/useGlobeSelectionTransition";
import { useHomeGlobeShowcase } from "../hooks/useHomeGlobeShowcase";
import useSettledValue from "../hooks/useSettledValue";

const WORLD_MAP = {
  France: { lat: 46.2, lng: 2.2 },
  Spain: { lat: 40.4, lng: -3.7 },
};

const DEPT_MAP = {
  "01": { lat: 46.1, lng: 5.3 },
  75: { lat: 48.8, lng: 2.3 },
};

const US_MAP = {
  California: { lat: 36.7, lng: -119.4 },
  Texas: { lat: 31.0, lng: -97.5 },
};

const MAP_BY_MODE = {
  countries: WORLD_MAP,
  capitals: WORLD_MAP,
  departments: DEPT_MAP,
  us_states: US_MAP,
};

function useTestHomeShowcase({ initialScreen = "home", initialMode = "countries" } = {}) {
  const [currentScreen, setCurrentScreen] = useState(initialScreen);
  const [homeMode, setHomeMode] = useState(initialMode);
  const [selectedCountry, setSelectedCountry] = useState(null);

  const isHomeScreenActive = currentScreen === "home";
  const globeHomeMode = useSettledValue(homeMode, HOME_GLOBE_SETTLE_MS, isHomeScreenActive);
  const activeDataMap = MAP_BY_MODE[globeHomeMode] || WORLD_MAP;

  useHomeGlobeShowcase({
    currentScreen,
    homeMode,
    globeHomeMode,
    activeDataMap,
    selectedCountry,
    setSelectedCountry,
    autorotateIntervalMs: HOME_AUTOROTATE_INTERVAL_MS,
  });

  const selectionTransition = useGlobeSelectionTransition(
    selectedCountry,
    globeHomeMode,
    activeDataMap
  );

  return {
    currentScreen,
    setCurrentScreen,
    homeMode,
    setHomeMode,
    globeHomeMode,
    activeDataMap,
    selectedCountry,
    setSelectedCountry,
    selectionTransition,
  };
}

describe("useHomeGlobeShowcase & carousel settle synchronization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects a valid initial country on mount without wiping it back to null and advances to a distinct key on autorotate", () => {
    const { result } = renderHook(() => useTestHomeShowcase());

    expect(result.current.selectedCountry).toBeTruthy();
    expect(Object.keys(WORLD_MAP)).toContain(result.current.selectedCountry);
    const firstKey = result.current.selectedCountry;

    act(() => {
      vi.advanceTimersByTime(HOME_AUTOROTATE_INTERVAL_MS);
    });

    expect(Object.keys(WORLD_MAP)).toContain(result.current.selectedCountry);
    expect(result.current.selectedCountry).not.toBe(firstKey);
  });

  it("pauses autorotate during carousel settle so manual card clicks never race an interval tick or emit stale layer keys", () => {
    const { result } = renderHook(() => useTestHomeShowcase());
    const initialKey = result.current.selectedCountry;
    expect(Object.keys(WORLD_MAP)).toContain(initialKey);

    // Advance almost to the end of the 4500ms autorotate interval (100ms before tick)
    act(() => {
      vi.advanceTimersByTime(HOME_AUTOROTATE_INTERVAL_MS - 100);
    });
    expect(result.current.selectedCountry).toBe(initialKey);

    // User manually clicks through carousel cards: countries -> capitals -> departments
    act(() => {
      result.current.setHomeMode("capitals");
    });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    // Even though 120ms passed (> 100ms remaining on the old interval), the old interval
    // was cleared when homeMode diverged from globeHomeMode: no stale world pick fired!
    expect(result.current.globeHomeMode).toBe("countries");
    expect(result.current.selectedCountry).toBe(initialKey);

    act(() => {
      result.current.setHomeMode("departments");
    });
    act(() => {
      vi.advanceTimersByTime(HOME_GLOBE_SETTLE_MS - 20);
    });
    expect(result.current.globeHomeMode).toBe("countries");

    // Once HOME_GLOBE_SETTLE_MS elapses after the last manual click, globeHomeMode settles
    // to "departments" and immediately selects a key from DEPT_MAP.
    act(() => {
      vi.advanceTimersByTime(25);
    });
    expect(result.current.globeHomeMode).toBe("departments");
    expect(Object.keys(DEPT_MAP)).toContain(result.current.selectedCountry);
    // And the previous world country ("France"/"Spain") does not linger in selectionTransition
    expect(result.current.selectionTransition.state.transitioningPreviousCountryState).toBeNull();
  });

  it("clears stale transitioningPreviousCountryState if gameDataMap changes on a subsequent render", () => {
    const { result, rerender } = renderHook(
      ({ selectedCountry, mode, map }) => useGlobeSelectionTransition(selectedCountry, mode, map),
      {
        initialProps: {
          selectedCountry: "France",
          mode: "countries",
          map: WORLD_MAP,
        },
      }
    );

    // Deselect France while still on WORLD_MAP -> France becomes transitioningPreviousCountryState
    rerender({
      selectedCountry: "Spain",
      mode: "countries",
      map: WORLD_MAP,
    });
    expect(result.current.state.transitioningPreviousCountryState).toBe("France");

    // Layer switches to DEPT_MAP without selectedCountry changing yet -> stale France is cleared
    rerender({
      selectedCountry: "Spain",
      mode: "departments",
      map: DEPT_MAP,
    });
    expect(result.current.state.transitioningPreviousCountryState).toBeNull();
    expect(result.current.refs.transitioningPreviousCountryRef.current).toBeNull();
  });

  it("cleans up autorotate on screen exit and unmount, and re-picks when returning to home", () => {
    const { result, unmount } = renderHook(() => useTestHomeShowcase());
    const homePick = result.current.selectedCountry;
    expect(Object.keys(WORLD_MAP)).toContain(homePick);

    // Leave home screen for game screen and clear selection
    act(() => {
      result.current.setCurrentScreen("game");
      result.current.setSelectedCountry(null);
    });

    // Advancing timers while in game must not trigger home autorotate
    act(() => {
      vi.advanceTimersByTime(HOME_AUTOROTATE_INTERVAL_MS * 3);
    });
    expect(result.current.selectedCountry).toBeNull();

    // Returning to home screen immediately selects a valid home country again
    act(() => {
      result.current.setCurrentScreen("home");
    });
    expect(Object.keys(WORLD_MAP)).toContain(result.current.selectedCountry);

    const beforeUnmount = result.current.selectedCountry;
    unmount();

    act(() => {
      vi.advanceTimersByTime(HOME_AUTOROTATE_INTERVAL_MS * 2);
    });
    expect(result.current.selectedCountry).toBe(beforeUnmount);
  });
});
