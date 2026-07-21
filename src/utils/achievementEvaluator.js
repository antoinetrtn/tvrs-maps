import { CHALLENGES, ISLANDS_LIST } from "../data/challenges";

function evaluateGeneralPlay(id, totalGames, addBadge) {
  const playLimits = {
    ch_gen_play_1: 1,
    ch_gen_play_5: 5,
    ch_gen_play_10: 10,
    ch_gen_play_25: 25,
    ch_gen_play_50: 50,
  };
  if (playLimits[id] && totalGames >= playLimits[id]) {
    addBadge(id);
  }
}

function evaluateContinent(id, currentBadges, sessionData, addBadge) {
  const continentMap = {
    ch_cont_europe: "Europe",
    ch_cont_africa: "Africa",
    ch_cont_asia: "Asia",
    ch_cont_americas: "Americas",
    ch_cont_oceania: "Oceania",
  };
  if (continentMap[id] && sessionData.continentsConquered?.includes(continentMap[id])) {
    addBadge(id);
    return;
  }

  const multiMap = {
    ch_cont_europe_5: "Europe",
    ch_cont_africa_5: "Africa",
    ch_cont_asia_5: "Asia",
    ch_cont_americas_5: "Americas",
    ch_cont_oceania_5: "Oceania",
  };
  if (multiMap[id]) {
    const cont = multiMap[id];
    const count =
      currentBadges.filter((b) => b.startsWith(`conquered_${cont}_`)).length +
      (sessionData.continentsConquered?.includes(cont) ? 1 : 0);
    if (count >= 5) addBadge(id);
  }
}

function evaluateScore(id, gameMode, score, addBadge) {
  const scoreThresholds = {
    ch_score_countries_10: { mode: "countries", threshold: 10 },
    ch_score_countries_20: { mode: "countries", threshold: 20 },
    ch_score_countries_50: { mode: "countries", threshold: 50 },
    ch_score_countries_100: { mode: "countries", threshold: 100 },
    ch_score_capitals_10: { mode: "capitals", threshold: 10 },
    ch_score_capitals_20: { mode: "capitals", threshold: 20 },
    ch_score_capitals_50: { mode: "capitals", threshold: 50 },
    ch_score_capitals_100: { mode: "capitals", threshold: 100 },
    ch_score_departments_10: { mode: "departments", threshold: 10 },
    ch_score_departments_20: { mode: "departments", threshold: 20 },
    ch_score_departments_50: { mode: "departments", threshold: 50 },
    ch_score_departments_100: { mode: "departments", threshold: 100 },
    ch_relief_score_10: { mode: "rivers_mountains", threshold: 10 },
    ch_relief_score_20: { mode: "rivers_mountains", threshold: 20 },
    ch_relief_score_30: { mode: "rivers_mountains", threshold: 30 },
    ch_relief_score_40: { mode: "rivers_mountains", threshold: 40 },
    ch_score_us_states_10: { mode: "us_states", threshold: 10 },
    ch_score_us_states_20: { mode: "us_states", threshold: 20 },
    ch_score_us_states_50: { mode: "us_states", threshold: 50 },
  };

  const rule = scoreThresholds[id];
  if (rule && gameMode === rule.mode && score >= rule.threshold) {
    addBadge(id);
  }
}

function evaluateSpeed(id, sessionData, addBadge) {
  if (
    id === "ch_speed_fast_guess" &&
    sessionData.lastGuessDuration > 0 &&
    sessionData.lastGuessDuration <= 3
  ) {
    addBadge(id);
  } else if (id === "ch_speed_10_guesses_30s" && sessionData.speedGuessCount3s >= 10) {
    addBadge(id);
  } else if (id === "ch_speed_20_guesses_60s" && sessionData.speedGuessCount3s >= 20) {
    addBadge(id);
  } else if (
    id === "ch_speed_under_2m" &&
    sessionData.isGameOver &&
    sessionData.timeSpent <= 120 &&
    sessionData.score > 0
  ) {
    addBadge(id);
  } else if (
    id === "ch_speed_under_1m" &&
    sessionData.isGameOver &&
    sessionData.timeSpent <= 60 &&
    sessionData.score > 0
  ) {
    addBadge(id);
  } else if (
    id === "ch_speed_under_30s" &&
    sessionData.isGameOver &&
    sessionData.timeSpent <= 30 &&
    sessionData.score > 0
  ) {
    addBadge(id);
  } else if (
    id === "ch_speed_half_time" &&
    sessionData.isGameOver &&
    sessionData.gameDuration > 0 &&
    sessionData.timeSpent <= sessionData.gameDuration / 2 &&
    sessionData.score > 0
  ) {
    addBadge(id);
  } else if (
    id === "ch_speed_blitz" &&
    sessionData.lastGuessDuration > 0 &&
    sessionData.lastGuessDuration <= 1
  ) {
    addBadge(id);
  } else if (
    id === "ch_speed_perfect_100" &&
    sessionData.isGameOver &&
    sessionData.perfect &&
    sessionData.score >= 100 &&
    sessionData.timeSpent <= 120
  ) {
    addBadge(id);
  } else if (id === "ch_speed_lightning" && sessionData.lightningCount >= 1) {
    addBadge(id);
  }
}

function evaluateUsStatesAndSpecial(id, gameMode, sessionData, addBadge) {
  if (id === "ch_us_states_speed_under_2m") {
    if (
      gameMode === "us_states" &&
      sessionData.isGameOver &&
      sessionData.timeSpent <= 120 &&
      sessionData.score >= 50
    ) {
      addBadge(id);
    }
  } else if (id === "ch_us_states_perfect") {
    if (
      gameMode === "us_states" &&
      sessionData.isGameOver &&
      sessionData.perfect &&
      sessionData.score >= 50
    ) {
      addBadge(id);
    }
  } else if (id === "ch_special_night" && sessionData.isNight) {
    addBadge(id);
  } else if (id === "ch_special_lunch" && sessionData.isLunch) {
    addBadge(id);
  } else if (
    id === "ch_special_perfect" &&
    sessionData.isGameOver &&
    sessionData.perfect &&
    sessionData.score > 0
  ) {
    addBadge(id);
  } else if (id === "ch_special_islands") {
    const islands =
      sessionData.guessesThisGame?.filter((k) => ISLANDS_LIST.includes(k)).length || 0;
    if (islands >= 5) addBadge(id);
  }
}

export function checkChallengesRealTime(currentBadges, localRecords, sessionData) {
  const newlyUnlocked = [];
  const addBadge = (id) => {
    if (!currentBadges.includes(id) && !newlyUnlocked.includes(id)) {
      newlyUnlocked.push(id);
    }
  };

  const totalGames =
    Object.values(localRecords || {}).reduce((acc, rec) => acc + (rec.gamesPlayed || 0), 0) +
    (sessionData.isGameOver ? 1 : 0);
  const gameMode = sessionData.mode;

  CHALLENGES.forEach((ch) => {
    if (currentBadges.includes(ch.id)) return;

    evaluateGeneralPlay(ch.id, totalGames, addBadge);
    evaluateContinent(ch.id, currentBadges, sessionData, addBadge);
    evaluateScore(ch.id, gameMode, sessionData.score, addBadge);
    evaluateSpeed(ch.id, sessionData, addBadge);
    evaluateUsStatesAndSpecial(ch.id, gameMode, sessionData, addBadge);
  });

  return newlyUnlocked;
}
