import { describe, it, expect } from 'vitest';
import path from 'path';
const { safeJoin, isAllowedOrigin } = require('../../electron/engine/security.cjs');

describe('security - safeJoin', () => {
  const base = path.resolve(process.cwd(), 'models');

  it('joins a normal relative segment inside the base directory', () => {
    expect(safeJoin(base, 'checkpoints', 'model.safetensors')).toBe(
      path.join(base, 'checkpoints', 'model.safetensors')
    );
  });

  it('throws when a segment tries to escape the base directory with ../', () => {
    expect(() => safeJoin(base, '../../../../Windows/System32')).toThrow();
  });

  it('throws when an escape is buried after a valid-looking prefix', () => {
    expect(() => safeJoin(base, 'checkpoints/../../../secrets')).toThrow();
  });

  it('allows the base directory itself', () => {
    expect(safeJoin(base)).toBe(base);
  });
});

describe('security - isAllowedOrigin', () => {
  const port = 1420;

  it('allows requests with no Origin header (same-origin / non-browser)', () => {
    expect(isAllowedOrigin({ headers: {} }, port)).toBe(true);
  });

  it('allows a matching 127.0.0.1 origin', () => {
    expect(isAllowedOrigin({ headers: { origin: 'http://127.0.0.1:1420' } }, port)).toBe(true);
  });

  it('allows a matching localhost origin', () => {
    expect(isAllowedOrigin({ headers: { origin: 'http://localhost:1420' } }, port)).toBe(true);
  });

  it('rejects a foreign origin (e.g. a malicious website in the user\'s browser)', () => {
    expect(isAllowedOrigin({ headers: { origin: 'https://evil.example.com' } }, port)).toBe(false);
  });

  it('rejects an origin on the wrong port', () => {
    expect(isAllowedOrigin({ headers: { origin: 'http://127.0.0.1:9999' } }, port)).toBe(false);
  });
});
