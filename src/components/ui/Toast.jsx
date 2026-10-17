import React, { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import Button from "./Button";
import IconButton from "./IconButton";

/**
 * Toast — pixel notification (ui kit). `showToast()` from anywhere; a single
 * <ToastViewport /> renders the current toast in an aria-live region, with an
 * optional action button (e.g. "Rafraîchir").
 */
const listeners = new Set();
let current = null;
let nextId = 1;

const emit = () => listeners.forEach((fn) => fn());

export function showToast({ message, actionLabel, onAction, tone = "info", duration = 4000 }) {
  current = { id: nextId++, message, actionLabel, onAction, tone, duration };
  emit();
  return current.id;
}

export function dismissToast(id) {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getCurrent = () => current;

export const Toast = ({ message, actionLabel, onAction, tone = "info", onClose }) => (
  <div className={`ui-toast ui-toast--${tone}`}>
    <span className="ui-toast-message">{message}</span>
    {actionLabel ? (
      <Button variant="ghost" size="sm" className="ui-toast-action" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
    {onClose ? (
      <IconButton
        label="Fermer"
        size="sm"
        variant="ghost"
        className="ui-toast-close"
        onClick={onClose}
      >
        ×
      </IconButton>
    ) : null}
  </div>
);

export const ToastViewport = () => {
  const toast = useSyncExternalStore(subscribe, getCurrent, getCurrent);
  useEffect(() => {
    if (!toast || !toast.duration) return undefined;
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);
  const viewport = (
    <div className="ui-toast-viewport" role="status" aria-live="polite">
      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onClose={() => dismissToast(toast.id)}
        />
      ) : null}
    </div>
  );
  // Portal: above sheets/overlays whatever stacking context mounts it.
  return typeof document === "undefined" ? viewport : createPortal(viewport, document.body);
};
