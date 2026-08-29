const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const appDest = path.join(rootDir, 'release-pkg/NexusAI Studio-win32-x64/resources/app');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('🔄 Syncing updated source files and dist bundle to release-pkg...');
copyRecursive(path.join(rootDir, 'dist'), path.join(appDest, 'dist'));
copyRecursive(path.join(rootDir, 'electron'), path.join(appDest, 'electron'));
copyRecursive(path.join(rootDir, 'public'), path.join(appDest, 'public'));
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(appDest, 'package.json'));
fs.copyFileSync(path.join(rootDir, 'vite.config.ts'), path.join(appDest, 'vite.config.ts'));

console.log('✅ Release package synchronized with latest code and GPU fixes!');
