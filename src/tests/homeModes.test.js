import { describe, expect, it } from "vitest";

import { getGameModesMetadata, getHomeHeroText } from "../components/homeHeroText";
import { getHomeGeoMode, getHomeLearnSubMode, HOME_CONQUEST_KEY } from "../components/homeModes";

describe("homeModes", () => {
  it("la carte Conquête utilise le globe monde (pays)", () => {
    expect(getHomeGeoMode(HOME_CONQUEST_KEY)).toBe("countries");
    expect(getHomeLearnSubMode(HOME_CONQUEST_KEY)).toBe("countries");
  });

  it("les autres cartes gardent leur mode de données", () => {
    expect(getHomeGeoMode("us_states")).toBe("us_states");
    expect(getHomeGeoMode("capitals")).toBe("capitals");
    expect(getHomeLearnSubMode("capitals")).toBe("countries");
    expect(getHomeLearnSubMode("departments")).toBe("departments");
  });

  it("getGameModesMetadata fournit des badges courts et des labels accessibles", () => {
    const list = getGameModesMetadata({
      countriesCount: 236,
      capitalsCount: 234,
      departmentsCount: 101,
      usStatesCount: 50,
      riversMountainsCount: 100,
      includeConquest: true,
    });

    expect(list[0].key).toBe(HOME_CONQUEST_KEY);
    expect(list[0].badgeFr).toBe("1V1");
    expect(list[0].badgeEn).toBe("1V1");
    expect(list[0].countLabelFr).toBe("1V1 en ligne");
    expect(list[0].countLabelEn).toBe("Online 1v1");

    const countries = list.find((m) => m.key === "countries");
    expect(countries.badgeFr).toBe("236");
    expect(countries.badgeEn).toBe("236");
    expect(countries.countLabelFr).toContain("236 pays");
    expect(countries.countLabelEn).toContain("236 countries");

    const capitals = list.find((m) => m.key === "capitals");
    expect(capitals.badgeFr).toBe("234");
    expect(capitals.countLabelFr).toContain("234 capitales");
  });

  it("getHomeHeroText retourne les textes FR et EN", () => {
    const fr = getHomeHeroText("fr");
    expect(fr.title).toContain("Le monde");
    expect(fr.sub).toContain("236 pays");

    const en = getHomeHeroText("en");
    expect(en.title).toContain("The world");
    expect(en.sub).toContain("236 countries");
  });
});
