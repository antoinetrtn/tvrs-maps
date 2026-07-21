import { useMemo } from "react";

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
    mode_us_states: "États américains",
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
    hardcore_mode: "Mode hardcore",
    hardcore_on: "Hardcore",
    hardcore_off: "Normal",
    hardcore_desc: "5 erreurs et la partie s'arrête. Les runs hardcore sont badgés au classement.",
    hardcore_lives: "Vies restantes",
    hardcore_game_over: "Plus de vies !",
    explore_globe: "Explorer le globe",
    back_to_results: "Résultats",
    interface_theme: "Thème interface",
    theme_light: "Clair",
    theme_dark: "Sombre",
    interface_scale: "Taille de l'interface",
    scale_auto: "Auto",

    // Game HUD Placeholders
    search_placeholder: "Rechercher...",
    answer_placeholder: "Votre réponse...",
    to_guess: "À deviner !",
    preview_capital: "Capitale :",
    preview_region: "Région :",

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
    show_departments: "Afficher les départements français",
    labels_departements: "Départements",
    data_table: "Tableau des données",
    learn_mode_countries: "Pays",
    learn_mode_capitals: "Villes",
    learn_mode_rivers_mountains: "Mont. & riv.",
    learn_mode_departments: "Dépt.",
    learn_mode_us_states: "États",

    // Focus Badge Prompts
    department_prefix: "Département {code}",

    guess_mountain_range: "Devinez cette chaîne de montagnes",
    guess_river: "Devinez ce fleuve",
    guess_country: "Devinez ce pays",
    find_capital: "Trouvez la capitale",
    unrevealed_placeholder: "???", // Tooltip for a not-yet-found entry in the results table

    // End Screen
    incredible: "Incroyable !",
    well_done: "Bravo !",
    achievement_continent_conquered: "Continent Conquis !",
    achievement_continent_desc:
      "Félicitations ! Tu as trouvé tous les pays de la région {region} !",
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
    region_Reliefs: "Reliefs & Fleuves",
    region_Unknown: "Inconnu",

    // Globe Themes
    theme_satellite: "Satellite",
    theme_blackout: "Noir & Blanc",

    // Profil & Leaderboard
    profile: "Profil",
    profile_screen_title: "Mon Profil & Classements",
    personal_records: "Records Personnels",
    personal_history: "Mon Historique",
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

    // Auth & Accounts
    auth_email: "Adresse e-mail",
    auth_password: "Mot de passe",
    auth_sign_in: "Se connecter",
    auth_sign_up: "Créer un compte",
    auth_sign_out: "Se déconnecter",
    auth_google: "Continuer avec Google",
    auth_connected_as: "Connecté : {email}",
    auth_error: "Erreur d'authentification",
    auth_success: "Authentification réussie !",
    auth_no_account: "Pas encore de compte ? Créer un compte",
    auth_has_account: "Déjà un compte ? Se connecter",
    auth_switch_to_login: "Retourner à la connexion",
    auth_required: "Connecte-toi pour personnaliser ton profil et enregistrer ta progression !",
    account_created: "Compte créé ! Tu peux maintenant te connecter.",

    // Gamification
    tab_profile: "Profil",
    tab_stats: "Succès & Stats",
    level: "Niveau {level}",
    level_short: "Niv. {level}",
    xp_label: "XP : {current} / {next}",
    xp_gained: "+{xp} XP",
    level_up: "Niveau supérieur !",
    avatar_locked: "Débloqué au niveau {level}",
    stats_total_xp: "XP total",
    stats_games_played: "Total parties",
    stats_badges_unlocked: "Badges débloqués",

    // Badges
    badge_first_step_title: "Premier Pas",
    badge_first_step_desc: "Trouve au moins 1 élément géographique dans une partie.",
    badge_explorer_title: "Explorateur",
    badge_explorer_desc: "Joue au moins une fois à tous les modes de jeu quiz.",
    badge_speed_runner_title: "Bolide",
    badge_speed_runner_desc:
      "Termine une partie chronométrée avec plus de la moitié du temps restant.",
    badge_centurion_title: "Centurion",
    badge_centurion_desc: "Atteins un score de 100 points ou plus dans une seule partie.",
    badge_perfectionist_title: "Perfectionniste",
    badge_perfectionist_desc: "Trouve 100% des éléments d'un mode de jeu quiz.",
    badge_relief_master_title: "Maître des Reliefs",
    badge_relief_master_desc: "Trouve au moins 20 reliefs ou fleuves en une seule partie.",
    badge_loyal_player_title: "Pilier",
    badge_loyal_player_desc: "Joue un total de 10 parties sur TVRS Maps.",
    badge_night_owl_title: "Oiseau de Nuit",
    badge_night_owl_desc: "Termine une partie entre 22h et 4h du matin.",
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
    mode_us_states: "US States",
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
    hardcore_mode: "Hardcore mode",
    hardcore_on: "Hardcore",
    hardcore_off: "Normal",
    hardcore_desc: "5 mistakes and the run ends. Hardcore runs get a badge on the leaderboard.",
    hardcore_lives: "Lives left",
    hardcore_game_over: "Out of lives!",
    explore_globe: "Explore the globe",
    back_to_results: "Results",
    interface_theme: "Interface Theme",
    theme_light: "Light",
    theme_dark: "Dark",
    interface_scale: "Interface Scale",
    scale_auto: "Auto",

    // Game HUD Placeholders
    search_placeholder: "Search...",
    answer_placeholder: "Your answer...",
    to_guess: "To guess!",
    preview_capital: "Capital:",
    preview_region: "Region:",

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
    show_departments: "Show French departments",
    labels_departements: "Departments",
    data_table: "Data table",
    learn_mode_countries: "Countries",
    learn_mode_capitals: "Cities",
    learn_mode_rivers_mountains: "Peaks & rivers",
    learn_mode_departments: "Depts.",
    learn_mode_us_states: "States",
    labels_montagnes: "Mountains",

    // Focus Badge Prompts
    department_prefix: "Department {code}",

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
    region_Reliefs: "Rivers & Peaks",
    region_Unknown: "Unknown",

    // Globe Themes
    theme_satellite: "Satellite",
    theme_blackout: "Blacked Out",

    // Profile & Leaderboard
    profile: "Profile",
    profile_screen_title: "My Profile & Leaderboards",
    personal_records: "Personal Records",
    personal_history: "My History",
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

    // Auth & Accounts
    auth_email: "Email Address",
    auth_password: "Password",
    auth_sign_in: "Sign In",
    auth_sign_up: "Sign Up",
    auth_sign_out: "Sign Out",
    auth_google: "Continue with Google",
    auth_connected_as: "Connected: {email}",
    auth_error: "Authentication Error",
    auth_success: "Authentication Successful!",
    auth_no_account: "No account yet? Sign up",
    auth_has_account: "Already have an account? Sign in",
    auth_switch_to_login: "Back to login",
    auth_required: "Sign in to customize your profile and save your progress!",
    account_created: "Account created! You can now sign in.",

    // Gamification
    tab_profile: "Profile",
    tab_stats: "Achievements & Stats",
    level: "Level {level}",
    level_short: "Lvl. {level}",
    xp_label: "XP: {current} / {next}",
    xp_gained: "+{xp} XP",
    level_up: "Level Up!",
    avatar_locked: "Unlocked at level {level}",
    stats_total_xp: "Total XP",
    stats_games_played: "Total games",
    stats_badges_unlocked: "Badges unlocked",

    // Badges
    badge_first_step_title: "First Step",
    badge_first_step_desc: "Find at least 1 geographic item in a game.",
    badge_explorer_title: "Explorer",
    badge_explorer_desc: "Play all quiz modes at least once.",
    badge_speed_runner_title: "Speed Runner",
    badge_speed_runner_desc: "Complete a timed game with more than half of the duration remaining.",
    badge_centurion_title: "Centurion",
    badge_centurion_desc: "Score 100 points or more in a single game.",
    badge_perfectionist_title: "Perfectionist",
    badge_perfectionist_desc: "Find 100% of items in any quiz mode.",
    badge_relief_master_title: "Relief Master",
    badge_relief_master_desc: "Find at least 20 peaks or rivers in a single game.",
    badge_loyal_player_title: "Loyal Player",
    badge_loyal_player_desc: "Play 10 games in total on TVRS Maps.",
    badge_night_owl_title: "Night Owl",
    badge_night_owl_desc: "Complete a game between 10 PM and 4 AM.",
  },
};

/**
 * A lightweight translation hook.
 * @param {string} lang Current language ('fr' or 'en')
 * @returns {Function} Translating function `t(key, params)`
 */
export const useTranslation = (lang) => {
  return useMemo(() => {
    return (key, params = {}) => {
      const activeLang = lang === "fr" ? "fr" : "en";
      let text = translations[activeLang]?.[key] || translations["en"]?.[key] || key;

      if (typeof text === "string" && Object.keys(params).length > 0) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`{${k}}`, "g"), v);
        });
      }
      return text;
    };
  }, [lang]);
};
