// Diète des données cartographiques : `npm run build:geodata`
//
// Lit les sources conservées dans `data-src/geodata/` (fichiers d'origine, non servis)
// et écrit les GeoJSON compacts servis par l'app dans `public/data/` :
//   - coordonnées arrondies (DECIMALS) — 3 décimales ≈ 110 m, très en dessous de la
//     résolution (50 m / 1000 m / US 20 m) et du pixel d'écran à l'altitude maximale ;
//   - points consécutifs identiques supprimés après arrondi (anneaux restant fermés) ;
//   - propriétés réduites à celles que le code lit réellement (voir KEEP_PROPERTIES) ;
//   - JSON compact (sans indentation), sortie déterministe.
// Les données restent au format GeoJSON : aucun changement de code de rendu.
//
// Usage :
//   node scripts/build-geodata.mjs            écrit public/data/*
//   node scripts/build-geodata.mjs --check    échoue si public/data/* n'est pas à jour
//   node scripts/build-geodata.mjs --stats    affiche les tailles (brut / gzip / brotli)
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "data-src", "geodata");
const OUT_DIR = path.join(ROOT, "public", "data");

/**
 * Propriétés conservées par jeu de données. Elles sont lues par :
 *  - `getFeatureAdmin` (src/utils/utils.js) : code | ADMIN | name | NAME ;
 *  - `useGeoData` : ADMIN (fusion Somalie / Somaliland) ;
 *  - useGlobePolygons / polygonColorResolver : properties.region (repli) ;
 *  - tests de géométrie (nom lisible). `ISO_A3` reste comme identifiant stable
 *    (outillage, débogage) : quelques octets par pays.
 */
export const DATASETS = [
  {
    src: "countries-50m-low.source.json",
    out: "countries-50m-low.json",
    decimals: 3,
    keepProperties: ["ADMIN", "ISO_A3"],
    keepFeatureKeys: ["type", "geometry", "properties"],
  },
  {
    src: "departements-1000m.source.geojson",
    out: "departements-1000m.geojson",
    decimals: 3,
    keepProperties: ["code", "nom", "region"],
    keepFeatureKeys: ["type", "geometry", "properties"],
  },
  {
    src: "us-states.source.json",
    out: "us-states.json",
    decimals: 3,
    keepProperties: ["name"],
    keepFeatureKeys: ["type", "id", "geometry", "properties"],
  },
];

const round = (v, factor) => {
  const r = Math.round(v * factor) / factor;
  return Object.is(r, -0) ? 0 : r;
};

/** Arrondit un anneau, retire les doublons consécutifs, garde la fermeture. */
function simplifyRing(ring, factor) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [round(x, factor), round(y, factor)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length && (first[0] !== last[0] || first[1] !== last[1])) out.push([...first]);
  return out;
}

/** Un anneau valide a au moins 4 positions (triangle fermé). */
const isValidRing = (ring) => ring.length >= 4;

function simplifyPolygon(rings, factor, stats) {
  const [outer, ...holes] = rings.map((r) => simplifyRing(r, factor));
  if (!isValidRing(outer)) {
    stats.droppedPolygons += 1;
    return null;
  }
  const keptHoles = holes.filter(isValidRing);
  stats.droppedHoles += holes.length - keptHoles.length;
  return [outer, ...keptHoles];
}

function simplifyGeometry(geometry, factor, stats) {
  if (geometry.type === "Polygon") {
    const poly = simplifyPolygon(geometry.coordinates, factor, stats);
    return poly ? { type: "Polygon", coordinates: poly } : null;
  }
  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates
      .map((p) => simplifyPolygon(p, factor, stats))
      .filter(Boolean);
    if (!polys.length) return null;
    return polys.length === 1
      ? { type: "Polygon", coordinates: polys[0] }
      : { type: "MultiPolygon", coordinates: polys };
  }
  throw new Error(`Type de géométrie non géré : ${geometry.type}`);
}

/** Construit un jeu de données en mémoire. Retourne { text, stats }. */
export function buildDataset(config, srcDir = SRC_DIR) {
  const source = JSON.parse(fs.readFileSync(path.join(srcDir, config.src), "utf8"));
  const factor = 10 ** config.decimals;
  const stats = { features: source.features.length, droppedPolygons: 0, droppedHoles: 0 };
  const features = source.features.map((feature) => {
    const geometry = simplifyGeometry(feature.geometry, factor, stats);
    const name = feature.properties?.[config.keepProperties[0]] ?? feature.id;
    if (!geometry) throw new Error(`Entité sans géométrie après arrondi : ${name}`);
    const properties = {};
    for (const key of config.keepProperties) {
      if (feature.properties && key in feature.properties)
        properties[key] = feature.properties[key];
    }
    const next = {};
    for (const key of config.keepFeatureKeys) {
      if (key === "geometry") next.geometry = geometry;
      else if (key === "properties") next.properties = properties;
      else if (key in feature) next[key] = feature[key];
    }
    return next;
  });
  const text = JSON.stringify({ type: "FeatureCollection", features });
  return { text, stats };
}

const fmt = (n) => `${(n / 1024).toFixed(1)} Ko`;

function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");
  let stale = 0;
  for (const config of DATASETS) {
    const { text, stats } = buildDataset(config);
    const outPath = path.join(OUT_DIR, config.out);
    if (check) {
      const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : null;
      if (current !== text) {
        stale += 1;
        console.error(`✗ ${config.out} n'est pas à jour : lancer \`npm run build:geodata\``);
      } else console.log(`✓ ${config.out} à jour`);
      continue;
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(outPath, text);
    const raw = Buffer.byteLength(text);
    const srcRaw = fs.statSync(path.join(SRC_DIR, config.src)).size;
    const line = `${config.out}: ${fmt(srcRaw)} → ${fmt(raw)}`;
    const extra = ` (polygones écartés : ${stats.droppedPolygons}, trous écartés : ${stats.droppedHoles})`;
    console.log(line + extra);
    if (args.has("--stats")) {
      const buf = Buffer.from(text);
      const srcBuf = fs.readFileSync(path.join(SRC_DIR, config.src));
      const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
      const br = (b) => zlib.brotliCompressSync(b).length;
      console.log(
        `   gzip ${fmt(gz(srcBuf))} → ${fmt(gz(buf))} · brotli ${fmt(br(srcBuf))} → ${fmt(br(buf))}`
      );
    }
  }
  if (stale) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
