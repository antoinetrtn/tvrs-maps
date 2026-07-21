import { ChevronLeft, ChevronRight, Earth, Globe, Hash, MapPin, Waves } from "pixelarticons/react";
import React, { useMemo } from "react";

import { useTranslation } from "../config/i18n";

const LearnModeToggles = ({ learnSubMode, onLearnSubModeChange, lang }) => {
  const t = useTranslation(lang);

  const subModesData = useMemo(() => {
    return [
      {
        value: "countries",
        icon: <Globe width={16} height={16} />,
        label: t("learn_mode_countries"),
      },
      {
        value: "capitals",
        icon: <MapPin width={16} height={16} />,
        label: t("learn_mode_capitals"),
      },
      {
        value: "departments",
        icon: <Hash width={14} height={14} />,
        label: t("learn_mode_departments"),
      },
      {
        value: "us_states",
        icon: <Earth width={16} height={16} />,
        label: t("learn_mode_us_states"),
      },
      {
        value: "rivers_mountains",
        icon: <Waves width={16} height={16} />,
        label: t("learn_mode_rivers_mountains"),
      },
    ];
  }, [t]);

  const currentIndex = subModesData.findIndex((item) => item.value === learnSubMode);
  const activeIndex = currentIndex !== -1 ? currentIndex : 0;

  const handlePrev = () => {
    const nextIdx = (activeIndex - 1 + subModesData.length) % subModesData.length;
    onLearnSubModeChange(subModesData[nextIdx].value);
  };

  const handleNext = () => {
    const nextIdx = (activeIndex + 1) % subModesData.length;
    onLearnSubModeChange(subModesData[nextIdx].value);
  };

  const activeItem = subModesData[activeIndex];

  return (
    <div className="learn-carousel-control">
      <button className="learn-carousel-arrow" onClick={handlePrev} title={t("previous")}>
        <ChevronLeft width={18} height={18} />
      </button>
      <div className="learn-carousel-content">
        <span className="learn-carousel-icon">{activeItem.icon}</span>
        <span className="learn-carousel-label">{activeItem.label}</span>
      </div>
      <button className="learn-carousel-arrow" onClick={handleNext} title={t("next")}>
        <ChevronRight width={18} height={18} />
      </button>
    </div>
  );
};

export default React.memo(LearnModeToggles);
