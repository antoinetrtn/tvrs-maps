import "./TrainingSheet.css";
import "./ui/ui.css";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "../config/i18n";
import {
  countryStatsService,
  DEFAULT_TRAINING_POOL_SIZE,
  getWeakness,
  isEntrySeen,
  rankKeys,
  REVIEW_THRESHOLD,
  summarizeMastery,
  TRAINING_POOL_SIZES,
} from "../services/countryStats";
import { buildTrainingPool, getTrainableKeys } from "../utils/trainingPool";
import {
  TrainingHeader,
  TrainingReset,
  TrainingReviewSection,
  TrainingStats,
} from "./TrainingSheetSections";
import Button from "./ui/Button";
import Dialog from "./ui/Dialog";
import OptionGroup from "./ui/OptionGroup";

function useTrainingSheetData({ open, mode, profileId, onStart, onClose }) {
  const [resetCount, setResetCount] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showResetDone, setShowResetDone] = useState(false);

  const keys = useMemo(() => getTrainableKeys(mode), [mode]);
  // Re-read the local stats each time the sheet opens or after a reset (`open` / `resetCount`).
  const stats = useMemo(
    () => countryStatsService.getModeStats(profileId, mode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, mode, profileId, resetCount]
  );
  const summary = useMemo(() => summarizeMastery(keys, stats), [keys, stats]);

  const weakestKeys = useMemo(() => {
    if (!summary.hasEnoughData) return [];
    const seen = keys.filter(
      (k) => isEntrySeen(stats[k]) && getWeakness(stats[k]) >= REVIEW_THRESHOLD
    );
    return rankKeys(seen, stats).slice(0, 5);
  }, [keys, stats, summary.hasEnoughData]);

  const availableSizes = useMemo(() => {
    const filtered = TRAINING_POOL_SIZES.filter((s) => s <= keys.length);
    return filtered.length > 0 ? filtered : [Math.max(1, keys.length)];
  }, [keys.length]);

  const defaultSize = useMemo(
    () =>
      availableSizes.includes(DEFAULT_TRAINING_POOL_SIZE)
        ? DEFAULT_TRAINING_POOL_SIZE
        : availableSizes[availableSizes.length - 1],
    [availableSizes]
  );

  const [size, setSize] = useState(defaultSize);

  useEffect(() => {
    if (open) {
      setSize(defaultSize);
      setConfirmReset(false);
    }
  }, [open, defaultSize]);

  useEffect(() => {
    if (!showResetDone) return;
    const timer = setTimeout(() => setShowResetDone(false), 1500);
    return () => clearTimeout(timer);
  }, [showResetDone]);

  const handleStart = useCallback(() => {
    const pool = buildTrainingPool(mode, stats, size);
    onStart?.(pool);
    onClose?.();
  }, [mode, stats, size, onStart, onClose]);

  const handleResetConfirm = useCallback(() => {
    countryStatsService.reset(profileId);
    setResetCount((c) => c + 1);
    setConfirmReset(false);
    setShowResetDone(true);
  }, [profileId]);

  return {
    summary,
    weakestKeys,
    availableSizes,
    size,
    setSize,
    confirmReset,
    setConfirmReset,
    showResetDone,
    handleStart,
    handleResetConfirm,
  };
}

export default function TrainingSheet({ open, mode, lang, profileId, onClose, onStart }) {
  const t = useTranslation(lang);
  const data = useTrainingSheetData({ open, mode, profileId, onStart, onClose });

  const sizeOptions = useMemo(
    () =>
      data.availableSizes.map((s) => ({
        value: s,
        label: t("training_size_option", { n: s }),
      })),
    [data.availableSizes, t]
  );

  return (
    <Dialog
      variant="sheet"
      open={open}
      onClose={onClose}
      labelledBy="training-sheet-title"
      backdropTestId="training-sheet-backdrop"
    >
      <TrainingHeader
        title={t("training_title")}
        subtitle={t(`mode_${mode}`)}
        closeLabel={t("training_close")}
        onClose={onClose}
      />
      <div className="training-sheet-body">
        <p className="training-intro">{t("training_intro")}</p>
        <TrainingStats summary={data.summary} t={t} />
        <TrainingReviewSection
          hasEnoughData={data.summary.hasEnoughData}
          weakestKeys={data.weakestKeys}
          mode={mode}
          lang={lang}
          t={t}
        />
        <div className="training-section">
          <span className="training-label">{t("training_size")}</span>
          <OptionGroup
            options={sizeOptions}
            value={data.size}
            onChange={data.setSize}
            label={t("training_size")}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          look="training-start"
          className="training-btn"
          onClick={data.handleStart}
        >
          {t("training_start")}
        </Button>
        <TrainingReset
          seenCount={data.summary.seen}
          confirmReset={data.confirmReset}
          showResetDone={data.showResetDone}
          onPromptReset={() => data.setConfirmReset(true)}
          onCancelReset={() => data.setConfirmReset(false)}
          onConfirmReset={data.handleResetConfirm}
          t={t}
        />
      </div>
    </Dialog>
  );
}
