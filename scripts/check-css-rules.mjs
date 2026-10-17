#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { RULES, scanSource } from "./lib/cssRulesScan.mjs";
import { runRatchetCli } from "./lib/ratchetCli.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIPPED_DIRS = new Set(["src/tests", "src/data"]);

function walkSourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(rel)) files.push(...walkSourceFiles(full));
    } else if (
      entry.isFile() &&
      !/\.test\.[^.]+$/.test(entry.name) &&
      /\.(css|jsx?)$/.test(entry.name)
    ) {
      files.push(rel);
    }
  }
  return files;
}

async function collect() {
  const violations = [];
  const counts = Object.fromEntries(Object.keys(RULES).map((rule) => [rule, {}]));
  for (const relFile of walkSourceFiles(path.join(ROOT, "src"))) {
    const text = fs.readFileSync(path.join(ROOT, relFile), "utf8");
    for (const v of scanSource(relFile, text)) {
      violations.push(v);
      counts[v.rule][v.file] = (counts[v.rule][v.file] || 0) + 1;
    }
  }
  return { violations, counts };
}

process.exitCode = await runRatchetCli({
  name: "check-css-rules",
  npmScript: "check:css-rules",
  root: ROOT,
  baselineFile: path.join(ROOT, "scripts/ratchet-baselines/css-rules.json"),
  rules: RULES,
  failMessage:
    "Fix them, or add /* css-rules-allow: <rule> — reason */. Never raise the baseline just to pass.",
  formatViolation: (v) => `${v.file}:${v.line}  [${v.rule}]  ${v.excerpt}`,
  collect,
});
