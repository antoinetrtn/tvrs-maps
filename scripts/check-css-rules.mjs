#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { RULES, scanSource } from "./lib/cssRulesScan.mjs";
import { diffCounts, formatSummaryTable, loadBaseline, writeBaseline } from "./lib/ratchet.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_FILE = path.join(ROOT, "scripts/ratchet-baselines/css-rules.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    update: false,
    allowIncrease: false,
    list: false,
    rule: null,
    json: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--update") options.update = true;
    else if (arg === "--allow-increase") options.allowIncrease = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--rule" && i + 1 < args.length) {
      options.rule = args[i + 1];
      i += 1;
    }
  }
  return options;
}

function walkSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (
        rel === "src/tests" ||
        rel.startsWith("src/tests/") ||
        rel === "src/data" ||
        rel.startsWith("src/data/")
      ) {
        continue;
      }
      files.push(...walkSourceFiles(full));
    } else if (entry.isFile()) {
      if (/\.test\.[^.]+$/.test(entry.name)) continue;
      if (/\.(css|js|jsx)$/.test(entry.name)) files.push(rel);
    }
  }
  return files;
}

function collectViolations(files) {
  const violations = [];
  const counts = {};
  for (const rule of Object.keys(RULES)) counts[rule] = {};

  for (const relFile of files) {
    const fullPath = path.join(ROOT, relFile);
    const text = fs.readFileSync(fullPath, "utf8");
    const fileViolations = scanSource(relFile, text);
    for (const v of fileViolations) {
      violations.push(v);
      counts[v.rule][v.file] = (counts[v.rule][v.file] || 0) + 1;
    }
  }
  return { violations, counts };
}

function handleList(violations, ruleFilter) {
  const filtered = ruleFilter ? violations.filter((v) => v.rule === ruleFilter) : violations;
  for (const v of filtered) {
    console.log(`${v.file}:${v.line}  [${v.rule}]  ${v.excerpt}`);
  }
}

function handleUpdate(baseline, currentCounts, allowIncrease, diff) {
  const baselineExists = fs.existsSync(BASELINE_FILE);
  if (diff.increases.length > 0 && !allowIncrease && baselineExists) {
    console.error("Baseline count increase refused without --allow-increase.");
    process.exit(1);
  }
  writeBaseline(BASELINE_FILE, currentCounts);
  console.log(`Baseline updated at ${path.relative(ROOT, BASELINE_FILE)}.`);
  process.exit(0);
}

function handleIncreases(increases, violations) {
  console.log("\nViolations increased compared to baseline:\n");
  for (const inc of increases) {
    const matched = violations.filter((v) => v.rule === inc.rule && v.file === inc.file);
    for (const v of matched) {
      console.log(`${v.file}:${v.line}  [${v.rule}]  ${v.excerpt}`);
      console.log(`  Hint: ${RULES[inc.rule]?.hint || ""}`);
    }
  }
  console.error(
    "\nFix them, or add /* css-rules-allow: <rule> — reason */. Never raise the baseline just to pass.\n"
  );
  process.exit(1);
}

function main() {
  const options = parseArgs();
  const files = walkSourceFiles(path.join(ROOT, "src"));
  const { violations, counts } = collectViolations(files);
  const baseline = loadBaseline(BASELINE_FILE);
  const diff = diffCounts(counts, baseline);

  if (options.update) {
    handleUpdate(baseline, counts, options.allowIncrease, diff);
  }

  if (options.list) {
    handleList(violations, options.rule);
    process.exit(0);
  }

  if (options.json) {
    console.log(JSON.stringify({ counts, diff }, null, 2));
    process.exit(diff.increases.length > 0 ? 1 : 0);
  }

  console.log(formatSummaryTable(counts, baseline, RULES));

  if (diff.increases.length > 0) {
    handleIncreases(diff.increases, violations);
  }

  if (diff.decreases.length > 0) {
    const totalDec = diff.decreases.reduce((acc, d) => acc + (d.from - d.to), 0);
    console.log(
      `\n✔ ${totalDec} violations fewer than the baseline — run \`npm run check:css-rules -- --update\` to lock the progress\n`
    );
    process.exit(0);
  }

  console.log("\n[check-css-rules] OK — all rules within baseline.\n");
  process.exit(0);
}

main();
