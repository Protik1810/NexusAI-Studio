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
const { spawn } = require('child_process');
const { detectHardware } = require('./hardware.cjs');
const { getAllSystemScanPaths } = require('./pathUtils.cjs');
const { getFullSystemModels, loadScanCache, saveScanCache } = require('./modelScanner.cjs');
const { runSdCli, buildSdCliArgs } = require('./sdEngine.cjs');
const { isAllowedOrigin, safeJoin } = require('./security.cjs');

const LIBRARY_DEFINITIONS = [
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
    userOutputsDir, cacheFilePaths
  } = ctx;

  let llamaProc = null;
  let currentLlamaModel = null;
  let llamaPort = 8080;

  let activeDownload = {
    isDownloading: false, filename: '', repo: '', targetFolder: '',
    targetPath: '', downloadedBytes: 0, totalBytes: 0,
    percent: 0, speedMBs: 0, status: 'idle'
  };

  let scanState = 'idle';
  let scanProgress = 0;
  let scanTotal = 0;
  let cachedModels = null;

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
      if (!isAllowedOrigin(req, port)) {
        sendJson(res, 403, { success: false, error: 'Forbidden origin' });
        resolve(true);
        return;
      }
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
    const pathname = parsedUrl.pathname;
    if (pathname.startsWith('/llama-api/')) {
      return proxyToLlama(req, res, pathname, parsedUrl.search);
    }
    if (!pathname.startsWith('/api/')) return false;

    // This server has no authentication. Any website open in the user's
    // regular browser can otherwise script requests at 127.0.0.1:<port> and
    // spawn processes, read the filesystem layout, or trigger downloads
    // (CSRF / "localhost drive-by"). Reject anything declaring a foreign
    // Origin before it reaches a handler; same-origin/non-browser requests
    // (no Origin header) are unaffected.
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
      if (scanState !== 'scanning') {
        cachedModels = null;
        runBackgroundScan();
      }
      sendJson(res, 200, { success: true, message: 'Background rescan started' });
      return true;
    }

    if (pathname === '/api/system-models') {
      const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [] }, scanPaths: [] };
      sendJson(res, 200, {
        ...data.modelsByCategory,
        scanPaths: (data.scanPaths || []).map(s => ({ path: s.path, label: s.label, isBuiltIn: s.isBuiltIn })),
        scanStatus: scanState,
        cachedAt: data.cachedAt || null
      });
      return true;
    }

    if (pathname === '/api/local-models') {
      const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [] } };
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
      const data = cachedModels || { modelsByCategory: { llms: [], clips: [] } };
      const m = data.modelsByCategory;
      const llmModels = [...(m.llms || []), ...(m.clips || []).filter(item => item.isGguf)];
      sendJson(res, 200, { models: llmModels, scanStatus: scanState });
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
      sendJson(res, 200, { running: !!llamaProc && !llamaProc.killed, port: llamaPort, model: currentLlamaModel });
      return true;
    }

    if (pathname === '/api/llama/stop') {
      if (llamaProc) {
        try { llamaProc.kill('SIGKILL'); } catch (e) {}
        llamaProc = null;
      }
      currentLlamaModel = null;
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
        // Search the same allow-listed scan paths as every other model
        // lookup — this used to bypass resolveModel and search nothing.
        const modelFullPath = resolveModel(params.modelPath);
        if (!modelFullPath || !fs.existsSync(modelFullPath)) {
          sendJson(res, 404, { success: false, error: `Model file not found: ${params.modelPath}` });
          return true;
        }
        if (llamaProc) {
          try { llamaProc.kill('SIGKILL'); } catch (e) {}
          llamaProc = null;
        }
        const llamaExe = getLlamaExecutable();
        const requestedPort = Number(params.port) || 8080;
        llamaPort = requestedPort;
        const ctxSize = Number(params.ctxSize) || 4096;
        const gpuLayers = params.gpuLayers !== undefined ? Number(params.gpuLayers) : 99;
        const batchSize = Number(params.batchSize) || 2048;
        const flashAttn = ['auto', 'on', 'off'].includes(params.flashAttn) ? params.flashAttn : 'auto';

        const args = ['-m', modelFullPath, '--port', String(requestedPort), '--host', '127.0.0.1', '-ngl', String(gpuLayers), '-c', String(ctxSize), '-b', String(batchSize), '-fa', flashAttn];
        console.log(`[llama.cpp] Starting llama-server: ${llamaExe}`);
        const proc = spawn(llamaExe, args, { cwd: path.dirname(llamaExe), windowsHide: true });
        llamaProc = proc;
        currentLlamaModel = path.basename(modelFullPath);

        let stderrTail = '';
        proc.stderr && proc.stderr.on('data', chunk => {
          stderrTail = (stderrTail + chunk.toString()).slice(-2000);
        });

        let spawnError = null;
        proc.on('error', err => { spawnError = err.message; });

        let exited = false;
        proc.on('close', () => {
          exited = true;
          if (llamaProc === proc) {
            llamaProc = null;
            currentLlamaModel = null;
          }
        });

        // Poll the server's own /health endpoint instead of guessing a fixed
        // delay: a bad GPU-layer count or an incompatible/corrupt model file
        // makes llama-server exit almost immediately, while a large model can
        // legitimately take well over a second to finish loading into VRAM.
        // The previous fixed 1.2s timeout reported success unconditionally,
        // so the UI showed "GPU Active" even when the process had already
        // died — this is why the engine "detected" models but never actually
        // became usable.
        const startTime = Date.now();
        const timeoutMs = 120000;
        let ready = false;
        while (Date.now() - startTime < timeoutMs) {
          if (spawnError) {
            sendJson(res, 500, { success: false, error: `Failed to launch llama-server: ${spawnError}` });
            return true;
          }
          if (exited) {
            const tail = stderrTail.trim().split('\n').slice(-5).join(' | ');
            sendJson(res, 500, { success: false, error: `llama-server exited before it was ready.${tail ? ' ' + tail : ''}` });
            return true;
          }
          try {
            const healthRes = await fetch(`http://127.0.0.1:${requestedPort}/health`);
            if (healthRes.ok) { ready = true; break; }
          } catch (e) {
            // Not listening yet — keep polling.
          }
          await new Promise(r => setTimeout(r, 400));
        }

        if (!ready) {
          try { proc.kill('SIGKILL'); } catch (e) {}
          sendJson(res, 500, { success: false, error: 'Timed out waiting for llama-server to become ready (model may be too large for available VRAM).' });
          return true;
        }

        sendJson(res, 200, { success: true, port: requestedPort, model: currentLlamaModel, message: `llama.cpp server started on port ${requestedPort}` });
      } catch (e) {
        sendJson(res, 500, { success: false, error: e.message });
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
        const hfRes = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(repo)}/tree/main`);
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
      sendJson(res, 200, activeDownload);
      return true;
    }

    if (pathname === '/api/cancel-download') {
      if (activeDownload.childProc) {
        try { activeDownload.childProc.kill('SIGKILL'); } catch (e) {}
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

        const finalFilename = path.basename(customFilename || filename);
        let destDir, targetPath;
        try {
          // targetFolder/customFilename come straight from the request body —
          // without this check "../../.." would write outside the app dir.
          destDir = safeJoin(rootDir, targetFolder);
          targetPath = safeJoin(destDir, finalFilename);
        } catch (e) {
          sendJson(res, 400, { success: false, error: 'Invalid target path' });
          return true;
        }

        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const downloadUrl = `https://huggingface.co/${repo}/resolve/main/${filename}`;

        activeDownload = {
          isDownloading: true, filename: finalFilename, repo, targetFolder, targetPath,
          downloadedBytes: 0, totalBytes: 0, percent: 0, speedMBs: 0, status: 'downloading', startTime: Date.now()
        };

        try {
          const headRes = await fetch(downloadUrl, { method: 'HEAD' });
          const len = headRes.headers.get('content-length');
          if (len) activeDownload.totalBytes = parseInt(len, 10);
        } catch (e) {}

        // --fail makes curl exit non-zero on HTTP error responses (e.g. a 404
        // from a bad repo/filename); without it curl writes the error page to
        // disk and exits 0, and the 'close' handler below reports "completed".
        const curlProc = spawn('curl.exe', ['-L', '--fail', downloadUrl, '-o', targetPath, '--silent', '--show-error'], { windowsHide: true });
        activeDownload.childProc = curlProc;

        const progressTimer = setInterval(() => {
          if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            activeDownload.downloadedBytes = stat.size;
            if (activeDownload.totalBytes > 0) {
              activeDownload.percent = Math.min(100, Math.round((stat.size / activeDownload.totalBytes) * 100));
            }
            const elapsedSec = (Date.now() - (activeDownload.startTime || Date.now())) / 1000;
            if (elapsedSec > 0) {
              activeDownload.speedMBs = parseFloat(((stat.size / (1024 * 1024)) / elapsedSec).toFixed(1));
            }
          }
        }, 500);

        curlProc.on('close', code => {
          clearInterval(progressTimer);
          activeDownload.isDownloading = false;
          if (code === 0 && fs.existsSync(targetPath)) {
            activeDownload.status = 'completed';
            activeDownload.percent = 100;
          } else {
            activeDownload.status = 'error';
            activeDownload.error = `Download failed with exit code ${code}`;
          }
        });

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
        const execPath = getSdCliExecutable();
        const workingDir = path.dirname(execPath);

        const outFilename = `gen_${Date.now()}.png`;
        const outFullPath = path.join(userOutputsDir, outFilename);

        const resolvedParams = {
          ...params,
          modelPath: resolveModel(params.modelPath),
          clipPath: resolveModel(params.clipPath),
          t5Path: resolveModel(params.t5Path),
          vaePath: resolveModel(params.vaePath)
        };

        if (!resolvedParams.modelPath || !fs.existsSync(resolvedParams.modelPath)) {
          sendJson(res, 404, { success: false, error: `Model file not found: ${params.modelPath}` });
          return true;
        }

        const args = buildSdCliArgs(resolvedParams, outFullPath);
        console.log(`[Solframe sd-generate] Spawning: ${execPath}\n  Args: ${args.join(' ')}`);

        const procEnv = {
          ...process.env,
          PATH: `${workingDir};${path.join(rootDir, 'backend/win/cuda')};${path.join(rootDir, 'backend/win/vulkan')};${path.join(rootDir, 'backend/win/llama')};${process.env.PATH || ''}`
        };

        try {
          const result = await runSdCli({ execPath, args, outFullPath, outFilename, workingDir, env: procEnv, onStdout: line => console.log('[sd-cli]', line) });
          sendJson(res, 200, result);
        } catch (genErr) {
          sendJson(res, 500, { success: false, error: genErr.message });
        }
      } catch (e) {
        sendJson(res, 500, { success: false, error: e.message });
      }
      return true;
    }

    return false;
  }

  function dispose() {
    if (llamaProc) {
      try { llamaProc.kill('SIGKILL'); } catch (e) {}
      llamaProc = null;
    }
    if (activeDownload.childProc) {
      try { activeDownload.childProc.kill('SIGKILL'); } catch (e) {}
    }
  }

  return { init, handle, dispose };
}

module.exports = { createApiRouter };
