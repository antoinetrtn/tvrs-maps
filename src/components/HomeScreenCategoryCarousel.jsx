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

  // Dynamic Dataset Counts dynamically derived from imported data maps
  const gameModesCarousel = useMemo(() => {
    const countriesCount = Object.keys(countryDataMap).length;
    const capitalsCount = Object.keys(countryDataMap).filter(
      (k) => countryDataMap[k]?.capital
    ).length;
    const departmentsCount = Object.keys(departmentsDataMap).length;
    const usStatesCount = Object.keys(usStatesDataMap).length;
    const riversMountainsCount = Object.keys(riversMountainsDataMap).length;

    const conquestCard = {
      key: HOME_CONQUEST_KEY,
      icon: <Chess width={44} height={44} />,
      titleFr: "Conquête\n1v1",
      titleEn: "Conquest\n1v1",
      descFr: "Duel en ligne : capturez des pays, volez ceux de l'adversaire.",
      descEn: "Online duel: capture countries, steal your opponent's.",
      badgeFr: "1V1 EN LIGNE",
      badgeEn: "ONLINE 1V1",
    };

    return [
      ...(onOpenConquest ? [conquestCard] : []),
      {
        key: "countries",
        icon: <Globe width={44} height={44} />,
        titleFr: "Pays du\nMonde",
        titleEn: "World\nCountries",
        descFr: `${countriesCount} pays et territoires à localiser sur le globe 3D interactif.`,
        descEn: `${countriesCount} countries and territories to locate on the interactive 3D globe.`,
        badgeFr: `${countriesCount} PAYS`,
        badgeEn: `${countriesCount} COUNTRIES`,
      },
      {
        key: "capitals",
        icon: <MapPin width={44} height={44} />,
        titleFr: "Capitales du\nMonde",
        titleEn: "World\nCapitals",
        descFr: `Retrouvez la capitale de chaque pays et territoire (${capitalsCount} au total).`,
        descEn: `Find the capital of every country and territory (${capitalsCount} total).`,
        badgeFr: `${capitalsCount} CAPITALES`,
        badgeEn: `${capitalsCount} CAPITALS`,
      },
      {
        key: "departments",
        icon: <Hash width={44} height={44} />,
        titleFr: "Départements\nFrançais",
        titleEn: "French\nDepartments",
        descFr: `Placement des ${departmentsCount} départements et collectivités d'Outre-mer.`,
        descEn: `Locate all ${departmentsCount} French departments across mainland & overseas.`,
        badgeFr: `${departmentsCount} DÉPARTEMENTS`,
        badgeEn: `${departmentsCount} DEPARTMENTS`,
      },
      {
        key: "us_states",
        icon: <Earth width={44} height={44} />,
        titleFr: "États\nAméricains",
        titleEn: "US\nStates",
        descFr: `Testez vos connaissances sur les ${usStatesCount} États américains.`,
        descEn: `Test your knowledge on all ${usStatesCount} US States.`,
        badgeFr: `${usStatesCount} ÉTATS`,
        badgeEn: `${usStatesCount} STATES`,
      },
      {
        key: "rivers_mountains",
        icon: <Waves width={44} height={44} />,
        titleFr: "Montagnes &\nFleuves",
        titleEn: "Rivers &\nMountains",
        descFr: `${riversMountainsCount} reliefs majeurs : chaînes de montagnes et grands fleuves du monde.`,
        descEn: `${riversMountainsCount} major reliefs: mountain ranges and famous rivers.`,
        badgeFr: `${riversMountainsCount} RELIEFS & FLEUVES`,
        badgeEn: `${riversMountainsCount} RELIEFS & RIVERS`,
      },
    ];
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
