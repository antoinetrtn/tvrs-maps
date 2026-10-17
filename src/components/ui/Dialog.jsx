import "./Dialog.css";

import React, { createContext, useContext, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { useDialogBehavior } from "../../hooks/useDialogBehavior";

const DialogContext = createContext(null);

/**
 * DialogTitle — the heading that labels the surrounding Dialog (`aria-labelledby`).
 * Use it for the title of the dialog so the accessible name always matches what is shown.
 */
export function DialogTitle({ as: Tag = "h2", className = "", children, ...rest }) {
  const ctx = useContext(DialogContext);
  return (
    <Tag id={ctx?.titleId} className={className || undefined} {...rest}>
      {children}
    </Tag>
  );
}

const stop = (event) => event.stopPropagation();

/**
 * Dialog — the single modal surface of the kit.
 *
 * - `variant="modal"`: centered card (auth, confirmations).
 * - `variant="sheet"`: bottom sheet on mobile, centered card from 768 px (training, rules).
 * - `variant="panel"`: the app's `.sheet-panel` (settings, profile, leaderboard); the caller owns
 *   the page overlay. It may stay mounted while closed (it is then `inert` and hidden to AT).
 *
 * Accessibility is built in: `role="dialog"` + `aria-modal`, a name from `DialogTitle` /
 * `labelledBy` / `label`, focus moved inside and restored on close, Tab trap, Escape
 * (`closeOnEscape`), body scroll lock (modal + sheet) and a stack so that only the topmost dialog
 * reacts. A click on the backdrop closes it when `closeOnBackdrop` is true (modal + sheet only).
 *
 * `className` goes on the surface, `backdropClassName` on the backdrop, `theme` is the app theme
 * class. Layout of the content stays with the caller.
 */
export default function Dialog({
  open = true,
  onClose,
  variant = "modal",
  label,
  labelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
  theme = "",
  className = "",
  backdropClassName = "",
  backdropTestId,
  children,
  ...rest
}) {
  const surfaceRef = useRef(null);
  const generatedId = useId();
  const titleId = labelledBy ?? `dialog-title-${generatedId.replaceAll(":", "")}`;
  const isPanel = variant === "panel";

  useDialogBehavior({
    open,
    onEscape: closeOnEscape ? onClose : undefined,
    containerRef: surfaceRef,
    lockScroll: !isPanel,
  });

  const ariaName = label ? { "aria-label": label } : { "aria-labelledby": titleId };

  if (isPanel) {
    return (
      <DialogContext.Provider value={{ titleId }}>
        {/* The panel only isolates pointer events from the globe layer behind it; it is a dialog
            surface, not a control. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={surfaceRef}
          role="dialog"
          aria-modal="true"
          {...ariaName}
          inert={!open}
          aria-hidden={open ? undefined : true}
          className={["sheet-panel", className, open && "open", theme].filter(Boolean).join(" ")}
          onClick={stop}
          onPointerDown={stop}
          {...rest}
        >
          {children}
        </div>
      </DialogContext.Provider>
    );
  }

  if (!open || typeof document === "undefined") return null;

  const isSheet = variant === "sheet";
  const backdropClasses = [
    "ui-dialog-backdrop",
    isSheet ? "ui-dialog-backdrop--sheet" : "dialog-panel",
    backdropClassName,
    theme,
  ]
    .filter(Boolean)
    .join(" ");
  const surfaceClasses = ["ui-dialog", isSheet ? "ui-dialog--sheet" : "dialog-card", className]
    .filter(Boolean)
    .join(" ");

  const surfaceProps = {
    ref: surfaceRef,
    className: surfaceClasses,
    "aria-modal": "true",
    ...ariaName,
    ...rest,
  };

  return createPortal(
    <DialogContext.Provider value={{ titleId }}>
      <div className={backdropClasses}>
        <button
          type="button"
          className="ui-dialog-scrim"
          tabIndex={-1}
          aria-hidden="true"
          disabled={!closeOnBackdrop}
          onClick={onClose}
          data-testid={backdropTestId}
        />
        {isSheet ? (
          <dialog open {...surfaceProps}>
            {children}
          </dialog>
        ) : (
          <div role="dialog" {...surfaceProps}>
            {children}
          </div>
        )}
      </div>
    </DialogContext.Provider>,
    document.body
  );
}
