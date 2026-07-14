import { useEffect, useRef } from "react";

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Smoothly animates --globe-panel-shift on elementRef without React re-renders. */
export function useGlobePanelShift(targetShift, elementRef, durationMs = 420) {
  const shiftRef = useRef(targetShift);
  const rafRef = useRef(null);

  useEffect(() => {
    const el = elementRef?.current;
    const from = shiftRef.current;
    const to = targetShift;

    const apply = (value) => {
      shiftRef.current = value;
      if (el) {
        el.style.setProperty("--globe-panel-shift", `${value}px`);
      }
    };

    if (Math.abs(to - from) < 0.5) {
      apply(to);
      return;
    }

    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      apply(from + (to - from) * easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetShift, durationMs, elementRef]);
}