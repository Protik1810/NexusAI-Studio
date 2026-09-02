import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const userSettings = require('../../electron/engine/userSettings.cjs');

// Point HOME/USERPROFILE at a throwaway dir so these never touch the real
// ~/.solframe.
let tmpHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-settings-'));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
});

afterEach(() => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch { /* best effort */ }
});

describe('userSettings persistence', () => {
  it('round-trips custom scan paths', () => {
    // Regression: these used to be written next to the app, which is an
    // asar archive in a packaged build — every write failed with ENOTDIR
    // while the API still reported success, so paths vanished immediately.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-models-'));
    try {
      expect(userSettings.saveCustomScanPaths([dir])).toBe(true);
      expect(userSettings.loadCustomScanPaths()).toContain(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('drops scan paths that no longer exist', () => {
    const gone = path.join(tmpHome, 'deleted-drive', 'models');
    userSettings.saveCustomScanPaths([gone]);
    expect(userSettings.loadCustomScanPaths()).not.toContain(gone);
  });

  it('defaults the models root to a visible Downloads folder, not app-data', () => {
    const root = userSettings.getDefaultModelsRoot();
    // Ends with Downloads/Solframe Studio — checked as a suffix, since the
    // temp HOME these tests use can itself sit under AppData.
    expect(root.replace(/\\/g, '/')).toMatch(/\/Downloads\/Solframe Studio$/);
    // and specifically not the Roaming/Application Support convention the
    // pre-1.1.3 build used, which is where "I can't find my models" came from.
    expect(root).not.toMatch(/Roaming|Application Support/);
  });

  it('uses a configured models root once set', () => {
    const custom = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-root-'));
    try {
      expect(userSettings.setModelsRoot(custom).success).toBe(true);
      expect(userSettings.getModelsRoot()).toBe(custom);
    } finally {
      fs.rmSync(custom, { recursive: true, force: true });
    }
  });

  it('falls back to the default when a saved root became unwritable', () => {
    // e.g. an external drive that is no longer plugged in — a stale setting
    // must not strand every future download.
    const gone = path.join(tmpHome, 'unplugged-drive', 'models');
    userSettings.saveSettings({ modelsRoot: gone });
    fs.rmSync(path.join(tmpHome, 'unplugged-drive'), { recursive: true, force: true });
    // Simulate a path that cannot be recreated by pointing at a file.
    const asFile = path.join(tmpHome, 'not-a-dir');
    fs.writeFileSync(asFile, 'x');
    userSettings.saveSettings({ modelsRoot: asFile });
    expect(userSettings.getModelsRoot()).toBe(userSettings.getDefaultModelsRoot());
  });

  it('rejects a models root that cannot be written to', () => {
    const asFile = path.join(tmpHome, 'a-file');
    fs.writeFileSync(asFile, 'x');
    expect(userSettings.setModelsRoot(asFile).success).toBe(false);
  });
});
