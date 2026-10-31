import { isSupabaseConfigured } from "../services/supabaseClient";

const PREVIEW_PARAM = "conquestPreview";

/** Dev-only URL parameter (`?conquestPreview=lobby|live|finished|idle|countdown|home`). */
export const readConquestPreview = (loc = globalThis.location) => {
  if (!import.meta.env.DEV) return "";
  try {
    const params = new URLSearchParams(loc?.search || "");
    if (!params.has(PREVIEW_PARAM)) return "";
    const raw = (params.get(PREVIEW_PARAM) || "").trim().toLowerCase();
    return raw || "lobby";
  } catch {
    return "";
  }
};

/**
 * Feature flag for the « Conquête » multiplayer mode.
 * Hidden unless Supabase is configured AND VITE_ENABLE_CONQUEST === "true"
 * (or when `?conquestPreview` is active in DEV).
 */
export const isConquestEnabled = (loc = globalThis.location) =>
  Boolean(readConquestPreview(loc)) ||
  (isSupabaseConfigured && import.meta.env.VITE_ENABLE_CONQUEST === "true");
