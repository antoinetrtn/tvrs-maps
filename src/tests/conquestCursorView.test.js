import { describe, expect, it } from "vitest";

import {
  assignHighlightSlots,
  edgeHintPlacement,
  isBeyondHorizon,
  labelPlacement,
  snapDir8,
} from "../multiplayer/conquestCursorView";

describe("conquest cursor view maths", () => {
  it("hides points beyond the horizon, whatever the zoom", () => {
    const cam = [0, 0, 250];
    expect(isBeyondHorizon([0, 0, 1], cam)).toBe(false); // facing the camera
    expect(isBeyondHorizon([0, 0, -1], cam)).toBe(true); // far side
    // 250 → horizon at acos(100/250) ≈ 66°
    const at = (deg) => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];
    expect(isBeyondHorizon(at(60), cam)).toBe(false);
    expect(isBeyondHorizon(at(72), cam)).toBe(true);
    // close up the visible cap shrinks (≈ 35° at 122)
    const close = [0, 0, 122];
    expect(isBeyondHorizon(at(30), close)).toBe(false);
    expect(isBeyondHorizon(at(45), close)).toBe(true);
  });

  it("snaps a direction to 8 compass slots (y up)", () => {
    expect(snapDir8(1, 0)).toBe(0);
    expect(snapDir8(1, 1)).toBe(1);
    expect(snapDir8(0, 1)).toBe(2);
    expect(snapDir8(-1, 0)).toBe(4);
    expect(snapDir8(0, -1)).toBe(6);
    expect(snapDir8(1, -1)).toBe(7);
  });

  it("puts the edge hint on the border of the inset box, toward the player", () => {
    const rect = { width: 1000, height: 600 };
    const inset = { left: 10, right: 10, top: 100, bottom: 100 };
    const right = edgeHintPlacement(1, 0, rect, inset);
    expect(right.x).toBeCloseTo(990);
    expect(right.y).toBeCloseTo(300);
    expect(right.dir).toBe(0);
    const up = edgeHintPlacement(0, -1, rect, inset); // screen y is down
    expect(up.y).toBeCloseTo(100);
    expect(up.dir).toBe(2);
    const diag = edgeHintPlacement(1, 1, rect, inset);
    expect(diag.x).toBeLessThanOrEqual(990);
    expect(diag.y).toBeLessThanOrEqual(500);
    expect(diag.dir).toBe(7);
    // Straight behind the globe: still a valid, in-bounds position
    const none = edgeHintPlacement(0, 0, rect, inset);
    expect(none.y).toBeCloseTo(500);
  });

  it("flips the tag near the right edge, drops it near the top, with hysteresis", () => {
    const rect = { width: 400, height: 800 };
    expect(labelPlacement(100, 400, 60, rect)).toEqual({ left: false, below: false });
    expect(labelPlacement(360, 400, 60, rect).left).toBe(true);
    expect(labelPlacement(200, 20, 60, rect).below).toBe(true);
    // once flipped, it stays flipped until there is clearly room again
    const flipped = { left: true, below: false };
    expect(labelPlacement(300, 400, 60, rect, flipped).left).toBe(true);
    expect(labelPlacement(200, 400, 60, rect, flipped).left).toBe(false);
  });

  it("gives each highlight on a country its own slot (self first)", () => {
    const slots = assignHighlightSlots(
      [
        { userId: "b", country: "Turkey" },
        { userId: "a", country: "Turkey" },
        { userId: "c", country: "Peru" },
        { userId: "d", country: null },
      ],
      null
    );
    expect(slots.get("a")).toEqual({ slot: 0, count: 2 });
    expect(slots.get("b")).toEqual({ slot: 1, count: 2 });
    expect(slots.get("c")).toEqual({ slot: 0, count: 1 });
    expect(slots.has("d")).toBe(false);
    // The local selection (drawn by the globe) takes slot 0 on the same country
    const withSelf = assignHighlightSlots([{ userId: "a", country: "Turkey" }], "Turkey");
    expect(withSelf.get("a")).toEqual({ slot: 1, count: 2 });
    const elsewhere = assignHighlightSlots([{ userId: "a", country: "Turkey" }], "Peru");
    expect(elsewhere.get("a")).toEqual({ slot: 0, count: 1 });
  });
});
