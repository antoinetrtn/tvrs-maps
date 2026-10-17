import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), [href], input:not([disabled]), " +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, oldest first. Only the last one reacts to Escape / Tab. */
const dialogStack = [];

let scrollLocks = 0;
let previousBodyOverflow = "";

const lockBodyScroll = () => {
  if (typeof document === "undefined") return () => {};
  if (scrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
  };
};

const getFocusables = (container) => Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));

/** Keeps Tab / Shift+Tab inside `container`. */
function trapFocus(event, container) {
  if (event.key !== "Tab" || !container) return;
  const focusables = getFocusables(container);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables.at(-1);
  const inside = container.contains(document.activeElement);
  if (event.shiftKey) {
    if (document.activeElement === first || !inside) {
      event.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last || !inside) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Shared behaviour of every modal surface (Dialog, Sheet, side panel):
 * - moves focus inside when it opens (unless something inside already has it),
 * - traps Tab / Shift+Tab, and restores the previously focused element on close,
 * - closes on Escape through `onEscape` (omit it to disable Escape),
 * - locks the body scroll (reference-counted, optional),
 * - stacks: with several dialogs open, only the topmost one reacts to the keyboard.
 *
 * `onEscape` is read through a ref, so an inline callback never re-runs the effect.
 */
export function useDialogBehavior({ open, onEscape, containerRef, lockScroll = true }) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!open) return undefined;
    const token = Symbol("dialog");
    dialogStack.push(token);
    const previouslyFocused = document.activeElement;
    const unlockScroll = lockScroll ? lockBodyScroll() : null;

    const focusTimer = setTimeout(() => {
      const container = containerRef.current;
      if (!container || container.contains(document.activeElement)) return;
      const target = getFocusables(container)[0] ?? container;
      if (target === container && !container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      target.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (dialogStack.at(-1) !== token || event.defaultPrevented) return;
      if (event.key === "Escape") {
        if (!onEscapeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current(event);
        return;
      }
      trapFocus(event, containerRef.current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      const index = dialogStack.indexOf(token);
      if (index !== -1) dialogStack.splice(index, 1);
      unlockScroll?.();
      if (typeof previouslyFocused?.focus === "function" && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, lockScroll, containerRef]);
}
