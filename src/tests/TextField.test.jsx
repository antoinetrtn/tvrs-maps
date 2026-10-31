import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import TextField from "../components/ui/TextField";

describe("TextField", () => {
  it("renders bare input without wrapper when no label, hint or error is given", () => {
    const { container } = render(<TextField placeholder="Bare input" />);
    expect(container.firstElementChild.tagName).toBe("INPUT");
    expect(container.querySelector(".ui-textfield-field")).toBeNull();
    const input = screen.getByPlaceholderText("Bare input");
    expect(input.className).toContain("ui-textfield");
    expect(input.className).toContain("ui-textfield--glass");
  });

  it("links label to input with htmlFor and auto-generated id", () => {
    render(<TextField label="Nom d'utilisateur" />);
    const label = screen.getByText("Nom d'utilisateur");
    const input = screen.getByLabelText("Nom d'utilisateur");
    expect(input).toBeTruthy();
    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).toMatch(/^textfield-/);
  });

  it("preserves custom id when label is provided", () => {
    render(<TextField id="custom-username" label="Pseudo" />);
    const label = screen.getByText("Pseudo");
    const input = screen.getByLabelText("Pseudo");
    expect(input.id).toBe("custom-username");
    expect(label.getAttribute("for")).toBe("custom-username");
  });

  it("links hint to input via aria-describedby", () => {
    render(<TextField hint="Format attendu: A-Z" />);
    const input = screen.getByRole("textbox");
    const hint = screen.getByText("Format attendu: A-Z");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("sets aria-invalid and shows error message with role alert", () => {
    render(<TextField error="Ce champ est requis" />);
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Ce champ est requis");
  });

  it("links both error and hint via aria-describedby", () => {
    render(<TextField hint="Format attendu: A-Z" error="Format invalide" />);
    const input = screen.getByRole("textbox");
    const errorEl = screen.getByRole("alert");
    const hintEl = screen.getByText("Format attendu: A-Z");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toContain(errorEl.id);
    expect(describedBy).toContain(hintEl.id);
  });

  it("forwards ref to the native input element", () => {
    const ref = React.createRef();
    render(<TextField ref={ref} data-testid="ref-input" />);
    expect(ref.current).toBe(screen.getByTestId("ref-input"));
    expect(ref.current.tagName).toBe("INPUT");
  });

  it("passes through native input props", () => {
    const onChange = vi.fn();
    render(
      <TextField
        type="email"
        value="test@tvrs.fr"
        onChange={onChange}
        placeholder="Email..."
        maxLength={50}
        required
        data-custom="custom-val"
      />
    );
    const input = screen.getByPlaceholderText("Email...");
    expect(input.getAttribute("type")).toBe("email");
    expect(input.value).toBe("test@tvrs.fr");
    expect(input.maxLength).toBe(50);
    expect(input.required).toBe(true);
    expect(input.getAttribute("data-custom")).toBe("custom-val");

    fireEvent.change(input, { target: { value: "nouveau@tvrs.fr" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("honours disabled prop", () => {
    render(<TextField disabled label="Désactivé" />);
    const input = screen.getByLabelText("Désactivé");
    expect(input.disabled).toBe(true);
  });

  it("applies variant classes with fallback to glass", () => {
    const { rerender } = render(<TextField variant="glass" />);
    expect(screen.getByRole("textbox").className).toContain("ui-textfield--glass");

    rerender(<TextField variant="outline" />);
    expect(screen.getByRole("textbox").className).toContain("ui-textfield--outline");

    rerender(<TextField variant="search" />);
    expect(screen.getByRole("textbox").className).toContain("ui-textfield--search");

    rerender(<TextField variant="unknown-variant" />);
    expect(screen.getByRole("textbox").className).toContain("ui-textfield--glass");
  });

  it("preserves caller className on the input element", () => {
    render(<TextField className="conquest-input conquest-code-input" variant="outline" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("ui-textfield");
    expect(input.className).toContain("ui-textfield--outline");
    expect(input.className).toContain("conquest-input");
    expect(input.className).toContain("conquest-code-input");
  });
});
