import React, { useState, useEffect } from "react";
import { Globe, MapPin, Hash, TreePine, ChevronLeft, User } from "pixelarticons/react";
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
  theme = "dark"
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
            : await getUserScores(userProfile.id, colMode);

        if (!isMounted) return;

        if (fetchErr) {
          setError(fetchErr);
        } else {
          setScoresData(data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchScores();

    return () => {
      isMounted = false;
    };
  }, [colMode, scope, userProfile.id]);

  const formatTime = (secs) => {
    if (!secs) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className={`modal-overlay ${theme}`}>
      <div className="modal-content">
        <header className="modal-header">
          <div className="header-left">
            <div className="score-title" style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)", flexDirection: "row" }}>
              <button className="close-popup" onClick={onBack} title={t("home")}>
                <ChevronLeft width={20} height={20} />
              </button>
              <span className="header-font">
                {t("global_leaderboard")}
              </span>
            </div>
          </div>
        </header>

        {/* Layout content */}
        <div className="leaderboard-full-layout">
          <div className="leaderboard-column glass-panel">
            <div className="leaderboard-controls">
              {/* Game mode selector: Dropdown on mobile, Tabs on desktop */}
              <div className="leaderboard-mode-selector">
                <select
                  value={colMode}
                  onChange={(e) => setColMode(e.target.value)}
                  className="leaderboard-select-mobile glass-panel"
                >
                  <option value="countries">{t("mode_countries")}</option>
                  <option value="capitals">{t("mode_capitals")}</option>
                  <option value="departments">{t("mode_departments")}</option>
                  <option value="rivers_mountains">{t("mode_rivers_mountains")}</option>
                </select>

                <div className="leaderboard-tabs-desktop">
                  {["countries", "capitals", "departments", "rivers_mountains"].map((mKey) => (
                    <button
                      key={mKey}
                      type="button"
                      className={`leaderboard-tab-btn ${colMode === mKey ? "active" : ""}`}
                      onClick={() => setColMode(mKey)}
                      title={t(`mode_${mKey}`)}
                    >
                      <span className="tab-icon-wrap">{MODE_ICONS[mKey]}</span>
                      <span className="tab-label-text">{t(`mode_${mKey}`)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope toggle with icons */}
              <div className="scope-toggle-wrap glass-panel">
                <button
                  className={`scope-btn ${scope === "global" ? "active" : ""}`}
                  onClick={() => setScope("global")}
                  title={lang === "fr" ? "Mondial" : "Global"}
                >
                  <Globe width={16} height={16} />
                  <span className="scope-btn-text">
                    {lang === "fr" ? "Mondial" : "Global"}
                  </span>
                </button>
                <button
                  className={`scope-btn ${scope === "me" ? "active" : ""}`}
                  onClick={() => setScope("me")}
                  title={lang === "fr" ? "Moi" : "Me"}
                >
                  <User width={16} height={16} />
                  <span className="scope-btn-text">
                    {lang === "fr" ? "Moi" : "Me"}
                  </span>
                </button>
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
                      <th className="col-date">{t("date")}</th>
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
                          <td className="col-date">{formatDate(row.created_at)}</td>
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
    </div>
  );
};

export default React.memo(LeaderboardScreen);
