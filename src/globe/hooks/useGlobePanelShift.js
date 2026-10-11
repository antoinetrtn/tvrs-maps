import { useEffect, useRef } from "react";

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const VARS = { x: "--globe-panel-shift", y: "--globe-keyboard-shift" };

/**
 * Smoothly animates the globe wrapper's screen-space shift without React
 * re-renders: x = desktop data panel, y = mobile keyboard (keeps the selected
 * country centred in the part of the screen that is actually visible).
 * Accepts a number (x only) or { x, y }.
 */
export function useGlobePanelShift(target, elementRef, durationMs = 420) {
  const toX = typeof target === "number" ? target : target?.x || 0;
  const toY = typeof target === "number" ? 0 : target?.y || 0;
  const shiftRef = useRef({ x: toX, y: toY });
  const rafRef = useRef(null);

  useEffect(() => {
    const el = elementRef?.current;
    const from = { ...shiftRef.current };

    const apply = (x, y) => {
      shiftRef.current = { x, y };
      if (el) {
        el.style.setProperty(VARS.x, `${x}px`);
        el.style.setProperty(VARS.y, `${y}px`);
      }
    };

    if (Math.abs(toX - from.x) < 0.5 && Math.abs(toY - from.y) < 0.5) {
      apply(toX, toY);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const k = easeOutCubic(t);
      apply(from.x + (toX - from.x) * k, from.y + (toY - from.y) * k);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [toX, toY, durationMs, elementRef]);
}
