import { useEffect, useState } from "react";

import { getLastPerfSwitch, isPerfSwitchEnabled, subscribePerfSwitch } from "./perfSwitchTracker";

/** Fixed overlay. Mount anywhere; renders nothing unless `?perf=1`. */
export default function PerfSwitchOverlay() {
  const [enabled] = useState(isPerfSwitchEnabled);
  const [entry, setEntry] = useState(getLastPerfSwitch);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribePerfSwitch((next) => setEntry(next));
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      data-testid="tvrs-perf-overlay"
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 9999,
        padding: "6px 8px",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        lineHeight: 1.35,
        color: "var(--text-main)",
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        pointerEvents: "none",
        maxWidth: 240,
      }}
    >
      <div>perf=1 — layer switch</div>
      {entry ? (
        <div>
          {entry.from || "?"} → {entry.to}
          {entry.sinceCardMs != null ? ` · ${entry.sinceCardMs} ms from card` : ""}
        </div>
      ) : (
        <div>switch a homepage card</div>
      )}
    </div>
  );
}
