import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ConquestHud from "../multiplayer/ConquestHud.jsx";

function setupHud(overrides = {}) {
  const conquest = {
    players: [
      { user_id: "me", display_name: "Alice", color: "teal", score: 30 },
      { user_id: "them", display_name: "Bob", color: "amber", score: 10 },
    ],
    claims: [
      { country_id: "fr", owner_id: "me" },
      { country_id: "es", owner_id: "me" },
      { country_id: "it", owner_id: "me" },
      { country_id: "de", owner_id: "them" },
    ],
    events: [
      {
        id: 1,
        kind: "capture",
        actor_id: "me",
        country_id: "fr",
        created_at: "2026-10-16T20:00:00Z",
      },
      {
        id: 2,
        kind: "capture",
        actor_id: "them",
        country_id: "de",
        created_at: "2026-10-16T20:01:00Z",
      },
      {
        id: 3,
        kind: "capture",
        actor_id: "me",
        country_id: "es",
        created_at: "2026-10-16T20:02:00Z",
      },
      {
        id: 4,
        kind: "capture",
        actor_id: "them",
        country_id: "gb",
        created_at: "2026-10-16T20:03:00Z",
      },
      {
        id: 5,
        kind: "capture",
        actor_id: "me",
        country_id: "it",
        created_at: "2026-10-16T20:04:00Z",
      },
      {
        id: 6,
        kind: "capture",
        actor_id: "them",
        country_id: "pl",
        created_at: "2026-10-16T20:05:00Z",
      },
    ],
    bonuses: [],
    userId: "me",
    clockOffset: 0,
    claim: vi.fn().mockResolvedValue({ ok: true, country_id: "fr" }),
    steal: vi.fn(),
    requestSteal: vi.fn(),
    cancelSteal: vi.fn(),
    ...overrides.conquest,
  };

  const props = {
    lang: "fr",
    conquest,
    phase: "live",
    clockMs: 395000,
    countryName: (id) => id,
    countryClickRef: { current: null },
    onFocusCountry: vi.fn(),
    onSelectCountry: vi.fn(),
    ...overrides,
  };

  const view = render(<ConquestHud {...props} />);
  return { ...view, conquest, props };
}

describe("ConquestHud", () => {
  it("does not render any rules button", () => {
    setupHud();
    expect(screen.queryByRole("button", { name: /règles/i })).toBeNull();
    expect(screen.queryByText(/règles/i)).toBeNull();
  });

  it("renders short score line with aria-label matching full text and without 'pts' in visible text", () => {
    setupHud();
    const scoreLine = screen.getByLabelText("30 pts, 3 pays");
    expect(scoreLine).toBeTruthy();
    expect(scoreLine.getAttribute("title")).toBe("30 pts, 3 pays");
    expect(scoreLine.textContent).not.toMatch(/pts/i);
    expect(scoreLine.textContent).toContain("30");
    expect(scoreLine.textContent).toContain("3");
  });

  it("renders at most 3 feed lines even with 6 events", () => {
    const { container } = setupHud();
    const feedLines = container.querySelectorAll(".conquest-feed li");
    expect(feedLines.length).toBeLessThanOrEqual(3);
    expect(feedLines.length).toBe(3);
  });

  it("shows '6:35' on the timer", () => {
    setupHud({ clockMs: 395000 });
    expect(screen.getByText("6:35")).toBeTruthy();
  });

  it("applies urgent class when clockMs <= 120000", () => {
    const { rerender, props } = setupHud({ clockMs: 395000 });
    const normalTimer = screen.getByText("6:35").closest(".conquest-timer");
    expect(normalTimer.classList.contains("is-urgent")).toBe(false);

    rerender(<ConquestHud {...props} clockMs={120000} />);
    const urgentTimer = screen.getByText("2:00").closest(".conquest-timer");
    expect(urgentTimer.classList.contains("is-urgent")).toBe(true);
  });

  it("submits the input and calls conquest.claim with the trimmed value", () => {
    const { conquest } = setupHud();
    const input = screen.getByPlaceholderText("Un pays libre…");
    fireEvent.change(input, { target: { value: "  France  " } });
    fireEvent.submit(input.closest("form"));
    expect(conquest.claim).toHaveBeenCalledWith("France");
  });
});
