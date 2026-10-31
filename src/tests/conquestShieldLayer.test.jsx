import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { getPaletteEntry } from "../multiplayer/conquestLogic";
import ConquestShieldLayer, { computeShieldBadge } from "../multiplayer/ConquestShieldLayer.jsx";

describe("computeShieldBadge model helper", () => {
  const mePlayer = { user_id: "me", color: "teal" };
  const oppPlayer = { user_id: "opp", color: "amber" };

  it("sets badge color to the owner's palette color", () => {
    const myShield = { id: "France", ownerId: "me", mine: true, ms: 25000, level: 0 };
    const oppShield = { id: "Germany", ownerId: "opp", mine: false, ms: 15000, level: 0 };

    const myBadge = computeShieldBadge(myShield, mePlayer);
    const oppBadge = computeShieldBadge(oppShield, oppPlayer);

    expect(myBadge.color).toBe(getPaletteEntry("teal").hex);
    expect(oppBadge.color).toBe(getPaletteEntry("amber").hex);
    expect(myBadge.mine).toBe(true);
    expect(oppBadge.mine).toBe(false);
  });

  it("computes pips for fortify_level 0, 1 and 2", () => {
    const lvl0 = computeShieldBadge({ id: "France", ms: 20000, level: 0 }, mePlayer);
    const lvl1 = computeShieldBadge({ id: "France", ms: 50000, level: 1 }, mePlayer);
    const lvl2 = computeShieldBadge({ id: "France", ms: 110000, level: 2 }, mePlayer);

    expect(lvl0.pips).toEqual([false, false]);
    expect(lvl1.pips).toEqual([true, false]);
    expect(lvl2.pips).toEqual([true, true]);
  });

  it("handles blink threshold strictly at 5 seconds and below", () => {
    const above = computeShieldBadge({ id: "France", ms: 5001, level: 0 }, mePlayer);
    const atEdge = computeShieldBadge({ id: "France", ms: 5000, level: 0 }, mePlayer);
    const below = computeShieldBadge({ id: "France", ms: 2500, level: 0 }, mePlayer);
    const zero = computeShieldBadge({ id: "France", ms: 0, level: 0 }, mePlayer);

    expect(above.isBlinking).toBe(false);
    expect(atEdge.isBlinking).toBe(true);
    expect(below.isBlinking).toBe(true);
    expect(zero.isBlinking).toBe(false);
  });

  it("formats countdown text in tabular seconds or m:ss", () => {
    const sec = computeShieldBadge({ id: "France", ms: 42000, level: 0 }, mePlayer);
    const min = computeShieldBadge({ id: "France", ms: 75000, level: 0 }, mePlayer);

    expect(sec.text).toBe("42");
    expect(min.text).toBe("1:15");
  });

  it("computes discrete 8-step depletion", () => {
    const full = computeShieldBadge({ id: "France", ms: 20000, level: 0 }, mePlayer);
    const half = computeShieldBadge({ id: "France", ms: 10000, level: 0 }, mePlayer);
    const empty = computeShieldBadge({ id: "France", ms: 0, level: 0 }, mePlayer);

    expect(full.step).toBe(8);
    expect(half.step).toBe(4);
    expect(empty.step).toBe(0);
  });
});

describe("ConquestShieldLayer component", () => {
  const conquest = {
    match: { status: "live" },
    claims: [
      {
        country_id: "France",
        owner_id: "me",
        fortify_level: 1,
        shield_until: new Date(Date.now() + 45000).toISOString(),
      },
      {
        country_id: "Germany",
        owner_id: "opp",
        fortify_level: 0,
        shield_until: new Date(Date.now() + 4000).toISOString(),
      },
    ],
    players: [
      { user_id: "me", color: "teal" },
      { user_id: "opp", color: "amber" },
    ],
    userId: "me",
    clockOffset: 0,
  };

  it("does not render when match status is not live", () => {
    const { container } = render(
      <ConquestShieldLayer conquest={{ ...conquest, match: { status: "lobby" } }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders shield badges with accessibility attribute aria-hidden", () => {
    const { container } = render(<ConquestShieldLayer conquest={conquest} />);
    const layer = container.querySelector(".cq-shields");
    expect(layer).toBeTruthy();
    expect(layer.getAttribute("aria-hidden")).toBe("true");

    const badges = container.querySelectorAll(".cq-shield-badge");
    expect(badges.length).toBe(2);

    const franceBadge = container.querySelector('[data-country="France"]');
    expect(franceBadge).toBeTruthy();
    expect(franceBadge.classList.contains("is-mine")).toBe(true);
    expect(franceBadge.querySelectorAll(".cq-shield-badge__pip.is-filled").length).toBe(1);

    const germanyBadge = container.querySelector('[data-country="Germany"]');
    expect(germanyBadge).toBeTruthy();
    expect(germanyBadge.classList.contains("is-enemy")).toBe(true);
    expect(germanyBadge.classList.contains("is-blinking")).toBe(true);
  });
});
