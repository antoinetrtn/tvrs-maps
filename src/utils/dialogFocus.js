import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), [href], input:not([disabled]), " +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(event, dialog) {
  if (event.key !== "Tab" || !dialog) {
    return;
  }
  const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables.at(-1);
  if (event.shiftKey) {
    if (document.activeElement === first || !dialog.contains(document.activeElement)) {
      event.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

export function useDialogA11y(open, onClose, dialogRef) {
  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement;

    const focusTimer = setTimeout(() => {
      dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)[0]?.focus();
    }, 0);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      } else {
        trapFocus(e, dialogRef.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      prevActive?.focus?.();
    };
  }, [open, onClose, dialogRef]);
}
