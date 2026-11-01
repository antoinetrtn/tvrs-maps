import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import HomeScreen from "../components/HomeScreen";

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
});
