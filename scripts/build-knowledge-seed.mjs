#!/usr/bin/env node
/**
 * Génère la migration de seed SQL (supabase/migrations/20261031190000_conquest_knowledge_seed.sql)
 * à partir de data/knowledge/questions.json (uniquement needsReview = false).
 * Les questions ne sont servies au client que via les RPC d'escalade (jamais de pack public).
 *
 * Usage : node scripts/build-knowledge-seed.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { countryDataMap } from "../src/data/gameData.js";

const QUESTIONS_PATH = fileURLToPath(new URL("../data/knowledge/questions.json", import.meta.url));
const SEED_SQL_PATH = fileURLToPath(
  new URL("../supabase/migrations/20261031190000_conquest_knowledge_seed.sql", import.meta.url)
);

const q = (value) => `'${String(value ?? "").replace(/'/g, "''")}'`;

const entries = JSON.parse(readFileSync(QUESTIONS_PATH, "utf8"));

const isoToCountryId = new Map();
for (const [countryId, data] of Object.entries(countryDataMap)) {
  if (data?.iso2) isoToCountryId.set(data.iso2, countryId);
}

const items = (list) => (list || []).map(({ label, iconId }) => ({ label, iconId }));

/** Splits a question into what the client may see (display) and the server-only solution. */
function toColumns(item) {
  switch (item.answerType) {
    case "text":
      return { display: {}, answer: { aliases: [item.answer, ...(item.aliases || [])] } };
    case "number":
      return {
        display: { min: item.min, max: item.max, step: item.step, unit: item.unit || "" },
        answer: { value: item.answer, tolerance: item.tolerance },
      };
    case "order":
      return {
        display: { items: items(item.items) },
        answer: { order: item.items.map((i) => i.label) },
      };
    default:
      return {
        display: { items: items(item.choices) },
        answer: { label: item.choices[item.answerIndex].label },
      };
  }
}

// Seed SQL côté serveur (solutions comprises, jamais exposées au client).
const sqlRows = [];
for (const entry of [...entries].sort((a, b) => String(a.iso).localeCompare(String(b.iso)))) {
  const countryId = isoToCountryId.get(entry.iso);
  if (!countryId) continue;
  for (const item of entry.questions || []) {
    if (item.needsReview !== false) continue;
    const { display, answer } = toColumns(item);
    sqlRows.push(
      `  (${q(item.id)}, ${q(countryId)}, ${q(item.category)}, ${q(item.answerType)}, ${q(item.prompt)}, ${q(JSON.stringify(display))}::jsonb, ${q(JSON.stringify(answer))}::jsonb, ${item.sourceUrl ? q(item.sourceUrl) : "NULL"}, true)`
    );
  }
}

const sql = `-- Généré par scripts/build-knowledge-seed.mjs — ne pas éditer à la main.
-- Seed de l'escalade de connaissances Conquête : ${sqlRows.length} questions (needsReview = false).

INSERT INTO public.conquest_knowledge_questions
  (id, country_id, category, answer_type, prompt, display, answer, source_url, active)
VALUES
${sqlRows.join(",\n")}
ON CONFLICT (id) DO UPDATE
  SET country_id = EXCLUDED.country_id,
      category = EXCLUDED.category,
      answer_type = EXCLUDED.answer_type,
      prompt = EXCLUDED.prompt,
      display = EXCLUDED.display,
      answer = EXCLUDED.answer,
      source_url = EXCLUDED.source_url,
      active = EXCLUDED.active;
`;

writeFileSync(SEED_SQL_PATH, sql);
console.log(`Wrote ${SEED_SQL_PATH} (${sqlRows.length} server questions)`);
