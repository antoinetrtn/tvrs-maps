import fs from "node:fs";
import path from "node:path";

const byName = (a, b) => a.localeCompare(b);

/**
 * Compare current violation counts against baseline counts.
 * Both current and baseline are { [rule: string]: { [file: string]: number } }.
 * Returns { increases: [{rule, file, from, to}], decreases: [{rule, file, from, to}] }.
 */
export function diffCounts(current, baseline) {
  const increases = [];
  const decreases = [];

  const allRules = new Set([...Object.keys(current || {}), ...Object.keys(baseline || {})]);

  for (const rule of [...allRules].sort(byName)) {
    const currentFiles = current?.[rule] || {};
    const baselineFiles = baseline?.[rule] || {};
    const allFiles = new Set([...Object.keys(currentFiles), ...Object.keys(baselineFiles)]);

    for (const file of [...allFiles].sort(byName)) {
      const to = currentFiles[file] ?? 0;
      const from = baselineFiles[file] ?? 0;

      if (to > from) {
        increases.push({ rule, file, from, to });
      } else if (to < from) {
        decreases.push({ rule, file, from, to });
      }
    }
  }

  return { increases, decreases };
}

/**
 * Load baseline JSON from path. Missing file => {}.
 */
export function loadBaseline(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Write baseline JSON with sorted keys, 2-space indentation, trailing newline.
 * Zero counts are omitted; rules with no remaining positive counts are omitted.
 */
export function writeBaseline(filePath, counts) {
  const clean = {};
  for (const rule of Object.keys(counts || {}).sort(byName)) {
    const fileEntries = Object.entries(counts[rule] || {})
      .filter(([, count]) => typeof count === "number" && count > 0)
      .sort(([a], [b]) => byName(a, b));
    if (fileEntries.length > 0) {
      clean[rule] = Object.fromEntries(fileEntries);
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(clean, null, 2) + "\n", "utf8");
}

/**
 * Formats a compact per-rule summary table: rule | total now | total baseline | Δ
 */
export function formatSummaryTable(current, baseline, rulesCatalog = {}) {
  const allRules = new Set([
    ...Object.keys(rulesCatalog),
    ...Object.keys(current || {}),
    ...Object.keys(baseline || {}),
  ]);

  const rows = [];
  let sumNow = 0;
  let sumBaseline = 0;

  for (const rule of [...allRules].sort(byName)) {
    const now = Object.values(current?.[rule] || {}).reduce((a, b) => a + b, 0);
    const base = Object.values(baseline?.[rule] || {}).reduce((a, b) => a + b, 0);
    const delta = now - base;
    sumNow += now;
    sumBaseline += base;
    rows.push({ rule, now, base, delta });
  }

  const maxRuleLen = Math.max(4, ...rows.map((r) => r.rule.length));
  const pad = (str, len) => String(str).padEnd(len);
  const padLeft = (str, len) => String(str).padStart(len);

  const lines = [
    `${pad("Rule", maxRuleLen)} | ${padLeft("Total now", 9)} | ${padLeft("Baseline", 8)} | ${padLeft("Δ", 4)}`,
    `${"-".repeat(maxRuleLen)}-+-----------+----------+------`,
  ];

  for (const r of rows) {
    const deltaStr = r.delta > 0 ? `+${r.delta}` : `${r.delta}`;
    lines.push(
      `${pad(r.rule, maxRuleLen)} | ${padLeft(r.now, 9)} | ${padLeft(r.base, 8)} | ${padLeft(deltaStr, 4)}`
    );
  }

  const totalDelta = sumNow - sumBaseline;
  const totalDeltaStr = totalDelta > 0 ? `+${totalDelta}` : `${totalDelta}`;
  lines.push(
    `${"-".repeat(maxRuleLen)}-+-----------+----------+------`,
    `${pad("Total", maxRuleLen)} | ${padLeft(sumNow, 9)} | ${padLeft(sumBaseline, 8)} | ${padLeft(totalDeltaStr, 4)}`
  );

  return lines.join("\n");
}
