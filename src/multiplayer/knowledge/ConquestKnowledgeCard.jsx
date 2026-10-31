import "./ConquestKnowledge.css";

import React, { useEffect, useState } from "react";

import Button from "../../components/ui/Button.jsx";
import PanelCloseButton from "../../components/ui/PanelCloseButton.jsx";
import { countryDataMap } from "../../data/gameData";
import { remainingMs } from "../conquestLogic";
import { conquestText } from "../conquestText";
import { getCategoryLabel } from "./knowledgeCategories";
import { loadKnowledgePack } from "./knowledgePack";
import PixelIcon from "./PixelIcon.jsx";

const DEFAULT_DURATION_MS = 15000;
const TICK_MS = 250;

function isEditableTarget(target) {
  if (!target || typeof target.tagName !== "string") return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function computeRemainingRatio(expiresAt, now, clockOffset, durationMs) {
  if (!expiresAt) return { ms: durationMs, sec: Math.ceil(durationMs / 1000), ratio: 1 };
  const ms = remainingMs(expiresAt, now, clockOffset);
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const ratio = Math.min(1, Math.max(0, ms / durationMs));
  return { ms, sec, ratio };
}

/**
 * 2x2 pixel-art QCM card for the Conquête knowledge escalation step (15 s timer, keys 1-4).
 */
const ConquestKnowledgeCard = ({
  challenge,
  countryName = (id) => id,
  lang = "fr",
  t: customT,
  clockOffset = 0,
  durationMs = DEFAULT_DURATION_MS,
  disabled = false,
  myColor,
  onAnswer,
  onCancel,
}) => {
  const t = customT || conquestText(lang);
  const [now, setNow] = useState(() => Date.now());
  const choices = Array.isArray(challenge?.choices) ? challenge.choices.slice(0, 4) : [];
  const isFortify = challenge?.mode === "fortify";
  const categoryLabel = getCategoryLabel(challenge?.category, lang);
  const countryLabel = challenge?.country_id ? countryName(challenge.country_id) : "";

  useEffect(() => {
    const region = challenge?.country_id ? countryDataMap[challenge.country_id]?.region : null;
    if (region) void loadKnowledgePack(region);
  }, [challenge?.country_id]);

  useEffect(() => {
    if (!challenge?.expires_at) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [challenge?.expires_at]);

  useEffect(() => {
    if (disabled || typeof onAnswer !== "function") return undefined;
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) return;
      const idx = Number(event.key) - 1;
      if (idx >= 0 && idx < choices.length) {
        event.preventDefault();
        onAnswer(idx);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [choices.length, disabled, onAnswer]);

  const { sec, ratio } = computeRemainingRatio(challenge?.expires_at, now, clockOffset, durationMs);
  const maxSec = Math.ceil(durationMs / 1000);

  return (
    <div
      className={`cq-knowledge${isFortify ? " is-fortify" : ""}`}
      style={isFortify && myColor ? { "--my-color": myColor } : undefined}
      role="group"
      aria-label={t.knowledgeTitle || "Escalade de connaissances"}
    >
      <div className="cq-knowledge-head">
        <div className="cq-knowledge-meta">
          <span className="cq-knowledge-chip">{categoryLabel}</span>
          {countryLabel && <span className="cq-knowledge-country">{countryLabel}</span>}
        </div>
        {onCancel && <PanelCloseButton label={t.stealCancel} onClick={onCancel} />}
      </div>

      <div
        className={`cq-knowledge-timer${sec <= 5 ? " is-urgent" : ""}`}
        role="progressbar"
        aria-label={t.knowledgeTimer || "Temps restant"}
        aria-valuemin={0}
        aria-valuemax={maxSec}
        aria-valuenow={sec}
        style={{ "--timer-scale": ratio.toFixed(3) }}
      >
        <div className="cq-knowledge-timer-fill" />
      </div>

      <p className="cq-knowledge-prompt">{challenge?.prompt}</p>

      <div className="cq-knowledge-grid">
        {choices.map((choice, index) => (
          <Button
            key={`${choice.iconId || "icon"}-${index}`}
            variant="secondary"
            className="cq-knowledge-choice"
            disabled={disabled}
            aria-keyshortcuts={String(index + 1)}
            onClick={() => onAnswer?.(index)}
          >
            <span className="cq-knowledge-key" aria-hidden="true">
              {index + 1}
            </span>
            <PixelIcon iconId={choice.iconId} />
            <span className="cq-knowledge-label">{choice.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ConquestKnowledgeCard;
