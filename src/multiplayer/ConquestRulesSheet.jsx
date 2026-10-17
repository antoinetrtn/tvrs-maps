import "./ConquestRules.css";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { getConquestRulesText } from "./conquestRulesText";
import RulesScene from "./RulesScene";
import { markRulesSeen } from "./useConquestRulesAutoOpen";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const NUM_TOKEN_REGEX = /(\+?\d+(?:v\d| pts| s\b)?)/g;

function renderHighlightedText(text) {
  if (!text) {
    return null;
  }
  let offset = 0;
  return text.split(NUM_TOKEN_REGEX).map((chunk) => {
    const at = offset;
    offset += chunk.length;
    if (!/\d/.test(chunk)) {
      return chunk;
    }
    return (
      <strong key={`n${at}`} className="conquest-rules-highlight">
        {chunk}
      </strong>
    );
  });
}

function trapFocus(event, dialog) {
  if (event.key !== "Tab" || !dialog) {
    return;
  }
  const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables.at(-1);
  if (event.shiftKey) {
    if (document.activeElement === first || !dialog.contains(document.activeElement)) {
      event.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

const makeIcon = (d, size = 24) => (
  <svg
    width={size}
    height={size}
    viewBox={`0 0 ${size} ${size}`}
    fill="currentColor"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const CLOSE_PATH =
  "M2 2h2v2H2V2zm10 0h2v2h-2V2zm-8 2h2v2H4V4zm6 0h2v2h-2V4zm-4 2h4v4H6V6zm-2 4h2v2H4v-2zm6 0h2v2h-2v-2zm-8 2h2v2H2v-2zm10 0h2v2h-2v-2z";

const HELP_PATH =
  "M4 2h8v2H4V2zM2 4h2v4H2V4zm10 0h2v4h-2V4zm-2 4h2v2h-2V8zM8 10h2v2H8v-2zm0 4h2v2H8v-2z";

/** « ? Règles » button used by the lobby and the in-match HUD. */
export function ConquestRulesButton({ lang, onClick }) {
  const t = getConquestRulesText(lang);
  return (
    <button type="button" className="conquest-rules-open-btn" onClick={onClick}>
      {makeIcon(HELP_PATH, 16)}
      <span>{t.open}</span>
    </button>
  );
}

function useDialogFocus(open, handleClose, dialogRef) {
  const prevActiveRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const prevActive = document.activeElement;
    prevActiveRef.current = prevActive;

    const focusTimer = setTimeout(() => {
      if (!dialogRef.current) {
        return;
      }
      const focusables = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
        return;
      }
      trapFocus(event, dialogRef.current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      if (prevActive && typeof prevActive.focus === "function") {
        prevActive.focus();
      }
    };
  }, [open, handleClose, dialogRef]);
}

export default function ConquestRulesSheet({ open, onClose, lang }) {
  const t = getConquestRulesText(lang);
  const dialogRef = useRef(null);

  const handleClose = useCallback(() => {
    markRulesSeen();
    onClose?.();
  }, [onClose]);

  useDialogFocus(open, handleClose, dialogRef);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="conquest-rules-backdrop">
      <button
        type="button"
        className="conquest-rules-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={handleClose}
        data-testid="conquest-rules-backdrop"
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="conquest-rules-title"
        className="conquest-rules-dialog"
        ref={dialogRef}
      >
        <header className="conquest-rules-header">
          <div className="conquest-rules-header-text">
            <h2 id="conquest-rules-title" className="conquest-rules-title">
              {t.title}
            </h2>
            <p className="conquest-rules-subtitle">{t.subtitle}</p>
          </div>
          <button
            type="button"
            className="conquest-rules-close-btn"
            onClick={handleClose}
            aria-label={t.close}
          >
            {makeIcon(CLOSE_PATH, 16)}
          </button>
        </header>

        <div className="conquest-rules-body">
          <div className="conquest-rules-grid">
            {t.sections.map((section) => (
              <article key={section.id} className="conquest-rules-card">
                <RulesScene id={section.id} />
                <div className="conquest-rules-card-content">
                  <div className="conquest-rules-card-head">
                    <h3 className="conquest-rules-card-title">{section.title}</h3>
                  </div>
                  <p className="conquest-rules-card-text">{renderHighlightedText(section.text)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </dialog>
    </div>,
    document.body
  );
}
