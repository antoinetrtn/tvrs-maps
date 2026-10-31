/** Section order (icons are keyed by id in ConquestRulesSheet). */
const SECTION_IDS = ["match", "capture", "shield", "steal", "failedSteal", "bonus", "end", "elo"];

/** Video beats of the rules clip, in playback order (see RulesIllustration). */
const BEAT_KEYS = ["capture", "opponent", "steal", "end"];

const illustration = (alt, [you, opponent], beats) => ({
  alt,
  you,
  opponent,
  captions: Object.fromEntries(BEAT_KEYS.map((key, i) => [key, beats[i]])),
});

const RULES = {
  fr: {
    title: "Règles de Conquête",
    subtitle: "Guide rapide du mode 1v1",
    close: "Fermer les règles",
    open: "Règles",
    illustration: illustration(
      "Extrait d'une partie de Conquête 1v1 sur le globe : tu nommes le Brésil et le captures, l'adversaire prend le Canada, tu le lui voles en trouvant son drapeau.",
      ["Toi", "Adversaire"],
      [
        "Nomme un pays libre · +10",
        "Tour adverse",
        "Vole-le : trouve le drapeau · +15",
        "Le plus de points à la fin gagne",
      ]
    ),
    sections: [
      [
        "Match",
        "Salon privé 1v1 par code, même monde pour les deux ; compte à rebours de 3 s puis 10 minutes. L'horloge du serveur fait foi.",
      ],
      [
        "Capture",
        "Tape le nom d'un pays LIBRE → il est à toi, +10 pts. Le premier à valider l'emporte. 3 noms inconnus d'affilée → bloqué 2 s.",
      ],
      [
        "Protection",
        "Capture = 20 s de bouclier (pays involable). Re-clique ton pays pour grimper l'échelle : capitale = +30 s, drapeau = +1 min, puis une question tech, faune & flore = +45 s chacune. Chaque renfort rend le vol plus dur. Un pays volé perd ses renforts.",
      ],
      [
        "Vol",
        "Clique ou touche un pays adverse non protégé → défi de 20 s : le défi dépend des renforts du pays : capitale, puis drapeau parmi 6, puis une question tech, faune & flore ou musique (4 choix). Succès : +15 pts (+20 si l'adversaire mène), le pays est à toi avec un nouveau bouclier.",
      ],
      [
        "Vol raté",
        "Vol raté (erreur, temps écoulé ou annulation) : toute action bloquée 3 s, doublé à chaque échec consécutif (3, 6, 12, 24 s max) ; un vol réussi réinitialise. Ce pays devient gris pour toi pendant 20 s (impossible de retenter). Après un vol réussi, tu ne peux plus voler ce même pays pendant 60 s.",
      ],
      [
        "Bonus continent",
        "Contrôle au moins la moitié des pays d'une région à la fin → +50 pts par région.",
      ],
      [
        "Fin de match",
        "Quand le chrono se termine. Classement : points (avec bonus), puis nombre de pays, puis vols ; égalité parfaite = match nul. Quitter en cours = forfait (défaite).",
      ],
      [
        "Classement Elo",
        "Classé uniquement entre deux comptes inscrits (invités = non classé). Départ à 1000, K=32 (16 après 30 parties classées), nul compte demi. Quitter pendant le compte à rebours = non classé.",
      ],
    ],
  },
  en: {
    title: "Conquest Rules",
    subtitle: "Quick guide to 1v1 mode",
    close: "Close rules",
    open: "Rules",
    illustration: illustration(
      "Clip of a 1v1 Conquest match on the globe: you name Brazil and capture it, your opponent takes Canada, you steal it by finding its flag.",
      ["You", "Opponent"],
      [
        "Name a free country · +10",
        "Opponent's turn",
        "Steal it: find the flag · +15",
        "Most points at the end wins",
      ]
    ),
    sections: [
      [
        "Match",
        "1v1 private room by code, same world for both; 3-second countdown then 10 minutes. Server clock is the reference.",
      ],
      [
        "Capture",
        "Type the name of a FREE country → it's yours, +10 pts. First to submit wins it. Typing 3 unknown names in a row → blocked 2 s.",
      ],
      [
        "Protection",
        "Capture = 20 s shield (country cannot be stolen). Click your country again to climb the ladder: capital = +30 s, flag = +1 min, then a tech or wildlife & flora question = +45 s each. Each reinforcement makes stealing harder. A stolen country loses its reinforcements.",
      ],
      [
        "Steal",
        "Click/tap an opponent's country that is not shielded → 20-second challenge: the challenge depends on the country's reinforcements: capital, then its flag among 6, then a tech, wildlife & flora or music question (4 choices). Success: +15 pts (+20 if your opponent is leading), country becomes yours with a new shield.",
      ],
      [
        "Failed steal",
        "Failed steal (wrong answer, time out or cancel): you are blocked from all actions for 3 s, doubling with each consecutive failure (3, 6, 12, 24 s max); a successful steal resets it. That country is greyed for you for 20 s (you can't retry it). After a successful steal you can't steal that same country again for 60 s.",
      ],
      [
        "Continent bonus",
        "Hold at least half the countries of a region at the end → +50 pts per region.",
      ],
      [
        "End",
        "When the timer ends. Ranking: points (incl. bonuses), then number of countries, then steals; fully equal = draw. Leaving during the match = forfeit (loss).",
      ],
      [
        "Elo",
        "Ranked only for two registered accounts (guests = unranked match). Start at 1000, K=32 (16 after 30 ranked games), draw counts half. Leaving during the countdown = unranked.",
      ],
    ],
  },
};

export function getConquestRulesText(lang) {
  const rules = RULES[lang] || RULES.fr;
  return {
    ...rules,
    sections: rules.sections.map(([title, text], i) => ({ id: SECTION_IDS[i], title, text })),
  };
}
