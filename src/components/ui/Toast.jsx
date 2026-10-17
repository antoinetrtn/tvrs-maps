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

function triggerDismiss(toast) {
  if (!toast || toast.dismissed) return;
  toast.dismissed = true;
  if (typeof toast.onDismiss === "function") {
    try {
      toast.onDismiss();
    } catch (err) {
      console.error(err);
    }
  }
}

export function showToast({
  message,
  title,
  icon,
  actionLabel,
  onAction,
  onDismiss,
  tone = "info",
  duration = 4000,
}) {
  if (current) {
    const prev = current;
    current = null;
    triggerDismiss(prev);
  }
  const id = nextId++;
  current = {
    id,
    message,
    title,
    icon,
    actionLabel,
    onAction,
    onDismiss,
    tone,
    duration,
    dismissed: false,
  };
  emit();
  return id;
}

export function dismissToast(id) {
  if (!current || (id !== undefined && current.id !== id)) return;
  const prev = current;
  current = null;
  emit();
  triggerDismiss(prev);
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getCurrent = () => current;

export const Toast = ({
  message,
  title,
  icon,
  actionLabel,
  onAction,
  tone = "info",
  onClose,
  role,
}) => (
  <div className={`ui-toast ui-toast--${tone}`} data-tone={tone} role={role}>
    {icon ? (
      <span className="ui-toast-icon" aria-hidden="true">
        {icon}
      </span>
    ) : null}
    <div className="ui-toast-content">
      {title ? <span className="ui-toast-title">{title}</span> : null}
      {message ? <span className="ui-toast-message">{message}</span> : null}
    </div>
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

  const isError = toast?.tone === "error";
  const role = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" : "polite";

  const viewport = (
    <div className="ui-toast-viewport" role={role} aria-live={ariaLive}>
      {toast ? (
        <Toast
          key={toast.id}
          title={toast.title}
          message={toast.message}
          icon={toast.icon}
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
