import { describe, it, expect } from 'vitest';
import {
  PRESET_MODELS,
  getPreset,
  parseSizeGB,
  getStarterPacks
} from '../services/modelCatalog';

describe('parseSizeGB', () => {
  it('reads gigabyte sizes', () => {
    expect(parseSizeGB('7.22 GB')).toBeCloseTo(7.22, 2);
  });

  it('tolerates the "~" the catalog uses for approximate sizes', () => {
    expect(parseSizeGB('~6.6 GB')).toBeCloseTo(6.6, 2);
  });

  it('converts megabytes, so a 311 MB LoRA is not counted as 311 GB', () => {
    expect(parseSizeGB('311 MB')).toBeCloseTo(311 / 1024, 3);
  });

  it('returns 0 rather than NaN for an unparseable size', () => {
    // NaN would silently poison a pack total, which is worse than 0.
    expect(parseSizeGB('unknown')).toBe(0);
  });
});

describe('getPreset', () => {
  it('finds a preset by id', () => {
    expect(getPreset('flux2-klein-4b-fp8')?.category).toBe('unet');
  });

  it('returns undefined for an unknown id', () => {
    expect(getPreset('does-not-exist')).toBeUndefined();
  });
});

describe('getStarterPacks', () => {
  it('always offers a standard, a flux and a chat pack', () => {
    expect(getStarterPacks(24).map(p => p.pipeline)).toEqual(['standard', 'flux', 'chat']);
  });

  it('picks full-precision FLUX parts on a 16 GB+ card', () => {
    const flux = getStarterPacks(24).find(p => p.pipeline === 'flux')!;
    const ids = flux.items.map(i => i.preset.id);
    expect(ids).toContain('flux2-klein-4b');
    expect(ids).toContain('qwen3-vl-4b-heretic');
  });

  it('drops to fp8 parts below 16 GB', () => {
    const flux = getStarterPacks(12).find(p => p.pipeline === 'flux')!;
    const ids = flux.items.map(i => i.preset.id);
    expect(ids).toContain('flux2-klein-4b-fp8');
    expect(ids).toContain('qwen3-vl-4b-heretic-fp8');
  });

  it('treats a nominal 12 GB card as low-VRAM', () => {
    // GPUs report just under their marketing size — a "12 GB" 4070 Ti reads
    // 11.99 GiB — so the threshold must not sit on a nominal capacity.
    const ids = getStarterPacks(11.99).find(p => p.pipeline === 'flux')!.items.map(i => i.preset.id);
    expect(ids).toContain('flux2-klein-4b-fp8');
  });

  it('includes the diffusion model, text encoder and VAE a FLUX run needs', () => {
    const cats = getStarterPacks(24).find(p => p.pipeline === 'flux')!
      .items.filter(i => !i.optional).map(i => i.preset.category);
    expect(cats).toEqual(expect.arrayContaining(['unet', 'clip', 'vae']));
  });

  it('marks the LoRA optional and leaves it out of the headline total', () => {
    const flux = getStarterPacks(24).find(p => p.pipeline === 'flux')!;
    const lora = flux.items.find(i => i.preset.category === 'lora')!;
    expect(lora.optional).toBe(true);
    const required = flux.items.filter(i => !i.optional)
      .reduce((sum, i) => sum + parseSizeGB(i.preset.size), 0);
    expect(flux.totalGB).toBeCloseTo(Math.round(required * 10) / 10, 1);
  });

  it('offers the 3B chat model when there is VRAM for it, else the 1B', () => {
    expect(getStarterPacks(8).find(p => p.pipeline === 'chat')!.items[0].preset.id)
      .toBe('llama-32-3b-uncensored');
    expect(getStarterPacks(0).find(p => p.pipeline === 'chat')!.items[0].preset.id)
      .toBe('llama-32-1b-uncensored');
  });

  it('falls back to the smallest builds when VRAM is unknown (0)', () => {
    // Detection failing must not hand a CPU-only machine the 16 GB pack.
    const ids = getStarterPacks(0).find(p => p.pipeline === 'flux')!.items.map(i => i.preset.id);
    expect(ids).toContain('flux2-klein-4b-fp8');
  });

  it('keeps the standard pack a single self-contained checkpoint', () => {
    const std = getStarterPacks(24).find(p => p.pipeline === 'standard')!;
    expect(std.items).toHaveLength(1);
    expect(std.items[0].preset.category).toBe('checkpoint');
  });

  it('every pack item resolves to a real catalog entry with a role', () => {
    for (const vram of [0, 8, 12, 24]) {
      for (const pack of getStarterPacks(vram)) {
        expect(pack.items.length).toBeGreaterThan(0);
        expect(pack.totalGB).toBeGreaterThan(0);
        for (const item of pack.items) {
          expect(PRESET_MODELS).toContain(item.preset);
          expect(item.role).toBeTruthy();
        }
      }
    }
  });
});
