/**
 * Maîtrise des pays — logique pure (aucun accès réseau ni localStorage).
 *
 * Une « entrée » par pays et par mode : { f, m, r, t }
 *   f : nombre de fois trouvé      m : nombre de fois raté
 *   r : historique récent (au plus RECENT_WINDOW caractères, le plus récent à droite) : "1" trouvé, "0" raté
 *   t : horodatage (ms) de la dernière apparition
 *
 * Score de faiblesse `w` ∈ [0, 1] (1 = à revoir en priorité) :
 *   - taux de ratés pondéré, les parties récentes comptent davantage (décroissance RECENT_DECAY) ;
 *   - lissé par un a priori neutre (PRIOR_RATE, poids PRIOR_WEIGHT) : un pays jamais vu vaut exactement
 *     PRIOR_RATE, donc passe APRÈS les pays majoritairement ratés (> PRIOR_RATE) et AVANT les pays maîtrisés ;
 *   - petit bonus d'oubli quand le pays n'a pas été vu depuis longtemps (jusqu'à STALE_BONUS_MAX).
 */

export const COUNTRY_STATS_VERSION = 1;
export const RECENT_WINDOW = 8;
const RECENT_DECAY = 0.75;
export const PRIOR_RATE = 0.5;
const PRIOR_WEIGHT = 1;
const STALE_AFTER_DAYS = 30;
const STALE_BONUS_MAX = 0.1;
/** Nombre minimal de pays déjà vus dans un mode avant de parler de « données suffisantes ». */
export const MIN_SEEN_FOR_DATA = 10;
/** Seuil de faiblesse au-delà duquel un pays est compté « à revoir ». */
export const REVIEW_THRESHOLD = 0.55;
/** Amplitude du tirage aléatoire qui varie la sélection d'une session à l'autre. */
const POOL_JITTER = 0.04;
export const TRAINING_POOL_SIZES = [10, 20, 30];
export const DEFAULT_TRAINING_POOL_SIZE = 20;

const DAY_MS = 86_400_000;

export const emptyEntry = () => ({ f: 0, m: 0, r: "", t: 0 });

export const isEntrySeen = (entry) => Boolean(entry) && entry.f + entry.m > 0;

/** Applique une liste de résultats (true = trouvé) à une entrée, sans la muter. */
export function applyOutcomes(entry, outcomes, now = Date.now()) {
  const base = entry || emptyEntry();
  let { f, m, r } = base;
  outcomes.forEach((found) => {
    if (found) f += 1;
    else m += 1;
    r += found ? "1" : "0";
  });
  return { f, m, r: r.slice(-RECENT_WINDOW), t: outcomes.length > 0 ? now : base.t };
}

/** Score de faiblesse d'une entrée (0 = maîtrisé, 1 = toujours raté). */
export function getWeakness(entry, now = Date.now()) {
  if (!isEntrySeen(entry)) return PRIOR_RATE;
  const recent = entry.r || "";
  let missWeight = 0;
  let totalWeight = 0;
  for (let i = recent.length - 1, age = 0; i >= 0; i -= 1, age += 1) {
    const weight = RECENT_DECAY ** age;
    totalWeight += weight;
    if (recent[i] === "0") missWeight += weight;
  }
  if (totalWeight === 0) {
    // Entrée sans historique récent (ancienne version) : on retombe sur les totaux.
    missWeight = entry.m;
    totalWeight = entry.f + entry.m;
  }
  const base = (missWeight + PRIOR_RATE * PRIOR_WEIGHT) / (totalWeight + PRIOR_WEIGHT);
  const idleDays = entry.t ? Math.max(0, (now - entry.t) / DAY_MS) : 0;
  const stale = STALE_BONUS_MAX * Math.min(1, idleDays / STALE_AFTER_DAYS);
  return Math.min(1, base + stale);
}

/** Clés triées de la plus faible à la plus maîtrisée (égalités : ordre d'origine stable). */
export function rankKeys(keys, modeStats = {}, { now = Date.now(), rng = null } = {}) {
  return keys
    .map((key, index) => ({
      key,
      index,
      w: getWeakness(modeStats[key], now) + (rng ? (rng() - 0.5) * 2 * POOL_JITTER : 0),
    }))
    .sort((a, b) => b.w - a.w || a.index - b.index)
    .map((item) => item.key);
}

/**
 * Les `size` pays les moins maîtrisés. Le tirage aléatoire ne sert qu'à choisir qui entre dans le pool
 * (variété d'une session à l'autre) ; l'ordre final suit la faiblesse réelle : le plus faible d'abord.
 */
export function pickTrainingPool(keys, modeStats, size, options = {}) {
  const count = Math.max(1, Math.min(size, keys.length));
  const chosen = rankKeys(keys, modeStats, options).slice(0, count);
  return rankKeys(chosen, modeStats, { now: options.now });
}

/** Prochaine cible d'une session ciblée : premier pays non trouvé dans l'ordre du pool. */
export function nextTrainingTarget(pool, foundKeys) {
  if (!pool) return null;
  return pool.find((key) => !foundKeys.includes(key)) ?? null;
}

/** Résumé pour l'écran d'entraînement. */
export function summarizeMastery(keys, modeStats = {}, now = Date.now()) {
  let seen = 0;
  let toReview = 0;
  keys.forEach((key) => {
    const entry = modeStats[key];
    if (!isEntrySeen(entry)) return;
    seen += 1;
    if (getWeakness(entry, now) >= REVIEW_THRESHOLD) toReview += 1;
  });
  return { total: keys.length, seen, toReview, hasEnoughData: seen >= MIN_SEEN_FOR_DATA };
}

/**
 * Résultats d'une partie → { clé: [booléens] } à enregistrer.
 *  - trouvé sans erreur            → [true]
 *  - trouvé après une mauvaise réponse → [false, true] (hésitation)
 *  - vu / visé mais jamais trouvé  → [false]
 * Les pays jamais ciblés ni tentés ne sont PAS comptés comme ratés.
 */
export function buildSessionOutcomes({ found = [], seen = [], wrong = [] }) {
  const foundSet = new Set(found);
  const wrongSet = new Set(wrong);
  const result = {};
  found.forEach((key) => {
    result[key] = wrongSet.has(key) ? [false, true] : [true];
  });
  new Set([...seen, ...wrong]).forEach((key) => {
    if (!foundSet.has(key)) result[key] = [false];
  });
  return result;
}
