/**
 * userSettings.cjs — persisted user preferences that must survive app
 * updates, reinstalls, and packaging.
 *
 * Everything here lives in ~/.solframe/settings.json, joining the
 * agent_server.json + scan_cache.json already in that folder. The
 * alternative — writing next to the app, the way custom_paths.json used to
 * — cannot work in a packaged build: the app ships as a single asar
 * archive, so "<app>/models/" is a path inside a *file*, and every write
 * fails with ENOTDIR. That failure was silent (the API still answered
 * {success: true}), so custom scan paths appeared to save and were gone on
 * the next read.
 *
 * Config lives here; large model files do NOT — those go to
 * getDefaultModelsRoot() below, somewhere the user can actually find them.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function getSettingsPath() {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  return path.join(userHome, '.solframe', 'settings.json');
}

/**
 * Where downloaded models go by default: ~/Downloads/Solframe Studio.
 *
 * Deliberately NOT %APPDATA%/~/Library/Application Support — those are
 * hidden-by-convention OS folders, and a user who downloads a 7 GB
 * checkpoint should be able to find, move, back up, or delete it without
 * knowing where an app stashes its internals. Downloads is writable
 * without elevation on all three platforms and is the one folder every
 * user already knows.
 */
function getDefaultModelsRoot() {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  // Linux desktops can relocate Downloads (XDG_DOWNLOAD_DIR); honour that
  // before assuming the English default.
  const downloads = process.env.XDG_DOWNLOAD_DIR || path.join(userHome, 'Downloads');
  return path.join(downloads, 'Solframe Studio');
}

function loadSettings() {
  const file = getSettingsPath();
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && typeof data === 'object') return data;
    }
  } catch (e) {
    console.warn(`[Solframe] Settings at ${file} are unreadable, falling back to defaults: ${e.message}`);
  }
  return {};
}

/** Merges a patch into settings.json. Returns true only if it really landed on disk. */
function saveSettings(patch) {
  const file = getSettingsPath();
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...loadSettings(), ...patch }, null, 2));
    return true;
  } catch (e) {
    console.warn(`[Solframe] Failed to save settings to ${file}: ${e.message}`);
    return false;
  }
}

/**
 * The active models root — the user's override if they set one, otherwise
 * the Downloads default. Falls back to the default if a previously-saved
 * override has since become unwritable (external drive unplugged, folder
 * deleted), so a stale setting can't strand every future download.
 */
function getModelsRoot() {
  const configured = loadSettings().modelsRoot;
  if (configured && typeof configured === 'string') {
    if (isWritableDir(configured)) return configured;
    console.warn(`[Solframe] Configured models folder "${configured}" isn't writable — using the default instead.`);
  }
  return getDefaultModelsRoot();
}

function setModelsRoot(dirPath) {
  if (!isWritableDir(dirPath)) return { success: false, error: `"${dirPath}" doesn't exist or isn't writable.` };
  if (!saveSettings({ modelsRoot: dirPath })) {
    return { success: false, error: "Couldn't write the settings file." };
  }
  return { success: true, modelsRoot: dirPath };
}

/** Creates the directory if needed, then proves it's writable by actually writing. */
function isWritableDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    const probe = path.join(dirPath, '.solframe-write-test');
    fs.writeFileSync(probe, '1');
    fs.unlinkSync(probe);
    return true;
  } catch (e) {
    return false;
  }
}

function loadCustomScanPaths() {
  const list = loadSettings().customScanPaths;
  if (!Array.isArray(list)) return [];
  return list.filter(p => typeof p === 'string' && fs.existsSync(p));
}

function saveCustomScanPaths(pathsList) {
  return saveSettings({ customScanPaths: Array.from(new Set(pathsList)) });
}

module.exports = {
  getSettingsPath,
  getDefaultModelsRoot,
  getModelsRoot,
  setModelsRoot,
  loadSettings,
  saveSettings,
  loadCustomScanPaths,
  saveCustomScanPaths,
  isWritableDir
};
