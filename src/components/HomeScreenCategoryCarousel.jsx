import "./HomeScreenCategoryCarousel.css";
import "./HomeScreenCarouselMotion.css";
import "./HomeScreenDesktop.css";

import { ChevronLeft, ChevronRight } from "pixelarticons/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "../config/i18n";
import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { getGameModesMetadata } from "./homeHeroText";
import ModeCard from "./HomeModeCard";
import { HomeModePixelArt } from "./HomeModePixelArt";
import { HOME_CONQUEST_KEY } from "./homeModes";
import IconButton from "./ui/IconButton";
import Pressable from "./ui/Pressable";
import useCarouselDrag from "./useCarouselDrag";

const MODE_ICONS = {
  [HOME_CONQUEST_KEY]: <HomeModePixelArt modeKey={HOME_CONQUEST_KEY} />,
  countries: <HomeModePixelArt modeKey="countries" />,
  capitals: <HomeModePixelArt modeKey="capitals" />,
  departments: <HomeModePixelArt modeKey="departments" />,
  us_states: <HomeModePixelArt modeKey="us_states" />,
  rivers_mountains: <HomeModePixelArt modeKey="rivers_mountains" />,
};

const buildCarouselItems = (metadata) =>
  metadata.map((item) => ({
    ...item,
    icon: MODE_ICONS[item.key] || null,
  }));

const DeckArrow = ({ side, onClick, label, icon }) => (
  <div className={`deck-click-zone ${side}`}>
    <IconButton
      size="sm"
      variant="outline"
      label={label}
      className="deck-arrow"
      onClick={(e) => {
        if (e.detail > 0) {
          e.currentTarget.blur();
        }
        onClick();
      }}
    >
      {icon}
    </IconButton>
  </div>
);

const DeckDots = ({ items, activeIndex, lang, onDotClick }) => {
  const currentNum = String(activeIndex + 1).padStart(2, "0");
  const totalNum = String(items.length).padStart(2, "0");

  return (
    <div className="deck-dots-row">
      {items.map((item, idx) => {
        const itemTitle = lang === "fr" ? item.titleFr : item.titleEn;
        return (
          // pagination dot: kit Pressable, not Button (6px visual, 24px hit area via ::after)
          <Pressable
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
      <span className="deck-counter" aria-hidden="true">
        {currentNum} / {totalNum}
      </span>
    </div>
  );
};

function useGameModesList(onOpenConquest, homeMode) {
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

  return { gameModesCarousel, activeIndex, totalModes: gameModesCarousel.length };
}

function useCarouselKeyboardNav(goToNext, goToPrev, exiting) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (exiting || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev, exiting]);
}

function useCarouselNavigation({
  activeIndex,
  totalModes,
  gameModesCarousel,
  setHomeMode,
  exiting,
}) {
  const [animatingDirection, setAnimatingDirection] = useState(null);
  const isAnimatingRef = useRef(false);

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

  const goToNext = useCallback(() => {
    triggerAnimatedChange("leftSwipe");
  }, [triggerAnimatedChange]);

  const goToPrev = useCallback(() => {
    triggerAnimatedChange("rightSwipe");
  }, [triggerAnimatedChange]);

  const onSelectIndex = useCallback(
    (nextIdx) => {
      setHomeMode(gameModesCarousel[nextIdx].key);
    },
    [gameModesCarousel, setHomeMode]
  );

  const handleSelectSideCard = useCallback(
    (stackPos) => {
      const targetIdx = (activeIndex + stackPos) % totalModes;
      const direction = stackPos <= totalModes / 2 ? "leftSwipe" : "rightSwipe";
      triggerAnimatedChange(direction, targetIdx);
    },
    [activeIndex, totalModes, triggerAnimatedChange]
  );

  return {
    animatingDirection,
    triggerAnimatedChange,
    goToNext,
    goToPrev,
    onSelectIndex,
    handleSelectSideCard,
  };
}

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
  const t = useTranslation(lang);
  const reducedMotion = usePrefersReducedMotion();

  const { gameModesCarousel, activeIndex, totalModes } = useGameModesList(onOpenConquest, homeMode);

  const {
    animatingDirection,
    triggerAnimatedChange,
    goToNext,
    goToPrev,
    onSelectIndex,
    handleSelectSideCard,
  } = useCarouselNavigation({
    activeIndex,
    totalModes,
    gameModesCarousel,
    setHomeMode,
    exiting,
  });

  const { stageRef, isDragging, wasDraggingRef, handlePointerDown } = useCarouselDrag({
    activeIndex,
    totalModes,
    onSelectIndex,
    reducedMotion,
    exiting,
  });

  useCarouselKeyboardNav(goToNext, goToPrev, exiting);

  return (
    <div
      className={`cards-deck-wrapper ${isDragging ? "is-user-dragging" : ""} ${reducedMotion ? "is-reduced-motion" : ""}`}
    >
      <DeckArrow
        side="left"
        onClick={goToPrev}
        label={t("previous")}
        icon={<ChevronLeft width={20} height={20} />}
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
        onClick={goToNext}
        label={t("next")}
        icon={<ChevronRight width={20} height={20} />}
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
