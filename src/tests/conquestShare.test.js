import { describe, expect, it, vi } from "vitest";

import { copyRoomCode, shareRoomCode } from "../multiplayer/ConquestLobby.jsx";

describe("Conquest room code sharing", () => {
  it("uses the native share sheet when available", async () => {
    const nav = { share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn() } };
    expect(await shareRoomCode("6V8EM4", nav)).toBe("shared");
    expect(nav.share).toHaveBeenCalledWith(expect.objectContaining({ text: "6V8EM4" }));
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("returns null when the user cancels the share sheet", async () => {
    const nav = { share: vi.fn().mockRejectedValue(new Error("AbortError")) };
    expect(await shareRoomCode("ABC123", nav)).toBeNull();
  });

  it("falls back to the clipboard without navigator.share", async () => {
    const nav = { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
    expect(await shareRoomCode("ABC123", nav)).toBe("copied");
    expect(nav.clipboard.writeText).toHaveBeenCalledWith("ABC123");
  });

  it("reports failure when neither share nor clipboard work", async () => {
    expect(await shareRoomCode("ABC123", {})).toBeNull();
    const nav = { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } };
    expect(await copyRoomCode("ABC123", nav)).toBe(false);
  });
});
