import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";

afterEach(() => vi.restoreAllMocks());

describe("Button", () => {
  it("renders a type=button by default so it never submits a form", () => {
    render(<Button>Jouer</Button>);
    expect(screen.getByRole("button", { name: "Jouer" }).getAttribute("type")).toBe("button");
  });

  it("allows type=submit explicitly", () => {
    render(<Button type="submit">Envoyer</Button>);
    expect(screen.getByRole("button", { name: "Envoyer" }).getAttribute("type")).toBe("submit");
  });

  it("maps variant, size and block to classes (secondary/md by default)", () => {
    const { rerender } = render(<Button>A</Button>);
    const el = screen.getByRole("button");
    expect(el.className).toContain("ui-btn--secondary");
    expect(el.className).toContain("ui-btn--md");
    rerender(
      <Button variant="danger" size="lg" block className="extra">
        A
      </Button>
    );
    const next = screen.getByRole("button");
    expect(next.className).toContain("ui-btn--danger");
    expect(next.className).toContain("ui-btn--lg");
    expect(next.className).toContain("ui-btn--block");
    expect(next.className).toContain("extra");
  });

  it("falls back to safe defaults for unknown variant/size", () => {
    render(
      <Button variant="neon" size="xl">
        A
      </Button>
    );
    const el = screen.getByRole("button");
    expect(el.className).toContain("ui-btn--secondary");
    expect(el.className).toContain("ui-btn--md");
  });

  it("calls onClick and honours disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    );
    expect(screen.getByRole("button").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("loading: aria-busy, keeps focusable, ignores clicks", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Connexion
      </Button>
    );
    const el = screen.getByRole("button", { name: "Connexion" });
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.className).toContain("is-loading");
    expect(el.disabled).toBe(false);
    fireEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a decorative icon hidden from assistive tech", () => {
    render(<Button icon={<svg data-testid="i" />}>Texte</Button>);
    expect(screen.getByTestId("i").parentElement.getAttribute("aria-hidden")).toBe("true");
  });

  it("forwards refs and extra props", () => {
    const ref = React.createRef();
    render(
      <Button ref={ref} data-x="1">
        A
      </Button>
    );
    expect(ref.current.getAttribute("data-x")).toBe("1");
  });
});

describe("IconButton", () => {
  it("uses the label as accessible name and tooltip, type=button", () => {
    render(
      <IconButton label="Fermer">
        <svg />
      </IconButton>
    );
    const el = screen.getByRole("button", { name: "Fermer" });
    expect(el.getAttribute("title")).toBe("Fermer");
    expect(el.getAttribute("type")).toBe("button");
  });

  it("keeps a custom title distinct from the label", () => {
    render(
      <IconButton label="XP" title="340 / 500">
        <svg />
      </IconButton>
    );
    const el = screen.getByRole("button", { name: "XP" });
    expect(el.getAttribute("title")).toBe("340 / 500");
  });

  it("reports a missing label in development", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <IconButton>
        <svg />
      </IconButton>
    );
    expect(spy).toHaveBeenCalled();
  });

  it("maps variant and size to classes with safe fallbacks", () => {
    const { rerender } = render(
      <IconButton label="A" variant="ghost" size="sm">
        <svg />
      </IconButton>
    );
    expect(screen.getByRole("button").className).toContain("ui-icon-btn--ghost");
    expect(screen.getByRole("button").className).toContain("ui-icon-btn--sm");
    rerender(
      <IconButton label="A" variant="x" size="y">
        <svg />
      </IconButton>
    );
    expect(screen.getByRole("button").className).toContain("ui-icon-btn--glass");
    expect(screen.getByRole("button").className).toContain("ui-icon-btn--lg");
  });

  it("honours disabled and onClick", () => {
    const onClick = vi.fn();
    render(
      <IconButton label="A" onClick={onClick} disabled>
        <svg />
      </IconButton>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
