import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import EndScreen from "../components/EndScreen";
import { countryDataMap } from "../data/gameData";

vi.mock("../components/PixelFireworks", () => ({
  default: () => <div data-testid="fireworks" />,
}));

vi.mock("../components/XpOrbsAnimation", () => ({
  default: () => <div data-testid="xp-orbs" />,
}));

describe("EndScreen with isTraining", () => {
  it("renders training end title, note, review chips with country names, and hides XP/PB", () => {
    const { container } = render(
      <EndScreen
        isTraining={true}
        trainingMode="countries"
        trainingReviewKeys={["Iceland", "Greece"]}
        foundList={["France", "Germany"]}
        totalCountries={10}
        countryDataMap={countryDataMap}
        lang="fr"
        isNewPB={true}
        xpResult={{ gainedXp: 50, oldXp: 100, oldLevel: 1 }}
        lastScores={[5, 8]}
        onRestart={vi.fn()}
        onViewTable={vi.fn()}
      />
    );

    // Title & note
    expect(screen.getByText("Entraînement terminé")).toBeTruthy();
    expect(screen.getByText("Score non enregistré")).toBeTruthy();

    // Review section & chips
    expect(screen.getByText("À revoir")).toBeTruthy();
    expect(screen.getByText("Islande")).toBeTruthy();
    expect(screen.getByText("Grèce")).toBeTruthy();

    // Score stamp remains visible
    expect(screen.getByText("2/10")).toBeTruthy();

    // PB badge is hidden
    expect(screen.queryByText("Nouveau Record !")).toBeNull();
    // XP card is hidden
    expect(screen.queryByText("+50 XP")).toBeNull();
    // Last scores history is hidden
    expect(screen.queryByText("Derniers scores")).toBeNull();

    // Continent progress bars are replaced
    expect(container.querySelector(".continents-progress-bars")).toBeNull();
  });

  it("shows all found message when review keys are empty", () => {
    render(
      <EndScreen
        isTraining={true}
        trainingMode="countries"
        trainingReviewKeys={[]}
        foundList={["France", "Germany"]}
        totalCountries={2}
        countryDataMap={countryDataMap}
        lang="fr"
        onRestart={vi.fn()}
        onViewTable={vi.fn()}
      />
    );

    expect(screen.getByText("Entraînement terminé")).toBeTruthy();
    expect(screen.getByText("Tout trouvé !")).toBeTruthy();
  });

  it("renders continent progress bars and standard title in non-training mode", () => {
    const { container } = render(
      <EndScreen
        isTraining={false}
        foundList={["France"]}
        totalCountries={10}
        countryDataMap={countryDataMap}
        lang="fr"
        isNewPB={true}
        onRestart={vi.fn()}
        onViewTable={vi.fn()}
      />
    );

    expect(screen.queryByText("Entraînement terminé")).toBeNull();
    expect(screen.queryByText("Score non enregistré")).toBeNull();
    expect(screen.getByText("Bravo !")).toBeTruthy();
    expect(screen.getByText("Nouveau Record !")).toBeTruthy();
    expect(container.querySelector(".continents-progress-bars")).toBeTruthy();
  });
});
