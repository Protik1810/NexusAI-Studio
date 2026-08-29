const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔄 Synchronizing latest dist and server code to release package...');
require('./sync-release.js');

console.log('🔨 Compiling NexusAI Studio Setup Installer (.exe)...');
const isccPath = 'C:\\Users\\proti\\AppData\\Local\\Programs\\Antigravity IDE\\_\\resources\\app\\node_modules\\innosetup\\bin\\ISCC.exe';
const issFile = path.resolve(__dirname, '../installer.iss');

if (!fs.existsSync(isccPath)) {
  console.error('ISCC compiler not found.');
  process.exit(1);
}

execSync(`"${isccPath}" "${issFile}"`, { stdio: 'inherit' });
console.log('🎉 Setup Installer generated at: installer-output/NexusAI-Studio-Setup-1.0.0.exe');