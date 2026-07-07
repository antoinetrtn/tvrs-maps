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
    error: "erreur !",
    settings: "Réglages",
    game_duration: "Durée de la partie",
    interface_theme: "Thème interface",
    theme_light: "Clair",
    theme_dark: "Sombre",

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
    dept_abbr: "Dpt", // Short prefix shown before a department code on its globe label
    guess_mountain_range: "Devinez cette chaîne de montagnes",
    guess_river: "Devinez ce fleuve",
    guess_country: "Devinez ce pays",
    find_capital: "Trouvez la capitale",
    unrevealed_placeholder: "???", // Tooltip for a not-yet-found entry in the results table

    // End Screen
    incredible: "Incroyable !",
    well_done: "Bravo !",
    achievement_continent_conquered: "Continent Conquis !",
    achievement_continent_desc: "Félicitations ! Tu as trouvé tous les pays de la région {region} !",
    last_scores: "Derniers scores",
    new_pb: "Nouveau Record !",
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

    // Profil & Leaderboard
    profile: "Profil",
    profile_screen_title: "Mon Profil & Classements",
    personal_records: "Records Personnels",
    global_leaderboard: "Classement",
    username: "Pseudo",
    save_profile: "Enregistrer",
    select_avatar: "Choisir un avatar",
    select_color: "Choisir une couleur",
    games_played: "Parties jouées",
    best_score: "Meilleur score",
    best_time: "Meilleur temps",
    top_explorers: "Classement Mondial",
    rank: "Rang",
    score: "Score",
    time: "Temps",
    date: "Date",
    connecting: "Connexion en cours...",
    not_connected: "Hors-ligne (Local)",
    connected: "Connecté",
    no_records_yet: "Aucun record pour le moment. Joue une partie !",
    empty_leaderboard: "Aucun score enregistré pour ce mode.",
    username_taken: "Ce pseudo est déjà pris",
    username_invalid: "Pseudo invalide (3-20 caractères alphanumériques)",
    saving: "Enregistrement...",
    profile_saved: "Profil enregistré !",
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
    error: "error!",
    settings: "Settings",
    game_duration: "Game Duration",
    interface_theme: "Interface Theme",
    theme_light: "Light",
    theme_dark: "Dark",

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
    dept_abbr: "Dept", // Short prefix shown before a department code on its globe label
    guess_mountain_range: "Guess this mountain range",
    guess_river: "Guess this river",
    guess_country: "Guess this country",
    find_capital: "Find the capital",
    unrevealed_placeholder: "???", // Tooltip for a not-yet-found entry in the results table

    // End Screen
    incredible: "Incredible !",
    well_done: "Well done!",
    achievement_continent_conquered: "Continent Conquered!",
    achievement_continent_desc: "Congratulations! You found all countries in {region}!",
    last_scores: "Last Scores",
    new_pb: "New Personal Best!",
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

    // Profile & Leaderboard
    profile: "Profile",
    profile_screen_title: "My Profile & Leaderboards",
    personal_records: "Personal Records",
    global_leaderboard: "Leaderboard",
    username: "Username",
    save_profile: "Save Profile",
    select_avatar: "Select Avatar",
    select_color: "Select Color",
    games_played: "Games played",
    best_score: "Best score",
    best_time: "Best time",
    top_explorers: "Top Explorers",
    rank: "Rank",
    score: "Score",
    time: "Time",
    date: "Date",
    connecting: "Connecting...",
    not_connected: "Offline (Local)",
    connected: "Connected",
    no_records_yet: "No records yet. Play a game!",
    empty_leaderboard: "No scores recorded for this mode.",
    username_taken: "Username is already taken",
    username_invalid: "Invalid username (3-20 alphanumeric chars)",
    saving: "Saving...",
    profile_saved: "Profile saved!",
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
