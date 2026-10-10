import React, { useId } from "react";

/** SettingsSection — titled group of rows (one card in the settings sheet). */
export const SettingsSection = ({ title, children, className = "" }) => {
  const id = useId();
  return (
    <section className={`ui-settings-section ${className}`} aria-labelledby={id}>
      <h3 className="ui-settings-title" id={id}>
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
export const SettingsRow = ({ label, description, children, layout = "inline" }) => {
  const descId = useId();
  return (
    <div className={`ui-settings-row ui-settings-row--${layout}`}>
      {(label || description) && (
        <div className="ui-settings-text">
          {label && <span className="ui-settings-label">{label}</span>}
          {description && (
            <p className="ui-settings-desc" id={descId}>
              {description}
            </p>
          )}
        </div>
      )}
      <div className="ui-settings-control" aria-describedby={description ? descId : undefined}>
        {children}
      </div>
    </div>
  );
};
