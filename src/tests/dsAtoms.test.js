// @vitest-environment node
import { describe, expect, it } from "vitest";

import { scanSource } from "../../scripts/check-ds-atoms.mjs";

const rules = (file, text) => scanSource(file, text).map((v) => v.rule);

describe("check-ds-atoms", () => {
  it("flags raw controls and dialog markup outside ui/", () => {
    const src = '<button/>\n<input type="range"/>\n<div role="dialog" />';
    expect(rules("src/components/Foo.jsx", src)).toEqual(["raw-button", "raw-input", "raw-dialog"]);
  });
  it("allows primitives inside src/components/ui", () => {
    expect(rules("src/components/ui/Button.jsx", "<button/>")).toEqual([]);
  });
  it("flags local keyframes and ad-hoc atom classes, not motion.css", () => {
    const css = "@keyframes pop {}\n.hud-btn:hover {\n}";
    expect(rules("src/components/Foo.css", css)).toEqual(["local-keyframes", "adhoc-atom-class"]);
    expect(rules("src/styles/motion.css", "@keyframes pop {}")).toEqual([]);
    expect(rules("src/components/Foo.css", ".stat-card {\n}")).toEqual(["adhoc-atom-class"]);
    expect(rules("src/components/Foo.css", ".card-title {\n}")).toEqual([]);
  });
  it("honours the reviewed escape hatch", () => {
    expect(
      rules("src/components/Foo.jsx", "{/* ds-atoms-allow: raw-button — native */}\n<button/>")
    ).toEqual([]);
  });
});
