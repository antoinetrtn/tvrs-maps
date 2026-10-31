import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ANSWER_INPUT_PROPS,
  focusAnswerInputSafely,
  shieldAutofillText,
} from "../utils/answerField";

describe("answer input attributes", () => {
  it("is a plain text field with autofill, correction and capitalisation off", () => {
    const { container } = render(<input {...ANSWER_INPUT_PROPS} />);
    const input = container.querySelector("input");
    expect(input.type).toBe("text");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("writingsuggestions")).toBe("false");
    expect(input.getAttribute("enterkeyhint")).toBe("done");
    expect(input.getAttribute("data-bwignore")).toBe("true");
  });

  it("uses a random, non-guessable field name per session", () => {
    expect(ANSWER_INPUT_PROPS.name).toMatch(/^answer-[a-z0-9]{12}$/);
    expect(ANSWER_INPUT_PROPS.name).not.toBe("q-resp");
  });

  it("shields autofill trigger keywords in placeholders and labels with zero-width space", () => {
    const fr = shieldAutofillText("Cliquez sur un pays sur le globe...");
    expect(fr).toContain("\u200B");
    expect(fr).not.toMatch(/\bpays\b/i);
    expect(fr.replaceAll("\u200B", "")).toBe("Cliquez sur un pays sur le globe...");

    const en = shieldAutofillText("Type a country name or capital...");
    expect(en).not.toMatch(/\bcountry\b/i);
    expect(en).not.toMatch(/\bname\b/i);
    expect(en).not.toMatch(/\bcapital\b/i);
    expect(en.replaceAll("\u200B", "")).toBe("Type a country name or capital...");
  });

  it("focusAnswerInputSafely avoids re-focusing an already focused input", () => {
    const { container } = render(<input {...ANSWER_INPUT_PROPS} />);
    const input = container.querySelector("input");
    const focusSpy = vi.spyOn(input, "focus");

    expect(focusAnswerInputSafely(input)).toBe(true);
    expect(focusSpy).toHaveBeenCalledTimes(1);

    // Already activeElement -> should NOT call .focus() again (prevents Android AutofillManager re-trigger)
    expect(focusAnswerInputSafely(input)).toBe(false);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
