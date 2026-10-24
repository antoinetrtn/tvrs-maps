import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConquestRulesSheet from "../multiplayer/ConquestRulesSheet";
import { getConquestRulesText } from "../multiplayer/conquestRulesText";
import { useConquestRulesAutoOpen } from "../multiplayer/useConquestRulesAutoOpen";

describe("conquestRulesText", () => {
  it("provides complete French and English text with fallback", () => {
    const fr = getConquestRulesText("fr");
    const en = getConquestRulesText("en");
    const fallback = getConquestRulesText("de");

    expect(fr.title).toBe("Règles de Conquête");
    expect(en.title).toBe("Conquest Rules");
    expect(fallback.title).toBe(fr.title);

    expect(fr.sections).toHaveLength(8);
    expect(en.sections).toHaveLength(8);

    const frIds = fr.sections.map((s) => s.id);
    expect(frIds).toEqual([
      "match",
      "capture",
      "shield",
      "steal",
      "failedSteal",
      "bonus",
      "end",
      "elo",
    ]);
  });
});

describe("ConquestRulesSheet", () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {}
    vi.restoreAllMocks();
    if (typeof HTMLMediaElement !== "undefined") {
      vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    }
  });

  it("renders modal dialog in French with highlighted numbers and close button", () => {
    const onClose = vi.fn();
    render(<ConquestRulesSheet open={true} onClose={onClose} lang="fr" />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("conquest-rules-title");

    expect(screen.getByText("Règles de Conquête")).toBeTruthy();
    expect(screen.getByText("Protection")).toBeTruthy();

    const strongNumbers = screen.getAllByText("+10 pts");
    expect(strongNumbers.length).toBeGreaterThan(0);
    expect(strongNumbers[0].tagName.toLowerCase()).toBe("strong");

    const closeBtn = screen.getByRole("button", { name: "Fermer les règles" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders in English when lang is set to en", () => {
    render(<ConquestRulesSheet open={true} onClose={vi.fn()} lang="en" />);
    expect(screen.getByText("Conquest Rules")).toBeTruthy();
    expect(screen.getByText("Failed steal")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close rules" })).toBeTruthy();
  });

  it("closes when Esc key is pressed", () => {
    const onClose = vi.fn();
    render(<ConquestRulesSheet open={true} onClose={onClose} lang="fr" />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click and ignores clicks inside dialog", () => {
    const onClose = vi.fn();
    render(<ConquestRulesSheet open={true} onClose={onClose} lang="fr" />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = screen.getByTestId("conquest-rules-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps focus trap on Tab and Shift+Tab", () => {
    const onClose = vi.fn();
    render(<ConquestRulesSheet open={true} onClose={onClose} lang="fr" />);

    const dialog = screen.getByRole("dialog");
    const closeBtn = screen.getByRole("button", { name: "Fermer les règles" });
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("restores previous focus when closed", () => {
    const trigger = document.createElement("button");
    trigger.setAttribute("data-testid", "trigger-btn");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(<ConquestRulesSheet open={true} onClose={vi.fn()} lang="fr" />);
    rerender(<ConquestRulesSheet open={false} onClose={vi.fn()} lang="fr" />);

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

describe("useConquestRulesAutoOpen", () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {}
    vi.restoreAllMocks();
  });

  it("opens automatically the first time and stays closed once seen", () => {
    const { result } = renderHook(() => useConquestRulesAutoOpen());
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1](false);
    });
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem("tvrs-conquest-rules-seen")).toBe("1");

    const { result: secondMount } = renderHook(() => useConquestRulesAutoOpen());
    expect(secondMount.current[0]).toBe(false);
  });

  it("handles storage access exceptions safely", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: localStorage is disabled");
    });

    const { result } = renderHook(() => useConquestRulesAutoOpen());
    expect(result.current[0]).toBe(false);
    getItemSpy.mockRestore();
  });
});

describe("RulesIllustration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof HTMLMediaElement !== "undefined") {
      vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    }
  });

  it("renders one illustration above the rule cards, with a legend and an accessible label", () => {
    render(<ConquestRulesSheet open={true} onClose={vi.fn()} lang="fr" />);

    const illustrations = document.querySelectorAll(".rules-illu");
    expect(illustrations).toHaveLength(1);
    const illustration = illustrations[0];
    expect(illustration.getAttribute("role")).toBe("img");
    expect(illustration.getAttribute("aria-label")).toContain("Conquête");
    expect(illustration.querySelectorAll(".ri-legend-item")).toHaveLength(2);

    const grid = document.querySelector(".conquest-rules-grid");
    expect(
      illustration.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("exposes the complete static frame when reduced motion is requested", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      render(<ConquestRulesSheet open={true} onClose={vi.fn()} lang="en" />);
      const illustration = document.querySelector(".rules-illu");
      expect(illustration.classList.contains("is-static")).toBe(true);
      expect(illustration.classList.contains("is-playing")).toBe(false);
      expect(illustration.getAttribute("aria-label")).toContain("Conquest");
      expect(illustration.querySelector("video")).toBeNull();
      expect(illustration.querySelector("img")).toBeTruthy();
      expect(illustration.querySelector(".ri-cap.is-active")?.textContent).toBe(
        "Steal it: find the flag · +15"
      );
      expect(illustration.querySelectorAll(".ri-step.is-filled")).toHaveLength(4);
    } finally {
      window.matchMedia = original;
    }
  });

  it("lazily mounts video sources on intersection and syncs captions to currentTime", () => {
    const originalIO = window.IntersectionObserver;
    let observerCallback = null;
    window.IntersectionObserver = vi.fn().mockImplementation(function (cb) {
      observerCallback = cb;
      this.observe = vi.fn();
      this.disconnect = vi.fn();
    });

    try {
      render(<ConquestRulesSheet open={true} onClose={vi.fn()} lang="fr" />);
      const illustration = document.querySelector(".rules-illu");
      const video = illustration.querySelector("video");
      expect(video).toBeTruthy();
      expect(video.querySelectorAll("source")).toHaveLength(0);
      expect(illustration.classList.contains("is-playing")).toBe(false);

      act(() => {
        observerCallback?.([{ isIntersecting: true }]);
      });
      expect(video.querySelectorAll("source")).toHaveLength(2);
      expect(illustration.classList.contains("is-playing")).toBe(true);
      expect(illustration.querySelector(".ri-cap.is-active")?.textContent).toBe(
        "Nomme un pays libre · +10"
      );
      expect(illustration.querySelectorAll(".ri-step.is-filled")).toHaveLength(1);

      Object.defineProperty(video, "currentTime", { value: 7.0, writable: true });
      fireEvent.timeUpdate(video);
      expect(illustration.querySelector(".ri-cap.is-active")?.textContent).toBe(
        "Vole-le : trouve le drapeau · +15"
      );
      expect(illustration.querySelectorAll(".ri-step.is-filled")).toHaveLength(3);

      act(() => {
        observerCallback?.([{ isIntersecting: false }]);
      });
      expect(illustration.classList.contains("is-playing")).toBe(false);
    } finally {
      window.IntersectionObserver = originalIO;
    }
  });
});
