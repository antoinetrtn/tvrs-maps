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
  'src/config/designSystem.js',
  'src/index.css',
  'src/components/Logo.jsx'
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

// ==========================================
// New Readability and File Size Checks
// ==========================================

const RATCHET_LIMITS = {
  'src/App.jsx': 530,
  'src/GlobeMap.jsx': 590,
  'src/components/GameHUD.jsx': 650,
  'src/hooks/useGameSession.js': 750,
  'src/hooks/useUserProfile.js': 750,
  'src/hooks/useGlobePolygons.js': 710,
  'src/config/designSystem.js': 725,
  'src/components/GameHUD.css': 970,
  'src/components/HomeScreen.css': 810, // expanded by unified panelSystem + responsive segmented + glass primitives
  'src/components/ProfilePanel.css': 770, // expanded by scroll refactor, sticky footer, avatar grid, blur overlay, charts
  'src/components/LeaderboardScreen.css': 530,
  'src/components/EndScreen.css': 550
};

const LEGACY_BASES = {
  'src/App.jsx': { maxDepth: 6, maxBlock2: 85, maxBlock3: 35 },
  'src/GlobeMap.jsx': { maxDepth: 5, maxBlock2: 35, maxBlock3: 20 },
  'src/components/EndScreen.jsx': { maxDepth: 6, maxBlock2: 40, maxBlock3: 35 },
  'src/components/GameHUD.jsx': { maxDepth: 8, maxBlock2: 210, maxBlock3: 110 },
  'src/components/LeaderboardScreen.jsx': { maxDepth: 6, maxBlock2: 90, maxBlock3: 70 },
  'src/components/Logo.jsx': { maxDepth: 7, maxBlock2: 45, maxBlock3: 25 },
  'src/components/PixelFireworks.jsx': { maxDepth: 6, maxBlock2: 150, maxBlock3: 40 },
  'src/components/ProfilePanel.jsx': { maxDepth: 7, maxBlock2: 220, maxBlock3: 50 },

  'src/components/AuthModal.jsx': { maxDepth: 7, maxBlock2: 90, maxBlock3: 70 },
  'src/components/SpaceBackground.jsx': { maxDepth: 5, maxBlock2: 190, maxBlock3: 105 },
  'src/components/XpOrbsAnimation.jsx': { maxDepth: 5, maxBlock2: 155, maxBlock3: 90 },
  'src/hooks/useGameSession.js': { maxDepth: 7, maxBlock2: 170, maxBlock3: 60 },
  'src/hooks/useGlobeAnimationLoop.js': { maxDepth: 8, maxBlock2: 320, maxBlock3: 300 },
  'src/hooks/useGlobeCamera.js': { maxDepth: 10, maxBlock2: 95, maxBlock3: 75 },
  'src/hooks/useGlobeInteractions.js': { maxDepth: 6, maxBlock2: 85, maxBlock3: 50 },
  'src/hooks/useGlobeLabels.js': { maxDepth: 7, maxBlock2: 190, maxBlock3: 80 },
  'src/hooks/useGlobeLighting.js': { maxDepth: 6, maxBlock2: 200, maxBlock3: 80 },
  'src/hooks/useGlobePolygons.js': { maxDepth: 6, maxBlock2: 180, maxBlock3: 90 },
  'src/hooks/useUserProfile.js': { maxDepth: 9, maxBlock2: 205, maxBlock3: 200 },
  'src/utils/LowPolyBiomes.js': { maxDepth: 6, maxBlock2: 75, maxBlock3: 65 },
  'src/utils/globeLabelBuilder.js': { maxDepth: 5, maxBlock2: 145, maxBlock3: 50 }
};

sourceFiles.forEach(file => {
  const content = read(file);
  const lines = content.split('\n');
  const lineCount = lines.length;

  // 1. File Size & Ratchet Validation
  const isDataFile = file.startsWith('src/data/');
  if (!isDataFile) {
    const isJs = file.endsWith('.js') || file.endsWith('.jsx');
    const isCss = file.endsWith('.css');
    const defaultLimit = isJs ? 500 : (isCss ? 500 : Infinity);

    const limit = RATCHET_LIMITS[file] || defaultLimit;
    if (lineCount > limit) {
      fail(
        file,
        null,
        `File is too large (${lineCount} lines). The limit is ${limit} lines. Please split it into smaller modules or hooks.`
      );
    }
  }

  // 2. Readability & Complexity Validation (JS/JSX files only, excluding config/data/tests)
  const isJs = file.endsWith('.js') || file.endsWith('.jsx');
  const isExcludedFromReadability =
    file.startsWith('src/config/') ||
    file.startsWith('src/data/') ||
    file.startsWith('src/tests/');

  if (isJs && !isExcludedFromReadability) {
    let braceDepth = 0;
    const braceStack = [];
    let maxDepth = 0;
    let maxBlock2 = 0;
    let maxBlock3 = 0;
    let insideComment = false;
    let insideString = false;
    let stringChar = '';

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineNum = lineIdx + 1;

      // Line Length Check (Max 120 chars)
      const cleanLine = line.trim();
      if (cleanLine.length > 120) {
        const isBannedPattern =
          line.includes('import ') ||
          line.includes('require(') ||
          line.includes('http://') ||
          line.includes('https://') ||
          line.includes('data:image/') ||
          line.includes('path d=') ||
          cleanLine.startsWith('//') ||
          cleanLine.startsWith('*') ||
          cleanLine.includes('`') ||
          cleanLine.includes('"') ||
          cleanLine.includes("'");

        if (!isBannedPattern) {
          fail(
            file,
            lineNum,
            `Line exceeds 120 characters (${cleanLine.length} chars). Keep lines short for readability.`
          );
        }
      }

      // Scanner for comment and string blocks to check brace nesting depth & block sizes
      for (let colIdx = 0; colIdx < line.length; colIdx++) {
        const char = line[colIdx];
        const nextChar = line[colIdx + 1];

        if (insideComment) {
          if (char === '*' && nextChar === '/') {
            insideComment = false;
            colIdx++;
          }
          continue;
        }

        if (char === '/' && nextChar === '*') {
          insideComment = true;
          colIdx++;
          continue;
        }

        if (char === '/' && nextChar === '/') {
          break; // Rest of line is comment
        }

        if (insideString) {
          if (char === '\\') {
            colIdx++; // Skip escaped character
            continue;
          }
          if (char === stringChar) {
            insideString = false;
            stringChar = '';
          }
          continue;
        }

        if (char === "'" || char === '"' || char === '`') {
          insideString = true;
          stringChar = char;
          continue;
        }

        // Trace opening and closing braces
        if (char === '{') {
          braceDepth++;
          braceStack.push({ lineNum, depth: braceDepth });
          if (braceDepth > maxDepth) {
            maxDepth = braceDepth;
          }
        } else if (char === '}') {
          if (braceDepth > 0) {
            const open = braceStack.pop();
            const blockLength = lineNum - open.lineNum + 1;

            if (open.depth >= 3) {
              if (blockLength > maxBlock3) {
                maxBlock3 = blockLength;
              }
            } else if (open.depth === 2) {
              if (blockLength > maxBlock2) {
                maxBlock2 = blockLength;
              }
            }
            braceDepth--;
          }
        }
      }
    }

    // Apply complexity check against legacy baseline or defaults
    const legacy = LEGACY_BASES[file];
    const allowedDepth = legacy ? legacy.maxDepth : 5;
    const allowedBlock2 = legacy ? legacy.maxBlock2 : 120;
    const allowedBlock3 = legacy ? legacy.maxBlock3 : 70;

    if (maxDepth > allowedDepth) {
      fail(
        file,
        null,
        `Maximum control flow nesting depth is too high (depth: ${maxDepth}, limit: ${allowedDepth}). Break down nested structures.`
      );
    }
    if (maxBlock2 > allowedBlock2) {
      fail(
        file,
        null,
        `Function/block (depth 2) is too long (length: ${maxBlock2} lines, limit: ${allowedBlock2} lines). Extract nested logic.`
      );
    }
    if (maxBlock3 > allowedBlock3) {
      fail(
        file,
        null,
        `Deeply nested block (depth >= 3) is too long (length: ${maxBlock3} lines, limit: ${allowedBlock3} lines). Refactor into smaller functions.`
      );
    }
  }
});

// Ban rogue z-index overrides that break the panel/dialog stacking order
const zIndexAllowListFiles = new Set([
  'src/panelSystem.css',
  'src/index.css',
  'src/App.css'
]);
cssFiles.forEach(file => {
  if (zIndexAllowListFiles.has(file)) return;
  read(file).split('\n').forEach((lineText, index) => {
    if (/var\(--z-/.test(lineText)) return;
    const match = lineText.match(/z-index:\s*(\d+)/);
    if (!match) return;
    const value = Number(match[1]);
    if (value > 6000) {
      fail(file, index + 1, `z-index ${value} exceeds panel system max; use --z-sheet/--z-dialog tokens`);
    }
  });
});

// Run ESLint (unused imports, hooks rules, basic correctness)
try {
  console.log('Running ESLint...');
  execSync('npx eslint src', { stdio: 'inherit' });
} catch (e) {
  fail('eslint', null, 'ESLint reported errors or warnings.');
}

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
