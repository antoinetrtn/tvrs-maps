import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import HomeScreen from "../components/HomeScreen";
import * as deployEnvModule from "../config/deployEnv";

describe("HomeScreen DEV badge", () => {
  const defaultProps = {
    onStartGame: vi.fn(),
    lang: "fr",
    setLang: vi.fn(),
    topExplorers: [],
    userProfile: { id: "test-user", xp: 100 },
  };

  it("renders DEV badge with accessible label when isDevMarkEnabled is true", () => {
    vi.spyOn(deployEnvModule, "isDevMarkEnabled").mockReturnValue(true);

    render(<HomeScreen {...defaultProps} />);

    const badge = screen.getByText("DEV");
    expect(badge).toBeTruthy();
    expect(badge.getAttribute("aria-label")).toBe("Environnement de développement");
    expect(badge.getAttribute("title")).toBe("Environnement de développement");
  });

  it("does not render DEV badge when isDevMarkEnabled is false (production deploy)", () => {
    vi.spyOn(deployEnvModule, "isDevMarkEnabled").mockReturnValue(false);

    render(<HomeScreen {...defaultProps} />);

    expect(screen.queryByText("DEV")).toBeNull();
  });
});
