#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

import { diffCounts, formatSummaryTable, loadBaseline, writeBaseline } from "./lib/ratchet.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_FILE = path.join(ROOT, "scripts/ratchet-baselines/a11y.json");

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

async function runA11yLint() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src"]);
  const violations = [];
  const counts = {};

  for (const res of results) {
    const relFile = path.relative(ROOT, res.filePath).split(path.sep).join("/");
    for (const msg of res.messages) {
      if (msg.ruleId && msg.ruleId.startsWith("jsx-a11y/")) {
        const item = {
          rule: msg.ruleId,
          file: relFile,
          line: msg.line || 1,
          column: msg.column || 1,
          severity: msg.severity,
          message: msg.message,
        };
        violations.push(item);
        if (!counts[msg.ruleId]) counts[msg.ruleId] = {};
        counts[msg.ruleId][relFile] = (counts[msg.ruleId][relFile] || 0) + 1;
      }
    }
  }
  return { violations, counts };
}

function handleList(violations, ruleFilter) {
  const filtered = ruleFilter ? violations.filter((v) => v.rule === ruleFilter) : violations;
  for (const v of filtered) {
    console.log(`${v.file}:${v.line}:${v.column}  [${v.rule}]  ${v.message}`);
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
      console.log(`${v.file}:${v.line}:${v.column}  [${v.rule}]  ${v.message}`);
    }
  }
  console.error("\nFix increased accessibility violations. Baseline cannot be raised.\n");
  process.exit(1);
}

async function main() {
  const options = parseArgs();
  const { violations, counts } = await runA11yLint();
  const baseline = loadBaseline(BASELINE_FILE);
  const diff = diffCounts(counts, baseline);

  const errors = violations.filter((v) => v.severity === 2);
  if (errors.length > 0) {
    console.error("JSX-A11Y error (severity 2) detected! All jsx-a11y errors must stay at 0:\n");
    for (const err of errors) {
      console.error(`${err.file}:${err.line}:${err.column}  [${err.rule}]  ${err.message}`);
    }
    process.exit(1);
  }

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

  console.log(formatSummaryTable(counts, baseline));

  if (diff.increases.length > 0) {
    handleIncreases(diff.increases, violations);
  }

  if (diff.decreases.length > 0) {
    const totalDec = diff.decreases.reduce((acc, d) => acc + (d.from - d.to), 0);
    console.log(
      `\n✔ ${totalDec} violations fewer than the baseline — run \`npm run check:a11y-ratchet -- --update\` to lock the progress\n`
    );
    process.exit(0);
  }

  console.log("\n[check-a11y-ratchet] OK — all rules within baseline.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
