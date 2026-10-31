import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { diffCounts, formatSummaryTable, loadBaseline, writeBaseline } from "./ratchet.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  const options = { update: false, allowIncrease: false, list: false, rule: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--update") options.update = true;
    else if (arg === "--allow-increase") options.allowIncrease = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--rule" && i + 1 < argv.length) {
      options.rule = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

function updateBaseline(cfg, counts, diff, options) {
  if (diff.increases.length > 0 && !options.allowIncrease && fs.existsSync(cfg.baselineFile)) {
    console.error("Baseline count increase refused without --allow-increase.");
    return 1;
  }
  writeBaseline(cfg.baselineFile, counts);
  console.log(`Baseline updated at ${path.relative(cfg.root, cfg.baselineFile)}.`);
  return 0;
}

function reportIncreases(cfg, increases, violations) {
  console.log("\nViolations increased compared to baseline:\n");
  for (const inc of increases) {
    const matched = violations.filter((v) => v.rule === inc.rule && v.file === inc.file);
    for (const v of matched) {
      console.log(cfg.formatViolation(v));
      const hint = cfg.rules?.[inc.rule]?.hint;
      if (hint) console.log(`  Hint: ${hint}`);
    }
  }
  console.error(`\n${cfg.failMessage}\n`);
}

function reportDecreases(cfg, decreases) {
  const total = decreases.reduce((acc, d) => acc + (d.from - d.to), 0);
  console.log(
    `\n✔ ${total} violations fewer than the baseline — run \`npm run ${cfg.npmScript} -- --update\` to lock the progress\n`
  );
}

/**
 * Shared ratchet CLI. cfg = { name, npmScript, root, baselineFile, rules?, failMessage,
 * formatViolation(v), collect(): Promise<{violations, counts}>, precheck?(violations): number }.
 * Returns the process exit code.
 */
export async function runRatchetCli(cfg, argv) {
  const options = parseArgs(argv);
  const { violations, counts } = await cfg.collect();
  const baseline = loadBaseline(cfg.baselineFile);
  const diff = diffCounts(counts, baseline);

  const precheckCode = cfg.precheck ? cfg.precheck(violations) : 0;
  if (precheckCode !== 0) return precheckCode;

  if (options.update) return updateBaseline(cfg, counts, diff, options);
  if (options.list) {
    const shown = options.rule ? violations.filter((v) => v.rule === options.rule) : violations;
    shown.forEach((v) => console.log(cfg.formatViolation(v)));
    return 0;
  }
  if (options.json) {
    console.log(JSON.stringify({ counts, diff }, null, 2));
    return diff.increases.length > 0 ? 1 : 0;
  }

  console.log(formatSummaryTable(counts, baseline, cfg.rules));
  if (diff.increases.length > 0) {
    reportIncreases(cfg, diff.increases, violations);
    return 1;
  }
  if (diff.decreases.length > 0) reportDecreases(cfg, diff.decreases);
  else console.log(`\n[${cfg.name}] OK — all rules within baseline.\n`);
  return 0;
}
