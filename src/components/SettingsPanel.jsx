import "./ui/ui.css";

import { Close, Earth, Globe } from "pixelarticons/react";
import React from "react";

import { useTranslation } from "../config/i18n";
import AccentPicker from "./AccentPicker";
import GlobeDisplaySettings from "./GlobeDisplaySettings";
import OptionGroup from "./ui/OptionGroup";
import { SettingsRow, SettingsSection } from "./ui/Settings";
import Slider from "./ui/Slider";
import Switch from "./ui/Switch";

const MIN_DURATION_MIN = 1;
const MAX_DURATION_MIN = 60;

/** Settings sheet, rebuilt on the ui/ kit (Slider, Switch, OptionGroup, Settings*). */
const SettingsPanel = ({
  open,
  onClose,
  theme,
  lang,
  setLang,
  gameDuration,
  setGameDuration,
  peacefulMode,
  setPeacefulMode,
  setHardcoreMode,
  globeTheme,
  setGlobeTheme,
  accent,
  setAccent,
}) => {
  const t = useTranslation(lang);
  const minutes = Math.round(gameDuration / 60);

  const setPeaceful = (isPeaceful) => {
    setPeacefulMode?.(isPeaceful);
    if (!setPeacefulMode && setHardcoreMode) setHardcoreMode(!isPeaceful);
  };

  return (
    // Sheet container: stops clicks/pointers reaching the globe layer behind and
    // closes on Escape. It is a dialog surface, not a control.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-labelledby="settings-panel-title"
      className={`sheet-panel settings-panel glass-panel ${open ? "open" : ""} ${theme}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose?.(e);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="panel-header">
        <h2 className="panel-title" id="settings-panel-title">
          {t("settings")}
        </h2>
        <button className="panel-close-btn" onClick={onClose} title={t("close")}>
          <Close width={20} height={20} />
        </button>
      </div>

      <div className="panel-body scrollbar-styled">
        <SettingsSection title={t("settings_section_game")} hideTitle>
          <SettingsRow layout="stacked">
            <Slider
              label={t("game_duration_short")}
              value={minutes}
              min={MIN_DURATION_MIN}
              max={MAX_DURATION_MIN}
              step={1}
              onChange={(m) => setGameDuration(m * 60)}
              formatValue={(m) => `${m} min`}
              decrementLabel={t("minus_one_minute")}
              incrementLabel={t("plus_one_minute")}
            />
          </SettingsRow>
          <SettingsRow
            label={t("peaceful_mode_short")}
            srDescription={peacefulMode ? t("peaceful_desc") : t("peaceful_off")}
          >
            <Switch
              checked={Boolean(peacefulMode)}
              onChange={setPeaceful}
              label={t("peaceful_mode")}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={t("settings_section_display")} hideTitle>
          <SettingsRow layout="stacked">
            <OptionGroup
              label="Language / Langue"
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
              ]}
              value={lang}
              onChange={setLang}
            />
          </SettingsRow>
          <SettingsRow layout="stacked">
            <OptionGroup
              label={t("globe_theme")}
              options={[
                {
                  value: "monochrome",
                  label: t("theme_blackout"),
                  icon: <Globe width={14} height={14} />,
                },
                {
                  value: "satellite",
                  label: t("theme_satellite"),
                  icon: <Earth width={14} height={14} />,
                },
              ]}
              value={globeTheme}
              onChange={setGlobeTheme}
            />
          </SettingsRow>
          <GlobeDisplaySettings t={t} />
          <SettingsRow layout="stacked">
            <AccentPicker
              lang={lang}
              accent={accent}
              setAccent={setAccent}
              label={t("accent_color")}
            />
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  );
};

export default SettingsPanel;
