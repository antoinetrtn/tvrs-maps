import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const board = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../multiplayer/conquestApi", () => ({ getConquestLeaderboard: board.fn }));

import ConquestLeaderboard from "../multiplayer/ConquestLeaderboard.jsx";

const row = (rank, id, elo) => ({
  rank,
  user_id: id,
  display_name: `P${id}`,
  elo,
  wins: 1,
  losses: 0,
  draws: 0,
  steals: 2,
});

describe("ConquestLeaderboard", () => {
  it("shows the top and appends the player's own rank when outside it", async () => {
    board.fn.mockResolvedValue({ top: [row(1, "a", 1100)], me: row(42, "me", 950) });
    render(<ConquestLeaderboard lang="fr" isSignedIn />);
    expect(await screen.findByText("1100")).toBeTruthy();
    expect(screen.getByText("950")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("invites guests to sign in", async () => {
    board.fn.mockResolvedValue({ top: [], me: null });
    render(<ConquestLeaderboard lang="fr" />);
    expect(await screen.findByText(/Connecte-toi/)).toBeTruthy();
  });
});
