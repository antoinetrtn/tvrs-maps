import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCountryStatsRecorder } from "../hooks/useCountryStatsRecorder";
import { useGameSession } from "../hooks/useGameSession";
import { countryStatsService } from "../services/countryStats";
import { buildTrainingPool, getTrainableKeys, getTrainingLabel } from "../utils/trainingPool";

const DATA = {
  France: { name_fr: "France", name_en: "France", lat: 46, lng: 2, region: "Europe" },
  Germany: { name_fr: "Allemagne", name_en: "Germany", lat: 51, lng: 10, region: "Europe" },
  Spain: { name_fr: "Espagne", name_en: "Spain", lat: 40, lng: -4, region: "Europe" },
  Italy: { name_fr: "Italie", name_en: "Italy", lat: 42, lng: 12, region: "Europe" },
};

function sessionProps(overrides = {}) {
  return {
    mode: "countries",
    allCountryKeys: Object.keys(DATA),
    totalPossible: 4,
    gameDuration: 300,
    lang: "fr",
    userProfile: { id: "p", xp: 0, level: 1, unlockedBadges: [] },
    setUserProfile: vi.fn(),
    localRecords: {},
    session: null,
    updateGameRecord: vi.fn(),
    addAchievementToQueue: vi.fn(),
    t: (key) => key,
    globeTheme: "monochrome",
    theme: "dark",
    selectedCountry: null,
    setSelectedCountry: vi.fn(),
    activeDataMap: DATA,
    extInputRef: { current: null },
    effectiveKeyboardMode: false,
    globeFeedbackApplierRef: { current: null },
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

describe("pool d'entraînement", () => {
  it("liste les clés jouables de chaque mode (capitales : seulement celles qui en ont une)", () => {
    expect(getTrainableKeys("countries").length).toBeGreaterThan(150);
    expect(getTrainableKeys("capitals").length).toBeLessThanOrEqual(
      getTrainableKeys("countries").length
    );
    expect(getTrainableKeys("us_states").length).toBe(50);
    expect(getTrainableKeys("learn")).toEqual([]);
  });

  it("le pool commence par le pays le moins maîtrisé et respecte la taille", () => {
    countryStatsService.recordSession("p", "countries", { Chad: [false], France: [true] });
    countryStatsService.recordSession("p", "countries", { Chad: [false], France: [true] });
    const stats = countryStatsService.getModeStats("p", "countries");
    const pool = buildTrainingPool("countries", stats, 10, { rng: () => 0.5 });
    expect(pool).toHaveLength(10);
    expect(pool[0]).toBe("Chad");
    expect(pool).not.toContain("France");
  });

  it("donne un libellé lisible (capitale en récapitulatif)", () => {
    expect(getTrainingLabel("countries", "France", "fr")).toBe("France");
    expect(getTrainingLabel("capitals", "France", "fr", true)).toBe("France · Paris");
    expect(getTrainingLabel("countries", "inconnu", "fr")).toBe("inconnu");
  });
});

describe("useGameSession en entraînement ciblé", () => {
  const pool = ["Spain", "Italy", "France"];

  it("enchaîne les cibles dans l'ordre du pool, pas par proximité", () => {
    const setSelectedCountry = vi.fn();
    const { result } = renderHook(() =>
      useGameSession(
        sessionProps({
          trainingPool: pool,
          allCountryKeys: pool,
          totalPossible: 3,
          setSelectedCountry,
          selectedCountry: "Spain",
        })
      )
    );
    act(() => result.current.navigateFocus("next"));
    // Italy (2e du pool), même si l'Allemagne/France sont plus proches de l'Espagne.
    expect(setSelectedCountry).toHaveBeenLastCalledWith("Italy");
  });

  it("n'accepte en saisie libre que les éléments du pool", () => {
    const { result } = renderHook(() =>
      useGameSession(sessionProps({ trainingPool: pool, allCountryKeys: pool, totalPossible: 3 }))
    );
    let res;
    act(() => {
      res = result.current.handleInput("Allemagne");
    });
    expect(res).toBe("ERROR");
    act(() => {
      res = result.current.handleInput("Espagne");
    });
    expect(res).toBe("SUCCESS");
  });

  it("n'écrit ni record ni XP à la fin d'une partie d'entraînement", async () => {
    const props = sessionProps({ trainingPool: pool, allCountryKeys: pool, totalPossible: 3 });
    const { result } = renderHook(() => useGameSession(props));
    await act(async () => result.current.stopGame());
    expect(props.updateGameRecord).not.toHaveBeenCalled();
  });

  it("écrit toujours les records hors entraînement", async () => {
    const props = sessionProps();
    const { result } = renderHook(() => useGameSession(props));
    await act(async () => result.current.stopGame());
    expect(props.updateGameRecord).toHaveBeenCalledTimes(1);
  });
});

describe("useCountryStatsRecorder", () => {
  const base = {
    mode: "countries",
    profileId: "p1",
    currentScreen: "game",
    selectedCountry: "France",
    foundList: [],
    isPlaying: true,
    isGameOver: false,
    popupError: false,
  };
  const stats = () => countryStatsService.getModeStats("p1", "countries");

  it("enregistre trouvé / raté / hésité à la fin de la partie, une seule fois", () => {
    const { rerender } = renderHook((props) => useCountryStatsRecorder(props), {
      initialProps: base,
    });
    rerender({ ...base, selectedCountry: "Spain", foundList: ["France"] });
    rerender({ ...base, selectedCountry: "Spain", foundList: ["France"], popupError: true });
    rerender({ ...base, selectedCountry: "Italy", foundList: ["France", "Spain"] });
    expect(stats()).toEqual({});
    rerender({
      ...base,
      selectedCountry: "Italy",
      foundList: ["France", "Spain"],
      isGameOver: true,
    });
    rerender({
      ...base,
      selectedCountry: "Italy",
      foundList: ["France", "Spain"],
      isGameOver: true,
    });
    expect(stats().France).toMatchObject({ f: 1, m: 0, r: "1" });
    expect(stats().Spain).toMatchObject({ f: 1, m: 1, r: "01" });
    expect(stats().Italy).toMatchObject({ f: 0, m: 1, r: "0" });
    expect(stats().Germany).toBeUndefined();
  });

  it("ne compte rien si la partie n'a jamais démarré, ni en Apprendre", () => {
    const idle = renderHook((p) => useCountryStatsRecorder(p), {
      initialProps: { ...base, isPlaying: false },
    });
    idle.rerender({ ...base, isPlaying: false, isGameOver: true });
    expect(stats()).toEqual({});
    const learn = renderHook((p) => useCountryStatsRecorder(p), {
      initialProps: { ...base, mode: "learn" },
    });
    learn.rerender({ ...base, mode: "learn", isGameOver: true });
    expect(stats()).toEqual({});
  });

  it("repart de zéro à chaque nouvelle partie", () => {
    const { rerender } = renderHook((p) => useCountryStatsRecorder(p), { initialProps: base });
    rerender({ ...base, foundList: ["France"], isGameOver: true });
    rerender({ ...base, currentScreen: "home", selectedCountry: null, isPlaying: false });
    rerender({ ...base, selectedCountry: "Spain", foundList: [] });
    rerender({ ...base, selectedCountry: "Spain", foundList: ["Spain"], isGameOver: true });
    expect(stats().France.f).toBe(1);
    expect(stats().Spain).toMatchObject({ f: 1, m: 0 });
    expect(stats().France.m).toBe(0);
  });

  it("ignore un profil absent", () => {
    const { rerender } = renderHook((p) => useCountryStatsRecorder(p), {
      initialProps: { ...base, profileId: undefined },
    });
    rerender({ ...base, profileId: undefined, foundList: ["France"], isGameOver: true });
    expect(localStorage.length).toBe(0);
  });
});
