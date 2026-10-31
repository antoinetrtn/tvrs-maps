import { describe, expect, it } from "vitest";

import { conquestCursorStore } from "../multiplayer/conquestCursors";
import { createConquestPreview, resolvePreviewCountry } from "../multiplayer/conquestDevPreview";

describe("Conquête dev preview", () => {
  it("maps French and English names to canonical ids", () => {
    expect(resolvePreviewCountry("Belgique")).toBe("Belgium");
    expect(resolvePreviewCountry("maroc")).toBe("Morocco");
    expect(resolvePreviewCountry("Brésil")).toBe("Brazil");
    expect(resolvePreviewCountry("bresil")).toBe("Brazil");
    expect(resolvePreviewCountry("Brazil")).toBe("Brazil");
    expect(resolvePreviewCountry("Atlantide")).toBe(null);
  });

  it("claims Brazil (not French Guiana) and shows the opponent cursor", async () => {
    const ctrl = createConquestPreview({ phase: "live", loc: { search: "" } });
    const res = await ctrl.getSnapshot().claim("Brésil");
    expect(res).toEqual({ ok: true, country_id: "Brazil" });
    expect(ctrl.getSnapshot().claims.some((c) => c.country_id === "Brazil")).toBe(true);
    expect(conquestCursorStore.visible().map((c) => c.userId)).toContain("opp");
    await ctrl.getSnapshot().leave?.();
  });
});
