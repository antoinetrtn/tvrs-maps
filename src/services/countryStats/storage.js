/**
 * Stockage local des stats de pays : une clé localStorage versionnée par profil (invité ou connecté).
 * Garde de taille : nombre d'entrées plafonné par mode, puis par taille totale (les plus anciennes sautent).
 */
import { COUNTRY_STATS_VERSION } from "./mastery";

const STORAGE_PREFIX = "tvrs-country-stats";
export const MAX_ENTRIES_PER_MODE = 400;
export const MAX_SERIALIZED_BYTES = 150_000;

export const storageKeyFor = (profileId) =>
  `${STORAGE_PREFIX}:v${COUNTRY_STATS_VERSION}:${profileId}`;

const emptyData = () => ({ version: COUNTRY_STATS_VERSION, modes: {} });

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const f = Number.isFinite(raw.f) ? Math.max(0, Math.floor(raw.f)) : 0;
  const m = Number.isFinite(raw.m) ? Math.max(0, Math.floor(raw.m)) : 0;
  const r = typeof raw.r === "string" ? raw.r.replace(/[^01]/g, "") : "";
  const t = Number.isFinite(raw.t) ? raw.t : 0;
  return f + m > 0 ? { f, m, r, t } : null;
}

/** Lecture tolérante : JSON invalide, mauvaise version ou entrées corrompues → données vides/nettoyées. */
export function parseStats(serialized) {
  if (!serialized) return emptyData();
  try {
    const parsed = JSON.parse(serialized);
    if (!parsed || parsed.version !== COUNTRY_STATS_VERSION || typeof parsed.modes !== "object") {
      return emptyData();
    }
    const modes = {};
    Object.entries(parsed.modes || {}).forEach(([mode, entries]) => {
      if (!entries || typeof entries !== "object") return;
      const clean = {};
      Object.entries(entries).forEach(([key, raw]) => {
        const entry = sanitizeEntry(raw);
        if (entry) clean[key] = entry;
      });
      modes[mode] = clean;
    });
    return { version: COUNTRY_STATS_VERSION, modes };
  } catch {
    return emptyData();
  }
}

const byOldest = (a, b) => a[1].t - b[1].t;

/** Retire les entrées les plus anciennes pour rester sous les plafonds. */
export function pruneStats(data) {
  const modes = {};
  Object.entries(data.modes).forEach(([mode, entries]) => {
    const list = Object.entries(entries);
    const kept =
      list.length > MAX_ENTRIES_PER_MODE ? list.sort(byOldest).slice(-MAX_ENTRIES_PER_MODE) : list;
    modes[mode] = Object.fromEntries(kept);
  });
  let next = { version: data.version, modes };
  while (JSON.stringify(next).length > MAX_SERIALIZED_BYTES) {
    const all = Object.entries(next.modes).flatMap(([mode, entries]) =>
      Object.entries(entries).map(([key, entry]) => [mode, key, entry])
    );
    if (all.length === 0) break;
    const drop = Math.max(1, Math.ceil(all.length * 0.1));
    all
      .sort((a, b) => a[2].t - b[2].t)
      .slice(0, drop)
      .forEach(([mode, key]) => delete next.modes[mode][key]);
    next = { version: next.version, modes: next.modes };
  }
  return next;
}

/** Backend localStorage. Interface : load(profileId) → données, save(profileId, données), clear(profileId). */
export function createLocalCountryStatsBackend(getStorage = () => globalThis.localStorage) {
  return {
    load(profileId) {
      try {
        return parseStats(getStorage()?.getItem(storageKeyFor(profileId)));
      } catch {
        return emptyData();
      }
    },
    save(profileId, data) {
      try {
        getStorage()?.setItem(storageKeyFor(profileId), JSON.stringify(pruneStats(data)));
        return true;
      } catch {
        return false; // quota dépassé ou stockage indisponible : les stats sont un bonus, jamais bloquant
      }
    },
    clear(profileId) {
      try {
        getStorage()?.removeItem(storageKeyFor(profileId));
      } catch {
        // ignoré
      }
    },
  };
}
