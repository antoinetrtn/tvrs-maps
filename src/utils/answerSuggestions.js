import { getActiveModeConfig } from "../config/gameConfig";
import { normalizeString } from "./utils";

export const MIN_SUGGEST_CHARS = 3;

function computeDisplay(mapped, key, isCapitalTarget, lang) {
  if (isCapitalTarget) {
    if (lang === "fr" && mapped.capital_fr) {
      return mapped.capital_fr;
    }
    return mapped.capital || "";
  }
  if (lang === "fr") {
    return mapped.name_fr || mapped.name_en || key;
  }
  return mapped.name_en || key;
}

function computeSubtext(mode, mapped, isCapitalTarget, lang) {
  if (mode === "departments") {
    return mapped.code || null;
  }
  if (mode === "rivers_mountains") {
    const isMountain = mapped.type === "mountain_range" || mapped.type === "mountain";
    return isMountain ? `🏔️ ${mapped.height || "?"} m` : `💧 ${mapped.length || "?"} km`;
  }
  if (isCapitalTarget) {
    return null;
  }
  if (lang === "fr" && mapped.capital_fr) {
    return mapped.capital_fr;
  }
  return mapped.capital || null;
}

function computeNormalizedAliases(mapped, isCapitalTarget) {
  if (isCapitalTarget || !Array.isArray(mapped.aliases)) {
    return [];
  }
  return mapped.aliases.map((a) => normalizeString(a)).filter(Boolean);
}

function buildIndexEntry(key, mapped, isCapitalTarget, mode, lang) {
  const display = computeDisplay(mapped, key, isCapitalTarget, lang);
  if (!display) return null;

  const subtext = computeSubtext(mode, mapped, isCapitalTarget, lang);
  const normalizedTarget = normalizeString(display);
  const targetWords = normalizedTarget ? normalizedTarget.split(" ").filter(Boolean) : [];
  const normalizedAliases = computeNormalizedAliases(mapped, isCapitalTarget);

  return {
    key,
    display,
    subtext,
    normalizedTarget,
    targetWords,
    normalizedAliases,
  };
}

/**
 * Builds a normalized index of suggestions for quick lookup during quiz modes.
 *
 * @param {Record<string, any>} countryDataMap - The dictionary of entities for the current mode.
 * @param {object} options
 * @param {string} [options.lang="fr"] - Current UI language ('fr' or 'en').
 * @param {string} [options.mode="countries"] - Current game mode.
 * @param {string} [options.learnSubMode] - Sub-mode when in learn mode.
 * @returns {Array<object>} Pre-normalized suggestion entries.
 */
export function buildSuggestionIndex(
  countryDataMap,
  { lang = "fr", mode = "countries", learnSubMode } = {}
) {
  if (!countryDataMap) return [];

  const modeConfig = getActiveModeConfig(mode, learnSubMode);
  const isCapitalTarget = modeConfig?.targetCheck === "capital";
  const index = [];

  for (const [key, mapped] of Object.entries(countryDataMap)) {
    if (!mapped) continue;
    const entry = buildIndexEntry(key, mapped, isCapitalTarget, mode, lang);
    if (entry) {
      index.push(entry);
    }
  }

  index.lang = lang;
  index.mode = mode;
  return index;
}

/**
 * Seuil de similarité (Damerau-Levenshtein normalisée) entre la saisie et le
 * nom complet (ou un alias) pour qu'une entrée apparaisse dans la liste.
 * 0.8 ≈ « 80 % du mot juste » : la liste n'apparaît qu'en fin de mot (médiane
 * 83 % du nom tapé, jamais avant 75 %), mais tolère 1 faute (≤ 9 lettres) puis
 * 2 fautes (≥ 10 lettres). Étude chiffrée dans la PR « suggestions par similarité ».
 */
const SUGGEST_SIMILARITY = 0.8;
/** Noms très courts (Iran, Oman, Cuba, Mali…) : 1 faute tolérée, mais seulement à longueur complète. */
const SHORT_TARGET_MAX = 5;

function isTransposition(a, b, i, j) {
  return i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
}

function computeDamerauRow(a, b, i, m, prev, prev2) {
  const cur = new Array(m + 1);
  cur[0] = i;
  let rowMin = cur[0];
  for (let j = 1; j <= m; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    if (prev2 && isTransposition(a, b, i, j)) {
      v = Math.min(v, prev2[j - 2] + 1);
    }
    cur[j] = v;
    if (v < rowMin) rowMin = v;
  }
  return { cur, rowMin };
}

/** Distance de Damerau-Levenshtein (transpositions adjacentes), coupée au-delà de `max`. */
export function damerauLevenshtein(a, b, max = Infinity) {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > max) return max + 1;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev2 = null;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const { cur, rowMin } = computeDamerauRow(a, b, i, m, prev, prev2);
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

/** Plus grande distance tolérée pour garder une similarité ≥ SUGGEST_SIMILARITY. */
function maxEdits(input, target) {
  return Math.floor((1 - SUGGEST_SIMILARITY) * Math.max(input.length, target.length) + 1e-9);
}

/** Distance si `target` est « assez proche » de `input`, sinon -1. */
function closeEnough(input, target) {
  if (!target) return -1;
  const short = target.length <= SHORT_TARGET_MAX && input.length >= target.length;
  const limit = Math.max(maxEdits(input, target), short ? 1 : 0);
  const d = damerauLevenshtein(input, target, limit);
  return d <= limit ? d : -1;
}

function getMatchTier(item, normalizedInput, isShort) {
  if (item.normalizedTarget === normalizedInput) {
    return 0;
  }
  if (item.normalizedAliases.includes(normalizedInput)) {
    return 1;
  }
  if (isShort) {
    return -1;
  }
  let best = -1;
  for (const target of [item.normalizedTarget, ...item.normalizedAliases]) {
    const d = closeEnough(normalizedInput, target);
    if (d >= 0 && (best === -1 || d < best)) best = d;
  }
  // tier 2 + distance : les fautes les plus légères d'abord.
  return best === -1 ? -1 : 2 + best;
}

function collectMatches(index, normalizedInput) {
  const isShort = normalizedInput.length < MIN_SUGGEST_CHARS;
  const matches = [];

  for (const item of index) {
    const tier = getMatchTier(item, normalizedInput, isShort);
    if (tier !== -1) {
      matches.push({ tier, item });
    }
  }

  return matches;
}

function isKeyFound(foundSet, key) {
  return Boolean(foundSet?.has ? foundSet.has(key) : foundSet?.includes?.(key));
}

function dedupeMatches(matches, foundSet) {
  const deduplicated = [];
  const seenIndices = new Map();

  for (const match of matches) {
    const item = match.item;
    const found = isKeyFound(foundSet, item.key);
    const existingIdx = seenIndices.get(item.normalizedTarget);

    if (existingIdx === undefined) {
      seenIndices.set(item.normalizedTarget, deduplicated.length);
      deduplicated.push({
        key: item.key,
        display: item.display,
        subtext: item.subtext,
        found,
        exact: match.tier <= 1,
      });
    } else {
      if (!found) deduplicated[existingIdx].found = false;
      if (match.tier <= 1) deduplicated[existingIdx].exact = true;
    }
  }

  return deduplicated;
}

/**
 * Returns matching suggestions for quiz play modes.
 *
 * Rules:
 * - Exact match with name/alias always shows (e.g. "UK", "Ain").
 * - Otherwise (>= 3 normalized chars) the input must be close to the FULL name or an
 *   alias: normalized Damerau-Levenshtein similarity >= SUGGEST_SIMILARITY (0.8).
 *   Short targets (<= 5 letters) also accept 1 edit once the input is full length.
 *   Typing a prefix no longer reveals the answer early (anti-triche).
 * - Sorting: exact match first, then smallest edit distance, then alphabetical.
 * - Deduplication: by normalized display string. If any duplicated key is not found, found = false.
 * - Limit: 5 items by default.
 *
 * @param {string} input - User input string.
 * @param {Array<object>} index - Pre-normalized suggestion index.
 * @param {object} options
 * @param {Set<string>|Array<string>} [options.foundSet] - Set or array of already found keys.
 * @param {number} [options.limit=5] - Maximum number of suggestions.
 * @param {string} [options.lang="fr"] - Language for alphabetical tie-breaking.
 * @returns {Array<object>} Matching suggestion items.
 */
export function getAnswerSuggestions(input, index, { foundSet, limit = 5, lang = "fr" } = {}) {
  if (!input || !index || index.length === 0) return [];

  const normalizedInput = normalizeString(input);
  if (!normalizedInput) return [];

  const matches = collectMatches(index, normalizedInput);
  if (matches.length === 0) return [];

  const langToUse = lang || index.lang || "fr";
  matches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.item.display.localeCompare(b.item.display, langToUse);
  });

  return dedupeMatches(matches, foundSet).slice(0, limit);
}

function extractLearnEntryData(entry) {
  if (Array.isArray(entry)) {
    return { adminKey: entry[0], mapped: entry[1] };
  }
  return { adminKey: entry?.key || entry?.id, mapped: entry };
}

function getLearnDisplays(mapped, adminKey, lang) {
  const nameDisplay =
    lang === "fr" ? mapped.name_fr || mapped.name_en || adminKey : mapped.name_en || adminKey;
  const capitalDisplay =
    lang === "fr" && mapped.capital_fr ? mapped.capital_fr : mapped.capital || null;
  return { nameDisplay, capitalDisplay };
}

function isEligibleLearnTarget(target, inputLength) {
  return inputLength >= 5 || target.includes(" ") || target.includes("-");
}

function createLearnSuggestion(entry, normalizedInput, rawInput, lang) {
  const { adminKey, mapped } = extractLearnEntryData(entry);
  if (!mapped) return null;

  const { nameDisplay, capitalDisplay } = getLearnDisplays(mapped, adminKey, lang);
  const normalizedNameToMatch = normalizeString(nameDisplay);
  const normalizedCapitalToMatch = capitalDisplay ? normalizeString(capitalDisplay) : null;

  const matchName = normalizedNameToMatch.includes(normalizedInput);
  const matchCap = Boolean(normalizedCapitalToMatch?.includes(normalizedInput));

  if (!matchName && !matchCap) {
    return null;
  }

  const target = matchName ? nameDisplay : capitalDisplay;
  if (!isEligibleLearnTarget(target, rawInput.length)) {
    return null;
  }

  const subtext = matchName
    ? mapped.capital_fr || mapped.capital
    : mapped.name_fr || mapped.name_en || adminKey;

  return {
    key: adminKey,
    display: target,
    subtext,
  };
}

/**
 * Historical learn mode suggestions (matching both name and capital).
 *
 * @param {string} input - Search text.
 * @param {Record<string, any>|Array<any>} countryDataMap - Entity map or index.
 * @param {object} options
 * @param {string} [options.lang="fr"] - UI language.
 * @param {number} [options.limit=5] - Result limit.
 * @returns {Array<object>}
 */
export function getLearnSuggestions(input, countryDataMap, { lang = "fr", limit = 5 } = {}) {
  if (!input || !countryDataMap || input.length < 4) return [];

  const normalizedInput = normalizeString(input);
  if (!normalizedInput) return [];

  const results = [];
  const entries = Array.isArray(countryDataMap) ? countryDataMap : Object.entries(countryDataMap);

  for (const entry of entries) {
    const suggestion = createLearnSuggestion(entry, normalizedInput, input, lang);
    if (suggestion) {
      results.push(suggestion);
      if (results.length >= limit) break;
    }
  }

  return results.slice(0, limit);
}
