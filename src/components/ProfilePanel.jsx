import React, { useState, useEffect } from "react";
import { User, Close, Trophy, Lock } from "pixelarticons/react";
import InvaderAvatar from "./InvaderAvatar";
import { AVATAR_COLORS } from "../config/designSystem";
import { useTranslation } from "../config/i18n";
import { getLevelAndProgress } from "../utils/gamification";
import { CHALLENGES } from "../data/challenges";
import {
  isSupabaseConfigured,
  upsertProfile,
  isUsernameTaken,
  signOut
} from "../services/supabaseClient";
import SegmentedControl from "./SegmentedControl";
import "./ProfilePanel.css";

// Dictionnaire associant 12 succès spécifiques aux 12 modèles d'envahisseurs et leurs couleurs fixes
const CHALLENGE_AVATARS = {
  ch_gen_play_1: { invaderId: "invader_1", color: "cyan" },         // Premier Pas
  ch_gen_play_10: { invaderId: "invader_2", color: "purple" },      // Pilier Cartographe
  ch_gen_play_50: { invaderId: "invader_3", color: "magenta" },     // Géographe Suprême
  ch_cont_europe: { invaderId: "invader_4", color: "cyan" },        // Conquête de l'Europe
  ch_cont_africa: { invaderId: "invader_5", color: "yellow" },      // Terres Africaines
  ch_cont_asia: { invaderId: "invader_6", color: "magenta" },       // Soleil Levant
  ch_cont_americas: { invaderId: "invader_7", color: "lime" },      // Nouveau Monde
  ch_cont_oceania: { invaderId: "invader_8", color: "pink" },       // Archipels Lointains
  ch_score_countries_50: { invaderId: "invader_9", color: "yellow" },// Expert Pays
  ch_score_capitals_50: { invaderId: "invader_10", color: "orange" },// Maire du Monde
  ch_speed_fast_guess: { invaderId: "invader_11", color: "yellow" }, // Réflexe Éclair
  ch_relief_score_20: { invaderId: "invader_12", color: "green" }    // Alpiniste Amateur
};

const ProfilePanel = ({
  userProfile,
  setUserProfile,
  onClose,
  isOpen,
  lang = "fr",
  theme = "dark",
  localRecords,
  session,
  onOpenAuth
}) => {
  const t = useTranslation(lang);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "stats"
  const [usernameInput, setUsernameInput] = useState(userProfile.username || "");
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatarId || "invader_1");
  const [selectedColor, setSelectedColor] = useState(userProfile.avatarColor || "cyan");
  const [challengesFilter, setChallengesFilter] = useState("all");
  const [selectedChallengeId, setSelectedChallengeId] = useState(CHALLENGES[0].id);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState(null);

  // Sync inputs with userProfile updates
  useEffect(() => {
    if (userProfile) {
      setUsernameInput(userProfile.username || "");
      setSelectedAvatar(userProfile.avatarId || "invader_1");
      setSelectedColor(userProfile.avatarColor || "cyan");
    }
  }, [userProfile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaveSuccess(false);

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setFormError(t("username_required"));
      return;
    }

    setIsSaving(true);
    try {
      if (isSupabaseConfigured && session) {
        // Username taken check
        if (cleanUsername.toLowerCase() !== (userProfile.username || "").toLowerCase()) {
          const taken = await isUsernameTaken(cleanUsername);
          if (taken) {
            setFormError(t("username_taken"));
            setIsSaving(false);
            return;
          }
        }

        const updatedProfile = {
          ...userProfile,
          username: cleanUsername,
          avatarId: selectedAvatar,
          avatarColor: selectedColor
        };

        const { error } = await upsertProfile(
          session.user.id,
          cleanUsername,
          selectedAvatar,
          selectedColor,
          userProfile.xp,
          userProfile.level,
          userProfile.unlockedBadges
        );

        if (error) throw error;

        setUserProfile(updatedProfile);
      } else {
        // Guest Profile Save
        const guestProfile = {
          ...userProfile,
          username: cleanUsername,
          avatarId: selectedAvatar,
          avatarColor: selectedColor
        };
        setUserProfile(guestProfile);
        localStorage.setItem("tvrs-user-profile", JSON.stringify(guestProfile));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setFormError(err.message || t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOutClick = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      await signOut();
      const guestProfile = {
        id: "guest",
        username: "Guest",
        xp: 0,
        unlockedBadges: [],
        avatarId: "invader_1",
        avatarColor: "cyan"
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

  const getChallengeTitle = (ch) => (lang === "fr" ? ch.titleFr : ch.titleEn);
  const getChallengeDesc = (ch) => (lang === "fr" ? ch.descFr : ch.descEn);

  // Génération des 12 avatars basés sur les missions
  const allAvatars = Object.entries(CHALLENGE_AVATARS).map(([chId, mapping]) => {
    const ch = CHALLENGES.find((c) => c.id === chId);
    const label = ch ? (lang === "fr" ? ch.titleFr : ch.titleEn) : "Mission";
    const desc = ch ? (lang === "fr" ? ch.descFr : ch.descEn) : "";
    const isLocked = chId === "ch_gen_play_1" ? false : !unlockedBadges.includes(chId);

    return {
      id: mapping.invaderId,
      challengeId: chId,
      isLocked,
      label,
      unlockDesc: `${label}: ${desc}`,
      color: mapping.color
    };
  });

  // Guard AFTER all hooks (useState/useEffect) and derived values.
  // This ensures we fully unmount the panel subtree when closed (important on mobile/guest
  // so that the blur overlay or other elements can't intercept the close button or block access).
  // Visibility is also controlled via the "open" class for transitions when mounting.
  if (!isOpen) return null;

  return (
    <div
      className={`sheet-panel profile-panel glass-panel open ${theme}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel-header">
        <SegmentedControl
          options={[
            { value: "profile", label: t("tab_profile"), icon: <User width={14} height={14} className="tab-icon" /> },
            { value: "stats", label: t("tab_stats"), icon: <Trophy width={14} height={14} className="tab-icon" /> },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
        <button
          className="panel-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title={t("close")}
        >
          <Close width={20} height={20} />
        </button>
      </div>

      <div className="panel-body scrollbar-styled">
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
                
                {/* Scrollable Middle Area - contains sticky header + content in ONE scroll block (no double scroll) */}
                <div className="profile-form-middle scrollbar-styled">
                  {/* Sticky Top Header Area (nom/username sticky, like mobile no-double-scroll logic) */}
                  <div className="profile-form-header">
                    <div className="form-group" style={{ width: "100%" }}>
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

                  {/* Content: niv (level), invader, stats etc. scroll together as one block */}
                  {/* Minecraft Style XP Block (Moved to Default Profile Tab) */}
                  <div className="xp-progression-card glass-panel" style={{ marginBottom: "var(--spacing-md)" }}>
                    <div className="xp-card-header">
                      <div className="xp-avatar-wrap">
                        <InvaderAvatar invaderId={selectedAvatar} color={selectedColor} size={36} />
                      </div>
                      <div className="xp-level-info">
                        <span className="xp-level-title">{t("level", { level })}</span>
                        <span className="xp-total-count">{t("xp_label", { current: xpInLevel, next: xpNeededForNext })}</span>
                      </div>
                    </div>
                    <div className="minecraft-xp-bar-container">
                      <div className="minecraft-xp-bar-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="quick-stats-grid" style={{ marginBottom: "var(--spacing-lg)" }}>
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

                  {/* Avatar Selector */}
                  <div className="form-group avatar-form-group">
                    <label>{t("select_avatar")}</label>
                    <div className="avatar-grid scrollbar-styled">
                      {allAvatars.map((item) => {
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`avatar-option glass-panel ${selectedAvatar === item.id ? "active" : ""} ${item.isLocked ? "locked" : ""}`}
                            onClick={() => {
                              if (!item.isLocked) {
                                setSelectedAvatar(item.id);
                                setSelectedColor(item.color);
                              }
                            }}
                            disabled={item.isLocked || (isSupabaseConfigured && !session)}
                            title={item.isLocked ? item.unlockDesc : item.label}
                          >
                            <div className="avatar-option-inner">
                              <InvaderAvatar
                                invaderId={item.id}
                                color={item.isLocked ? "gray" : item.color}
                                size={28}
                              />
                              {item.isLocked && (
                                <div className="avatar-lock-overlay">
                                  <Lock width={12} height={12} className="lock-icon" />
                                  <span className="lock-lvl">🏆</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
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
            {/* Scrollable Middle Area (Contains ONLY Achievements) */}
            <div className="badges-gallery-section">
              <span className="section-label">Challenges & Émotes</span>
              
              <div className="nav-chips">
                {["all", "general", "continents", "scores", "speed", "relief"].map((cat) => (
                  <button
                    key={cat}
                    className={`nav-chip ${challengesFilter === cat ? "active" : ""}`}
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
