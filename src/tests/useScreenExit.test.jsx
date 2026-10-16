import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useScreenExit, { EXIT_MS } from "../hooks/useScreenExit";

const mockReducedMotion = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes("prefers-reduced-motion") && matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe("useScreenExit", () => {
  const originalMatchMedia = window.matchMedia;
  const render = (initial) =>
    renderHook(({ screen }) => useScreenExit(screen), { initialProps: { screen: initial } });

  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it("mirrors the --dur-screen-exit token (180ms)", () => {
    expect(EXIT_MS).toBe(180);
  });

  it("shows the home on the home screen and nothing elsewhere", () => {
    expect(render("home").result.current).toEqual({ showHome: true, homeExiting: false });
    expect(render("game").result.current).toEqual({ showHome: false, homeExiting: false });
  });

  it("keeps the home mounted and exiting for EXIT_MS when the game starts, then unmounts", () => {
    const { result, rerender } = render("home");
    rerender({ screen: "game" });
    expect(result.current).toEqual({ showHome: true, homeExiting: true });
    act(() => vi.advanceTimersByTime(EXIT_MS - 1));
    expect(result.current.homeExiting).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toEqual({ showHome: false, homeExiting: false });
  });

  it("does not stage the switch to Conquête", () => {
    const { result, rerender } = render("home");
    rerender({ screen: "conquest" });
    expect(result.current).toEqual({ showHome: false, homeExiting: false });
  });

  it("returns straight to a live home when going back before the exit ends", () => {
    const { result, rerender } = render("home");
    rerender({ screen: "game" });
    rerender({ screen: "home" });
    expect(result.current).toEqual({ showHome: true, homeExiting: false });
    act(() => vi.advanceTimersByTime(EXIT_MS * 2));
    expect(result.current).toEqual({ showHome: true, homeExiting: false });
  });

  it("unmounts immediately with prefers-reduced-motion", () => {
    mockReducedMotion(true);
    const { result, rerender } = render("home");
    rerender({ screen: "game" });
    expect(result.current).toEqual({ showHome: false, homeExiting: false });
  });
});
