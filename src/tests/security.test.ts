import { describe, it, expect } from 'vitest';
import path from 'path';
const { safeJoin, isAllowedOrigin, isAllowedHost, applySecurityHeaders } = require('../../electron/engine/security.cjs');

function fakeRes() {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k: string, v: string) => { headers[k] = v; } };
}

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

describe('security - isAllowedHost (DNS rebinding)', () => {
  const port = 1420;

  it('allows a matching 127.0.0.1 Host header', () => {
    expect(isAllowedHost({ headers: { host: '127.0.0.1:1420' } }, port)).toBe(true);
  });

  it('allows a matching localhost Host header', () => {
    expect(isAllowedHost({ headers: { host: 'localhost:1420' } }, port)).toBe(true);
  });

  it('rejects a DNS-rebound Host header even with no Origin header at all', () => {
    // The exact gap: after a DNS rebind, the browser treats the attacker's
    // page as same-origin with 127.0.0.1:1420 and omits Origin entirely —
    // isAllowedOrigin alone would let this through. The Host header still
    // names the original hostname the browser thinks it's talking to,
    // since browsers set it from the fetched URL, not the resolved IP.
    expect(isAllowedHost({ headers: { host: 'evil.example.com:1420' } }, port)).toBe(false);
  });

  it('rejects a Host header on the wrong port', () => {
    expect(isAllowedHost({ headers: { host: '127.0.0.1:9999' } }, port)).toBe(false);
  });

  it('rejects a missing Host header', () => {
    expect(isAllowedHost({ headers: {} }, port)).toBe(false);
  });
});

describe('security - applySecurityHeaders (CSP)', () => {
  it('sets a locked-down CSP and X-Content-Type-Options on every response', () => {
    const res = fakeRes();
    applySecurityHeaders(res, false);
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(res.headers['Content-Security-Policy']).toContain("object-src 'none'");
  });

  it('allows Google Fonts (style-src/font-src) since index.css @imports it', () => {
    const res = fakeRes();
    applySecurityHeaders(res, false);
    expect(res.headers['Content-Security-Policy']).toContain('https://fonts.googleapis.com');
    expect(res.headers['Content-Security-Policy']).toContain('https://fonts.gstatic.com');
  });

  it('does not allow inline scripts in production (isDev=false)', () => {
    const res = fakeRes();
    applySecurityHeaders(res, false);
    expect(res.headers['Content-Security-Policy']).toMatch(/script-src 'self'(?!.*unsafe-inline)/);
  });

  it('allows inline scripts only in dev mode, for Vite\'s React-refresh preamble', () => {
    const res = fakeRes();
    applySecurityHeaders(res, true);
    expect(res.headers['Content-Security-Policy']).toContain("script-src 'self' 'unsafe-inline'");
  });
});
