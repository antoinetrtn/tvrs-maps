import { describe, expect, it } from "vitest";

import {
  describeClaimRefusal,
  describeRpcError,
  formatShieldSeconds,
  rematchState,
  shieldCountdowns,
} from "../multiplayer/conquestLogic";

const NOW = Date.parse("2026-10-24T10:00:00Z");
const at = (s) => new Date(NOW + s * 1000).toISOString();

describe("shieldCountdowns", () => {
  const claims = [
    { country_id: "France", owner_id: "me", shield_until: at(50), fortify_level: 1 },
    { country_id: "Peru", owner_id: "opp", shield_until: at(12) },
    { country_id: "Chile", owner_id: "opp", shield_until: at(-1) },
    { country_id: "Spain", owner_id: "me", shield_until: null },
  ];

  it("keeps running shields only, soonest first, with owner side and level", () => {
    const list = shieldCountdowns(claims, "me", NOW, 0);
    expect(list.map((s) => s.id)).toEqual(["Peru", "France"]);
    expect(list[0]).toMatchObject({ mine: false, level: 0, ms: 12000 });
    expect(list[1]).toMatchObject({ mine: true, level: 1, ms: 50000 });
  });

  it("applies the server clock offset", () => {
    expect(shieldCountdowns(claims, "me", NOW, 20000).map((s) => s.id)).toEqual(["France"]);
  });
});

describe("formatShieldSeconds", () => {
  it("shows seconds below a minute and m:ss above", () => {
    expect(formatShieldSeconds(19001)).toBe("20");
    expect(formatShieldSeconds(65000)).toBe("1:05");
    expect(formatShieldSeconds(-5)).toBe("0");
  });
});

describe("rematchState", () => {
  it("offers a rematch, or joining the one already opened", () => {
    expect(rematchState({ status: "live" })).toBeNull();
    expect(rematchState({ status: "finished" })).toBe("offer");
    expect(rematchState({ status: "finished", rematch_id: "x" })).toBe("join");
  });
});

describe("fortify refusals", () => {
  const name = (id) => id;
  it("uses fortify wording when the verdict comes from a reinforcement", () => {
    expect(
      describeClaimRefusal(
        { mode: "fortify", reason: "wrong", country_id: "France" },
        { countryName: name }
      )
    ).toBe("Renfort raté sur France");
    expect(
      describeClaimRefusal(
        { mode: "fortify", reason: "max_fortified", country_id: "France" },
        { countryName: name, lang: "en" }
      )
    ).toBe("France is already fully reinforced");
  });
  it("keeps steal wording otherwise", () => {
    expect(
      describeClaimRefusal({ reason: "wrong", country_id: "France" }, { countryName: name })
    ).toContain("Vol raté");
  });
  it("explains a missing server function (migration not applied)", () => {
    expect(
      describeRpcError({ message: "Could not find the function public.conquest_rematch" })
    ).toContain("serveur");
  });
});
