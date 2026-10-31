import "./TextField.css";

import React, { useId } from "react";

const VARIANTS = ["glass", "outline", "search", "bare"];

/**
 * TextField — the kit's single text-input primitive.
 *
 * Props:
 * - `variant`: "glass" (default) | "outline" | "search" | "bare" (no kit chrome: only `className`,
 *   for inputs whose look belongs to their container, e.g. the in-game answer island)
 * - `label`: optional visible <label> rendered above, linked via htmlFor/id (auto-generated via useId when none given)
 * - `hint`: optional helper text rendered below, linked via aria-describedby
 * - `error`: optional string; sets aria-invalid, renders message below with role="alert"
 * - `className`: classes to append to the input
 * - Native input props: type, value, onChange, placeholder, disabled, required, maxLength, autoFocus, etc.
 *
 * When no label/hint/error is given, renders ONLY the <input> element.
 * Otherwise wraps them in `<div className="ui-textfield-field">`.
 */
const TextField = React.forwardRef(function TextField(
  {
    variant = "glass",
    label,
    hint,
    error,
    className = "",
    id,
    disabled = false,
    type = "text",
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const hasWrapper = Boolean(label || hint || error);
  const inputId = id || (hasWrapper ? `textfield-${generatedId.replace(/:/g, "")}` : undefined);
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const describedByIds = [ariaDescribedBy, error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  const safeVariant = VARIANTS.includes(variant) ? variant : "glass";
  const inputClasses = (
    safeVariant === "bare"
      ? [className]
      : ["ui-textfield", `ui-textfield--${safeVariant}`, className]
  )
    .filter(Boolean)
    .join(" ");

  const inputElement = (
    <input
      ref={ref}
      id={inputId}
      type={type}
      disabled={disabled}
      className={inputClasses}
      aria-describedby={describedByIds || undefined}
      aria-invalid={ariaInvalid ?? (Boolean(error) || undefined)}
      {...rest}
    />
  );

  if (!hasWrapper) {
    return inputElement;
  }

  return (
    <div className="ui-textfield-field">
      {label && (
        <label htmlFor={inputId} className="ui-textfield__label">
          {label}
        </label>
      )}
      {inputElement}
      {error && (
        <p id={errorId} role="alert" className="ui-textfield__error">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="ui-textfield__hint">
          {hint}
        </p>
      )}
    </div>
  );
});

export default TextField;
