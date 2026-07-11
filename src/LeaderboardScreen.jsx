import React, { useState, useEffect } from "react";
import { Globe, MapPin, Hash, TreePine, User, Close } from "pixelarticons/react";
import InvaderAvatar from "./InvaderAvatar";
import { useTranslation } from "./i18n";
import {
  isSupabaseConfigured,
  getLeaderboard,
  getUserScores
} from "./supabaseClient";
import "./LeaderboardScreen.css";

const MODE_ICONS = {
  countries: <Globe width={16} height={16} />,
  capitals: <MapPin width={16} height={16} />,
  departments: <Hash width={14} height={14} />,
  rivers_mountains: <TreePine width={16} height={16} />,
};

const LeaderboardScreen = ({
  userProfile,
  onBack,
  lang = "fr",
  theme = "dark",
  isOpen = false
}) => {
  const t = useTranslation(lang);
  const [colMode, setColMode] = useState("countries");
  const [scope, setScope] = useState("global"); // "global" or "me"
  const [scoresData, setScoresData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchScores = async () => {
      if (!isSupabaseConfigured) {
        setError(t("not_connected"));
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } =
          scope === "global"
            ? await getLeaderboard(colMode)
            : await getUserScores(userProfile?.id, colMode);

        if (!isMounted) return;

        if (fetchErr) {
          setError(fetchErr);
        } else {
          setScoresData(data || []);
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

    if (isOpen) {
      fetchScores();
    }

    return () => {
      isMounted = false;
    };
  }, [colMode, scope, userProfile, isOpen, t]);

  const formatTime = (secs) => {
    if (!secs) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };



  return (
    <div
      className={`sheet-panel leaderboard-panel glass-panel ${isOpen ? "open" : ""} ${theme}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel-header">
        <span
          className="panel-title text-natural-case"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: "900",
            fontSize: "1.1rem",
            color: "var(--text-main)"
          }}
        >
          {t("global_leaderboard")}
        </span>
        <button className="panel-close-btn" onClick={onBack} title={t("close")}>
          <Close width={20} height={20} />
        </button>
      </div>

      {/* Layout content */}
      <div className="leaderboard-full-layout">
        <div className="leaderboard-column">
          <div className="leaderboard-controls">
            {/* Game mode selector: Horizontal scrollable nav chips (unified for PC & mobile) */}
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
                <p>{scope === "me" ? (lang === "fr" ? "Vous n'avez pas encore de scores enregistrés." : "No scores recorded yet.") : t("empty_leaderboard")}</p>
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
                      avatar_color: "cyan"
                    };
                    const isTop3 = index < 3 && scope === "global";
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
        </div>
      </div>
    </div>
  );
};

export default React.memo(LeaderboardScreen);
