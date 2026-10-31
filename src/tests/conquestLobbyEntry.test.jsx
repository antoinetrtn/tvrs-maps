import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ConquestLobby from "../multiplayer/ConquestLobby.jsx";

const conquest = { match: null, players: [], userId: "u1", online: [], busy: false, error: null };

describe("carte de création Conquête", () => {
  it("n'a plus d'onglet Classement ni de bouton Règles encadré, le lien Règles ouvre la feuille", () => {
    const onRules = vi.fn();
    render(<ConquestLobby lang="fr" conquest={conquest} onBack={() => {}} onRules={onRules} />);
    expect(screen.queryByRole("tab", { name: /Classement/ })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Règles" }));
    expect(onRules).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Créer/ })).toBeTruthy();
  });
});
