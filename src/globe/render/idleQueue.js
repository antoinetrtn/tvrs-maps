/**
 * Runs `tasks` one by one during browser idle time, never holding the main
 * thread past ~`budgetMs` per slice. Returns a cancel function.
 */
const hasIdle = () =>
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function";

const schedule = (cb) =>
  hasIdle()
    ? { id: window.requestIdleCallback(cb, { timeout: 1500 }), idle: true }
    : { id: setTimeout(() => cb({ timeRemaining: () => 8 }), 16), idle: false };

const unschedule = (h) => {
  if (!h) return;
  if (h.idle) window.cancelIdleCallback?.(h.id);
  else clearTimeout(h.id);
};

export function runInIdleSlices(tasks, { startDelayMs = 0, budgetMs = 6, onDone } = {}) {
  let i = 0;
  let handle = null;
  let startTimer = null;
  let cancelled = false;

  const step = (deadline) => {
    handle = null;
    if (cancelled) return;
    const t0 = performance.now();
    while (i < tasks.length) {
      tasks[i++]();
      const spent = performance.now() - t0;
      const left = deadline?.timeRemaining ? deadline.timeRemaining() : budgetMs - spent;
      if (spent >= budgetMs || left < 2) break;
    }
    if (i < tasks.length) handle = schedule(step);
    else onDone?.();
  };

  startTimer = setTimeout(() => {
    startTimer = null;
    if (!cancelled) handle = schedule(step);
  }, startDelayMs);

  return () => {
    cancelled = true;
    if (startTimer) clearTimeout(startTimer);
    unschedule(handle);
  };
}
