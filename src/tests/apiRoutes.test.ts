import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Writable } from 'stream';
const { createApiRouter } = require('../../electron/engine/apiRoutes.cjs');

type Listener = (chunk?: Buffer) => void;

function mockReq(method: string, headers: Record<string, string> = {}, body?: string) {
  const listeners: Record<string, Listener[]> = {};
  return {
    method,
    // Real requests to this server always carry a Host header naming where
    // the browser thinks it's connecting — default to the real one here so
    // tests aren't all tripped up by the isAllowedHost check; individual
    // tests override this via the headers param to exercise that check.
    headers: { host: 'localhost:1420', ...headers },
    on(event: string, cb: Listener) {
      (listeners[event] ||= []).push(cb);
      if (event === 'end') {
        if (body !== undefined) listeners['data']?.forEach(fn => fn(Buffer.from(body)));
        cb();
      }
      return this;
    }
  };
}

function mockRes() {
  // A real Writable so fs.createReadStream(...).pipe(res) — used by the
  // /outputs/* file-serving route — works against this mock exactly like a
  // real http.ServerResponse, without hand-rolling EventEmitter semantics.
  const chunks: Buffer[] = [];
  const res: any = new Writable({
    write(chunk, _enc, cb) { chunks.push(chunk); cb(); }
  });
  res.statusCode = 200;
  res.headers = {} as Record<string, string>;
  res.body = '';
  res.setHeader = (name: string, value: string) => { res.headers[name] = value; };
  const originalEnd = res.end.bind(res);
  res.end = (chunk?: string) => {
    if (chunk) { res.body = chunk; return originalEnd(); }
    const result = originalEnd();
    if (chunks.length) res.body = Buffer.concat(chunks).toString('utf8');
    return result;
  };
  return res;
}

function makeCtx(overrides: Partial<Record<string, any>> = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solframe-test-'));
  return {
    rootDir,
    resourcesPath: rootDir,
    port: 1420,
    getSdCliExecutable: () => path.join(rootDir, 'sd-cli.exe'),
    getLlamaExecutable: () => path.join(rootDir, 'llama-server.exe'),
    resolveModel: (p: string) => p,
    loadCustomScanPaths: () => [],
    saveCustomScanPaths: vi.fn(),
    userOutputsDir: rootDir,
    cacheFilePaths: { globalCacheDir: rootDir, globalCacheFile: path.join(rootDir, 'cache.json'), localCacheFile: path.join(rootDir, 'local.json') },
    ...overrides
  };
}

describe('apiRoutes - origin enforcement', () => {
  it('rejects /api/* requests from a foreign browser origin with 403', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('GET', { origin: 'https://evil.example.com' });
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/api/hardware-info'));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(403);
  });

  it('serves /api/hardware-info for a same-origin (no Origin header) request', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('GET');
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/api/hardware-info'));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload).toHaveProperty('preferredBackend');
  });

  it('ignores non-API routes so the caller can fall through to static serving', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('GET');
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/index.html'));
    expect(handled).toBe(false);
  });

  it('rejects a DNS-rebound Host header with no Origin header (the origin-only check would have allowed this)', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('GET', { host: 'evil.example.com:1420' });
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/api/hardware-info'));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(403);
  });
});

describe('apiRoutes - /api/download-model path safety', () => {
  it('rejects a targetFolder that escapes the app root directory', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('POST', {}, JSON.stringify({
      repo: 'someuser/somerepo',
      filename: 'model.gguf',
      targetFolder: '../../../../Windows/System32',
      customFilename: 'evil.exe'
    }));
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/api/download-model'));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('rejects a repo id containing characters outside owner/name', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('POST', {}, JSON.stringify({
      repo: 'evil@host.com', filename: 'model.gguf', targetFolder: 'models/llm'
    }));
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/api/download-model'));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid repo format/);
  });

  it('accepts a canonical repo id with no owner segment (e.g. "bert-base-uncased")', async () => {
    // The handler fires the actual download detached from the response, so
    // stub fetch to keep this a real unit test rather than a live network
    // call — only the synchronous format-validation path is under test.
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, body: null, headers: new Headers()
    } as Response);
    try {
      const router = createApiRouter(makeCtx());
      const req = mockReq('POST', {}, JSON.stringify({
        repo: 'bert-base-uncased', filename: 'config.json', targetFolder: 'models/llm'
      }));
      const res = mockRes();
      const handled = await router.handle(req, res, new URL('http://localhost/api/download-model'));
      expect(handled).toBe(true);
      expect(res.statusCode).not.toBe(400);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('apiRoutes - mutating routes require POST', () => {
  const cases: [string, string][] = [
    ['/api/rescan', 'GET'],
    ['/api/llama/stop', 'GET'],
    ['/api/cancel-download', 'GET']
  ];

  for (const [route, method] of cases) {
    it(`rejects ${method} ${route} with 405 (only POST performs the side effect)`, async () => {
      const router = createApiRouter(makeCtx());
      const req = mockReq(method);
      const res = mockRes();
      const handled = await router.handle(req, res, new URL(`http://localhost${route}`));
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(405);
    });
  }
});

describe('apiRoutes - /outputs/* file serving', () => {
  // Regression test: vite.config.ts's dev-mode plugin only wires this
  // router (no separate static-file serving of its own, unlike
  // electron/server.cjs), so a generated image was never actually
  // viewable when running `npm run dev` — the request fell through this
  // handler unhandled and dead-ended at Vite's SPA index.html fallback.
  // Confirmed live: a real FLUX generation produced a correct 595KB PNG on
  // disk, but the browser's <img> got back a 741-byte text/html response.
  it('serves a generated image from userOutputsDir with an image/png content type', async () => {
    const ctx = makeCtx();
    fs.writeFileSync(path.join(ctx.userOutputsDir, 'gen_123.png'), Buffer.from('fake-png-bytes'));
    const router = createApiRouter(ctx);
    const req = mockReq('GET');
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/outputs/gen_123.png?t=1'));
    // fs.createReadStream(...).pipe(res) streams asynchronously — handle()
    // returns as soon as the pipe *starts*, not once it's finished.
    await new Promise(resolve => res.on('finish', resolve));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/png');
    expect(res.body).toBe('fake-png-bytes');
  });

  it('returns 404 for a filename that does not exist, instead of falling through', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('GET');
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/outputs/missing.png'));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(404);
  });

  it('does not allow path traversal out of userOutputsDir', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('GET');
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/outputs/..%2f..%2fetc%2fpasswd'));
    expect(handled).toBe(true);
    expect(res.statusCode).not.toBe(200);
  });
});

describe('apiRoutes - /api/download-progress', () => {
  it('never serializes the internal abortController', async () => {
    const router = createApiRouter(makeCtx());
    const req = mockReq('GET');
    const res = mockRes();
    const handled = await router.handle(req, res, new URL('http://localhost/api/download-progress'));
    expect(handled).toBe(true);
    expect(res.body).not.toContain('abortController');
    expect(() => JSON.parse(res.body)).not.toThrow();
  });
});
