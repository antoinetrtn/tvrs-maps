import { BookOpen, Play, ScrollVertical, Target } from "pixelarticons/react";
import React from "react";

import { getCardPose } from "./homeCardPose";
import { HOME_CONQUEST_KEY } from "./homeModes";

const guardDrag = (wasDraggingRef, fn) => (e) => {
  if (wasDraggingRef.current) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  e.stopPropagation();
  fn?.();
};

const CardActions = ({
  isTopCard,
  isConquest,
  modeKey,
  wasDraggingRef,
  onOpenConquest,
  onOpenConquestRules,
  onOpenTraining,
  onStartGame,
  t,
}) => {
  const onPlay = guardDrag(wasDraggingRef, () =>
    isConquest ? onOpenConquest?.() : onStartGame(modeKey)
  );
  const onTrain = guardDrag(wasDraggingRef, () => onOpenTraining?.(modeKey));
  const onSecondary = guardDrag(wasDraggingRef, () =>
    isConquest ? onOpenConquestRules?.() : onStartGame("learn", modeKey)
  );

  return (
    <div className="card-actions">
      <button
        type="button"
        tabIndex={isTopCard ? 0 : -1}
        className={`card-play-btn mode-${modeKey}`}
        onClick={onPlay}
      >
        <Play width={20} height={20} aria-hidden="true" />
        <span>{t("play")}</span>
      </button>

      {!isConquest && (
        <button
          type="button"
          tabIndex={isTopCard ? 0 : -1}
          className="card-learn-btn card-train-btn"
          onClick={onTrain}
          title={t("training_card_label")}
          aria-label={t("training_card_label")}
        >
          <Target width={20} height={20} aria-hidden="true" />
          <span className="sr-only">{t("training_card_label")}</span>
        </button>
      )}

      {isConquest ? (
        <button
          type="button"
          tabIndex={isTopCard ? 0 : -1}
          className="card-learn-btn card-rules-btn"
          onClick={onSecondary}
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
          onClick={onSecondary}
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

const CardContent = ({ modeItem, lang, plateNumber, plateLabel, badgeText, badgeLabel }) => (
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
);

const getCardStyle = (pose, isTopCard, reducedMotion) => {
  if (reducedMotion) {
    return {
      "--card-x": "0px",
      "--card-y": "0px",
      "--card-rot": "0deg",
      "--card-scale": 1,
      "--card-scale-eff": 1,
      "--card-z": 0,
      zIndex: isTopCard ? 100 : 20,
    };
  }
  return {
    "--card-x": `${pose.translateX}px`,
    "--card-y": `${pose.translateY}px`,
    "--card-rot": `${pose.rotateZ}deg`,
    "--card-scale": pose.scale,
    "--card-scale-eff": pose.scale * (1000 / (1000 - pose.translateZ)),
    "--card-z": pose.translateZ,
    zIndex: pose.zIndex,
  };
};

const ModeCard = ({
  modeItem,
  idx,
  activeIndex,
  totalModes,
  animatingDirection,
  wasDraggingRef,
  lang,
  t,
  onStartGame,
  onOpenConquest,
  onOpenConquestRules,
  onOpenTraining,
  onSelectSideCard,
  reducedMotion = false,
}) => {
  const stackPos = (idx - activeIndex + totalModes) % totalModes;
  const isTopCard = stackPos === 0;
  const isConquest = modeItem.key === HOME_CONQUEST_KEY;

  const pose = getCardPose({
    stackPos,
    totalModes,
    dragOffset: 0,
    isDragging: false,
    animatingDirection: reducedMotion ? null : animatingDirection,
  });

  const cardStyle = getCardStyle(pose, isTopCard, reducedMotion);
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
      data-stack-pos={stackPos}
      data-is-prev={stackPos === totalModes - 1 ? "true" : undefined}
      className={`deck-mode-card ${isTopCard ? "is-top-card" : "is-stacked-card"}`}
      style={cardStyle}
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
      <CardContent
        modeItem={modeItem}
        lang={lang}
        plateNumber={plateNumber}
        plateLabel={plateLabel}
        badgeText={badgeText}
        badgeLabel={badgeLabel}
      />
      <CardActions
        isTopCard={isTopCard}
        isConquest={isConquest}
        modeKey={modeItem.key}
        wasDraggingRef={wasDraggingRef}
        onOpenConquest={onOpenConquest}
        onOpenConquestRules={onOpenConquestRules}
        onOpenTraining={onOpenTraining}
        onStartGame={onStartGame}
        t={t}
      />
    </div>
  );
};

export default ModeCard;
