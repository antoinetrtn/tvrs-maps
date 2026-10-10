import { describe, expect, it, vi } from "vitest";

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
