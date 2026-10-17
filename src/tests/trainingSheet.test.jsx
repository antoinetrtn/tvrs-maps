import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TrainingSheet from "../components/TrainingSheet";
import { countryStatsService } from "../services/countryStats";
import { getTrainableKeys } from "../utils/trainingPool";

describe("TrainingSheet", () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {}
    vi.restoreAllMocks();
  });

  it("renders role=dialog with aria-labelledby and handles Escape key", () => {
    const onClose = vi.fn();
    render(
      <TrainingSheet
        open={true}
        mode="countries"
        lang="fr"
        profileId="test-profile"
        onClose={onClose}
        onStart={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("training-sheet-title");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it(
    "shows empty state message when no stats, enables Start, " +
      "limits us_states pool to <= 50 with default 20, and calls onStart then onClose",
    () => {
      const onStart = vi.fn();
      const onClose = vi.fn();

      render(
        <TrainingSheet
          open={true}
          mode="us_states"
          lang="fr"
          profileId="empty-profile"
          onClose={onClose}
          onStart={onStart}
        />
      );

      // Empty state message
      const emptyNote = screen.getByRole("note");
      expect(emptyNote.textContent).toContain("Pas assez de données pour l'instant");

      // OptionGroup for pool sizes (10, 20, 30 <= 50)
      const radio20 = screen.getByRole("radio", { name: "20" });
      expect(radio20.getAttribute("aria-checked")).toBe("true");

      const startBtn = screen.getByRole("button", { name: "Commencer" });
      expect(startBtn.disabled).toBe(false);

      fireEvent.click(startBtn);

      expect(onStart).toHaveBeenCalledTimes(1);
      const pool = onStart.mock.calls[0][0];
      expect(pool).toHaveLength(20);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  );

  it(
    "displays weakest first in À revoir chips, correct stats counts, " +
      "and sets weakest as first pool item when stats are seeded",
    () => {
      const profileId = "seeded-profile";
      const mode = "countries";

      // Seed stats with >= 10 seen items so hasEnoughData is true
      // IS has 3 misses (weakest), GR has 2 misses (next weakest)
      const outcomes = {
        France: [true],
        Germany: [true],
        Italy: [true],
        Spain: [true],
        Portugal: [true],
        Belgium: [true],
        Netherlands: [true],
        Luxembourg: [true],
        Switzerland: [true],
        Austria: [true],
        Iceland: [false, false, false],
        Greece: [false, false],
      };
      countryStatsService.recordSession(profileId, mode, outcomes);

      const onStart = vi.fn();
      const onClose = vi.fn();
      vi.spyOn(Math, "random").mockReturnValue(0.5); // pas de jitter : ordre déterministe

      render(
        <TrainingSheet
          open={true}
          mode={mode}
          lang="fr"
          profileId={profileId}
          onClose={onClose}
          onStart={onStart}
        />
      );

      const totalTrainable = getTrainableKeys(mode).length;
      // 12 seen, 2 to review (IS and GR)
      expect(screen.getByText(`${12}/${totalTrainable} vus · 2 à revoir`)).toBeTruthy();

      expect(screen.getByText("À revoir")).toBeTruthy();

      const chips = screen.getAllByText(/Islande|Grèce/);
      expect(chips).toHaveLength(2);
      // Islande (IS) was missed more, so it appears first
      expect(chips[0].textContent).toBe("Islande");
      expect(chips[1].textContent).toBe("Grèce");

      // Start button starts with weakest country first
      const startBtn = screen.getByRole("button", { name: "Commencer" });
      fireEvent.click(startBtn);

      expect(onStart).toHaveBeenCalledTimes(1);
      const pool = onStart.mock.calls[0][0];
      expect(pool[0]).toBe("Iceland");
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  );

  it("clears stats via the 2-step reset flow and returns to empty state", () => {
    const profileId = "reset-profile";
    const mode = "countries";

    countryStatsService.recordSession(profileId, mode, {
      France: [true],
      Germany: [true],
      Italy: [true],
      Spain: [true],
      Portugal: [true],
      Belgium: [true],
      Netherlands: [true],
      Luxembourg: [true],
      Switzerland: [true],
      Austria: [true],
      Iceland: [false, false],
    });

    render(
      <TrainingSheet
        open={true}
        mode={mode}
        lang="fr"
        profileId={profileId}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    );

    // Initial click on reset button
    const resetTrigger = screen.getByRole("button", { name: "Réinitialiser mes stats" });
    fireEvent.click(resetTrigger);

    // Confirm prompt appears
    expect(screen.getByText("Effacer toutes les stats ?")).toBeTruthy();
    const confirmBtn = screen.getByRole("button", { name: "Effacer" });
    fireEvent.click(confirmBtn);

    // Service cleared
    expect(countryStatsService.getModeStats(profileId, mode)).toEqual({});

    // Empty state note appears
    expect(screen.getByRole("note").textContent).toContain("Pas assez de données pour l'instant");
    expect(screen.getByRole("status").textContent).toContain("Stats effacées");
  });
});
