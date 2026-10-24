import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";
import { DEFAULT_TRAINING_POOL_SIZE, pickTrainingPool } from "../services/countryStats";

const MODE_DATA = {
  countries: countryDataMap,
  capitals: countryDataMap,
  departments: departmentsDataMap,
  rivers_mountains: riversMountainsDataMap,
  us_states: usStatesDataMap,
};

/** Clés jouables d'un mode (positionnées sur le globe ; capitales : seulement les pays qui en ont une). */
export function getTrainableKeys(mode) {
  const dataMap = MODE_DATA[mode];
  if (!dataMap) return [];
  return Object.keys(dataMap).filter(
    (key) => dataMap[key]?.lat !== undefined && (mode !== "capitals" || dataMap[key]?.capital)
  );
}

/** Pool d'entraînement (ordre : moins maîtrisés d'abord) à partir des stats d'un mode. */
export function buildTrainingPool(
  mode,
  modeStats,
  size = DEFAULT_TRAINING_POOL_SIZE,
  options = {}
) {
  return pickTrainingPool(getTrainableKeys(mode), modeStats, size, {
    rng: Math.random,
    ...options,
  });
}

/**
 * Libellé d'une clé : le nom de l'élément (c'est l'indice en mode capitales).
 * `withAnswer` ajoute la capitale (récapitulatif de fin de partie).
 */
export function getTrainingLabel(mode, key, lang = "fr", withAnswer = false) {
  const entry = MODE_DATA[mode]?.[key];
  if (!entry) return key;
  const name =
    (lang === "fr" ? entry.name_fr || entry.name_en : entry.name_en || entry.name_fr) || key;
  if (!withAnswer || mode !== "capitals") return name;
  const capital = lang === "fr" ? entry.capital_fr || entry.capital : entry.capital;
  return capital ? `${name} · ${capital}` : name;
}
