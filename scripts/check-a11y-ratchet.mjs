#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

import { runRatchetCli } from "./lib/ratchetCli.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const formatViolation = (v) => `${v.file}:${v.line}:${v.column}  [${v.rule}]  ${v.message}`;

async function collect() {
  const results = await new ESLint().lintFiles(["src"]);
  const violations = [];
  const counts = {};
  for (const res of results) {
    const file = path.relative(ROOT, res.filePath).split(path.sep).join("/");
    for (const msg of res.messages) {
      if (!msg.ruleId?.startsWith("jsx-a11y/")) continue;
      violations.push({
        rule: msg.ruleId,
        file,
        line: msg.line || 1,
        column: msg.column || 1,
        severity: msg.severity,
        message: msg.message,
      });
      counts[msg.ruleId] ??= {};
      counts[msg.ruleId][file] = (counts[msg.ruleId][file] || 0) + 1;
    }
  }
  return { violations, counts };
}

function failOnErrors(violations) {
  const errors = violations.filter((v) => v.severity === 2);
  if (errors.length === 0) return 0;
  console.error("JSX-A11Y error (severity 2) detected! All jsx-a11y errors must stay at 0:\n");
  errors.forEach((err) => console.error(formatViolation(err)));
  return 1;
}

process.exitCode = await runRatchetCli({
  name: "check-a11y-ratchet",
  npmScript: "check:a11y",
  root: ROOT,
  baselineFile: path.join(ROOT, "scripts/ratchet-baselines/a11y.json"),
  failMessage: "Fix increased accessibility violations. Baseline cannot be raised.",
  formatViolation,
  collect,
  precheck: failOnErrors,
});
