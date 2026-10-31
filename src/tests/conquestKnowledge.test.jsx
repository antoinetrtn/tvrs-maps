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
import ConquestCountryTimeline from "../multiplayer/ConquestCountryTimeline.jsx";
import {
  describeClaimRefusal,
  formatFeedEvent,
  resolveCountryClick,
} from "../multiplayer/conquestLogic";
import ConquestStealPanel from "../multiplayer/ConquestStealPanel.jsx";
import { conquestText } from "../multiplayer/conquestText";
import { getCategoryLabel } from "../multiplayer/knowledge/knowledgeCategories";
import PixelIcon, { resolveIconFamily } from "../multiplayer/knowledge/PixelIcon.jsx";

const makeValidQuestion = (overrides = {}) => ({
  id: "fr-1",
  category: "tech",
  answerType: "choice",
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
    expect(errs.some((e) => e.includes("labels uniques requis"))).toBe(true);
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

describe("per answer type schema", () => {
  const base = { ...makeValidQuestion(), choices: undefined, answerIndex: undefined };

  it("accepts each well-formed answer type", () => {
    const text = { ...base, answerType: "text", answer: "Le TGV", aliases: ["TGV"] };
    const number = {
      ...base,
      answerType: "number",
      answer: 1981,
      min: 1900,
      max: 2000,
      step: 1,
      tolerance: 3,
      unit: "",
    };
    const order = {
      ...base,
      answerType: "order",
      items: [
        { label: "Vapeur", iconId: "transport-train" },
        { label: "Diesel", iconId: "transport-train" },
        { label: "TGV", iconId: "transport-rail" },
      ],
    };
    for (const q of [text, number, order]) expect(validateQuestion(q)).toEqual([]);
    expect(
      validateQuestion({
        ...makeValidQuestion(),
        sourceUrl: "https://fr.wikipedia.org/wiki/TGV",
      })
    ).toEqual([]);
  });

  it("rejects malformed shapes", () => {
    const errs = (q) => validateQuestion(q).join(" | ");
    expect(errs({ ...base, answerType: "quiz" })).toMatch(/answerType invalide/);
    expect(errs({ ...base, answerType: "text", answer: " TGV" })).toMatch(/answer texte/);
    expect(
      errs({
        ...base,
        answerType: "number",
        answer: 5,
        min: 10,
        max: 20,
        step: 1,
        tolerance: 0,
        unit: "",
      })
    ).toMatch(/hors de/);
    expect(errs({ ...base, answerType: "number", answer: "5" })).toMatch(/numériques/);
    expect(
      errs({ ...base, answerType: "order", items: [{ label: "A", iconId: "tech-a" }] })
    ).toMatch(/3 à 5/);
    expect(errs({ ...makeValidQuestion(), sourceUrl: "https://example.com/x" })).toMatch(
      /non Wikipédia/
    );
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

describe("ConquestStealPanel: one answer component per question", () => {
  const t = conquestText("fr");
  const challenge = {
    ok: true,
    mode: "steal",
    kind: "knowledge",
    level: 4,
    answer_type: "choice",
    category: "nature",
    country_id: "Mexico",
    prompt: "Quel amphibien vit dans les canaux de Xochimilco ?",
    options: ["Le triton", "L'axolotl", "La salamandre", "Le protée"],
    icons: ["animal-frog", "animal-axolotl", "animal-lizard", "animal-eel"],
    expires_at: new Date(Date.now() + 20000).toISOString(),
  };
  const renderPanel = (overrides = {}, onAnswer = vi.fn()) => {
    render(
      <ConquestStealPanel
        t={t}
        lang="fr"
        challenge={{ ...challenge, ...overrides }}
        countryName={(id) => (id === "Mexico" ? "Mexique" : id)}
        onAnswer={onAnswer}
        onCancel={() => {}}
      />
    );
    return onAnswer;
  };
  const submit = () => fireEvent.click(screen.getByRole("button", { name: t.stealOffer }));

  it("choice grid: pick an option, send its label; only the current level shown", async () => {
    const onAnswer = renderPanel();
    expect(screen.getByText(/Niv\. 4 · Faune & flore · Mexique — Quel amphibien/)).toBeTruthy();
    expect(screen.queryByText(/Niv\. 5/)).toBeNull();
    fireEvent.click(await screen.findByRole("radio", { name: "L'axolotl" }));
    submit();
    expect(onAnswer).toHaveBeenCalledWith("L'axolotl");
  });

  it("text: typed like the capital", () => {
    const onAnswer = renderPanel({ answer_type: "text", options: [], icons: [] });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "axolotl" } });
    submit();
    expect(onAnswer).toHaveBeenCalledWith("axolotl");
  });

  it("number: slider starts at the midpoint", async () => {
    const onAnswer = renderPanel({
      answer_type: "number",
      options: [],
      min: 1900,
      max: 2000,
      step: 1,
      unit: "",
    });
    const slider = await screen.findByRole("slider");
    fireEvent.change(slider, { target: { value: "1907" } });
    submit();
    expect(onAnswer).toHaveBeenCalledWith("1907");
  });

  it("order: move items, send the JSON order", async () => {
    const onAnswer = renderPanel({
      answer_type: "order",
      options: ["B", "A", "C"],
      icons: ["tech-b", "tech-a", "tech-c"],
    });
    fireEvent.click(await screen.findByRole("button", { name: `${t.orderUp} : A` }));
    submit();
    expect(onAnswer).toHaveBeenCalledWith(JSON.stringify(["A", "B", "C"]));
  });

  it("never shows the source before answering, even if one is sent", () => {
    renderPanel({ source_url: "https://fr.wikipedia.org/wiki/Axolotl" });
    expect(screen.queryByRole("button", { name: /Wikip/ })).toBeNull();
  });

  it("keeps the capital typed", () => {
    renderPanel({ kind: "capital", level: 1, options: [] });
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("exhausted country lock + timeline", () => {
  const t = conquestText("fr");
  const players = [
    { user_id: "a", display_name: "Ana", color: "amber" },
    { user_id: "b", display_name: "Bob", color: "teal" },
  ];
  const countryName = (id) => id;

  it("a locked country opens its history instead of a challenge", () => {
    const claims = [{ country_id: "France", owner_id: "b", locked: true }];
    expect(resolveCountryClick("France", claims, "a", Date.now(), 0)).toBe("locked");
    expect(resolveCountryClick("France", claims, "b", Date.now(), 0)).toBe("locked");
    expect(describeClaimRefusal({ reason: "locked", country_id: "France" }, {})).toMatch(
      /verrouillé/
    );
    expect(
      formatFeedEvent({ kind: "lock", actor_id: "b", country_id: "France" }, { players })
    ).toBe("France reste à Bob pour de bon");
  });

  it("lists captures, steals, reinforcements and the lock", async () => {
    const events = [
      {
        id: 1,
        kind: "capture",
        actor_id: "a",
        country_id: "France",
        created_at: "2026-10-31T10:00:00Z",
      },
      {
        id: 2,
        kind: "steal",
        actor_id: "b",
        country_id: "France",
        payload: { victim: "a" },
        created_at: "2026-10-31T10:01:00Z",
      },
      {
        id: 3,
        kind: "fortify",
        actor_id: "b",
        country_id: "France",
        created_at: "2026-10-31T10:02:00Z",
      },
      {
        id: 4,
        kind: "lock",
        actor_id: "b",
        country_id: "France",
        created_at: "2026-10-31T10:03:00Z",
      },
    ];
    const load = vi.fn(async () => ({ country_id: "France", locked: true, events }));
    render(
      <ConquestCountryTimeline
        t={t}
        lang="fr"
        countryId="France"
        title="France"
        load={load}
        colorOf={() => undefined}
        describe={(event) =>
          event.kind === "fortify"
            ? `Bob ${t.timelineFortified}`
            : formatFeedEvent(event, { players, countryName })
        }
        close={null}
      />
    );
    expect(await screen.findByText("Bob a volé France à Ana")).toBeTruthy();
    expect(screen.getByText("Ana a capturé France")).toBeTruthy();
    expect(screen.getByText(`Bob ${t.timelineFortified}`)).toBeTruthy();
    expect(screen.getByText("France reste à Bob pour de bon")).toBeTruthy();
    expect(screen.getByText(/Historique · France · verrouillé/)).toBeTruthy();
    expect(load).toHaveBeenCalledWith("France");
  });
});
