import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import HomeScreen from "../components/HomeScreen";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("HomeScreen Action Dock", () => {
  const defaultProps = {
    onStartGame: vi.fn(),
    lang: "fr",
    setLang: vi.fn(),
    topExplorers: [],
    userProfile: { id: "test-user", xp: 100 },
  };

  it("renders podium widget as a real button with role button and aria-label", () => {
    render(<HomeScreen {...defaultProps} />);

    const podiumButton = screen.getByRole("button", { name: "Classement" });
    expect(podiumButton).toBeTruthy();
    expect(podiumButton.tagName).toBe("BUTTON");
    expect(podiumButton.getAttribute("type")).toBe("button");
    expect(podiumButton.getAttribute("aria-label")).toBe("Classement");
    expect(podiumButton.getAttribute("data-tooltip")).toBe("Classement");
    expect(podiumButton.getAttribute("title")).toBeNull();
  });

  it("renders profile and settings buttons with proper roles, aria-labels and tooltips", () => {
    render(<HomeScreen {...defaultProps} />);

    const profileButton = screen.getByRole("button", { name: "Profil" });
    expect(profileButton).toBeTruthy();
    expect(profileButton.tagName).toBe("BUTTON");
    expect(profileButton.getAttribute("aria-label")).toBe("Profil");
    expect(profileButton.getAttribute("data-tooltip")).toBe("Profil");
    expect(profileButton.getAttribute("title")).toBeNull();

    const settingsButton = screen.getByRole("button", { name: "Réglages" });
    expect(settingsButton).toBeTruthy();
    expect(settingsButton.tagName).toBe("BUTTON");
    expect(settingsButton.getAttribute("aria-label")).toBe("Réglages");
    expect(settingsButton.getAttribute("data-tooltip")).toBe("Réglages");
    expect(settingsButton.getAttribute("title")).toBeNull();
  });

  it("renders visible dock labels in the DOM for desktop display", () => {
    const { container } = render(<HomeScreen {...defaultProps} />);

    const labels = [...container.querySelectorAll(".home-dock-label")].map((el) => el.textContent);
    expect(labels).toEqual(["Classement", "Profil", "Réglages"]);
  });

  it("centers settings (and profile) icons in a square 18px flex cell with block SVG", () => {
    render(<HomeScreen {...defaultProps} />);

    const settingsBtn = screen.getByRole("button", { name: "Réglages" });
    const settingsIcon = settingsBtn.querySelector(".settings-icon");
    expect(settingsIcon).toBeTruthy();
    const settingsSvg = settingsIcon.querySelector("svg");
    expect(settingsSvg).toBeTruthy();
    expect(settingsSvg.getAttribute("width")).toBe("18");
    expect(settingsSvg.getAttribute("height")).toBe("18");
    expect(settingsSvg.getAttribute("aria-hidden")).toBe("true");

    const profileBtn = screen.getByRole("button", { name: "Profil" });
    const profileIcon = profileBtn.querySelector(".profile-icon");
    expect(profileIcon).toBeTruthy();
    const profileSvg = profileIcon.querySelector("svg");
    expect(profileSvg).toBeTruthy();
    expect(profileSvg.getAttribute("width")).toBe("18");
    expect(profileSvg.getAttribute("height")).toBe("18");
  });

  it("keeps settings-icon CSS parity with profile-icon (flex center + block SVG)", () => {
    // File-level contract: mobile must share the same centering rules as desktop
    // (previously .settings-icon was only sized under min-width:769px).
    const raw = fs.readFileSync(path.resolve(__dirname, "../components/HomeScreen.css"), "utf8");
    expect(raw).toMatch(/\.profile-icon,\s*\.settings-icon\s*\{/);
    expect(raw).toMatch(/\.profile-icon svg,\s*\.settings-icon svg\s*\{/);
    const shared = raw.match(/\.profile-icon,\s*\.settings-icon\s*\{([\s\S]*?)\}/);
    expect(shared).toBeTruthy();
    expect(shared[1]).toMatch(/display:\s*inline-flex/);
    expect(shared[1]).toMatch(/align-items:\s*center/);
    expect(shared[1]).toMatch(/justify-content:\s*center/);
    expect(shared[1]).toMatch(/width:\s*18px/);
    expect(shared[1]).toMatch(/height:\s*18px/);
    const svgRule = raw.match(/\.profile-icon svg,\s*\.settings-icon svg\s*\{([\s\S]*?)\}/);
    expect(svgRule).toBeTruthy();
    expect(svgRule[1]).toMatch(/display:\s*block/);
  });
});
