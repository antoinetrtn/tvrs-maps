import { BookOpen, Play, ScrollVertical, Target } from "pixelarticons/react";
import React from "react";

import { MODE_PIXEL_PALETTES } from "../config/accentPresets";
import { getCardPose } from "./homeCardPose";
import { getModeClipPath } from "./homeModeFrameData";
import { HomeModePixelArt } from "./HomeModePixelArt";
import { HOME_CONQUEST_KEY } from "./homeModes";
import Button from "./ui/Button";
import Card from "./ui/Card";

const guardDrag = (wasDraggingRef, fn) => (e) => {
  if (wasDraggingRef.current) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  e.stopPropagation();
  fn?.();
};

const SecondaryButton = ({ isTopCard, look, onClick, title, label, icon }) => (
  <Button
    variant="secondary"
    size="lg"
    tabIndex={isTopCard ? 0 : -1}
    look={look}
    onClick={onClick}
    title={title}
    aria-label={title}
  >
    {icon}
    <span className="card-btn-label desktop-reveal">{label}</span>
  </Button>
);

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
      <Button
        variant="primary"
        size="lg"
        tabIndex={isTopCard ? 0 : -1}
        look="cta"
        className={`mode-${modeKey}`}
        onClick={onPlay}
      >
        <Play width={20} height={20} aria-hidden="true" />
        <span>{t("play")}</span>
      </Button>

      {!isConquest && (
        <SecondaryButton
          isTopCard={isTopCard}
          look={["tile", "tile-train"]}
          onClick={onTrain}
          title={t("training_card_label")}
          label={t("card_train_short") || t("training_card_label")}
          icon={<Target width={20} height={20} aria-hidden="true" />}
        />
      )}

      {isConquest ? (
        <SecondaryButton
          isTopCard={isTopCard}
          look={["tile", "tile-rules"]}
          onClick={onSecondary}
          title={t("mode_rules")}
          label={t("card_rules_short") || t("mode_rules")}
          icon={<ScrollVertical width={20} height={20} aria-hidden="true" />}
        />
      ) : (
        <SecondaryButton
          isTopCard={isTopCard}
          look="tile"
          onClick={onSecondary}
          title={t("mode_learn")}
          label={t("card_learn_short") || t("mode_learn")}
          icon={<BookOpen width={20} height={20} aria-hidden="true" />}
        />
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
        {modeItem.icon || <HomeModePixelArt modeKey={modeItem.key} />}
      </span>
    </div>
    <p id={`card-desc-${modeItem.key}`} className="card-desc desktop-reveal">
      {lang === "fr" ? modeItem.descFr : modeItem.descEn}
    </p>
  </div>
);

const getCardStyle = (pose, isTopCard, reducedMotion, modeKey) => {
  const palette = MODE_PIXEL_PALETTES[modeKey] || MODE_PIXEL_PALETTES.countries;
  const clipPath = getModeClipPath(modeKey);
  const modeVars = {
    "--card-mode-accent": palette.primary,
    "--card-mode-secondary": palette.secondary,
    "--card-mode-spark": palette.spark,
    "--card-clip-path": clipPath,
  };
  if (reducedMotion) {
    return {
      ...modeVars,
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
    ...modeVars,
    "--card-x": `${pose.translateX}px`,
    "--card-y": `${pose.translateY}px`,
    "--card-rot": `${pose.rotateZ}deg`,
    "--card-scale": pose.scale,
    "--card-scale-eff": pose.scale * (1000 / (1000 - pose.translateZ)),
    "--card-z": pose.translateZ,
    zIndex: pose.zIndex,
  };
};

const getStackedCardProps = (isTopCard, modeItem, lang, wasDraggingRef, onSelect) => {
  if (isTopCard) {
    return { "aria-describedby": `card-desc-${modeItem.key}` };
  }
  const modeTitle =
    lang === "fr" ? modeItem.titleFr.replaceAll("\n", " ") : modeItem.titleEn.replaceAll("\n", " ");
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": modeTitle,
    onClick: (e) => {
      if (wasDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onSelect();
    },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
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

  const cardStyle = getCardStyle(pose, isTopCard, reducedMotion, modeItem.key);
  const selectSideCard = () => onSelectSideCard(stackPos);

  const plateNumber = String(idx + 1).padStart(2, "0");
  const plateLabel = lang === "fr" ? `Planche ${plateNumber}` : `Plate ${plateNumber}`;
  const badgeText = lang === "fr" ? modeItem.badgeFr : modeItem.badgeEn;
  const badgeLabel =
    lang === "fr"
      ? modeItem.countLabelFr || modeItem.badgeFr
      : modeItem.countLabelEn || modeItem.badgeEn;

  const interactiveProps = getStackedCardProps(
    isTopCard,
    modeItem,
    lang,
    wasDraggingRef,
    selectSideCard
  );

  return (
    <Card
      data-mode={modeItem.key}
      data-stack-pos={stackPos}
      data-is-prev={stackPos === totalModes - 1 ? "true" : undefined}
      look="mode-deck"
      className={`${isTopCard ? "is-top-card" : "is-stacked-card"}`}
      style={cardStyle}
      {...interactiveProps}
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
    </Card>
  );
};

export default ModeCard;
