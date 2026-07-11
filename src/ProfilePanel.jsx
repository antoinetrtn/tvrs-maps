import React, { useState, useEffect } from "react";
import { User, Close, Trophy, Lock } from "pixelarticons/react";
import InvaderAvatar, { INVADER_DESIGNS } from "./InvaderAvatar";
import { AVATAR_COLORS } from "./designSystem";
import { useTranslation } from "./i18n";
import { getLevelAndProgress, getAvatarUnlockLevel } from "./useUserProfile";
import {
  isSupabaseConfigured,
  upsertProfile,
  isUsernameTaken,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
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
  session = null
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

  // Stats / Badges state
  const [selectedBadgeId, setSelectedBadgeId] = useState("first_step");

  // Auth Panel States
  const [authType, setAuthType] = useState("login"); // "login" | "signup"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authErrorMsg, setAuthErrorMsg] = useState(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Sync state with parent profile changes
  useEffect(() => {
    if (isOpen) {
      setUsernameInput(userProfile.username || "");
      setSelectedAvatar(userProfile.avatarId || "invader_1");
      setSelectedColor(userProfile.avatarColor || "cyan");
      setFormError(null);
      setSaveSuccess(false);
      setAuthErrorMsg(null);
      setAuthSuccessMsg(null);
    }
  }, [userProfile, isOpen]);

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

  // Auth Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    setAuthSuccessMsg(null);

    const email = authEmail.trim();
    const password = authPassword.trim();

    if (!email || !password) {
      setAuthErrorMsg(t("username_invalid")); // generic error label
      return;
    }

    setIsAuthenticating(true);

    try {
      if (authType === "signup") {
        const { data, error } = await signUpWithEmail(email, password);
        if (error) throw error;
        setAuthSuccessMsg(t("account_created"));
        setAuthEmail("");
        setAuthPassword("");
      } else {
        const { data, error } = await signInWithEmail(email, password);
        if (error) throw error;
        setAuthSuccessMsg(t("auth_success"));
        setAuthEmail("");
        setAuthPassword("");
      }
    } catch (err) {
      setAuthErrorMsg(err.message || t("auth_error"));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err) {
      setAuthErrorMsg(err.message || t("auth_error"));
    }
  };

  const handleSignOutClick = async (e) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    try {
      const { error } = await signOut();
      if (error) throw error;
      
      // Reset profile to a new local UUID copy
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
      setAuthErrorMsg(err.message || "Erreur de déconnexion");
    }
  };

  // Gamification variables
  const { level, xpInLevel, xpNeededForNext, percent } = getLevelAndProgress(userProfile.xp || 0);
  const unlockedBadges = userProfile.unlockedBadges || [];
  const totalGamesPlayed = Object.values(localRecords || {}).reduce((acc, rec) => acc + (rec.gamesPlayed || 0), 0);

  const badgesList = [
    { id: "first_step", invaderId: "invader_1", color: "cyan" },
    { id: "explorer", invaderId: "invader_2", color: "lime" },
    { id: "speed_runner", invaderId: "invader_3", color: "yellow" },
    { id: "centurion", invaderId: "invader_4", color: "orange" },
    { id: "perfectionist", invaderId: "invader_5", color: "pink" },
    { id: "relief_master", invaderId: "invader_6", color: "green" },
    { id: "loyal_player", invaderId: "invader_7", color: "purple" },
    { id: "night_owl", invaderId: "invader_8", color: "blue" }
  ];

  const selectedBadgeObj = badgesList.find((b) => b.id === selectedBadgeId) || badgesList[0];
  const isSelectedBadgeUnlocked = unlockedBadges.includes(selectedBadgeId);

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

      <div className="settings-body scrollbar-styled" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeTab === "profile" ? (
          <div className="profile-tab-content">
            {/* 1. Account / Auth Section */}
            {isSupabaseConfigured && (
              <div className="auth-account-section glass-panel">
                {session ? (
                  <div className="auth-connected-state">
                    <span className="auth-email-display">
                      {t("auth_connected_as", { email: session.user.email })}
                    </span>
                    <button
                      onClick={handleSignOutClick}
                      className="auth-signout-btn"
                    >
                      {t("auth_sign_out")}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAuthSubmit} className="auth-form">
                    <h3 className="auth-form-title text-natural-case">
                      {authType === "login" ? t("auth_sign_in") : t("auth_sign_up")}
                    </h3>
                    
                    <div className="form-group-horizontal">
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setSession && setAuthEmail(e.target.value)}
                        placeholder={t("auth_email")}
                        className="glass-panel auth-input"
                        required
                      />
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setSession && setAuthPassword(e.target.value)}
                        placeholder={t("auth_password")}
                        className="glass-panel auth-input"
                        required
                      />
                    </div>

                    {authErrorMsg && <div className="form-feedback error">{authErrorMsg}</div>}
                    {authSuccessMsg && <div className="form-feedback success">{authSuccessMsg}</div>}

                    <div className="auth-actions">
                      <button
                        type="submit"
                        disabled={isAuthenticating}
                        className="btn-primary auth-submit-btn"
                      >
                        {isAuthenticating ? t("saving") : (authType === "login" ? t("auth_sign_in") : t("auth_sign_up"))}
                      </button>

                      <button
                        onClick={handleGoogleSignIn}
                        type="button"
                        className="auth-google-btn glass-panel"
                      >
                        <span>{t("auth_google")}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="auth-switch-type-btn"
                      onClick={() => setAuthType(authType === "login" ? "signup" : "login")}
                    >
                      {authType === "login" ? t("auth_no_account") : t("auth_has_account")}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 2. Character Customization Section */}
            <form onSubmit={handleSaveProfile} className="profile-form" style={{ display: "flex", flexDirection: "column" }}>
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
                />
              </div>

              <div className="form-group">
                <label>{t("select_avatar")}</label>
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
                        disabled={isLocked}
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
        ) : (
          <div className="stats-tab-content">
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
                <span className="stat-value">{unlockedBadges.length} / {badgesList.length}</span>
              </div>
            </div>

            {/* Badges Gallery */}
            <div className="badges-gallery-section">
              <span className="section-label">{t("profile_screen_title")}</span>
              <div className="badges-grid">
                {badgesList.map((badge) => {
                  const isUnlocked = unlockedBadges.includes(badge.id);
                  const isSelected = selectedBadgeId === badge.id;
                  return (
                    <button
                      key={badge.id}
                      className={`badge-item-btn glass-panel ${isUnlocked ? "unlocked" : "locked"} ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedBadgeId(badge.id)}
                      style={{
                        "--badge-color-glow": isUnlocked ? `${AVATAR_COLORS[badge.color]}33` : "transparent",
                        "--badge-color-border": isUnlocked ? AVATAR_COLORS[badge.color] : "var(--glass-border)"
                      }}
                    >
                      <div className="badge-item-inner">
                        <InvaderAvatar
                          invaderId={badge.invaderId}
                          color={isUnlocked ? badge.color : "gray"}
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

              {/* Selected Badge Details (Mobile Friendly) */}
              <div className="badge-detail-card glass-panel">
                <div className="badge-detail-header">
                  <div
                    className="badge-detail-icon-glow"
                    style={{ "--badge-detail-color": isSelectedBadgeUnlocked ? AVATAR_COLORS[selectedBadgeObj.color] : "gray" }}
                  >
                    <InvaderAvatar
                      invaderId={selectedBadgeObj.invaderId}
                      color={isSelectedBadgeUnlocked ? selectedBadgeObj.color : "gray"}
                      size={32}
                    />
                  </div>
                  <div className="badge-detail-title-block">
                    <h3 className="badge-detail-name text-natural-case">
                      {t(`badge_${selectedBadgeObj.id}_title`)}
                    </h3>
                    <span className={`badge-detail-status ${isSelectedBadgeUnlocked ? "unlocked" : "locked"}`}>
                      {isSelectedBadgeUnlocked ? "Unrevealed" : "????"}
                    </span>
                  </div>
                </div>
                <p className="badge-detail-description">
                  {t(`badge_${selectedBadgeObj.id}_desc`)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProfilePanel);
