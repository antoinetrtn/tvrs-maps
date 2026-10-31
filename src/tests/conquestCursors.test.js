import { describe, expect, it } from "vitest";

import { cursorPosition } from "../globe/render/cursorSprites";
import {
  angularDistanceDeg,
  buildCursorPayload,
  createCursorMotion,
  createCursorStore,
  CURSOR_HEARTBEAT_MS,
  CURSOR_SEND_INTERVAL_MS,
  CURSOR_STALE_MS,
  EXTRAPOLATE_MAX_MS,
  extrapolateTarget,
  fromUnit,
  sanitizeCountryId,
  sanitizeCursor,
  shouldSendCursor,
  toUnit,
  velocityBetween,
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

  it("places cursors on the globe surface like three-globe", () => {
    const p = cursorPosition(0, 0);
    expect(p.z).toBeCloseTo(100.3, 3);
    expect(cursorPosition(90, 0).y).toBeCloseTo(100.3, 3);
  });
});

describe("conquest cursors: selected country (backward compatible)", () => {
  it("accepts an optional country id and ignores junk", () => {
    expect(sanitizeCountryId("France")).toBe("France");
    expect(sanitizeCountryId("  Turkey ")).toBe("Turkey");
    expect(sanitizeCountryId("")).toBeNull();
    expect(sanitizeCountryId(42)).toBeNull();
    expect(sanitizeCountryId("x".repeat(200))).toHaveLength(64);
    expect(sanitizeCursor({ u: "a", lat: 1, lng: 2, c: "France" })).toEqual({
      userId: "a",
      lat: 1,
      lng: 2,
      country: "France",
    });
    // Old clients send no `c`: the cursor stays valid and has no country key.
    expect(sanitizeCursor({ u: "a", lat: 1, lng: 2 })).not.toHaveProperty("country");
    expect(sanitizeCursor({ u: "a", lat: 1, lng: 2, c: { evil: true } })).not.toHaveProperty(
      "country"
    );
  });

  it("builds a compact payload, `c` only when a country is selected", () => {
    expect(buildCursorPayload("me", { lat: 1.23456, lng: 2.34567 })).toEqual({
      u: "me",
      lat: 1.235,
      lng: 2.346,
    });
    expect(buildCursorPayload("me", { lat: 1, lng: 2, country: "Peru" })).toEqual({
      u: "me",
      lat: 1,
      lng: 2,
      c: "Peru",
    });
  });

  it("sends a country change as soon as the rate limit allows, even without movement", () => {
    const last = { lat: 10, lng: 10, at: 0, country: null };
    const same = { lat: 10, lng: 10, country: null };
    const picked = { lat: 10, lng: 10, country: "France" };
    expect(shouldSendCursor(last, same, 500)).toBe(false);
    expect(shouldSendCursor(last, picked, CURSOR_SEND_INTERVAL_MS - 1)).toBe(false);
    expect(shouldSendCursor(last, picked, CURSOR_SEND_INTERVAL_MS)).toBe(true);
    expect(shouldSendCursor({ ...last, country: "France" }, same, 500)).toBe(true);
  });

  it("keeps the selected country in the store", () => {
    const store = createCursorStore();
    const ids = new Set(["me", "opp"]);
    store.receive(
      { u: "opp", lat: 1, lng: 2, c: "Spain" },
      { selfId: "me", playerIds: ids, now: 0 }
    );
    expect(store.visible(10)[0].country).toBe("Spain");
    store.receive({ u: "opp", lat: 1, lng: 2 }, { selfId: "me", playerIds: ids, now: 200 });
    expect(store.visible(210)[0].country).toBeUndefined();
  });
});

describe("conquest cursors: organic motion", () => {
  const FRAME = 1000 / 60;

  it("estimates the gaze velocity from two samples", () => {
    const a = { lat: 0, lng: 0, at: 0 };
    const b = { lat: 0, lng: 9, at: 150 };
    const v = velocityBetween(a, b);
    expect(Math.hypot(...v)).toBeCloseTo((9 * Math.PI) / 180 / 0.15, 1);
    // Too close to tell → previous velocity is kept; too far → the player stopped.
    expect(velocityBetween(a, { ...b, at: 20 }, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(velocityBetween(a, { ...b, at: 5000 }, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it("extrapolates a bounded distance ahead and stays on the sphere", () => {
    const sample = { lat: 0, lng: 0, vel: [0, 1, 0] };
    const p0 = extrapolateTarget(sample, 0);
    const pMax = extrapolateTarget(sample, EXTRAPOLATE_MAX_MS);
    const pFar = extrapolateTarget(sample, 10_000);
    expect(p0).toEqual(toUnit(sample));
    expect(fromUnit(pMax).lng).toBeGreaterThan(0);
    expect(pFar).toEqual(pMax); // capped: a stopped globe does not drift away
    expect(Math.hypot(...pMax)).toBeCloseTo(1, 6);
    expect(extrapolateTarget({ lat: 5, lng: 5 }, 100)).toEqual(toUnit({ lat: 5, lng: 5 }));
  });

  it("chases a target with a little overshoot and settles", () => {
    const motion = createCursorMotion({ lat: 0, lng: 0 });
    const target = toUnit({ lat: 0, lng: 30 });
    let peak = 0;
    let at = null;
    let last = { lat: 0, lng: 0 };
    for (let i = 0; i < 120; i++) {
      last = motion.step(FRAME, target);
      peak = Math.max(peak, last.lng);
      if (at === null && Math.abs(last.lng - 30) < 0.3) at = i * FRAME;
    }
    expect(peak).toBeGreaterThan(30); // light overshoot…
    expect(peak).toBeLessThan(30 * 1.1); // …never more than 10 %
    expect(at).toBeLessThan(700);
    expect(last.lng).toBeCloseTo(30, 1);
  });

  it("is frame-rate independent (30 vs 120 fps end up together)", () => {
    const run = (dt) => {
      const m = createCursorMotion({ lat: 10, lng: -20 });
      const target = toUnit({ lat: 40, lng: 25 });
      let out = null;
      for (let t = 0; t < 400; t += dt) out = m.step(dt, target);
      return out;
    };
    const a = run(1000 / 30);
    const b = run(1000 / 120);
    expect(Math.abs(a.lat - b.lat)).toBeLessThan(2);
    expect(Math.abs(a.lng - b.lng)).toBeLessThan(2);
  });

  it("takes the short way across the antimeridian", () => {
    const m = createCursorMotion({ lat: 0, lng: 175 });
    const target = toUnit({ lat: 0, lng: -175 });
    const first = m.step(FRAME * 4, target);
    expect(Math.abs(first.lng)).toBeGreaterThan(175);
  });

  it("reduced motion follows without inertia or overshoot", () => {
    const m = createCursorMotion({ lat: 0, lng: 0 });
    const target = toUnit({ lat: 0, lng: 30 });
    let peak = 0;
    for (let i = 0; i < 120; i++)
      peak = Math.max(peak, m.step(FRAME, target, { reduced: true }).lng);
    expect(peak).toBeLessThanOrEqual(30.0001);
    expect(peak).toBeCloseTo(30, 1);
  });

  it("derives the velocity in the store from consecutive receipts only", () => {
    const store = createCursorStore();
    const ids = new Set(["me", "opp"]);
    const ctx = { selfId: "me", playerIds: ids };
    store.receive({ u: "opp", lat: 0, lng: 0 }, { ...ctx, now: 0 });
    expect(store.visible(1)[0].vel).toEqual([0, 0, 0]);
    store.receive({ u: "opp", lat: 0, lng: 5 }, { ...ctx, now: 150 });
    expect(Math.hypot(...store.visible(151)[0].vel)).toBeGreaterThan(0.1);
    store.receive({ u: "opp", lat: 0, lng: 5 }, { ...ctx, now: 2500 }); // heartbeat after a pause
    expect(store.visible(2501)[0].vel).toEqual([0, 0, 0]);
  });
});
