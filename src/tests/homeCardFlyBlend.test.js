import { describe, expect, it } from "vitest";

import { CAMERA_MS } from "../globe/hooks/cameraTiming";
import {
  beginHomeCardFly,
  getRegionalModeUniform,
  isHomeCardFlyActive,
  REGIONAL_MODE_BLEND_MS,
  setRegionalModeTarget,
  stepRegionalModeUniform,
} from "../globe/render/homeCardFly";
import { polygonGlitchUniforms } from "../globe/render/polygonGlitchShader";

describe("home card fly blend", () => {
  it("exposes a 550ms blend matching the home camera fly", () => {
    expect(REGIONAL_MODE_BLEND_MS).toBe(CAMERA_MS.home);
  });

  it("lerps uIsRegionalMode toward the target instead of stepping", () => {
    setRegionalModeTarget(false, { instant: true });
    expect(getRegionalModeUniform()).toBe(0);

    setRegionalModeTarget(true, { durationMs: 400, instant: false });
    // Mid-blend: advance ~200ms
    const start = polygonGlitchUniforms.uIsRegionalMode.value;
    // step uses performance.now; simulate by setting a short duration and waiting isn't
    // deterministic here, so call step immediately — value should still be near 0, not 1.
    stepRegionalModeUniform();
    expect(getRegionalModeUniform()).toBeGreaterThanOrEqual(start);
    expect(getRegionalModeUniform()).toBeLessThan(0.5);

    setRegionalModeTarget(true, { instant: true });
    expect(getRegionalModeUniform()).toBe(1);
  });

  it("snaps under reduced-motion / instant", () => {
    setRegionalModeTarget(false, { instant: true });
    setRegionalModeTarget(true, { instant: true });
    expect(getRegionalModeUniform()).toBe(1);
  });

  it("marks a home card fly as active only for its duration", () => {
    beginHomeCardFly(0);
    expect(isHomeCardFlyActive()).toBe(false);
    beginHomeCardFly(500);
    expect(isHomeCardFlyActive()).toBe(true);
    beginHomeCardFly(0);
    expect(isHomeCardFlyActive()).toBe(false);
  });
});
