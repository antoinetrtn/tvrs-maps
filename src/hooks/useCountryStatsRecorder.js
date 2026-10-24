import { useEffect, useRef } from "react";

import { buildSessionOutcomes, countryStatsService } from "../services/countryStats";

/**
 * Enregistre trouvé/raté par pays à la fin d'une partie solo (jamais en Apprendre).
 *  - vus  : pays ciblés (sélectionnés) pendant la partie ;
 *  - ratés : mauvaise réponse sur la cible (popupError avec une cible).
 * Un pays jamais ciblé ni tenté n'est pas compté comme raté. Écriture locale uniquement.
 */
export function useCountryStatsRecorder({
  mode,
  profileId,
  currentScreen,
  selectedCountry,
  foundList,
  isPlaying,
  isGameOver,
  popupError,
}) {
  const seenRef = useRef(new Set());
  const wrongRef = useRef(new Set());
  const playedRef = useRef(false);
  const recordedRef = useRef(false);
  const inGame = currentScreen === "game" && mode !== "learn";

  useEffect(() => {
    if (inGame) return;
    // Retour à l'accueil ou mode Apprendre : on oublie la partie précédente.
    seenRef.current = new Set();
    wrongRef.current = new Set();
    playedRef.current = false;
    recordedRef.current = false;
  }, [inGame]);

  useEffect(() => {
    if (!inGame) return;
    if (isPlaying) playedRef.current = true;
    if (!isGameOver && selectedCountry) seenRef.current.add(selectedCountry);
  }, [inGame, isPlaying, isGameOver, selectedCountry]);

  useEffect(() => {
    if (inGame && popupError && selectedCountry && !isGameOver) {
      wrongRef.current.add(selectedCountry);
    }
  }, [inGame, popupError, selectedCountry, isGameOver]);

  useEffect(() => {
    if (!inGame) return;
    if (!isGameOver) {
      // Nouvelle partie : on repart de zéro (resetGame repasse isGameOver à false).
      if (recordedRef.current) {
        seenRef.current = new Set();
        wrongRef.current = new Set();
        playedRef.current = false;
        recordedRef.current = false;
      }
      return;
    }
    if (recordedRef.current || !playedRef.current) return;
    recordedRef.current = true;
    const outcomes = buildSessionOutcomes({
      found: foundList,
      seen: [...seenRef.current],
      wrong: [...wrongRef.current],
    });
    countryStatsService.recordSession(profileId, mode, outcomes);
  }, [inGame, isGameOver, foundList, mode, profileId]);
}
