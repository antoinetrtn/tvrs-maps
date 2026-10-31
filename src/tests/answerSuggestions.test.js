import { describe, expect, it } from "vitest";

import {
  buildSuggestionIndex,
  getAnswerSuggestions,
  getLearnSuggestions,
  MIN_SUGGEST_CHARS,
} from "../utils/answerSuggestions";

describe("answerSuggestions", () => {
  const mockCountryDataMap = {
    FRA: {
      name_fr: "France",
      name_en: "France",
      capital_fr: "Paris",
      capital: "Paris",
      aliases: ["Hexagone"],
      region: "Europe",
    },
    USA: {
      name_fr: "États-Unis",
      name_en: "United States",
      capital_fr: "Washington",
      capital: "Washington",
      aliases: ["USA", "US", "Amerique"],
      region: "North America",
    },
    GBR: {
      name_fr: "Royaume-Uni",
      name_en: "United Kingdom",
      capital_fr: "Londres",
      capital: "London",
      aliases: ["UK"],
      region: "Europe",
    },
    GEO: {
      name_fr: "Géorgie",
      name_en: "Georgia",
      capital_fr: "Tbilissi",
      capital: "Tbilisi",
      aliases: [],
      region: "Asia",
    },
    DEU: {
      name_fr: "Allemagne",
      name_en: "Germany",
      capital_fr: "Berlin",
      capital: "Berlin",
      aliases: [],
      region: "Europe",
    },
    MDG: {
      name_fr: "Madagascar",
      name_en: "Madagascar",
      capital_fr: "Antananarivo",
      capital: "Antananarivo",
      aliases: [],
      region: "Africa",
    },
    MAR: {
      name_fr: "Maroc",
      name_en: "Morocco",
      capital_fr: "Rabat",
      capital: "Rabat",
      aliases: [],
      region: "Africa",
    },
    MYS: {
      name_fr: "Malaisie",
      name_en: "Malaysia",
      capital_fr: "Kuala Lumpur",
      capital: "Kuala Lumpur",
      aliases: [],
      region: "Asia",
    },
    MLI: {
      name_fr: "Mali",
      name_en: "Mali",
      capital_fr: "Bamako",
      capital: "Bamako",
      aliases: [],
      region: "Africa",
    },
    MLT: {
      name_fr: "Malte",
      name_en: "Malta",
      capital_fr: "La Valette",
      capital: "Valletta",
      aliases: [],
      region: "Europe",
    },
  };

  it("exports MIN_SUGGEST_CHARS as 3", () => {
    expect(MIN_SUGGEST_CHARS).toBe(3);
  });

  it("handles accent and case normalization correctly ('ÉTATS unis', 'etats-unis')", () => {
    const index = buildSuggestionIndex(mockCountryDataMap, { lang: "fr", mode: "countries" });

    const res1 = getAnswerSuggestions("ÉTATS unis", index);
    expect(res1.length).toBeGreaterThan(0);
    expect(res1[0].display).toBe("États-Unis");

    const res2 = getAnswerSuggestions("etats-unis", index);
    expect(res2.length).toBeGreaterThan(0);
    expect(res2[0].display).toBe("États-Unis");
  });

  it("enforces 3 character minimum threshold for partial matching", () => {
    const index = buildSuggestionIndex(mockCountryDataMap, { lang: "fr", mode: "countries" });

    // Under 3 chars without exact match => no suggestions
    expect(getAnswerSuggestions("fr", index)).toEqual([]);
    expect(getAnswerSuggestions("ma", index)).toEqual([]);

    // 3 chars => suggestions displayed
    const res = getAnswerSuggestions("fra", index);
    expect(res.map((s) => s.display)).toContain("France");
  });

  it("allows exact match under threshold for short names or aliases ('UK', 'US')", () => {
    const index = buildSuggestionIndex(mockCountryDataMap, { lang: "fr", mode: "countries" });

    const ukRes = getAnswerSuggestions("UK", index);
    expect(ukRes.length).toBe(1);
    expect(ukRes[0].display).toBe("Royaume-Uni");

    const usRes = getAnswerSuggestions("US", index);
    expect(usRes.length).toBe(1);
    expect(usRes[0].display).toBe("États-Unis");
  });

  it("ranks exact match first, then name prefix, then word/alias prefix, then alphabetical", () => {
    const testMap = {
      C1: { name_fr: "South Georgia", aliases: [] },
      C2: { name_fr: "Georgia", aliases: [] },
      C3: { name_fr: "Geo", aliases: [] },
      C4: { name_fr: "Geodesy", aliases: [] },
      C5: { name_fr: "Republic of Whatever", aliases: ["Geo-Zone"] },
    };
    const index = buildSuggestionIndex(testMap, { lang: "fr", mode: "countries" });

    const res = getAnswerSuggestions("geo", index, { lang: "fr" });
    // Exact match "Geo" first
    expect(res[0].display).toBe("Geo");
    // Prefix matches next (alphabetical: Geodesy before Georgia)
    expect(res[1].display).toBe("Geodesy");
    expect(res[2].display).toBe("Georgia");
    // Word prefix ("South Georgia") and alias prefix ("Republic of Whatever") next
    const remainingDisplays = res.slice(3).map((s) => s.display);
    expect(remainingDisplays).toContain("South Georgia");
    expect(remainingDisplays).toContain("Republic of Whatever");
  });

  it("deduplicates suggestions by normalized display and marks found=false if at least one duplicate is unfound", () => {
    const duplicateMap = {
      KEY1: { name_fr: "Paris", aliases: [] },
      KEY2: { name_fr: "Paris", aliases: [] },
    };
    const index = buildSuggestionIndex(duplicateMap, { lang: "fr", mode: "countries" });

    // Case 1: KEY1 found, KEY2 unfound -> found should be false
    const res1 = getAnswerSuggestions("pari", index, { foundSet: new Set(["KEY1"]) });
    expect(res1.length).toBe(1);
    expect(res1[0].display).toBe("Paris");
    expect(res1[0].found).toBe(false);

    // Case 2: both found -> found should be true
    const res2 = getAnswerSuggestions("pari", index, { foundSet: new Set(["KEY1", "KEY2"]) });
    expect(res2.length).toBe(1);
    expect(res2[0].found).toBe(true);
  });

  it("limits results to 5 by default", () => {
    const index = buildSuggestionIndex(mockCountryDataMap, { lang: "fr", mode: "countries" });
    const res = getAnswerSuggestions("ma", index); // 'ma' is short, so no partial
    expect(res.length).toBe(0);

    const res2 = getAnswerSuggestions("mal", index); // Malaisie, Mali, Malte
    expect(res2.length).toBeLessThanOrEqual(5);

    const res3 = getAnswerSuggestions("m", index);
    expect(res3.length).toBe(0);

    // With a broad 3-char prefix
    const broadMap = {};
    for (let i = 0; i < 10; i++) {
      broadMap[`K${i}`] = { name_fr: `Testland ${i}`, aliases: [] };
    }
    const broadIndex = buildSuggestionIndex(broadMap, { lang: "fr", mode: "countries" });
    const broadRes = getAnswerSuggestions("tes", broadIndex);
    expect(broadRes.length).toBe(5);
  });

  it("marks already found items with found flag", () => {
    const index = buildSuggestionIndex(mockCountryDataMap, { lang: "fr", mode: "countries" });
    const res = getAnswerSuggestions("fra", index, { foundSet: new Set(["FRA"]) });
    expect(res.length).toBe(1);
    expect(res[0].display).toBe("France");
    expect(res[0].found).toBe(true);

    const resUnfound = getAnswerSuggestions("fra", index, { foundSet: new Set([]) });
    expect(resUnfound[0].found).toBe(false);
  });

  it("handles mode capitals vs countries vs us_states via targetCheck", () => {
    const dataMap = {
      FRA: {
        name_fr: "France",
        name_en: "France",
        capital_fr: "Paris",
        capital: "Paris",
      },
      CA: {
        name_fr: "Californie",
        name_en: "California",
        capital: "Sacramento",
      },
    };

    // Capitals mode: targets capital
    const capitalsIndex = buildSuggestionIndex(dataMap, { lang: "fr", mode: "capitals" });
    const capRes = getAnswerSuggestions("par", capitalsIndex);
    expect(capRes.length).toBe(1);
    expect(capRes[0].display).toBe("Paris");
    expect(capRes[0].subtext).toBeNull();

    // Countries mode: targets name
    const countriesIndex = buildSuggestionIndex(dataMap, { lang: "fr", mode: "countries" });
    const countryRes = getAnswerSuggestions("fra", countriesIndex);
    expect(countryRes.length).toBe(1);
    expect(countryRes[0].display).toBe("France");
    expect(countryRes[0].subtext).toBe("Paris");

    // us_states mode: targetCheck is "name", not "capital"
    const usStatesIndex = buildSuggestionIndex(dataMap, { lang: "fr", mode: "us_states" });
    const stateRes = getAnswerSuggestions("cal", usStatesIndex);
    expect(stateRes.length).toBe(1);
    expect(stateRes[0].display).toBe("Californie");
  });

  it("preserves historical learn mode behavior (threshold 4, matches name + capital, complex condition)", () => {
    // Under 4 chars => empty
    expect(getLearnSuggestions("fra", mockCountryDataMap, { lang: "fr" })).toEqual([]);

    // 4 chars matching capital "Pari" for France (name France is 6 chars, doesn't have space or hyphen, but input < 5)
    // Wait, target is "Paris", input length 4 < 5 and Paris has no space/hyphen -> not returned
    const learnShort = getLearnSuggestions("pari", mockCountryDataMap, { lang: "fr" });
    expect(learnShort).toEqual([]);

    // 5 chars -> returned!
    const learn5 = getLearnSuggestions("paris", mockCountryDataMap, { lang: "fr" });
    expect(learn5.length).toBeGreaterThan(0);
    expect(learn5[0].display).toBe("Paris");

    // 4 chars with compound target (e.g. "États-Unis" has hyphen)
    const learnCompound = getLearnSuggestions("etat", mockCountryDataMap, { lang: "fr" });
    expect(learnCompound.length).toBeGreaterThan(0);
    expect(learnCompound[0].display).toBe("États-Unis");
  });
});
