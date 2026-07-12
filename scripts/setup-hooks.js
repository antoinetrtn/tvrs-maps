import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const gitDir = path.join(process.cwd(), '.git');
if (fs.existsSync(gitDir)) {
  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir);
  }
  
  // Bash script that runs npm run check before commit
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const preCommitScript = `#!/bin/sh
echo "Running pre-commit quality checks..."
npm run check
if [ $? -ne 0 ]; then
  echo "❌ Commit aborted: quality check failed."
  exit 1
fi
echo "✅ Quality check passed. Committing..."
exit 0
`;

  fs.writeFileSync(preCommitPath, preCommitScript, { mode: 0o755 });
  console.log('Successfully installed git pre-commit hook!');

  // Bash script that runs npm run check before push
  const prePushPath = path.join(hooksDir, 'pre-push');
  const prePushScript = `#!/bin/sh
echo "Running pre-push quality checks..."
npm run check
if [ $? -ne 0 ]; then
  echo "❌ Push aborted: quality check failed."
  exit 1
fi
echo "✅ Quality check passed. Pushing..."
exit 0
`;

  fs.writeFileSync(prePushPath, prePushScript, { mode: 0o755 });
  console.log('Successfully installed git pre-push hook!');
} else {
  console.log('Not a git repository or root folder. Skipping hook installation.');
}
