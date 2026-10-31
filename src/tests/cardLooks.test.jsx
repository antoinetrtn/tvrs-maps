import fs from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Card from "../components/ui/Card";
import { CARD_LOOKS } from "../components/ui/cardLooks";

const css = fs.readFileSync(path.resolve(__dirname, "../components/ui/CardLooks.css"), "utf8");

describe("Card", () => {
  it.each(CARD_LOOKS)("look %s is defined once in CardLooks.css", (look) => {
    expect(css).toMatch(new RegExp(`\\.ui-card--${look}(?![\\w-])`));
  });

  it("renders the requested element with look, glass and layout classes", () => {
    const { container } = render(
      <Card as="article" look="rules" glass className="extra">
        x
      </Card>
    );
    const el = container.firstChild;
    expect(el.tagName).toBe("ARTICLE");
    expect(el.className).toBe("ui-card ui-card--rules glass-panel extra");
  });
});
