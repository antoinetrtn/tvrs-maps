import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { getBiomeTexture } from "../globe/render/biomeTexture";
import {
  bakeLandcover,
  hexToRgb,
  LANDCOVER_CLASSES,
  pickTone,
  WORLD_PALETTE,
} from "../globe/render/worldPalette";

describe("world palette", () => {
  it("has 4 tones for every drawn land-cover class", () => {
    LANDCOVER_CLASSES.slice(1).forEach((name) => {
      expect(WORLD_PALETTE[name]).toHaveLength(4);
    });
  });

  it("bakes only palette colours; sea / no-data stays transparent", () => {
    const w = 32;
    const h = 16;
    const grey = new Uint8Array(w * h);
    for (let i = 0; i < grey.length; i++) grey[i] = (i % LANDCOVER_CLASSES.length) * 16 + (i % 16);
    const rgba = bakeLandcover(grey, w, h);
    const allowed = new Set(
      Object.values(WORLD_PALETTE)
        .flat()
        .map((hex) => hexToRgb(hex).join(","))
    );
    for (let i = 0; i < grey.length; i++) {
      const px = rgba.subarray(i * 4, i * 4 + 4);
      if (grey[i] >> 4 === 0) expect(px[3]).toBe(0);
      else {
        expect(px[3]).toBe(255);
        expect(allowed.has(`${px[0]},${px[1]},${px[2]}`)).toBe(true);
      }
    }
  });

  it("forests mix several tones (never a flat green)", () => {
    const tones = new Set();
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) tones.add(pickTone("tropical", 7, x, y));
    expect(tones.size).toBeGreaterThanOrEqual(3);
  });

  it("ships the real land-cover raster", () => {
    expect(fs.existsSync("public/textures/world-landcover-1440.png")).toBe(true);
  });

  it("uses a NearestFilter texture without mipmaps", () => {
    const tex = getBiomeTexture();
    expect(tex.magFilter).toBe(1003);
    expect(tex.minFilter).toBe(1003);
    expect(tex.generateMipmaps).toBe(false);
    expect(tex.image.width).toBe(1440);
  });
});
