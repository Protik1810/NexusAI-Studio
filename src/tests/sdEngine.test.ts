import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
const { buildSdCliArgs } = require('../../electron/engine/sdEngine.cjs');

describe('buildSdCliArgs - LoRA wiring', () => {
  let tmpDir: string;
  let loraPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-sdengine-test-'));
    loraPath = path.join(tmpDir, 'my_style_v1.safetensors');
    fs.writeFileSync(loraPath, 'fake');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('has no separate --lora flag: applies it via a <lora:name:strength> prompt tag plus --lora-model-dir', () => {
    const args = buildSdCliArgs(
      { pipeline: 'standard', modelPath: 'model.safetensors', prompt: 'a cat', loraPath, loraStrength: 0.8 },
      'out.png'
    );
    expect(args).toContain('--lora-model-dir');
    expect(args[args.indexOf('--lora-model-dir') + 1]).toBe(tmpDir);
    const promptIndex = args.indexOf('-p');
    expect(args[promptIndex + 1]).toBe('a cat <lora:my_style_v1:0.8>');
  });

  it('defaults strength to 1 when not provided', () => {
    const args = buildSdCliArgs(
      { pipeline: 'standard', modelPath: 'model.safetensors', prompt: 'a cat', loraPath },
      'out.png'
    );
    const promptIndex = args.indexOf('-p');
    expect(args[promptIndex + 1]).toBe('a cat <lora:my_style_v1:1>');
  });

  it('does not touch the prompt or add lora flags when no loraPath is given', () => {
    const args = buildSdCliArgs(
      { pipeline: 'standard', modelPath: 'model.safetensors', prompt: 'a cat' },
      'out.png'
    );
    expect(args).not.toContain('--lora-model-dir');
    const promptIndex = args.indexOf('-p');
    expect(args[promptIndex + 1]).toBe('a cat');
  });

  it('ignores a loraPath that does not exist on disk', () => {
    const args = buildSdCliArgs(
      { pipeline: 'standard', modelPath: 'model.safetensors', prompt: 'a cat', loraPath: path.join(tmpDir, 'missing.safetensors') },
      'out.png'
    );
    expect(args).not.toContain('--lora-model-dir');
    const promptIndex = args.indexOf('-p');
    expect(args[promptIndex + 1]).toBe('a cat');
  });
});
