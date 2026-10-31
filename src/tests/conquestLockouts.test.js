import { describe, expect, it } from "vitest";

import { CONQUEST_PLAYER_COLORS } from "../config/designSystem";
import { buildConquestOverlay, stealLockouts } from "../multiplayer/conquestLogic";

const NOW = Date.parse("2026-10-11T18:00:00Z");
const ago = (s) => new Date(NOW - s * 1000).toISOString();

describe("stealLockouts", () => {
  const events = [
    { kind: "steal_fail", actor_id: "me", country_id: "France", created_at: ago(5) },
    { kind: "steal_fail", actor_id: "me", country_id: "Spain", created_at: ago(30) },
    { kind: "steal_fail", actor_id: "them", country_id: "Italy", created_at: ago(1) },
    { kind: "capture", actor_id: "me", country_id: "Peru", created_at: ago(1) },
  ];

  it("locks my failed steals for the cooldown, with the time left", () => {
    expect(stealLockouts({ events, players: [], userId: "me" }, NOW)).toEqual([
      { id: "France", ms: 15000 },
    ]);
  });

  it("uses the match rule and my personal penalty when longer", () => {
    const players = [{ user_id: "me", penalty_until: new Date(NOW + 40000).toISOString() }];
    const rules = { steal_fail_cooldown_seconds: 60 };
    expect(stealLockouts({ events, players, userId: "me", rules }, NOW)).toEqual([
      { id: "France", ms: 55000 },
      { id: "Spain", ms: 40000 },
    ]);
  });
});

describe("buildConquestOverlay", () => {
  it("paints the unclaimed world neutral and locked countries grey", () => {
    const overlay = buildConquestOverlay([], [], [], ["France"]);
    expect(overlay.neutral).toBe(CONQUEST_PLAYER_COLORS.neutral);
    expect(overlay.colors.France).toBe(CONQUEST_PLAYER_COLORS.locked);
    expect(Object.values(CONQUEST_PLAYER_COLORS).filter((c) => c === overlay.neutral)).toHaveLength(
      1
    );
  });
});
