import "./HomeScreenCategoryCarousel.css";

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
import { getGameModesMetadata } from "./homeHeroText";
import ModeCard from "./HomeModeCard";
import { HOME_CONQUEST_KEY } from "./homeModes";

const getEventClientX = (e) => {
  if (typeof e.clientX === "number" && e.clientX !== 0) return e.clientX;
  if (e.touches && e.touches[0] && typeof e.touches[0].clientX === "number")
    return e.touches[0].clientX;
  if (e.changedTouches && e.changedTouches[0] && typeof e.changedTouches[0].clientX === "number")
    return e.changedTouches[0].clientX;
  return 0;
};

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

const HomeScreenCategoryCarousel = ({
  onStartGame,
  onOpenConquest = null,
  onOpenConquestRules = null,
  lang,
  homeMode,
  setHomeMode,
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [animatingDirection, setAnimatingDirection] = useState(null);

  const startXRef = useRef(0);
  const currentDxRef = useRef(0);
  const startTimeRef = useRef(0);
  const wasDraggingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const t = useTranslation(lang);

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
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;
      setAnimatingDirection(direction);

      const nextIdx = (() => {
        if (targetIdxOverride !== null) return targetIdxOverride;
        return direction === "leftSwipe"
          ? (activeIndex + 1) % totalModes
          : (activeIndex - 1 + totalModes) % totalModes;
      })();
      setHomeMode(gameModesCarousel[nextIdx].key);

      setTimeout(() => {
        setAnimatingDirection(null);
        isAnimatingRef.current = false;
      }, 200);
    },
    [totalModes, activeIndex, gameModesCarousel, setHomeMode]
  );

  const triggerRightSwipe = useCallback(() => {
    triggerAnimatedChange("rightSwipe");
  }, [triggerAnimatedChange]);

  const triggerLeftSwipe = useCallback(() => {
    triggerAnimatedChange("leftSwipe");
  }, [triggerAnimatedChange]);

  const handleSelectSideCard = useCallback(
    (stackPos) => {
      const targetIdx = (activeIndex + stackPos) % totalModes;
      const direction = stackPos <= totalModes / 2 ? "leftSwipe" : "rightSwipe";
      triggerAnimatedChange(direction, targetIdx);
    },
    [activeIndex, totalModes, triggerAnimatedChange]
  );

  const handlePointerDown = (e) => {
    if (e.target.closest("button") || isAnimatingRef.current) return;
    const startX = getEventClientX(e);
    if (!startX) return;

    startXRef.current = startX;
    currentDxRef.current = 0;
    startTimeRef.current = Date.now();
    wasDraggingRef.current = false;
    setIsDragging(true);
    setDragOffset(0);

    const handlePointerMove = (moveEvt) => {
      const currentX = getEventClientX(moveEvt);
      if (!currentX) return;
      const dx = currentX - startXRef.current;
      currentDxRef.current = dx;

      if (Math.abs(dx) > 8) {
        wasDraggingRef.current = true;
      }
      setDragOffset(dx);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);

      const dx = currentDxRef.current;
      const dt = Math.max(1, Date.now() - startTimeRef.current);
      const velocity = Math.abs(dx) / dt;

      setIsDragging(false);

      if (Math.abs(dx) > 20 || (velocity > 0.15 && Math.abs(dx) > 6)) {
        if (dx < 0) {
          setHomeMode(gameModesCarousel[(activeIndex + 1) % totalModes].key);
        } else {
          setHomeMode(gameModesCarousel[(activeIndex - 1 + totalModes) % totalModes].key);
        }
      }
      setDragOffset(0);
      currentDxRef.current = 0;

      setTimeout(() => {
        wasDraggingRef.current = false;
      }, 100);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("touchend", handlePointerUp);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        triggerRightSwipe();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        triggerLeftSwipe();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [triggerLeftSwipe, triggerRightSwipe]);

  return (
    <div className={`cards-deck-wrapper ${isDragging ? "is-user-dragging" : ""}`}>
      {/* Left Half-Circle Tap Zone -> Left Swipe Equivalent */}
      <div
        className="deck-click-zone left"
        onClick={(e) => {
          // Drop focus after a tap so no "active" state lingers on touch.
          e.currentTarget.blur();
          triggerLeftSwipe();
        }}
        title={t("previous")}
        aria-label={t("previous")}
        role="button"
        tabIndex={0}
      >
        <div className="deck-arrow">
          <ChevronLeft width={18} height={18} />
        </div>
      </div>

      <div className="deck-stage" onPointerDown={handlePointerDown}>
        {gameModesCarousel.map((modeItem, idx) => (
          <ModeCard
            key={modeItem.key}
            modeItem={modeItem}
            idx={idx}
            activeIndex={activeIndex}
            totalModes={totalModes}
            dragOffset={dragOffset}
            isDragging={isDragging}
            animatingDirection={animatingDirection}
            wasDraggingRef={wasDraggingRef}
            lang={lang}
            t={t}
            onStartGame={onStartGame}
            onOpenConquest={onOpenConquest}
            onOpenConquestRules={onOpenConquestRules}
            onSelectSideCard={handleSelectSideCard}
          />
        ))}
      </div>

      {/* Right Half-Circle Tap Zone -> Right Swipe Equivalent */}
      <div
        className="deck-click-zone right"
        onClick={(e) => {
          // Drop focus after a tap so no "active" state lingers on touch.
          e.currentTarget.blur();
          triggerRightSwipe();
        }}
        title={t("next")}
        aria-label={t("next")}
        role="button"
        tabIndex={0}
      >
        <div className="deck-arrow">
          <ChevronRight width={18} height={18} />
        </div>
      </div>

      <div className="deck-dots-row">
        {gameModesCarousel.map((item, idx) => (
          <button
            type="button"
            key={item.key}
            className={`deck-dot ${idx === activeIndex ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              const direction = idx > activeIndex ? "leftSwipe" : "rightSwipe";
              triggerAnimatedChange(direction, idx);
            }}
            title={lang === "fr" ? item.titleFr : item.titleEn}
          />
        ))}
      </div>
    </div>
  );
};

export default HomeScreenCategoryCarousel;
