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

describe('buildSdCliArgs - FLUX pipeline', () => {
  it('passes "flux_flow" (not the old "flux2_flow") for a Klein diffusion model', () => {
    // Current sd-cli builds reject "flux2_flow" outright (dumps --help and
    // exits) — verified against a real generation run. Locking this in so a
    // future revert doesn't silently re-break FLUX.2 Klein generation.
    const args = buildSdCliArgs(
      { pipeline: 'flux', modelPath: 'flux-2-klein-base-9b-fp8.safetensors', prompt: 'a cat' },
      'out.png'
    );
    expect(args).toContain('--prediction');
    expect(args[args.indexOf('--prediction') + 1]).toBe('flux_flow');
    expect(args).not.toContain('flux2_flow');
  });

  it('does not pass --prediction for a non-Klein FLUX model', () => {
    const args = buildSdCliArgs(
      { pipeline: 'flux', modelPath: 'flux1-dev.safetensors', prompt: 'a cat' },
      'out.png'
    );
    expect(args).not.toContain('--prediction');
  });

  it('adds --backend te=cpu when offloadTextEncoder is set', () => {
    const args = buildSdCliArgs(
      { pipeline: 'flux', modelPath: 'flux-2-klein-base-9b-fp8.safetensors', prompt: 'a cat', offloadTextEncoder: true },
      'out.png'
    );
    expect(args).toContain('--backend');
    expect(args[args.indexOf('--backend') + 1]).toBe('te=cpu');
  });

  it('omits --backend te=cpu by default', () => {
    const args = buildSdCliArgs(
      { pipeline: 'flux', modelPath: 'flux-2-klein-base-9b-fp8.safetensors', prompt: 'a cat' },
      'out.png'
    );
    expect(args).not.toContain('--backend');
  });
});
