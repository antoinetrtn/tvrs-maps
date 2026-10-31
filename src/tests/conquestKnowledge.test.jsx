import fs from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
vi.mock("../services/supabaseClient", () => ({
  getSupabase: () =>
    Promise.resolve({
      rpc: (...args) => rpcMock(...args),
    }),
}));

import {
  ALLOWED_CATEGORIES,
  ALLOWED_ICON_PREFIXES,
  buildRegionalClientPacks,
  findBannedTemporalTerm,
  findRecentYear,
  findSharedCorrectAnswers,
  hasRecentOrTemporalReference,
  isValidIconId,
  stripQuestionForClient,
  validateCountryCategories,
  validateKnowledgeDataset,
  validateQuestion,
} from "../../scripts/lib/knowledgeRules.mjs";
import { answerKnowledge, requestKnowledgeChallenge } from "../multiplayer/conquestApi";
import ConquestStealPanel from "../multiplayer/ConquestStealPanel.jsx";
import { conquestText } from "../multiplayer/conquestText";
import ConquestKnowledgeCard from "../multiplayer/knowledge/ConquestKnowledgeCard.jsx";
import {
  getCategoryLabel,
  KNOWLEDGE_CATEGORIES,
} from "../multiplayer/knowledge/knowledgeCategories";
import { clearKnowledgePackCache, loadKnowledgePack } from "../multiplayer/knowledge/knowledgePack";
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

describe("knowledge pack builder & public/quiz/*.json", () => {
  it("strips answerIndex, stableReason, and reviewNote from client packs", () => {
    const q = makeValidQuestion({ reviewNote: "verified" });
    const stripped = stripQuestionForClient(q, "FR");
    expect(stripped).toEqual({
      id: "fr-1",
      iso: "FR",
      category: "tech",
      prompt: q.prompt,
      choices: q.choices,
    });
    expect("answerIndex" in stripped).toBe(false);
    expect("stableReason" in stripped).toBe(false);
    expect("reviewNote" in stripped).toBe(false);

    const packs = buildRegionalClientPacks(
      [
        {
          iso: "FR",
          questions: [q, makeValidQuestion({ id: "fr-draft", needsReview: true })],
        },
      ],
      { France: { iso2: "FR", region: "Europe" } }
    );
    const europePack = packs.get("europe");
    expect(europePack).toHaveLength(1);
    expect(europePack[0].id).toBe("fr-1");
    expect("answerIndex" in europePack[0]).toBe(false);
  });

  it("asserts generated public/quiz/*.json files contain no answerIndex or server metadata", () => {
    const quizDir = path.resolve(process.cwd(), "public/quiz");
    const files = fs.readdirSync(quizDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(6);

    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(quizDir, file), "utf8"));
      expect(Array.isArray(content)).toBe(true);
      for (const item of content) {
        expect(item).not.toHaveProperty("answerIndex");
        expect(item).not.toHaveProperty("stableReason");
        expect(item).not.toHaveProperty("reviewNote");
        expect(item).not.toHaveProperty("needsReview");
        expect(typeof item.id).toBe("string");
        expect(typeof item.iso).toBe("string");
        expect(typeof item.category).toBe("string");
        expect(typeof item.prompt).toBe("string");
        expect(item.choices).toHaveLength(4);
      }
    }
  });
});

describe("ConquestKnowledgeCard, PixelIcon, and knowledgePack", () => {
  const sampleChallenge = {
    country_id: "France",
    mode: "steal",
    kind: "knowledge",
    question_id: "fr-1",
    category: "nature",
    prompt: "Quel oiseau emblématique niche sur les falaises bretonnes ?",
    choices: [
      { label: "Macareux moine", iconId: "bird-puffin" },
      { label: "Autruche", iconId: "bird-ostrich" },
      { label: "Manchot empereur", iconId: "bird-penguin" },
      { label: "Condor des Andes", iconId: "bird-condor" },
    ],
    expires_at: new Date(Date.now() + 12000).toISOString(),
  };

  beforeEach(() => {
    clearKnowledgePackCache();
  });

  it("maps the 4 canonical categories in French and English with category-agnostic fallback", () => {
    expect(KNOWLEDGE_CATEGORIES.tech.fr).toBe("Tech");
    expect(getCategoryLabel("tech", "fr")).toBe("Tech");
    expect(getCategoryLabel("nature", "fr")).toBe("Faune & flore");
    expect(getCategoryLabel("musique", "fr")).toBe("Musique");
    expect(getCategoryLabel("culture", "fr")).toBe("Culture générale");
    expect(getCategoryLabel("nature", "en")).toBe("Wildlife & flora");
    expect(getCategoryLabel("astronomie", "fr")).toBe("Astronomie");
  });

  it("renders 2x2 grid with PixelIcon, category chip, timer bar, click & keyboard 1-4", () => {
    const onAnswer = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <ConquestKnowledgeCard
        challenge={sampleChallenge}
        countryName={() => "France"}
        lang="fr"
        onAnswer={onAnswer}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("Faune & flore")).toBeTruthy();
    expect(screen.getByText("France")).toBeTruthy();
    expect(screen.getByText(sampleChallenge.prompt)).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();

    const pixelIcons = container.querySelectorAll(".cq-pixel-icon");
    expect(pixelIcons).toHaveLength(4);
    expect(pixelIcons[0].getAttribute("data-family")).toBe("bird");
    expect(resolveIconFamily("tech-cpu")).toBe("tech");
    expect(resolveIconFamily("unknown-xyz")).toBe("symbol");

    // Click choice 3 (index 2)
    fireEvent.click(screen.getByText("Manchot empereur"));
    expect(onAnswer).toHaveBeenCalledWith(2);

    // Keyboard shortcuts 1-4
    fireEvent.keyDown(window, { key: "1" });
    expect(onAnswer).toHaveBeenCalledWith(0);

    fireEvent.keyDown(window, { key: "4" });
    expect(onAnswer).toHaveBeenCalledWith(3);
  });

  it("renders PixelIcon directly and memoizes regional knowledge pack fetches", async () => {
    const { container } = render(<PixelIcon iconId="music-harp" />);
    expect(container.querySelector(".cq-pixel-icon")?.getAttribute("data-family")).toBe("music");

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "fr-1" }]),
    });
    const res = await loadKnowledgePack("Europe", fakeFetch);
    expect(res).toEqual([{ id: "fr-1" }]);
    expect(fakeFetch).toHaveBeenCalledWith("/quiz/europe.json");
  });

  it("renders lazily inside ConquestStealPanel when challenge.kind === 'knowledge'", async () => {
    const onAnswer = vi.fn();
    render(
      <ConquestStealPanel
        t={conquestText("fr")}
        challenge={sampleChallenge}
        countryName={() => "France"}
        onAnswer={onAnswer}
        onCancel={vi.fn()}
        lang="fr"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(sampleChallenge.prompt)).toBeTruthy();
    });
    fireEvent.keyDown(window, { key: "2" });
    expect(onAnswer).toHaveBeenCalledWith(1);
  });
});

describe("conquestApi knowledge RPC parameters", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it("passes p_match_id and p_country_id to conquest_knowledge_challenge", async () => {
    await requestKnowledgeChallenge("match-uuid-1", "France");
    expect(rpcMock).toHaveBeenCalledWith("conquest_knowledge_challenge", {
      p_match_id: "match-uuid-1",
      p_country_id: "France",
    });
  });

  it("passes p_match_id and p_choice to conquest_answer_knowledge", async () => {
    await answerKnowledge("match-uuid-1", 2);
    expect(rpcMock).toHaveBeenCalledWith("conquest_answer_knowledge", {
      p_match_id: "match-uuid-1",
      p_choice: 2,
    });
  });
});
