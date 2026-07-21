import "./HomeScreen.css";

import {
  Clock,
  Close,
  CloudSun,
  Earth,
  Globe,
  Heart,
  Minus,
  Moon,
  Plus,
  Settings2,
  User,
} from "pixelarticons/react";
import React, { useCallback, useRef, useState } from "react";

import { THEMES_LIST } from "../config/designSystem";
import { useTranslation } from "../config/i18n";
import { getLevelAndProgress } from "../utils/gamification";
import GlassIconButton from "./GlassIconButton";
import HomeScreenCategoryCarousel from "./HomeScreenCategoryCarousel";
import InvaderAvatar from "./InvaderAvatar";
import LeaderboardScreen from "./LeaderboardScreen";
import Logo from "./Logo";
import ProfilePanel from "./ProfilePanel";
import SegmentedControl from "./SegmentedControl";

const HomeScreen = ({
  onStartGame,
  theme,
  setTheme,
  lang,
  setLang,
  gameDuration,
  setGameDuration,
  hardcoreMode = false,
  setHardcoreMode,
  globeTheme,
  setGlobeTheme,
  topExplorers = [],
  userProfile,
  setUserProfile,
  localRecords = {},
  session = null,
  onOpenAuth,
}) => {
  const cardRef = useRef(null);
  const isDraggingRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const t = useTranslation(lang);

  // Stable close handler passed to ProfilePanel (helps with React.memo + click reliability)
  const handleCloseProfile = useCallback(() => setProfileOpen(false), []);

  const handleOpenAuth = useCallback(() => {
    setProfileOpen(false);
    setSettingsOpen(false);
    setLeaderboardOpen(false);
    onOpenAuth?.();
  }, [onOpenAuth]);
  const { level, xpInLevel, xpNeededForNext, percent } = getLevelAndProgress(userProfile?.xp || 0);

  const displayExplorers = [...topExplorers];

  while (displayExplorers.length < 3) {
    displayExplorers.push({
      id: `placeholder-${displayExplorers.length}`,
      score: 0,
      time_spent_seconds: 0,
      profiles: {
        username: "???",
        avatar_id: "invader_1",
        avatar_color: "gray",
      },
    });
  }

  const resetCardTilt = () => {
    const card = cardRef.current;
    if (!card) return;

    card.style.setProperty("--card-rotate-x", "0deg");
    card.style.setProperty("--card-rotate-y", "0deg");
    card.style.setProperty("--card-glow-x", "50%");
    card.style.setProperty("--card-glow-y", "20%");
  };

  const handleCardPointerMove = (event) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const dragIntensity = event.pointerType === "touch" ? 1.18 : 1;
    const intensity = isDraggingRef.current ? dragIntensity : 0.28;

    card.style.setProperty("--card-rotate-x", `${(-y * 16 * intensity).toFixed(2)}deg`);
    card.style.setProperty("--card-rotate-y", `${(x * 18 * intensity).toFixed(2)}deg`);
    card.style.setProperty("--card-glow-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    card.style.setProperty("--card-glow-y", `${((y + 0.5) * 100).toFixed(1)}%`);
  };

  const handleCardPointerDown = (event) => {
    const card = cardRef.current;
    if (!card || event.target.closest("button")) return;

    isDraggingRef.current = true;
    card.classList.add("is-dragging");
    card.setPointerCapture(event.pointerId);
    handleCardPointerMove(event);
  };

  const handleCardPointerUp = (event) => {
    const card = cardRef.current;
    if (!card) return;

    isDraggingRef.current = false;
    card.classList.remove("is-dragging");
    if (card.hasPointerCapture(event.pointerId)) {
      card.releasePointerCapture(event.pointerId);
    }

    if (event.pointerType === "touch") {
      resetCardTilt();
      return;
    }

    handleCardPointerMove(event);
  };

  const handleCardPointerLeave = () => {
    const card = cardRef.current;
    if (!card) return;

    isDraggingRef.current = false;
    card.classList.remove("is-dragging");
    resetCardTilt();
  };

  const adjustDuration = (amount) => {
    // Increment/decrement by 60 seconds (1 minute)
    // Min 1 minute, Max 60 minutes
    setGameDuration((prev) => Math.max(60, Math.min(3600, prev + amount)));
  };

  return (
    <>
      <div className={`home-screen-overlay ${theme}`}>
        <div
          className="home-content glass-panel"
          ref={cardRef}
          onPointerMove={handleCardPointerMove}
          onPointerDown={handleCardPointerDown}
          onPointerUp={handleCardPointerUp}
          onPointerCancel={handleCardPointerUp}
          onPointerLeave={handleCardPointerLeave}
        >
          <Logo size="large" className="home-logo" />

          <HomeScreenCategoryCarousel onStartGame={onStartGame} lang={lang} />
        </div>

        <div className="home-bottom-right">
          {/* Common component usage for uniform header actions + no more style drift */}
          <div
            className="home-podium-widget glass-panel"
            onClick={(e) => {
              e.stopPropagation();
              setLeaderboardOpen((prev) => !prev);
              setProfileOpen(false);
              setSettingsOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title={t("leaderboard")}
          >
            <div className="widget-spot rank-2">
              <div className="widget-avatar">
                <InvaderAvatar
                  invaderId={displayExplorers[1].profiles?.avatar_id || "invader_1"}
                  color={displayExplorers[1].profiles?.avatar_color || "cyan"}
                  size={20}
                />
              </div>
              <span className="widget-rank-num">2</span>
            </div>
            <div className="widget-spot rank-1">
              <div className="widget-avatar">
                <InvaderAvatar
                  invaderId={displayExplorers[0].profiles?.avatar_id || "invader_1"}
                  color={displayExplorers[0].profiles?.avatar_color || "cyan"}
                  size={20}
                />
              </div>
              <span className="widget-rank-num">1</span>
            </div>
            <div className="widget-spot rank-3">
              <div className="widget-avatar">
                <InvaderAvatar
                  invaderId={displayExplorers[2].profiles?.avatar_id || "invader_1"}
                  color={displayExplorers[2].profiles?.avatar_color || "cyan"}
                  size={20}
                />
              </div>
              <span className="widget-rank-num">3</span>
            </div>
          </div>

          <GlassIconButton
            className="profile-trigger-btn"
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen((prev) => !prev);
              setSettingsOpen(false);
              setLeaderboardOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title={t("xp_label", { current: xpInLevel, next: xpNeededForNext })}
          >
            {/* Inner container clips the XP progress fill to the rounded button shape */}
            <div className="profile-xp-progress-container">
              <span
                className="profile-xp-progress"
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
              />
            </div>
            <div className="profile-icon">
              <User width={20} height={20} />
            </div>
            <span className="profile-btn-level-tag">{level}</span>
          </GlassIconButton>

          <GlassIconButton
            className="settings-trigger-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((prev) => !prev);
              setProfileOpen(false);
              setLeaderboardOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title={t("settings")}
          >
            <Settings2 width={20} height={20} />
          </GlassIconButton>
        </div>
      </div>

      <div
        className={`panel-overlay ${settingsOpen || profileOpen || leaderboardOpen ? "open" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setSettingsOpen(false);
          setProfileOpen(false);
          setLeaderboardOpen(false);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />

      <div
        className={`sheet-panel settings-panel glass-panel ${settingsOpen ? "open" : ""} ${theme}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 className="panel-title">{t("settings")}</h2>
          <button
            className="panel-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen(false);
            }}
            title={t("close")}
          >
            <Close width={20} height={20} />
          </button>
        </div>

        <div className="panel-body scrollbar-styled">
          {/* Game Duration Selector */}
          <div className="settings-card glass-panel">
            <div className="settings-card-header">
              <span className="section-label">{t("game_duration")}</span>
            </div>

            <div className="settings-duration-display">
              <Clock width={18} height={18} className="duration-icon" />
              <span className="duration-value">{Math.floor(gameDuration / 60)} min</span>
            </div>

            <div className="settings-stepper-actions">
              <button
                type="button"
                className="settings-btn-stepper"
                onClick={(e) => {
                  e.stopPropagation();
                  adjustDuration(-60);
                }}
                title={t("minus_one_minute")}
              >
                <Minus width={16} height={16} />
                <span>-1 Min</span>
              </button>
              <button
                type="button"
                className="settings-btn-stepper"
                onClick={(e) => {
                  e.stopPropagation();
                  adjustDuration(60);
                }}
                title={t("plus_one_minute")}
              >
                <Plus width={16} height={16} />
                <span>+1 Min</span>
              </button>
            </div>
          </div>

          {/* Hardcore Mode Selector */}
          <div className="settings-card glass-panel">
            <div className="settings-card-header">
              <span className="section-label">{t("hardcore_mode")}</span>
            </div>
            <SegmentedControl
              options={[
                { value: "normal", label: t("hardcore_off") },
                {
                  value: "hardcore",
                  label: t("hardcore_on"),
                  icon: <Heart width={14} height={14} />,
                },
              ]}
              value={hardcoreMode ? "hardcore" : "normal"}
              onChange={(v) => setHardcoreMode?.(v === "hardcore")}
            />
            <p className="settings-hint">{t("hardcore_desc")}</p>
          </div>

          {/* Language Selector */}
          <div className="settings-card glass-panel">
            <div className="settings-card-header">
              <span className="section-label">Language / Langue</span>
            </div>
            <SegmentedControl
              options={[
                { value: "fr", label: "FR" },
                { value: "en", label: "EN" },
              ]}
              value={lang}
              onChange={(v) => setLang(v)}
            />
          </div>

          {/* Interface Theme Selector */}
          <div className="settings-card glass-panel">
            <div className="settings-card-header">
              <span className="section-label">{t("interface_theme")}</span>
            </div>
            <SegmentedControl
              options={[
                { value: "dark", label: t("theme_dark"), icon: <Moon width={14} height={14} /> },
                {
                  value: "light",
                  label: t("theme_light"),
                  icon: <CloudSun width={14} height={14} />,
                },
              ]}
              value={theme}
              onChange={(v) => setTheme(v)}
            />
          </div>

          {/* Globe Theme Selector */}
          <div className="settings-card glass-panel">
            <div className="settings-card-header">
              <span className="section-label">{t("globe_theme")}</span>
            </div>
            <SegmentedControl
              options={THEMES_LIST.map((tObj) => ({
                value: tObj.id,
                label: t(`theme_${tObj.id}`),
                icon:
                  tObj.id === "satellite" ? (
                    <Earth width={14} height={14} />
                  ) : (
                    <Globe width={14} height={14} />
                  ),
              }))}
              value={globeTheme}
              onChange={(v) => setGlobeTheme(v)}
            />
          </div>
        </div>
      </div>

      <ProfilePanel
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        isOpen={profileOpen}
        onClose={handleCloseProfile}
        lang={lang}
        theme={theme}
        localRecords={localRecords}
        session={session}
        onOpenAuth={handleOpenAuth}
      />

      <LeaderboardScreen
        userProfile={userProfile}
        localRecords={localRecords}
        onBack={() => setLeaderboardOpen(false)}
        lang={lang}
        theme={theme}
        isOpen={leaderboardOpen}
      />
    </>
  );
};

export default React.memo(HomeScreen);
