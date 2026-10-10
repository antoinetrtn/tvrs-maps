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
