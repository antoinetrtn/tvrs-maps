import { BookOpen, Play, ScrollVertical } from "pixelarticons/react";
import React from "react";

import { HOME_CONQUEST_KEY } from "./homeModes";

const STACK_PRESETS = [
  { rotateZ: 0, translateX: 0, translateY: 0, translateZ: 80, scale: 1.0, zIndex: 100 },
  { rotateZ: 7.5, translateX: 8, translateY: -8, translateZ: 40, scale: 0.98, zIndex: 80 },
  { rotateZ: -5.2, translateX: -7, translateY: -14, translateZ: 25, scale: 0.96, zIndex: 60 },
  { rotateZ: 6.8, translateX: 7, translateY: -19, translateZ: 10, scale: 0.94, zIndex: 40 },
  { rotateZ: -7.0, translateX: -8, translateY: -24, translateZ: -5, scale: 0.92, zIndex: 20 },
];

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
  onOpenConquest,
  onOpenConquestRules,
  onSelectSideCard,
}) => {
  const stackPos = (idx - activeIndex + totalModes) % totalModes;
  const isTopCard = stackPos === 0;
  const isConquest = modeItem.key === HOME_CONQUEST_KEY;

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

  return (
    <div
      data-mode={modeItem.key}
      className={`deck-mode-card ${isTopCard ? "is-top-card" : "is-stacked-card"}`}
      style={{
        // translateZ is converted to an equivalent 2D scale (perspective 1000px):
        // Chromium mis-hit-tests preserve-3d content (~20px vertical offset on the
        // buttons), while a flat scale keeps hit-testing exact and looks identical.
        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotateZ(${rotateZ}deg) scale(${scale * (1000 / (1000 - translateZ))})`,
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
      <div className="card-plate-pattern" aria-hidden="true" />

      <div className="card-content">
        <div className="card-plate-meta">
          <span className="card-plate-number">PL. {String(idx + 1).padStart(2, "0")}</span>
          <span className="card-plate-count">
            {lang === "fr" ? modeItem.badgeFr : modeItem.badgeEn}
          </span>
        </div>
        <div className="card-header-row">
          <h2 className="card-title">{lang === "fr" ? modeItem.titleFr : modeItem.titleEn}</h2>
          <span className="card-mode-icon">{modeItem.icon}</span>
        </div>

        <p className="card-desc">{lang === "fr" ? modeItem.descFr : modeItem.descEn}</p>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className={`card-play-btn mode-${modeItem.key}`}
          onClick={(e) => {
            if (wasDraggingRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.stopPropagation();
            if (isConquest) onOpenConquest?.();
            else onStartGame(modeItem.key);
          }}
        >
          <Play width={22} height={22} />
          <span>{t("play")}</span>
        </button>

        {isConquest ? (
          <button
            type="button"
            className="card-learn-btn card-rules-btn"
            onClick={(e) => {
              if (wasDraggingRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              e.stopPropagation();
              onOpenConquestRules?.();
            }}
            title={t("mode_rules")}
          >
            <ScrollVertical width={18} height={18} />
            <span>{t("mode_rules")}</span>
          </button>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default ModeCard;
