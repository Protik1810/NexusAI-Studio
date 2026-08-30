const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const unpackedExe = path.join(rootDir, 'release', 'win-unpacked', 'Solframe Studio.exe');
const { version } = require(path.join(rootDir, 'package.json'));

if (!fs.existsSync(unpackedExe)) {
  console.log('📦 release/win-unpacked not found — building it with electron-builder first...');
  execSync('npm run electron:pack', { cwd: rootDir, stdio: 'inherit' });
}

// Resolve ISCC.exe without hardcoding one machine's install path: an
// ISCC_PATH env var wins if set, then PATH (works if Inno Setup's install
// added itself, or a CI step does), then the two standard install
// locations Inno Setup's own installer offers.
function resolveIscc() {
  if (process.env.ISCC_PATH && fs.existsSync(process.env.ISCC_PATH)) {
    return process.env.ISCC_PATH;
  }
  try {
    const fromPath = execSync('where ISCC.exe', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split(/\r?\n/)[0]
      .trim();
    if (fromPath && fs.existsSync(fromPath)) return fromPath;
  } catch (e) {
    // not on PATH — fall through to the standard install locations
  }
  const standardLocations = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe'
  ];
  return standardLocations.find(p => fs.existsSync(p)) || null;
}

const isccPath = resolveIscc();
const issComplete = path.resolve(__dirname, '../installer.iss');
const issLightweight = path.resolve(__dirname, '../installer-lightweight.iss');

// --lightweight-only: skip the Complete installer. Used in CI, where the
// CUDA/Vulkan/llama.cpp binaries the Complete installer bundles don't
// exist in the checkout at all (deliberately not committed — see
// .github/workflows/release-build.yml) — compiling installer.iss there
// wouldn't fail, it would just silently produce a "Complete" installer
// that's actually missing every acceleration engine.
const lightweightOnly = process.argv.includes('--lightweight-only');

if (!isccPath) {
  console.error('ISCC compiler not found on PATH, via ISCC_PATH, or at a standard Inno Setup install location.');
  console.error('Install Inno Setup (https://jrsoftware.org/isinfo.php), or set ISCC_PATH to its ISCC.exe.');
  process.exit(1);
}

if (!lightweightOnly) {
  console.log(`\n🔨 [1/2] Compiling Complete Solframe Studio Setup Installer v${version} (.exe)...`);
  execSync(`"${isccPath}" "/DMyAppVersion=${version}" "${issComplete}"`, { stdio: 'inherit' });
  console.log(`🎉 Complete Installer generated at: installer-output/Solframe-Studio-Setup-${version}.exe`);
}

console.log(`\n🔨 [${lightweightOnly ? '1/1' : '2/2'}] Compiling Lightweight Solframe Studio Setup Installer v${version} (.exe)...`);
execSync(`"${isccPath}" "/DMyAppVersion=${version}" "${issLightweight}"`, { stdio: 'inherit' });
console.log(`🎉 Lightweight Installer generated at: installer-output/Solframe-Studio-Setup-${version}-Lightweight.exe`);

console.log(`\n✅ ${lightweightOnly ? 'Lightweight installer' : 'All installers'} successfully compiled and ready in installer-output/!`);
