import { Globe, Hash, MapPin, Waves } from "pixelarticons/react";
import React, { useMemo } from "react";

import { LEARN_SUB_MODES } from "../config/gameConfig";
import { useTranslation } from "../config/i18n";
import SegmentedControl from "./SegmentedControl";

const LearnModeToggles = ({ learnSubMode, onLearnSubModeChange, lang }) => {
  const t = useTranslation(lang);

  const options = useMemo(
    () =>
      LEARN_SUB_MODES.map((value) => {
        const icons = {
          countries: <Globe width={14} height={14} />,
          capitals: <MapPin width={14} height={14} />,
          rivers_mountains: <Waves width={14} height={14} />,
          departments: <Hash width={14} height={14} />,
        };
        const labels = {
          countries: t("learn_mode_countries"),
          capitals: t("learn_mode_capitals"),
          rivers_mountains: t("learn_mode_rivers_mountains"),
          departments: t("learn_mode_departments"),
        };
        return {
          value,
          label: labels[value],
          icon: icons[value],
        };
      }),
    [t]
  );

  return (
    <SegmentedControl
      className="learn-submode-control"
      size="sm"
      options={options}
      value={learnSubMode}
      onChange={onLearnSubModeChange}
    />
  );
};

export default React.memo(LearnModeToggles);
