import { Lock, Trophy } from "pixelarticons/react";
import React from "react";

import { AVATAR_COLORS } from "../config/designSystem";
import { CHALLENGES } from "../data/challenges";
import { isSupabaseConfigured } from "../services/supabaseClient";
import InvaderAvatar from "./InvaderAvatar";
import ProfileFooter from "./ProfileFooter";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Pressable from "./ui/Pressable";
import TabBar from "./ui/TabBar";
import TextField from "./ui/TextField";
import XpBar from "./XpBar";

const FILTER_LABELS_FR = {
  all: "Tout",
  general: "Général",
  continents: "Continents",
  scores: "Scores",
  speed: "Vitesse",
  relief: "Relief",
};

const FILTER_LABELS_EN = {
  all: "All",
  general: "General",
  continents: "Continents",
  scores: "Scores",
  speed: "Speed",
  relief: "Relief",
};

function getFilterLabel(cat, lang) {
  const table = lang === "fr" ? FILTER_LABELS_FR : FILTER_LABELS_EN;
  return Object.hasOwn(table, cat) ? table[cat] : cat;
}

function AvatarGrid({ allAvatars, selectedAvatar, setSelectedAvatar, setSelectedColor, disabled }) {
  const pickAvatar = (item) => {
    if (!item.isLocked) {
      setSelectedAvatar(item.id);
      setSelectedColor(item.color);
    }
  };
  return (
    <div className="avatar-grid scrollbar-styled">
      {allAvatars.map((item) => {
        const isSelected = selectedAvatar === item.id;
        const activeClass = isSelected ? "active" : "";
        const lockedClass = item.isLocked ? "locked" : "";
        return (
          <Pressable
            key={item.id}
            type="button"
            className={`avatar-option glass-panel ${activeClass} ${lockedClass}`}
            onClick={() => pickAvatar(item)}
            disabled={item.isLocked || disabled}
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
                  <Trophy width={12} height={12} className="lock-lvl" />
                </div>
              )}
            </div>
          </Pressable>
        );
      })}
    </div>
  );
}

export function ProfileTabContent({
  t,
  session,
  onOpenAuth,
  handleSaveProfile,
  usernameInput,
  setUsernameInput,
  selectedAvatar,
  setSelectedAvatar,
  selectedColor,
  setSelectedColor,
  level,
  xpInLevel,
  xpNeededForNext,
  percent,
  userProfile,
  totalGamesPlayed,
  unlockedBadges,
  allAvatars,
  formError,
  isSaving,
  saveSuccess,
  handleSignOutClick,
}) {
  const isGuestRestricted = isSupabaseConfigured && !session;
  const handleUnlockClick = (e) => {
    e.preventDefault();
    if (onOpenAuth) {
      onOpenAuth();
    }
  };

  return (
    <div className="profile-tab-content px-band-in">
      {/* Blurring Overlay for guest mode */}
      {isGuestRestricted && (
        <div className="profile-blur-overlay">
          <Card look="locked" glass>
            <p className="profile-blur-text text-natural-case">{t("auth_required")}</p>
            <Button variant="primary" onClick={handleUnlockClick} look="profile-unlock">
              {t("auth_sign_in")}
            </Button>
          </Card>
        </div>
      )}

      <div className={`profile-customization-container ${isGuestRestricted ? "blurred" : ""}`}>
        <form onSubmit={handleSaveProfile} className="profile-form">
          {/* Scrollable Middle Area - contains sticky header + content in ONE scroll block (no double scroll) */}
          <div className="profile-form-middle scrollbar-styled">
            {/* Sticky Top Header Area (nom/username sticky, like mobile no-double-scroll logic) */}
            <div className="profile-form-header">
              <TextField
                id="profile-username-input"
                label={t("username")}
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Pseudo..."
                maxLength={20}
                className="glass-panel"
                disabled={isGuestRestricted}
              />
            </div>

            {/* XP progression card */}
            <Card look="xp" glass className="profile-xp">
              <div className="xp-card-header">
                <div className="xp-avatar-wrap">
                  <InvaderAvatar invaderId={selectedAvatar} color={selectedColor} size={36} />
                </div>
                <div className="xp-level-info">
                  <span className="xp-level-title">{t("level", { level })}</span>
                  <span className="xp-total-count">
                    {t("xp_label", { current: xpInLevel, next: xpNeededForNext })}
                  </span>
                </div>
              </div>
              <XpBar
                percent={percent}
                label={t("xp_label", { current: xpInLevel, next: xpNeededForNext })}
              />
            </Card>

            {/* Quick Stats Grid */}
            <div className="quick-stats-grid">
              <Card look="stat" glass>
                <span className="stat-label">{t("stats_total_xp")}</span>
                <span className="stat-value">{userProfile.xp || 0}</span>
              </Card>
              <Card look="stat" glass>
                <span className="stat-label">{t("stats_games_played")}</span>
                <span className="stat-value">{totalGamesPlayed}</span>
              </Card>
              <Card look="stat" glass>
                <span className="stat-label">{t("stats_badges_unlocked")}</span>
                <span className="stat-value">
                  {unlockedBadges.filter((b) => b.startsWith("ch_")).length} / {CHALLENGES.length}
                </span>
              </Card>
            </div>

            {/* Avatar Selector */}
            <div className="form-group avatar-form-group">
              <label>{t("select_avatar")}</label>
              <AvatarGrid
                allAvatars={allAvatars}
                selectedAvatar={selectedAvatar}
                setSelectedAvatar={setSelectedAvatar}
                setSelectedColor={setSelectedColor}
                disabled={isGuestRestricted}
              />
            </div>
          </div>

          {formError && <div className="form-feedback error">{formError}</div>}

          <ProfileFooter
            t={t}
            disabled={isSaving || isGuestRestricted}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            showSignOut={isSupabaseConfigured && Boolean(session)}
            onSignOut={handleSignOutClick}
          />
        </form>
      </div>
    </div>
  );
}

export function StatsTabContent({
  lang,
  challengesFilter,
  setChallengesFilter,
  filteredChallenges,
  unlockedBadges,
  selectedChallengeId,
  setSelectedChallengeId,
  selectedChallengeObj,
  isSelectedChallengeUnlocked,
}) {
  const challengeTitle =
    lang === "fr" ? selectedChallengeObj.titleFr : selectedChallengeObj.titleEn;
  const challengeDesc = lang === "fr" ? selectedChallengeObj.descFr : selectedChallengeObj.descEn;
  const detailColor = isSelectedChallengeUnlocked
    ? AVATAR_COLORS[selectedChallengeObj.color]
    : "gray";
  const detailAvatarColor = isSelectedChallengeUnlocked ? selectedChallengeObj.color : "gray";
  const detailStatusClass = isSelectedChallengeUnlocked ? "unlocked" : "locked";
  const detailStatusLabel = isSelectedChallengeUnlocked ? "Débloqué (Émote OK)" : "Verrouillé";

  return (
    <div className="stats-tab-content px-band-in">
      {/* Scrollable Middle Area (Contains ONLY Achievements) */}
      <div className="badges-gallery-section">
        <span className="section-label">Challenges & Émotes</span>

        <TabBar
          level={2}
          label="Challenges & Émotes"
          options={["all", "general", "continents", "scores", "speed", "relief"].map((cat) => ({
            value: cat,
            label: getFilterLabel(cat, lang),
          }))}
          value={challengesFilter}
          onChange={setChallengesFilter}
        />

        <div className="badges-grid px-cascade scrollbar-styled">
          {filteredChallenges.map((ch) => {
            const isUnlocked = unlockedBadges.includes(ch.id);
            const isSelected = selectedChallengeId === ch.id;
            const unlockClass = isUnlocked ? "unlocked" : "locked";
            const selectClass = isSelected ? "selected" : "";
            return (
              <Pressable
                key={ch.id}
                type="button"
                className={`badge-tile glass-panel ${unlockClass} ${selectClass}`}
                onClick={() => setSelectedChallengeId(ch.id)}
                style={{
                  "--badge-color-border": isUnlocked
                    ? AVATAR_COLORS[ch.color]
                    : "var(--glass-border)",
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
              </Pressable>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom Area */}
      <Card look="badge-detail" glass>
        <div className="badge-detail-header">
          <div
            className="badge-detail-icon-glow"
            style={{
              "--badge-detail-color": detailColor,
            }}
          >
            <InvaderAvatar
              invaderId={selectedChallengeObj.id}
              color={detailAvatarColor}
              size={32}
            />
          </div>
          <div className="badge-detail-title-block">
            <h3 className="badge-detail-name text-natural-case">{challengeTitle}</h3>
            <span className={`badge-detail-status ${detailStatusClass}`}>{detailStatusLabel}</span>
          </div>
        </div>
        <p className="badge-detail-description">{challengeDesc}</p>
      </Card>
    </div>
  );
}
