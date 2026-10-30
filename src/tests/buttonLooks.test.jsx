import fs from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Button from "../components/ui/Button";
import { ICON_LOOKS, LOOKS } from "../components/ui/buttonLooks";

// eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed repo paths
const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");
const css = read("../components/ui/ButtonLooks.css");
// glass-chrome stays in index.css: it shares :is() groups (and their specificity) with sheet panels.
const iconCss = read("../components/ui/IconButtonLooks.css") + read("../index.css");

describe("Button looks", () => {
  it.each(LOOKS)("look %s is defined once in ButtonLooks.css", (look) => {
    expect(css).toMatch(new RegExp(`\\.ui-btn--${look}(?![\\w-])`));
  });

  it.each(ICON_LOOKS)("icon look %s is defined once in IconButtonLooks.css", (look) => {
    expect(iconCss).toMatch(new RegExp(`\\.ui-icon-btn--${look}(?![\\w-])`));
  });

  it("adds known looks and ignores unknown ones", () => {
    const { getByRole } = render(<Button look={["tile", "nope"]}>x</Button>);
    const cls = getByRole("button").className;
    expect(cls).toContain("ui-btn--tile");
    expect(cls).not.toContain("nope");
  });
});
