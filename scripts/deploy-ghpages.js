const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('[Deploy] Preparing clean GitHub Pages deployment bundle...');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const deployDir = path.join(os.tmpdir(), 'nexusai-ghpages-clean');

if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir, { recursive: true });

function copyFolder(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolder(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.copyFileSync(path.join(distDir, 'index.html'), path.join(deployDir, 'index.html'));
fs.copyFileSync(path.join(distDir, 'index.html'), path.join(deployDir, '404.html'));
fs.writeFileSync(path.join(deployDir, '.nojekyll'), '');

copyFolder(path.join(distDir, 'assets'), path.join(deployDir, 'assets'));
copyFolder(path.join(distDir, 'themes'), path.join(deployDir, 'themes'));

if (fs.existsSync(path.join(distDir, 'logo.png'))) {
  fs.copyFileSync(path.join(distDir, 'logo.png'), path.join(deployDir, 'logo.png'));
}
if (fs.existsSync(path.join(distDir, 'nexusai-icon.png'))) {
  fs.copyFileSync(path.join(distDir, 'nexusai-icon.png'), path.join(deployDir, 'nexusai-icon.png'));
}

console.log('[Deploy] Pushing to origin gh-pages...');
execSync('git init', { cwd: deployDir, stdio: 'inherit' });
execSync('git config user.name "Protik"', { cwd: deployDir, stdio: 'inherit' });
execSync('git config user.email "protik@nexusai.local"', { cwd: deployDir, stdio: 'inherit' });
execSync('git checkout -b gh-pages', { cwd: deployDir, stdio: 'inherit' });
execSync('git add .', { cwd: deployDir, stdio: 'inherit' });
execSync('git commit -m "deploy: GitHub Pages release with .nojekyll"', { cwd: deployDir, stdio: 'inherit' });
execSync('git remote add origin https://github.com/Protik1810/NexusAI-Studio.git', { cwd: deployDir, stdio: 'inherit' });
execSync('git push -f origin gh-pages', { cwd: deployDir, stdio: 'inherit' });

fs.rmSync(deployDir, { recursive: true, force: true });
console.log('GitHub Pages successfully deployed to https://protik1810.github.io/NexusAI-Studio/');