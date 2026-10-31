#!/usr/bin/env node
/**
 * Génère la migration de seed du mode Conquête (pays + alias acceptés) à partir
 * de src/data/gameData.js. Les alias bruts sont normalisés côté Postgres par
 * conquest_normalize(), la même fonction qui normalise les réponses.
 *
 * Usage : node scripts/generate-conquest-seed.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { countryDataMap } from "../src/data/gameData.js";

const OUT = fileURLToPath(
  new URL("../supabase/migrations/20261010190100_conquest_seed_countries.sql", import.meta.url)
);

const q = (value) => `'${String(value ?? "").replace(/'/g, "''")}'`;

const countries = [];
const aliases = [];
for (const [countryId, data] of Object.entries(countryDataMap).sort(([a], [b]) =>
  a.localeCompare(b)
)) {
  const nameEn = data.name_en || countryId;
  const nameFr = data.name_fr || nameEn;
  countries.push(`  (${q(countryId)}, ${q(nameEn)}, ${q(nameFr)}, ${q(data.region || "")})`);
  const raw = new Set([countryId, nameEn, nameFr, ...(data.aliases || [])]);
  for (const alias of raw) aliases.push(`  (${q(alias)}, ${q(countryId)})`);
}

const sql = `-- Généré par scripts/generate-conquest-seed.mjs — ne pas éditer à la main.
-- Seed du référentiel Conquête : ${countries.length} pays, ${aliases.length} alias bruts.

INSERT INTO public.conquest_countries (country_id, name_en, name_fr, region) VALUES
${countries.join(",\n")}
ON CONFLICT (country_id) DO UPDATE
  SET name_en = EXCLUDED.name_en, name_fr = EXCLUDED.name_fr, region = EXCLUDED.region;

INSERT INTO public.conquest_country_aliases (alias_norm, country_id)
SELECT DISTINCT public.conquest_normalize(raw), country_id
  FROM (VALUES
${aliases.join(",\n")}
  ) AS v (raw, country_id)
 WHERE public.conquest_normalize(raw) <> ''
ON CONFLICT DO NOTHING;
`;

writeFileSync(OUT, sql);
console.log(`Wrote ${OUT} (${countries.length} countries, ${aliases.length} aliases)`);

// Phase 2 : codes ISO (défis drapeau) et capitales (défis capitale).
const OUT_PHASE2 = fileURLToPath(
  new URL("../supabase/migrations/20261010220100_conquest_seed_capitals.sql", import.meta.url)
);
const meta = [];
const capitals = [];
for (const [countryId, data] of Object.entries(countryDataMap).sort(([a], [b]) =>
  a.localeCompare(b)
)) {
  meta.push(
    `  (${q(countryId)}, ${q(data.iso2 || "")}, ${q(data.capital || "")}, ${q(data.capital_fr || data.capital || "")})`
  );
  for (const capital of new Set([data.capital, data.capital_fr].filter(Boolean))) {
    capitals.push(`  (${q(capital)}, ${q(countryId)})`);
  }
}

const sqlPhase2 = `-- Généré par scripts/generate-conquest-seed.mjs — ne pas éditer à la main.
-- Seed phase 2 du mode Conquête : ISO2 + capitales (${capitals.length} alias bruts).

UPDATE public.conquest_countries AS c
   SET iso2 = nullif(v.iso2, ''), capital_en = nullif(v.capital_en, ''),
       capital_fr = nullif(v.capital_fr, '')
  FROM (VALUES
${meta.join(",\n")}
  ) AS v (country_id, iso2, capital_en, capital_fr)
 WHERE c.country_id = v.country_id;

INSERT INTO public.conquest_capital_aliases (alias_norm, country_id)
SELECT DISTINCT public.conquest_normalize(raw), country_id
  FROM (VALUES
${capitals.join(",\n")}
  ) AS v (raw, country_id)
 WHERE public.conquest_normalize(raw) <> ''
ON CONFLICT DO NOTHING;
`;

writeFileSync(OUT_PHASE2, sqlPhase2);
console.log(`Wrote ${OUT_PHASE2} (${capitals.length} capital aliases)`);
