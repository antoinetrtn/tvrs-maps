import { describe, expect, it } from "vitest";

import { isGlobeHoverRaycastNeeded } from "../globe/render/pointerRaycast";

describe("isGlobeHoverRaycastNeeded", () => {
  it("returns false for home screen in rivers and mountains mode", () => {
    expect(isGlobeHoverRaycastNeeded({ isHomeScreen: true, isRiversMountainsMode: true })).toBe(
      false
    );
  });

  it("returns false during gameplay in rivers and mountains mode (3D meshes removed)", () => {
    expect(isGlobeHoverRaycastNeeded({ isHomeScreen: false, isRiversMountainsMode: true })).toBe(
      false
    );
  });

  it("returns false during gameplay outside rivers and mountains mode", () => {
    expect(isGlobeHoverRaycastNeeded({ isHomeScreen: false, isRiversMountainsMode: false })).toBe(
      false
    );
  });

  it("forces false when profileEnabled is false", () => {
    expect(
      isGlobeHoverRaycastNeeded({
        isHomeScreen: false,
        isRiversMountainsMode: true,
        profileEnabled: false,
      })
    ).toBe(false);
  });

  it("returns false when called without arguments", () => {
    expect(isGlobeHoverRaycastNeeded()).toBe(false);
  });

  it("treats undefined profileEnabled as returning false", () => {
    expect(
      isGlobeHoverRaycastNeeded({
        isHomeScreen: false,
        isRiversMountainsMode: true,
        profileEnabled: undefined,
      })
    ).toBe(false);
  });
});
