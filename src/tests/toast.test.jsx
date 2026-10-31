import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dismissToast, showToast, Toast, ToastViewport } from "../components/ui/Toast";

describe("Toast", () => {
  beforeEach(() => {
    dismissToast();
  });

  it("renders message and action", () => {
    const onAction = vi.fn();
    render(<Toast message="Hello" actionLabel="Rafraîchir" onAction={onAction} />);
    fireEvent.click(screen.getByText("Rafraîchir"));
    expect(onAction).toHaveBeenCalled();
  });

  it("shows toasts in an aria-live viewport and dismisses them", () => {
    vi.useFakeTimers();
    render(<ToastViewport />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    let id;
    act(() => {
      id = showToast({ message: "Rendu WebGPU", duration: 1000 });
    });
    expect(screen.getByText("Rendu WebGPU")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.queryByText("Rendu WebGPU")).toBeNull();
    act(() => {
      id = showToast({ message: "Encore", duration: 0 });
    });
    act(() => dismissToast(id));
    expect(screen.queryByText("Encore")).toBeNull();
    vi.useRealTimers();
  });

  it("showToast renders title+message+icon+action", () => {
    render(<ToastViewport />);
    const onAction = vi.fn();
    act(() => {
      showToast({
        title: "Super Titre",
        message: "Mon message",
        icon: <span data-testid="toast-icon">🚀</span>,
        actionLabel: "Actionner",
        onAction,
        duration: 0,
      });
    });

    expect(screen.getByText("Super Titre")).toBeTruthy();
    expect(screen.getByText("Mon message")).toBeTruthy();

    const icon = screen.getByTestId("toast-icon");
    expect(icon).toBeTruthy();
    expect(icon.parentElement.getAttribute("aria-hidden")).toBe("true");

    const actionBtn = screen.getByRole("button", { name: "Actionner" });
    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("tone roles: alert for errors, status for others", () => {
    render(<ToastViewport />);

    act(() => {
      showToast({ message: "Erreur critique", tone: "error", duration: 0 });
    });
    const alertRegion = screen.getByRole("alert");
    expect(alertRegion).toBeTruthy();
    expect(alertRegion.getAttribute("aria-live")).toBe("assertive");

    act(() => {
      showToast({ message: "Succès", tone: "success", duration: 0 });
    });
    const successRegion = screen.getByRole("status");
    expect(successRegion).toBeTruthy();
    expect(successRegion.getAttribute("aria-live")).toBe("polite");

    act(() => {
      showToast({ message: "Information", tone: "info", duration: 0 });
    });
    const infoRegion = screen.getByRole("status");
    expect(infoRegion).toBeTruthy();
    expect(infoRegion.getAttribute("aria-live")).toBe("polite");
  });

  it("onDismiss fires exactly once on close button click", () => {
    render(<ToastViewport />);
    const onDismiss = vi.fn();

    act(() => {
      showToast({ message: "Toast à fermer", onDismiss, duration: 0 });
    });
    expect(onDismiss).not.toHaveBeenCalled();

    const closeBtn = screen.getByRole("button", { name: "Fermer" });
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      dismissToast();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("onDismiss fires exactly once on timeout", () => {
    vi.useFakeTimers();
    render(<ToastViewport />);
    const onDismiss = vi.fn();

    act(() => {
      showToast({ message: "Timeout toast", onDismiss, duration: 1000 });
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1050));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(2000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("onDismiss fires exactly once on replace and keeps a single toast on screen", () => {
    render(<ToastViewport />);
    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();

    act(() => {
      showToast({ message: "Premier toast", onDismiss: onDismiss1, duration: 0 });
    });
    expect(screen.getByText("Premier toast")).toBeTruthy();
    expect(onDismiss1).not.toHaveBeenCalled();

    act(() => {
      showToast({ message: "Deuxième toast", onDismiss: onDismiss2, duration: 0 });
    });
    expect(onDismiss1).toHaveBeenCalledTimes(1);
    expect(onDismiss2).not.toHaveBeenCalled();
    expect(screen.queryByText("Premier toast")).toBeNull();
    expect(screen.getByText("Deuxième toast")).toBeTruthy();
    expect(document.querySelectorAll(".ui-toast").length).toBe(1);
  });
});
