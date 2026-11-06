import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GeoDataStatus from "../components/GeoDataStatus";

describe("GeoDataStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when status is ready or idle", () => {
    const { container: readyContainer } = render(
      <GeoDataStatus status="ready" onRetry={vi.fn()} lang="fr" />
    );
    expect(readyContainer.firstChild).toBeNull();

    const { container: idleContainer } = render(
      <GeoDataStatus status="idle" onRetry={vi.fn()} lang="fr" />
    );
    expect(idleContainer.firstChild).toBeNull();
  });

  it("renders nothing when status is loading (loading state superseded by boot overlay)", () => {
    const { container } = render(<GeoDataStatus status="loading" onRetry={vi.fn()} lang="fr" />);
    expect(container.firstChild).toBeNull();
  });

  it("error renders role=alert, fr and en texts, and clicking button calls onRetry once", () => {
    const onRetryFr = vi.fn();
    const { rerender } = render(<GeoDataStatus status="error" onRetry={onRetryFr} lang="fr" />);

    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeTruthy();
    expect(screen.getByText("Carte indisponible")).toBeTruthy();
    expect(screen.getByText("Vérifie ta connexion puis réessaie.")).toBeTruthy();

    const retryBtnFr = screen.getByRole("button", { name: "Réessayer" });
    fireEvent.click(retryBtnFr);
    expect(onRetryFr).toHaveBeenCalledTimes(1);

    const onRetryEn = vi.fn();
    rerender(<GeoDataStatus status="error" onRetry={onRetryEn} lang="en" />);

    expect(screen.getByText("Map unavailable")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();

    const retryBtnEn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtnEn);
    expect(onRetryEn).toHaveBeenCalledTimes(1);
  });
});
