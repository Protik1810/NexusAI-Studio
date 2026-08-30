import { describe, it, expect } from 'vitest';
const { generateApiKey, safeCompare, isAuthorized } = require('../../electron/engine/agentAuth.cjs');

describe('agentAuth - generateApiKey', () => {
  it('produces a key with the expected prefix and sufficient entropy', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^sk-solframe-[0-9a-f]{48}$/);
  });

  it('produces a different key on each call', () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});

describe('agentAuth - safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('sk-solframe-abc123', 'sk-solframe-abc123')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(safeCompare('sk-solframe-abc123', 'sk-solframe-abc124')).toBe(false);
  });

  it('returns false for strings of different lengths without throwing', () => {
    expect(() => safeCompare('short', 'a-much-longer-string')).not.toThrow();
    expect(safeCompare('short', 'a-much-longer-string')).toBe(false);
  });
});

describe('agentAuth - isAuthorized', () => {
  const apiKey = 'sk-solframe-testkey1234567890';

  it('authorizes a correct Bearer token', () => {
    expect(isAuthorized({ headers: { authorization: `Bearer ${apiKey}` } }, apiKey)).toBe(true);
  });

  it('is case-insensitive on the "Bearer" scheme name', () => {
    expect(isAuthorized({ headers: { authorization: `bearer ${apiKey}` } }, apiKey)).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(isAuthorized({ headers: { authorization: 'Bearer sk-solframe-wrongkey' } }, apiKey)).toBe(false);
  });

  it('rejects a missing Authorization header', () => {
    expect(isAuthorized({ headers: {} }, apiKey)).toBe(false);
  });

  it('rejects a malformed Authorization header (no Bearer scheme)', () => {
    expect(isAuthorized({ headers: { authorization: apiKey } }, apiKey)).toBe(false);
  });

  it('rejects an empty token after Bearer', () => {
    expect(isAuthorized({ headers: { authorization: 'Bearer ' } }, apiKey)).toBe(false);
  });
});
