import { describe, it, expect, afterAll } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
const { classifyModelFile } = require('../../electron/engine/modelScanner.cjs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-scanner-test-'));
// classifyModelFile only enforces a size threshold for the flux/unet heuristic
// (>3GB); the 5MB scan-time floor lives in scanDirectoryRecursive, not here.
const DEFAULT_SIZE = 1024;

function makeFile(relPath: string, size = DEFAULT_SIZE) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, Buffer.alloc(size));
  return full;
}

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('modelScanner - classifyModelFile', () => {
  it('classifies a .gguf file as an llm', () => {
    const f = makeFile('llm/qwen2.5-coder-7b-instruct.gguf');
    const item = classifyModelFile(f, 'Test Source', tmpDir);
    expect(item?.category).toBe('llms');
    expect(item?.isGguf).toBe(true);
  });

  it('classifies a file under a loras/ folder as a lora', () => {
    const f = makeFile('loras/my-style-lora.safetensors');
    const item = classifyModelFile(f, 'Test Source', tmpDir);
    expect(item?.category).toBe('loras');
  });

  it('classifies a vae-named file as a vae', () => {
    const f = makeFile('checkpoints/flux2-vae.safetensors');
    const item = classifyModelFile(f, 'Test Source', tmpDir);
    expect(item?.category).toBe('vaes');
  });

  it('classifies a controlnet-named file as a controlnet', () => {
    const f = makeFile('checkpoints/controlnet-union-sdxl-promax.safetensors');
    const item = classifyModelFile(f, 'Test Source', tmpDir);
    expect(item?.category).toBe('controlnets');
  });

  it('classifies a plain large safetensors file as a checkpoint by default', () => {
    const f = makeFile('checkpoints/RealVisXL_V5.0_Lightning_fp16.safetensors');
    const item = classifyModelFile(f, 'Test Source', tmpDir);
    expect(item?.category).toBe('checkpoints');
  });

  it('filters out ggml-vocab- helper files entirely', () => {
    const f = makeFile('llm/ggml-vocab-llama.gguf');
    const item = classifyModelFile(f, 'Test Source', tmpDir);
    expect(item).toBeNull();
  });

  it('reports a relative path rooted at the scan directory', () => {
    const f = makeFile('llm/model.gguf');
    const item = classifyModelFile(f, 'Test Source', tmpDir);
    expect(item?.relativePath).toBe('llm/model.gguf');
  });
});
