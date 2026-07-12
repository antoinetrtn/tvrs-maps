import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const root = process.cwd();
const failures = [];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const walk = dir => {
  const entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  return entries.flatMap(entry => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return rel;
  });
};

const fail = (file, line, message) => {
  failures.push(`${file}${line ? `:${line}` : ''} ${message}`);
};

const sourceFiles = walk('src').filter(file => /\.(css|jsx|js)$/.test(file));

const packageJson = JSON.parse(read('package.json'));
const requiredScripts = {
  lint: 'node scripts/quality-check.js',
  quality: 'node scripts/quality-check.js',
  check: 'npm run lint && npm run test:run && npm run build',
  'dev:5001': 'vite --host 0.0.0.0 --port 5001'
};

Object.entries(requiredScripts).forEach(([name, command]) => {
  if (packageJson.scripts?.[name] !== command) {
    fail('package.json', null, `expected script "${name}" to be "${command}"`);
  }
});

['package.json', 'README.md', 'vite.config.js', ...sourceFiles].forEach(file => {
  const text = read(file);
  if (text.includes('5173')) {
    fail(file, null, 'port 5173 is banned for this project; use 5001');
  }
});

const hardcodedColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const colorAllowListFiles = new Set([
  'src/designSystem.js',
  'src/index.css',
  'src/Logo.jsx'
]);
const colorAllowLinePatterns = [
  /transparent/,
  /currentColor/,
  /color-mix/,
  /CanvasTexture/,
  /backgroundColor="transparent"/
];

sourceFiles.forEach(file => {
  if (colorAllowListFiles.has(file)) return;

  read(file).split('\n').forEach((lineText, index) => {
    if (!hardcodedColorPattern.test(lineText)) return;
    hardcodedColorPattern.lastIndex = 0;
    if (colorAllowLinePatterns.some(pattern => pattern.test(lineText))) return;
    fail(file, index + 1, 'hardcoded color found outside designSystem tokens');
  });
});

const globeMap = read('src/GlobeMap.jsx');
[
  ['highResCountriesByAdmin', 'do not swap low/high-res country geometry at selection time'],
  ['pathsData', 'do not add path overlays for selected country outlines unless they are visually verified'],
  ['pathStroke', 'do not add path overlays for selected country outlines unless they are visually verified'],
  ['globe-center-light-overlay', 'do not reintroduce 2D globe light overlays'],
  ['createRadialGlowTexture', 'do not reintroduce sprite/canvas glow textures']
].forEach(([needle, message]) => {
  if (globeMap.includes(needle)) fail('src/GlobeMap.jsx', null, message);
});

const app = read('src/App.jsx');
if (/countries-50m\.json/.test(app)) {
  fail('src/App.jsx', null, 'high-res map dataset should not load in the runtime app');
}

const cssFiles = sourceFiles.filter(file => file.endsWith('.css'));
cssFiles.forEach(file => {
  read(file).split('\n').forEach((lineText, index) => {
    if (/letter-spacing:\s*-/.test(lineText)) {
      fail(file, index + 1, 'negative letter-spacing is banned');
    }
  });
});

// Check for banned onPointerDown preventing defaults (which breaks mobile clicks)
sourceFiles.filter(file => file.endsWith('.jsx')).forEach(file => {
  const content = read(file);
  if (/onPointerDown\s*=\s*\{\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*[^}]*preventDefault/i.test(content)) {
    fail(file, null, 'banned onPointerDown preventing defaults on buttons (breaks mobile clicks; use onMouseDown instead)');
  }
});

// Run knip dead code audit
try {
  console.log('Running dead code audit (knip)...');
  execSync('npx knip', { stdio: 'inherit' });
} catch (e) {
  fail('knip', null, 'Dead code or unused imports/exports detected in the project.');
}

if (failures.length) {
  console.error('Quality check failed:\n');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Quality check passed.');
