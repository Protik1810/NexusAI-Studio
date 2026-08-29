const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔄 Synchronizing latest dist and server code to release package...');
require('./sync-release.js');

const isccPath = 'C:\\Users\\proti\\AppData\\Local\\Programs\\Antigravity IDE\\_\\resources\\app\\node_modules\\innosetup\\bin\\ISCC.exe';
const issComplete = path.resolve(__dirname, '../installer.iss');
const issLightweight = path.resolve(__dirname, '../installer-lightweight.iss');

if (!fs.existsSync(isccPath)) {
  console.error('ISCC compiler not found at:', isccPath);
  process.exit(1);
}

// 1. Build Complete Installer
console.log('\n🔨 [1/2] Compiling Complete NexusAI Studio Setup Installer (.exe)...');
execSync(`"${isccPath}" "${issComplete}"`, { stdio: 'inherit' });
console.log('🎉 Complete Installer generated at: installer-output/NexusAI-Studio-Setup-1.0.0.exe');

// 2. Build Lightweight Installer
console.log('\n🔨 [2/2] Compiling Lightweight NexusAI Studio Setup Installer (.exe)...');
execSync(`"${isccPath}" "${issLightweight}"`, { stdio: 'inherit' });
console.log('🎉 Lightweight Installer generated at: installer-output/NexusAI-Studio-Setup-1.0.0-Lightweight.exe');

console.log('\n✅ All installers successfully compiled and ready in installer-output/!');