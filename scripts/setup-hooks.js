import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// LEGACY: This script previously installed manual git hooks.
// We have migrated to Husky + lint-staged for better DX (fast per-file checks on commit).
// The prepare script now runs "husky".
// You can safely delete this file and the old .git/hooks/pre-* in the future.

console.log('[setup-hooks] Legacy hook script. Husky manages hooks now (see .husky/).');
console.log('[setup-hooks] Run "npm run prepare" or "npx husky" if needed after clean install.');

const gitDir = path.join(process.cwd(), '.git');
if (fs.existsSync(gitDir)) {
  // No longer overwriting hooks here. Husky owns .git/hooks via its shims.
  console.log('[setup-hooks] Skipping manual hook install (Husky is active).');
} else {
  console.log('Not a git repository. Skipping.');
}
