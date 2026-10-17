import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";

describe("LoadingState", () => {
  it("renders with role=status, aria-live=polite, title, hint, and stepped runner track", () => {
    const { container } = render(
      <LoadingState title="Chargement…" hint="Récupération des données" />
    );

    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeTruthy();
    expect(statusEl.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("Chargement…")).toBeTruthy();
    expect(screen.getByText("Récupération des données")).toBeTruthy();

    const track = container.querySelector(".ui-state-track");
    expect(track).toBeTruthy();
    const cells = container.querySelectorAll(".ui-state-cell");
    expect(cells.length).toBe(5);
    const runner = container.querySelector(".ui-state-runner");
    expect(runner).toBeTruthy();
  });

  it("supports srOnly: visually hides title and hint, sets tooltip on container", () => {
    render(<LoadingState title="Chargement discret" hint="Indice vocal" srOnly />);

    const statusEl = screen.getByRole("status");
    expect(statusEl.getAttribute("title")).toBe("Chargement discret");

    const titleEl = screen.getByText("Chargement discret");
    expect(titleEl.className).toContain("sr-only");
    const hintEl = screen.getByText("Indice vocal");
    expect(hintEl.className).toContain("sr-only");
  });
});

describe("EmptyState", () => {
  it("renders with role=status, dashed frame glyph by default, title and hint", () => {
    const { container } = render(
      <EmptyState title="Aucun résultat" hint="Essaie un autre filtre" />
    );

    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeTruthy();
    expect(screen.getByText("Aucun résultat")).toBeTruthy();
    expect(screen.getByText("Essaie un autre filtre")).toBeTruthy();

    const dashedGlyph = container.querySelector(".ui-state-glyph--dashed");
    expect(dashedGlyph).toBeTruthy();
  });

  it("renders custom icon when provided", () => {
    render(
      <EmptyState icon={<span data-testid="custom-empty-icon">★</span>} title="Favoris vides" />
    );

    expect(screen.getByTestId("custom-empty-icon")).toBeTruthy();
    expect(screen.getByText("Favoris vides")).toBeTruthy();
  });

  it("renders optional action node and handles clicks", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="Panier vide"
        action={
          <button type="button" onClick={onAction}>
            Ajouter un article
          </button>
        }
      />
    );

    const btn = screen.getByRole("button", { name: "Ajouter un article" });
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("supports srOnly: hides text visually with sr-only class", () => {
    render(<EmptyState title="Vide" srOnly />);

    const statusEl = screen.getByRole("status");
    expect(statusEl.getAttribute("title")).toBe("Vide");
    expect(screen.getByText("Vide").className).toContain("sr-only");
  });
});

describe("ErrorState", () => {
  it("renders with role=alert, error title and hint", () => {
    const { container } = render(
      <ErrorState title="Échec de connexion" hint="Vérifie ton réseau" />
    );

    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeTruthy();
    expect(alertEl.className).toContain("ui-state--error");
    expect(screen.getByText("Échec de connexion")).toBeTruthy();
    expect(screen.getByText("Vérifie ton réseau")).toBeTruthy();

    const glyph = container.querySelector(".ui-state-glyph");
    expect(glyph).toBeTruthy();
  });

  it("renders secondary retry button when onRetry is passed, and clicking invokes onRetry once", () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Erreur serveur" onRetry={onRetry} retryLabel="Relancer" />);

    const retryBtn = screen.getByRole("button", { name: "Relancer" });
    expect(retryBtn.className).toContain("ui-btn--secondary");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("supports custom action node when passed", () => {
    const onCustom = vi.fn();
    render(
      <ErrorState
        title="Erreur critique"
        action={
          <button type="button" onClick={onCustom}>
            Ignorer
          </button>
        }
      />
    );

    const btn = screen.getByRole("button", { name: "Ignorer" });
    fireEvent.click(btn);
    expect(onCustom).toHaveBeenCalledTimes(1);
  });

  it("supports srOnly: hides title visually with sr-only class", () => {
    render(<ErrorState title="Erreur cachée" srOnly />);

    const alertEl = screen.getByRole("alert");
    expect(alertEl.getAttribute("title")).toBe("Erreur cachée");
    expect(screen.getByText("Erreur cachée").className).toContain("sr-only");
  });
});
