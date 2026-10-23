import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ANSWER_INPUT_PROPS } from "../utils/answerField";

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
});
