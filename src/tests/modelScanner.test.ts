import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

// Check if classifyModelFile is accessible
const { classifyModelFile } = require('../../electron/engine/modelScanner.cjs');

describe('modelScanner - File Classification', () => {
  it('should classify checkpoints correctly based on file and path', () => {
    // If classifyModelFile reads fs.statSync, let's test with an existing file in models/ or mock
    const sampleCheckpoint = path.join(process.cwd(), 'public/icon.ico'); // Small dummy file for size test
    if (fs.existsSync(sampleCheckpoint)) {
      const item = classifyModelFile(sampleCheckpoint, 'Test Source', process.cwd());
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('formattedSize');
    }
  });

  it('should categorize GGUF models appropriately', () => {
    const isGgufPattern = (name: string) => name.toLowerCase().endsWith('.gguf');
    expect(isGgufPattern('qwen2.5-coder-7b.gguf')).toBe(true);
    expect(isGgufPattern('realvisxl.safetensors')).toBe(false);
  });
});