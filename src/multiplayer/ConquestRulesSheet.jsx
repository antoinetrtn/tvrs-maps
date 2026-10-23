import "./ConquestRules.css";

import { useCallback } from "react";

import Button from "../components/ui/Button.jsx";
import Dialog, { DialogTitle } from "../components/ui/Dialog";
import IconButton from "../components/ui/IconButton";
import { getConquestRulesText } from "./conquestRulesText";
import RulesIllustration from "./RulesIllustration";
import { markRulesSeen } from "./useConquestRulesAutoOpen";

const NUM_TOKEN_REGEX = /(\+?\d+(?:v\d| pts| s\b)?)/g;

function renderHighlightedText(text) {
  if (!text) {
    return null;
  }
  let offset = 0;
  return text.split(NUM_TOKEN_REGEX).map((chunk) => {
    const at = offset;
    offset += chunk.length;
    if (!/\d/.test(chunk)) return chunk;
    return (
      <strong key={`n${at}`} className="conquest-rules-highlight">
        {chunk}
      </strong>
    );
  });
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

const ICON_PATHS = {
  match:
    "M7 3h10v2H7V3zm-2 2h2v2H5V5zm12 0h2v2h-2V5zM3 7h2v10H3V7zm16 0h2v10h-2V7zM5 17h2v2H5v-2zm12 0h2v2h-2v-2zm-10 2h10v2H7v-2zm4-12h2v6h-2V7zm0 4h5v2h-5v-2z",
  capture:
    "M4 2h8v2H4V2zM2 4h2v8H2V4zm10 0h2v6h-2V4zM4 12h6v2H4v-2zm3-8h2v8H7V4zm-3 3h8v2H4V7zm9 4h2v8h-2v-8zm2 2h2v6h-2v-6zm2 2h2v4h-2v-4zm2 2h2v2h-2v-2zm-4 0h4v2h-4v-2z",
  shield:
    "M4 3h16v2H4V3zm-1 2h2v7H3V5zm16 0h2v7h-2V5zm-2 7h2v3h-2v-3zm-12 0h2v3H5v-3zm2 3h2v3H7v-3zm8 0h2v3h-2v-3zm-6 3h2v2H9v-2zm4 0h2v2h-2v-2zm-2 2h2v2h-2v-2zm0-13h2v8h-2V7zm-3 3h8v2H8v-2z",
  steal:
    "M4 7h12v2H4V7zm10-2h2v2h-2V5zm2 2h2v2h-2V7zm-2 2h2v2h-2V9zM8 15h12v2H8v-2zm0-2h2v2H8v-2zm-2 2h2v2H6v-2zm2 2h2v2H8v-2z",
  failedSteal:
    "M5 3h14v2H5V3zm0 16h14v2H5v-2zM6 5h2v3H6V5zm10 0h2v3h-2V5zM8 8h2v2H8V8zm6 0h2v2h-2V8zm-4 2h4v4h-4v-4zm-2 4h2v2H8v-2zm6 0h2v2h-2v-2zm-8 2h2v3H6v-3zm10 0h2v3h-2v-3zm-5-10h2v2h-2V6zm-1 11h4v2h-4v-2z",
  bonus:
    "M3 4h6v4H3V4zm1 4h4v3H4V8zm1 3h3v6H5v-6zm1 6h2v3H6v-3zm7-14h7v3h-7V3zm-2 3h10v5H11V6zm2 5h6v6h-6v-6zm1 6h3v3h-3v-3zm4 0h3v2h-3v-2z",
  end: "M6 4h12v2H6V4zm1 2h10v6H7V6zm2 6h6v2H9v-2zm-5-7h2v4H4V5zm1 3h2v2H5V8zm13-3h2v4h-2V5zm-1 3h2v2h-2V8zm-6 6h2v3h-2v-3zm-3 3h8v2H8v-2zm-1 2h10v2H7v-2z",
  elo: "M3 4h2v17H3V4zm0 15h18v2H3v-2zm4-5h2v5H7v-5zm4-3h2v8h-2v-8zm4-3h2v11h-2V8zm4-3h2v14h-2V5z",
};

/** Discreet « Règles » text link at the end of the lobby subtitle (no framed button). */
export function ConquestRulesButton({ lang, onClick }) {
  const t = getConquestRulesText(lang);
  return (
    <Button variant="ghost" size="sm" className="conquest-rules-link" onClick={onClick}>
      {t.open}
    </Button>
  );
}

export default function ConquestRulesSheet({ open, onClose, lang }) {
  const t = getConquestRulesText(lang);

  const handleClose = useCallback(() => {
    markRulesSeen();
    onClose?.();
  }, [onClose]);

  return (
    <Dialog
      variant="sheet"
      open={open}
      onClose={handleClose}
      labelledBy="conquest-rules-title"
      className="conquest-rules-dialog"
      backdropTestId="conquest-rules-backdrop"
    >
      <header className="conquest-rules-header">
        <div className="conquest-rules-header-text">
          <DialogTitle className="conquest-rules-title">{t.title}</DialogTitle>
          <p className="conquest-rules-subtitle">{t.subtitle}</p>
        </div>
        <IconButton
          variant="outline"
          size="sm"
          label={t.close}
          className="conquest-rules-close-btn"
          onClick={handleClose}
        >
          {makeIcon(CLOSE_PATH, 16)}
        </IconButton>
      </header>

      <div className="conquest-rules-body">
        <RulesIllustration labels={t.illustration} />
        <div className="conquest-rules-grid">
          {t.sections.map((section) => (
            <article key={section.id} className="conquest-rules-card">
              <div className="conquest-rules-card-head">
                <span className="conquest-rules-icon">{makeIcon(ICON_PATHS[section.id])}</span>
                <h3 className="conquest-rules-card-title">{section.title}</h3>
              </div>
              <p className="conquest-rules-card-text">{renderHighlightedText(section.text)}</p>
            </article>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
