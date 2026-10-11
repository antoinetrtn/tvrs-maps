import "./HomeScreen.css";
import "./homeLayouts.proto.css";

import { Chess, Settings2, User } from "pixelarticons/react";
import React, { useCallback, useState } from "react";

import { useTranslation } from "../config/i18n";
import { getLevelAndProgress } from "../utils/gamification";
import GlassIconButton from "./GlassIconButton";
import HomeBrand from "./HomeBrand";
import HomeScreenCategoryCarousel from "./HomeScreenCategoryCarousel";
import InvaderAvatar from "./InvaderAvatar";
import LeaderboardScreen from "./LeaderboardScreen";
import Logo from "./Logo";
import ProfilePanel from "./ProfilePanel";
import SettingsPanel from "./SettingsPanel";

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
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const t = useTranslation(lang);
  // PROTOTYPE: ?homeLayout=1|2|3 previews the home layout proposals.
  const [protoLayout] = useState(() => {
    const v = new URLSearchParams(window.location.search).get("homeLayout");
    return ["1", "2", "3"].includes(v) ? v : null;
  });
  const [protoLogoPos] = useState(
    () => new URLSearchParams(window.location.search).get("logoPos") || "left"
  );

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

  return (
    <>
      <div className={`home-screen-overlay ${theme}`} data-home-layout={protoLayout || undefined}>
        {protoLayout === "1" && <HomeBrand className="brand-corner" />}
        {protoLayout === "2" && (
          <header className="home-hud-header">
            <HomeBrand />
            <span className="home-hud-rec">
              <i aria-hidden="true" /> {lang === "fr" ? "EN LIGNE" : "LIVE"}
            </span>
            <span className="home-hud-ticker">
              {lang === "fr"
                ? "236 PAYS · 5 MODES · CONQUÊTE 1V1 · 48°51′N 2°21′E"
                : "236 COUNTRIES · 5 MODES · 1V1 CONQUEST · 48°51′N 2°21′E"}
            </span>
          </header>
        )}
        {protoLayout === "2" && <div className="home-viewfinder" aria-hidden="true" />}
        {protoLayout === "3" && (
          <div className={`home-hero logo-${protoLogoPos}`}>
            <Logo size="medium" variant="vector" className="home-hero-logo" />
            <h1 className="home-hero-title">
              {lang === "fr" ? (
                <>
                  Le monde
                  <br />
                  en 15 minutes.
                </>
              ) : (
                <>
                  The world
                  <br />
                  in 15 minutes.
                </>
              )}
            </h1>
            <p className="home-hero-sub">
              {lang === "fr"
                ? "236 pays à retrouver sur le globe. Combien en connais-tu ?"
                : "236 countries to find on the globe. How many do you know?"}
            </p>
          </div>
        )}
        <div className="home-stage-container">
          {protoLayout === "1" && <span className="home-sheet-handle" aria-hidden="true" />}
          {!protoLayout && <Logo size="large" className="home-logo" />}
          <HomeScreenCategoryCarousel
            onStartGame={onStartGame}
            lang={lang}
            homeMode={homeMode}
            setHomeMode={setHomeMode}
          />
          {onOpenConquest && (
            <button type="button" className="conquest-home-entry" onClick={onOpenConquest}>
              <Chess width={18} height={18} className="conquest-home-icon" aria-hidden="true" />
              <span className="conquest-home-label">
                {lang === "fr" ? "Conquête 1v1" : "Conquest 1v1"}
              </span>
              <span className="conquest-home-badge">{lang === "fr" ? "Nouveau" : "New"}</span>
            </button>
          )}
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
    </>
  );
};

export default React.memo(HomeScreen);
