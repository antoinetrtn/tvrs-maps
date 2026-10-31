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
  if (item.normalizedTarget.startsWith(normalizedInput)) {
    return 2;
  }
  if (item.targetWords.some((w) => w.startsWith(normalizedInput))) {
    return 3;
  }
  if (item.normalizedAliases.some((a) => a.startsWith(normalizedInput))) {
    return 4;
  }
  return -1;
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
 * - Minimum threshold: >= 3 normalized chars, OR exact match with name/alias (e.g. "UK", "Ain").
 * - Match conditions: target starts with input, a target word starts with input,
 *   or an alias starts with input (for name modes).
 * - Sorting: exact match first, then target prefix, then word/alias prefix, then alphabetical.
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
