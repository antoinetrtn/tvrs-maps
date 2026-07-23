import "./HomeScreenCategoryCarousel.css";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Earth,
  Globe,
  Hash,
  MapPin,
  Play,
  Waves,
} from "pixelarticons/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "../config/i18n";
import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";

const STACK_PRESETS = [
  { rotateZ: 0, translateX: 0, translateY: 0, translateZ: 80, scale: 1.0, zIndex: 100 },
  { rotateZ: 7.5, translateX: 8, translateY: -8, translateZ: 40, scale: 0.98, zIndex: 80 },
  { rotateZ: -5.2, translateX: -7, translateY: -14, translateZ: 25, scale: 0.96, zIndex: 60 },
  { rotateZ: 6.8, translateX: 7, translateY: -19, translateZ: 10, scale: 0.94, zIndex: 40 },
  { rotateZ: -7.0, translateX: -8, translateY: -24, translateZ: -5, scale: 0.92, zIndex: 20 },
];

const getEventClientX = (e) => {
  if (typeof e.clientX === "number" && e.clientX !== 0) return e.clientX;
  if (e.touches && e.touches[0] && typeof e.touches[0].clientX === "number")
    return e.touches[0].clientX;
  if (e.changedTouches && e.changedTouches[0] && typeof e.changedTouches[0].clientX === "number")
    return e.changedTouches[0].clientX;
  return 0;
};

const ModeCard = ({
  modeItem,
  idx,
  activeIndex,
  totalModes,
  dragOffset,
  isDragging,
  animatingDirection,
  wasDraggingRef,
  lang,
  t,
  onStartGame,
  onSelectSideCard,
}) => {
  const stackPos = (idx - activeIndex + totalModes) % totalModes;
  const isTopCard = stackPos === 0;

  let translateX = 0;
  let translateY = 0;
  let translateZ = 80;
  let rotateZ = 0;
  let scale = 1;
  let zIndex = 100 - stackPos * 15;
  const opacity = 1;

  // Arrow click animation: tight elegant 3D fly-out arc
  if (animatingDirection && !isDragging) {
    if (isTopCard) {
      translateX = animatingDirection === "rightSwipe" ? 140 : -140;
      translateY = 6;
      rotateZ = animatingDirection === "rightSwipe" ? 7 : -7;
      scale = 0.99;
      zIndex = 100;
    } else {
      const targetPos = animatingDirection === "rightSwipe" ? totalModes - 1 : 1;
      if (stackPos === targetPos) {
        rotateZ = 0;
        translateX = 0;
        translateY = 0;
        translateZ = 80;
        scale = 1.0;
        zIndex = 95;
      } else {
        const preset = STACK_PRESETS[stackPos] || STACK_PRESETS[4];
        rotateZ = preset.rotateZ;
        translateX = preset.translateX;
        translateY = preset.translateY;
        translateZ = preset.translateZ;
        scale = preset.scale;
        zIndex = preset.zIndex;
      }
    }
  } else if (isTopCard) {
    translateX = isDragging ? dragOffset : 0;
    translateY = isDragging ? Math.abs(dragOffset) * 0.04 : 0;
    translateZ = 80;
    rotateZ = isDragging ? dragOffset * 0.05 : 0;
    scale = isDragging ? 1.02 : 1.0;
    zIndex = 100;
  } else {
    const preset = STACK_PRESETS[stackPos] || STACK_PRESETS[4];

    // Synchronize preview card during drag:
    // dragOffset < 0 (swiping left) -> reveals Next card (stackPos === 1)
    // dragOffset > 0 (swiping right) -> reveals Prev card (stackPos === totalModes - 1)
    const previewPos = dragOffset < 0 ? 1 : dragOffset > 0 ? totalModes - 1 : null;

    if (isDragging && previewPos !== null && stackPos === previewPos) {
      const progress = Math.min(1.0, Math.abs(dragOffset) / 120);
      rotateZ = preset.rotateZ * (1 - progress);
      translateX = preset.translateX * (1 - progress);
      translateY = preset.translateY * (1 - progress);
      translateZ = preset.translateZ + (80 - preset.translateZ) * progress;
      scale = preset.scale + (1.0 - preset.scale) * progress;
      zIndex = 95;
    } else {
      rotateZ = preset.rotateZ;
      translateX = preset.translateX;
      translateY = preset.translateY;
      translateZ = preset.translateZ;
      scale = preset.scale;
      zIndex = preset.zIndex;
    }
  }

  const badgeText = lang === "fr" ? modeItem.badgeFr : modeItem.badgeEn;

  return (
    <div
      data-mode={modeItem.key}
      className={`deck-mode-card ${isTopCard ? "is-top-card" : "is-stacked-card"}`}
      style={{
        transform: `translate3d(${translateX}px, ${translateY}px, ${translateZ}px) rotateZ(${rotateZ}deg) scale(${scale})`,
        opacity,
        zIndex,
        transition: isDragging
          ? "none"
          : "transform 220ms cubic-bezier(0.18, 0.9, 0.26, 1), border-color 220ms ease, box-shadow 220ms ease",
      }}
      onClick={(e) => {
        if (wasDraggingRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (!isTopCard) onSelectSideCard(stackPos);
      }}
    >
      <div className="card-scanline-layer" aria-hidden="true" />

      <div className="card-parallax-bg">
        <div className="card-ambient-glow" />
      </div>

      <div className="card-content">
        <div className="card-header-row">
          <span className="card-badge">{badgeText}</span>
          <span className="card-mode-icon">{modeItem.icon}</span>
        </div>

        <h2 className="card-title">{lang === "fr" ? modeItem.titleFr : modeItem.titleEn}</h2>
        <p className="card-desc">{lang === "fr" ? modeItem.descFr : modeItem.descEn}</p>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="card-play-btn"
          onClick={(e) => {
            if (wasDraggingRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.stopPropagation();
            onStartGame(modeItem.key);
          }}
        >
          <Play width={18} height={18} />
          <span>{t("play")}</span>
        </button>

        <button
          type="button"
          className="card-learn-btn"
          onClick={(e) => {
            if (wasDraggingRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.stopPropagation();
            onStartGame("learn", modeItem.key);
          }}
          title={t("mode_learn")}
        >
          <BookOpen width={18} height={18} />
        </button>
      </div>
    </div>
  );
};

const HomeScreenCategoryCarousel = ({ onStartGame, lang }) => {
  const [activeIndex, setActiveIndex] = useState(0);
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

    return [
      {
        key: "countries",
        icon: <Globe width={36} height={36} />,
        titleFr: "Pays du Monde",
        titleEn: "World Countries",
        descFr: `${countriesCount} pays et territoires à localiser sur le globe 3D interactif.`,
        descEn: `${countriesCount} countries and territories to locate on the interactive 3D globe.`,
        badgeFr: `${countriesCount} PAYS`,
        badgeEn: `${countriesCount} COUNTRIES`,
      },
      {
        key: "capitals",
        icon: <MapPin width={36} height={36} />,
        titleFr: "Capitales du Monde",
        titleEn: "World Capitals",
        descFr: `Retrouvez la capitale de chaque pays et territoire (${capitalsCount} au total).`,
        descEn: `Find the capital of every country and territory (${capitalsCount} total).`,
        badgeFr: `${capitalsCount} CAPITALES`,
        badgeEn: `${capitalsCount} CAPITALS`,
      },
      {
        key: "departments",
        icon: <Hash width={32} height={32} />,
        titleFr: "Départements Français",
        titleEn: "French Departments",
        descFr: `Placement des ${departmentsCount} départements et collectivités d'Outre-mer.`,
        descEn: `Locate all ${departmentsCount} French departments across mainland & overseas.`,
        badgeFr: `${departmentsCount} DÉPARTEMENTS`,
        badgeEn: `${departmentsCount} DEPARTMENTS`,
      },
      {
        key: "us_states",
        icon: <Earth width={36} height={36} />,
        titleFr: "États Américains",
        titleEn: "US States",
        descFr: `Testez vos connaissances sur les ${usStatesCount} États américains.`,
        descEn: `Test your knowledge on all ${usStatesCount} US States.`,
        badgeFr: `${usStatesCount} ÉTATS`,
        badgeEn: `${usStatesCount} STATES`,
      },
      {
        key: "rivers_mountains",
        icon: <Waves width={36} height={36} />,
        titleFr: "Montagnes & Fleuves",
        titleEn: "Rivers & Mountains",
        descFr: `${riversMountainsCount} reliefs majeurs : chaînes de montagnes et grands fleuves du monde.`,
        descEn: `${riversMountainsCount} major reliefs: mountain ranges and famous rivers.`,
        badgeFr: `${riversMountainsCount} RELIEFS & FLEUVES`,
        badgeEn: `${riversMountainsCount} RELIEFS & RIVERS`,
      },
    ];
  }, []);

  const totalModes = gameModesCarousel.length;

  const triggerAnimatedChange = useCallback(
    (direction, targetIdxOverride = null) => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;
      setAnimatingDirection(direction);

      setTimeout(() => {
        setActiveIndex((prev) => {
          if (targetIdxOverride !== null) return targetIdxOverride;
          return direction === "leftSwipe"
            ? (prev + 1) % totalModes
            : (prev - 1 + totalModes) % totalModes;
        });
        setAnimatingDirection(null);
        isAnimatingRef.current = false;
      }, 200);
    },
    [totalModes]
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

      if (Math.abs(dx) > 4) {
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
          setActiveIndex((prev) => (prev + 1) % totalModes);
        } else {
          setActiveIndex((prev) => (prev - 1 + totalModes) % totalModes);
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
        onClick={triggerLeftSwipe}
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
            onSelectSideCard={handleSelectSideCard}
          />
        ))}
      </div>

      {/* Right Half-Circle Tap Zone -> Right Swipe Equivalent */}
      <div
        className="deck-click-zone right"
        onClick={triggerRightSwipe}
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
