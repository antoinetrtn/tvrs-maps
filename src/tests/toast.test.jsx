import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { dismissToast, showToast, Toast, ToastViewport } from "../components/ui/Toast";

describe("Toast", () => {
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
});
