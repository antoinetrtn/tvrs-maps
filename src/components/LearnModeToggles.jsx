import React from "react";
import { Globe, MapPin, Waves, TreePine, Hash, InfoBox } from "pixelarticons/react";
import { useTranslation } from "../config/i18n";

const LearnModeToggles = ({
  learnToggles,
  onToggleLearn,
  onToggleLearnPanel,
  showLearnPanel,
  lang,
  showTableButton = false,
  compact = false,
}) => {
  const t = useTranslation(lang);
  const {
    showCountryLabels,
    showCapitals,
    showRivers,
    showMountains,
    showDepartments,
  } = learnToggles;

  return (
    <div className={`learn-toggles-group glass-panel ${compact ? "compact" : ""}`}>
      <button
        className={`learn-toggle-btn ${showCountryLabels ? "active" : ""}`}
        onClick={() => onToggleLearn("showCountryLabels")}
        onMouseDown={(e) => e.preventDefault()}
        title={t("show_country_labels")}
      >
        <Globe width={16} height={16} />
      </button>
      <button
        className={`learn-toggle-btn ${showCapitals ? "active" : ""}`}
        onClick={() => onToggleLearn("showCapitals")}
        onMouseDown={(e) => e.preventDefault()}
        title={t("show_capitals")}
      >
        <MapPin width={16} height={16} />
      </button>
      <button
        className={`learn-toggle-btn ${showRivers ? "active" : ""}`}
        onClick={() => onToggleLearn("showRivers")}
        onMouseDown={(e) => e.preventDefault()}
        title={t("show_rivers")}
      >
        <Waves width={16} height={16} />
      </button>
      <button
        className={`learn-toggle-btn ${showMountains ? "active" : ""}`}
        onClick={() => onToggleLearn("showMountains")}
        onMouseDown={(e) => e.preventDefault()}
        title={t("show_mountains")}
      >
        <TreePine width={16} height={16} />
      </button>
      <button
        className={`learn-toggle-btn ${showDepartments ? "active" : ""}`}
        onClick={() => onToggleLearn("showDepartments")}
        onMouseDown={(e) => e.preventDefault()}
        title={t("show_departments")}
      >
        <Hash width={16} height={16} />
      </button>
      {showTableButton && (
        <button
          className={`learn-toggle-btn ${showLearnPanel ? "active" : ""}`}
          onClick={onToggleLearnPanel}
          onMouseDown={(e) => e.preventDefault()}
          title={t("data_table")}
        >
          <InfoBox width={16} height={16} />
        </button>
      )}
    </div>
  );
};

export default React.memo(LearnModeToggles);