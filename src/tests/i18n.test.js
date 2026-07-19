import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { translations, useTranslation } from "../config/i18n";

describe("i18n translation system", () => {
  it("should have matching translation keys for fr and en", () => {
    const frKeys = Object.keys(translations.fr);
    const enKeys = Object.keys(translations.en);

    expect(frKeys.length).toBe(enKeys.length);
    frKeys.forEach((key) => {
      expect(enKeys).toContain(key);
    });
  });

  describe("useTranslation", () => {
    it("should translate keys to French when language is set to 'fr'", () => {
      const { result } = renderHook(() => useTranslation("fr"));
      const t = result.current;

      expect(t("cancel")).toBe("Annuler");
      expect(t("confirm")).toBe("Confirmer");
      expect(t("mode_countries")).toBe("Pays");
    });

    it("should translate keys to English when language is set to 'en'", () => {
      const { result } = renderHook(() => useTranslation("en"));
      const t = result.current;

      expect(t("cancel")).toBe("Cancel");
      expect(t("confirm")).toBe("Confirm");
      expect(t("mode_countries")).toBe("Countries");
    });

    it("should replace parameterized placeholders correctly", () => {
      const { result } = renderHook(() => useTranslation("fr"));
      const t = result.current;

      // "department_prefix" is "Département {code}" in French
      expect(t("department_prefix", { code: "75" })).toBe("Département 75");

      const { result: resultEn } = renderHook(() => useTranslation("en"));
      const tEn = resultEn.current;

      // "department_prefix" is "Department {code}" in English
      expect(tEn("department_prefix", { code: "75" })).toBe("Department 75");
    });

    it("should fallback to English if key is missing in French", () => {
      // Temporarily inject a dummy translation to English
      translations.en.test_missing_fallback = "Fallback Success";
      const { result } = renderHook(() => useTranslation("fr"));
      const t = result.current;

      expect(t("test_missing_fallback")).toBe("Fallback Success");

      // Cleanup
      delete translations.en.test_missing_fallback;
    });

    it("should return the key itself if the key is missing globally", () => {
      const { result } = renderHook(() => useTranslation("fr"));
      const t = result.current;

      expect(t("totally_nonexistent_key_123")).toBe("totally_nonexistent_key_123");
    });
  });
});
