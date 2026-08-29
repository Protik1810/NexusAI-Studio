const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const unpackedExe = path.join(rootDir, 'release', 'win-unpacked', 'Solframe Studio.exe');

if (!fs.existsSync(unpackedExe)) {
  console.log('📦 release/win-unpacked not found — building it with electron-builder first...');
  execSync('npm run electron:pack', { cwd: rootDir, stdio: 'inherit' });
}

const isccPath = 'C:\\Users\\proti\\AppData\\Local\\Programs\\Antigravity IDE\\_\\resources\\app\\node_modules\\innosetup\\bin\\ISCC.exe';
const issComplete = path.resolve(__dirname, '../installer.iss');
const issLightweight = path.resolve(__dirname, '../installer-lightweight.iss');

if (!fs.existsSync(isccPath)) {
  console.error('ISCC compiler not found at:', isccPath);
  console.error('Install Inno Setup (https://jrsoftware.org/isinfo.php) and update isccPath in this script.');
  process.exit(1);
}

// 1. Build Complete Installer
console.log('\n🔨 [1/2] Compiling Complete Solframe Studio Setup Installer (.exe)...');
execSync(`"${isccPath}" "${issComplete}"`, { stdio: 'inherit' });
console.log('🎉 Complete Installer generated at: installer-output/Solframe-Studio-Setup-1.0.0.exe');

// 2. Build Lightweight Installer
console.log('\n🔨 [2/2] Compiling Lightweight Solframe Studio Setup Installer (.exe)...');
execSync(`"${isccPath}" "${issLightweight}"`, { stdio: 'inherit' });
console.log('🎉 Lightweight Installer generated at: installer-output/Solframe-Studio-Setup-1.0.0-Lightweight.exe');

console.log('\n✅ All installers successfully compiled and ready in installer-output/!');