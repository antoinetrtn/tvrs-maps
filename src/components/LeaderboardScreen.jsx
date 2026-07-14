import "./LeaderboardScreen.css";

import { Close, Globe, Hash, MapPin, TreePine } from "pixelarticons/react";
import React, { useEffect, useRef, useState } from "react";

import { useTranslation } from "../config/i18n";
import { getLeaderboard, getUserHistory, isSupabaseConfigured } from "../services/supabaseClient";
import { formatTime } from "../utils/utils";
import InvaderAvatar from "./InvaderAvatar";
import SegmentedControl from "./SegmentedControl";

const MODE_ICONS = {
  countries: <Globe width={16} height={16} />,
  capitals: <MapPin width={16} height={16} />,
  departments: <Hash width={14} height={14} />,
  rivers_mountains: <TreePine width={16} height={16} />,
};

const formatDate = (isoString) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} ${hours}:${minutes}`;
  } catch {
    return "";
  }
};

const LeaderboardScreen = ({
  userProfile,
  localRecords = {},
  onBack,
  lang = "fr",
  theme = "dark",
  isOpen = false,
}) => {
  const t = useTranslation(lang);
  const [colMode, setColMode] = useState("countries");
  const [activeTab, setActiveTab] = useState("global"); // "global" or "personal"

  // Global leaderboard state
  const [scoresData, setScoresData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Personal history state
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Lightweight client cache (perf + reduce Supabase calls on tab switches)
  const fetchCacheRef = useRef({});
  const CACHE_TTL_MS = 30000;

  const getCacheKey = (type, mode) => `${type}:${mode}`;

  const getCached = (key) => {
    const entry = fetchCacheRef.current[key];
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
    return null;
  };

  const setCached = (key, data) => {
    fetchCacheRef.current[key] = { data, ts: Date.now() };
  };

  // Fetch Global Leaderboard
  useEffect(() => {
    let isMounted = true;

    const fetchScores = async () => {
      if (!isSupabaseConfigured) {
        setError(t("not_connected"));
        return;
      }
      const key = getCacheKey("global", colMode);
      const cached = getCached(key);
      if (cached) {
        setScoresData(cached);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await getLeaderboard(colMode);

        if (!isMounted) return;

        if (fetchErr) {
          setError(fetchErr);
        } else {
          const result = data || [];
          setScoresData(result);
          setCached(key, result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Erreur de chargement");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (isOpen && activeTab === "global") {
      fetchScores();
    }

    return () => {
      isMounted = false;
    };
  }, [colMode, userProfile, isOpen, activeTab, t]);

  // Fetch Personal History
  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      if (!isSupabaseConfigured || !userProfile?.id) {
        return;
      }
      const key = getCacheKey("personal", colMode);
      const cached = getCached(key);
      if (cached) {
        setHistoryData(cached);
        return;
      }
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const { data, error: fetchErr } = await getUserHistory(userProfile.id, colMode);

        if (!isMounted) return;

        if (fetchErr) {
          setHistoryError(fetchErr);
        } else {
          const result = data || [];
          setHistoryData(result);
          setCached(key, result);
        }
      } catch (err) {
        if (isMounted) {
          setHistoryError(err.message || "Erreur de chargement");
        }
      } finally {
        if (isMounted) {
          setHistoryLoading(false);
        }
      }
    };

    if (isOpen && activeTab === "personal") {
      fetchHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [colMode, userProfile?.id, isOpen, activeTab]);

  const currentRecord = localRecords?.[colMode] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };

  const renderEvolutionChart = () => {
    if (!isSupabaseConfigured || historyData.length === 0) return null;

    // Get last 10 games in chronological order (oldest to newest for the chart)
    const recentGames = [...historyData].slice(0, 10).reverse();
    const maxScoreVal = Math.max(...recentGames.map((g) => g.score), 1);

    return (
      <div className="evolution-chart-container glass-panel">
        <span className="chart-title text-natural-case">
          {lang === "fr"
            ? "Évolution des scores (10 dernières)"
            : "Score Evolution (Last 10 games)"}
        </span>
        <div className="evolution-chart">
          {recentGames.map((game, idx) => {
            const pct = (game.score / maxScoreVal) * 100;
            return (
              <div key={game.id || idx} className="chart-bar-wrapper">
                <div className="chart-bar-tooltip">
                  <span className="tooltip-score">{game.score} pts</span>
                  <span className="tooltip-time">{formatTime(game.time_spent_seconds)}</span>
                  <span className="tooltip-date">{formatDate(game.created_at)}</span>
                </div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ height: `${Math.max(8, pct)}%` }} />
                </div>
                <span className="chart-bar-label">#{recentGames.length - idx}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHistoryContent = () => {
    if (!isSupabaseConfigured) {
      return (
        <div className="leaderboard-empty-state">
          <p>{t("not_connected")}</p>
          <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "8px" }}>
            {lang === "fr"
              ? "Connectez-vous pour voir l'historique complet de vos parties."
              : "Sign in to see your complete game history."}
          </p>
        </div>
      );
    }

    if (historyLoading) {
      return (
        <div className="leaderboard-loading-state">
          <div className="pixel-spinner" />
          <p>{t("connecting")}</p>
        </div>
      );
    }

    if (historyError) {
      return (
        <div className="leaderboard-error-state">
          <p>Erreur: {historyError}</p>
        </div>
      );
    }

    if (historyData.length === 0) {
      return (
        <div className="leaderboard-empty-state">
          <p>{t("no_records_yet")}</p>
        </div>
      );
    }

    return (
      <div className="personal-history-layout">
        {renderEvolutionChart()}

        <div className="leaderboard-table-container scrollbar-styled">
          <table className="leaderboard-table personal-history-table">
            <thead>
              <tr>
                <th className="col-date">{t("date")}</th>
                <th className="col-score">{t("score")}</th>
                <th className="col-time">{t("time")}</th>
                <th className="col-evo">{lang === "fr" ? "Évol." : "Evol."}</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((row, index) => {
                let evoIcon = <span className="evo-bullet">●</span>;
                let evoClass = "evo-equal";

                if (index + 1 < historyData.length) {
                  const prevGame = historyData[index + 1];
                  if (row.score > prevGame.score) {
                    evoIcon = <span className="evo-arrow">▲</span>;
                    evoClass = "evo-up";
                  } else if (row.score < prevGame.score) {
                    evoIcon = <span className="evo-arrow">▼</span>;
                    evoClass = "evo-down";
                  }
                }

                return (
                  <tr key={row.id}>
                    <td className="col-date">{formatDate(row.created_at)}</td>
                    <td className="col-score highlight-cyan">{row.score}</td>
                    <td className="col-time highlight-magenta">
                      {formatTime(row.time_spent_seconds)}
                    </td>
                    <td className={`col-evo ${evoClass}`}>{evoIcon}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`sheet-panel leaderboard-panel glass-panel ${isOpen ? "open" : ""} ${theme}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel-header">
        {/* Use common SegmentedControl for uniform header toggle */}
        <SegmentedControl
          className="panel-tabs-header"
          options={[
            { value: "global", label: t("global_leaderboard") },
            { value: "personal", label: t("personal_history") },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <button className="panel-close-btn" onClick={onBack} title={t("close")}>
          <Close width={20} height={20} />
        </button>
      </div>

      <div className="leaderboard-full-layout">
        <div className="leaderboard-column">
          <div className="leaderboard-controls">
            {/* Game mode selector chips */}
            <div className="nav-chips">
              {["countries", "capitals", "departments", "rivers_mountains"].map((mKey) => (
                <button
                  key={mKey}
                  type="button"
                  className={`nav-chip ${colMode === mKey ? "active" : ""}`}
                  onClick={() => setColMode(mKey)}
                  title={t(`mode_${mKey}`)}
                >
                  {MODE_ICONS[mKey]}
                  <span>{t(`mode_${mKey}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats Summary cards always displayed at the top of active mode */}
          <div className="personal-stats-grid">
            <div className="personal-stat-card glass-panel">
              <span className="stat-label text-natural-case">{t("games_played")}</span>
              <span className="stat-value highlight-cyan">{currentRecord.gamesPlayed}</span>
            </div>
            <div className="personal-stat-card glass-panel">
              <span className="stat-label text-natural-case">{t("best_score")}</span>
              <span className="stat-value highlight-green">{currentRecord.maxScore}</span>
            </div>
            <div className="personal-stat-card glass-panel">
              <span className="stat-label text-natural-case">{t("best_time")}</span>
              <span className="stat-value highlight-magenta">
                {currentRecord.bestTime ? formatTime(currentRecord.bestTime) : "--"}
              </span>
            </div>
          </div>

          {/* Conditional Rendering of Tab Content */}
          {activeTab === "global" ? (
            <div className="leaderboard-table-container scrollbar-styled">
              {!isSupabaseConfigured ? (
                <div className="leaderboard-empty-state">
                  <p>{t("not_connected")}</p>
                </div>
              ) : loading ? (
                <div className="leaderboard-loading-state">
                  <div className="pixel-spinner" />
                  <p>{t("connecting")}</p>
                </div>
              ) : error ? (
                <div className="leaderboard-error-state">
                  <p>Erreur: {error}</p>
                </div>
              ) : scoresData.length === 0 ? (
                <div className="leaderboard-empty-state">
                  <p>{t("empty_leaderboard")}</p>
                </div>
              ) : (
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th className="col-rank">{t("rank")}</th>
                      <th className="col-player">Joueur</th>
                      <th className="col-score">{t("score")}</th>
                      <th className="col-time">{t("time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoresData.map((row, index) => {
                      const prof = row.profiles || {
                        username: "Anonyme",
                        avatar_id: "invader_1",
                        avatar_color: "cyan",
                      };
                      const isTop3 = index < 3;
                      const rankLabels = ["1st", "2nd", "3rd"];
                      const rankColorClass = isTop3 ? `rank-${index + 1}` : "";

                      return (
                        <tr key={row.id}>
                          <td className="col-rank">
                            <span className={`rank-badge ${rankColorClass}`}>
                              {isTop3 ? rankLabels[index] : index + 1}
                            </span>
                          </td>
                          <td className="col-player">
                            <div className="player-cell">
                              <InvaderAvatar
                                invaderId={prof.avatar_id}
                                color={prof.avatar_color}
                                size={20}
                              />
                              <span className="player-username">{prof.username}</span>
                            </div>
                          </td>
                          <td className="col-score highlight-cyan">{row.score}</td>
                          <td className="col-time highlight-magenta">
                            {formatTime(row.time_spent_seconds)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            renderHistoryContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(LeaderboardScreen);
