import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  shouldRestoreInputFocusOnPointerUp,
  useGlobeInteractions,
} from "../globe/hooks/useGlobeInteractions";

describe("shouldRestoreInputFocusOnPointerUp", () => {
  it("returns true for mouse pointer when not on home screen", () => {
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "mouse", isHomeScreen: false })).toBe(
      true
    );
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "mouse" })).toBe(true);
  });

  it("returns true for pen pointer when not on home screen", () => {
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "pen", isHomeScreen: false })).toBe(
      true
    );
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "pen" })).toBe(true);
  });

  it("returns false for touch pointer", () => {
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "touch", isHomeScreen: false })).toBe(
      false
    );
  });

  it("returns false on home screen for all pointer types", () => {
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "mouse", isHomeScreen: true })).toBe(
      false
    );
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "pen", isHomeScreen: true })).toBe(
      false
    );
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "touch", isHomeScreen: true })).toBe(
      false
    );
  });

  it("returns false when pointerType is missing or unknown", () => {
    expect(shouldRestoreInputFocusOnPointerUp({})).toBe(false);
    expect(shouldRestoreInputFocusOnPointerUp()).toBe(false);
    expect(shouldRestoreInputFocusOnPointerUp({ pointerType: "other", isHomeScreen: false })).toBe(
      false
    );
  });
});

describe("useGlobeInteractions desktop input focus restoration", () => {
  function setupInteractions(props = {}) {
    const onPreserveInputFocus = vi.fn();
    const onCountrySelect = vi.fn();
    const hook = renderHook(
      (initialProps) =>
        useGlobeInteractions({
          globeEl: { current: null },
          globeContentWrapperRef: { current: null },
          isHomeScreen: false,
          isKeyboardMode: false,
          viewport: { width: 1024, height: 768 },
          perfProfile: {},
          onCountrySelect,
          onPreserveInputFocus,
          mode: "countries",
          gameDataMap: {},
          selectableFeatureIndex: [],
          isDepartmentMode: false,
          isRiversMountainsMode: false,
          ...initialProps,
        }),
      { initialProps: props }
    );
    return { result: hook.result, onPreserveInputFocus, onCountrySelect };
  }

  it("calls onPreserveInputFocus once after a mouse drag of 60 px", () => {
    const { result, onPreserveInputFocus } = setupInteractions();

    result.current.handlePointerDown({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    result.current.handlePointerUp({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 160,
      clientY: 100,
    });

    expect(onPreserveInputFocus).toHaveBeenCalledTimes(1);
  });

  it("calls onPreserveInputFocus once after mouse pointerdown+pointerup with elapsed > 600 ms", () => {
    const perfSpy = vi.spyOn(performance, "now");
    perfSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1700);

    const { result, onPreserveInputFocus } = setupInteractions();

    result.current.handlePointerDown({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    result.current.handlePointerUp({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });

    expect(onPreserveInputFocus).toHaveBeenCalledTimes(1);
    perfSpy.mockRestore();
  });

  it("does not call onPreserveInputFocus on touch pointerup when isKeyboardMode is false", () => {
    const { result, onPreserveInputFocus } = setupInteractions({ isKeyboardMode: false });

    result.current.handlePointerDown({
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    result.current.handlePointerUp({
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });

    expect(onPreserveInputFocus).not.toHaveBeenCalled();
  });

  it("does not call onPreserveInputFocus when isHomeScreen is true", () => {
    const { result, onPreserveInputFocus } = setupInteractions({ isHomeScreen: true });

    result.current.handlePointerDown({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    result.current.handlePointerUp({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 160,
      clientY: 100,
    });

    expect(onPreserveInputFocus).not.toHaveBeenCalled();
  });

  it("calls onPreserveInputFocus once after a pen drag", () => {
    const { result, onPreserveInputFocus } = setupInteractions();

    result.current.handlePointerDown({
      pointerId: 1,
      pointerType: "pen",
      clientX: 100,
      clientY: 100,
    });
    result.current.handlePointerUp({
      pointerId: 1,
      pointerType: "pen",
      clientX: 160,
      clientY: 100,
    });

    expect(onPreserveInputFocus).toHaveBeenCalledTimes(1);
  });

  it("does not call onPreserveInputFocus if pointerup does not follow pointerdown", () => {
    const { result, onPreserveInputFocus } = setupInteractions();

    result.current.handlePointerUp({
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });

    expect(onPreserveInputFocus).not.toHaveBeenCalled();
  });
});
