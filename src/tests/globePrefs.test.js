import { describe, expect, it } from "vitest";

import { getGlobePrefs, GLOBE_PREF_KEYS, setGlobePref } from "../globe/globePrefs";

describe("globe prefs store", () => {
  it("persists valid values and ignores invalid ones", () => {
    setGlobePref("renderer", "webgpu");
    expect(getGlobePrefs().renderer).toBe("webgpu");
    expect(localStorage.getItem(GLOBE_PREF_KEYS.renderer)).toBe("webgpu");
    setGlobePref("renderer", "bogus");
    expect(getGlobePrefs().renderer).toBe("webgpu");
    setGlobePref("foundStyle", "mesh");
    expect(getGlobePrefs().foundStyle).toBeUndefined();
    setGlobePref("renderer", "webgl");
  });
});
