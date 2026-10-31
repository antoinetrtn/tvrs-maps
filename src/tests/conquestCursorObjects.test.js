import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCursorObject, tagName } from "../globe/render/cursorSprites";
import { createHintPool } from "../multiplayer/conquestCursorHints";

// jsdom has no canvas: a minimal 2D context is enough to build the tag textures.
const fakeCtx = () => ({
  font: "",
  measureText: (t) => ({ width: t.length * 6 }),
  fillRect: () => {},
  fillText: () => {},
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: () => {},
});

describe("terminal cursor object", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(fakeCtx);
  });
  afterEach(() => vi.restoreAllMocks());

  it("shortens long pseudos and never returns an empty tag", () => {
    expect(tagName("a_very_long_player_name")).toHaveLength(12);
    expect(tagName("")).toBe("?");
    expect(tagName(null)).toBe("?");
    expect(tagName("  lea   k ")).toBe("lea k");
  });

  it("blinks in two steps (solid block / hollow block)", () => {
    const cursor = createCursorObject({ name: "lea_k", color: "orange" });
    const camera = new THREE.PerspectiveCamera();
    new THREE.Scene().add(cursor.anchor);
    const [solid, hollow] = cursor.pin.children.filter((c) => c.renderOrder === 11);
    cursor.update({ camera, t: 100, placement: {}, reduced: false });
    expect([solid.visible, hollow.visible]).toEqual([true, false]);
    cursor.update({ camera, t: 600, placement: {}, reduced: false });
    expect([solid.visible, hollow.visible]).toEqual([false, true]);
    cursor.update({ camera, t: 800 + 100, placement: {}, reduced: false });
    expect([solid.visible, hollow.visible]).toEqual([true, false]);
    cursor.dispose();
  });

  it("does not blink under reduced motion", () => {
    const cursor = createCursorObject({ name: "lea_k", color: "orange" });
    const camera = new THREE.PerspectiveCamera();
    new THREE.Scene().add(cursor.anchor);
    const state = (t) => {
      cursor.update({ camera, t, placement: {}, reduced: true });
      return cursor.pin.children.map((c) => c.visible).join();
    };
    expect(state(100)).toBe(state(600));
    cursor.dispose();
  });

  it("flips the tag to the other side of the block and keeps a constant px size", () => {
    const cursor = createCursorObject({ name: "lea_k", color: "orange" });
    const camera = new THREE.PerspectiveCamera();
    new THREE.Scene().add(cursor.anchor);
    cursor.update({ camera, t: 0, placement: { left: false, below: false } });
    const label = cursor.pin.children.find((c) => c.isGroup);
    const right = label.position.x;
    cursor.update({ camera, t: 0, placement: { left: true, below: false } });
    expect(label.position.x).toBeCloseTo(-right);
    cursor.update({ camera, t: 0, placement: { left: false, below: true } });
    expect(label.position.y).toBeLessThan(15);
    cursor.setUnit(0.25);
    expect(cursor.anchor.scale.x).toBe(0.25);
    cursor.dispose();
  });
});

describe("screen-edge hint pool", () => {
  it("creates one element per opponent, moves it and hides it again", () => {
    const host = document.createElement("div");
    const pool = createHintPool(host);
    pool.show("a", {
      name: "lea_k_long_name",
      color: "orange",
      x: 100,
      y: 50,
      dir: 2,
      leftSide: false,
    });
    expect(host.children).toHaveLength(1);
    const el = host.firstChild;
    expect(el.classList.contains("is-on")).toBe(true);
    expect(el.dataset.dir).toBe("2");
    expect(el.textContent).toBe("lea_k_lo"); // short pseudo
    expect(el.style.getPropertyValue("--c")).toBe("orange");
    pool.show("a", { name: "lea_k", color: "orange", x: 300, y: 80, dir: 0, leftSide: true });
    expect(host.children).toHaveLength(1);
    expect(el.classList.contains("is-left")).toBe(true);
    pool.hide("a");
    expect(el.classList.contains("is-on")).toBe(false);
    pool.prune(new Set());
    expect(host.children).toHaveLength(0);
  });
});
