import { describe, expect, it } from "vitest";

import { getAuthRedirectUrl } from "../services/supabaseClient";

describe("getAuthRedirectUrl", () => {
  it("returns the current deployment origin + path without query or hash", () => {
    expect(
      getAuthRedirectUrl({ origin: "https://dev-maps.tvrs.fr", pathname: "/", search: "?x=1" })
    ).toBe("https://dev-maps.tvrs.fr/");
    expect(getAuthRedirectUrl({ origin: "http://localhost:5001", pathname: "/play" })).toBe(
      "http://localhost:5001/play"
    );
    expect(getAuthRedirectUrl({ origin: "https://tvrs-maps-abc-tvrs-maps.vercel.app" })).toBe(
      "https://tvrs-maps-abc-tvrs-maps.vercel.app/"
    );
  });
});
