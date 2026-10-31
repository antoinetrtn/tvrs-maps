#!/usr/bin/env node
/**
 * Génère les packs régionaux client (public/quiz/{region}.json, sans les réponses)
 * ainsi que la migration de seed SQL (supabase/migrations/20261031190000_conquest_knowledge_seed.sql)
 * à partir de data/knowledge/questions.json (uniquement needsReview = false).
 *
 * Usage : node scripts/build-knowledge-packs.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { countryDataMap } from "../src/data/gameData.js";
import { buildRegionalClientPacks } from "./lib/knowledgeRules.mjs";

const QUESTIONS_PATH = fileURLToPath(new URL("../data/knowledge/questions.json", import.meta.url));
const QUIZ_OUT_DIR = fileURLToPath(new URL("../public/quiz", import.meta.url));
const SEED_SQL_PATH = fileURLToPath(
  new URL("../supabase/migrations/20261031190000_conquest_knowledge_seed.sql", import.meta.url)
);

const q = (value) => `'${String(value ?? "").replace(/'/g, "''")}'`;

const entries = JSON.parse(readFileSync(QUESTIONS_PATH, "utf8"));

const isoToCountryId = new Map();
for (const [countryId, data] of Object.entries(countryDataMap)) {
  if (data?.iso2) isoToCountryId.set(data.iso2, countryId);
}

// 1. Packs régionaux côté client (sans answerIndex / stableReason / reviewNote).
mkdirSync(QUIZ_OUT_DIR, { recursive: true });
const packs = buildRegionalClientPacks(entries, countryDataMap);
let totalClientQuestions = 0;

for (const [region, list] of [...packs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const outPath = join(QUIZ_OUT_DIR, `${region}.json`);
  writeFileSync(outPath, `${JSON.stringify(list, null, 2)}\n`);
  totalClientQuestions += list.length;
  console.log(`Wrote ${outPath} (${list.length} questions)`);
}

// 2. Seed SQL côté serveur (avec answer_index).
const sqlRows = [];
for (const entry of [...entries].sort((a, b) => String(a.iso).localeCompare(String(b.iso)))) {
  const countryId = isoToCountryId.get(entry.iso);
  if (!countryId) continue;
  for (const item of entry.questions || []) {
    if (item.needsReview !== false) continue;
    const cleanChoices = (item.choices || []).map((c) => ({
      label: c.label,
      iconId: c.iconId,
    }));
    const answerIndex = Number.isInteger(item.answerIndex) ? item.answerIndex : 0;
    const difficulty = [1, 2, 3].includes(item.difficulty) ? item.difficulty : 1;
    sqlRows.push(
      `  (${q(item.id)}, ${q(countryId)}, ${q(item.category)}, ${q(item.prompt)}, ${q(JSON.stringify(cleanChoices))}::jsonb, ${answerIndex}, ${difficulty}, true)`
    );
  }
}

const sql = `-- Généré par scripts/build-knowledge-packs.mjs — ne pas éditer à la main.
-- Seed de l'escalade de connaissances Conquête : ${sqlRows.length} questions (needsReview = false).

INSERT INTO public.conquest_knowledge_questions
  (id, country_id, category, prompt, choices, answer_index, difficulty, active)
VALUES
${sqlRows.join(",\n")}
ON CONFLICT (id) DO UPDATE
  SET country_id = EXCLUDED.country_id,
      category = EXCLUDED.category,
      prompt = EXCLUDED.prompt,
      choices = EXCLUDED.choices,
      answer_index = EXCLUDED.answer_index,
      difficulty = EXCLUDED.difficulty,
      active = EXCLUDED.active;
`;

writeFileSync(SEED_SQL_PATH, sql);
console.log(
  `Wrote ${SEED_SQL_PATH} (${sqlRows.length} server questions, ${totalClientQuestions} client pack questions)`
);
