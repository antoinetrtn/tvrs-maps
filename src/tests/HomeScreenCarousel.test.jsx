import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import ModeCard from "../components/HomeModeCard";
import HomeScreenCategoryCarousel from "../components/HomeScreenCategoryCarousel";

const mockModeItem = {
  key: "countries",
  titleFr: "Pays\ndu Monde",
  titleEn: "Countries\nof the World",
  descFr: "Localisez les 236 pays et territoires de la planète.",
  descEn: "Locate all 236 countries and territories across the globe.",
  badgeFr: "236",
  badgeEn: "236",
  icon: <span data-testid="mock-icon">GlobeIcon</span>,
};

const mockConquestItem = {
  key: "conquest",
  titleFr: "Conquête\n1v1",
  titleEn: "Conquest\n1v1",
  descFr: "Affrontez un adversaire en direct sur le globe.",
  descEn: "Compete live against an opponent on the globe.",
  badgeFr: "1V1",
  badgeEn: "1V1",
  icon: <span data-testid="mock-conquest-icon">ChessIcon</span>,
};

describe("HomeScreenCategoryCarousel & ModeCard", () => {
  it("DeckArrow is a real button with accessible label and calls handler", () => {
    const setHomeMode = vi.fn();
    render(
      <HomeScreenCategoryCarousel
        homeMode="countries"
        setHomeMode={setHomeMode}
        lang="fr"
        onStartGame={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: "Précédent" });
    const nextButton = screen.getByRole("button", { name: "Suivant" });

    expect(prevButton.tagName).toBe("BUTTON");
    expect(prevButton.getAttribute("type")).toBe("button");
    expect(prevButton.className).toContain("ui-icon-btn--ghost");
    expect(nextButton.tagName).toBe("BUTTON");
    expect(nextButton.getAttribute("type")).toBe("button");
    expect(nextButton.className).toContain("ui-icon-btn--ghost");

    fireEvent.click(nextButton);
    expect(setHomeMode).toHaveBeenCalled();
  });

  it("DeckArrow blurs on pointer click but retains focus on keyboard trigger", () => {
    const setHomeMode = vi.fn();
    render(
      <HomeScreenCategoryCarousel
        homeMode="countries"
        setHomeMode={setHomeMode}
        lang="fr"
        onStartGame={vi.fn()}
      />
    );

    const nextButton = screen.getByRole("button", { name: "Suivant" });
    const blurSpy = vi.spyOn(nextButton, "blur");

    // Pointer click (detail > 0)
    fireEvent.click(nextButton, { detail: 1 });
    expect(blurSpy).toHaveBeenCalledTimes(1);

    // Keyboard trigger (detail === 0)
    fireEvent.click(nextButton, { detail: 0 });
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it("DeckDots exposes aria-labels and counter text '01 / 06'", () => {
    render(
      <HomeScreenCategoryCarousel
        homeMode="countries"
        setHomeMode={vi.fn()}
        lang="fr"
        onStartGame={vi.fn()}
      />
    );

    const dots = screen.getAllByRole("button", {
      name: /Pays|Capitales|Départements|États|Reliefs/i,
    });
    expect(dots.length).toBeGreaterThanOrEqual(5);

    const counter = document.querySelector(".deck-counter");
    expect(counter).toBeTruthy();
    expect(counter.textContent).toMatch(/\d{2}\s*\/\s*\d{2}/);
  });

  it("ModeCard renders card-desc with desktop-reveal class and visible secondary button labels", () => {
    const t = (k) => {
      const map = {
        play: "Jouer",
        training_card_label: "Entraînement ciblé",
        card_train_short: "Entraîner",
        mode_learn: "Apprendre",
        card_learn_short: "Apprendre",
      };
      return map[k] || k;
    };

    render(
      <ModeCard
        modeItem={mockModeItem}
        idx={0}
        activeIndex={0}
        totalModes={5}
        animatingDirection={null}
        wasDraggingRef={{ current: false }}
        lang="fr"
        t={t}
        onStartGame={vi.fn()}
        onOpenConquest={vi.fn()}
        onOpenConquestRules={vi.fn()}
        onOpenTraining={vi.fn()}
        onSelectSideCard={vi.fn()}
      />
    );

    const desc = document.getElementById("card-desc-countries");
    expect(desc).toBeTruthy();
    expect(desc.className).toContain("card-desc");
    expect(desc.className).toContain("desktop-reveal");
    expect(desc.className).not.toContain("sr-only");

    const trainLabel = screen.getByText("Entraîner");
    expect(trainLabel.className).toContain("card-btn-label");
    expect(trainLabel.className).toContain("desktop-reveal");

    const learnLabel = screen.getByText("Apprendre");
    expect(learnLabel.className).toContain("card-btn-label");
    expect(learnLabel.className).toContain("desktop-reveal");

    expect(document.querySelector(".card-pixel-ornaments")).toBeNull();
    expect(document.querySelector(".card-plate-pattern")).not.toBeNull();
  });

  it("ModeCard in conquest mode renders rules button with desktop-reveal label", () => {
    const t = (k) => {
      const map = {
        play: "Jouer",
        mode_rules: "Règles",
        card_rules_short: "Règles",
      };
      return map[k] || k;
    };

    render(
      <ModeCard
        modeItem={mockConquestItem}
        idx={0}
        activeIndex={0}
        totalModes={5}
        animatingDirection={null}
        wasDraggingRef={{ current: false }}
        lang="fr"
        t={t}
        onStartGame={vi.fn()}
        onOpenConquest={vi.fn()}
        onOpenConquestRules={vi.fn()}
        onOpenTraining={vi.fn()}
        onSelectSideCard={vi.fn()}
      />
    );

    const rulesLabel = screen.getByText("Règles");
    expect(rulesLabel.className).toContain("card-btn-label");
    expect(rulesLabel.className).toContain("desktop-reveal");
  });

  it("navigates forward with ArrowRight / next button and backward with ArrowLeft / prev button", () => {
    const CarouselContainer = () => {
      const [mode, setMode] = useState("countries");
      return (
        <HomeScreenCategoryCarousel
          homeMode={mode}
          setHomeMode={setMode}
          lang="fr"
          onStartGame={vi.fn()}
        />
      );
    };

    vi.useFakeTimers();
    render(<CarouselContainer />);

    // ArrowRight advances to next mode (capitals)
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const topCardNext = document.querySelector(".ui-card--mode-deck.is-top-card");
    expect(topCardNext.getAttribute("data-mode")).toBe("capitals");

    // The carousel ignores input while its 200 ms change animation runs
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // ArrowLeft goes back to previous mode (countries)
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    const topCardPrev = document.querySelector(".ui-card--mode-deck.is-top-card");
    expect(topCardPrev.getAttribute("data-mode")).toBe("countries");
    vi.useRealTimers();
  });
});
