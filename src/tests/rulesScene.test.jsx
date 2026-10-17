import { render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PixelText } from "../multiplayer/rulesPixelFont";
import RulesScene from "../multiplayer/RulesScene";

const SCENE_IDS = ["match", "capture", "shield", "steal", "failedSteal", "bonus", "end", "elo"];

function mockReducedMotion(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("RulesScene", () => {
  afterEach(() => {
    delete window.matchMedia;
  });

  it.each(SCENE_IDS)("renders a decorative square-pixel svg for %s", (id) => {
    const { container } = render(<RulesScene id={id} />);
    const stage = container.querySelector(".rules-scene");
    expect(stage?.getAttribute("data-scene")).toBe(id);
    const svg = stage.querySelector("svg");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(svg.querySelectorAll("circle, ellipse")).toHaveLength(0);
  });

  it("renders nothing for an unknown scene id", () => {
    const { container } = render(<RulesScene id="nope" />);
    expect(container.firstChild).toBeNull();
  });

  it("plays by default and stays static under prefers-reduced-motion", () => {
    mockReducedMotion(false);
    const { container, unmount } = render(<RulesScene id="capture" />);
    expect(container.querySelector(".rules-scene.is-static")).toBeNull();
    unmount();

    mockReducedMotion(true);
    const reduced = render(<RulesScene id="capture" />);
    expect(reduced.container.querySelector(".rules-scene.is-static")).not.toBeNull();
  });
});

describe("PixelText", () => {
  it("draws every glyph from integer square rects", () => {
    const { container } = render(
      <svg>
        <PixelText text="+10 s" x={2} y={3} />
      </svg>
    );
    const rects = [...container.querySelectorAll("rect")];
    expect(rects.length).toBeGreaterThan(10);
    for (const rect of rects) {
      expect(rect.getAttribute("width")).toBe("1");
      expect(rect.getAttribute("height")).toBe("1");
    }
  });
});
