import { describe, it, expect } from 'vitest';
import { SD_CPP_SAMPLERS } from '../services/stableDiffusionCpp';
import { PRESET_MODELS } from '../services/modelCatalog';

describe('Frontend Services & Catalogs', () => {
  it('should have standard SD.cpp samplers defined with euler and euler_a', () => {
    expect(SD_CPP_SAMPLERS.length).toBeGreaterThan(0);
    const samplerIds = SD_CPP_SAMPLERS.map(s => s.id);
    expect(samplerIds).toContain('euler');
    expect(samplerIds).toContain('euler_a');
  });

  it('should validate all preset models have valid URLs and architectures', () => {
    expect(PRESET_MODELS.length).toBeGreaterThan(0);
    PRESET_MODELS.forEach(model => {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.downloadUrl.startsWith('https://')).toBe(true);
      // Image models land under models/<category>; chat models under
      // llm-models/. Both are scan paths under the user's models root —
      // anything else downloads somewhere the scanner never looks.
      expect(
        model.targetFolder.startsWith('models/') || model.targetFolder === 'llm-models'
      ).toBe(true);
    });
  });
});