import fs from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Button, { LOOKS } from "../components/ui/Button";

const css = fs.readFileSync(path.resolve(__dirname, "../components/ui/ButtonLooks.css"), "utf8");

describe("Button looks", () => {
  it.each(LOOKS)("look %s is defined once in ButtonLooks.css", (look) => {
    expect(css).toMatch(new RegExp(`\\.ui-btn--${look}(?![\\w-])`));
  });

  it("adds known looks and ignores unknown ones", () => {
    const { getByRole } = render(<Button look={["tile", "nope"]}>x</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("ui-btn--tile");
    expect(cls).not.toContain("nope");
  });
});
