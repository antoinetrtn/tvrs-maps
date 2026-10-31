import { beforeEach, describe, expect, it } from "vitest";

import { riversMountainsDataMap } from "../../data/riversMountainsData";
import {
  clearFeatureMask,
  FEATURE_FOUND_VALUE,
  FEATURE_HALO_VALUES,
  FEATURE_HOVER_VALUE,
  FEATURE_MEMBER_VALUE,
  FEATURE_SELECTED_VALUE,
  getFeatureCells,
  getFeatureMaskData,
  getFeatureMaskTexture,
  setFeatureHover,
  setFeatureMask,
} from "./featureMask";

describe("featureMask", () => {
  beforeEach(() => {
    clearFeatureMask();
  });

  it("river cells non-empty", () => {
    const amazon = riversMountainsDataMap.amazon;
    expect(amazon).toBeDefined();
    expect(amazon.type).toBe("river");

    const cells = getFeatureCells("amazon", amazon);
    expect(cells.length).toBeGreaterThan(0);

    setFeatureMask({
      selectedKey: "amazon",
      foundKeys: [],
      dataMap: riversMountainsDataMap,
    });

    const data = getFeatureMaskData();
    let selectedCount = 0;
    for (let i = 0; i < cells.length; i++) {
      if (data[cells[i]] === FEATURE_SELECTED_VALUE) {
        selectedCount++;
      }
    }
    expect(selectedCount).toBe(cells.length);
  });

  it("mountain cells non-empty", () => {
    const alps = riversMountainsDataMap.alps;
    expect(alps).toBeDefined();

    const cells = getFeatureCells("alps", alps);
    expect(cells.length).toBeGreaterThan(0);
  });

  it("selected mountain gets a thin border with an inner halo, not a filled band", () => {
    const cells = getFeatureCells("alps", riversMountainsDataMap.alps);
    setFeatureMask({ selectedKey: "alps", foundKeys: [], dataMap: riversMountainsDataMap });
    const data = getFeatureMaskData();
    const unique = [...new Set(cells)];
    const edge = unique.filter((c) => data[c] === FEATURE_SELECTED_VALUE).length;
    const halo = unique.filter((c) => FEATURE_HALO_VALUES.includes(data[c])).length;
    expect(edge).toBeGreaterThan(0);
    expect(halo).toBeGreaterThan(0);
    expect(edge).toBeLessThan(unique.length);
  });

  it("halo rings present around selected feature", () => {
    setFeatureMask({
      selectedKey: "amazon",
      foundKeys: [],
      dataMap: riversMountainsDataMap,
    });

    const data = getFeatureMaskData();
    let ring1Count = 0;
    let ring2Count = 0;
    let ring3Count = 0;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (val === FEATURE_HALO_VALUES[0]) ring1Count++;
      else if (val === FEATURE_HALO_VALUES[1]) ring2Count++;
      else if (val === FEATURE_HALO_VALUES[2]) ring3Count++;
    }

    expect(ring1Count).toBeGreaterThan(0);
    expect(ring2Count).toBeGreaterThan(0);
    expect(ring3Count).toBeGreaterThan(0);
  });

  it("writes found value 40 for found features", () => {
    setFeatureMask({
      selectedKey: null,
      foundKeys: ["danube", "alps"],
      dataMap: riversMountainsDataMap,
    });

    const data = getFeatureMaskData();
    let foundCount = 0;
    let selectedCount = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i] === FEATURE_FOUND_VALUE) foundCount++;
      if (data[i] === FEATURE_SELECTED_VALUE) selectedCount++;
    }

    expect(foundCount).toBeGreaterThan(0);
    expect(selectedCount).toBe(0);
  });

  it("rebuild is idempotent when inputs do not change", () => {
    const tex = getFeatureMaskTexture();
    setFeatureMask({
      selectedKey: "amazon",
      foundKeys: ["danube"],
      dataMap: riversMountainsDataMap,
    });

    const versionAfterFirst = tex.version;

    // Second call with identical inputs
    setFeatureMask({
      selectedKey: "amazon",
      foundKeys: ["danube"],
      dataMap: riversMountainsDataMap,
    });

    // Texture version should not increment because rebuild was skipped
    expect(tex.version).toBe(versionAfterFirst);
  });

  it("clears mask without re-allocating buffer", () => {
    setFeatureMask({
      selectedKey: "amazon",
      foundKeys: ["danube"],
      dataMap: riversMountainsDataMap,
    });

    const bufferBefore = getFeatureMaskData();
    clearFeatureMask();
    const bufferAfter = getFeatureMaskData();

    expect(bufferBefore).toBe(bufferAfter);

    let nonZero = 0;
    for (let i = 0; i < bufferAfter.length; i++) {
      if (bufferAfter[i] !== 0) nonZero++;
    }
    expect(nonZero).toBe(0);
  });

  it("marks only game-dataset features as members (simplified view)", () => {
    const onlyAmazon = { amazon: riversMountainsDataMap.amazon };
    setFeatureMask({ selectedKey: null, foundKeys: [], dataMap: onlyAmazon });
    const data = getFeatureMaskData();
    const amazonCell = getFeatureCells("amazon", onlyAmazon.amazon)[0];
    expect(data[amazonCell]).toBe(FEATURE_MEMBER_VALUE);
    const otherKey = Object.keys(riversMountainsDataMap).find(
      (k) => k !== "amazon" && riversMountainsDataMap[k].type === "river"
    );
    const otherCells = getFeatureCells(otherKey, riversMountainsDataMap[otherKey]);
    const hidden = otherCells.filter((c) => data[c] === 0).length;
    expect(hidden / otherCells.length).toBeGreaterThan(0.9);
  });

  it("hover draws a thin line without halo and restores on leave", () => {
    setFeatureMask({ selectedKey: null, foundKeys: [], dataMap: riversMountainsDataMap });
    const data = getFeatureMaskData();
    const before = data.slice();
    setFeatureHover("amazon", riversMountainsDataMap);
    const cells = getFeatureCells("amazon", riversMountainsDataMap.amazon);
    expect(data[cells[0]]).toBe(FEATURE_HOVER_VALUE);
    expect(data.some((v) => FEATURE_HALO_VALUES.includes(v))).toBe(false);
    setFeatureHover(null);
    expect(data.every((v, i) => v === before[i])).toBe(true);
  });

  it("hover never overrides the selected feature", () => {
    setFeatureMask({ selectedKey: "amazon", foundKeys: [], dataMap: riversMountainsDataMap });
    const cells = getFeatureCells("amazon", riversMountainsDataMap.amazon);
    setFeatureHover("amazon", riversMountainsDataMap);
    expect(getFeatureMaskData()[cells[0]]).toBe(FEATURE_SELECTED_VALUE);
  });
});
