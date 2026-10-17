import { getActiveModeConfig } from "../config/gameConfig";
import { normalizeString } from "./utils";

export const MIN_SUGGEST_CHARS = 3;

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

    const nameDisplay =
      lang === "fr" ? mapped.name_fr || mapped.name_en || key : mapped.name_en || key;
    const capitalDisplay =
      lang === "fr" && mapped.capital_fr ? mapped.capital_fr : mapped.capital || "";
    const display = isCapitalTarget ? capitalDisplay : nameDisplay;

    if (!display) continue;

    let subtext = null;
    if (mode === "departments") {
      subtext = mapped.code || null;
    } else if (mode === "rivers_mountains") {
      const isMountain = mapped.type === "mountain_range" || mapped.type === "mountain";
      subtext = isMountain ? `🏔️ ${mapped.height || "?"} m` : `💧 ${mapped.length || "?"} km`;
    } else if (isCapitalTarget) {
      subtext = null;
    } else {
      subtext = lang === "fr" && mapped.capital_fr ? mapped.capital_fr : mapped.capital || null;
    }

    const normalizedTarget = normalizeString(display);
    const targetWords = normalizedTarget ? normalizedTarget.split(" ").filter(Boolean) : [];

    let normalizedAliases = [];
    if (!isCapitalTarget && Array.isArray(mapped.aliases)) {
      normalizedAliases = mapped.aliases.map((a) => normalizeString(a)).filter(Boolean);
    }

    index.push({
      key,
      display,
      subtext,
      normalizedTarget,
      targetWords,
      normalizedAliases,
    });
  }

  index.lang = lang;
  index.mode = mode;
  return index;
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

  const isShort = normalizedInput.length < MIN_SUGGEST_CHARS;
  const langToUse = lang || index.lang || "fr";
  const matches = [];

  for (const item of index) {
    let tier = -1;

    if (item.normalizedTarget === normalizedInput) {
      tier = 0;
    } else if (item.normalizedAliases.includes(normalizedInput)) {
      tier = 1;
    } else if (!isShort) {
      if (item.normalizedTarget.startsWith(normalizedInput)) {
        tier = 2;
      } else if (item.targetWords.some((w) => w.startsWith(normalizedInput))) {
        tier = 3;
      } else if (item.normalizedAliases.some((a) => a.startsWith(normalizedInput))) {
        tier = 4;
      }
    }

    if (tier !== -1) {
      matches.push({ tier, item });
    }
  }

  if (matches.length === 0) return [];

  matches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.item.display.localeCompare(b.item.display, langToUse);
  });

  const isKeyFound = (key) =>
    Boolean(foundSet && (foundSet.has ? foundSet.has(key) : foundSet.includes(key)));

  const deduplicated = [];
  const seenIndices = new Map();

  for (const match of matches) {
    const item = match.item;
    const found = isKeyFound(item.key);
    const existingIdx = seenIndices.get(item.normalizedTarget);

    if (existingIdx === undefined) {
      seenIndices.set(item.normalizedTarget, deduplicated.length);
      deduplicated.push({
        key: item.key,
        display: item.display,
        subtext: item.subtext,
        found,
      });
    } else if (!found) {
      deduplicated[existingIdx].found = false;
    }
  }

  return deduplicated.slice(0, limit);
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
    let adminKey;
    let mapped;
    if (Array.isArray(entry)) {
      [adminKey, mapped] = entry;
    } else {
      mapped = entry;
      adminKey = entry.key || entry.id;
    }
    if (!mapped) continue;

    const nameDisplay =
      lang === "fr" ? mapped.name_fr || mapped.name_en || adminKey : mapped.name_en || adminKey;
    const capitalDisplay =
      lang === "fr" && mapped.capital_fr ? mapped.capital_fr : mapped.capital || null;

    const normalizedNameToMatch = normalizeString(nameDisplay);
    const normalizedCapitalToMatch = capitalDisplay ? normalizeString(capitalDisplay) : "";

    const matchName = normalizedNameToMatch.includes(normalizedInput);
    const matchCap = Boolean(
      normalizedCapitalToMatch && normalizedCapitalToMatch.includes(normalizedInput)
    );

    if (matchName || matchCap) {
      const target = matchName ? nameDisplay : capitalDisplay;
      if (input.length >= 5 || target.includes(" ") || target.includes("-")) {
        results.push({
          key: adminKey,
          display: target,
          subtext: matchName
            ? mapped.capital_fr || mapped.capital
            : mapped.name_fr || mapped.name_en || adminKey,
        });
      }
    }
    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}
