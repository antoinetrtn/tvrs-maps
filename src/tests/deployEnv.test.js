import { describe, expect, it } from "vitest";

import { getDeployEnv, getGitRef, isDevMarkEnabled, isProductionDeploy } from "../config/deployEnv";

describe("deployEnv", () => {
  describe("isProductionDeploy", () => {
    it("returns true only for 'production'", () => {
      expect(isProductionDeploy("production")).toBe(true);
    });

    it("returns false for non-production environments", () => {
      expect(isProductionDeploy("preview")).toBe(false);
      expect(isProductionDeploy("development")).toBe(false);
      expect(isProductionDeploy("dev")).toBe(false);
      expect(isProductionDeploy("unknown")).toBe(false);
      expect(isProductionDeploy("")).toBe(false);
      expect(isProductionDeploy(null)).toBe(false);
      expect(isProductionDeploy(undefined)).toBe(false);
    });
  });

  describe("isDevMarkEnabled", () => {
    it("returns false when environment is production", () => {
      expect(isDevMarkEnabled("production")).toBe(false);
    });

    it("returns true for non-production environments", () => {
      expect(isDevMarkEnabled("preview")).toBe(true);
      expect(isDevMarkEnabled("development")).toBe(true);
      expect(isDevMarkEnabled("dev")).toBe(true);
      expect(isDevMarkEnabled("unknown")).toBe(true);
      expect(isDevMarkEnabled("")).toBe(true);
      expect(isDevMarkEnabled(null)).toBe(true);
      expect(isDevMarkEnabled(undefined)).toBe(true);
    });
  });

  describe("getDeployEnv and getGitRef", () => {
    it("returns a string environment name without throwing", () => {
      const env = getDeployEnv();
      expect(typeof env).toBe("string");
      expect(env.length).toBeGreaterThan(0);
    });

    it("returns git ref as a string", () => {
      const gitRef = getGitRef();
      expect(typeof gitRef).toBe("string");
    });
  });
});
