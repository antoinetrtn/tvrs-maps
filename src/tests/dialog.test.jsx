import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Dialog, { DialogTitle } from "../components/ui/Dialog";

const flushFocus = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

function Basic({ onClose = () => {}, ...props }) {
  return (
    <Dialog onClose={onClose} {...props}>
      <DialogTitle>Titre</DialogTitle>
      <button type="button">Premier</button>
      <button type="button">Dernier</button>
    </Dialog>
  );
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("Dialog — aria", () => {
  it("renders role=dialog, aria-modal and a name from DialogTitle", () => {
    render(<Basic />);
    const dialog = screen.getByRole("dialog", { name: "Titre" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("supports an explicit aria-label and a custom labelledBy id", () => {
    const { unmount } = render(<Basic label="Réglages" />);
    expect(screen.getByRole("dialog", { name: "Réglages" })).toBeTruthy();
    unmount();
    render(
      <Dialog onClose={() => {}} labelledBy="mon-titre">
        <DialogTitle>Autre</DialogTitle>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe("mon-titre");
    expect(document.getElementById("mon-titre")?.textContent).toBe("Autre");
  });

  it("renders nothing when closed (modal / sheet) and is inert when closed (panel)", () => {
    const { rerender } = render(<Basic open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<Basic variant="panel" open={false} />);
    const panel = document.querySelector(".sheet-panel");
    expect(panel).toBeTruthy();
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    rerender(<Basic variant="panel" open />);
    expect(document.querySelector(".sheet-panel").hasAttribute("inert")).toBe(false);
    expect(document.querySelector(".sheet-panel").className).toContain("open");
  });

  it("uses a native <dialog> for the sheet variant", () => {
    render(<Basic variant="sheet" />);
    expect(document.querySelector("dialog.ui-dialog--sheet")).toBeTruthy();
  });
});

describe("Dialog — keyboard", () => {
  it("closes on Escape, unless closeOnEscape is false", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Basic onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Basic onClose={onClose} closeOnEscape={false} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus inside on open, traps Tab and restores focus on close", async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Ouvrir
          </button>
          <Basic open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Ouvrir" });
    opener.focus();
    fireEvent.click(opener);
    await flushFocus();
    const first = screen.getByRole("button", { name: "Premier" });
    const last = screen.getByRole("button", { name: "Dernier" });
    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(window, { key: "Escape" });
    await flushFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("only reacts on the topmost dialog when several are open", () => {
    const onBottom = vi.fn();
    const onTop = vi.fn();
    render(
      <>
        <Basic label="bas" onClose={onBottom} />
        <Basic label="haut" onClose={onTop} />
      </>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onTop).toHaveBeenCalledTimes(1);
    expect(onBottom).not.toHaveBeenCalled();
  });
});

describe("Dialog — backdrop and scroll lock", () => {
  it("closes on backdrop click by default and ignores it when closeOnBackdrop is false", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Basic onClose={onClose} backdropTestId="scrim" />);
    fireEvent.click(screen.getByTestId("scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Basic onClose={onClose} backdropTestId="scrim" closeOnBackdrop={false} />);
    expect(screen.getByTestId("scrim").hasAttribute("disabled")).toBe(true);
  });

  it("does not close when clicking inside the dialog", () => {
    const onClose = vi.fn();
    render(<Basic onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Premier" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks the body scroll while open (reference-counted) and restores it", () => {
    document.body.style.overflow = "auto";
    const first = render(<Basic label="a" />);
    const second = render(<Basic label="b" />);
    expect(document.body.style.overflow).toBe("hidden");
    first.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("does not lock the scroll for the panel variant", () => {
    document.body.style.overflow = "auto";
    render(<Basic variant="panel" />);
    expect(document.body.style.overflow).toBe("auto");
  });
});
