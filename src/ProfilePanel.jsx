import React, { useState, useEffect } from "react";
import { User, Close, Trophy, Lock } from "pixelarticons/react";
import InvaderAvatar, { INVADER_DESIGNS } from "./InvaderAvatar";
import { AVATAR_COLORS } from "./designSystem";
import { useTranslation } from "./i18n";
import { getLevelAndProgress, getAvatarUnlockLevel } from "./useUserProfile";
import { CHALLENGES } from "./challenges";
import {
  isSupabaseConfigured,
  upsertProfile,
  isUsernameTaken,
  signOut
} from "./supabaseClient";
import "./ProfilePanel.css";

const ProfilePanel = ({
  userProfile,
  setUserProfile,
  onClose,
  isOpen,
  lang = "fr",
  theme = "dark",
  localRecords = {},
  session = null,
  onOpenAuth
}) => {
  const t = useTranslation(lang);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "stats"

  // Profile Form State
  const [usernameInput, setUsernameInput] = useState(userProfile.username || "");
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatarId || "invader_1");
  const [selectedColor, setSelectedColor] = useState(userProfile.avatarColor || "cyan");
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Stats / Challenges state
  const [challengesFilter, setChallengesFilter] = useState("all");
  const [selectedChallengeId, setSelectedChallengeId] = useState("ch_gen_play_1");

  // Sync state with parent profile changes
  useEffect(() => {
    if (isOpen) {
      setUsernameInput(userProfile.username || "");
      setSelectedAvatar(userProfile.avatarId || "invader_1");
      setSelectedColor(userProfile.avatarColor || "cyan");
      setFormError(null);
      setSaveSuccess(false);
    }
  }, [userProfile, isOpen]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaveSuccess(false);

    // If not authenticated, saving is prohibited
    if (isSupabaseConfigured && !session) {
      setFormError(t("auth_required"));
      return;
    }

    const cleanUsername = usernameInput.trim();

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
      const activeUserId = session?.user?.id || userProfile.id;

      if (isSupabaseConfigured && cleanUsername.toLowerCase() !== userProfile.username?.toLowerCase()) {
        const taken = await isUsernameTaken(cleanUsername, activeUserId);
        if (taken) {
          setFormError(t("username_taken"));
          setIsSaving(false);
          return;
        }
      }

      let updatedProfile = {
        ...userProfile,
        id: activeUserId,
        username: cleanUsername,
        avatarId: selectedAvatar,
        avatarColor: selectedColor
      };

      if (isSupabaseConfigured) {
        const { error } = await upsertProfile(
          activeUserId,
          cleanUsername,
          selectedAvatar,
          selectedColor,
          userProfile.xp || 0,
          userProfile.level || 1,
          userProfile.unlockedBadges || []
        );
        if (error) {
          throw new Error(error);
        }
      }

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

  const handleSignOutClick = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      const { error } = await signOut();
      if (error) throw error;
      
      const randomNum = Math.floor(100 + Math.random() * 900);
      const guestProfile = {
        id: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
        username: `Explorer_${randomNum}`,
        avatarId: "invader_1",
        avatarColor: "cyan",
        xp: 0,
        level: 1,
        unlockedBadges: []
      };
      setUserProfile(guestProfile);
      localStorage.setItem("tvrs-user-profile", JSON.stringify(guestProfile));
    } catch (err) {
      setFormError(err.message || "Erreur de déconnexion");
    }
  };

  const { level, xpInLevel, xpNeededForNext, percent } = getLevelAndProgress(userProfile.xp || 0);
  const unlockedBadges = userProfile.unlockedBadges || [];
  const totalGamesPlayed = Object.values(localRecords || {}).reduce((acc, rec) => acc + (rec.gamesPlayed || 0), 0);

  const filterLabels = {
    all: lang === "fr" ? "Tout" : "All",
    general: lang === "fr" ? "Général" : "General",
    continents: lang === "fr" ? "Continents" : "Continents",
    scores: lang === "fr" ? "Scores" : "Scores",
    speed: lang === "fr" ? "Vitesse" : "Speed",
    relief: lang === "fr" ? "Relief" : "Relief"
  };

  const filteredChallenges = CHALLENGES.filter((ch) => {
    if (challengesFilter === "all") return true;
    return ch.category === challengesFilter;
  });

  const selectedChallengeObj = CHALLENGES.find((ch) => ch.id === selectedChallengeId) || CHALLENGES[0];
  const isSelectedChallengeUnlocked = unlockedBadges.includes(selectedChallengeId);
  const unlockedEmoteChallenges = CHALLENGES.filter((ch) => unlockedBadges.includes(ch.id));

  const getChallengeTitle = (ch) => (lang === "fr" ? ch.titleFr : ch.titleEn);
  const getChallengeDesc = (ch) => (lang === "fr" ? ch.descFr : ch.descEn);

  return (
    <div
      className={`settings-panel profile-panel glass-panel ${isOpen ? "open" : ""} ${theme}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="settings-header">
        <div className="tab-triggers">
          <button
            className={`tab-trigger-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User className="icon" />
            <span>{t("tab_profile")}</span>
          </button>
          <button
            className={`tab-trigger-btn ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            <Trophy className="icon" />
            <span>{t("tab_stats")}</span>
          </button>
        </div>
        <button
          className="settings-close-btn"
          onClick={onClose}
          title={t("close")}
        >
          <Close width={20} height={20} />
        </button>
      </div>

      <div className="settings-body scrollbar-styled">
        {activeTab === "profile" ? (
          <div className="profile-tab-content">
            {/* Blurring Overlay for guest mode */}
            {isSupabaseConfigured && !session && (
              <div className="profile-blur-overlay">
                <div className="profile-blur-card glass-panel">
                  <p className="profile-blur-text text-natural-case">{t("auth_required")}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onOpenAuth) onOpenAuth();
                    }}
                    className="btn-primary profile-blur-btn"
                  >
                    {t("auth_sign_in")}
                  </button>
                </div>
              </div>
            )}

            <div className={`profile-customization-container ${isSupabaseConfigured && !session ? "blurred" : ""}`}>
              <form onSubmit={handleSaveProfile} className="profile-form">
                
                {/* Sticky Top Header Area */}
                <div className="profile-form-header">
                  <div className="avatar-preview-container">
                    <div className="avatar-glow" style={{ "--glow-color": AVATAR_COLORS[selectedColor] }}>
                      <InvaderAvatar invaderId={selectedAvatar} color={selectedColor} size={48} />
                      <div className="avatar-preview-level">
                        <span>{t("level_short", { level })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="profile-username-input">{t("username")}</label>
                    <input
                      id="profile-username-input"
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Pseudo..."
                      maxLength={20}
                      className="glass-panel"
                      disabled={isSupabaseConfigured && !session}
                    />
                  </div>
                </div>

                {/* Scrollable Middle Area */}
                <div className="profile-form-middle scrollbar-styled">
                  {/* Standard Avatars */}
                  <div className="form-group avatar-form-group">
                    <label>{t("select_avatar")} (Standard)</label>
                    <div className="avatar-grid scrollbar-styled">
                      {Object.keys(INVADER_DESIGNS).map((id) => {
                        const reqLvl = getAvatarUnlockLevel(id);
                        const isLocked = level < reqLvl;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`avatar-option glass-panel ${selectedAvatar === id ? "active" : ""} ${isLocked ? "locked" : ""}`}
                            onClick={() => !isLocked && setSelectedAvatar(id)}
                            disabled={isLocked || (isSupabaseConfigured && !session)}
                            title={isLocked ? t("avatar_locked", { level: reqLvl }) : id}
                          >
                            <div className="avatar-option-inner">
                              <InvaderAvatar invaderId={id} color={isLocked ? "gray" : selectedColor} size={28} />
                              {isLocked && (
                                <div className="avatar-lock-overlay">
                                  <Lock width={12} height={12} className="lock-icon" />
                                  <span className="lock-lvl">{reqLvl}</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Special Unlocked Emote Challenges */}
                  {unlockedEmoteChallenges.length > 0 && (
                    <div className="form-group avatar-form-group">
                      <label>{t("select_avatar")} (Émotes Challenges)</label>
                      <div className="avatar-grid scrollbar-styled">
                        {unlockedEmoteChallenges.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            className={`avatar-option glass-panel ${selectedAvatar === ch.id ? "active" : ""}`}
                            onClick={() => setSelectedAvatar(ch.id)}
                            title={getChallengeTitle(ch)}
                            disabled={isSupabaseConfigured && !session}
                          >
                            <div className="avatar-option-inner">
                              <InvaderAvatar invaderId={ch.id} color={selectedColor} size={28} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="form-group color-form-group">
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
                          disabled={isSupabaseConfigured && !session}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {formError && <div className="form-feedback error">{formError}</div>}

                {/* Sticky Footer Area */}
                <div className="profile-sticky-footer">
                  <button
                    type="submit"
                    disabled={isSaving || (isSupabaseConfigured && !session)}
                    className={`btn-primary form-submit-btn ${saveSuccess ? "save-success-glow" : ""}`}
                  >
                    {saveSuccess ? `✓ ${t("profile_saved")}` : (isSaving ? t("saving") : t("save_profile"))}
                  </button>
                  
                  {/* Clean Logout inside the sticky footer */}
                  {isSupabaseConfigured && session && (
                    <div className="profile-signout-wrapper">
                      <button onClick={handleSignOutClick} className="profile-signout-link">
                        {t("auth_sign_out")}
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="stats-tab-content">
            {/* Sticky Top Header Area */}
            <div className="stats-sticky-header">
              {/* Minecraft Style XP Block */}
              <div className="xp-progression-card glass-panel">
                <div className="xp-card-header">
                  <div className="xp-avatar-wrap">
                    <InvaderAvatar invaderId={userProfile.avatarId} color={userProfile.avatarColor} size={36} />
                  </div>
                  <div className="xp-level-info">
                    <span className="xp-level-title">{t("level", { level })}</span>
                    <span className="xp-total-count">{t("xp_label", { current: xpInLevel, next: xpNeededForNext })}</span>
                  </div>
                </div>
                <div className="minecraft-xp-bar-container">
                  <div className="minecraft-xp-bar-fill" style={{ width: `${percent}%` }} />
                  <span className="minecraft-xp-bar-text">{percent}%</span>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="quick-stats-grid">
                <div className="quick-stat-card glass-panel">
                  <span className="stat-label">{t("stats_total_xp")}</span>
                  <span className="stat-value">{userProfile.xp || 0}</span>
                </div>
                <div className="quick-stat-card glass-panel">
                  <span className="stat-label">{t("stats_games_played")}</span>
                  <span className="stat-value">{totalGamesPlayed}</span>
                </div>
                <div className="quick-stat-card glass-panel">
                  <span className="stat-label">{t("stats_badges_unlocked")}</span>
                  <span className="stat-value">
                    {unlockedBadges.filter((b) => b.startsWith("ch_")).length} / {CHALLENGES.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Middle Area */}
            <div className="badges-gallery-section">
              <span className="section-label">Challenges & Émotes</span>
              
              <div className="challenges-filter-bar scrollbar-styled">
                {["all", "general", "continents", "scores", "speed", "relief"].map((cat) => (
                  <button
                    key={cat}
                    className={`filter-tab-btn ${challengesFilter === cat ? "active" : ""}`}
                    onClick={() => setChallengesFilter(cat)}
                  >
                    {filterLabels[cat] || cat}
                  </button>
                ))}
              </div>

              <div className="badges-grid scrollbar-styled">
                {filteredChallenges.map((ch) => {
                  const isUnlocked = unlockedBadges.includes(ch.id);
                  const isSelected = selectedChallengeId === ch.id;
                  return (
                    <button
                      key={ch.id}
                      className={`badge-item-btn glass-panel ${isUnlocked ? "unlocked" : "locked"} ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedChallengeId(ch.id)}
                      style={{
                        "--badge-color-glow": isUnlocked ? `${AVATAR_COLORS[ch.color]}33` : "transparent",
                        "--badge-color-border": isUnlocked ? AVATAR_COLORS[ch.color] : "var(--glass-border)"
                      }}
                    >
                      <div className="badge-item-inner">
                        <InvaderAvatar
                          invaderId={ch.id}
                          color={isUnlocked ? ch.color : "gray"}
                          size={24}
                        />
                        {!isUnlocked && (
                          <div className="badge-lock-badge">
                            <Lock width={10} height={10} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sticky Bottom Area */}
            <div className="badge-detail-card glass-panel">
              <div className="badge-detail-header">
                <div
                  className="badge-detail-icon-glow"
                  style={{ "--badge-detail-color": isSelectedChallengeUnlocked ? AVATAR_COLORS[selectedChallengeObj.color] : "gray" }}
                >
                  <InvaderAvatar
                    invaderId={selectedChallengeObj.id}
                    color={isSelectedChallengeUnlocked ? selectedChallengeObj.color : "gray"}
                    size={32}
                  />
                </div>
                <div className="badge-detail-title-block">
                  <h3 className="badge-detail-name text-natural-case">
                    {getChallengeTitle(selectedChallengeObj)}
                  </h3>
                  <span className={`badge-detail-status ${isSelectedChallengeUnlocked ? "unlocked" : "locked"}`}>
                    {isSelectedChallengeUnlocked ? "Débloqué (Émote OK)" : "Verrouillé"}
                  </span>
                </div>
              </div>
              <p className="badge-detail-description">
                {getChallengeDesc(selectedChallengeObj)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProfilePanel);
