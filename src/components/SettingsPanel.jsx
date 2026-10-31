import "./ui/ui.css";

import React from "react";

import { useTranslation } from "../config/i18n";
import GlobeDisplaySettings from "./GlobeDisplaySettings";
import Dialog, { DialogTitle } from "./ui/Dialog";
import OptionGroup from "./ui/OptionGroup";
import PanelCloseButton from "./ui/PanelCloseButton";
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
}) => {
  const t = useTranslation(lang);
  const minutes = Math.round(gameDuration / 60);

  const setPeaceful = (isPeaceful) => {
    setPeacefulMode?.(isPeaceful);
    if (!setPeacefulMode && setHardcoreMode) setHardcoreMode(!isPeaceful);
  };

  return (
    <Dialog
      variant="panel"
      open={open}
      onClose={onClose}
      theme={theme}
      labelledBy="settings-panel-title"
      className="settings-panel glass-panel"
    >
      <div className="panel-header">
        <DialogTitle className="panel-title">{t("settings")}</DialogTitle>
        <PanelCloseButton label={t("close")} onClick={onClose} />
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
          <GlobeDisplaySettings t={t} />
        </SettingsSection>
      </div>
    </Dialog>
  );
};

export default SettingsPanel;
