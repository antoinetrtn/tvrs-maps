import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ConquestLobby, { ReadyButton } from "../multiplayer/ConquestLobby.jsx";
import { conquestText } from "../multiplayer/conquestText";

const t = conquestText("fr");

const makeConquest = (overrides = {}) => ({
  match: { id: "m1", code: "ABC123", host_id: "me" },
  players: [
    { user_id: "me", display_name: "Antoine", color: "teal", ready: false },
    { user_id: "op", display_name: "Marie", color: "orange", ready: true },
  ],
  userId: "me",
  online: [],
  busy: false,
  error: null,
  setReady: vi.fn(),
  start: vi.fn(),
  ...overrides,
});

describe("ReadyButton", () => {
  it("shows the big call to action and is not pressed while not ready", () => {
    render(<ReadyButton t={t} ready={false} busy={false} onToggle={() => {}} />);
    const button = screen.getByRole("button", { name: "Je suis prêt" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the ready / cancel state once pressed", () => {
    render(<ReadyButton t={t} ready busy={false} onToggle={() => {}} />);
    const button = screen.getByRole("button", { pressed: true });
    expect(button.textContent).toContain("Prêt");
    expect(button.textContent).toContain("Annuler");
  });

  it("is disabled while busy", () => {
    const onToggle = vi.fn();
    render(<ReadyButton t={t} ready={false} busy onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("ConquestLobby ready flow", () => {
  it("calls conquest.setReady(true) from the footer button, with no switch left", () => {
    const conquest = makeConquest();
    render(<ConquestLobby lang="fr" conquest={conquest} onBack={() => {}} />);
    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Je suis prêt" }));
    expect(conquest.setReady).toHaveBeenCalledWith(true);
  });

  it("cancels readiness with setReady(false)", () => {
    const conquest = makeConquest({
      players: [
        { user_id: "me", display_name: "Antoine", color: "teal", ready: true },
        { user_id: "op", display_name: "Marie", color: "orange", ready: false },
      ],
    });
    render(<ConquestLobby lang="fr" conquest={conquest} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { pressed: true }));
    expect(conquest.setReady).toHaveBeenCalledWith(false);
  });

  it("keeps a per-player ready indicator", () => {
    render(<ConquestLobby lang="fr" conquest={makeConquest()} onBack={() => {}} />);
    expect(document.querySelectorAll(".conquest-ready-label")).toHaveLength(2);
    expect(document.querySelectorAll('.conquest-ready-label[data-ready="true"]')).toHaveLength(1);
  });

  it("host can only start once everyone is ready", () => {
    const notReady = makeConquest();
    const { unmount } = render(<ConquestLobby lang="fr" conquest={notReady} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: t.startMatch }).disabled).toBe(true);
    unmount();

    const allReady = makeConquest({
      players: [
        { user_id: "me", display_name: "Antoine", color: "teal", ready: true },
        { user_id: "op", display_name: "Marie", color: "orange", ready: true },
      ],
    });
    render(<ConquestLobby lang="fr" conquest={allReady} onBack={() => {}} />);
    const start = screen.getByRole("button", { name: t.startMatch });
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    expect(allReady.start).toHaveBeenCalled();
  });

  it("guests see the waiting-for-host hint", () => {
    const conquest = makeConquest({ userId: "op" });
    render(<ConquestLobby lang="fr" conquest={conquest} onBack={() => {}} />);
    expect(screen.getByText(t.waitingHost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.startMatch })).toBeNull();
  });
});
