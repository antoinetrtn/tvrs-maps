#!/usr/bin/env node
/**
 * check-tokens.mjs — design-token consistency guard.
 *
 * Two sources define CSS custom properties:
 *   1. src/index.css        (static :root — what the browser sees on first paint)
 *   2. designSystem.js      (getThemeCssVariables — injected inline at runtime,
 *                            always wins after React mounts)
 *
 * Checks (exit 1 on failure):
 *   A. GHOST TOKENS — every var(--x) consumed in src CSS must be defined
 *      somewhere: static CSS, getThemeCssVariables output, or a JS/JSX
 *      inline-style definition ("--x": … / setProperty("--x", …)).
 *      Catches bugs like --info / --purple / --radius-xs (referenced but
 *      never defined -> silently dead styling). A var() WITHOUT fallback on
 *      an undefined token invalidates its whole declaration -> FAILURE; an
 *      undefined token whose every usage carries a fallback is valid CSS
 *      (inline-custom-prop pattern) -> warning only.
 *   B. DARK SYNC — tokens defined in BOTH the :root of index.css and the
 *      default runtime output (dark + blackout, uiScale 1) must have equal
 *      values, so first paint matches the mounted app (index.css's own
 *      stated contract).
 *
 * Warnings (non-blocking):
 *   - tokens emitted by getThemeCssVariables but absent from :root
 *     (undefined until React mounts).
 *
 * The [data-theme="light"] block is NOT value-compared: runtime inline vars
 * shadow it entirely for every JS-emitted token, and its remaining CSS-only
 * tokens have no JS counterpart.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getThemeCssVariables } from "../src/config/designSystem.js";

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));

const walk = (dir, exts) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
};

// Preserve newlines so reported line numbers match the real file.
const stripComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""));

/** Extract the body of the first `selector { … }` block (brace-balanced). */
const extractBlock = (css, selectorRe) => {
  const match = selectorRe.exec(css);
  if (!match) return "";
  let depth = 0;
  const start = css.indexOf("{", match.index);
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  return "";
};

/** name -> value map from a rule body (values may span lines / contain "()"). */
const parseDeclarations = (body) => {
  const map = new Map();
  let parenDepth = 0;
  let current = "";
  const decls = [];
  for (const char of body) {
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (char === ";" && parenDepth === 0) {
      decls.push(current);
      current = "";
    } else current += char;
  }
  decls.push(current);
  for (const decl of decls) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const name = decl.slice(0, idx).trim();
    if (name.startsWith("--")) map.set(name, decl.slice(idx + 1).trim());
  }
  return map;
};

const normalize = (value) => String(value).replace(/\s+/g, "").toLowerCase();

// ---- Collect sources ------------------------------------------------------
const cssFiles = walk(SRC_DIR, [".css"]);
const jsFiles = walk(SRC_DIR, [".js", ".jsx"]);

const cssDefined = new Set();
const cssUsed = new Map(); // name -> [file:line, …]

for (const file of cssFiles) {
  const css = stripComments(readFileSync(file, "utf8"));
  for (const m of css.matchAll(/(?:^|[^\w-])(--[a-zA-Z][\w-]*)\s*:/g)) {
    cssDefined.add(m[1]);
  }
  const lines = css.split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
      const entry = cssUsed.get(m[1]) || { refs: [], bareUsage: false };
      entry.refs.push(`${file.replace(SRC_DIR, "src")}:${i + 1}`);
      if (!m[2]) entry.bareUsage = true;
      cssUsed.set(m[1], entry);
    }
  });
}

const jsDefined = new Set();
for (const file of jsFiles) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/["'](--[a-zA-Z][\w-]*)["']\s*:/g)) jsDefined.add(m[1]);
  for (const m of src.matchAll(/setProperty\(\s*["'](--[a-zA-Z][\w-]*)["']/g)) jsDefined.add(m[1]);
}

const runtimeVars = getThemeCssVariables("dark", "blackout", { uiScale: 1 });
const runtimeDefined = new Set(Object.keys(runtimeVars));

const indexCss = stripComments(readFileSync(join(SRC_DIR, "index.css"), "utf8"));
const rootMap = parseDeclarations(extractBlock(indexCss, /:root\s*\{/));

// ---- Check A: ghost tokens ------------------------------------------------
const failures = [];
const warnings = [];
for (const [name, { refs, bareUsage }] of [...cssUsed].sort()) {
  if (cssDefined.has(name) || jsDefined.has(name) || runtimeDefined.has(name)) continue;
  const detail = `${name} — consumed but defined nowhere:\n    ${refs.join("\n    ")}`;
  if (bareUsage) failures.push(`GHOST TOKEN ${detail}`);
  else warnings.push(`ghost token (fallback-only usage) ${detail}`);
}

// ---- Check B: :root vs runtime dark sync ----------------------------------
for (const [name, cssValue] of [...rootMap].sort()) {
  if (!(name in runtimeVars)) continue;
  if (normalize(cssValue) !== normalize(runtimeVars[name])) {
    failures.push(
      `DARK DRIFT ${name} — index.css :root has "${cssValue}" but getThemeCssVariables(dark) emits "${runtimeVars[name]}"`
    );
  }
}

// ---- Warnings: runtime-only tokens ----------------------------------------
const runtimeOnly = [...runtimeDefined].filter((name) => !rootMap.has(name)).sort();

if (runtimeOnly.length > 0) {
  console.log(
    `[check-tokens] note: ${runtimeOnly.length} tokens are runtime-only (undefined before React mounts):`
  );
  console.log(`  ${runtimeOnly.join(", ")}`);
}

for (const warning of warnings) console.log(`[check-tokens] warning: ${warning}`);

if (failures.length > 0) {
  console.error(`\n[check-tokens] FAILED — ${failures.length} problem(s):\n`);
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `[check-tokens] OK — ${cssUsed.size} tokens consumed, ${rootMap.size} :root defaults, ` +
    `${runtimeDefined.size} runtime vars, no ghosts, no dark drift.`
);
