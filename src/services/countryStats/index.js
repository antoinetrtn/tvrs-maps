/**
 * Service de stats de pays (trouvé / raté par profil, par pays, par mode).
 *
 * Le reste de l'app ne parle qu'à ce service. Le backend (load/save/clear) est interchangeable :
 * aujourd'hui localStorage ; un backend Supabase pourra être branché via `countryStatsService.setBackend`
 * (hydratation asynchrone + écriture différée) sans toucher aux appelants. Voir la PR, « Suite possible ».
 */
import { applyOutcomes } from "./mastery";
import { createLocalCountryStatsBackend } from "./storage";

export * from "./mastery";

export function createCountryStatsService(initialBackend) {
  let backend = initialBackend;
  return {
    setBackend(next) {
      backend = next;
    },
    /** Entrées d'un mode : { clé: { f, m, r, t } }. */
    getModeStats(profileId, mode) {
      if (!profileId) return {};
      return backend.load(profileId).modes[mode] || {};
    },
    /** Enregistre { clé: [booléens] } pour un mode. Renvoie false si l'écriture a échoué. */
    recordSession(profileId, mode, outcomesByKey, now = Date.now()) {
      if (!profileId || !mode || !outcomesByKey) return false;
      const keys = Object.keys(outcomesByKey);
      if (keys.length === 0) return false;
      const data = backend.load(profileId);
      const current = data.modes[mode] || {};
      const next = { ...current };
      keys.forEach((key) => {
        next[key] = applyOutcomes(current[key], outcomesByKey[key], now);
      });
      return backend.save(profileId, { ...data, modes: { ...data.modes, [mode]: next } });
    },
    reset(profileId) {
      if (profileId) backend.clear(profileId);
    },
  };
}

export const countryStatsService = createCountryStatsService(createLocalCountryStatsBackend());
