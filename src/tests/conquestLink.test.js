import { describe, expect, it, vi } from "vitest";

import { readConquestPreview } from "../multiplayer/conquestConfig";
import {
  createConquestPreview,
  getPreviewConquestLeaderboard,
} from "../multiplayer/conquestDevPreview";
import {
  buildConquestLink,
  clearConquestParam,
  readConquestCode,
} from "../multiplayer/conquestLink";

const loc = (href) => {
  const u = new URL(href);
  return { href: u.href, origin: u.origin, search: u.search };
};

describe("Conquête invite links", () => {
  it("builds a link on the current host", () => {
    expect(buildConquestLink("6V8EM4", loc("https://dev-maps.tvrs.fr/x?y=1"))).toBe(
      "https://dev-maps.tvrs.fr/?conquest=6V8EM4"
    );
    expect(buildConquestLink("6V8EM4", loc("https://maps.tvrs.fr/"))).toBe(
      "https://maps.tvrs.fr/?conquest=6V8EM4"
    );
  });

  it("reads and normalises the code, rejecting garbage", () => {
    expect(readConquestCode(loc("https://maps.tvrs.fr/?conquest=6v8em4"))).toBe("6V8EM4");
    expect(readConquestCode(loc("https://maps.tvrs.fr/?conquest=<script>"))).toBe("");
    expect(readConquestCode(loc("https://maps.tvrs.fr/"))).toBe("");
  });

  it("removes only the conquest param from the URL", () => {
    const hist = { state: null, replaceState: vi.fn() };
    clearConquestParam(loc("https://maps.tvrs.fr/?a=1&conquest=6V8EM4#top"), hist);
    expect(hist.replaceState).toHaveBeenCalledWith(null, "", "/?a=1#top");
    hist.replaceState.mockClear();
    clearConquestParam(loc("https://maps.tvrs.fr/?a=1"), hist);
    expect(hist.replaceState).not.toHaveBeenCalled();
  });
});

describe("Conquête dev preview mode", () => {
  it("reads ?conquestPreview in DEV and defaults empty value to lobby", () => {
    expect(readConquestPreview(loc("http://localhost:5001/"))).toBe("");
    expect(readConquestPreview(loc("http://localhost:5001/?conquestPreview=live"))).toBe("live");
    expect(readConquestPreview(loc("http://localhost:5001/?conquestPreview="))).toBe("lobby");
  });

  it("creates local preview states for lobby, live and finished without network calls", async () => {
    const changes = [];
    const preview = createConquestPreview({
      phase: "lobby",
      displayName: "antoine",
      loc: loc("http://localhost:5001/?conquestPreview=lobby"),
      onChange: (next) => changes.push(next),
    });

    const initial = preview.getSnapshot();
    expect(initial.match.status).toBe("lobby");
    expect(initial.players).toHaveLength(2);

    await initial.setReady(true);
    expect(changes.at(-1).players[0].ready).toBe(true);

    await initial.start();
    expect(changes.at(-1).match.status).toBe("live");
    expect(changes.at(-1).claims.length).toBeGreaterThan(0);

    const claimRes = await changes.at(-1).claim("Brazil");
    expect(claimRes).toEqual({ ok: true, country_id: "Brazil" });

    preview.setPhase("finished");
    expect(changes.at(-1).match.status).toBe("finished");
    expect(changes.at(-1).match.result.winner).toBe("me");

    const board = getPreviewConquestLeaderboard();
    expect(board.top.length).toBeGreaterThan(0);
    expect(board.me.user_id).toBe("me");
  });
});
