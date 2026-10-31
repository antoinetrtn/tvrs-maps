/**
 * Pure validation and pack-building rules for the Conquête knowledge QCM dataset.
 */

export const ALLOWED_CATEGORIES = ["tech", "nature", "musique", "culture"];

export const ALLOWED_ICON_PREFIXES = [
  "animal",
  "bird",
  "sea",
  "plant",
  "dish",
  "drink",
  "fruit",
  "instrument",
  "landmark",
  "building",
  "sport",
  "symbol",
  "landform",
  "water",
  "weather",
  "mineral",
  "currency",
  "language",
  "person",
  "object",
  "transport",
  "number",
  "brand",
  "tech",
  "music",
];

/** Uninhabited / scientific-base territories where "culture" may be used more than once. */
const UNINHABITED_FALLBACK = new Set(["AQ", "TF", "GS", "HM", "BV", "UM", "IO"]);

const ALLOWED_CATEGORY_SET = new Set(ALLOWED_CATEGORIES);
const ALLOWED_PREFIX_SET = new Set(ALLOWED_ICON_PREFIXES);

const YEAR_4DIGIT_RE = /(?<!\d)((?:1[0-9]|20)\d{2})(?!\d)/g;
const BANNED_TEMPORAL_RE =
  /(?<![\p{L}\p{N}])(pr[eé]sident(?:e|s|es)?|premi(?:er|[eè]re)\s+ministre|(?<!l['’])actuel(?:le|s|les)?|actuellement|r[eé]cemment)(?![\p{L}\p{N}])/iu;

/** Returns the first 4-digit year >= 2011 found in `text`, or null. */
export function findRecentYear(text) {
  const str = String(text || "");
  for (const match of str.matchAll(YEAR_4DIGIT_RE)) {
    const year = Number(match[1]);
    if (year >= 2011) return year;
  }
  return null;
}

/** Returns the first forbidden temporal/political term found in `text`, or null. */
export function findBannedTemporalTerm(text) {
  const match = String(text || "").match(BANNED_TEMPORAL_RE);
  return match ? match[1] : null;
}

/** True when `text` contains a 4-digit year >= 2011 or a forbidden temporal/political word. */
export function hasRecentOrTemporalReference(text) {
  return Boolean(findRecentYear(text) !== null || findBannedTemporalTerm(text) !== null);
}

/** True when `iconId` starts with an allowed icon family prefix (`<prefix>-<slug>`). */
export function isValidIconId(iconId) {
  if (typeof iconId !== "string") return false;
  const trimmed = iconId.trim();
  if (!trimmed) return false;
  const [prefix, ...rest] = trimmed.split("-");
  return ALLOWED_PREFIX_SET.has(prefix) && rest.join("-").length > 0;
}

/**
 * Validates country-level question count and category distribution:
 * - >= 3 questions per country
 * - categories subset of {tech, nature, musique, culture}
 * - at most 1 "culture" per country unless all >=3 questions are "culture" fallback (warning, not error)
 */
export function validateCountryCategories(iso, questions = []) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(questions) || questions.length < 3) {
    errors.push(`${iso}: <3 questions (${Array.isArray(questions) ? questions.length : 0})`);
    return { errors, warnings };
  }

  let cultureCount = 0;
  for (const q of questions) {
    if (!ALLOWED_CATEGORY_SET.has(q?.category)) {
      errors.push(`${q?.id || iso}: catégorie invalide "${q?.category}"`);
    }
    if (q?.category === "culture") cultureCount += 1;
  }

  if (cultureCount > 1) {
    if (cultureCount === questions.length || UNINHABITED_FALLBACK.has(iso)) {
      warnings.push(
        `${iso}: ${cultureCount}/${questions.length} questions "culture" (fallback territoire inhabité)`
      );
    } else {
      errors.push(`${iso}: ${cultureCount} questions "culture" (max 1 sauf fallback complet)`);
    }
  }

  return { errors, warnings };
}

/** Validates a single question object (excluding country-level culture count). */
export function validateQuestion(q, seenIds = new Set(), checkCategory = true) {
  const errors = [];
  const id = typeof q?.id === "string" && q.id.trim() ? q.id.trim() : "<sans-id>";

  if (id === "<sans-id>") {
    errors.push("question sans id");
  } else if (seenIds.has(id)) {
    errors.push(`id dupliqué ${id}`);
  } else {
    seenIds.add(id);
  }

  if (checkCategory && !ALLOWED_CATEGORY_SET.has(q?.category)) {
    errors.push(`${id}: catégorie invalide "${q?.category}"`);
  }

  if (typeof q?.prompt !== "string" || !q.prompt.trim()) {
    errors.push(`${id}: prompt manquant`);
  }

  if (!Array.isArray(q?.choices) || q.choices.length !== 4) {
    errors.push(`${id}: 4 choix requis`);
  } else {
    const normalizedLabels = new Set();
    for (const choice of q.choices) {
      const label = typeof choice?.label === "string" ? choice.label.trim() : "";
      if (!label) {
        errors.push(`${id}: label de choix manquant`);
      } else {
        normalizedLabels.add(label.toLowerCase());
      }
      if (!isValidIconId(choice?.iconId)) {
        errors.push(`${id}: iconId invalide "${choice?.iconId}"`);
      }
    }
    if (normalizedLabels.size !== 4) {
      errors.push(`${id}: 4 labels de choix uniques requis`);
    }
  }

  if (!Number.isInteger(q?.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
    errors.push(`${id}: answerIndex invalide (${q?.answerIndex})`);
  }

  if (![1, 2, 3].includes(q?.difficulty)) {
    errors.push(`${id}: difficulty invalide (${q?.difficulty})`);
  }

  if (typeof q?.stableReason !== "string" || !q.stableReason.trim()) {
    errors.push(`${id}: stableReason manquant`);
  }

  if (typeof q?.needsReview !== "boolean") {
    errors.push(`${id}: needsReview booléen requis`);
  }

  const textsToScan = [
    q?.prompt,
    ...(Array.isArray(q?.choices) ? q.choices.map((c) => c?.label) : []),
  ];
  for (const text of textsToScan) {
    const year = findRecentYear(text);
    if (year !== null) {
      errors.push(`${id}: événement récent interdit (année ${year})`);
      break;
    }
  }
  for (const text of textsToScan) {
    const term = findBannedTemporalTerm(text);
    if (term !== null) {
      errors.push(`${id}: terme temporel/politique interdit ("${term}")`);
      break;
    }
  }

  return errors;
}

/** Flags identical correct-answer labels shared between >= 2 countries. */
export function findSharedCorrectAnswers(entries = []) {
  const byAnswer = new Map();
  for (const entry of entries) {
    const iso = entry?.iso;
    for (const q of entry?.questions || []) {
      const correctChoice = Array.isArray(q?.choices) ? q.choices[q.answerIndex] : null;
      const rawLabel = typeof correctChoice?.label === "string" ? correctChoice.label.trim() : "";
      if (!rawLabel || !iso) continue;
      const key = rawLabel.toLowerCase();
      if (!byAnswer.has(key)) {
        byAnswer.set(key, { label: rawLabel, isos: new Set() });
      }
      byAnswer.get(key).isos.add(iso);
    }
  }

  const warnings = [];
  for (const { label, isos } of byAnswer.values()) {
    if (isos.size >= 2) {
      warnings.push(`réponse partagée "${label}" (${[...isos].join(", ")})`);
    }
  }
  return warnings;
}

/** Full dataset validator returning the summary structure printed by validate-knowledge.mjs. */
export function validateKnowledgeDataset(entries = [], expectedIsos = []) {
  const erreurs = [];
  const warnings = [];
  const byIso = new Map();
  const seenIds = new Set();
  const parCategorie = { tech: 0, nature: 0, musique: 0, culture: 0 };
  let totalQuestions = 0;
  let needsReviewCount = 0;

  for (const entry of entries) {
    if (!entry?.iso) {
      erreurs.push("entrée pays sans code iso");
      continue;
    }
    if (byIso.has(entry.iso)) {
      erreurs.push(`${entry.iso}: pays dupliqué`);
    }
    byIso.set(entry.iso, entry);
  }

  const expectedSet = new Set(expectedIsos);
  for (const iso of expectedIsos) {
    const entry = byIso.get(iso);
    if (!entry) {
      erreurs.push(`${iso}: pays manquant`);
      continue;
    }
    const questions = Array.isArray(entry.questions) ? entry.questions : [];
    const catCheck = validateCountryCategories(iso, questions);
    erreurs.push(...catCheck.errors);
    warnings.push(...catCheck.warnings);

    for (const q of questions) {
      totalQuestions += 1;
      if (q?.category) {
        parCategorie[q.category] = (parCategorie[q.category] || 0) + 1;
      }
      if (q?.needsReview === true) needsReviewCount += 1;
      erreurs.push(...validateQuestion(q, seenIds, false));
    }
  }

  for (const iso of byIso.keys()) {
    if (!expectedSet.has(iso)) {
      erreurs.push(`${iso}: hors données du jeu`);
    }
  }

  warnings.push(...findSharedCorrectAnswers(entries));

  return {
    pays: byIso.size,
    questions: totalQuestions,
    parCategorie,
    needsReview: needsReviewCount,
    erreurs,
    warnings,
  };
}

/** Strips server-only fields (`answerIndex`, `stableReason`, `reviewNote`, `needsReview`, `difficulty`). */
export function stripQuestionForClient(question, iso) {
  return {
    id: question.id,
    iso,
    category: question.category,
    prompt: question.prompt,
    choices: (question.choices || []).map((choice) => ({
      label: choice.label,
      iconId: choice.iconId,
    })),
  };
}

/** Builds per-region client question packs (only `needsReview === false`, answers stripped). */
export function buildRegionalClientPacks(entries = [], countryDataMap = {}) {
  const isoInfo = new Map();
  for (const [countryId, data] of Object.entries(countryDataMap)) {
    if (data?.iso2) {
      isoInfo.set(data.iso2, {
        countryId,
        region: String(data.region || "world").toLowerCase(),
      });
    }
  }

  const packs = new Map();
  for (const { region } of isoInfo.values()) {
    if (!packs.has(region)) packs.set(region, []);
  }

  for (const entry of entries) {
    const info = isoInfo.get(entry?.iso);
    if (!info) continue;
    const list = packs.get(info.region) || [];
    for (const q of entry?.questions || []) {
      if (q?.needsReview !== false) continue;
      list.push(stripQuestionForClient(q, entry.iso));
    }
    packs.set(info.region, list);
  }

  return packs;
}
