import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHudAnswerHandler } from "../hooks/useHudAnswerHandler";

describe("useHudAnswerHandler", () => {
  let handleSearch;
  let specificCountryGuess;
  let handleInput;
  let setPopupError;
  let setPopupWarning;

  beforeEach(() => {
    handleSearch = vi.fn();
    specificCountryGuess = vi.fn().mockReturnValue("SUCCESS");
    handleInput = vi.fn().mockReturnValue(true);
    setPopupError = vi.fn();
    setPopupWarning = vi.fn();
  });

  const setupHook = (props = {}) => {
    const defaultProps = {
      mode: "countries",
      selectedCountry: null,
      handleSearch,
      specificCountryGuess,
      handleInput,
      setPopupError,
      setPopupWarning,
      ...props,
    };
    return renderHook(() => useHudAnswerHandler(defaultProps));
  };

  it("mode countries, selectedCountry null => handleInput/specificCountryGuess/setPopupError NON appelés, retourne false", () => {
    const { result } = setupHook({ mode: "countries", selectedCountry: null });

    const returned = result.current("France");

    expect(returned).toBe(false);
    expect(handleInput).not.toHaveBeenCalled();
    expect(specificCountryGuess).not.toHaveBeenCalled();
    expect(setPopupError).not.toHaveBeenCalled();
    expect(setPopupWarning).not.toHaveBeenCalled();
  });

  it("mode countries, selectedCountry 'FRA' => specificCountryGuess appelé, handleInput non appelé", () => {
    const { result } = setupHook({ mode: "countries", selectedCountry: "FRA" });

    const returned = result.current("France");

    expect(returned).toBe(true);
    expect(specificCountryGuess).toHaveBeenCalledTimes(1);
    expect(specificCountryGuess).toHaveBeenCalledWith("France");
    expect(handleInput).not.toHaveBeenCalled();
  });

  it("mode learn => handleSearch appelé", () => {
    handleSearch.mockReturnValue("Paris");
    const { result } = setupHook({ mode: "learn", selectedCountry: null });

    const returned = result.current("Paris");

    expect(returned).toBe("Paris");
    expect(handleSearch).toHaveBeenCalledTimes(1);
    expect(handleSearch).toHaveBeenCalledWith("Paris");
    expect(setPopupError).not.toHaveBeenCalled();
  });

  it("mode learn avec recherche infructueuse => setPopupError appelé", () => {
    handleSearch.mockReturnValue(null);
    const { result } = setupHook({ mode: "learn", selectedCountry: null });

    const returned = result.current("Inconnu");

    expect(returned).toBeNull();
    expect(handleSearch).toHaveBeenCalledWith("Inconnu");
    expect(setPopupError).toHaveBeenCalledWith(true);
  });

  it("WIN100 en DEV sans sélection => handleInput appelé", () => {
    const { result } = setupHook({ mode: "countries", selectedCountry: null });

    const returned = result.current("WIN100");

    expect(returned).toBe(true);
    expect(handleInput).toHaveBeenCalledTimes(1);
    expect(handleInput).toHaveBeenCalledWith("WIN100");
    expect(specificCountryGuess).not.toHaveBeenCalled();
  });

  it("LOSE100 en DEV sans sélection => handleInput appelé", () => {
    const { result } = setupHook({ mode: "countries", selectedCountry: null });

    const returned = result.current("LOSE100");

    expect(returned).toBe(true);
    expect(handleInput).toHaveBeenCalledTimes(1);
    expect(handleInput).toHaveBeenCalledWith("LOSE100");
    expect(specificCountryGuess).not.toHaveBeenCalled();
  });

  it("réponse mise en file pendant le flash de réussite => true (le champ se vide)", () => {
    specificCountryGuess.mockReturnValue("QUEUED");
    const { result } = setupHook({ mode: "countries", selectedCountry: "FRA" });
    expect(result.current("Belgique")).toBe(true);
  });
});
