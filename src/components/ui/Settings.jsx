import React, { useId } from "react";

/** SettingsSection — titled group of rows (one card in the settings sheet). */
export const SettingsSection = ({ title, children, className = "", hideTitle = false }) => {
  const id = useId();
  return (
    <section className={`ui-settings-section ${className}`} aria-labelledby={id}>
      <h3 className={`ui-settings-title ${hideTitle ? "sr-only" : ""}`} id={id}>
        {title}
      </h3>
      <div className="ui-settings-rows">{children}</div>
    </section>
  );
};

/**
 * SettingsRow — label + optional description + control.
 * inline (default): control aligned right of the text (switches).
 * stacked: control below the text, full width (sliders, option groups).
 */
export const SettingsRow = ({ label, description, srDescription, children, layout = "inline" }) => {
  const descId = useId();
  const srDescId = useId();
  const hasDesc = Boolean(description);
  const hasSrDesc = Boolean(srDescription);
  const describedBy =
    [hasDesc ? descId : null, hasSrDesc ? srDescId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`ui-settings-row ui-settings-row--${layout}`}>
      {(label || hasDesc || hasSrDesc) && (
        <div className="ui-settings-text">
          {label && <span className="ui-settings-label">{label}</span>}
          {hasDesc && (
            <p className="ui-settings-desc" id={descId}>
              {description}
            </p>
          )}
          {hasSrDesc && (
            <p className="ui-settings-desc sr-only" id={srDescId}>
              {srDescription}
            </p>
          )}
        </div>
      )}
      <div className="ui-settings-control" aria-describedby={describedBy}>
        {children}
      </div>
    </div>
  );
};
