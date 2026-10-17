import "./HomeScreenCategoryCarousel.css";
import "./HomeScreenCarouselMotion.css";

import {
  Chess,
  ChevronLeft,
  ChevronRight,
  Earth,
  Globe,
  Hash,
  MapPin,
  Waves,
} from "pixelarticons/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "../config/i18n";
import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { getGameModesMetadata } from "./homeHeroText";
import ModeCard from "./HomeModeCard";
import { HOME_CONQUEST_KEY } from "./homeModes";
import useCarouselDrag from "./useCarouselDrag";

const MODE_ICONS = {
  [HOME_CONQUEST_KEY]: <Chess width={48} height={48} />,
  countries: <Globe width={48} height={48} />,
  capitals: <MapPin width={48} height={48} />,
  departments: <Hash width={48} height={48} />,
  us_states: <Earth width={48} height={48} />,
  rivers_mountains: <Waves width={48} height={48} />,
};

const buildCarouselItems = (metadata) =>
  metadata.map((item) => ({
    ...item,
    icon: MODE_ICONS[item.key] || null,
  }));

const DeckArrow = ({ side, onClick, label, icon }) => (
  <div
    className={`deck-click-zone ${side}`}
    onClick={(e) => {
      e.currentTarget.blur();
      onClick();
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    title={label}
    aria-label={label}
    role="button"
    tabIndex={0}
  >
    <div className="deck-arrow">{icon}</div>
  </div>
);

const DeckDots = ({ items, activeIndex, lang, onDotClick }) => (
  <div className="deck-dots-row">
    {items.map((item, idx) => {
      const itemTitle = lang === "fr" ? item.titleFr : item.titleEn;
      return (
        <button
          type="button"
          key={item.key}
          className={`deck-dot ${idx === activeIndex ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onDotClick(idx);
          }}
          title={itemTitle}
          aria-label={itemTitle}
        />
      );
    })}
  </div>
);

const HomeScreenCategoryCarousel = ({
  onStartGame,
  onOpenConquest = null,
  onOpenConquestRules = null,
  onOpenTraining = null,
  lang,
  homeMode,
  setHomeMode,
  exiting = false,
}) => {
  const [animatingDirection, setAnimatingDirection] = useState(null);
  const isAnimatingRef = useRef(false);
  const t = useTranslation(lang);
  const reducedMotion = usePrefersReducedMotion();

  const gameModesCarousel = useMemo(() => {
    const metadata = getGameModesMetadata({
      countriesCount: Object.keys(countryDataMap).length,
      capitalsCount: Object.keys(countryDataMap).filter((k) => countryDataMap[k]?.capital).length,
      departmentsCount: Object.keys(departmentsDataMap).length,
      usStatesCount: Object.keys(usStatesDataMap).length,
      riversMountainsCount: Object.keys(riversMountainsDataMap).length,
      includeConquest: Boolean(onOpenConquest),
    });
    return buildCarouselItems(metadata);
  }, [onOpenConquest]);

  const activeIndex = useMemo(() => {
    const idx = gameModesCarousel.findIndex((item) => item.key === homeMode);
    return idx === -1 ? 0 : idx;
  }, [homeMode, gameModesCarousel]);

  const totalModes = gameModesCarousel.length;

  const triggerAnimatedChange = useCallback(
    (direction, targetIdxOverride = null) => {
      if (isAnimatingRef.current || exiting) return;
      isAnimatingRef.current = true;
      setAnimatingDirection(direction);

      const nextIdx =
        targetIdxOverride !== null
          ? targetIdxOverride
          : direction === "leftSwipe"
            ? (activeIndex + 1) % totalModes
            : (activeIndex - 1 + totalModes) % totalModes;
      setHomeMode(gameModesCarousel[nextIdx].key);

      setTimeout(() => {
        setAnimatingDirection(null);
        isAnimatingRef.current = false;
      }, 200);
    },
    [totalModes, activeIndex, gameModesCarousel, setHomeMode, exiting]
  );

  const triggerRightSwipe = useCallback(() => {
    triggerAnimatedChange("rightSwipe");
  }, [triggerAnimatedChange]);

  const triggerLeftSwipe = useCallback(() => {
    triggerAnimatedChange("leftSwipe");
  }, [triggerAnimatedChange]);

  const onSelectIndex = useCallback(
    (nextIdx) => {
      setHomeMode(gameModesCarousel[nextIdx].key);
    },
    [gameModesCarousel, setHomeMode]
  );

  const { stageRef, isDragging, wasDraggingRef, handlePointerDown } = useCarouselDrag({
    activeIndex,
    totalModes,
    onSelectIndex,
    reducedMotion,
    exiting,
  });

  const handleSelectSideCard = useCallback(
    (stackPos) => {
      const targetIdx = (activeIndex + stackPos) % totalModes;
      const direction = stackPos <= totalModes / 2 ? "leftSwipe" : "rightSwipe";
      triggerAnimatedChange(direction, targetIdx);
    },
    [activeIndex, totalModes, triggerAnimatedChange]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (exiting || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        triggerRightSwipe();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        triggerLeftSwipe();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerLeftSwipe, triggerRightSwipe, exiting]);

  return (
    <div
      className={`cards-deck-wrapper ${isDragging ? "is-user-dragging" : ""} ${reducedMotion ? "is-reduced-motion" : ""}`}
    >
      <DeckArrow
        side="left"
        onClick={triggerLeftSwipe}
        label={t("previous")}
        icon={<ChevronLeft width={18} height={18} />}
      />

      <div className="deck-stage" ref={stageRef} onPointerDown={handlePointerDown}>
        {gameModesCarousel.map((modeItem, idx) => (
          <ModeCard
            key={modeItem.key}
            modeItem={modeItem}
            idx={idx}
            activeIndex={activeIndex}
            totalModes={totalModes}
            animatingDirection={animatingDirection}
            wasDraggingRef={wasDraggingRef}
            lang={lang}
            t={t}
            onStartGame={onStartGame}
            onOpenConquest={onOpenConquest}
            onOpenConquestRules={onOpenConquestRules}
            onOpenTraining={onOpenTraining}
            onSelectSideCard={handleSelectSideCard}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      <DeckArrow
        side="right"
        onClick={triggerRightSwipe}
        label={t("next")}
        icon={<ChevronRight width={18} height={18} />}
      />

      <DeckDots
        items={gameModesCarousel}
        activeIndex={activeIndex}
        lang={lang}
        onDotClick={(idx) => {
          const direction = idx > activeIndex ? "leftSwipe" : "rightSwipe";
          triggerAnimatedChange(direction, idx);
        }}
      />
    </div>
  );
};

export default HomeScreenCategoryCarousel;
