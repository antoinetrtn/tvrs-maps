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
} from "pixelarticons/react";
import Logo from "./Logo";
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
}) => {
  const cardRef = useRef(null);
  const isDraggingRef = useRef(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const t = useTranslation(lang);

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
        ref={cardRef}
        className="home-content"
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

      <div className="home-bottom-right">
        <div className="timer-toggle-wrap glass-panel">
          <button
            className="timer-btn"
            onClick={() => adjustDuration(-60)}
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
            onClick={() => adjustDuration(60)}
            title={t("plus_one_minute")}
          >
            <Plus width={16} height={16} />
          </button>
        </div>

        <div className="lang-toggle-wrap glass-panel">
          <button
            className={`lang-btn ${lang === "fr" ? "active" : ""}`}
            onClick={() => setLang("fr")}
          >
            FR
          </button>
          <div className="lang-divider" />
          <button
            className={`lang-btn ${lang === "en" ? "active" : ""}`}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </div>
        <button
          className="theme-toggle-btn glass-panel"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={t("dark_light_mode")}
        >
          {theme === "dark" ? (
            <CloudSun width={20} height={20} />
          ) : (
            <Moon width={20} height={20} />
          )}
        </button>

        <div className="globe-theme-container">
          <button
            className={`theme-toggle-btn glass-panel ${themeMenuOpen ? "active" : ""}`}
            onClick={() => setThemeMenuOpen((prev) => !prev)}
            onPointerDown={(e) => e.preventDefault()}
            title={t("globe_theme")}
          >
            <Settings2 width={20} height={20} />
          </button>
          {themeMenuOpen && (
            <div className="globe-theme-menu glass-panel animation-fade-in">
              {THEMES_LIST.map((t) => (
                <button
                  key={t.id}
                  className={`globe-theme-menu-item ${globeTheme === t.id ? "active" : ""}`}
                  onClick={() => {
                    setGlobeTheme(t.id);
                    setThemeMenuOpen(false);
                  }}
                  onPointerDown={(e) => e.preventDefault()}
                >
                  <span className={`theme-dot ${t.id}`} />
                  <span className="theme-name">
                    {t(`theme_${t.id}`)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(HomeScreen);
