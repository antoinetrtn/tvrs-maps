import "./HomeScreen.css";
import "./HomeDock.css";

import { Settings2, User } from "pixelarticons/react";
import React, { useCallback, useEffect, useState } from "react";

import { useTranslation } from "../config/i18n";
import useMountedOnce from "../hooks/useMountedOnce";
import { getLevelAndProgress } from "../utils/gamification";
import GlassIconButton from "./GlassIconButton";
import { getHomeHeroText } from "./homeHeroText";
import HomeScreenCategoryCarousel from "./HomeScreenCategoryCarousel";
import InvaderAvatar from "./InvaderAvatar";
import Logo from "./Logo";
import ModeShutter from "./ModeShutter";
import XpBar from "./XpBar";

const ConquestRulesSheet = React.lazy(() => import("../multiplayer/ConquestRulesSheet.jsx"));
const LeaderboardScreen = React.lazy(() => import("./LeaderboardScreen"));
const ProfilePanel = React.lazy(() => import("./ProfilePanel"));
const SettingsPanel = React.lazy(() => import("./SettingsPanel"));
const TrainingSheet = React.lazy(() => import("./TrainingSheet"));

const HomeScreen = ({
  onStartGame,
  onOpenConquest = null,
  lang,
  setLang,
  gameDuration,
  setGameDuration,
  _hardcoreMode = true,
  setHardcoreMode,
  peacefulMode = false,
  setPeacefulMode,
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
  const [trainingMode, setTrainingMode] = useState(null);
  // Lazy panels: fetched on first open, then kept mounted (exit animations).
  const settingsMounted = useMountedOnce(settingsOpen);
  const profileMounted = useMountedOnce(profileOpen);
  const leaderboardMounted = useMountedOnce(leaderboardOpen);
  const conquestRulesMounted = useMountedOnce(conquestRulesOpen);
  const trainingMounted = useMountedOnce(Boolean(trainingMode));
  const t = useTranslation(lang);
  const hero = getHomeHeroText(lang);

  useEffect(() => {
    if (exiting) {
      setSettingsOpen(false);
      setProfileOpen(false);
      setLeaderboardOpen(false);
      setConquestRulesOpen(false);
      setTrainingMode(null);
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
        className={`home-screen-overlay ${exiting ? "is-exiting" : ""}`}
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
            onOpenTraining={setTrainingMode}
            lang={lang}
            homeMode={homeMode}
            setHomeMode={setHomeMode}
            exiting={exiting}
          />
        </div>

        <div className="home-bottom-right" role="toolbar" aria-label={t("settings")}>
          <GlassIconButton
            look={["dock-segment", "dock-podium"]}
            onClick={(e) => {
              e.stopPropagation();
              setLeaderboardOpen((prev) => !prev);
              setProfileOpen(false);
              setSettingsOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t("leaderboard")}
            data-tooltip={t("leaderboard")}
            label={t("leaderboard")}
          >
            <div className="home-podium-spots">
              <div className="widget-spot rank-2">
                <span className="widget-rank-num">2</span>
                <InvaderAvatar
                  invaderId={displayExplorers[1].profiles?.avatar_id || "invader_1"}
                  color="currentColor"
                  size={16}
                />
              </div>
              <div className="widget-spot rank-1">
                <span className="widget-rank-num">1</span>
                <InvaderAvatar
                  invaderId={displayExplorers[0].profiles?.avatar_id || "invader_1"}
                  color="currentColor"
                  size={16}
                />
              </div>
              <div className="widget-spot rank-3">
                <span className="widget-rank-num">3</span>
                <InvaderAvatar
                  invaderId={displayExplorers[2].profiles?.avatar_id || "invader_1"}
                  color="currentColor"
                  size={16}
                />
              </div>
            </div>
          </GlassIconButton>

          <GlassIconButton
            look={["dock-segment", "dock-profile"]}
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen((prev) => !prev);
              setSettingsOpen(false);
              setLeaderboardOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t("profile")}
            data-tooltip={t("profile")}
            label={t("profile")}
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
            look={["dock-segment", "dock-settings"]}
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((prev) => !prev);
              setProfileOpen(false);
              setLeaderboardOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t("settings")}
            data-tooltip={t("settings")}
            label={t("settings")}
          >
            <div className="settings-icon">
              <Settings2 width={20} height={20} />
            </div>
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
        aria-hidden="true"
      />

      {settingsMounted && (
        <React.Suspense fallback={null}>
          <SettingsPanel
            open={settingsOpen}
            onClose={(e) => {
              e?.stopPropagation();
              setSettingsOpen(false);
            }}

            lang={lang}
            setLang={setLang}
            gameDuration={gameDuration}
            setGameDuration={setGameDuration}
            peacefulMode={peacefulMode}
            setPeacefulMode={setPeacefulMode}
            setHardcoreMode={setHardcoreMode}
          />
        </React.Suspense>
      )}

      {profileMounted && (
        <React.Suspense fallback={null}>
          <ProfilePanel
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            isOpen={profileOpen}
            onClose={handleCloseProfile}
            lang={lang}

            localRecords={localRecords}
            session={session}
            onOpenAuth={handleOpenAuth}
          />
        </React.Suspense>
      )}

      {leaderboardMounted && (
        <React.Suspense fallback={null}>
          <LeaderboardScreen
            userProfile={userProfile}
            localRecords={localRecords}
            localGameHistory={localGameHistory}
            session={session}
            onBack={() => setLeaderboardOpen(false)}
            lang={lang}

            isOpen={leaderboardOpen}
          />
        </React.Suspense>
      )}

      {conquestRulesMounted && (
        <React.Suspense fallback={null}>
          <ConquestRulesSheet
            open={conquestRulesOpen}
            onClose={handleCloseConquestRules}
            lang={lang}
          />
        </React.Suspense>
      )}
      {trainingMounted && (
        <React.Suspense fallback={null}>
          <TrainingSheet
            open={Boolean(trainingMode)}
            mode={trainingMode || "countries"}
            lang={lang}
            profileId={userProfile?.id}
            onClose={() => setTrainingMode(null)}
            onStart={(pool) => onStartGame(trainingMode, undefined, pool)}
          />
        </React.Suspense>
      )}
    </>
  );
};

export default React.memo(HomeScreen);
