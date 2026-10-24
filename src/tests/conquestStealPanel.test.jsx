import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ConquestStealPanel from "../multiplayer/ConquestStealPanel.jsx";
import { conquestText } from "../multiplayer/conquestText";

describe("ConquestStealPanel fortify and steal headers", () => {
  const countryName = (id) => (id === "FR" || id === "France" ? "France" : id);
  const tFr = conquestText("fr");
  const tEn = conquestText("en");

  it("renders standard steal question header when not in fortify mode", () => {
    const challengeCapital = {
      country_id: "France",
      mode: "steal",
      kind: "capital",
    };
    const { container: capContainer } = render(
      <ConquestStealPanel
        t={tFr}
        challenge={challengeCapital}
        countryName={countryName}
        onAnswer={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Capitale de France ?")).toBeTruthy();
    expect(capContainer.querySelector(".conquest-steal").classList.contains("is-fortify")).toBe(
      false
    );

    const challengeFlag = {
      country_id: "France",
      mode: "steal",
      kind: "flag",
      options: ["FR", "ES", "DE", "IT"],
    };
    render(
      <ConquestStealPanel
        t={tFr}
        challenge={challengeFlag}
        countryName={countryName}
        onAnswer={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText("Quel est le drapeau de France ?")).toBeTruthy();
  });

  it("renders fortify header text with bonus seconds and applies .is-fortify modifier", () => {
    const challenge = {
      country_id: "France",
      mode: "fortify",
      kind: "capital",
      bonus_seconds: 30,
    };
    const { container } = render(
      <ConquestStealPanel
        t={tFr}
        challenge={challenge}
        countryName={countryName}
        onAnswer={vi.fn()}
        onCancel={vi.fn()}
        myColor="var(--accent)"
      />
    );

    expect(screen.getByText("Renfort +30 s · Capitale de France ?")).toBeTruthy();
    const form = container.querySelector(".conquest-steal");
    expect(form.classList.contains("is-fortify")).toBe(true);
    expect(form.style.getPropertyValue("--my-color")).toBe("var(--accent)");
  });

  it("renders fortify flag header with +60 s bonus in French and English", () => {
    const challenge = {
      country_id: "France",
      mode: "fortify",
      kind: "flag",
      bonus_seconds: 60,
      options: ["FR", "ES", "DE", "IT"],
    };

    const { rerender } = render(
      <ConquestStealPanel
        t={tFr}
        challenge={challenge}
        countryName={countryName}
        onAnswer={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText("Renfort +60 s · Quel est le drapeau de France ?")).toBeTruthy();

    rerender(
      <ConquestStealPanel
        t={tEn}
        challenge={challenge}
        countryName={countryName}
        onAnswer={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText("Reinforcement +60 s · Which flag belongs to France ?")).toBeTruthy();
  });
});
