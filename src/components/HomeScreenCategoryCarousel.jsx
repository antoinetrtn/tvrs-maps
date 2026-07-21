import "./HomeScreenCategoryCarousel.css";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Earth,
  Globe,
  Hash,
  MapPin,
  TreePine,
} from "pixelarticons/react";
import React, { useState } from "react";

import { useTranslation } from "../config/i18n";

const CATEGORIES = [
  {
    id: "world",
    titleFr: "Cartographie Mondiale",
    titleEn: "World Mapping",
    descFr: "Explorez le globe terrestre.",
    descEn: "Explore the Earth's globe.",
    modes: [
      {
        key: "countries",
        icon: <Globe width={20} height={20} />,
        titleFr: "Pays du Monde",
        titleEn: "World Countries",
      },
      {
        key: "capitals",
        icon: <MapPin width={20} height={20} />,
        titleFr: "Capitales",
        titleEn: "Capitals",
      },
    ],
  },
  {
    id: "regional",
    titleFr: "Cartes Régionales",
    titleEn: "Regional Maps",
    descFr: "Testez vos connaissances locales.",
    descEn: "Test your local knowledge.",
    modes: [
      {
        key: "departments",
        icon: <Hash width={18} height={18} className="home-btn-icon hash-icon" />,
        titleFr: "Départements",
        titleEn: "Departments",
      },
      {
        key: "us_states",
        icon: <Earth width={20} height={20} />,
        titleFr: "États Américains",
        titleEn: "US States",
      },
    ],
  },
  {
    id: "reliefs",
    titleFr: "Reliefs & Éléments",
    titleEn: "Reliefs & Elements",
    descFr: "Identifiez les fleuves et montagnes.",
    descEn: "Identify rivers and peaks.",
    modes: [
      {
        key: "rivers_mountains",
        icon: <TreePine width={20} height={20} />,
        titleFr: "Reliefs & Fleuves",
        titleEn: "Rivers & Peaks",
      },
    ],
  },
];

const HomeScreenCategoryCarousel = ({ onStartGame, lang }) => {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const t = useTranslation(lang);

  const nextCategory = (e) => {
    e.stopPropagation();
    setActiveCategoryIndex((prev) => (prev + 1) % CATEGORIES.length);
  };

  const prevCategory = (e) => {
    e.stopPropagation();
    setActiveCategoryIndex((prev) => (prev - 1 + CATEGORIES.length) % CATEGORIES.length);
  };

  const activeCategory = CATEGORIES[activeCategoryIndex];

  return (
    <div className="category-carousel">
      <div className="carousel-header">
        <button className="carousel-arrow" onClick={prevCategory}>
          <ChevronLeft width={18} height={18} />
        </button>
        <div className="carousel-info">
          <span className="carousel-category-title">
            {lang === "fr" ? activeCategory.titleFr : activeCategory.titleEn}
          </span>
        </div>
        <button className="carousel-arrow" onClick={nextCategory}>
          <ChevronRight width={18} height={18} />
        </button>
      </div>

      <div className="carousel-dots">
        {CATEGORIES.map((_, idx) => (
          <button
            type="button"
            key={idx}
            className={`carousel-dot ${idx === activeCategoryIndex ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveCategoryIndex(idx);
            }}
          />
        ))}
      </div>

      <div className="home-buttons">
        {activeCategory.modes.map((modeItem) => (
          <div className="mode-row" key={modeItem.key}>
            <button
              className={`home-btn mode-${modeItem.key}`}
              onClick={() => onStartGame(modeItem.key)}
            >
              {modeItem.icon}
              <span className="btn-title">
                {lang === "fr" ? modeItem.titleFr : modeItem.titleEn}
              </span>
            </button>
            <button
              className="home-btn learn-icon-btn"
              onClick={() => onStartGame("learn", modeItem.key)}
              title={t("mode_learn")}
            >
              <BookOpen width={20} height={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeScreenCategoryCarousel;
