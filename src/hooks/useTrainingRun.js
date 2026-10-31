import { useCallback, useState } from "react";

/**
 * Session d'entraînement ciblé : le pool (clés ordonnées du moins au plus maîtrisé) remplace la liste
 * complète du mode pour la durée d'une partie. `null` = partie normale.
 */
export function useTrainingRun({ allCountryKeys, totalPossible }) {
  const [trainingPool, setTrainingPool] = useState(null);
  const clearTraining = useCallback(() => setTrainingPool(null), []);
  return {
    trainingPool,
    setTrainingPool,
    clearTraining,
    sessionKeys: trainingPool ?? allCountryKeys,
    sessionTotal: trainingPool ? trainingPool.length : totalPossible,
  };
}
