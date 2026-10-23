import { describe, expect, it, vi } from "vitest";

vi.mock("../services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  getSupabase: () => Promise.resolve(null),
}));

import { profileSession } from "../hooks/useUserProfile";

describe("profileSession", () => {
  it("ignores the anonymous Conquête account for profile sync", () => {
    expect(profileSession({ user: { id: "x", is_anonymous: true } })).toBeNull();
  });
  it("keeps real sessions and null", () => {
    const s = { user: { id: "y", is_anonymous: false } };
    expect(profileSession(s)).toBe(s);
    expect(profileSession(null)).toBeNull();
  });
});
