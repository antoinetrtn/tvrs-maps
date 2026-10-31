import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildExitingFeatures } from "../globe/hooks/useGlobeRenderData";
import { useGlobeSelectionTransition } from "../globe/hooks/useGlobeSelectionTransition";
import useModeTransitionSteps from "../globe/hooks/useModeTransitionSteps";
import {
  isModeTransitionLive,
  MODE_TRANSITION_MS,
  MODE_TRANSITION_STEPS,
  stepProgress,
} from "../globe/render/modeTransition";
import {
  getTransitionState,
  GHOST_DIM_AMOUNT,
  resolveGhostCountryColor,
  resolveModeTransitionColor,
} from "../globe/render/polygonColorResolver";

describe("modeTransition steps", () => {
  it("quantizes progress to discrete steps and never reaches the end value itself", () => {
    expect(stepProgress(0)).toBe(0);
    expect(stepProgress(0.19)).toBe(0);
    expect(stepProgress(0.2)).toBeCloseTo(0.2);
    expect(stepProgress(0.99)).toBeCloseTo(0.8);
    expect(stepProgress(1.4)).toBe(1);
    expect(stepProgress(-1)).toBe(0);
  });

  it("getTransitionState is stepped and ends after the duration", () => {
    const ref = {
      current: {
        active: true,
        fromUs: true,
        toUs: false,
        startTime: performance.now() - MODE_TRANSITION_MS * 0.5,
        duration: MODE_TRANSITION_MS,
      },
    };
    const state = getTransitionState(ref);
    expect(state.progress).toBeCloseTo(0.4);
    expect(state.isExitingRegional).toBe(true);
    ref.current.startTime = performance.now() - MODE_TRANSITION_MS - 1;
    expect(getTransitionState(ref)).toBeNull();
    expect(ref.current.active).toBe(false);
  });

  it("isModeTransitionLive does not mutate the record", () => {
    const trans = { active: true, startTime: performance.now() - 10_000, duration: 400 };
    expect(isModeTransitionLive(trans)).toBe(false);
    expect(trans.active).toBe(true);
  });
});

describe("useModeTransitionSteps", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ticks once per step and once more at the end, nothing when idle", () => {
    vi.advanceTimersByTime(5); // performance.now() is 0 right after faking the clock
    const ref = { current: { active: true, startTime: performance.now(), duration: 400 } };
    const { result, rerender } = renderHook(({ live }) => useModeTransitionSteps(ref, live), {
      initialProps: { live: true },
    });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeGreaterThanOrEqual(1);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(MODE_TRANSITION_STEPS);
    rerender({ live: false });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(MODE_TRANSITION_STEPS);
  });
});

describe("buildExitingFeatures", () => {
  const feature = (admin) => ({ type: "Feature", properties: { ADMIN: admin }, admin });
  const countries = [feature("France"), feature("Spain"), feature("United States of America")];

  it("keeps the world France/USA as fading parents when entering a regional layer", () => {
    const exiting = buildExitingFeatures(
      { fromDept: false, fromUs: false, toDept: true, toUs: false },
      countries,
      [],
      []
    );
    expect(exiting).toHaveLength(1);
    expect(exiting[0].isParentCountryFeature).toBe(true);
  });

  it("does not add parents when going from one regional layer to another", () => {
    const exiting = buildExitingFeatures(
      { fromDept: true, fromUs: false, toDept: false, toUs: true },
      countries,
      [],
      []
    );
    expect(exiting.some((f) => f.isParentCountryFeature)).toBe(false);
  });
});

describe("ghost world dimming", () => {
  const lerp = (a, b, amount) => `${a}>${b}@${amount}`;

  it("pulls the ghost colour toward the sea", () => {
    const color = resolveGhostCountryColor(
      {},
      {},
      {
        fallbackRegionColor: "tone-region",
        lerpColor: lerp,
        mapSea: "tone-sea",
      }
    );
    expect(color).toBe(`tone-region>tone-sea@${GHOST_DIM_AMOUNT}`);
  });

  it("transition ghost colour targets the dimmed colour", () => {
    const color = resolveModeTransitionColor({
      d: { isGhostCountry: true, properties: {} },
      transState: { progress: 1, isExitingRegional: false, fromDept: false, toUs: true },
      countryDataMap: {},
      gameDataMap: {},
      UI_COLORS: { mapBase: "tone-base" },
      getRegionSurfaceColor: () => "world",
      getRegionSurfaceColorDimmed: () => "dimmed",
      getGhostColor: () => "ghost",
      lerpColor: (a, b, amount) => (amount >= 1 ? b : a),
    });
    expect(color).toBe("ghost");
  });
});

describe("selection transition across a layer change", () => {
  it("glitches the previous selection out when it is still part of the layer", () => {
    const map = { France: {}, Spain: {} };
    const { result, rerender } = renderHook(
      ({ sel }) => useGlobeSelectionTransition(sel, "countries", map),
      { initialProps: { sel: "France" } }
    );
    rerender({ sel: "Spain" });
    expect(result.current.state.transitioningPreviousCountryState).toBe("France");
  });

  it("skips the glitch when the previous selection belongs to the layer that left", () => {
    const { result, rerender } = renderHook(
      ({ sel, map }) => useGlobeSelectionTransition(sel, "us_states", map),
      { initialProps: { sel: "Texas", map: { Texas: {} } } }
    );
    rerender({ sel: "France", map: { France: {} } });
    expect(result.current.state.transitioningPreviousCountryState).toBeNull();
  });
});
