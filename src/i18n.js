import { useMemo } from 'react';

export const translations = {
  fr: {
    // Confirmation Modals
    cancel: "Annuler",
    confirm: "Confirmer",
    stop_game_confirm: "Arrêter la partie en cours ?",
    restart_game_confirm: "Recommencer une partie ?",

    // Home Screen Modes
    mode_countries: "Pays",
    mode_capitals: "Capitales",
    mode_departments: "Départements",
    mode_rivers_mountains: "Reliefs & Fleuves",
    mode_learn: "Apprendre",

    // Home Screen Controls
    minus_one_minute: "-1 minute",
    plus_one_minute: "+1 minute",
    dark_light_mode: "Mode sombre/clair",
    globe_theme: "Thème du globe",

    // Game HUD Placeholders
    search_placeholder: "Rechercher...",
    answer_placeholder: "Votre réponse...",

    // Game HUD Controls & Tooltips
    home: "Accueil",
    return_home: "Retour à l'accueil",
    information: "Informations",
    stop: "Arrêter",
    play: "Jouer",
    progress: "Progression",
    previous: "Précédent",
    next: "Suivant",
    quiz_answer: "Réponse du quiz",

    // Learn Toggles
    show_country_labels: "Afficher les labels des pays",
    labels_pays: "Labels pays",
    show_capitals: "Afficher les capitales",
    labels_capitales: "Capitales",
    show_rivers: "Afficher les rivières",
    labels_rivieres: "Rivières",
    show_mountains: "Afficher les montagnes",
    labels_montagnes: "Montagnes",

    // Focus Badge Prompts
    department_prefix: "Département {code}",
    guess_mountain_range: "Devinez cette chaîne de montagnes",
    guess_river: "Devinez ce fleuve",
    guess_country: "Devinez ce pays",
    find_capital: "Trouvez la capitale",

    // End Screen
    incredible: "Incroyable !",
    well_done: "Bravo !",
    mastered_france: "Vous maîtrisez la carte de France !",
    conquered_world: "Vous avez conquis le monde !",
    you_found: "Vous avez trouvé :",
    view_table: "Voir le tableau",
    play_again: "Rejouer",

    // Results Modal
    game_over: "Partie terminée",
    progress_title: "Progression",
    close: "Fermer",
    stop_game: "Arrêter la partie",
    continue: "Continuer",

    // Continent / Region labels
    region_Europe: "Europe",
    region_Americas: "Amériques",
    region_Asia: "Asie",
    region_Africa: "Afrique",
    region_Oceania: "Océanie",
    region_Antarctic: "Antarctique",
    region_France: "France",
    region_Unknown: "Inconnu",

    // Globe Themes
    theme_satellite: "Satellite",
    theme_blackout: "Noir & Blanc",
  },
  en: {
    // Confirmation Modals
    cancel: "Cancel",
    confirm: "Confirm",
    stop_game_confirm: "Stop the current game?",
    restart_game_confirm: "Restart game?",

    // Home Screen Modes
    mode_countries: "Countries",
    mode_capitals: "Capitals",
    mode_departments: "Departments",
    mode_rivers_mountains: "Rivers & Peaks",
    mode_learn: "Learn",

    // Home Screen Controls
    minus_one_minute: "-1 minute",
    plus_one_minute: "+1 minute",
    dark_light_mode: "Dark/light mode",
    globe_theme: "Globe theme",

    // Game HUD Placeholders
    search_placeholder: "Search...",
    answer_placeholder: "Your answer...",

    // Game HUD Controls & Tooltips
    home: "Home",
    return_home: "Return home",
    information: "Information",
    stop: "Stop",
    play: "Play",
    progress: "Progress",
    previous: "Previous",
    next: "Next",
    quiz_answer: "Quiz answer",

    // Learn Toggles
    show_country_labels: "Show country labels",
    labels_pays: "Country labels",
    show_capitals: "Show capitals",
    labels_capitales: "Capitals",
    show_rivers: "Show rivers",
    labels_rivieres: "Rivers",
    show_mountains: "Show mountains",
    labels_montagnes: "Mountains",

    // Focus Badge Prompts
    department_prefix: "Department {code}",
    guess_mountain_range: "Guess this mountain range",
    guess_river: "Guess this river",
    guess_country: "Guess this country",
    find_capital: "Find the capital",

    // End Screen
    incredible: "Incredible !",
    well_done: "Well done!",
    mastered_france: "You mastered the map of France!",
    conquered_world: "You conquered the world!",
    you_found: "You found:",
    view_table: "View Table",
    play_again: "Play Again",

    // Results Modal
    game_over: "Game over",
    progress_title: "Progress",
    close: "Close",
    stop_game: "Stop game",
    continue: "Continue",

    // Continent / Region labels
    region_Europe: "Europe",
    region_Americas: "Americas",
    region_Asia: "Asia",
    region_Africa: "Africa",
    region_Oceania: "Oceania",
    region_Antarctic: "Antarctica",
    region_France: "France",
    region_Unknown: "Unknown",

    // Globe Themes
    theme_satellite: "Satellite",
    theme_blackout: "Blacked Out",
  }
};

/**
 * A lightweight translation hook.
 * @param {string} lang Current language ('fr' or 'en')
 * @returns {Function} Translating function `t(key, params)`
 */
export const useTranslation = (lang) => {
  return useMemo(() => {
    return (key, params = {}) => {
      const activeLang = lang === 'fr' ? 'fr' : 'en';
      let text = translations[activeLang]?.[key] || translations['en']?.[key] || key;

      if (typeof text === 'string' && Object.keys(params).length > 0) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`{${k}}`, 'g'), v);
        });
      }
      return text;
    };
  }, [lang]);
};
