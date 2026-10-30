#!/usr/bin/env node
/**
 * check-ds-atoms.mjs — atomic design-system lint (ratchet).
 *
 * Every interactive element type is defined ONCE in src/components/ui (and
 * animations once in src/styles/motion.css). This lint flags any element
 * recomposed outside the design system. Existing violations are frozen in
 * scripts/ratchet-baselines/ds-atoms.json: any increase fails (blocking), a
 * rule whose baseline reaches 0 is therefore a hard error. See docs/design-system-lint.md.
 *
 * Escape hatch (reviewed): `ds-atoms-allow: <rule> — reason` comment on the line or the line above.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runRatchetCli } from "./lib/ratchetCli.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIPPED_DIRS = new Set(["src/tests", "src/data", "src/dev"]);
const UI_DIR = "src/components/ui/";
const MOTION_FILES = new Set(["src/styles/motion.css", "src/styles/keyframes.css"]);

const outsideUi = (f) => !f.startsWith(UI_DIR);
const isJsx = (f) => /\.jsx?$/.test(f);
const isCss = (f) => f.endsWith(".css");

export const RULES = {
  "raw-button": {
    applies: (f) => isJsx(f) && outsideUi(f),
    re: /<button\b/g,
    hint: "Use <Button>, <IconButton> or <PanelCloseButton> from src/components/ui.",
  },
  "raw-input": {
    applies: (f) => isJsx(f) && outsideUi(f),
    re: /<(input|select|textarea)\b/g,
    hint: "Use <TextField>, <Slider>, <Switch> or <OptionGroup> from src/components/ui.",
  },
  "raw-dialog": {
    applies: (f) => isJsx(f) && outsideUi(f),
    re: /<dialog\b|role=["']dialog["']|aria-modal=/g,
    hint: "Use <Dialog> (+ DialogTitle, validate button, close cross) from src/components/ui/Dialog.jsx.",
  },
  "local-keyframes": {
    applies: (f) => isCss(f) && outsideUi(f) && !MOTION_FILES.has(f),
    re: /@keyframes\s+[\w-]+/g,
    hint: "Define animations once in src/styles/motion.css (or inside a ui/ primitive).",
  },
  "adhoc-atom-class": {
    applies: (f) => isCss(f) && outsideUi(f),
    re: /^[^{}@/\n;]*\.[\w-]*-(btn|button|modal|slider|toggle|switch|card)(?![\w-])[^;{}\n]*[{,][ \t]*$/gm,
    hint: "Do not restyle a button/modal/slider/toggle locally: add a variant/size to the ui/ primitive.",
  },
};

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (e.isDirectory()) {
      if (!SKIPPED_DIRS.has(rel)) out.push(...walk(full));
    } else if (!/\.test\.[^.]+$/.test(e.name) && /\.(css|jsx?)$/.test(e.name)) out.push(rel);
  }
  return out;
}

export function scanSource(file, text) {
  const lines = text.split("\n");
  const lineAt = (idx) => text.slice(0, idx).split("\n").length;
  const found = [];
  for (const [rule, def] of Object.entries(RULES)) {
    if (!def.applies(file)) continue;
    for (const m of text.matchAll(def.re)) {
      const line = lineAt(m.index);
      if (isJsx(file) && /^\s*(\/\/|\*|\/\*)/.test(lines[line - 1])) continue;
      const ctx = `${lines[line - 2] || ""}\n${lines[line - 1] || ""}`;
      if (ctx.includes(`ds-atoms-allow: ${rule}`)) continue;
      found.push({ rule, file, line, excerpt: lines[line - 1].trim().slice(0, 120) });
    }
  }
  return found;
}

async function collect() {
  const violations = [];
  const counts = Object.fromEntries(Object.keys(RULES).map((r) => [r, {}]));
  for (const f of walk(path.join(ROOT, "src"))) {
    for (const v of scanSource(f, fs.readFileSync(path.join(ROOT, f), "utf8"))) {
      violations.push(v);
      counts[v.rule][v.file] = (counts[v.rule][v.file] || 0) + 1;
    }
  }
  return { violations, counts };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = await runRatchetCli({
    name: "check-ds-atoms",
    npmScript: "check:ds",
    root: ROOT,
    baselineFile: path.join(ROOT, "scripts/ratchet-baselines/ds-atoms.json"),
    rules: RULES,
    failMessage:
      "Component recomposed outside the design system. Use the ui/ primitive, or add `ds-atoms-allow: <rule> — reason`. Never raise the baseline.",
    formatViolation: (v) => `${v.file}:${v.line}  [${v.rule}]  ${v.excerpt}`,
    collect,
  });
}
