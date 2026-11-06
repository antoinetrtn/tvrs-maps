import { STORAGE_KEYS } from "../config/gameConstants";
import { isGuestLaunch } from "../multiplayer/conquestLink";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { secureRandomInt } from "./secureRandom";

export function readInitialPeacefulMode() {
  try {
    const p = localStorage.getItem(STORAGE_KEYS.peacefulMode);
    if (p !== null) {
      return p === "true";
    }
    const h = localStorage.getItem(STORAGE_KEYS.hardcoreMode);
    if (h !== null) {
      return h === "false";
    }
  } catch {}
  return false;
}

export function tryFocusGameInput(input) {
  if (!input || document.activeElement === input) {
    return;
  }
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

export function pickRandomHomeKey(activeDataMap) {
  if (!activeDataMap) {
    return null;
  }
  const keys = Object.keys(activeDataMap).filter((k) => activeDataMap[k]?.lat !== undefined);
  if (keys.length === 0) {
    return null;
  }
  const index = secureRandomInt(0, keys.length);
  return keys[index];
}

export function pickNextAutorotateKey(activeDataMap) {
  if (!activeDataMap) {
    return null;
  }
  const freshKeys = Object.keys(activeDataMap).filter((k) => activeDataMap[k]?.lat !== undefined);
  if (freshKeys.length === 0) {
    return null;
  }
  const nextIndex = secureRandomInt(0, freshKeys.length);
  return freshKeys[nextIndex];
}

export function shouldShowInitialAuthModal(session) {
  if (isSupabaseConfigured && session === null) {
    return !isGuestLaunch();
  }
  return false;
}
