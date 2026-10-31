import { act, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReducedMotion = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes("prefers-reduced-motion") && matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

describe("ModeShutter", () => {
  const original = window.matchMedia;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = original;
  });

  it("does not play on the first mount, then plays when the other screen mounts", async () => {
    const { default: ModeShutter } = await import("../components/ModeShutter");
    const first = render(<ModeShutter screen="home" />);
    expect(screen.queryByTestId("mode-shutter")).toBeNull();
    first.unmount();

    const second = render(<ModeShutter screen="conquest" />);
    expect(screen.getByTestId("mode-shutter").querySelectorAll(".mode-shutter-blind")).toHaveLength(
      6
    );
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByTestId("mode-shutter")).toBeNull();
    second.unmount();

    // Same screen again (e.g. home → game → home): no shutter.
    render(<ModeShutter screen="conquest" />);
    expect(screen.queryByTestId("mode-shutter")).toBeNull();
  });

  it("never renders with prefers-reduced-motion", async () => {
    mockReducedMotion(true);
    const { default: ModeShutter } = await import("../components/ModeShutter");
    render(<ModeShutter screen="home" />).unmount();
    render(<ModeShutter screen="conquest" />);
    expect(screen.queryByTestId("mode-shutter")).toBeNull();
  });
});
