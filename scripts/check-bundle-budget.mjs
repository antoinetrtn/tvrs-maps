#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

// Measured initial-load JS (index entry + modulepreloads): 765.09 kB gzip (765,093 bytes).
// Budget threshold = measured value + 3% = 788.05 kB gzip (788,046 bytes).
const INITIAL_JS_GZIP_BUDGET_BYTES = 788_046;

function resolveDistDir(inputArg = "dist") {
  const resolved = path.resolve(process.cwd(), inputArg);
  if (fs.existsSync(path.join(resolved, "index.html"))) {
    return resolved;
  }
  const parent = path.dirname(resolved);
  if (path.basename(resolved) === "assets" && fs.existsSync(path.join(parent, "index.html"))) {
    return parent;
  }
  return resolved;
}

function extractInitialJsAssets(indexHtml) {
  const urls = [];
  const tagRegex = /<(?:script|link)\b[^>]*>/gi;
  for (const [tag] of indexHtml.matchAll(tagRegex)) {
    const isEntryScript =
      /^<script\b/i.test(tag) && /\btype=["']module["']/i.test(tag) && /\bsrc=["']([^"']+)["']/i;
    const isModulePreload =
      /^<link\b/i.test(tag) &&
      /\brel=["']modulepreload["']/i.test(tag) &&
      /\bhref=["']([^"']+)["']/i;
    const attrMatch = tag.match(isEntryScript || isModulePreload || /^$/);
    const rawUrl = attrMatch?.[1];
    if (rawUrl?.endsWith(".js")) {
      const cleanRel = rawUrl.replace(/^\//, "");
      if (!urls.includes(cleanRel)) {
        urls.push(cleanRel);
      }
    }
  }
  return urls;
}

function formatKb(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

// Fixed output directory (no CLI argument: avoids path traversal).
function checkBundleBudget(dirArg = "dist") {
  const distDir = resolveDistDir(dirArg);
  const indexHtmlPath = path.join(distDir, "index.html");

  if (!fs.existsSync(indexHtmlPath)) {
    console.error(`Bundle budget check failed: index.html not found in ${distDir}`);
    return 1;
  }

  const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
  const initialAssets = extractInitialJsAssets(indexHtml);

  if (initialAssets.length === 0) {
    console.error(`Bundle budget check failed: no initial JS assets found in ${indexHtmlPath}`);
    return 1;
  }

  let totalRaw = 0;
  let totalGzip = 0;
  const rows = [];

  for (const relAsset of initialAssets) {
    const fullPath = path.join(distDir, relAsset);
    if (!fs.existsSync(fullPath)) {
      console.error(`Bundle budget check failed: missing asset ${fullPath}`);
      return 1;
    }
    const content = fs.readFileSync(fullPath);
    const rawBytes = content.byteLength;
    const gzipBytes = zlib.gzipSync(content).byteLength;
    totalRaw += rawBytes;
    totalGzip += gzipBytes;
    rows.push({ file: relAsset, rawBytes, gzipBytes });
  }

  console.info("Initial-load JS chunks (entry + modulepreload):");
  for (const row of rows) {
    console.info(
      `  - ${row.file.padEnd(42)} raw: ${formatKb(row.rawBytes).padStart(10)} | gzip: ${formatKb(row.gzipBytes).padStart(9)}`
    );
  }
  console.info(
    `Total initial JS: raw ${formatKb(totalRaw)} (${totalRaw} B) | gzip ${formatKb(totalGzip)} (${totalGzip} B)`
  );
  console.info(
    `Budget threshold (+3%): gzip ${formatKb(INITIAL_JS_GZIP_BUDGET_BYTES)} (${INITIAL_JS_GZIP_BUDGET_BYTES} B)`
  );

  if (totalGzip > INITIAL_JS_GZIP_BUDGET_BYTES) {
    console.error(
      `Bundle budget exceeded: initial JS gzip ${formatKb(totalGzip)} > ${formatKb(INITIAL_JS_GZIP_BUDGET_BYTES)} (+${formatKb(totalGzip - INITIAL_JS_GZIP_BUDGET_BYTES)})`
    );
    return 1;
  }

  console.info("Bundle budget check passed.");
  return 0;
}

process.exitCode = checkBundleBudget();
