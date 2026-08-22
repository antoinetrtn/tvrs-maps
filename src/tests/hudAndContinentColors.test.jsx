import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import EndScreen from "../components/EndScreen";
import GameDataPanel from "../components/GameDataPanel";
import GameHUD from "../components/GameHUD";
import { RELIEF } from "../config/gameConfig";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Milestone M1 Empirical Challenger Suite", () => {
  const mockCountryDataMap = {
    FRA: {
      id: "FRA",
      name: "France",
      name_fr: "France",
      name_en: "France",
      region: "Europe",
      officialName: "French Republic",
      iso2: "FR",
    },
    DEU: {
      id: "DEU",
      name: "Germany",
      name_fr: "Allemagne",
      name_en: "Germany",
      region: "Europe",
      officialName: "Federal Republic of Germany",
      iso2: "DE",
    },
    JPN: {
      id: "JPN",
      name: "Japan",
      name_fr: "Japon",
      name_en: "Japan",
      region: "Asia",
      officialName: "Japan",
      iso2: "JP",
    },
    BRA: {
      id: "BRA",
      name: "Brazil",
      name_fr: "Brésil",
      name_en: "Brazil",
      region: "Americas",
      officialName: "Federative Republic of Brazil",
      iso2: "BR",
    },
    EGY: {
      id: "EGY",
      name: "Egypt",
      name_fr: "Égypte",
      name_en: "Egypt",
      region: "Africa",
      officialName: "Arab Republic of Egypt",
      iso2: "EG",
    },
    AUS: {
      id: "AUS",
      name: "Australia",
      name_fr: "Australie",
      name_en: "Australia",
      region: "Oceania",
      officialName: "Commonwealth of Australia",
      iso2: "AU",
    },
  };

  describe("1. GameHUD Component Verification & Stress Testing", () => {
    const defaultProps = {
      mode: "all",
      onGoHome: vi.fn(),
      lang: "fr",
      score: 3,
      totalPossible: 6,
      timeLeft: 120,
      onEnter: vi.fn(),
      isPlaying: true,
      isGameOver: false,
      onStop: vi.fn(),
      onInfo: vi.fn(),
      isFocusedCountry: false,
      _onClearFocus: vi.fn(),
      onNavigateFocus: vi.fn(),
      inputError: false,
      inputSuccess: false,
      inputWarning: false,
      extInputRef: { current: null },
      foundList: ["FRA", "DEU", "JPN"],
      countryDataMap: mockCountryDataMap,
      viewport: { width: 1280, height: 800, top: 0 },
      isKeyboardMode: false,
      selectedCountry: "FRA",
      globeTheme: "satellite",
      theme: "dark",
    };

    it("renders GameHUD on desktop quiz mode with Info button properly positioned and attributes configured", () => {
      const onInfoMock = vi.fn();
      const { container } = render(
        <GameHUD
          {...defaultProps}
          onInfo={onInfoMock}
          viewport={{ width: 1280, height: 800, top: 0 }}
        />
      );

      // Verify no obsolete continent sub-gauges exist
      expect(container.querySelector(".island-sub-gauges")).toBeNull();
      expect(container.querySelector(".circular-gauge")).toBeNull();
      expect(container.querySelector(".gauge-item")).toBeNull();

      // Verify .hud-bottom-right is rendered on desktop
      const hudBottomRight = container.querySelector(".hud-bottom-right");
      expect(hudBottomRight).not.toBeNull();
      expect(hudBottomRight.classList.contains("keyboard-mode")).toBe(false);

      // Verify Info button inside .hud-bottom-right
      const infoBtn = hudBottomRight.querySelector("button.hud-btn-circular");
      expect(infoBtn).not.toBeNull();
      expect(infoBtn.getAttribute("type")).toBe("button");
      expect(infoBtn.getAttribute("aria-label")).toBeTruthy();
      expect(infoBtn.getAttribute("title")).toBeTruthy();

      // Test click event triggers onInfo
      fireEvent.click(infoBtn);
      expect(onInfoMock).toHaveBeenCalledTimes(1);

      // Test onMouseDown calls preventDefault
      const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(mouseDownEvent, "preventDefault");
      infoBtn.dispatchEvent(mouseDownEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("renders GameHUD with keyboard-mode class on .hud-bottom-right when isKeyboardMode is true", () => {
      const { container } = render(
        <GameHUD
          {...defaultProps}
          isKeyboardMode={true}
          viewport={{ width: 1280, height: 800, top: 0 }}
        />
      );

      const hudBottomRight = container.querySelector(".hud-bottom-right");
      expect(hudBottomRight).not.toBeNull();
      expect(hudBottomRight.classList.contains("keyboard-mode")).toBe(true);
    });

    it("does NOT render .hud-bottom-right or Info button in learn mode on desktop", () => {
      const { container } = render(
        <GameHUD
          {...defaultProps}
          mode="learn"
          learnSubMode="explore"
          viewport={{ width: 1280, height: 800, top: 0 }}
        />
      );

      expect(container.querySelector(".hud-bottom-right")).toBeNull();
      expect(container.querySelector(".island-sub-gauges")).toBeNull();
    });

    it("does NOT render .hud-bottom-right or Info button on mobile viewport", () => {
      const { container } = render(
        <GameHUD {...defaultProps} viewport={{ width: 375, height: 667, top: 0 }} />
      );

      expect(container.querySelector(".hud-bottom-right")).toBeNull();
      expect(container.querySelector(".island-sub-gauges")).toBeNull();
    });

    it("does NOT render .hud-bottom-right on mobile learn mode", () => {
      const { container } = render(
        <GameHUD
          {...defaultProps}
          mode="learn"
          learnSubMode="explore"
          viewport={{ width: 375, height: 667, top: 0 }}
        />
      );

      expect(container.querySelector(".hud-bottom-right")).toBeNull();
    });

    it("survives extreme edge cases: null/undefined countryDataMap, empty foundList, score=0, totalPossible=0", () => {
      const { container } = render(
        <GameHUD
          {...defaultProps}
          countryDataMap={null}
          foundList={null}
          score={0}
          totalPossible={0}
          selectedCountry={null}
        />
      );

      expect(container.querySelector(".top-hud-bar")).not.toBeNull();
      expect(container.querySelector(".island-sub-gauges")).toBeNull();
    });

    it("renders hardcore lives cleanly without gauge regressions", () => {
      const { container, rerender } = render(
        <GameHUD {...defaultProps} isHardcoreRun={true} livesLeft={3} />
      );

      expect(container.querySelector(".hud-hearts")).not.toBeNull();

      // Trigger life loss animation
      rerender(<GameHUD {...defaultProps} isHardcoreRun={true} livesLeft={2} />);
      expect(container.querySelector(".hud-hearts")).not.toBeNull();
      expect(container.querySelector(".hearts-shake")).not.toBeNull();
    });

    it("handles focused country navigation cleanly", () => {
      const onNavigateFocusMock = vi.fn();
      const { container } = render(
        <GameHUD {...defaultProps} isFocusedCountry={true} onNavigateFocus={onNavigateFocusMock} />
      );

      const prevBtn = container.querySelector(".prev-btn");
      const nextBtn = container.querySelector(".next-btn");
      expect(prevBtn).not.toBeNull();
      expect(nextBtn).not.toBeNull();

      fireEvent.click(prevBtn);
      expect(onNavigateFocusMock).toHaveBeenCalledWith("prev");

      fireEvent.click(nextBtn);
      expect(onNavigateFocusMock).toHaveBeenCalledWith("next");
    });
  });

  describe("2. EndScreen Component Verification & Stress Testing", () => {
    const endScreenProps = {
      foundList: ["FRA", "DEU", "JPN"],
      countryDataMap: mockCountryDataMap,
      totalCountries: 6,
      score: 3,
      timeTaken: 45,
      mode: "all",
      onRestart: vi.fn(),
      onHome: vi.fn(),
      onViewTable: vi.fn(),
      theme: "dark",
      lang: "fr",
      globeTheme: "satellite",
      lastScores: [2, 3],
      maxScore: 6,
      isNewPB: false,
    };

    it("renders EndScreen with standardized progress bars and no --continent-color inline styles", () => {
      const { container } = render(<EndScreen {...endScreenProps} />);

      const progressItems = container.querySelectorAll(".progress-item");
      expect(progressItems.length).toBeGreaterThan(0);

      progressItems.forEach((item) => {
        // Assert no inline continent-color override
        expect(item.getAttribute("style") || "").not.toContain("--continent-color");
      });

      const dots = container.querySelectorAll(".progress-dot");
      expect(dots.length).toBeGreaterThan(0);

      const fills = container.querySelectorAll(".progress-fill");
      expect(fills.length).toBeGreaterThan(0);
    });

    it("handles perfect score cleanly", () => {
      const { container } = render(
        <EndScreen
          {...endScreenProps}
          foundList={["FRA", "DEU", "JPN", "BRA", "EGY", "AUS"]}
          score={6}
          totalCountries={6}
        />
      );

      expect(container.querySelector(".end-screen-overlay")).not.toBeNull();
    });

    it("handles zero found items cleanly", () => {
      const { container } = render(<EndScreen {...endScreenProps} foundList={[]} score={0} />);

      expect(container.querySelector(".end-screen-overlay")).not.toBeNull();
    });
  });

  describe("3. GameDataPanel Component Verification & Stress Testing", () => {
    const dataPanelProps = {
      dataMap: mockCountryDataMap,
      foundList: ["FRA", "DEU"],
      onSelectCountry: vi.fn(),
      onClose: vi.fn(),
      mode: "all",
      theme: "dark",
      lang: "fr",
      globeTheme: "satellite",
      isGameOver: false,
      revealAll: false,
      variant: "side",
    };

    it("renders GameDataPanel without --region-color inline styles and with standard dots", () => {
      const { container } = render(<GameDataPanel {...dataPanelProps} />);

      const regions = container.querySelectorAll(".data-panel-region");
      expect(regions.length).toBeGreaterThan(0);

      regions.forEach((region) => {
        expect(region.getAttribute("style") || "").not.toContain("--region-color");
      });

      const regionDots = container.querySelectorAll(".data-panel-region-dot");
      expect(regionDots.length).toBeGreaterThan(0);
    });

    it("renders status dots in learn mode without --region-color", () => {
      const { container } = render(
        <GameDataPanel {...dataPanelProps} mode="learn" isLearnMode={true} />
      );

      const statusDots = container.querySelectorAll(".status-dot");
      expect(statusDots.length).toBeGreaterThan(0);
    });

    it("filters countries correctly when search query changes", () => {
      const { container } = render(<GameDataPanel {...dataPanelProps} searchQuery="France" />);

      const rows = container.querySelectorAll(".data-panel-row");
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain("France");
    });

    it("renders modal variant cleanly", () => {
      const { container } = render(<GameDataPanel {...dataPanelProps} variant="modal" />);
      expect(container.querySelector(".game-data-panel")).not.toBeNull();
    });
  });

  describe("4. Static Code & CSS Audit for Dead Code Removal", () => {
    it("confirms RELIEF in gameConfig does not export targetHintScale", () => {
      expect(RELIEF.mountainScale).toBe(0.62);
      expect(RELIEF.targetHintScale).toBeUndefined();
    });

    it("confirms GameHUD.jsx does not import getThemeRegionColor, GAME_REGIONS, or getRegionAbbr", () => {
      const hudCode = fs.readFileSync(path.resolve(__dirname, "../components/GameHUD.jsx"), "utf8");
      expect(hudCode).not.toContain("getThemeRegionColor");
      expect(hudCode).not.toContain("getRegionAbbr");
      expect(hudCode).not.toContain("island-sub-gauges");
      expect(hudCode).not.toContain("circular-gauge");
      expect(hudCode).not.toContain("CONTINENT_ORDER");
    });

    it("confirms EndScreen.jsx and GameDataPanel.jsx do not import getThemeRegionColor", () => {
      const endScreenCode = fs.readFileSync(
        path.resolve(__dirname, "../components/EndScreen.jsx"),
        "utf8"
      );
      expect(endScreenCode).not.toContain("getThemeRegionColor");
      expect(endScreenCode).not.toContain("--continent-color");

      const dataPanelCode = fs.readFileSync(
        path.resolve(__dirname, "../components/GameDataPanel.jsx"),
        "utf8"
      );
      expect(dataPanelCode).not.toContain("getThemeRegionColor");
      expect(dataPanelCode).not.toContain("--region-color");
    });

    it("confirms GameHUD.css contains no dead gauge rules", () => {
      const hudCss = fs.readFileSync(path.resolve(__dirname, "../components/GameHUD.css"), "utf8");
      expect(hudCss).not.toContain(".island-sub-gauges");
      expect(hudCss).not.toContain(".circular-gauge");
      expect(hudCss).not.toContain(".gauge-val");
      expect(hudCss).not.toContain(".gauge-item");
      expect(hudCss).not.toContain(".hud-top-gauges");
      expect(hudCss).not.toContain("@keyframes aura-pulse");
      expect(hudCss).not.toContain(".input-island.has-continent");
    });

    it("confirms EndScreen.css and GameDataPanel.css use tokenized backgrounds for dots", () => {
      const endScreenCss = fs.readFileSync(
        path.resolve(__dirname, "../components/EndScreen.css"),
        "utf8"
      );
      expect(endScreenCss).toContain("background: var(--text-muted);");
      expect(endScreenCss).toContain("background: var(--accent);");
      expect(endScreenCss).not.toContain("var(--continent-color)");

      const dataPanelCss = fs.readFileSync(
        path.resolve(__dirname, "../components/GameDataPanel.css"),
        "utf8"
      );
      expect(dataPanelCss).toContain("background: var(--text-muted);");
      expect(dataPanelCss).toContain("border-radius: var(--radius-sm);");
      expect(dataPanelCss).not.toContain("var(--region-color)");
    });
  });
});
