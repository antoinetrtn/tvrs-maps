#!/usr/bin/env node
/**
 * Valide data/knowledge/questions.json contre les pays de src/data/gameData.js.
 * Usage : node scripts/validate-knowledge.mjs
 */
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { countryDataMap } from "../src/data/gameData.js";
import { validateKnowledgeDataset } from "./lib/knowledgeRules.mjs";

const QUESTIONS_PATH = fileURLToPath(new URL("../data/knowledge/questions.json", import.meta.url));

const entries = JSON.parse(readFileSync(QUESTIONS_PATH, "utf8"));
const expectedIsos = Object.values(countryDataMap)
  .map((c) => c.iso2)
  .filter(Boolean);

const summary = validateKnowledgeDataset(entries, expectedIsos);
console.log(JSON.stringify(summary, null, 2));

if (summary.erreurs.length > 0) {
  process.exit(1);
}
