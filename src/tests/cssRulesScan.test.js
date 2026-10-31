import { describe, expect, it } from "vitest";

import { scanSource } from "../../scripts/lib/cssRulesScan.mjs";
import { diffCounts } from "../../scripts/lib/ratchet.mjs";

const HEX_ABC = "#" + "abc";
const HEX_BG = "#" + "0e1116";
const HEX_WHITE = "#" + "fff";
const RGBA_SHADOW = "rgb" + "a(0,0,0,.4)";
const RGBA_SHADOW_HALF = "rgb" + "a(0,0,0,0.5)";

describe("cssRulesScan — rules positive and negative cases", () => {
  it("hex-color: flags hex outside index.css but allows inside src/index.css and tokens", () => {
    const bad = scanSource("src/components/Card.css", `.card { color: ${HEX_ABC}; }`);
    expect(bad.some((v) => v.rule === "hex-color")).toBe(true);

    const goodIndex = scanSource("src/index.css", `:root { --bg: ${HEX_BG}; }`);
    expect(goodIndex.some((v) => v.rule === "hex-color")).toBe(false);

    const goodVar = scanSource("src/components/Card.css", ".card { color: var(--text-main); }");
    expect(goodVar.some((v) => v.rule === "hex-color")).toBe(false);
  });

  it("important: flags !important and allows regular declarations", () => {
    const bad = scanSource("src/components/Card.css", ".card { color: red !important; }");
    expect(bad.some((v) => v.rule === "important")).toBe(true);

    const good = scanSource("src/components/Card.css", ".card { color: red; }");
    expect(good.some((v) => v.rule === "important")).toBe(false);
  });

  it("z-index-raw: flags bare integer z-index, allows --z-dialog, vars, and auto", () => {
    const bad = scanSource("src/components/Card.css", ".card { z-index: 5; }");
    expect(bad.some((v) => v.rule === "z-index-raw")).toBe(true);

    const customProp = scanSource("src/components/Card.css", ":root { --z-dialog: 5000; }");
    expect(customProp.some((v) => v.rule === "z-index-raw")).toBe(false);

    const goodVar = scanSource("src/components/Card.css", ".card { z-index: var(--z-dialog); }");
    expect(goodVar.some((v) => v.rule === "z-index-raw")).toBe(false);

    const goodAuto = scanSource("src/components/Card.css", ".card { z-index: auto; }");
    expect(goodAuto.some((v) => v.rule === "z-index-raw")).toBe(false);
  });

  it("uppercase: flags uppercase text-transform, allows none/capitalize", () => {
    const bad = scanSource("src/components/Card.css", ".title { text-transform: uppercase; }");
    expect(bad.some((v) => v.rule === "uppercase")).toBe(true);

    const good = scanSource("src/components/Card.css", ".title { text-transform: none; }");
    expect(good.some((v) => v.rule === "uppercase")).toBe(false);
  });

  it("radius-circular & radius-large: handles 50%, 12px, 8px, and prevents double-count", () => {
    const circular = scanSource("src/components/Avatar.css", ".avatar { border-radius: 50%; }");
    expect(circular.some((v) => v.rule === "radius-circular")).toBe(true);
    expect(circular.some((v) => v.rule === "radius-large")).toBe(false);

    const fullVar = scanSource(
      "src/components/Avatar.css",
      ".avatar { clip-path: circle(var(--radius-full)); }"
    );
    expect(fullVar.some((v) => v.rule === "radius-circular")).toBe(true);

    const large = scanSource("src/components/Card.css", ".card { border-radius: 12px; }");
    expect(large.some((v) => v.rule === "radius-large")).toBe(true);
    expect(large.some((v) => v.rule === "radius-circular")).toBe(false);

    const largeRem = scanSource("src/components/Card.css", ".card { border-radius: 0.6rem; }");
    expect(largeRem.some((v) => v.rule === "radius-large")).toBe(true);

    const ok8px = scanSource("src/components/Card.css", ".card { border-radius: 8px; }");
    expect(ok8px.some((v) => v.rule.startsWith("radius"))).toBe(false);

    const okRem = scanSource("src/components/Card.css", ".card { border-radius: 0.5rem; }");
    expect(okRem.some((v) => v.rule.startsWith("radius"))).toBe(false);
  });

  it("blur-over-4px: flags > 4px in CSS and JS, allows <= 4px", () => {
    const badCss = scanSource("src/components/Glass.css", ".g { filter: blur(10px); }");
    expect(badCss.some((v) => v.rule === "blur-over-4px")).toBe(true);

    const badVar = scanSource("src/components/Glass.css", ":root { --blur-heavy: blur(10px); }");
    expect(badVar.some((v) => v.rule === "blur-over-4px")).toBe(true);

    const okCss = scanSource("src/components/Glass.css", ".g { filter: blur(4px); }");
    expect(okCss.some((v) => v.rule === "blur-over-4px")).toBe(false);

    const badJs = scanSource("src/components/Glass.js", 'const style = { filter: "blur(10px)" };');
    expect(badJs.some((v) => v.rule === "blur-over-4px")).toBe(true);

    const okJs = scanSource("src/components/Glass.js", 'const style = { filter: "blur(4px)" };');
    expect(okJs.some((v) => v.rule === "blur-over-4px")).toBe(false);
  });

  it("viewport-100vh: requires dvh/svh/lvh sibling in same rule", () => {
    const bad = scanSource("src/components/Hero.css", ".hero { height: 100vh; }");
    expect(bad.some((v) => v.rule === "viewport-100vh")).toBe(true);

    const good = scanSource(
      "src/components/Hero.css",
      ".hero {\n  height: 100vh;\n  height: 100dvh;\n}"
    );
    expect(good.some((v) => v.rule === "viewport-100vh")).toBe(false);

    const goodCalc = scanSource(
      "src/components/Hero.css",
      ".hero {\n  min-height: calc(100vh - 100px);\n  min-height: calc(100dvh - 100px);\n}"
    );
    expect(goodCalc.some((v) => v.rule === "viewport-100vh")).toBe(false);
  });

  it("glow-shadow: flags non-zero blur shadow, allows hard pixel shadow and drop-shadow 0", () => {
    const bad = scanSource(
      "src/components/Card.css",
      `.c { box-shadow: 0 0 12px ${RGBA_SHADOW}; }`
    );
    expect(bad.some((v) => v.rule === "glow-shadow")).toBe(true);

    const badDrop = scanSource(
      "src/components/Card.css",
      ".c { filter: drop-shadow(0 2px 4px black); }"
    );
    expect(badDrop.some((v) => v.rule === "glow-shadow")).toBe(true);

    const okHard = scanSource(
      "src/components/Card.css",
      ".c { box-shadow: 2px 2px 0 var(--text-main); }"
    );
    expect(okHard.some((v) => v.rule === "glow-shadow")).toBe(false);

    const okInsetBorder = scanSource(
      "src/components/Card.css",
      ".c { box-shadow: 0 0 0 1px var(--accent); }"
    );
    expect(okInsetBorder.some((v) => v.rule === "glow-shadow")).toBe(false);

    const okDrop0 = scanSource(
      "src/components/Card.css",
      ".c { filter: drop-shadow(0 2px 0 black); }"
    );
    expect(okDrop0.some((v) => v.rule === "glow-shadow")).toBe(false);
  });

  it("cubic-bezier-raw: flags raw cubic-bezier outside custom properties", () => {
    const bad = scanSource(
      "src/components/Anim.css",
      ".a { transition: transform 0.2s cubic-bezier(0.1, 0.7, 1, 0.1); }"
    );
    expect(bad.some((v) => v.rule === "cubic-bezier-raw")).toBe(true);

    const goodToken = scanSource(
      "src/components/Anim.css",
      ":root { --ease-out: cubic-bezier(0.1, 0.7, 1, 0.1); }"
    );
    expect(goodToken.some((v) => v.rule === "cubic-bezier-raw")).toBe(false);
  });

  it("duration-raw: flags time literals not inside var(), allows 0s and var()", () => {
    const badTrans = scanSource("src/components/Anim.css", ".a { transition: opacity 200ms; }");
    expect(badTrans.some((v) => v.rule === "duration-raw")).toBe(true);

    const badAnim = scanSource("src/components/Anim.css", ".a { animation-duration: 0.3s; }");
    expect(badAnim.some((v) => v.rule === "duration-raw")).toBe(true);

    const goodVar = scanSource(
      "src/components/Anim.css",
      ".a { transition: opacity var(--dur-fast); }"
    );
    expect(goodVar.some((v) => v.rule === "duration-raw")).toBe(false);

    const goodZero = scanSource("src/components/Anim.css", ".a { transition-delay: 0s; }");
    expect(goodZero.some((v) => v.rule === "duration-raw")).toBe(false);
  });

  it("outline-none: flags outline: none without focus-visible pseudo", () => {
    const bad = scanSource("src/components/Btn.css", ".btn { outline: none; }");
    expect(bad.some((v) => v.rule === "outline-none")).toBe(true);

    const badFocus = scanSource("src/components/Btn.css", ".btn:focus { outline: 0; }");
    expect(badFocus.some((v) => v.rule === "outline-none")).toBe(true);

    const okFocusVisible = scanSource(
      "src/components/Btn.css",
      ".a:focus-visible { outline: none; }"
    );
    expect(okFocusVisible.some((v) => v.rule === "outline-none")).toBe(false);

    const okFocusWithin = scanSource("src/components/Btn.css", ".a:focus-within { outline: 0; }");
    expect(okFocusWithin.some((v) => v.rule === "outline-none")).toBe(false);
  });

  it("serif-font: flags serif faces, allows sans-serif and monospace", () => {
    const badCss = scanSource("src/components/Text.css", '.t { font-family: "Georgia", serif; }');
    expect(badCss.some((v) => v.rule === "serif-font")).toBe(true);

    const goodCss = scanSource(
      "src/components/Text.css",
      '.t { font-family: "Space Grotesk", sans-serif; }'
    );
    expect(goodCss.some((v) => v.rule === "serif-font")).toBe(false);

    const badJs = scanSource(
      "src/components/Text.jsx",
      'const s = { fontFamily: "Times New Roman" };'
    );
    expect(badJs.some((v) => v.rule === "serif-font")).toBe(true);
  });

  it("escape hatch: css-rules-allow comment exempts declaration on same or previous line", () => {
    const cssPrev = scanSource(
      "src/components/Allow.css",
      `/* css-rules-allow: hex-color — legacy */\n.box { color: ${HEX_WHITE}; }`
    );
    expect(cssPrev.some((v) => v.rule === "hex-color")).toBe(false);

    const cssSame = scanSource(
      "src/components/Allow.css",
      `.box { color: ${HEX_WHITE}; /* css-rules-allow: hex-color — legacy */ }`
    );
    expect(cssSame.some((v) => v.rule === "hex-color")).toBe(false);

    const jsPrev = scanSource(
      "src/components/Allow.js",
      '// css-rules-allow: blur-over-4px — token\nconst x = "blur(12px)";'
    );
    expect(jsPrev.some((v) => v.rule === "blur-over-4px")).toBe(false);
  });

  it("handles multi-line values and nested keyframes properly", () => {
    const multiline = scanSource(
      "src/components/Multi.css",
      `.card {\n  box-shadow:\n    0 0 12px\n    ${RGBA_SHADOW_HALF};\n}`
    );
    expect(multiline.some((v) => v.rule === "glow-shadow")).toBe(true);

    const keyframes = scanSource(
      "src/components/Kf.css",
      "@keyframes pulse {\n  0% {\n    border-radius: 12px;\n  }\n  100% {\n    border-radius: 8px;\n  }\n}"
    );
    expect(keyframes.some((v) => v.rule === "radius-large")).toBe(true);
  });
});

describe("ratchet — diffCounts", () => {
  it("detects increases, decreases, and new files", () => {
    const baseline = {
      "hex-color": { "src/a.css": 2 },
      important: { "src/b.css": 5, "src/c.css": 1 },
    };
    const current = {
      "hex-color": { "src/a.css": 4 },
      important: { "src/b.css": 3 },
      uppercase: { "src/d.css": 1 },
    };

    const diff = diffCounts(current, baseline);

    expect(diff.increases).toEqual([
      { rule: "hex-color", file: "src/a.css", from: 2, to: 4 },
      { rule: "uppercase", file: "src/d.css", from: 0, to: 1 },
    ]);

    expect(diff.decreases).toEqual([
      { rule: "important", file: "src/b.css", from: 5, to: 3 },
      { rule: "important", file: "src/c.css", from: 1, to: 0 },
    ]);
  });
  it("hover-unguarded: flags :hover outside @media (hover: hover), accepts guarded rules", () => {
    const bad = scanSource("src/components/Card.css", ".card:hover { color: red; }");
    expect(bad.some((v) => v.rule === "hover-unguarded")).toBe(true);

    const good = scanSource(
      "src/components/Card.css",
      "@media (hover: hover) { .card:hover { color: red; } }"
    );
    expect(good.some((v) => v.rule === "hover-unguarded")).toBe(false);

    const nested = scanSource(
      "src/components/Card.css",
      "@media (hover: hover) and (min-width: 769px) { .card:hover { color: red; } }"
    );
    expect(nested.some((v) => v.rule === "hover-unguarded")).toBe(false);

    const allowed = scanSource(
      "src/components/Card.css",
      "/* css-rules-allow: hover-unguarded — test */\n.card:hover { color: red; }"
    );
    expect(allowed.some((v) => v.rule === "hover-unguarded")).toBe(false);
  });

  it("breakpoint-offscale: accepts the scale and its +1 complement, flags other widths", () => {
    const ok = scanSource(
      "src/components/Card.css",
      "@media (max-width: 768px) { .a { color: red; } }\n@media (min-width: 769px) { .a { color: blue; } }"
    );
    expect(ok.some((v) => v.rule === "breakpoint-offscale")).toBe(false);

    const bad = scanSource(
      "src/components/Card.css",
      "@media (max-width: 900px) { .a { color: red; } }"
    );
    expect(bad.filter((v) => v.rule === "breakpoint-offscale")).toHaveLength(1);
  });
});
