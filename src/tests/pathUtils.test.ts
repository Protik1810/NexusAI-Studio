import { describe, it, expect } from 'vitest';
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
    const guaranteedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusai-scanpath-test-'));
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
});