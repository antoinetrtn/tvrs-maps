import { describe, expect, it } from "vitest";

import { getGlobePrefs, GLOBE_PREF_KEYS, setGlobePref } from "../globe/globePrefs";

describe("globe prefs store", () => {
  it("persists valid values and ignores invalid ones", () => {
    setGlobePref("foundStyle", "mesh");
    expect(getGlobePrefs().foundStyle).toBe("mesh");
    expect(localStorage.getItem(GLOBE_PREF_KEYS.foundStyle)).toBe("mesh");
    setGlobePref("foundStyle", "bogus");
    expect(getGlobePrefs().foundStyle).toBe("mesh");
    setGlobePref("renderer", "webgpu");
    expect(getGlobePrefs().renderer).toBe("webgpu");
    setGlobePref("renderer", "webgl");
    setGlobePref("foundStyle", "surface");
  });
});
