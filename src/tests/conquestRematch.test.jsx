import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ConquestEnd from "../multiplayer/ConquestEnd.jsx";
import { conquestText } from "../multiplayer/conquestText";

const makeConquest = (overrides = {}) => ({
  match: {
    id: "m1",
    status: "finished",
    result: { winner: "me" },
  },
  players: [
    { user_id: "me", display_name: "Antoine", color: "teal", score: 30 },
    { user_id: "opp", display_name: "Lea", color: "amber", score: 20 },
  ],
  claims: [
    { country_id: "France", owner_id: "me" },
    { country_id: "Germany", owner_id: "opp" },
  ],
  bonuses: [],
  userId: "me",
  busy: false,
  rematch: vi.fn(),
  ...overrides,
});

describe("ConquestEnd rematch flow", () => {
  it("offers rematch when no rematch lobby exists yet (rematchState === 'offer')", () => {
    const conquest = makeConquest();
    const onExit = vi.fn();
    render(<ConquestEnd lang="fr" conquest={conquest} onExit={onExit} />);

    const t = conquestText("fr");
    const rematchBtn = screen.getByRole("button", { name: t.rematch });
    expect(rematchBtn).toBeTruthy();
    expect(rematchBtn.classList.contains("ui-btn--primary")).toBe(true);

    const backBtn = screen.getByRole("button", { name: t.back });
    expect(backBtn).toBeTruthy();
    expect(backBtn.classList.contains("ui-btn--secondary")).toBe(true);

    expect(screen.getByText(t.rematchHint)).toBeTruthy();

    fireEvent.click(rematchBtn);
    expect(conquest.rematch).toHaveBeenCalledTimes(1);
  });

  it("disables rematch button while conquest is busy", () => {
    const conquest = makeConquest({ busy: true });
    render(<ConquestEnd lang="fr" conquest={conquest} onExit={vi.fn()} />);

    const t = conquestText("fr");
    const rematchBtn = screen.getByRole("button", { name: t.rematch });
    expect(rematchBtn.hasAttribute("disabled")).toBe(true);
  });

  it("shows join rematch button with opponent waiting line when rematchState === 'join'", () => {
    const conquest = makeConquest({
      match: {
        id: "m1",
        status: "finished",
        rematch_id: "rematch-lobby-99",
        result: { winner: "me" },
      },
    });
    render(<ConquestEnd lang="fr" conquest={conquest} onExit={vi.fn()} />);

    const t = conquestText("fr");
    expect(screen.getByText(`Lea ${t.rematchWaiting}`)).toBeTruthy();

    const joinBtn = screen.getByRole("button", { name: t.rematchJoin });
    expect(joinBtn).toBeTruthy();
    expect(joinBtn.classList.contains("ui-btn--primary")).toBe(true);

    fireEvent.click(joinBtn);
    expect(conquest.rematch).toHaveBeenCalledTimes(1);
  });

  it("supports English rematch wording", () => {
    const conquest = makeConquest({
      match: {
        id: "m1",
        status: "finished",
        rematch_id: "rematch-lobby-99",
        result: { winner: "me" },
      },
    });
    render(<ConquestEnd lang="en" conquest={conquest} onExit={vi.fn()} />);

    const t = conquestText("en");
    expect(screen.getByText(`Lea ${t.rematchWaiting}`)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.rematchJoin })).toBeTruthy();
  });
});
