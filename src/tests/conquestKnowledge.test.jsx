import fs from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ALLOWED_CATEGORIES,
  ALLOWED_ICON_PREFIXES,
  findBannedTemporalTerm,
  findRecentYear,
  findSharedCorrectAnswers,
  hasRecentOrTemporalReference,
  isValidIconId,
  validateCountryCategories,
  validateKnowledgeDataset,
  validateQuestion,
} from "../../scripts/lib/knowledgeRules.mjs";
import ConquestStealPanel from "../multiplayer/ConquestStealPanel.jsx";
import { conquestText } from "../multiplayer/conquestText";
import { getCategoryLabel } from "../multiplayer/knowledge/knowledgeCategories";
import PixelIcon, { resolveIconFamily } from "../multiplayer/knowledge/PixelIcon.jsx";

const makeValidQuestion = (overrides = {}) => ({
  id: "fr-1",
  category: "tech",
  prompt: "Quel train à grande vitesse relie Paris à Lyon depuis 1981 ?",
  choices: [
    { label: "TGV", iconId: "transport-train" },
    { label: "Shinkansen", iconId: "transport-rail" },
    { label: "ICE", iconId: "transport-locomotive" },
    { label: "AVE", iconId: "transport-metro" },
  ],
  answerIndex: 0,
  difficulty: 1,
  stableReason: "Infrastructure ferroviaire historique inaugurée en 1981",
  needsReview: false,
  ...overrides,
});

describe("knowledgeRules validator logic", () => {
  it("rejects 4-digit years >= 2011 and allows years <= 2010", () => {
    expect(findRecentYear("Inauguré en 1981 et rénové en 2010")).toBeNull();
    expect(findRecentYear("Événement survenu en 2011 à Paris")).toBe(2011);
    expect(findRecentYear("Coupe organisée en 2022")).toBe(2022);
    expect(findRecentYear("Altitude de 20150 mètres")).toBeNull();
  });

  it("rejects banned political/temporal terms in prompts and labels", () => {
    expect(findBannedTemporalTerm("Quel est le président de la République ?")).toBe("président");
    expect(findBannedTemporalTerm("Nom du Premier ministre britannique")).toMatch(
      /premier ministre/i
    );
    expect(findBannedTemporalTerm("Quel est le drapeau actuel du pays ?")).toBe("actuel");
    // « l'actuel Liban » = localisation historique, autorisée.
    expect(findBannedTemporalTerm("Cités de l'actuel Liban")).toBe(null);
    expect(findBannedTemporalTerm("Capitale actuellement habitée")).toBe("actuellement");
    expect(findBannedTemporalTerm("Récemment inscrit au patrimoine")).toMatch(/récemment/i);
    expect(findBannedTemporalTerm("Massif montagneux historique")).toBeNull();
    expect(hasRecentOrTemporalReference("Élu en 2019")).toBe(true);
    expect(hasRecentOrTemporalReference("Fondé en 1895")).toBe(false);
  });

  it("enforces category rules and uninhabited territory culture-fallback warning", () => {
    expect(ALLOWED_CATEGORIES).toEqual(["tech", "nature", "musique", "culture"]);

    // 0 or 1 culture question with valid categories -> no errors, no warnings
    const normal = validateCountryCategories("FR", [
      { category: "tech" },
      { category: "nature" },
      { category: "culture" },
    ]);
    expect(normal.errors).toEqual([]);
    expect(normal.warnings).toEqual([]);

    // All 3 culture fallback (e.g. uninhabited territory) -> warning, NOT error
    const fallback = validateCountryCategories("BV", [
      { category: "culture" },
      { category: "culture" },
      { category: "culture" },
    ]);
    expect(fallback.errors).toEqual([]);
    expect(fallback.warnings).toHaveLength(1);
    expect(fallback.warnings[0]).toContain("fallback territoire inhabité");

    // 2 culture + 1 nature -> error (more than 1 culture without full fallback)
    const tooManyCulture = validateCountryCategories("FR", [
      { category: "culture" },
      { category: "culture" },
      { category: "nature" },
    ]);
    expect(tooManyCulture.errors).toHaveLength(1);

    // Legacy/unknown category -> error
    const invalidCat = validateCountryCategories("FR", [
      { category: "science" },
      { category: "tech" },
      { category: "nature" },
    ]);
    expect(invalidCat.errors[0]).toContain('catégorie invalide "science"');
  });

  it("validates question structure, icon prefixes, and shared correct answers", () => {
    expect(ALLOWED_ICON_PREFIXES).toContain("tech");
    expect(ALLOWED_ICON_PREFIXES).toContain("music");
    expect(isValidIconId("tech-cpu")).toBe(true);
    expect(isValidIconId("unknown-icon")).toBe(false);
    expect(isValidIconId("tech")).toBe(false);

    const seenIds = new Set();
    expect(validateQuestion(makeValidQuestion(), seenIds)).toEqual([]);

    // Duplicate ID + recent year in choice + duplicate label + bad icon prefix
    const bad = makeValidQuestion({
      id: "fr-1",
      choices: [
        { label: "Depuis 2015", iconId: "tech-cpu" },
        { label: "Depuis 2015", iconId: "bad-prefix" },
        { label: "Option C", iconId: "music-note" },
        { label: "Option D", iconId: "animal-fox" },
      ],
    });
    const errs = validateQuestion(bad, seenIds);
    expect(errs.some((e) => e.includes("id dupliqué"))).toBe(true);
    expect(errs.some((e) => e.includes("4 labels de choix uniques requis"))).toBe(true);
    expect(errs.some((e) => e.includes("année 2015"))).toBe(true);
    expect(errs.some((e) => e.includes('iconId invalide "bad-prefix"'))).toBe(true);

    // Shared correct-answer warning across 2 countries
    const shared = findSharedCorrectAnswers([
      { iso: "FR", questions: [makeValidQuestion({ id: "fr-1" })] },
      { iso: "BE", questions: [makeValidQuestion({ id: "be-1" })] },
    ]);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toContain('"TGV"');

    // Dataset validation summary shape
    const datasetSummary = validateKnowledgeDataset(
      [
        {
          iso: "FR",
          name: "France",
          questions: [
            makeValidQuestion({ id: "fr-1", category: "tech" }),
            makeValidQuestion({ id: "fr-2", category: "nature" }),
            makeValidQuestion({ id: "fr-3", category: "musique" }),
          ],
        },
      ],
      ["FR"]
    );
    expect(datasetSummary.pays).toBe(1);
    expect(datasetSummary.questions).toBe(3);
    expect(datasetSummary.erreurs).toEqual([]);
  });
});

describe("knowledge ladder data stays server-side", () => {
  it("ships no public question pack with answers", () => {
    expect(fs.existsSync(path.resolve(process.cwd(), "public/quiz"))).toBe(false);
  });

  it("rejects labels padded with spaces (the server compares the label as-is)", () => {
    const q = makeValidQuestion();
    q.choices[0] = { ...q.choices[0], label: " TGV" };
    expect(validateQuestion(q).join(" ")).toMatch(/espaces/);
  });
});

describe("knowledge categories + PixelIcon", () => {
  it("labels the ladder categories, culture as fallback", () => {
    expect(getCategoryLabel("tech")).toBe("Tech");
    expect(getCategoryLabel("nature", "en")).toBe("Wildlife & flora");
    expect(getCategoryLabel("musique")).toBe("Musique");
    expect(getCategoryLabel("inconnu")).toBe("Culture générale");
  });

  it("renders a family glyph", () => {
    expect(resolveIconFamily("animal-goat")).toBe("animal");
    expect(resolveIconFamily("nope")).toBe("symbol");
    const { container } = render(<PixelIcon iconId="music-note" />);
    expect(container.querySelector(".cq-pixel-icon--music")).not.toBeNull();
  });
});

describe("ConquestStealPanel knowledge step (ladder levels 3-5)", () => {
  const t = conquestText("fr");
  const challenge = {
    ok: true,
    mode: "steal",
    kind: "knowledge",
    step: 4,
    category: "nature",
    country_id: "Mexico",
    prompt: "Quel amphibien vit dans les canaux de Xochimilco ?",
    options: ["Le triton", "L'axolotl", "La salamandre", "Le protée"],
    icons: ["animal-frog", "animal-axolotl", "animal-lizard", "animal-eel"],
    expires_at: new Date(Date.now() + 20000).toISOString(),
  };

  it("uses the same panel: pick an option, send its label", async () => {
    const onAnswer = vi.fn();
    render(
      <ConquestStealPanel
        t={t}
        lang="fr"
        challenge={challenge}
        countryName={(id) => (id === "Mexico" ? "Mexique" : id)}
        onAnswer={onAnswer}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText(/Faune & flore · Mexique — Quel amphibien/)).toBeTruthy();
    const option = await screen.findByRole("radio", { name: "L'axolotl" });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: t.stealOffer }));
    expect(onAnswer).toHaveBeenCalledWith("L'axolotl");
  });

  it("keeps the capital step as a typed answer", () => {
    render(
      <ConquestStealPanel
        t={t}
        lang="fr"
        challenge={{ ...challenge, kind: "capital", step: 1, options: [] }}
        countryName={(id) => id}
        onAnswer={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
