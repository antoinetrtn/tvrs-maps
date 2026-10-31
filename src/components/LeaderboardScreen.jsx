import "./LeaderboardScreen.css";
import "./ui/ui.css";

import {
  Clock,
  Earth,
  Flag,
  Gamepad,
  Globe,
  Hash,
  Heart,
  MapPin,
  TreePine,
  Trophy,
  User,
} from "pixelarticons/react";
import React, { useEffect, useRef, useState } from "react";

import { PLAY_MODES } from "../config/gameConfig";
import { useTranslation } from "../config/i18n";
import { isConquestEnabled } from "../multiplayer/conquestConfig";
import ConquestLeaderboard from "../multiplayer/ConquestLeaderboard.jsx";
import { getLeaderboard, getUserHistory, isSupabaseConfigured } from "../services/supabaseClient";
import { formatTime } from "../utils/utils";
import InvaderAvatar from "./InvaderAvatar";
import LeaderboardRow, { LeaderboardList, LeaderboardNotice } from "./LeaderboardRow";
import Card from "./ui/Card";
import Dialog, { DialogTitle } from "./ui/Dialog";
import EmptyState from "./ui/EmptyState";
import ErrorState from "./ui/ErrorState";
import LoadingState from "./ui/LoadingState";
import PanelCloseButton from "./ui/PanelCloseButton";
import TabBar from "./ui/TabBar";

const MODE_ICONS = {
  countries: <Globe width={16} height={16} aria-hidden="true" />,
  capitals: <MapPin width={16} height={16} aria-hidden="true" />,
  departments: <Hash width={14} height={14} aria-hidden="true" />,
  us_states: <Earth width={16} height={16} aria-hidden="true" />,
  rivers_mountains: <TreePine width={16} height={16} aria-hidden="true" />,
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

/** Score value with the hardcore heart badge when the run was hardcore. */
const ScoreCell = ({ value, hardcore, hardcoreLabel }) => (
  <span className="score-cell">
    {value}
    {hardcore && (
      <Heart width={12} height={12} className="hardcore-badge" aria-label={hardcoreLabel} />
    )}
  </span>
);

/** One row of the global leaderboard (user_records shape). */
const GlobalScoreRow = ({ row, index, hardcoreLabel, isMe, youLabel }) => {
  const prof = row.profiles || {
    username: "Anonyme",
    avatar_id: "invader_1",
    avatar_color: "cyan",
  };
  return (
    <LeaderboardRow
      rank={index + 1}
      podium={index < 3}
      avatar={<InvaderAvatar invaderId={prof.avatar_id} color={prof.avatar_color} size={20} />}
      name={prof.username}
      stat={<ScoreCell value={row.score} hardcore={row.hardcore} hardcoreLabel={hardcoreLabel} />}
      meta={formatTime(row.time_spent_seconds)}
      isMe={isMe}
      youLabel={youLabel}
    />
  );
};

const trendOf = (row, previousRow) => {
  if (!previousRow || row.score === previousRow.score) return ["evo-equal", "●"];
  return row.score > previousRow.score ? ["evo-up", "▲"] : ["evo-down", "▼"];
};

/** One row of the personal history (leaderboards shape) with score trend. */
const HistoryRow = ({ row, previousRow, number, hardcoreLabel, gameLabel }) => {
  const [evoClass, evoIcon] = trendOf(row, previousRow);
  return (
    <LeaderboardRow
      rank={number}
      name={formatDate(row.created_at) || gameLabel}
      stat={<ScoreCell value={row.score} hardcore={row.hardcore} hardcoreLabel={hardcoreLabel} />}
      meta={formatTime(row.time_spent_seconds)}
      trend={
        <span className={`lb-trend ${evoClass}`} aria-hidden="true">
          {evoIcon}
        </span>
      }
    />
  );
};

// Stable defaults: a fresh [] each render would re-trigger the history fetch effect.
const EMPTY_RECORDS = {};
const EMPTY_HISTORY = [];

const LeaderboardScreen = ({
  userProfile,
  localRecords = EMPTY_RECORDS,
  localGameHistory = EMPTY_HISTORY,
  session = null,
  onBack,
  lang = "fr",
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
          setError(fetchErr.message || String(fetchErr));
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
      const activeUserId = session?.user?.id || userProfile?.id;
      const localModeHistory = (localGameHistory || []).filter((g) => g.game_mode === colMode);

      if (!isSupabaseConfigured || !activeUserId) {
        setHistoryData(localModeHistory);
        setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const { data } = await getUserHistory(activeUserId, colMode);

        if (!isMounted) return;

        const dbData = data || [];
        const mergedHistory = [...dbData];
        const existingIds = new Set(dbData.map((d) => d.id));
        localModeHistory.forEach((loc) => {
          if (!existingIds.has(loc.id)) {
            mergedHistory.push(loc);
          }
        });
        mergedHistory.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        setHistoryData(mergedHistory);
      } catch {
        if (isMounted) {
          setHistoryData(localModeHistory);
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
  }, [colMode, userProfile?.id, session, localGameHistory, isOpen, activeTab]);

  const currentRecord = localRecords?.[colMode] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };

  const renderEvolutionChart = () => {
    if (!isSupabaseConfigured || historyData.length === 0) return null;

    // Get last 10 games in chronological order (oldest to newest for the chart)
    const recentGames = [...historyData].slice(0, 10).reverse();
    const maxScoreVal = Math.max(...recentGames.map((g) => g.score), 1);

    return (
      <div className="evolution-chart-container glass-panel">
        <span className="chart-title text-natural-case">
          {lang === "fr" ? "Évolution" : "Evolution"}
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

  const myId = session?.user?.id || userProfile?.id || null;
  const isSignedIn = Boolean(session?.user);

  const renderGlobalContent = () => {
    if (!isSupabaseConfigured) return <EmptyState title={t("not_connected")} />;
    if (loading) return <LoadingState title={t("connecting")} />;
    if (error) return <ErrorState title={error} />;
    if (scoresData.length === 0) return <EmptyState title={t("empty_leaderboard")} />;
    return (
      <LeaderboardList label={t("global_leaderboard")}>
        {scoresData.map((row, index) => (
          <GlobalScoreRow
            key={row.id}
            row={row}
            index={index}
            hardcoreLabel={t("hardcore_mode")}
            isMe={Boolean(myId) && row.profiles?.id === myId}
            youLabel={t("you_tag")}
          />
        ))}
      </LeaderboardList>
    );
  };

  const renderHistoryContent = () => {
    if (!isSupabaseConfigured && historyData.length === 0) {
      return (
        <EmptyState
          title={t("not_connected")}
          hint={
            lang === "fr"
              ? "Connectez-vous pour voir l'historique complet de vos parties."
              : "Sign in to see your complete game history."
          }
        />
      );
    }

    if (historyLoading) {
      return <LoadingState title={t("connecting")} />;
    }

    if (historyError) {
      return <ErrorState title={historyError} />;
    }

    if (historyData.length === 0) {
      return <EmptyState title={t("no_records_yet")} />;
    }

    return (
      <div className="personal-history-layout">
        {renderEvolutionChart()}

        <LeaderboardList label={t("personal_history")}>
          {historyData.map((row, index) => (
            <HistoryRow
              key={row.id || index}
              row={row}
              previousRow={historyData[index + 1]}
              number={historyData.length - index}
              hardcoreLabel={t("hardcore_mode")}
            />
          ))}
        </LeaderboardList>
      </div>
    );
  };

  return (
    <Dialog
      variant="panel"
      open={isOpen}
      onClose={onBack}

      className="leaderboard-panel glass-panel"
    >
      <div className="panel-header">
        <DialogTitle className="panel-title">{t("global_leaderboard")}</DialogTitle>
        <PanelCloseButton label={t("close")} onClick={onBack} />
      </div>
      <TabBar
        level={1}
        className="leaderboard-tabs"
        label={t("global_leaderboard")}
        options={[
          {
            value: "global",
            label: t("tab_global"),
            icon: <Trophy width={16} height={16} aria-hidden="true" />,
          },
          {
            value: "personal",
            label: t("tab_history"),
            icon: <Clock width={16} height={16} aria-hidden="true" />,
          },
          ...(isConquestEnabled()
            ? [
                {
                  value: "conquest",
                  label: lang === "fr" ? "Conquête" : "Conquest",
                  icon: <Flag width={16} height={16} aria-hidden="true" />,
                },
              ]
            : []),
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "conquest" ? (
        <div key={activeTab} className="leaderboard-full-layout">
          <ConquestLeaderboard lang={lang} isSignedIn={isSignedIn} />
        </div>
      ) : (
        <div key={activeTab} className="leaderboard-full-layout">
          <div className="leaderboard-column">
            <div className="leaderboard-controls">
              {/* Game mode selector chips */}
              <TabBar
                level={2}
                label={t("game_modes") || "Modes"}
                options={PLAY_MODES.map((mKey) => {
                  const full = t(`mode_${mKey}`);
                  const shortKey = `mode_${mKey}_short`;
                  const translatedShort = t(shortKey);
                  const short =
                    translatedShort && translatedShort !== shortKey ? translatedShort : full;
                  return {
                    value: mKey,
                    label: short,
                    title: full,
                    icon: MODE_ICONS[mKey],
                  };
                })}
                value={colMode}
                onChange={setColMode}
              />
            </div>

            {/* Stats Summary cards always displayed at the top of active mode */}
            <div className="personal-stats-grid px-cascade">
              <Card
                look="stat-chip"
                glass
                role="group"
                aria-label={`${t("games_played")} : ${currentRecord.gamesPlayed}`}
                title={t("games_played")}
              >
                <span className="sr-only">{t("games_played")}</span>
                <Gamepad width={14} height={14} className="stat-icon" aria-hidden="true" />
                <span className="stat-value highlight-cyan">{currentRecord.gamesPlayed}</span>
              </Card>
              <Card
                look="stat-chip"
                glass
                role="group"
                aria-label={`${t("best_score")} : ${currentRecord.maxScore}`}
                title={t("best_score")}
              >
                <span className="sr-only">{t("best_score")}</span>
                <Trophy width={14} height={14} className="stat-icon" aria-hidden="true" />
                <span className="stat-value highlight-green">{currentRecord.maxScore}</span>
              </Card>
              <Card
                look="stat-chip"
                glass
                role="group"
                aria-label={`${t("best_time")} : ${currentRecord.bestTime ? formatTime(currentRecord.bestTime) : "--"}`}
                title={t("best_time")}
              >
                <span className="sr-only">{t("best_time")}</span>
                <Clock width={14} height={14} className="stat-icon" aria-hidden="true" />
                <span className="stat-value highlight-magenta">
                  {currentRecord.bestTime ? formatTime(currentRecord.bestTime) : "--"}
                </span>
              </Card>
            </div>

            {/* Conditional Rendering of Tab Content */}
            {activeTab === "global" ? (
              <>
                {!isSignedIn && (
                  <LeaderboardNotice
                    aria-label={t("leaderboard_guest")}
                    title={t("leaderboard_guest")}
                  >
                    <User width={14} height={14} className="lb-notice-icon" aria-hidden="true" />
                    <span>{t("leaderboard_guest_short")}</span>
                  </LeaderboardNotice>
                )}
                {renderGlobalContent()}
              </>
            ) : (
              renderHistoryContent()
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default React.memo(LeaderboardScreen);
