import { describe, expect, it, vi } from "vitest";

import { evictUnusedPolygonMaterials } from "../globe/hooks/usePolygonMaterialEviction";

const mat = () => ({ dispose: vi.fn() });

describe("evictUnusedPolygonMaterials", () => {
  it("disposes unused ignite/selection materials, keeps in-use, shared and recent ones", () => {
    const used = mat();
    const shared = mat();
    const oldIgnite = mat();
    const shaders = Array.from({ length: 6 }, mat);
    const pool = new Map([
      ["found-cap-desktop", shared],
      ["ignite-France-found-cap-desktop", oldIgnite],
      ["ignite-Belgium-found-cap-desktop", used],
      ...shaders.map((m, i) => [`shader-C${i}-cap`, m]),
    ]);
    const scene = { traverse: (fn) => [{ material: used }, { material: [shared] }].forEach(fn) };
    const cache = { cap: new Map([["France", oldIgnite]]), side: new Map() };

    expect(evictUnusedPolygonMaterials(scene, pool, cache)).toBe(3);
    expect(oldIgnite.dispose).toHaveBeenCalled();
    expect(shaders[0].dispose).toHaveBeenCalled();
    expect(shaders[1].dispose).toHaveBeenCalled();
    expect(shaders[2].dispose).not.toHaveBeenCalled();
    expect(used.dispose).not.toHaveBeenCalled();
    expect(pool.has("found-cap-desktop")).toBe(true);
    expect(pool.size).toBe(6);
    expect(cache.cap.has("France")).toBe(false);
  });
});
