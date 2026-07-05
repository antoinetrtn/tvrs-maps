import React, { useState, useEffect } from "react";
import { ChevronLeft, User, Trophy, BookOpen } from "pixelarticons/react";
import InvaderAvatar, { INVADER_DESIGNS } from "./InvaderAvatar";
import { AVATAR_COLORS } from "./designSystem";
import { useTranslation } from "./i18n";
import {
  isSupabaseConfigured,
  getLeaderboard,
  upsertProfile,
  isUsernameTaken
} from "./supabaseClient";
import "./ProfileScreen.css";

const ProfileScreen = ({
  userProfile,
  setUserProfile,
  localRecords,
  onBack,
  lang = "fr",
  theme = "dark",
  initialTab = "records"
}) => {
  const t = useTranslation(lang);

  // Profile Form State
  const [usernameInput, setUsernameInput] = useState(userProfile.username || "");
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatarId || "invader_1");
  const [selectedColor, setSelectedColor] = useState(userProfile.avatarColor || "cyan");
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state with parent profile changes
  useEffect(() => {
    setUsernameInput(userProfile.username || "");
    setSelectedAvatar(userProfile.avatarId || "invader_1");
    setSelectedColor(userProfile.avatarColor || "cyan");
  }, [userProfile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaveSuccess(false);

    const cleanUsername = usernameInput.trim();

    // Validation
    if (!cleanUsername) {
      setFormError(t("username_invalid"));
      return;
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setFormError(t("username_invalid"));
      return;
    }
    const alphanumericRegex = /^[a-zA-Z0-9_\s-]+$/;
    if (!alphanumericRegex.test(cleanUsername)) {
      setFormError(t("username_invalid"));
      return;
    }

    setIsSaving(true);

    try {
      // Check if username is taken online
      if (isSupabaseConfigured && cleanUsername.toLowerCase() !== userProfile.username?.toLowerCase()) {
        const taken = await isUsernameTaken(cleanUsername, userProfile.id);
        if (taken) {
          setFormError(t("username_taken"));
          setIsSaving(false);
          return;
        }
      }

      // Upsert profile in Supabase
      let updatedProfile = {
        ...userProfile,
        username: cleanUsername,
        avatarId: selectedAvatar,
        avatarColor: selectedColor
      };

      if (isSupabaseConfigured) {
        const { error } = await upsertProfile(
          userProfile.id,
          cleanUsername,
          selectedAvatar,
          selectedColor
        );
        if (error) {
          throw new Error(error);
        }
      }

      // Update local React state and LocalStorage
      setUserProfile(updatedProfile);
      localStorage.setItem("tvrs-user-profile", JSON.stringify(updatedProfile));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setFormError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

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

  // State-contained Leaderboard Column Component
  const LeaderboardColumn = ({ defaultMode }) => {
    const [colMode, setColMode] = useState(defaultMode);
    const [colData, setColData] = useState([]);
    const [colLoading, setColLoading] = useState(false);
    const [colError, setColError] = useState(null);

    const fetchColData = async () => {
      if (!isSupabaseConfigured) return;
      setColLoading(true);
      setColError(null);
      try {
        const { data, error } = await getLeaderboard(colMode);
        if (error) {
          setColError(error);
        } else {
          setColData(data || []);
        }
      } catch (err) {
        setColError(err.message);
      } finally {
        setColLoading(false);
      }
    };

    useEffect(() => {
      fetchColData();
    }, [colMode]);

    return (
      <div className="leaderboard-column glass-panel">
        <div className="leaderboard-column-header">
          <select
            value={colMode}
            onChange={(e) => setColMode(e.target.value)}
            className="mode-select-dropdown glass-panel"
          >
            <option value="countries">{t("mode_countries")}</option>
            <option value="capitals">{t("mode_capitals")}</option>
            <option value="departments">{t("mode_departments")}</option>
            <option value="rivers_mountains">{t("mode_rivers_mountains")}</option>
          </select>
        </div>

        <div className="leaderboard-table-container scrollbar-styled">
          {!isSupabaseConfigured ? (
            <div className="leaderboard-empty-state">
              <p>{t("not_connected")}</p>
            </div>
          ) : colLoading ? (
            <div className="leaderboard-loading-state">
              <div className="pixel-spinner" />
              <p>{t("connecting")}</p>
            </div>
          ) : colError ? (
            <div className="leaderboard-error-state">
              <p>Erreur: {colError}</p>
            </div>
          ) : colData.length === 0 ? (
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
                  <th className="col-date">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {colData.map((row, index) => {
                  const prof = row.profiles || {
                    username: "Anonyme",
                    avatar_id: "invader_1",
                    avatar_color: "cyan"
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
                      <td className="col-date">{formatDate(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`profile-screen-overlay ${theme}`}>
      <div className="profile-container glass-panel">
        {/* Header */}
        <div className="profile-header">
          <button className="back-btn glass-panel" onClick={onBack} title={t("home")}>
            <ChevronLeft width={20} height={20} />
          </button>
          <h1 className="profile-title text-natural-case">
            {initialTab === "leaderboard" ? t("global_leaderboard") : t("profile_screen_title")}
          </h1>
        </div>

        {initialTab === "leaderboard" ? (
          /* FOUR COLUMNS LEADERBOARD VIEW */
          <div className="leaderboard-double-layout">
            <LeaderboardColumn defaultMode="countries" />
            <LeaderboardColumn defaultMode="capitals" />
            <LeaderboardColumn defaultMode="departments" />
            <LeaderboardColumn defaultMode="rivers_mountains" />
          </div>
        ) : (
          /* PROFILE & RECORDS VIEW */
          <div className="profile-content-grid">
            {/* Sidebar Profile Form */}
            <div className="profile-sidebar glass-panel">
              <h2 className="section-title text-natural-case">
                <User className="icon" /> {t("profile")}
              </h2>

              <form onSubmit={handleSaveProfile} className="profile-form">
                <div className="avatar-preview-container">
                  <div className="avatar-glow" style={{ "--glow-color": AVATAR_COLORS[selectedColor] }}>
                    <InvaderAvatar invaderId={selectedAvatar} color={selectedColor} size={64} />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="username-input">{t("username")}</label>
                  <input
                    id="username-input"
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Pseudo..."
                    maxLength={20}
                    className="glass-panel"
                  />
                </div>

                <div className="form-group">
                  <label>{t("select_avatar")}</label>
                  <div className="avatar-grid scrollbar-styled">
                    {Object.keys(INVADER_DESIGNS).map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`avatar-option glass-panel ${selectedAvatar === id ? "active" : ""}`}
                        onClick={() => setSelectedAvatar(id)}
                      >
                        <InvaderAvatar invaderId={id} color={selectedColor} size={28} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t("select_color")}</label>
                  <div className="color-selector-grid">
                    {Object.keys(AVATAR_COLORS).map((cKey) => (
                      <button
                        key={cKey}
                        type="button"
                        className={`color-option ${selectedColor === cKey ? "active" : ""}`}
                        style={{ "--option-color": AVATAR_COLORS[cKey] }}
                        onClick={() => setSelectedColor(cKey)}
                        title={cKey}
                      />
                    ))}
                  </div>
                </div>

                {formError && <div className="form-feedback error">{formError}</div>}
                {saveSuccess && <div className="form-feedback success">{t("profile_saved")}</div>}

                <button type="submit" disabled={isSaving} className="btn-primary form-submit-btn">
                  {isSaving ? t("saving") : t("save_profile")}
                </button>
              </form>
            </div>

            {/* Profile Main Content: Records only */}
            <div className="profile-main-content">
              <h2 className="section-title text-natural-case">
                <BookOpen className="icon" /> {t("personal_records")}
              </h2>

              <div className="records-tab">
                <div className="records-grid">
                  {["countries", "capitals", "departments", "rivers_mountains"].map((mKey) => {
                    const record = localRecords[mKey] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };
                    return (
                      <div key={mKey} className="record-card glass-panel">
                        <h3 className="record-mode-title">{t(`mode_${mKey}`)}</h3>
                        <div className="record-stats">
                          <div className="stat-row">
                            <span className="stat-label">{t("best_score")}</span>
                            <span className="stat-value highlight-cyan">{record.maxScore}</span>
                          </div>
                          <div className="stat-row">
                            <span className="stat-label">{t("best_time")}</span>
                            <span className="stat-value highlight-magenta">{formatTime(record.bestTime)}</span>
                          </div>
                          <div className="stat-row">
                            <span className="stat-label">{t("games_played")}</span>
                            <span className="stat-value">{record.gamesPlayed}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProfileScreen);
