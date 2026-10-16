import { BookOpen, Play, ScrollVertical } from "pixelarticons/react";
import React from "react";

import { getCardPose } from "./homeCardPose";
import { HOME_CONQUEST_KEY } from "./homeModes";

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

  const { translateX, translateY, translateZ, rotateZ, scale, zIndex } = getCardPose({
    stackPos,
    totalModes,
    dragOffset,
    isDragging,
    animatingDirection,
  });
  const selectSideCard = () => onSelectSideCard(stackPos);

  return (
    <div
      data-mode={modeItem.key}
      className={`deck-mode-card ${isTopCard ? "is-top-card" : "is-stacked-card"}`}
      style={{
        // translateZ is converted to an equivalent 2D scale (perspective 1000px):
        // Chromium mis-hit-tests preserve-3d content (~20px vertical offset on the
        // buttons), while a flat scale keeps hit-testing exact and looks identical.
        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotateZ(${rotateZ}deg) scale(${scale * (1000 / (1000 - translateZ))})`,
        zIndex,
        transition: isDragging
          ? "none"
          : "transform 220ms cubic-bezier(0.18, 0.9, 0.26, 1), border-color 220ms ease, box-shadow 220ms ease",
      }}
      {...(isTopCard
        ? {}
        : {
            role: "button",
            tabIndex: 0,
            "aria-label":
              lang === "fr"
                ? modeItem.titleFr.replace("\n", " ")
                : modeItem.titleEn.replace("\n", " "),
            onClick: (e) => {
              if (wasDraggingRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              selectSideCard();
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectSideCard();
              }
            },
          })}
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
          tabIndex={isTopCard ? 0 : -1}
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
            tabIndex={isTopCard ? 0 : -1}
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
            tabIndex={isTopCard ? 0 : -1}
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
