import { describe, expect, it } from "vitest";

import {
  applyOutcomes,
  buildSessionOutcomes,
  createCountryStatsService,
  emptyEntry,
  getWeakness,
  MIN_SEEN_FOR_DATA,
  nextTrainingTarget,
  pickTrainingPool,
  PRIOR_RATE,
  rankKeys,
  RECENT_WINDOW,
  summarizeMastery,
} from "../services/countryStats";
import {
  createLocalCountryStatsBackend,
  MAX_ENTRIES_PER_MODE,
  MAX_SERIALIZED_BYTES,
  parseStats,
  pruneStats,
  storageKeyFor,
} from "../services/countryStats/storage";

const NOW = 1_800_000_000_000;
const entryFrom = (history, t = NOW) => {
  let entry = emptyEntry();
  [...history].forEach((c) => {
    entry = applyOutcomes(entry, [c === "1"], t);
  });
  return entry;
};

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
};

describe("applyOutcomes", () => {
  it("compte trouvé/raté et borne l'historique récent", () => {
    const entry = applyOutcomes(emptyEntry(), [false, true, true], NOW);
    expect(entry).toMatchObject({ f: 2, m: 1, r: "011", t: NOW });
    const long = applyOutcomes(entry, Array(20).fill(false), NOW + 1);
    expect(long.r).toHaveLength(RECENT_WINDOW);
    expect(long.m).toBe(21);
  });

  it("ne mute pas l'entrée d'origine", () => {
    const original = Object.freeze(emptyEntry());
    expect(() => applyOutcomes(original, [true])).not.toThrow();
  });
});

describe("getWeakness", () => {
  it("un pays jamais vu vaut exactement l'a priori", () => {
    expect(getWeakness(undefined, NOW)).toBe(PRIOR_RATE);
    expect(getWeakness(emptyEntry(), NOW)).toBe(PRIOR_RATE);
  });

  it("ratés fréquents > jamais vu > maîtrisé", () => {
    const missed = getWeakness(entryFrom("000"), NOW);
    const mostlyMissed = getWeakness(entryFrom("1100"), NOW);
    const unseen = getWeakness(undefined, NOW);
    const known = getWeakness(entryFrom("111"), NOW);
    expect(missed).toBeGreaterThan(unseen);
    expect(mostlyMissed).toBeGreaterThan(unseen);
    expect(unseen).toBeGreaterThan(known);
  });

  it("pondère les parties récentes", () => {
    const improving = getWeakness(entryFrom("0001111"), NOW); // ancien raté, récent trouvé
    const regressing = getWeakness(entryFrom("1110000"), NOW);
    expect(regressing).toBeGreaterThan(improving);
  });

  it("un seul succès ne suffit pas à passer sous un pays très solide", () => {
    expect(getWeakness(entryFrom("1"), NOW)).toBeGreaterThan(getWeakness(entryFrom("11111"), NOW));
  });

  it("l'oubli ajoute un petit bonus plafonné", () => {
    const fresh = getWeakness(entryFrom("111", NOW), NOW);
    const old = getWeakness(entryFrom("111", NOW - 400 * 86_400_000), NOW);
    const older = getWeakness(entryFrom("111", NOW - 4000 * 86_400_000), NOW);
    expect(old).toBeGreaterThan(fresh);
    expect(old - fresh).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(older).toBeCloseTo(old, 10);
  });

  it("reste dans [0, 1] et gère une entrée sans historique récent", () => {
    const legacy = { f: 1, m: 9, r: "", t: NOW };
    const w = getWeakness(legacy, NOW);
    expect(w).toBeGreaterThan(0.5);
    expect(w).toBeLessThanOrEqual(1);
  });
});

describe("rankKeys / pickTrainingPool", () => {
  const stats = {
    chad: entryFrom("0000"),
    peru: entryFrom("1100"),
    france: entryFrom("1111"),
    spain: entryFrom("11"),
  };
  const keys = ["france", "spain", "unseen", "chad", "peru"];

  it("ordonne : ratés fréquents, ratés mixtes, jamais vus, puis maîtrisés", () => {
    expect(rankKeys(keys, stats, { now: NOW })).toEqual([
      "chad",
      "peru",
      "unseen",
      "spain",
      "france",
    ]);
  });

  it("est stable en cas d'égalité (ordre d'origine)", () => {
    expect(rankKeys(["b", "a", "c"], {}, { now: NOW })).toEqual(["b", "a", "c"]);
  });

  it("le tirage aléatoire reste borné : les ratés fréquents restent devant les maîtrisés", () => {
    for (let i = 0; i < 20; i += 1) {
      const ranked = rankKeys(keys, stats, { now: NOW, rng: Math.random });
      expect(ranked.indexOf("chad")).toBeLessThan(ranked.indexOf("france"));
      expect(ranked.indexOf("peru")).toBeLessThan(ranked.indexOf("france"));
    }
  });

  it("pickTrainingPool borne la taille et garde l'ordre faible → solide", () => {
    expect(pickTrainingPool(keys, stats, 2, { now: NOW })).toEqual(["chad", "peru"]);
    expect(pickTrainingPool(keys, stats, 99, { now: NOW })).toHaveLength(keys.length);
    expect(pickTrainingPool(keys, stats, 0, { now: NOW })).toHaveLength(1);
  });

  it("le tirage décide qui entre dans le pool, mais le plus faible reste toujours en tête", () => {
    for (let i = 0; i < 30; i += 1) {
      const pool = pickTrainingPool(keys, stats, 3, { now: NOW, rng: Math.random });
      expect(pool[0]).toBe("chad");
    }
  });

  it("sans aucune donnée, le pool est quand même rempli (démarrage possible)", () => {
    const pool = pickTrainingPool(keys, {}, 3, { now: NOW, rng: () => 0.5 });
    expect(pool).toHaveLength(3);
  });
});

describe("nextTrainingTarget", () => {
  it("renvoie le premier non trouvé dans l'ordre du pool", () => {
    expect(nextTrainingTarget(["a", "b", "c"], ["a"])).toBe("b");
    expect(nextTrainingTarget(["a", "b"], ["a", "b"])).toBeNull();
    expect(nextTrainingTarget(null, [])).toBeNull();
  });
});

describe("summarizeMastery", () => {
  it("signale l'état vide et compte les pays à revoir", () => {
    expect(summarizeMastery(["a", "b"], {}, NOW)).toEqual({
      total: 2,
      seen: 0,
      toReview: 0,
      hasEnoughData: false,
    });
    const keys = Array.from({ length: MIN_SEEN_FOR_DATA }, (_, i) => `k${i}`);
    const stats = Object.fromEntries(keys.map((k, i) => [k, entryFrom(i % 2 ? "000" : "111")]));
    const summary = summarizeMastery(keys, stats, NOW);
    expect(summary.hasEnoughData).toBe(true);
    expect(summary.toReview).toBe(MIN_SEEN_FOR_DATA / 2);
  });
});

describe("buildSessionOutcomes", () => {
  it("distingue trouvé, hésité, raté, et ignore les pays jamais ciblés", () => {
    const outcomes = buildSessionOutcomes({
      found: ["fr", "es"],
      seen: ["fr", "es", "de", "it"],
      wrong: ["es", "pt"],
    });
    expect(outcomes).toEqual({
      fr: [true],
      es: [false, true],
      de: [false],
      it: [false],
      pt: [false],
    });
    expect(outcomes.jp).toBeUndefined();
  });
});

describe("stockage local", () => {
  it("round-trip via le service, par profil et par mode", () => {
    const storage = memoryStorage();
    const service = createCountryStatsService(createLocalCountryStatsBackend(() => storage));
    service.recordSession("p1", "countries", { fr: [true], de: [false] }, NOW);
    service.recordSession("p1", "countries", { de: [false, true] }, NOW + 5);
    service.recordSession("p2", "capitals", { fr: [true] }, NOW);
    expect(service.getModeStats("p1", "countries").de).toMatchObject({ f: 1, m: 2, r: "001" });
    expect(service.getModeStats("p1", "capitals")).toEqual({});
    expect(service.getModeStats("p2", "capitals").fr.f).toBe(1);
    service.reset("p1");
    expect(service.getModeStats("p1", "countries")).toEqual({});
    expect(service.getModeStats("p2", "capitals").fr.f).toBe(1);
  });

  it("ignore les données corrompues ou d'une autre version", () => {
    expect(parseStats("{pas du json")).toEqual({ version: 1, modes: {} });
    expect(
      parseStats(JSON.stringify({ version: 99, modes: { countries: { fr: { f: 1 } } } })).modes
    ).toEqual({});
    const cleaned = parseStats(
      JSON.stringify({
        version: 1,
        modes: {
          countries: { fr: { f: 2, m: -3, r: "1x1", t: 5 }, bad: 12, zero: { f: 0, m: 0 } },
        },
      })
    );
    expect(cleaned.modes.countries).toEqual({ fr: { f: 2, m: 0, r: "11", t: 5 } });
  });

  it("garde de taille : plafond par mode, les plus anciennes entrées sautent", () => {
    const entries = {};
    for (let i = 0; i < MAX_ENTRIES_PER_MODE + 50; i += 1)
      entries[`k${i}`] = { f: 1, m: 0, r: "1", t: i };
    const pruned = pruneStats({ version: 1, modes: { countries: entries } });
    const kept = Object.keys(pruned.modes.countries);
    expect(kept).toHaveLength(MAX_ENTRIES_PER_MODE);
    expect(kept).not.toContain("k0");
    expect(kept).toContain(`k${MAX_ENTRIES_PER_MODE + 49}`);
  });

  it("garde de taille : plafond d'octets total", () => {
    const modes = {};
    for (let mi = 0; mi < 12; mi += 1) {
      modes[`mode${mi}`] = {};
      for (let i = 0; i < MAX_ENTRIES_PER_MODE; i += 1) {
        modes[`mode${mi}`][`une_cle_assez_longue_${i}`] = {
          f: 1,
          m: 1,
          r: "10101010",
          t: mi * 1000 + i,
        };
      }
    }
    const pruned = pruneStats({ version: 1, modes });
    expect(JSON.stringify(pruned).length).toBeLessThanOrEqual(MAX_SERIALIZED_BYTES);
  });

  it("n'échoue jamais si le stockage est plein ou absent", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    const service = createCountryStatsService(createLocalCountryStatsBackend(() => full));
    expect(service.recordSession("p", "countries", { fr: [true] })).toBe(false);
    const none = createCountryStatsService(createLocalCountryStatsBackend(() => undefined));
    expect(none.getModeStats("p", "countries")).toEqual({});
    expect(storageKeyFor("abc")).toContain("abc");
  });
});
