import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomeScreenCategoryCarousel from "../components/HomeScreenCategoryCarousel";
import { THEME } from "../config/designSystem";
import { createGlobeLabelElement } from "../globe/render/globeLabelBuilder";

describe("Milestone M3: Coherence & Single Source of Truth Audit", () => {
  describe("Rule 5: Natural Casing in Section Labels & Category Descriptions", () => {
    it("renders category content with natural lower/mixed casing in French", () => {
      render(
        <HomeScreenCategoryCarousel
          onStartGame={vi.fn()}
          lang="fr"
          homeMode="countries"
          setHomeMode={vi.fn()}
        />
      );

      // Verify descriptions and titles use natural casing and never force ALL-CAPS words
      expect(screen.getByText(/pays et territoires à localiser/i).textContent).toMatch(/pays/);
      expect(screen.getByText(/pays et territoires à localiser/i).textContent).not.toMatch(/PAYS/);

      expect(screen.getByText(/départements et collectivités/i).textContent).toMatch(
        /départements/
      );
      expect(screen.getByText(/départements et collectivités/i).textContent).not.toMatch(
        /DÉPARTEMENTS/
      );

      expect(screen.getByText(/reliefs majeurs/i).textContent).toMatch(/reliefs/);
      expect(screen.getByText(/reliefs majeurs/i).textContent).not.toMatch(/RELIEFS/);
    });

    it("renders category content with natural lower/mixed casing in English", () => {
      render(
        <HomeScreenCategoryCarousel
          onStartGame={vi.fn()}
          lang="en"
          homeMode="countries"
          setHomeMode={vi.fn()}
        />
      );

      expect(screen.getByText(/countries and territories to locate/i).textContent).toMatch(
        /countries/
      );
      expect(screen.getByText(/countries and territories to locate/i).textContent).not.toMatch(
        /COUNTRIES/
      );

      expect(screen.getByText(/French departments across mainland/i).textContent).toMatch(
        /departments/
      );
      expect(screen.getByText(/French departments across mainland/i).textContent).not.toMatch(
        /DEPARTMENTS/
      );

      expect(screen.getByText(/major reliefs/i).textContent).toMatch(/reliefs/);
      expect(screen.getByText(/major reliefs/i).textContent).not.toMatch(/RELIEFS/);
    });
  });

  describe("Rule 8: Border-Radius Token Alignment", () => {
    it("creates globe label flag elements with var(--radius-sm)", () => {
      const mockD = {
        admin: "FRA",
        iso2: "FR",
        isFound: false,
        isSelected: true,
        isGlitching: true,
        name: "France",
        mode: "countries",
      };
      const mockOpts = {
        REGION_COLORS_LABELS: { Europe: "var(--accent)" },
        UI_COLORS: {
          success: "var(--accent)",
          accent: "var(--accent)",
          textMuted: "var(--text-muted)",
          textMain: "var(--text-main)",
          black: "var(--paper)",
          selectionHighlight: "var(--accent)",
        },
        isHomeScreen: false,
        isEndScreen: false,
        _isLight: false,
        gameDataMap: {
          FRA: { name_fr: "France", name_en: "France", iso_a2: "FR", region: "Europe" },
        },
        _globeTheme: "satellite",
        mode: "countries",
        t: (k) => k,
      };

      const element = createGlobeLabelElement(mockD, mockOpts);
      const flagImg = element.querySelector(".globe-label-flag");
      expect(flagImg).not.toBeNull();
      expect(flagImg.getAttribute("style")).toContain("border-radius:var(--radius-sm)");
      expect(flagImg.getAttribute("style")).not.toContain("border-radius:3px");
    });
  });

  describe("THEME export & design system integrity", () => {
    it("exports canonical THEME with dark mapBase", () => {
      expect(THEME).toBeDefined();
      expect(THEME.dark).toBeDefined();
      expect(typeof THEME.dark.mapBase).toBe("string");
    });
  });
});
