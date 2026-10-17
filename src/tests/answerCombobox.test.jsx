import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GameHUD from "../components/GameHUD";

describe("answerCombobox (<GameHUD> integration)", () => {
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
      aliases: ["USA", "US"],
      region: "North America",
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
  };

  let onEnterMock;

  beforeEach(() => {
    onEnterMock = vi.fn().mockReturnValue(true);
  });

  const renderHUD = (customProps = {}) => {
    const props = {
      mode: "countries",
      lang: "fr",
      score: 0,
      totalPossible: 10,
      timeLeft: 300,
      isPlaying: true,
      isGameOver: false,
      onEnter: onEnterMock,
      onGoHome: vi.fn(),
      onStop: vi.fn(),
      onInfo: vi.fn(),
      onNavigateFocus: vi.fn(),
      viewport: { width: 1200, height: 800, top: 0 },
      foundList: [],
      countryDataMap: mockCountryDataMap,
      theme: "dark",
      globeTheme: "blackout",
      ...customProps,
    };
    return render(<GameHUD {...props} />);
  };

  it("(1) saisie exacte 'France' + Entrée sans sélection => onEnter NON appelé, is-rejected présent, liste ouverte", () => {
    const { container } = renderHUD();
    const input = screen.getByRole("combobox");
    const island = container.querySelector(".input-island");

    fireEvent.change(input, { target: { value: "France" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEnterMock).not.toHaveBeenCalled();
    expect(island.classList.contains("is-rejected")).toBe(true);
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it("(2) clic sur une suggestion => onEnter('France') appelé une fois, champ vidé", () => {
    const { container } = renderHUD();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fran" } });
    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();

    fireEvent.click(option);
    expect(onEnterMock).toHaveBeenCalledTimes(1);
    expect(onEnterMock).toHaveBeenCalledWith("France");
    expect(input.value).toBe("");
  });

  it("(3) clavier: saisie 'fran', ArrowDown, Enter => onEnter appelé avec la suggestion surlignée; ArrowDown/ArrowUp wrap", () => {
    const { container } = renderHUD();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fran" } });
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);

    // Initial state: activeIndex = -1
    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    // ArrowUp from -1 wraps to last option
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    // ArrowDown wraps from last (0) to 0
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);

    // Enter validates highlighted option
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterMock).toHaveBeenCalledWith("France");
    expect(input.value).toBe("");
  });

  it("(4) saisie partielle 'fra' + Entrée => rejet, aucune pré-surbrillance (aria-activedescendant absent)", () => {
    const { container } = renderHUD();
    const input = screen.getByRole("combobox");
    const island = container.querySelector(".input-island");

    fireEvent.change(input, { target: { value: "fra" } });

    // No pre-highlight
    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterMock).not.toHaveBeenCalled();
    expect(island.classList.contains("is-rejected")).toBe(true);
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("(5) accents/casse: 'ETATS' / 'états' retrouvent 'États-Unis'", () => {
    const { container } = renderHUD();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "ETATS" } });
    let options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toContain("États-Unis");

    fireEvent.change(input, { target: { value: "états" } });
    options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toContain("États-Unis");
  });

  it("(6) Échap ferme, Entrée suivante rouvre", () => {
    const { container } = renderHUD();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fran" } });
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();

    // Escape closes the listbox
    fireEvent.keyDown(input, { key: "Escape" });
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    // Pressing Enter with non-empty input rejects and reopens the list
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it("(7) Tab non intercepté (keydown Tab defaultPrevented === false)", () => {
    renderHUD();
    const input = screen.getByRole("combobox");

    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("(8) mode learn: Entrée valide la première suggestion (comportement historique)", () => {
    let learnVal = "";
    const onLearnSearchChangeMock = vi.fn().mockImplementation((val) => {
      learnVal = val;
    });

    const { rerender } = renderHUD({
      mode: "learn",
      learnSearchQuery: learnVal,
      onLearnSearchChange: onLearnSearchChangeMock,
    });

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "paris" } });

    rerender(
      <GameHUD
        mode="learn"
        lang="fr"
        score={0}
        totalPossible={10}
        timeLeft={300}
        isPlaying={true}
        isGameOver={false}
        onEnter={onEnterMock}
        onGoHome={vi.fn()}
        onStop={vi.fn()}
        onInfo={vi.fn()}
        onNavigateFocus={vi.fn()}
        viewport={{ width: 1200, height: 800, top: 0 }}
        foundList={[]}
        countryDataMap={mockCountryDataMap}
        theme="dark"
        globeTheme="blackout"
        learnSearchQuery={learnVal}
        onLearnSearchChange={onLearnSearchChangeMock}
      />
    );

    // In learn mode, pressing Enter directly validates suggestions[0]
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterMock).toHaveBeenCalledWith("Paris");
  });

  it("(9) ARIA: role=combobox, aria-expanded, aria-controls pointe le listbox, options role=option, aria-selected suit la surbrillance", () => {
    const { container } = renderHUD();
    const input = screen.getByRole("combobox");

    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    const controlsId = input.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();

    fireEvent.change(input, { target: { value: "fran" } });
    expect(input.getAttribute("aria-expanded")).toBe("true");

    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(listbox.id).toBe(controlsId);

    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();
    expect(option.getAttribute("aria-selected")).toBe("false");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(option.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(option.id);
  });

  it("(10) onEnter retournant false => champ non vidé", () => {
    onEnterMock.mockReturnValue(false);
    renderHUD();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fran" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEnterMock).toHaveBeenCalledWith("France");
    expect(input.value).toBe("fran");
  });

  it("(11) entrée déjà trouvée marquée data-found", () => {
    const { container } = renderHUD({ foundList: ["FRA"] });
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fra" } });
    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();
    expect(option.getAttribute("data-found")).toBe("true");
    expect(option.textContent).toContain("✓");
    expect(option.textContent).toContain("trouvé");
  });
});
