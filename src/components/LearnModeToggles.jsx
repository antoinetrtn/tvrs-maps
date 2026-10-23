import { Earth, Globe, Hash, MapPin, Waves } from "pixelarticons/react";
import React, { useMemo } from "react";

import { DEFAULT_LEARN_SUB_MODE } from "../config/gameConfig";
import { useTranslation } from "../config/i18n";
import TabBar from "./ui/TabBar";

const LearnModeToggles = ({ learnSubMode, onLearnSubModeChange, lang }) => {
  const t = useTranslation(lang);

  const subModesData = useMemo(
    () => [
      {
        value: "countries",
        icon: <Globe width={16} height={16} aria-hidden="true" />,
        label: t("learn_mode_countries"),
        title: t("mode_countries"),
      },
      {
        value: "capitals",
        icon: <MapPin width={16} height={16} aria-hidden="true" />,
        label: t("learn_mode_capitals"),
        title: t("mode_capitals"),
      },
      {
        value: "departments",
        icon: <Hash width={14} height={14} aria-hidden="true" />,
        label: t("learn_mode_departments"),
        title: t("mode_departments"),
      },
      {
        value: "us_states",
        icon: <Earth width={16} height={16} aria-hidden="true" />,
        label: t("learn_mode_us_states"),
        title: t("mode_us_states"),
      },
      {
        value: "rivers_mountains",
        icon: <Waves width={16} height={16} aria-hidden="true" />,
        label: t("learn_mode_rivers_mountains"),
        title: t("mode_rivers_mountains"),
      },
    ],
    [t]
  );

  const activeValue = subModesData.some((item) => item.value === learnSubMode)
    ? learnSubMode
    : DEFAULT_LEARN_SUB_MODE;

  return (
    <TabBar
      level={2}
      className="learn-mode-tabs learn-carousel-control"
      label={t("mode_learn")}
      options={subModesData}
      value={activeValue}
      onChange={onLearnSubModeChange}
    />
  );
};

export default React.memo(LearnModeToggles);
