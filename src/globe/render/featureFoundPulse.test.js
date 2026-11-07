import { beforeEach, describe, expect, it } from "vitest";

import { riversMountainsDataMap } from "../../data/riversMountainsData";
import {
  clearFeatureMask,
  FEATURE_FOUND_VALUE,
  FEATURE_NEW_FOUND_VALUE,
  featureFoundPulseStart,
  getFeatureCells,
  getFeatureMaskData,
  setFeatureMask,
} from "./featureMask";
import { FEATURE_GLITCH_CHUNK, FEATURE_SURFACE_CHUNK } from "./featureModeShaderChunks";
import { polygonGlitchUniforms } from "./polygonGlitchShader";
import {
  FEATURE_FOUND_PULSE_S_VALUE,
  FEATURE_NEW_FOUND_THRESHOLD,
  SELECTION_STYLE_DEFS,
} from "./selectionStyle";

const D = riversMountainsDataMap;
const set = (foundKeys, selectedKey = null) =>
  setFeatureMask({ selectedKey, foundKeys, dataMap: D });
const valuesOf = (key) => new Set(getFeatureCells(key, D[key]).map((c) => getFeatureMaskData()[c]));

describe("rivers & mountains newly-found pulse", () => {
  beforeEach(() => clearFeatureMask());

  it("new band sits inside the found band, above plain found", () => {
    expect(FEATURE_NEW_FOUND_VALUE / 255).toBeGreaterThanOrEqual(FEATURE_NEW_FOUND_THRESHOLD);
    expect(FEATURE_NEW_FOUND_VALUE / 255).toBeLessThan(0.2);
    expect(FEATURE_FOUND_VALUE / 255).toBeLessThan(FEATURE_NEW_FOUND_THRESHOLD);
    expect(FEATURE_FOUND_PULSE_S_VALUE).toBeLessThanOrEqual(0.6);
  });

  it("pulses only the single newly discovered feature", () => {
    set(["amazon"], "alps");
    expect(featureFoundPulseStart.value).toBe(-100);
    set(["amazon", "alps"], "nile");
    expect(featureFoundPulseStart.value).toBeGreaterThan(0);
    expect(valuesOf("alps")).toEqual(new Set([FEATURE_NEW_FOUND_VALUE]));
    expect(valuesOf("amazon").has(FEATURE_NEW_FOUND_VALUE)).toBe(false);
  });

  it("stamps once the found feature is no longer the selection", () => {
    set(["amazon"], "alps");
    set(["amazon", "alps"], "alps");
    expect(featureFoundPulseStart.value).toBe(-100);
    set(["amazon", "alps"], "nile");
    const t = featureFoundPulseStart.value;
    expect(t).toBeGreaterThan(0);
    set(["amazon", "alps"], "amazon");
    expect(featureFoundPulseStart.value).toBe(t);
  });

  it("never replays on mount, restore or bulk resync", () => {
    set(["amazon", "alps", "nile"]);
    expect(featureFoundPulseStart.value).toBe(-100);
    clearFeatureMask();
    set(["amazon", "alps", "nile"]);
    expect(featureFoundPulseStart.value).toBe(-100);
    set(["amazon"]);
    set(["amazon", "alps", "nile"]);
    expect(featureFoundPulseStart.value).toBe(-100);
    for (const k of ["amazon", "alps", "nile"]) {
      expect(valuesOf(k).has(FEATURE_NEW_FOUND_VALUE)).toBe(false);
    }
  });

  it("shares the start uniform by reference with the GLSL uniforms", () => {
    expect(polygonGlitchUniforms.uFeatureFoundStart).toBe(featureFoundPulseStart);
  });

  it("GLSL pulse is gated by reduced motion and the pulse window in both passes", () => {
    for (const chunk of [FEATURE_GLITCH_CHUNK, FEATURE_SURFACE_CHUNK]) {
      expect(chunk).toContain("FEATURE_FOUND_PULSE_RGB");
      expect(chunk).toContain("(1.0 - uReducedMotion)");
      expect(chunk).toContain("uTime - uFeatureFoundStart");
      expect(chunk).toContain("step(FEATURE_NEW_FOUND_T");
    }
    expect(SELECTION_STYLE_DEFS).toContain("#define FEATURE_FOUND_PULSE_S 0.600");
  });

  it("TSL twins (surface + glitch) use the shared pulse node", async () => {
    const fs = await import("node:fs");
    const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
    expect(read("./webgpu/featureNodes.js")).toContain("featureFoundPulseNode(featSample");
    expect(read("./webgpu/glitchNode.js")).toContain("featureFoundPulseNode(featSample");
    expect(read("./webgpu/glitchNode.js")).toContain(
      "uFeatureFoundStart: getFeatureFoundStartNode()"
    );
  });
});
