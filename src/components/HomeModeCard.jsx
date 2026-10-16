import { BookOpen, Play, ScrollVertical } from "pixelarticons/react";
import React from "react";

import { getCardPose } from "./homeCardPose";
import { HOME_CONQUEST_KEY } from "./homeModes";

const CardActions = ({
  isTopCard,
  isConquest,
  modeKey,
  wasDraggingRef,
  onOpenConquest,
  onOpenConquestRules,
  onStartGame,
  t,
}) => {
  const handlePlay = (e) => {
    if (wasDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    if (isConquest) onOpenConquest?.();
    else onStartGame(modeKey);
  };

  const handleSecondary = (e) => {
    if (wasDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    if (isConquest) onOpenConquestRules?.();
    else onStartGame("learn", modeKey);
  };

  return (
    <div className="card-actions">
      <button
        type="button"
        tabIndex={isTopCard ? 0 : -1}
        className={`card-play-btn mode-${modeKey}`}
        onClick={handlePlay}
      >
        <Play width={20} height={20} aria-hidden="true" />
        <span>{t("play")}</span>
      </button>

      {isConquest ? (
        <button
          type="button"
          tabIndex={isTopCard ? 0 : -1}
          className="card-learn-btn card-rules-btn"
          onClick={handleSecondary}
          title={t("mode_rules")}
          aria-label={t("mode_rules")}
        >
          <ScrollVertical width={20} height={20} aria-hidden="true" />
          <span className="sr-only">{t("mode_rules")}</span>
        </button>
      ) : (
        <button
          type="button"
          tabIndex={isTopCard ? 0 : -1}
          className="card-learn-btn"
          onClick={handleSecondary}
          title={t("mode_learn")}
          aria-label={t("mode_learn")}
        >
          <BookOpen width={20} height={20} aria-hidden="true" />
          <span className="sr-only">{t("mode_learn")}</span>
        </button>
      )}
    </div>
  );
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

  const plateNumber = String(idx + 1).padStart(2, "0");
  const plateLabel = lang === "fr" ? `Planche ${plateNumber}` : `Plate ${plateNumber}`;
  const badgeText = lang === "fr" ? modeItem.badgeFr : modeItem.badgeEn;
  const badgeLabel =
    lang === "fr"
      ? modeItem.countLabelFr || modeItem.badgeFr
      : modeItem.countLabelEn || modeItem.badgeEn;

  return (
    <div
      data-mode={modeItem.key}
      className={`deck-mode-card ${isTopCard ? "is-top-card" : "is-stacked-card"}`}
      style={{
        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotateZ(${rotateZ}deg) scale(${scale * (1000 / (1000 - translateZ))})`,
        zIndex,
        transition: isDragging
          ? "none"
          : "transform 220ms cubic-bezier(0.18, 0.9, 0.26, 1), border-color 220ms ease, box-shadow 220ms ease",
      }}
      {...(isTopCard
        ? {
            "aria-describedby": `card-desc-${modeItem.key}`,
          }
        : {
            role: "button",
            tabIndex: 0,
            "aria-label":
              lang === "fr"
                ? modeItem.titleFr.replaceAll("\n", " ")
                : modeItem.titleEn.replaceAll("\n", " "),
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
          <span className="card-plate-number" title={plateLabel} aria-label={plateLabel}>
            {plateNumber}
          </span>
          <span className="card-plate-count" title={badgeLabel} aria-label={badgeLabel}>
            {badgeText}
          </span>
        </div>
        <div className="card-header-row">
          <h2 className="card-title">{lang === "fr" ? modeItem.titleFr : modeItem.titleEn}</h2>
          <span className="card-mode-icon" aria-hidden="true">
            {modeItem.icon}
          </span>
        </div>

        <p id={`card-desc-${modeItem.key}`} className="card-desc sr-only">
          {lang === "fr" ? modeItem.descFr : modeItem.descEn}
        </p>
      </div>

      <CardActions
        isTopCard={isTopCard}
        isConquest={isConquest}
        modeKey={modeItem.key}
        wasDraggingRef={wasDraggingRef}
        onOpenConquest={onOpenConquest}
        onOpenConquestRules={onOpenConquestRules}
        onStartGame={onStartGame}
        t={t}
      />
    </div>
  );
};

export default ModeCard;
