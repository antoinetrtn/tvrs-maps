import React from "react";

import Button from "../components/ui/Button.jsx";
import { getConquestRulesText } from "./conquestRulesText";

/** Discreet « Règles » text link at the end of the lobby subtitle (no framed button). */
export function ConquestRulesButton({ lang, onClick }) {
  const t = getConquestRulesText(lang);
  return (
    <Button variant="ghost" size="sm" className="conquest-rules-link" onClick={onClick}>
      {t.open}
    </Button>
  );
}
