const RULES = {
  fr: {
    title: "Règles de Conquête",
    subtitle: "Guide rapide du mode 1v1",
    close: "Fermer les règles",
    open: "Règles",
    sections: [
      {
        id: "match",
        title: "Match",
        text: "Salon privé 1v1 par code, même monde pour les deux ; compte à rebours de 3 s puis 10 minutes. L'horloge du serveur fait foi.",
      },
      {
        id: "capture",
        title: "Capture",
        text: "Tape le nom d'un pays LIBRE → il est à toi, +10 pts. Le premier à valider l'emporte. 3 noms inconnus d'affilée → bloqué 2 s.",
      },
      {
        id: "shield",
        title: "Bouclier",
        text: "Chaque pays capturé ou volé reçoit un bouclier de 30 s (20 s pour le leader). Un pays protégé (anneau pulsant) est involable.",
      },
      {
        id: "steal",
        title: "Vol",
        text: "Clique ou touche un pays adverse non protégé → défi de 20 s : trouve sa capitale ou son drapeau parmi 6. Succès : +15 pts (+20 si l'adversaire mène), le pays est à toi avec un nouveau bouclier.",
      },
      {
        id: "failedSteal",
        title: "Vol raté",
        text: "Vol raté (erreur, temps écoulé ou annulation) : toute action bloquée 3 s, doublé à chaque échec consécutif (3, 6, 12, 24 s max) ; un vol réussi réinitialise. Ce pays devient gris pour toi pendant 20 s (impossible de retenter). Après un vol réussi, tu ne peux plus voler ce même pays pendant 60 s.",
      },
      {
        id: "bonus",
        title: "Bonus continent",
        text: "Contrôle au moins la moitié des pays d'une région à la fin → +50 pts par région.",
      },
      {
        id: "end",
        title: "Fin de match",
        text: "Quand le chrono se termine. Classement : points (avec bonus), puis nombre de pays, puis vols ; égalité parfaite = match nul. Quitter en cours = forfait (défaite).",
      },
      {
        id: "elo",
        title: "Classement Elo",
        text: "Classé uniquement entre deux comptes inscrits (invités = non classé). Départ à 1000, K=32 (16 après 30 parties classées), nul compte demi. Quitter pendant le compte à rebours = non classé.",
      },
    ],
  },
  en: {
    title: "Conquest Rules",
    subtitle: "Quick guide to 1v1 mode",
    close: "Close rules",
    open: "Rules",
    sections: [
      {
        id: "match",
        title: "Match",
        text: "1v1 private room by code, same world for both; 3-second countdown then 10 minutes. Server clock is the reference.",
      },
      {
        id: "capture",
        title: "Capture",
        text: "Type the name of a FREE country → it's yours, +10 pts. First to submit wins it. Typing 3 unknown names in a row → blocked 2 s.",
      },
      {
        id: "shield",
        title: "Shield",
        text: "Every country you capture or steal gets a shield for 30 s (only 20 s if you're the leader). A shielded country (pulsing ring) can't be stolen.",
      },
      {
        id: "steal",
        title: "Steal",
        text: "Click/tap an opponent's country that is not shielded → 20-second challenge: guess its capital or pick its flag among 6. Success: +15 pts (+20 if your opponent is leading), country becomes yours with a new shield.",
      },
      {
        id: "failedSteal",
        title: "Failed steal",
        text: "Failed steal (wrong answer, time out or cancel): you are blocked from all actions for 3 s, doubling with each consecutive failure (3, 6, 12, 24 s max); a successful steal resets it. That country is greyed for you for 20 s (you can't retry it). After a successful steal you can't steal that same country again for 60 s.",
      },
      {
        id: "bonus",
        title: "Continent bonus",
        text: "Hold at least half the countries of a region at the end → +50 pts per region.",
      },
      {
        id: "end",
        title: "End",
        text: "When the timer ends. Ranking: points (incl. bonuses), then number of countries, then steals; fully equal = draw. Leaving during the match = forfeit (loss).",
      },
      {
        id: "elo",
        title: "Elo",
        text: "Ranked only for two registered accounts (guests = unranked match). Start at 1000, K=32 (16 after 30 ranked games), draw counts half. Leaving during the countdown = unranked.",
      },
    ],
  },
};

export function getConquestRulesText(lang) {
  return RULES[lang] || RULES.fr;
}
