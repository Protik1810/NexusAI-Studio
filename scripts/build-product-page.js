const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('🚀 [ProductPage] Deploying Solframe Studio Showcase to GitHub Pages...');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(os.tmpdir(), 'solframe-product-landing');

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// docs/index.html is the single canonical showcase page (see build-blob-landing.js)
const productHtml = fs.readFileSync(path.join(rootDir, 'docs/index.html'), 'utf8');
fs.writeFileSync(path.join(outDir, 'index.html'), productHtml, 'utf8');
fs.writeFileSync(path.join(outDir, '404.html'), productHtml, 'utf8');
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

// Copy public directory recursively into outDir/public
const copyDirRecursive = (src, dest) => {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

copyDirRecursive(path.join(rootDir, 'public'), path.join(outDir, 'public'));

// Also copy logo.png and themes directly into root of outDir for relative fallbacks
if (fs.existsSync(path.join(rootDir, 'public/logo.png'))) {
  fs.copyFileSync(path.join(rootDir, 'public/logo.png'), path.join(outDir, 'logo.png'));
}
if (fs.existsSync(path.join(rootDir, 'public/themes'))) {
  copyDirRecursive(path.join(rootDir, 'public/themes'), path.join(outDir, 'themes'));
}
if (fs.existsSync(path.join(rootDir, 'public/screenshots'))) {
  copyDirRecursive(path.join(rootDir, 'public/screenshots'), path.join(outDir, 'screenshots'));
}

console.log('📦 [ProductPage] Pushing to origin gh-pages branch...');
execSync('git init', { cwd: outDir, stdio: 'inherit' });
execSync('git config user.name "Protik"', { cwd: outDir, stdio: 'inherit' });
execSync('git config user.email "protik@solframe.local"', { cwd: outDir, stdio: 'inherit' });
execSync('git checkout -b gh-pages', { cwd: outDir, stdio: 'inherit' });
execSync('git add .', { cwd: outDir, stdio: 'inherit' });
execSync('git commit -m "feat: deploy Solframe Studio showcase webpage to GitHub Pages"', { cwd: outDir, stdio: 'inherit' });
execSync('git remote add origin https://github.com/Protik1810/Solframe-Studio.git', { cwd: outDir, stdio: 'inherit' });
execSync('git push -f origin gh-pages', { cwd: outDir, stdio: 'inherit' });

fs.rmSync(outDir, { recursive: true, force: true });
console.log('🎉 Product Website successfully deployed to https://protik1810.github.io/Solframe-Studio/ !');