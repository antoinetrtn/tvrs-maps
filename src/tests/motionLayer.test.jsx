import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SegmentedControl from "../components/SegmentedControl";

const OPTIONS = [
  { value: "profile", label: "Profil" },
  { value: "stats", label: "Stats" },
];

const mockReducedMotion = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes("prefers-reduced-motion") && matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

describe("SegmentedControl", () => {
  it("keeps the active plate on the button until the indicator is measured", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="profile" onChange={onChange} />
    );
    // jsdom has no layout: no indicator, the active button paints its own plate.
    expect(container.querySelector(".segmented-indicator")).toBeNull();
    expect(container.querySelector(".segmented-control.has-indicator")).toBeNull();
    expect(screen.getByText("Profil").closest("button").className).toContain("active");
    fireEvent.click(screen.getByText("Stats"));
    expect(onChange).toHaveBeenCalledWith("stats");
  });

  it("renders a single stepped indicator once the active tab has a width", () => {
    const widthSpy = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(90);
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="stats" onChange={() => {}} />
    );
    const root = container.querySelector(".segmented-control");
    expect(root.className).toContain("has-indicator");
    expect(container.querySelectorAll(".segmented-indicator")).toHaveLength(1);
    expect(root.style.getPropertyValue("--seg-w")).toBe("90px");
    widthSpy.mockRestore();
  });
});

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
