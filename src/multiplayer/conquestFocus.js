export const CONQUEST_FOCUS_HOLD_MS = 2500;

/**
 * Derives the next focus object from the previous focus and an incoming country ID.
 * Returns null when countryId is falsy, or when sticky and prev?.id === countryId and prev.sticky
 * (tap to deselect); otherwise returns { id: countryId, sticky: Boolean(sticky) }.
 */
export function nextConquestFocus(prev, countryId, { sticky } = {}) {
  if (!countryId) return null;
  if (sticky && prev?.id === countryId && prev.sticky) {
    return null;
  }
  return { id: countryId, sticky: Boolean(sticky) };
}

/**
 * Returns true only when focus exists and is transient (not sticky).
 */
export function shouldAutoRelease(focus) {
  return Boolean(focus && !focus.sticky);
}

/**
 * Attaches quietFocusId to the overlay when focus is transient (not sticky).
 * Returns the exact overlay reference when overlay is falsy or focus is falsy/sticky.
 */
export function withQuietFocus(overlay, focus) {
  if (!overlay || !focus || focus.sticky) return overlay;
  return { ...overlay, quietFocusId: focus.id };
}
