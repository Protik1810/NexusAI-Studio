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
copyRecursive(path.join(rootDir, 'src'), path.join(appDest, 'src'));
copyRecursive(path.join(rootDir, 'scripts'), path.join(appDest, 'scripts'));

if (fs.existsSync(path.join(rootDir, 'LICENSE'))) {
  fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(appDest, 'LICENSE'));
  fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(rootDir, 'release-pkg/NexusAI Studio-win32-x64/LICENSE'));
}

fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(appDest, 'package.json'));
fs.copyFileSync(path.join(rootDir, 'vite.config.ts'), path.join(appDest, 'vite.config.ts'));

// Cleanup any stale test files from app release package
const staleFiles = ['test_realvis_out.png', 'test_sdxl_out.png', 'test_vulkan_out.png'];
staleFiles.forEach(f => {
  const p = path.join(appDest, f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

console.log('✅ Release package synchronized with latest code and GPU fixes!');

