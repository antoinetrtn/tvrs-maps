import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import LeaderboardRow, { LeaderboardList, LeaderboardNotice } from "../components/LeaderboardRow";

describe("LeaderboardRow", () => {
  it("renders rank, name, main stat and secondary stat", () => {
    render(
      <LeaderboardList label="board">
        <LeaderboardRow
          rank={2}
          podium
          name="Alice"
          stat={180}
          meta="04:12"
          sub="V / D / N 3 / 1 / 0"
        />
      </LeaderboardList>
    );
    expect(screen.getByRole("list", { name: "board" })).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("180")).toBeTruthy();
    expect(screen.getByText("04:12")).toBeTruthy();
    expect(screen.getByText("2").className).toContain("is-podium");
  });

  it("highlights the current player's row with a tag", () => {
    const { container } = render(
      <ul>
        <LeaderboardRow rank={7} name="Me" stat={42} isMe youLabel="toi" />
      </ul>
    );
    expect(container.querySelector(".lb-row.is-me")).toBeTruthy();
    expect(screen.getByText("toi")).toBeTruthy();
  });

  it("renders LeaderboardNotice with forwarded props and content", () => {
    render(
      <LeaderboardNotice aria-label="Notice label" title="Notice tooltip">
        <span>Connecte-toi</span>
      </LeaderboardNotice>
    );
    const p = screen.getByText("Connecte-toi").closest("p");
    expect(p.className).toContain("lb-notice");
    expect(p.getAttribute("aria-label")).toBe("Notice label");
    expect(p.getAttribute("title")).toBe("Notice tooltip");
  });
});

describe("Conquest record line", () => {
  it("formats wins/losses/draws/steals compactly", async () => {
    const { formatRecord } = await import("../multiplayer/ConquestLeaderboard.jsx");
    const t = { boardRecord: "V / D / N", steals: "vols" };
    expect(formatRecord(t, { wins: 9, losses: 2, draws: 1, steals: 14 })).toBe(
      "9V · 2D · 1N · 14 vols"
    );
  });
});
