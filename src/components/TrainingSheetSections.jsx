import { Close } from "pixelarticons/react";
import React from "react";

import { getTrainingLabel } from "../utils/trainingPool";

const TOTAL_BAR_CELLS = 20;

export const TrainingHeader = ({ title, subtitle, closeLabel, onClose }) => (
  <header className="training-sheet-header">
    <div className="training-section">
      <h2 id="training-sheet-title" className="training-sheet-title">
        {title}
      </h2>
      <p className="training-sheet-subtitle">{subtitle}</p>
    </div>
    <button
      type="button"
      className="training-sheet-close-btn"
      onClick={onClose}
      aria-label={closeLabel}
      title={closeLabel}
    >
      <Close width={20} height={20} aria-hidden="true" />
    </button>
  </header>
);

export const TrainingStats = ({ summary, t }) => {
  const filledCount =
    summary.total > 0 ? Math.round((summary.seen / summary.total) * TOTAL_BAR_CELLS) : 0;

  return (
    <div className="training-section">
      <span className="training-label">
        {t("training_stats", {
          seen: summary.seen,
          total: summary.total,
          review: summary.toReview,
        })}
      </span>
      <div className="training-bar" aria-hidden="true">
        {Array.from({ length: TOTAL_BAR_CELLS }, (_, i) => (
          <div
            key={i}
            className={`training-bar-cell ${i < filledCount ? "filled" : ""}`}
            style={{ "--cell-i": i }}
          />
        ))}
      </div>
    </div>
  );
};

export const TrainingReviewSection = ({ hasEnoughData, weakestKeys, mode, lang, t }) => {
  if (!hasEnoughData) {
    return (
      <p className="training-empty-note" role="note">
        {t("training_empty")}
      </p>
    );
  }
  if (weakestKeys.length === 0) return null;

  return (
    <div className="training-section">
      <span className="training-label">{t("training_weakest")}</span>
      <div className="training-chips-grid">
        {weakestKeys.map((key, i) => (
          <span key={key} className="training-chip" style={{ "--chip-i": i }}>
            {getTrainingLabel(mode, key, lang)}
          </span>
        ))}
      </div>
    </div>
  );
};

export const TrainingReset = ({
  seenCount,
  confirmReset,
  showResetDone,
  onPromptReset,
  onCancelReset,
  onConfirmReset,
  t,
}) => {
  if (showResetDone) {
    return (
      <div className="training-reset-status" role="status" aria-live="polite">
        {t("training_reset_done")}
      </div>
    );
  }
  if (seenCount === 0) return null;

  if (confirmReset) {
    return (
      <div className="training-reset-row confirm">
        <span className="training-reset-confirm-text">{t("training_reset_confirm")}</span>
        <div className="training-reset-actions">
          <button
            type="button"
            className="training-btn training-action-btn training-cancel-btn"
            onClick={onCancelReset}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className="training-btn training-action-btn training-confirm-btn"
            onClick={onConfirmReset}
          >
            {t("training_reset_yes")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="training-reset-row">
      <button type="button" className="training-reset-btn" onClick={onPromptReset}>
        {t("training_reset")}
      </button>
    </div>
  );
};
