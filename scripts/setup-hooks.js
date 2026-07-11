import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const gitDir = path.join(process.cwd(), '.git');
if (fs.existsSync(gitDir)) {
  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir);
  }
  const prePushPath = path.join(hooksDir, 'pre-push');
  
  // Bash script that runs npm run check before push
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
