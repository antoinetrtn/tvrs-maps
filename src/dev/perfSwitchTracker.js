const PARAM = "perf";

/** True only when the page was opened with `?perf=1`. Off everywhere else. */
export function isPerfSwitchEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get(PARAM) === "1";
  } catch {
    return false;
  }
}

let switchStartMark = 0;
let lastSwitch = null;
const listeners = new Set();

export function markHomeModeSwitch(toMode) {
  if (!isPerfSwitchEnabled()) return;
  switchStartMark = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.info("[tvrs-perf] card/mode", toMode, "t=0");
}

export function recordLayerSwitch(toMode, { from } = {}) {
  if (!isPerfSwitchEnabled()) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const sinceCardMs = switchStartMark > 0 ? Math.round(now - switchStartMark) : null;
  lastSwitch = {
    from: from ?? null,
    to: toMode,
    sinceCardMs,
    at: now,
  };
  if (typeof window !== "undefined") {
    window.__TVRS_PERF_SWITCH__ = { last: lastSwitch };
  }
  console.info("[tvrs-perf] globe layer", lastSwitch);
  listeners.forEach((fn) => fn(lastSwitch));
}

export function getLastPerfSwitch() {
  return lastSwitch;
}

export function subscribePerfSwitch(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
