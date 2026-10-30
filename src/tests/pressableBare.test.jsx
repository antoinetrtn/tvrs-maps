import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Pressable from "../components/ui/Pressable";
import TextField from "../components/ui/TextField";

// Atomic DS migration guard: these primitives must render exactly the native markup they replace.
describe("Pressable / TextField bare", () => {
  it("Pressable renders a bare <button type=button> with only the caller's class", () => {
    const { container } = render(
      <Pressable className="deck-dot active" aria-label="x" title="x" />
    );
    expect(container.innerHTML).toBe(
      '<button type="button" class="deck-dot active" aria-label="x" title="x"></button>'
    );
  });
  it('TextField variant="bare" renders the plain <input> without kit chrome', () => {
    const { container } = render(
      <TextField variant="bare" id="q" className="input-field" placeholder="p" />
    );
    const input = container.querySelector("input");
    expect(container.children).toHaveLength(1);
    expect(input.className).toBe("input-field");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });
});
