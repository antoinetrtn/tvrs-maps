import { describe, expect, it } from "vitest";

import { cursorPosition } from "../globe/render/cursorSprites";
import {
  angularDistanceDeg,
  createCursorStore,
  CURSOR_HEARTBEAT_MS,
  CURSOR_SEND_INTERVAL_MS,
  CURSOR_STALE_MS,
  easeFactor,
  sanitizeCursor,
  shouldSendCursor,
  slerpLatLng,
} from "../multiplayer/conquestCursors";

describe("conquest spatial cursors", () => {
  it("sanitizes payloads", () => {
    expect(sanitizeCursor({ u: "a", lat: 95, lng: 190 })).toEqual({
      userId: "a",
      lat: 90,
      lng: -170,
    });
    expect(sanitizeCursor({ u: "a", lat: "x", lng: 0 })).toBeNull();
    expect(sanitizeCursor({ lat: 0, lng: 0 })).toBeNull();
    expect(sanitizeCursor(null)).toBeNull();
  });

  it("throttles sends (rate, min move, heartbeat)", () => {
    const last = { lat: 10, lng: 10, at: 0 };
    expect(shouldSendCursor(null, { lat: 0, lng: 0 }, 0)).toBe(true);
    expect(shouldSendCursor(last, { lat: 20, lng: 10 }, CURSOR_SEND_INTERVAL_MS - 1)).toBe(false);
    expect(shouldSendCursor(last, { lat: 20, lng: 10 }, CURSOR_SEND_INTERVAL_MS)).toBe(true);
    expect(shouldSendCursor(last, { lat: 10.01, lng: 10 }, 500)).toBe(false);
    expect(shouldSendCursor(last, { lat: 10, lng: 10 }, CURSOR_HEARTBEAT_MS)).toBe(true);
  });

  it("measures distance across the antimeridian", () => {
    expect(angularDistanceDeg({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })).toBeCloseTo(2, 5);
  });

  it("slerps along the short path", () => {
    const mid = slerpLatLng({ lat: 0, lng: 170 }, { lat: 0, lng: -170 }, 0.5);
    expect(Math.abs(mid.lng)).toBeCloseTo(180, 3);
    expect(slerpLatLng({ lat: 0, lng: 0 }, { lat: 10, lng: 10 }, 1)).toEqual({ lat: 10, lng: 10 });
    expect(easeFactor(16, true)).toBe(1);
    expect(easeFactor(16, false)).toBeGreaterThan(0);
    expect(easeFactor(16, false)).toBeLessThan(1);
  });

  it("stores opponents only and expires stale cursors", () => {
    const store = createCursorStore();
    const ids = new Set(["me", "opp"]);
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.receive({ u: "me", lat: 1, lng: 1 }, { selfId: "me", playerIds: ids })).toBe(
      false
    );
    expect(store.receive({ u: "intruder", lat: 1, lng: 1 }, { selfId: "me", playerIds: ids })).toBe(
      false
    );
    expect(
      store.receive({ u: "opp", lat: 1, lng: 2 }, { selfId: "me", playerIds: ids, now: 0 })
    ).toBe(true);
    expect(store.visible(1000)).toHaveLength(1);
    expect(store.visible(CURSOR_STALE_MS + 1)).toHaveLength(0);
    store.clear();
    expect(store.visible(0)).toHaveLength(0);
    expect(calls).toBe(2);
  });

  it("places cursors above the globe like three-globe", () => {
    const p = cursorPosition(0, 0);
    expect(p.z).toBeCloseTo(116, 3);
    expect(cursorPosition(90, 0).y).toBeCloseTo(116, 3);
  });
});
