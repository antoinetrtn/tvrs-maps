/**
 * Breakpoint scale — single source of truth for viewport widths.
 *
 * CSS media queries cannot read custom properties, so stylesheets must use one of the
 * values of BREAKPOINT_SCALE (px). A "max-width" query uses the value, its complementary
 * "min-width" query uses value + 1 (e.g. `(max-width: 768px)` / `(min-width: 769px)`).
 * `scripts/check-css-rules.mjs` (rule `breakpoint-offscale`) enforces this ratchet-style.
 * JS code reads BREAKPOINTS instead of hard-coding widths.
 */
export const BREAKPOINT_SCALE = Object.freeze({
  xs: 360,
  sm: 480,
  md: 640,
  lg: 768,
  xl: 1024,
  xxl: 1280,
  wide: 1440,
});

export const BREAKPOINTS = Object.freeze({
  /** Phones and small tablets: the compact (mobile) layout is used up to this width. */
  mobile: BREAKPOINT_SCALE.lg,
  /** Below this width the in-game data panel does not reserve screen space. */
  desktop: BREAKPOINT_SCALE.xl,
});
