import { describe, expect, it } from "vitest";

import { CONQUEST_PLAYER_COLORS } from "../config/designSystem";
import {
  buildConquestOverlay,
  computeClockOffset,
  computeStandings,
  computeWinner,
  deriveMatchPhase,
  describeClaimRefusal,
  describeRpcError,
  formatClock,
  formatFeedEvent,
  getPaletteEntry,
  isStaleState,
  normalizeRoomCode,
  pickClockOffset,
  remainingMs,
  resolveCountryClick,
  shieldedCountryIds,
} from "../multiplayer/conquestLogic";

const A = { user_id: "a", display_name: "Antoine", color: "teal", score: 0 };
const B = { user_id: "b", display_name: "Léa", color: "amber", score: 0 };
const T0 = Date.parse("2026-10-10T18:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

describe("conquestLogic", () => {
  it("normalizes room codes and rejects implausible ones", () => {
    expect(normalizeRoomCode(" ab-c2 34 ")).toBe("ABC234");
    expect(normalizeRoomCode("ABC12")).toBe("");
    expect(normalizeRoomCode("ABCD0O")).toBe(""); // 0/O excluded (ambiguous)
    expect(normalizeRoomCode(null)).toBe("");
  });

  it("pairs every colour with a pattern and falls back to the first", () => {
    expect(getPaletteEntry("amber")).toMatchObject({
      hex: CONQUEST_PLAYER_COLORS.amber,
      pattern: "dots",
    });
    expect(getPaletteEntry("unknown").id).toBe("teal");
  });

  it("formats the clock rounding up and never negative", () => {
    expect(formatClock(600000)).toBe("10:00");
    expect(formatClock(61001)).toBe("1:02");
    expect(formatClock(1)).toBe("0:01");
    expect(formatClock(-5)).toBe("0:00");
  });

  it("uses the server clock offset for remaining time", () => {
    const offset = computeClockOffset(iso(T0 + 2000), T0);
    expect(offset).toBe(2000);
    expect(remainingMs(iso(T0 + 10000), T0, offset)).toBe(8000);
    expect(remainingMs(iso(T0 - 1), T0, 0)).toBe(0);
    expect(computeClockOffset("garbage", T0)).toBe(0);
  });

  it("derives the match phase from status and server time", () => {
    const live = { status: "live", started_at: iso(T0), ends_at: iso(T0 + 600000) };
    expect(deriveMatchPhase(null, T0)).toBe("idle");
    expect(deriveMatchPhase({ status: "lobby" }, T0)).toBe("lobby");
    expect(deriveMatchPhase(live, T0 - 1500)).toBe("countdown");
    expect(deriveMatchPhase(live, T0 + 1000)).toBe("live");
    expect(deriveMatchPhase(live, T0 + 600001)).toBe("finished");
    expect(deriveMatchPhase({ ...live, status: "finished" }, T0)).toBe("finished");
  });

  it("builds the globe overlay: owner colours, ink outline for patterns, shield rings", () => {
    const claims = [
      { country_id: "France", owner_id: "a", shield_until: iso(T0 + 5000) },
      { country_id: "Italy", owner_id: "b", shield_until: iso(T0 - 1) },
      { country_id: "Spain", owner_id: "ghost" },
    ];
    const shielded = shieldedCountryIds(claims, T0, 0);
    expect(shielded).toEqual(["France"]);
    const overlay = buildConquestOverlay(claims, [A, B], shielded);
    expect(overlay.colors).toEqual({
      France: CONQUEST_PLAYER_COLORS.teal,
      Italy: CONQUEST_PLAYER_COLORS.amber,
    });
    expect(overlay.strokes).toEqual({ Italy: CONQUEST_PLAYER_COLORS.ink });
    expect(overlay.rings).toHaveLength(1);
    expect(overlay.rings[0].color).toBe(CONQUEST_PLAYER_COLORS.teal);
  });

  it("ranks by score, then countries held, then join order", () => {
    const claims = [
      { country_id: "France", owner_id: "b" },
      { country_id: "Italy", owner_id: "b" },
      { country_id: "Spain", owner_id: "a" },
    ];
    const standings = computeStandings(
      [
        { ...A, score: 20 },
        { ...B, score: 20 },
      ],
      claims
    );
    expect(standings.map((p) => p.user_id)).toEqual(["b", "a"]);
    expect(standings[0].countries).toBe(2);
    expect(computeWinner([{ ...A, score: 30 }, B], []).user_id).toBe("a");
    expect(computeWinner([A, B], [])).toBeNull(); // perfect draw
    expect(computeWinner([], [])).toBeNull();
    // Continent bonus counts towards the total and can flip the winner.
    const bonuses = [{ user_id: "b", region: "Oceania", bonus: 50 }];
    const withBonus = computeStandings([{ ...A, score: 40 }, B], [], bonuses);
    expect(withBonus[0]).toMatchObject({ user_id: "b", total: 50, bonus: 50 });
    // Steals break a tie on total and countries.
    expect(computeWinner([A, { ...B, steals: 2 }], []).user_id).toBe("b");
  });

  it("maps a globe click to steal / free / mine / shielded", () => {
    const claims = [
      { country_id: "France", owner_id: "a" },
      { country_id: "Italy", owner_id: "b", shield_until: iso(T0 + 5000) },
      { country_id: "Spain", owner_id: "b", shield_until: iso(T0 - 1) },
    ];
    expect(resolveCountryClick("Peru", claims, "a", T0)).toBe("free");
    expect(resolveCountryClick("France", claims, "a", T0)).toBe("mine");
    expect(resolveCountryClick("Italy", claims, "a", T0)).toBe("shielded");
    expect(resolveCountryClick("Italy", claims, "a", T0, 6000)).toBe("steal");
    expect(resolveCountryClick("Spain", claims, "a", T0)).toBe("steal");
  });

  it("formats feed lines and refusal messages", () => {
    const ctx = { players: [A, B], countryName: (id) => `«${id}»`, lang: "fr" };
    expect(formatFeedEvent({ kind: "capture", actor_id: "b", country_id: "Italy" }, ctx)).toBe(
      "Léa a capturé «Italy»"
    );
    expect(formatFeedEvent({ kind: "fail", actor_id: "a" }, ctx)).toBeNull();
    expect(formatFeedEvent({ kind: "join", actor_id: "zz" }, { ...ctx, lang: "en" })).toBe(
      "A player joined the room"
    );
    expect(
      describeClaimRefusal({ reason: "already_owned", country_id: "France", owner_id: "a" }, ctx)
    ).toBe("«France» est déjà pris par Antoine");
    expect(describeClaimRefusal({ reason: "unknown" }, ctx)).toBe("Pays inconnu");
    expect(describeClaimRefusal({ reason: "shielded", country_id: "Italy" }, ctx)).toBe(
      "«Italy» est sous bouclier"
    );
    expect(describeClaimRefusal({ reason: "cooldown", country_id: "Italy" }, ctx)).toMatch(
      /re-voler/
    );
    expect(
      formatFeedEvent(
        { kind: "steal", actor_id: "b", country_id: "Italy", payload: { victim: "a" } },
        ctx
      )
    ).toBe("Léa a volé «Italy» à Antoine");
    expect(formatFeedEvent({ kind: "steal_fail", actor_id: "a", country_id: "Italy" }, ctx)).toBe(
      "Antoine a raté le vol de «Italy»"
    );
    expect(describeRpcError({ message: "match_full" }, "en")).toBe("Room is full");
    expect(describeRpcError(new Error("boom"))).toBe("Connexion au serveur impossible");
  });

  it("keeps the clock offset of the fastest sample", () => {
    expect(pickClockOffset([])).toBe(0);
    expect(
      pickClockOffset([
        { offset: 900, latency: 400 },
        { offset: 120, latency: 20 },
        { offset: 300, latency: 90 },
      ])
    ).toBe(120);
  });

  it("detects out-of-order states of the same match only", () => {
    const cur = { match: { id: "m" }, version: 5 };
    expect(isStaleState(cur, { match: { id: "m" }, version: 4 })).toBe(true);
    expect(isStaleState(cur, { match: { id: "m" }, version: 5 })).toBe(false);
    expect(isStaleState(cur, { match: { id: "other" }, version: 1 })).toBe(false);
  });

  it("prefers the stored server result for the winner (forfeit)", () => {
    const players = [
      { user_id: "a", display_name: "A", score: 90, joined_at: "1" },
      { user_id: "b", display_name: "B", score: 10, joined_at: "2" },
    ];
    expect(computeWinner(players, [], [], { winner: "b", forfeit_by: "a" }).user_id).toBe("b");
    expect(computeWinner(players, [], [], { winner: null })).toBeNull();
  });

  it("describes the new refusal reasons", () => {
    expect(describeClaimRefusal({ reason: "rate_limited" }, {})).toMatch(/rapide/);
    expect(describeClaimRefusal({ reason: "abandoned" }, {})).toMatch(/échec/);
  });
});
