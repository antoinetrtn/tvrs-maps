import "./HomeScreen.css";

import { Settings2, User } from "pixelarticons/react";
import React, { useCallback, useEffect, useState } from "react";

import { useTranslation } from "../config/i18n";
import ConquestRulesSheet from "../multiplayer/ConquestRulesSheet.jsx";
import { getLevelAndProgress } from "../utils/gamification";
import GlassIconButton from "./GlassIconButton";
import { getHomeHeroText } from "./homeHeroText";
import HomeScreenCategoryCarousel from "./HomeScreenCategoryCarousel";
import InvaderAvatar from "./InvaderAvatar";
import LeaderboardScreen from "./LeaderboardScreen";
import Logo from "./Logo";
import ModeShutter from "./ModeShutter";
import ProfilePanel from "./ProfilePanel";
import SettingsPanel from "./SettingsPanel";
import XpBar from "./XpBar";

const HomeScreen = ({
  onStartGame,
  onOpenConquest = null,
  theme,
  _setTheme,
  lang,
  setLang,
  gameDuration,
  setGameDuration,
  _hardcoreMode = true,
  setHardcoreMode,
  peacefulMode = false,
  setPeacefulMode,
  globeTheme,
  setGlobeTheme,
  accent,
  setAccent,
  topExplorers = [],
  userProfile,
  setUserProfile,
  localRecords = {},
  localGameHistory = [],
  session = null,
  onOpenAuth,
  homeMode,
  setHomeMode,
  exiting = false,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [conquestRulesOpen, setConquestRulesOpen] = useState(false);
  const t = useTranslation(lang);
  const hero = getHomeHeroText(lang);

  useEffect(() => {
    if (exiting) {
      setSettingsOpen(false);
      setProfileOpen(false);
      setLeaderboardOpen(false);
      setConquestRulesOpen(false);
    }
  }, [exiting]);

  const handleCloseProfile = useCallback(() => setProfileOpen(false), []);
  const handleOpenConquestRules = useCallback(() => setConquestRulesOpen(true), []);
  const handleCloseConquestRules = useCallback(() => setConquestRulesOpen(false), []);

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

  return (
    <>
      <ModeShutter screen="home" />
      <div
        className={`home-screen-overlay ${theme} ${exiting ? "is-exiting" : ""}`}
        inert={exiting ? "" : undefined}
        aria-hidden={exiting ? "true" : undefined}
      >
        <header className="home-hero">
          <Logo size="medium" className="home-hero-logo" />
          <h1 className="home-hero-title">{hero.title}</h1>
          <p className="home-hero-sub sr-only">{hero.sub}</p>
        </header>
        <div className="home-stage-container">
          <HomeScreenCategoryCarousel
            onStartGame={onStartGame}
            onOpenConquest={onOpenConquest}
            onOpenConquestRules={handleOpenConquestRules}
            lang={lang}
            homeMode={homeMode}
            setHomeMode={setHomeMode}
            exiting={exiting}
          />
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
            <div className="profile-icon">
              <User width={20} height={20} />
            </div>
            <XpBar
              variant="mini"
              percent={percent}
              label={t("xp_label", { current: xpInLevel, next: xpNeededForNext })}
              className="profile-btn-xp-bar"
            />
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

      <SettingsPanel
        open={settingsOpen}
        onClose={(e) => {
          e?.stopPropagation();
          setSettingsOpen(false);
        }}
        theme={theme}
        lang={lang}
        setLang={setLang}
        gameDuration={gameDuration}
        setGameDuration={setGameDuration}
        peacefulMode={peacefulMode}
        setPeacefulMode={setPeacefulMode}
        setHardcoreMode={setHardcoreMode}
        globeTheme={globeTheme}
        setGlobeTheme={setGlobeTheme}
        accent={accent}
        setAccent={setAccent}
      />

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
        localGameHistory={localGameHistory}
        session={session}
        onBack={() => setLeaderboardOpen(false)}
        lang={lang}
        theme={theme}
        isOpen={leaderboardOpen}
      />

      <ConquestRulesSheet open={conquestRulesOpen} onClose={handleCloseConquestRules} lang={lang} />
    </>
  );
};

export default React.memo(HomeScreen);
