import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getConquestState: vi.fn(),
  getExistingConquestUser: vi.fn(),
  getMyActiveConquestMatch: vi.fn(),
  leaveConquestMatch: vi.fn(),
  cancelStealChallenge: vi.fn(),
  openConquestChannel: vi.fn(),
}));
vi.mock("../multiplayer/conquestApi", () => ({
  ...api,
  claimConquestCountry: vi.fn(),
  createConquestMatch: vi.fn(),
  ensureConquestUser: vi.fn(),
  joinConquestMatch: vi.fn(),
  requestStealChallenge: vi.fn(),
  setConquestReady: vi.fn(),
  startConquestMatch: vi.fn(),
  stealConquestCountry: vi.fn(),
}));

import {
  CONQUEST_STORAGE_KEY,
  hasStoredConquestMatch,
  useConquestMatch,
} from "../multiplayer/useConquestMatch";

const MATCH = { id: "m1", code: "ABC123", status: "live" };
const state = (version, extra = {}) => ({
  server_now: new Date().toISOString(),
  version,
  match: MATCH,
  players: [],
  claims: [],
  events: [],
  bonuses: [],
  ...extra,
});

describe("useConquestMatch", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.openConquestChannel.mockReturnValue({ notify: vi.fn(), close: vi.fn() });
    api.getExistingConquestUser.mockResolvedValue("u1");
    api.leaveConquestMatch.mockResolvedValue({ ok: true });
  });
  afterEach(() => localStorage.clear());

  it("does not resume without a stored match", async () => {
    const { result } = renderHook(() => useConquestMatch({ lang: "fr", displayName: "A" }));
    await expect(result.current.resume()).resolves.toBe(false);
    expect(api.getMyActiveConquestMatch).not.toHaveBeenCalled();
  });

  it("resumes the active match after a reload and persists it", async () => {
    localStorage.setItem(CONQUEST_STORAGE_KEY, JSON.stringify({ id: "m1", code: "ABC123" }));
    api.getMyActiveConquestMatch.mockResolvedValue(MATCH);
    api.getConquestState.mockResolvedValue(state(3));
    const { result } = renderHook(() => useConquestMatch({ lang: "fr", displayName: "A" }));
    let ok;
    await act(async () => {
      ok = await result.current.resume();
    });
    expect(ok).toBe(true);
    expect(result.current.match.id).toBe("m1");
    expect(result.current.userId).toBe("u1");
    expect(hasStoredConquestMatch()).toBe(true);
  });

  it("clears a stale stored match the server no longer knows", async () => {
    localStorage.setItem(CONQUEST_STORAGE_KEY, JSON.stringify({ id: "old", code: "X" }));
    api.getMyActiveConquestMatch.mockResolvedValue(null);
    const { result } = renderHook(() => useConquestMatch({ lang: "fr", displayName: "A" }));
    await act(async () => {
      await result.current.resume();
    });
    expect(hasStoredConquestMatch()).toBe(false);
  });

  it("ignores an out-of-order (older) state reply", async () => {
    localStorage.setItem(CONQUEST_STORAGE_KEY, JSON.stringify({ id: "m1", code: "ABC123" }));
    api.getMyActiveConquestMatch.mockResolvedValue(MATCH);
    api.getConquestState.mockResolvedValueOnce(state(5, { claims: [{ country_id: "France" }] }));
    const { result } = renderHook(() => useConquestMatch({ lang: "fr", displayName: "A" }));
    await act(async () => {
      await result.current.resume();
    });
    api.getConquestState.mockResolvedValueOnce(state(4));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.version).toBe(5);
    expect(result.current.claims).toHaveLength(1);
  });

  it("leaving a live match tells the server (forfeit) and forgets it", async () => {
    localStorage.setItem(CONQUEST_STORAGE_KEY, JSON.stringify({ id: "m1", code: "ABC123" }));
    api.getMyActiveConquestMatch.mockResolvedValue(MATCH);
    api.getConquestState.mockResolvedValue(state(1));
    const { result } = renderHook(() => useConquestMatch({ lang: "fr", displayName: "A" }));
    await act(async () => {
      await result.current.resume();
    });
    act(() => result.current.leave());
    await waitFor(() => expect(api.leaveConquestMatch).toHaveBeenCalledWith("m1"));
    expect(result.current.match).toBeNull();
    expect(hasStoredConquestMatch()).toBe(false);
  });
});
