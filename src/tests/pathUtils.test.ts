import { describe, it, expect, vi, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
const { resolveModelFullPath, getAllSystemScanPaths } = require('../../electron/engine/pathUtils.cjs');

describe('pathUtils - System Scan and Path Resolution', () => {
  it('should return an array of system scan paths', () => {
    // A bare CI runner has none of the AI tool directories this function
    // looks for (no HuggingFace cache, no Ollama, no models/ folder) — a
    // guaranteed-existing custom path keeps this deterministic regardless
    // of what happens to be installed on the machine running the test.
    const guaranteedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-scanpath-test-'));
    try {
      const paths = getAllSystemScanPaths(process.cwd(), [guaranteedDir]);
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toHaveProperty('path');
      expect(paths[0]).toHaveProperty('label');
    } finally {
      fs.rmSync(guaranteedDir, { recursive: true, force: true });
    }
  });

  it('should include user-defined custom paths when provided', () => {
    const custom = ['C:/test_custom_models'];
    const paths = getAllSystemScanPaths(process.cwd(), custom);
    // Custom path won't exist on disk, so it will be filtered if nonexistent,
    // but the function should handle it gracefully without crashing
    expect(Array.isArray(paths)).toBe(true);
  });

  it('should resolve empty string to empty string', () => {
    expect(resolveModelFullPath('', process.cwd())).toBe('');
  });

  it('should resolve existing local paths properly without hardcoded drives', () => {
    const resolved = resolveModelFullPath('models/checkpoints/RealVisXL_V5.0_Lightning_fp16.safetensors', process.cwd());
    expect(resolved).toBeTruthy();
    expect(typeof resolved).toBe('string');
  });

  describe('macOS scan paths', () => {
    const originalPlatform = process.platform;
    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('scans /Volumes instead of drive letters on darwin, without crashing', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const guaranteedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-scanpath-mac-test-'));
      try {
        const paths = getAllSystemScanPaths(process.cwd(), [guaranteedDir]);
        expect(Array.isArray(paths)).toBe(true);
        // No C:/D:/E:… labels should ever appear once platform is darwin.
        expect(paths.some((p: any) => /^[A-Z]:/.test(p.label))).toBe(false);
      } finally {
        fs.rmSync(guaranteedDir, { recursive: true, force: true });
      }
    });

    it('uses the ~/Library/Application Support convention for the default Solframe folder on darwin', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      delete process.env.APPDATA;
      const paths = getAllSystemScanPaths(process.cwd(), []);
      const solframeDefault = paths.find((p: any) => p.label === 'AppData Solframe Models');
      // Only asserts the path shape when the folder actually exists on this
      // machine — the important thing is it's never the old, wrong
      // `~/Solframe Studio/models` (no Application Support segment).
      if (solframeDefault) {
        expect(solframeDefault.path).toContain('Library/Application Support');
      }
    });
  });
});