import { isSupabaseConfigured } from "../services/supabaseClient";

/**
 * Feature flag for the « Conquête » multiplayer mode.
 * Hidden unless Supabase is configured AND VITE_ENABLE_CONQUEST === "true"
 * (to be set only once the conquest migrations are applied).
 */
export const isConquestEnabled = () =>
  isSupabaseConfigured && import.meta.env.VITE_ENABLE_CONQUEST === "true";
