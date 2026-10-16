import { describe, expect, it } from "vitest";

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
});
