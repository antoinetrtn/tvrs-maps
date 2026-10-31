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
      selectedCountry: null,
      ...customProps,
    };
    return render(<GameHUD {...props} />);
  };

  it.each([
    ["countries", "France"],
    ["capitals", "Paris"],
    ["us_states", "California"],
    ["departments", "Ain"],
    ["rivers_mountains", "Alpes"],
  ])(
    "mode %s sans sélection: saisie '%s' + Entrée => rejet, placeholder et aria-live",
    (mode, text) => {
      const { container } = renderHUD({ mode, selectedCountry: null });
      const input = screen.getByRole("combobox");
      const island = container.querySelector(".input-island");

      expect(input.getAttribute("placeholder")).toBe("Sélectionne sur le globe");

      fireEvent.change(input, { target: { value: text } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onEnterMock).not.toHaveBeenCalled();
      expect(island.classList.contains("is-rejected")).toBe(true);
      expect(input.value).toBe(text);

      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion.textContent).toContain("Sélectionne un pays sur le globe");
    }
  );

  it("champ vide + Entrée sans sélection => ne fait rien", () => {
    const { container } = renderHUD({ selectedCountry: null });
    const input = screen.getByRole("combobox");
    const island = container.querySelector(".input-island");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEnterMock).not.toHaveBeenCalled();
    expect(island.classList.contains("is-rejected")).toBe(false);
  });

  const typeAndEnter = (props, text) => {
    const view = renderHUD(props);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: text } });
    return { ...view, input, island: view.container.querySelector(".input-island") };
  };

  it.each(["France", "france", "FRANCE"])(
    "nom exact '%s' + Entrée avec sélection => valide directement",
    (text) => {
      const { input } = typeAndEnter({ selectedCountry: "FRA" }, text);
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onEnterMock).toHaveBeenCalledWith("France");
      expect(input.value).toBe("");
    }
  );

  it("nom exact + Entrée sans sélection sur le globe => rien n'est validé", () => {
    const { input } = typeAndEnter({ selectedCountry: null }, "France");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterMock).not.toHaveBeenCalled();
  });

  it("saisie partielle + Entrée sans choix => aucune validation, texte conservé, rejet + indice", () => {
    const { container, input, island } = typeAndEnter({ selectedCountry: "FRA" }, "Fran");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEnterMock).not.toHaveBeenCalled();
    expect(input.value).toBe("Fran");
    expect(island.classList.contains("is-rejected")).toBe(true);
    expect(container.querySelector('[aria-live="polite"]').textContent).toContain(
      "Choisis un pays dans la liste"
    );
  });

  it("sans pays sélectionné, la liste de suggestions s'affiche quand même", () => {
    const { container, input } = typeAndEnter({ selectedCountry: null }, "fran");

    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('[role="option"]').textContent).toContain("France");
  });

  it.each([
    ["sans pays sélectionné", null, true, 0, true, "Sélectionne un pays sur le globe"],
    ["bonne réponse", "FRA", true, 1, false, ""],
    ["mauvais pays (ERROR)", "FRA", "ERROR", 1, false, ""],
    ["onEnter renvoie false", "FRA", false, 1, false, ""],
  ])(
    "clic sur une suggestion (%s) => champ vidé, validation=%s appels, rejet=%s",
    (_label, selectedCountry, returned, calls, rejected, hint) => {
      onEnterMock.mockReturnValue(returned);
      const { container, input, island } = typeAndEnter({ selectedCountry }, "fran");

      fireEvent.click(container.querySelector('[role="option"]'));

      expect(onEnterMock).toHaveBeenCalledTimes(calls);
      if (calls) expect(onEnterMock).toHaveBeenCalledWith("France");
      expect(island.classList.contains("is-rejected")).toBe(rejected);
      expect(input.value).toBe("");
      expect(container.querySelector('[aria-live="polite"]').textContent).toContain(hint);
    }
  );

  it("(f) clavier: saisie 'fran', ArrowDown, Enter => onEnter appelé avec la suggestion surlignée et réinitialisation; wrap", () => {
    const { container } = renderHUD({ selectedCountry: "FRA" });
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fran" } });
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);

    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    // ArrowUp wraps to last
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    // ArrowDown wraps to first
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);

    // Enter validates chosen option
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterMock).toHaveBeenCalledWith("France");
    expect(input.value).toBe("");
  });

  it("(c) aucune pré-surbrillance: saisie 'fra' laisse aria-activedescendant absent", () => {
    const { container } = renderHUD({ selectedCountry: "FRA" });
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fra" } });
    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    options.forEach((opt) => expect(opt.getAttribute("aria-selected")).toBe("false"));
  });

  it("(c) accents/casse: 'ETATS' / 'états' retrouvent 'États-Unis'", () => {
    const { container } = renderHUD({ selectedCountry: "USA" });
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

  it("(c) Échap ferme la liste de suggestions", () => {
    const { container } = renderHUD({ selectedCountry: "FRA" });
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fran" } });
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("(c) Tab non intercepté (keydown Tab defaultPrevented === false)", () => {
    renderHUD({ selectedCountry: "FRA" });
    const input = screen.getByRole("combobox");

    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("(c) entrée déjà trouvée marquée data-found", () => {
    const { container } = renderHUD({ selectedCountry: "FRA", foundList: ["FRA"] });
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fra" } });
    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();
    expect(option.getAttribute("data-found")).toBe("true");
    expect(option.textContent).toContain("✓");
    expect(option.textContent).toContain("trouvé");
  });

  it("(c) clavier direct sur option: Enter ou Espace sur l'élément option déclenche onSelect", () => {
    const { container } = renderHUD({ selectedCountry: "FRA" });
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fran" } });
    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();

    fireEvent.keyDown(option, { key: " " });
    expect(onEnterMock).toHaveBeenCalledWith("France");
    expect(input.value).toBe("");

    onEnterMock.mockClear();
    fireEvent.change(input, { target: { value: "fran" } });
    const newOption = container.querySelector('[role="option"]');
    expect(newOption).not.toBeNull();
    fireEvent.keyDown(newOption, { key: "Enter" });
    expect(onEnterMock).toHaveBeenCalledWith("France");
  });

  it("(c) ARIA: role=combobox, aria-expanded, aria-controls pointe le listbox, aria-selected", () => {
    const { container } = renderHUD({ selectedCountry: "FRA" });
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

  it("Entrée répétée sans choix rejoue le shake (classe retirée puis remise)", async () => {
    const { input, island } = typeAndEnter({ selectedCountry: "FRA" }, "Fran");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(island.classList.contains("is-rejected")).toBe(true);

    // Repeated Enter while already rejected resets isRejected and reapplies
    fireEvent.keyDown(input, { key: "Enter" });
    expect(island.classList.contains("is-rejected")).toBe(false);

    await vi.waitFor(() => {
      expect(island.classList.contains("is-rejected")).toBe(true);
    });
  });

  it("(d) en DEV 'WIN100' + Entrée sans sélection => onEnter('WIN100') appelé", () => {
    renderHUD({ selectedCountry: null });
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "WIN100" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEnterMock).toHaveBeenCalledTimes(1);
    expect(onEnterMock).toHaveBeenCalledWith("WIN100");
    expect(input.value).toBe("");
  });

  it("(e) mode learn: Entrée valide la première suggestion sans selectedCountry", () => {
    let learnVal = "";
    const onLearnSearchChangeMock = vi.fn().mockImplementation((val) => {
      learnVal = val;
    });

    const { rerender } = renderHUD({
      mode: "learn",
      selectedCountry: null,
      learnSearchQuery: learnVal,
      onLearnSearchChange: onLearnSearchChangeMock,
    });

    const input = screen.getByRole("combobox");
    expect(input.getAttribute("placeholder")).toBe("Rechercher...");

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

        selectedCountry={null}
        learnSearchQuery={learnVal}
        onLearnSearchChange={onLearnSearchChangeMock}
      />
    );

    // In learn mode, pressing Enter directly validates suggestions[0]
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterMock).toHaveBeenCalledWith("Paris");
  });
});
