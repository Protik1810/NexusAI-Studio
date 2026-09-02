/**
 * apiRoutes.cjs — The single HTTP API implementation for Solframe Studio.
 *
 * Both electron/server.cjs (production, packaged app) and vite.config.ts
 * (dev mode, `npm run dev`) construct one instance of this router and hand
 * every request to it. There is deliberately no second copy of this logic
 * anywhere else — a behavior change here is a behavior change in both modes.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Readable } = require('stream');
const { detectHardware } = require('./hardware.cjs');
const { getAllSystemScanPaths, getUserModelsRoot } = require('./pathUtils.cjs');
const { getFullSystemModels, loadScanCache, saveScanCache } = require('./modelScanner.cjs');
const { createEngineCore } = require('./engineCore.cjs');
const { createAgentApiServer } = require('./agentApiServer.cjs');
const { loadOrCreateConfig, saveConfig, generateApiKey } = require('./agentAuth.cjs');
const { isAllowedOrigin, isAllowedHost, safeJoin, applySecurityHeaders } = require('./security.cjs');

const WIN_LIBRARY_DEFINITIONS = [
  {
    id: 'vulkan-sd',
    name: 'Vulkan Diffusion Engine',
    category: 'Vulkan GPU (Cross-Platform)',
    description: 'High-speed GPU diffusion engine for AMD Radeon, Intel Arc & NVIDIA GPUs',
    requiredFor: 'AMD/Intel/NVIDIA Image Synthesis',
    files: [
      { path: 'backend/win/vulkan/sd-cli.exe', name: 'sd-cli.exe', required: true },
      { path: 'backend/win/vulkan/stable-diffusion.dll', name: 'stable-diffusion.dll (Vulkan)', required: true }
    ]
  },
  {
    id: 'cuda-sd',
    name: 'CUDA 12 Diffusion Engine',
    category: 'NVIDIA CUDA Acceleration',
    description: 'NVIDIA Tensor Core accelerated diffusion kernel for FLUX.2 & SDXL',
    requiredFor: 'NVIDIA Maximum GPU Speed',
    files: [
      { path: 'backend/win/cuda/sd-cli.exe', name: 'sd-cli.exe (CUDA)', required: true },
      { path: 'backend/win/cuda/stable-diffusion.dll', name: 'stable-diffusion.dll (CUDA)', required: true },
      { path: 'backend/win/cuda/cublasLt64_12.dll', name: 'cublasLt64_12.dll (Tensor Cores)', required: true },
      { path: 'backend/win/cuda/cublas64_12.dll', name: 'cublas64_12.dll (cuBLAS)', required: true },
      { path: 'backend/win/cuda/cudart64_12.dll', name: 'cudart64_12.dll (CUDA Runtime)', required: true }
    ]
  },
  {
    id: 'llama-engine',
    name: 'llama.cpp Server Runtime',
    category: 'Local LLM Dialogue Engine',
    description: 'Real-time GGUF token streaming engine with CUDA & Vulkan GPU offload',
    requiredFor: 'Uncensored LLM Chat',
    files: [
      { path: 'backend/win/llama/llama-server.exe', name: 'llama-server.exe', required: true },
      { path: 'backend/win/llama/llama.dll', name: 'llama.dll', required: true },
      { path: 'backend/win/llama/llama-common.dll', name: 'llama-common.dll', required: true },
      { path: 'backend/win/llama/llama-server-impl.dll', name: 'llama-server-impl.dll', required: true },
      { path: 'backend/win/llama/libomp.dll', name: 'libomp.dll (OpenMP)', required: true }
    ]
  },
  {
    id: 'llama-cuda',
    name: 'llama.cpp CUDA GPU Layer',
    category: 'NVIDIA CUDA Acceleration',
    description: 'CUDA GPU offloading kernel for llama.cpp token generation',
    requiredFor: 'NVIDIA LLM GPU Speed',
    files: [
      { path: 'backend/win/llama/ggml-cuda.dll', name: 'ggml-cuda.dll', required: false }
    ]
  }
];

const MAC_LIBRARY_DEFINITIONS = [
  {
    id: 'metal-sd',
    name: 'Metal Diffusion Engine',
    category: 'Apple Metal GPU Acceleration',
    description: 'Metal-accelerated diffusion kernel for FLUX.2 & SDXL on Apple Silicon/Intel GPUs',
    requiredFor: 'Apple Silicon Image Synthesis',
    files: [
      { path: 'backend/mac/metal/sd-cli', name: 'sd-cli', required: true },
      { path: 'backend/mac/metal/libstable-diffusion.dylib', name: 'libstable-diffusion.dylib (Metal)', required: true }
    ]
  },
  {
    id: 'llama-engine',
    name: 'llama.cpp Server Runtime',
    category: 'Local LLM Dialogue Engine',
    description: 'Real-time GGUF token streaming engine with Metal GPU offload',
    requiredFor: 'Uncensored LLM Chat',
    files: [
      { path: 'backend/mac/llama/llama-server', name: 'llama-server', required: true },
      { path: 'backend/mac/llama/libllama.dylib', name: 'libllama.dylib', required: true },
      { path: 'backend/mac/llama/libggml-metal.dylib', name: 'libggml-metal.dylib (Metal)', required: true },
      { path: 'backend/mac/llama/libggml-cpu.dylib', name: 'libggml-cpu.dylib', required: true }
    ]
  }
];

const LIBRARY_DEFINITIONS = process.platform === 'darwin' ? MAC_LIBRARY_DEFINITIONS : WIN_LIBRARY_DEFINITIONS;

/**
 * Compares two plain "x.y.z" version strings (a leading "v" on either is
 * tolerated, since GitHub tag names use it but package.json's version never
 * does). Returns true if `latest` is strictly newer than `current`. No
 * semver ranges/prerelease handling — every tag this project has actually
 * cut is a plain three-part version, so a full semver dependency isn't
 * warranted for this one comparison.
 */
function isNewerVersion(current, latest) {
  const parse = v => String(v).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] || 0) - (a[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * @param {object} ctx
 * @param {string} ctx.rootDir - App root directory
 * @param {string} ctx.resourcesPath - electron-builder resources path (== rootDir in dev)
 * @param {number} ctx.port - Port this server listens on (for Origin validation)
 * @param {() => string} ctx.getSdCliExecutable
 * @param {() => string} ctx.getLlamaExecutable
 * @param {(p: string) => string} ctx.resolveModel - Resolve a model name/path using this app's rootDir + custom scan paths
 * @param {() => string[]} ctx.loadCustomScanPaths
 * @param {(paths: string[]) => void} ctx.saveCustomScanPaths
 * @param {string} ctx.userOutputsDir - Writable directory for generated images
 * @param {{globalCacheFile: string, globalCacheDir: string, localCacheFile: string}} ctx.cacheFilePaths
 */
function createApiRouter(ctx) {
  const {
    rootDir, resourcesPath, port,
    getSdCliExecutable, getLlamaExecutable, resolveModel,
    loadCustomScanPaths, saveCustomScanPaths,
    userOutputsDir, cacheFilePaths, isDev
  } = ctx;

  const engineCore = createEngineCore({ getSdCliExecutable, getLlamaExecutable, resolveModel, rootDir, userOutputsDir });

  let agentConfig = loadOrCreateConfig();
  const agentServer = createAgentApiServer({
    engineCore,
    getCachedModels: () => cachedModels,
    userOutputsDir,
    getApiKey: () => agentConfig.apiKey
  });

  let activeDownload = {
    isDownloading: false, filename: '', repo: '', targetFolder: '',
    targetPath: '', downloadedBytes: 0, totalBytes: 0,
    percent: 0, speedMBs: 0, status: 'idle'
  };

  let scanState = 'idle';
  let scanProgress = 0;
  let scanTotal = 0;
  let cachedModels = null;

  // { checkedAt, result } — a release doesn't need sub-hour freshness, and
  // this avoids hammering GitHub's API on every remount/re-render of the
  // About page during a single session.
  let updateCheckCache = null;
  const UPDATE_CHECK_TTL_MS = 60 * 60 * 1000;

  function runBackgroundScan() {
    if (scanState === 'scanning') return;
    scanState = 'scanning';
    const state = {};
    console.log('[Solframe] Starting background model scan...');
    setImmediate(() => {
      try {
        const result = getFullSystemModels(rootDir, loadCustomScanPaths(), state);
        cachedModels = result;
        saveScanCache(result, cacheFilePaths);
        scanState = 'ready';
        scanProgress = state.scanProgress || 0;
        scanTotal = state.scanTotal || 0;
        const total = Object.values(result.modelsByCategory).reduce((acc, arr) => acc + arr.length, 0);
        console.log(`[Solframe] Scan complete: ${total} models found across ${result.scanPaths.length} directories.`);
      } catch (e) {
        scanState = 'error';
        console.error('[Solframe] Scan error:', e.message);
      }
    });
  }

  function init() {
    cachedModels = loadScanCache(cacheFilePaths);
    if (cachedModels) {
      scanState = 'ready';
      console.log('[Solframe] Loaded model cache. Running background rescan...');
    }
    runBackgroundScan();

    if (agentConfig.enabled) {
      agentServer.start(agentConfig.port).catch(e => {
        console.error(`[Solframe] Agent API server failed to start on port ${agentConfig.port}: ${e.message}`);
      });
    }
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  }

  /**
   * Handle one request if it matches an /api/* route.
   * @returns {Promise<boolean>} true if handled, false if the caller should
   *   fall through to static file serving (production) or Vite's own
   *   middleware chain (dev).
   */
  /**
   * Reverse-proxy /llama-api/* to the embedded llama-server started by
   * /api/llama/start, forwarding the request/response bodies unbuffered so
   * SSE token streaming still works. Dev mode (vite.config.ts) previously
   * had its own copy of this proxy hardcoded to port 8080; that copy never
   * existed here, so the packaged production app had no way to reach the
   * embedded LLM at all once it started — every chat request silently fell
   * through to the SPA's index.html fallback instead of the model.
   */
  function proxyToLlama(req, res, pathname, search) {
    return new Promise(resolve => {
      if (!isAllowedHost(req, port) || !isAllowedOrigin(req, port)) {
        sendJson(res, 403, { success: false, error: 'Forbidden origin' });
        resolve(true);
        return;
      }
      const llamaPort = engineCore.getLlamaPort();
      const targetPath = (pathname.replace(/^\/llama-api/, '') || '/') + (search || '');
      const proxyReq = http.request({
        host: '127.0.0.1',
        port: llamaPort,
        path: targetPath,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${llamaPort}` }
      }, proxyRes => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
        resolve(true);
      });
      proxyReq.on('error', () => {
        if (!res.headersSent) {
          sendJson(res, 502, { success: false, error: 'llama.cpp engine is not running. Click "Start Engine" first.' });
        } else {
          res.end();
        }
        resolve(true);
      });
      req.pipe(proxyReq);
    });
  }

  async function handle(req, res, parsedUrl) {
    applySecurityHeaders(res, isDev);
    const pathname = parsedUrl.pathname;
    if (pathname.startsWith('/llama-api/')) {
      return proxyToLlama(req, res, pathname, parsedUrl.search);
    }
    // Generated images live in userOutputsDir (AppData/.../Solframe
    // Studio/outputs), outside both publicDir and distDir — electron/
    // server.cjs's own static-file serving already special-cased this for
    // the packaged app, but vite.config.ts's dev-mode plugin only wires
    // this router, so a generated image was never actually viewable when
    // running `npm run dev`: the request fell through this handler
    // (unhandled) into Vite's own static middleware, which only knows
    // about publicDir/distDir, and dead-ended at the SPA's index.html —
    // same dev/prod parity gap this file's /llama-api proxy above was
    // written to close. Handling it here instead of duplicating it in
    // vite.config.ts keeps a single implementation for both, same as
    // everything else in this router.
    if (pathname.startsWith('/outputs/')) {
      const outputFilename = pathname.replace(/^.*\//, '');
      let filePath;
      try {
        const userFile = safeJoin(userOutputsDir, outputFilename);
        filePath = fs.existsSync(userFile) ? userFile : safeJoin(rootDir, 'public/outputs', outputFilename);
      } catch (e) {
        res.statusCode = 400;
        res.end('Bad Request');
        return true;
      }
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('Not Found');
        return true;
      }
      res.setHeader('Content-Type', 'image/png');
      fs.createReadStream(filePath).pipe(res);
      return true;
    }
    if (!pathname.startsWith('/api/')) return false;

    // This server has no authentication. Any website open in the user's
    // regular browser can otherwise script requests at 127.0.0.1:<port> and
    // spawn processes, read the filesystem layout, or trigger downloads
    // (CSRF / "localhost drive-by"). Reject anything declaring a foreign
    // Origin before it reaches a handler; same-origin/non-browser requests
    // (no Origin header) are unaffected.
    //
    // The Origin check alone has a DNS-rebinding gap: after a rebind, an
    // attacker's page becomes same-origin with 127.0.0.1:<port> from the
    // browser's own perspective and sends no Origin header, sailing through
    // the check above untouched. The browser still can't spoof the Host
    // header to match the real destination, though — it's set from the
    // fetched URL, not the resolved IP — so check that first.
    if (!isAllowedHost(req, port)) {
      sendJson(res, 403, { success: false, error: 'Forbidden host' });
      return true;
    }
    if (!isAllowedOrigin(req, port)) {
      sendJson(res, 403, { success: false, error: 'Forbidden origin' });
      return true;
    }
    res.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${port}`);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return true;
    }

    if (pathname === '/api/libraries-status') {
      const hw = detectHardware();
      const evaluated = LIBRARY_DEFINITIONS.map(def => {
        let allFilesPresent = true;
        const fileDetails = def.files.map(f => {
          const p1 = path.join(rootDir, f.path);
          const p2 = path.join(resourcesPath, f.path);
          const exists = fs.existsSync(p1) || fs.existsSync(p2);
          const targetPath = fs.existsSync(p1) ? p1 : p2;
          let sizeMB = '0 MB';
          if (exists) {
            try { sizeMB = `${(fs.statSync(targetPath).size / (1024 * 1024)).toFixed(1)} MB`; } catch (e) {}
          } else if (f.required) {
            allFilesPresent = false;
          }
          return { name: f.name, defaultRelativePath: f.path, absolutePath: targetPath, exists, sizeMB, required: f.required };
        });
        return {
          id: def.id, name: def.name, category: def.category, description: def.description,
          requiredFor: def.requiredFor, installed: allFilesPresent, files: fileDetails
        };
      });
      const totalRequiredMissing = evaluated.filter(e => !e.installed).length;
      sendJson(res, 200, { libraries: evaluated, allReady: totalRequiredMissing === 0, missingCount: totalRequiredMissing, hardware: hw });
      return true;
    }

    if (pathname === '/api/hardware-info') {
      sendJson(res, 200, detectHardware());
      return true;
    }

    if (pathname === '/api/scan-status') {
      const total = cachedModels
        ? Object.values(cachedModels.modelsByCategory).reduce((acc, arr) => acc + arr.length, 0)
        : 0;
      sendJson(res, 200, { status: scanState, progress: scanProgress, total: scanTotal, modelCount: total, cachedAt: cachedModels?.cachedAt || null });
      return true;
    }

    if (pathname === '/api/rescan') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      if (scanState !== 'scanning') {
        cachedModels = null;
        runBackgroundScan();
      }
      sendJson(res, 200, { success: true, message: 'Background rescan started' });
      return true;
    }

    if (pathname === '/api/system-models') {
      const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [], mmprojs: [] }, scanPaths: [] };
      sendJson(res, 200, {
        ...data.modelsByCategory,
        scanPaths: (data.scanPaths || []).map(s => ({ path: s.path, label: s.label, isBuiltIn: s.isBuiltIn })),
        scanStatus: scanState,
        cachedAt: data.cachedAt || null
      });
      return true;
    }

    if (pathname === '/api/local-models') {
      const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [], mmprojs: [] } };
      const m = data.modelsByCategory;
      const toEntry = item => ({ name: item.filename, fullPath: item.fullPath, size: item.formattedSize });
      sendJson(res, 200, {
        checkpoints: (m.checkpoints || []).map(toEntry),
        unets: (m.unets || []).map(toEntry),
        clips: (m.clips || []).map(toEntry),
        loras: (m.loras || []).map(toEntry),
        vaes: (m.vaes || []).map(toEntry),
        controlnets: (m.controlnets || []).map(toEntry),
        scanStatus: scanState
      });
      return true;
    }

    if (pathname === '/api/local-llm-models') {
      const data = cachedModels || { modelsByCategory: { llms: [], clips: [], mmprojs: [] } };
      const m = data.modelsByCategory;
      const llmModels = [...(m.llms || []), ...(m.clips || []).filter(item => item.isGguf)];
      sendJson(res, 200, { models: llmModels, mmprojs: m.mmprojs || [], scanStatus: scanState });
      return true;
    }

    if (pathname === '/api/custom-scan-paths') {
      if (req.method === 'POST') {
        try {
          const { action, dirPath } = JSON.parse(await readBody(req));
          let current = loadCustomScanPaths();
          if (action === 'add' && dirPath && fs.existsSync(dirPath)) {
            current.push(dirPath);
            saveCustomScanPaths(current);
          } else if (action === 'remove' && dirPath) {
            current = current.filter(p => p !== dirPath);
            saveCustomScanPaths(current);
          }
          sendJson(res, 200, { success: true, customPaths: current, scanPaths: getAllSystemScanPaths(rootDir, current) });
        } catch (e) {
          sendJson(res, 500, { success: false, error: e.message });
        }
        return true;
      }
      const custom = loadCustomScanPaths();
      sendJson(res, 200, { customPaths: custom, scanPaths: getAllSystemScanPaths(rootDir, custom) });
      return true;
    }

    if (pathname === '/api/llama/status') {
      sendJson(res, 200, engineCore.getLlamaStatus());
      return true;
    }

    if (pathname === '/api/llama/stop') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      engineCore.stopLlama();
      sendJson(res, 200, { success: true, message: 'llama-server stopped' });
      return true;
    }

    if (pathname === '/api/llama/start') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      try {
        const params = JSON.parse(await readBody(req));
        const result = await engineCore.startLlama(params);
        sendJson(res, 200, result);
      } catch (e) {
        sendJson(res, e.statusCode || 500, { success: false, error: e.message });
      }
      return true;
    }

    if (pathname === '/api/agent-server/status') {
      sendJson(res, 200, { enabled: agentConfig.enabled, port: agentConfig.port, running: agentServer.isRunning(), apiKey: agentConfig.apiKey });
      return true;
    }

    if (pathname === '/api/agent-server/config') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      try {
        const { enabled, port } = JSON.parse(await readBody(req));
        const nextEnabled = typeof enabled === 'boolean' ? enabled : agentConfig.enabled;
        const nextPort = Number.isInteger(port) && port > 0 && port < 65536 ? port : agentConfig.port;
        const portChanged = nextPort !== agentConfig.port;

        if (agentServer.isRunning() && (!nextEnabled || portChanged)) {
          await agentServer.stop();
        }
        agentConfig = { ...agentConfig, enabled: nextEnabled, port: nextPort };
        saveConfig(agentConfig);

        if (nextEnabled && !agentServer.isRunning()) {
          await agentServer.start(nextPort);
        }
        sendJson(res, 200, { success: true, enabled: agentConfig.enabled, port: agentConfig.port, running: agentServer.isRunning() });
      } catch (e) {
        sendJson(res, 500, { success: false, error: e.message });
      }
      return true;
    }

    if (pathname === '/api/agent-server/regenerate-key') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      agentConfig = { ...agentConfig, apiKey: generateApiKey() };
      saveConfig(agentConfig);
      sendJson(res, 200, { success: true, apiKey: agentConfig.apiKey });
      return true;
    }

    if (pathname === '/api/check-update') {
      const currentVersion = require(path.join(rootDir, 'package.json')).version;
      const now = Date.now();
      if (updateCheckCache && now - updateCheckCache.checkedAt < UPDATE_CHECK_TTL_MS) {
        sendJson(res, 200, updateCheckCache.result);
        return true;
      }
      try {
        const ghRes = await fetch('https://api.github.com/repos/Protik1810/Solframe-Studio/releases/latest', {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Solframe-Studio' },
          signal: AbortSignal.timeout(5000)
        });
        if (!ghRes.ok) throw new Error(`GitHub API HTTP ${ghRes.status}`);
        const release = await ghRes.json();
        const latestVersion = String(release.tag_name || '').replace(/^v/i, '');
        const result = {
          currentVersion,
          latestVersion,
          updateAvailable: !!latestVersion && isNewerVersion(currentVersion, latestVersion),
          releaseUrl: release.html_url || 'https://github.com/Protik1810/Solframe-Studio/releases'
        };
        updateCheckCache = { checkedAt: now, result };
        sendJson(res, 200, result);
      } catch (e) {
        // Offline, GitHub down, rate-limited, etc. — never let this break
        // the About page; just report no update available.
        sendJson(res, 200, { currentVersion, latestVersion: currentVersion, updateAvailable: false });
      }
      return true;
    }

    if (pathname === '/api/hf-search') {
      try {
        const q = parsedUrl.searchParams.get('q') || '';
        const pipelineTag = parsedUrl.searchParams.get('pipeline_tag') || '';
        const limit = parsedUrl.searchParams.get('limit') || '25';
        let hfUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;
        if (pipelineTag) hfUrl += `&pipeline_tag=${encodeURIComponent(pipelineTag)}`;
        const hfRes = await fetch(hfUrl);
        if (!hfRes.ok) {
          sendJson(res, hfRes.status, { error: `Hugging Face API error ${hfRes.status}` });
          return true;
        }
        const data = await hfRes.json();
        const models = (Array.isArray(data) ? data : []).map(m => ({
          id: m.id || m.modelId,
          author: m.id ? m.id.split('/')[0] : '',
          name: m.id ? m.id.split('/')[1] || m.id : '',
          downloads: m.downloads || 0,
          likes: m.likes || 0,
          pipeline_tag: m.pipeline_tag || '',
          tags: m.tags || [],
          lastModified: m.lastModified || m.createdAt || ''
        }));
        sendJson(res, 200, { models });
      } catch (e) {
        sendJson(res, 500, { error: e.message });
      }
      return true;
    }

    if (pathname === '/api/hf-tree') {
      try {
        const repo = parsedUrl.searchParams.get('repo');
        if (!repo) {
          sendJson(res, 400, { error: 'Missing repo parameter' });
          return true;
        }
        // repo is "owner/name" — encoding the whole string turns the "/"
        // into "%2F", which Hugging Face's API rejects with a 400 (verified
        // live). Encode each path segment separately so special characters
        // within owner/name are still safe without breaking the path itself.
        const encodedRepo = repo.split('/').map(encodeURIComponent).join('/');
        const hfRes = await fetch(`https://huggingface.co/api/models/${encodedRepo}/tree/main`);
        if (!hfRes.ok) {
          sendJson(res, hfRes.status, { error: `Hugging Face repo error ${hfRes.status}` });
          return true;
        }
        const items = await hfRes.json();
        const files = (Array.isArray(items) ? items : [])
          .filter(f => f.type === 'file')
          .map(f => {
            const sizeMB = (f.size || 0) / (1024 * 1024);
            const sizeGB = sizeMB / 1024;
            const formattedSize = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
            const ext = path.extname(f.path).toLowerCase();
            return {
              path: f.path, sizeBytes: f.size || 0, formattedSize,
              isGguf: ext === '.gguf', isSafetensors: ext === '.safetensors',
              downloadUrl: `https://huggingface.co/${repo}/resolve/main/${f.path}`
            };
          });
        sendJson(res, 200, { repo, files });
      } catch (e) {
        sendJson(res, 500, { error: e.message });
      }
      return true;
    }

    if (pathname === '/api/download-progress') {
      // abortController isn't meaningfully serializable — only serve the
      // plain status fields.
      const downloadStatus = { ...activeDownload };
      delete downloadStatus.abortController;
      sendJson(res, 200, downloadStatus);
      return true;
    }

    if (pathname === '/api/cancel-download') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      if (activeDownload.abortController) {
        try { activeDownload.abortController.abort(); } catch (e) {}
      }
      activeDownload.isDownloading = false;
      activeDownload.status = 'idle';
      sendJson(res, 200, { success: true, message: 'Download cancelled' });
      return true;
    }

    if (pathname === '/api/download-model') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      if (activeDownload.isDownloading) {
        sendJson(res, 409, { success: false, error: `Already downloading ${activeDownload.filename}. Please wait or cancel first.` });
        return true;
      }
      try {
        const params = JSON.parse(await readBody(req));
        const { repo, filename, targetFolder, customFilename } = params;
        if (!repo || !filename || !targetFolder) {
          sendJson(res, 400, { success: false, error: 'Missing required parameters (repo, filename, targetFolder)' });
          return true;
        }
        // A Hugging Face repo id is "owner/name", or just "name" for
        // canonical/legacy models (e.g. "bert-base-uncased", "gpt2") —
        // reject anything else before it goes anywhere near a URL or disk.
        if (!/^[\w.-]+(\/[\w.-]+)?$/.test(repo)) {
          sendJson(res, 400, { success: false, error: 'Invalid repo format — expected "owner/name" or "name"' });
          return true;
        }

        const finalFilename = path.basename(customFilename || filename);
        let destDir, targetPath;
        try {
          // Downloads land in the per-user Solframe Studio app-data folder,
          // not rootDir/resourcesPath — the latter is inside the app's own
          // install/bundle tree, which is read-only on Linux AppImage,
          // root-owned on .deb (/opt), and isn't even a real folder in a
          // packaged mac build (the app ships as an asar file). This is the
          // same location pathUtils.cjs's scanner already checks first via
          // getUserModelsRoot(), so a downloaded file is guaranteed
          // discoverable, survives app updates/reinstalls, and needs no
          // elevated permissions on any of the three platforms.
          //
          // targetFolder/customFilename come straight from the request body —
          // without safeJoin's traversal check, "../../.." would write
          // outside this directory.
          destDir = safeJoin(getUserModelsRoot(), targetFolder);
          targetPath = safeJoin(destDir, finalFilename);
        } catch (e) {
          sendJson(res, 400, { success: false, error: 'Invalid target path' });
          return true;
        }

        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const downloadUrl = `https://huggingface.co/${repo}/resolve/main/${filename}`;

        // Node's own fetch replaces a hardcoded curl.exe dependency — this
        // now also works on the Linux/macOS UI-preview path, not just Windows.
        const abortController = new AbortController();
        activeDownload = {
          isDownloading: true, filename: finalFilename, repo, targetFolder, targetPath,
          downloadedBytes: 0, totalBytes: 0, percent: 0, speedMBs: 0, status: 'downloading', startTime: Date.now(),
          abortController
        };

        (async () => {
          try {
            const dlRes = await fetch(downloadUrl, { signal: abortController.signal });
            if (!dlRes.ok || !dlRes.body) {
              throw new Error(`HTTP ${dlRes.status}`);
            }
            const len = dlRes.headers.get('content-length');
            if (len) activeDownload.totalBytes = parseInt(len, 10);

            const nodeStream = Readable.fromWeb(dlRes.body);
            nodeStream.on('data', chunk => {
              activeDownload.downloadedBytes += chunk.length;
              if (activeDownload.totalBytes > 0) {
                activeDownload.percent = Math.min(100, Math.round((activeDownload.downloadedBytes / activeDownload.totalBytes) * 100));
              }
              const elapsedSec = (Date.now() - activeDownload.startTime) / 1000;
              if (elapsedSec > 0) {
                activeDownload.speedMBs = parseFloat(((activeDownload.downloadedBytes / (1024 * 1024)) / elapsedSec).toFixed(1));
              }
            });

            await new Promise((resolve, reject) => {
              const writeStream = fs.createWriteStream(targetPath);
              nodeStream.pipe(writeStream);
              writeStream.on('finish', resolve);
              writeStream.on('error', reject);
              nodeStream.on('error', reject);
            });

            activeDownload.isDownloading = false;
            activeDownload.status = 'completed';
            activeDownload.percent = 100;
          } catch (err) {
            activeDownload.isDownloading = false;
            if (err.name === 'AbortError') {
              activeDownload.status = 'idle';
            } else {
              activeDownload.status = 'error';
              activeDownload.error = `Download failed: ${err.message}`;
            }
            // Either way this is a partial file, not a usable model — if it
            // happens to already be past the scanner's 5MB minimum size, a
            // left-behind partial would otherwise get picked up by the next
            // scan and shown as "Installed" even though it's truncated/corrupt.
            try { fs.unlinkSync(targetPath); } catch (e) {}
          }
        })();

        sendJson(res, 200, { success: true, targetPath });
      } catch (e) {
        sendJson(res, 500, { success: false, error: e.message });
      }
      return true;
    }

    if (pathname === '/api/sd-generate') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return true;
      }
      try {
        const params = JSON.parse(await readBody(req));

        // sd-cli prints its sampling progress bar to stdout as it goes, e.g.
        // "|====>   | 2/4 - 6.35it/s" — stream that to the client as SSE
        // instead of guessing progress with a client-side timer that has no
        // relationship to what the GPU is actually doing.
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        });
        // Writing after the client aborts (its usual way to cancel a
        // generation — see stableDiffusionCpp.ts's AbortController) would
        // otherwise emit an unhandled 'error' on the response stream.
        res.on('error', () => {});
        const sendEvent = payload => { try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {} };

        // There's no dedicated cancel endpoint: the client cancels by
        // aborting its fetch, which tears down this connection and fires
        // 'close' here — at which point there's nothing left to stream a
        // response to anyway, so just kill the still-running process.
        req.on('close', () => engineCore.cancelImage());

        try {
          const result = await engineCore.generateImage(params, {
            onStdout: line => {
              const m = line.match(/(\d+)\/(\d+)\s*-\s*([\d.]+)(it\/s|s\/it)/);
              if (!m) return;
              const [, step, total, rate, unit] = m;
              sendEvent({ step: Number(step), total: Number(total), message: `stable-diffusion.cpp GPU: Sampling Step ${step}/${total}... (${rate}${unit})` });
            }
          });
          sendEvent({ done: true, success: true, ...result });
        } catch (genErr) {
          sendEvent({ done: true, success: false, error: genErr.message });
        }
        res.end();
      } catch (e) {
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ done: true, success: false, error: e.message })}\n\n`);
          res.end();
        } else {
          sendJson(res, 500, { success: false, error: e.message });
        }
      }
      return true;
    }

    return false;
  }

  function dispose() {
    engineCore.dispose();
    agentServer.stop().catch(() => {});
    if (activeDownload.abortController) {
      try { activeDownload.abortController.abort(); } catch (e) {}
    }
  }

  return { init, handle, dispose, engineCore };
}

module.exports = { createApiRouter };
