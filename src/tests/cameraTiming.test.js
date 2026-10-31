import { describe, expect, it } from "vitest";

import { CAMERA_MS, cameraDuration, selectCameraDuration } from "../globe/hooks/cameraTiming";

describe("cameraTiming", () => {
  it("exports the standard camera ms constants", () => {
    expect(CAMERA_MS).toEqual({
      endScreen: 700,
      home: 550,
      gameStart: 650,
      customPov: 500,
      select: 360,
      selectHome: 650,
      nudgeMobile: 340,
      nudgeDesktop: 180,
    });
  });

  it("returns ms when reduced motion is false", () => {
    expect(cameraDuration(700, false)).toBe(700);
    expect(cameraDuration(360, false)).toBe(360);
  });

  it("returns 0 when reduced motion is true", () => {
    expect(cameraDuration(700, true)).toBe(0);
    expect(cameraDuration(360, true)).toBe(0);
  });

  it("selectCameraDuration resolves home, nudge, and standard selection durations", () => {
    expect(
      selectCameraDuration({ isHomeScreen: true, onlyViewportNudge: false, isMobile: false })
    ).toBe(CAMERA_MS.selectHome);

    expect(
      selectCameraDuration({ isHomeScreen: false, onlyViewportNudge: true, isMobile: true })
    ).toBe(CAMERA_MS.nudgeMobile);

    expect(
      selectCameraDuration({ isHomeScreen: false, onlyViewportNudge: true, isMobile: false })
    ).toBe(CAMERA_MS.nudgeDesktop);

    expect(
      selectCameraDuration({ isHomeScreen: false, onlyViewportNudge: false, isMobile: true })
    ).toBe(CAMERA_MS.select);

    expect(
      selectCameraDuration({ isHomeScreen: false, onlyViewportNudge: false, isMobile: false })
    ).toBe(CAMERA_MS.select);
  });
});
