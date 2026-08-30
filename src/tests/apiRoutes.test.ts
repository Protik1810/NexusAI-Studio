import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
const { createApiRouter } = require('../../electron/engine/apiRoutes.cjs');

type Listener = (chunk?: Buffer) => void;

function mockReq(method: string, headers: Record<string, string> = {}, body?: string) {
  const listeners: Record<string, Listener[]> = {};
  return {
    method,
    headers,
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
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '' as string,
    setHeader(name: string, value: string) { res.headers[name] = value; },
    end(chunk?: string) { if (chunk) res.body = chunk; }
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
