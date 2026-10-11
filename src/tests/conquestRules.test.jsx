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
  });

  it("renders modal dialog in French with highlighted numbers and close button", () => {
    const onClose = vi.fn();
    render(<ConquestRulesSheet open={true} onClose={onClose} lang="fr" />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("conquest-rules-title");

    expect(screen.getByText("Règles de Conquête")).toBeTruthy();
    expect(screen.getByText("Bouclier")).toBeTruthy();

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
