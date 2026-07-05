import React, { useRef, useState } from "react";
import {
  Globe,
  MapPin,
  BookOpen,
  CloudSun,
  Moon,
  Clock,
  Plus,
  Minus,
  Hash,
  Settings2,
  TreePine,
  Close,
  Earth,
  User,
  Trophy,
} from "pixelarticons/react";
import Logo from "./Logo";
import InvaderAvatar from "./InvaderAvatar";
import { THEMES_LIST } from "./designSystem";
import { useTranslation } from "./i18n";
import "./HomeScreen.css";

const HomeScreen = ({
  onStartGame,
  theme,
  setTheme,
  lang,
  setLang,
  gameDuration,
  setGameDuration,
  globeTheme,
  setGlobeTheme,
  onOpenProfile,
  topExplorers = [],
}) => {
  const cardRef = useRef(null);
  const isDraggingRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const t = useTranslation(lang);

  const formatTime = (secs) => {
    if (!secs) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const displayExplorers = [...topExplorers];
  while (displayExplorers.length < 3) {
    displayExplorers.push({
      id: `placeholder-${displayExplorers.length}`,
      score: 0,
      time_spent_seconds: 0,
      profiles: {
        username: "???",
        avatar_id: "invader_1",
        avatar_color: "gray"
      }
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

    card.style.setProperty(
      "--card-rotate-x",
      `${(-y * 16 * intensity).toFixed(2)}deg`,
    );
    card.style.setProperty(
      "--card-rotate-y",
      `${(x * 18 * intensity).toFixed(2)}deg`,
    );
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



        <div className="home-buttons">
          <button
            className="home-btn mode-countries"
            onClick={() => onStartGame("countries")}
          >
            <Globe width={20} height={20} />
            <span className="btn-title">{t("mode_countries")}</span>
          </button>

          <button
            className="home-btn mode-capitals"
            onClick={() => onStartGame("capitals")}
          >
            <MapPin width={20} height={20} />
            <span className="btn-title">{t("mode_capitals")}</span>
          </button>

          <button
            className="home-btn mode-departments"
            onClick={() => onStartGame("departments")}
          >
            <Hash width={18} height={18} className="home-btn-icon hash-icon" />
            <span className="btn-title">{t("mode_departments")}</span>
          </button>

          <button
            className="home-btn mode-rivers-mountains"
            onClick={() => onStartGame("rivers_mountains")}
          >
            <TreePine width={20} height={20} />
            <span className="btn-title">{t("mode_rivers_mountains")}</span>
          </button>

          <button
            className="home-btn mode-learn"
            onClick={() => onStartGame("learn")}
          >
            <BookOpen width={20} height={20} />
            <span className="btn-title">{t("mode_learn")}</span>
          </button>
      </div>
    </div>

    <div className="home-podium-card glass-panel">
        <h3 className="podium-section-title">{t("top_explorers")}</h3>
        <div className="home-podium-grid">
          {/* 2nd place */}
          <div className="podium-spot spot-2">
            <div className="podium-avatar">
              <InvaderAvatar
                invaderId={displayExplorers[1].profiles?.avatar_id || "invader_1"}
                color={displayExplorers[1].profiles?.avatar_color || "cyan"}
                size={20}
              />
            </div>
            <div className="podium-user truncate">{displayExplorers[1].profiles?.username}</div>
            <div className="podium-details">
              <span className="p-score">{displayExplorers[1].score}</span>
              <span className="p-time">{formatTime(displayExplorers[1].time_spent_seconds)}</span>
            </div>
            <div className="podium-pedestal p-step-2">2</div>
          </div>

          {/* 1st place */}
          <div className="podium-spot spot-1">
            <div className="podium-avatar">
              <InvaderAvatar
                invaderId={displayExplorers[0].profiles?.avatar_id || "invader_1"}
                color={displayExplorers[0].profiles?.avatar_color || "cyan"}
                size={24}
              />
            </div>
            <div className="podium-user truncate">{displayExplorers[0].profiles?.username}</div>
            <div className="podium-details">
              <span className="p-score">{displayExplorers[0].score}</span>
              <span className="p-time">{formatTime(displayExplorers[0].time_spent_seconds)}</span>
            </div>
            <div className="podium-pedestal p-step-1">1</div>
          </div>

          {/* 3rd place */}
          <div className="podium-spot spot-3">
            <div className="podium-avatar">
              <InvaderAvatar
                invaderId={displayExplorers[2].profiles?.avatar_id || "invader_1"}
                color={displayExplorers[2].profiles?.avatar_color || "cyan"}
                size={18}
              />
            </div>
            <div className="podium-user truncate">{displayExplorers[2].profiles?.username}</div>
            <div className="podium-details">
              <span className="p-score">{displayExplorers[2].score}</span>
              <span className="p-time">{formatTime(displayExplorers[2].time_spent_seconds)}</span>
            </div>
            <div className="podium-pedestal p-step-3">3</div>
          </div>
        </div>
      </div>

      <div className="home-bottom-right">
        <button
          className="profile-trigger-btn glass-panel"
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title={t("profile")}
        >
          <User width={20} height={20} />
        </button>

        <button
          className="settings-trigger-btn glass-panel"
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen((prev) => !prev);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title={t("settings")}
        >
          <Settings2 width={20} height={20} />
        </button>
      </div>

      <div
        className={`settings-backdrop ${settingsOpen ? "open" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setSettingsOpen(false);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />

      <div
        className={`settings-panel glass-panel ${settingsOpen ? "open" : ""} ${theme}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2 className="settings-title">{t("settings")}</h2>
          <button
            className="settings-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen(false);
            }}
            title={t("close")}
          >
            <Close width={20} height={20} />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <span className="section-label">{t("game_duration")}</span>
            <div className="timer-toggle-wrap glass-panel">
              <button
                className="timer-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  adjustDuration(-60);
                }}
                title={t("minus_one_minute")}
              >
                <Minus width={16} height={16} />
              </button>
              <div className="timer-display">
                <Clock width={16} height={16} className="timer-icon" />
                <span>{Math.floor(gameDuration / 60)}'</span>
              </div>
              <button
                className="timer-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  adjustDuration(60);
                }}
                title={t("plus_one_minute")}
              >
                <Plus width={16} height={16} />
              </button>
            </div>
          </div>

          <div className="settings-section">
            <span className="section-label">Language / Langue</span>
            <div className="lang-toggle-wrap glass-panel">
              <button
                className={`lang-btn ${lang === "fr" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLang("fr");
                }}
              >
                FR
              </button>
              <button
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLang("en");
                }}
              >
                EN
              </button>
            </div>
          </div>

          <div className="settings-section">
            <span className="section-label">{t("interface_theme")}</span>
            <div className="theme-toggle-wrap-horizontal glass-panel">
              <button
                className={`theme-opt-btn ${theme === "light" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTheme("light");
                }}
              >
                <CloudSun width={16} height={16} />
                <span>{t("theme_light")}</span>
              </button>
              <button
                className={`theme-opt-btn ${theme === "dark" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTheme("dark");
                }}
              >
                <Moon width={16} height={16} />
                <span>{t("theme_dark")}</span>
              </button>
            </div>
          </div>

          <div className="settings-section">
            <span className="section-label">{t("globe_theme")}</span>
            <div className="theme-toggle-wrap-horizontal glass-panel">
              {THEMES_LIST.map((themeObj) => (
                <button
                  key={themeObj.id}
                  className={`theme-opt-btn ${globeTheme === themeObj.id ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setGlobeTheme(themeObj.id);
                  }}
                >
                  {themeObj.id === "satellite" ? (
                    <Earth width={16} height={16} />
                  ) : (
                    <Globe width={16} height={16} />
                  )}
                  <span>{t(`theme_${themeObj.id}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(HomeScreen);
