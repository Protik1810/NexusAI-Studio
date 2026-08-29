const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ─── Shared Engine Modules ────────────────────────────────────────────────────
const { detectHardware } = require('./engine/hardware.cjs');
const {
  getAllSystemScanPaths, resolveModelFullPath,
  getSdCliExecutable: _getSdCliExec,
  getLlamaExecutable: _getLlamaExec
} = require('./engine/pathUtils.cjs');
const { getFullSystemModels, loadScanCache, saveScanCache } = require('./engine/modelScanner.cjs');
const { runSdCli, getOutputDir, buildSdCliArgs } = require('./engine/sdEngine.cjs');

function createServer(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const resourcesPath = options.resourcesPath || rootDir;
  const isPackaged = options.isPackaged || false;
  const distDir = options.distDir || path.join(rootDir, 'dist');
  const publicDir = options.publicDir || path.join(rootDir, 'public');

  // Bind engine helpers to this instance
  const getSdCliExecutable = () => _getSdCliExec({ rootDir, resourcesPath });
  const getLlamaExecutable = () => _getLlamaExec({ rootDir, resourcesPath });
  const resolveModel = (p) => resolveModelFullPath(p, rootDir, loadCustomScanPaths());

  let llamaProc = null;
  let currentLlamaModel = null;
  let llamaPort = 8080;

  let activeDownload = {
    isDownloading: false, filename: '', repo: '', targetFolder: '',
    targetPath: '', downloadedBytes: 0, totalBytes: 0,
    percent: 0, speedMBs: 0, status: 'idle'
  };

  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const GLOBAL_CACHE_DIR = path.join(userHome, '.nexusai');
  const GLOBAL_CACHE_FILE = path.join(GLOBAL_CACHE_DIR, 'scan_cache.json');
  const LOCAL_CACHE_FILE = path.join(rootDir, 'models/.scan_cache.json');
  const cacheFilePaths = {
    globalCacheFile: GLOBAL_CACHE_FILE, globalCacheDir: GLOBAL_CACHE_DIR,
    localCacheFile: LOCAL_CACHE_FILE
  };

  // User-writable output directory (works even when installed in Program Files)
  const userOutputsDir = getOutputDir(publicDir);

  let scanState = 'idle';
  let scanProgress = 0;
  let scanTotal = 0;
  let cachedModels = null;

  function loadCustomScanPaths() {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    if (fs.existsSync(cfgFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        if (Array.isArray(data)) return data.filter(p => typeof p === 'string' && fs.existsSync(p));
      } catch (e) {}
    }
    return [];
  }

  function saveCustomScanPaths(pathsList) {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    try {
      const dir = path.dirname(cfgFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cfgFile, JSON.stringify(Array.from(new Set(pathsList)), null, 2));
    } catch (e) {}
  }

  function runBackgroundScan() {
    if (scanState === 'scanning') return;
    scanState = 'scanning';
    const state = {};
    console.log('[NexusAI Standalone Engine] Starting background model scan...');
    setImmediate(() => {
      try {
        const result = getFullSystemModels(rootDir, loadCustomScanPaths(), state);
        cachedModels = result;
        saveScanCache(result, cacheFilePaths);
        scanState = 'ready';
        scanProgress = state.scanProgress || 0;
        scanTotal = state.scanTotal || 0;
        const total = Object.values(result.modelsByCategory).reduce((acc, arr) => acc + arr.length, 0);
        console.log(`[NexusAI Standalone Engine] Scan complete: ${total} models found.`);
      } catch (e) {
        scanState = 'error';
        console.error('[NexusAI Standalone Engine] Scan error:', e.message);
      }
    });
  }

  cachedModels = loadScanCache(cacheFilePaths);
  if (cachedModels) {
    scanState = 'ready';
    console.log('[NexusAI Standalone Engine] Loaded model cache. Running background rescan...');
  }
  runBackgroundScan();
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
  };

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    // ─── API Routes ──────────────────────────────────────────────────────────
    
    if (pathname === '/api/libraries-status') {
      const hw = detectHardware();
      const baseBackendDir = path.join(rootDir, 'backend/win');

      const libraryDefinitions = [
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

      const evaluated = libraryDefinitions.map(def => {
        let allFilesPresent = true;
        const fileDetails = def.files.map(f => {
          // Check both rootDir and resourcesPath
          const p1 = path.join(rootDir, f.path);
          const p2 = path.join(resourcesPath, f.path);
          const exists = fs.existsSync(p1) || fs.existsSync(p2);
          const targetPath = fs.existsSync(p1) ? p1 : p2;
          let sizeMB = 0;
          if (exists) {
            try { sizeMB = (fs.statSync(targetPath).size / (1024 * 1024)).toFixed(1); } catch (e) {}
          } else {
            if (f.required) allFilesPresent = false;
          }
          return {
            name: f.name,
            defaultRelativePath: f.path,
            absolutePath: targetPath,
            exists,
            sizeMB: exists ? `${sizeMB} MB` : '0 MB',
            required: f.required
          };
        });

        return {
          id: def.id,
          name: def.name,
          category: def.category,
          description: def.description,
          requiredFor: def.requiredFor,
          installed: allFilesPresent,
          files: fileDetails
        };
      });

      const totalRequiredMissing = evaluated.filter(e => !e.installed).length;

      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        libraries: evaluated,
        allReady: totalRequiredMissing === 0,
        missingCount: totalRequiredMissing,
        hardware: hw
      }));
    }

    if (pathname === '/api/hardware-info') {
      const hw = detectHardware();
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(hw));
    }

    if (pathname === '/api/scan-status') {
      const total = cachedModels
        ? Object.values(cachedModels.modelsByCategory).reduce((acc, arr) => acc + arr.length, 0)
        : 0;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        status: scanState,
        progress: scanProgress,
        total: scanTotal,
        modelCount: total,
        cachedAt: cachedModels?.cachedAt || null
      }));
    }

    if (pathname === '/api/rescan') {
      if (scanState !== 'scanning') {
        cachedModels = null;
        runBackgroundScan();
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, message: 'Background rescan started' }));
    }

    if (pathname === '/api/system-models') {
      const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [] }, scanPaths: [] };
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        ...data.modelsByCategory,
        scanPaths: (data.scanPaths || []).map(s => ({ path: s.path, label: s.label, isBuiltIn: s.isBuiltIn })),
        scanStatus: scanState,
        cachedAt: data.cachedAt || null
      }));
    }

    if (pathname === '/api/local-models') {
      const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [] } };
      const m = data.modelsByCategory;
      const result = {
        checkpoints: (m.checkpoints || []).map(item => ({ name: item.filename, fullPath: item.fullPath, size: item.formattedSize })),
        unets: (m.unets || []).map(item => ({ name: item.filename, fullPath: item.fullPath, size: item.formattedSize })),
        clips: (m.clips || []).map(item => ({ name: item.filename, fullPath: item.fullPath, size: item.formattedSize })),
        loras: (m.loras || []).map(item => ({ name: item.filename, fullPath: item.fullPath, size: item.formattedSize })),
        vaes: (m.vaes || []).map(item => ({ name: item.filename, fullPath: item.fullPath, size: item.formattedSize })),
        controlnets: (m.controlnets || []).map(item => ({ name: item.filename, fullPath: item.fullPath, size: item.formattedSize })),
        scanStatus: scanState
      };
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(result));
    }

    if (pathname === '/api/local-llm-models') {
      const data = cachedModels || { modelsByCategory: { llms: [], clips: [] } };
      const m = data.modelsByCategory;
      const llmModels = [
        ...(m.llms || []),
        ...(m.clips || []).filter(item => item.isGguf)
      ];
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ models: llmModels, scanStatus: scanState }));
    }

    if (pathname === '/api/custom-scan-paths') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { action, dirPath } = JSON.parse(body);
            let current = loadCustomScanPaths();
            if (action === 'add' && dirPath && fs.existsSync(dirPath)) {
              current.push(dirPath);
              saveCustomScanPaths(current);
            } else if (action === 'remove' && dirPath) {
              current = current.filter(p => p !== dirPath);
              saveCustomScanPaths(current);
            }
            const scanPaths = getAllSystemScanPaths();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, customPaths: current, scanPaths }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
      const custom = loadCustomScanPaths();
      const scanPaths = getAllSystemScanPaths();
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ customPaths: custom, scanPaths }));
    }

    if (pathname === '/api/llama/status') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        running: !!llamaProc && !llamaProc.killed,
        port: llamaPort,
        model: currentLlamaModel
      }));
    }

    if (pathname === '/api/llama/stop') {
      if (llamaProc) {
        try { llamaProc.kill('SIGKILL'); } catch (e) {}
        llamaProc = null;
      }
      currentLlamaModel = null;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, message: 'llama-server stopped' }));
    }

    if (pathname === '/api/llama/start') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end('Method Not Allowed');
      }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const params = JSON.parse(body);
          const modelFullPath = resolveModelFullPath(params.modelPath);
          if (!fs.existsSync(modelFullPath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: `Model file not found: ${modelFullPath}` }));
          }
          if (llamaProc) {
            try { llamaProc.kill('SIGKILL'); } catch (e) {}
            llamaProc = null;
          }
          const llamaExe = getLlamaExecutable();
          const port = params.port || 8080;
          llamaPort = port;
          const ctxSize = params.ctxSize || 4096;
          const gpuLayers = params.gpuLayers !== undefined ? params.gpuLayers : 99;

          const args = [
            '-m', modelFullPath,
            '--port', String(port),
            '--host', '127.0.0.1',
            '-ngl', String(gpuLayers),
            '-c', String(ctxSize)
          ];

          console.log(`[llama.cpp CUDA] Starting llama-server: ${llamaExe}`);
          llamaProc = spawn(llamaExe, args, { cwd: path.dirname(llamaExe), windowsHide: true });
          currentLlamaModel = path.basename(modelFullPath);

          llamaProc.on('close', code => {
            llamaProc = null;
            currentLlamaModel = null;
          });

          setTimeout(() => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              port,
              model: currentLlamaModel,
              message: `llama.cpp CUDA server started on port ${port}`
            }));
          }, 1200);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === '/api/hf-search') {
      try {
        const q = parsedUrl.searchParams.get('q') || '';
        const pipelineTag = parsedUrl.searchParams.get('pipeline_tag') || '';
        const limit = parsedUrl.searchParams.get('limit') || '25';
        let hfUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=${limit}`;
        if (pipelineTag) hfUrl += `&pipeline_tag=${encodeURIComponent(pipelineTag)}`;
        const hfRes = await fetch(hfUrl);
        if (!hfRes.ok) {
          res.statusCode = hfRes.status;
          return res.end(JSON.stringify({ error: `Hugging Face API error ${hfRes.status}` }));
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
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ models }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    if (pathname === '/api/hf-tree') {
      try {
        const repo = parsedUrl.searchParams.get('repo');
        if (!repo) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Missing repo parameter' }));
        }
        const hfRes = await fetch(`https://huggingface.co/api/models/${repo}/tree/main`);
        if (!hfRes.ok) {
          res.statusCode = hfRes.status;
          return res.end(JSON.stringify({ error: `Hugging Face repo error ${hfRes.status}` }));
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
              path: f.path,
              sizeBytes: f.size || 0,
              formattedSize,
              isGguf: ext === '.gguf',
              isSafetensors: ext === '.safetensors',
              downloadUrl: `https://huggingface.co/${repo}/resolve/main/${f.path}`
            };
          });
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ repo, files }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    if (pathname === '/api/download-progress') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(activeDownload));
    }

    if (pathname === '/api/cancel-download') {
      if (activeDownload.childProc) {
        try { activeDownload.childProc.kill('SIGKILL'); } catch (e) {}
      }
      activeDownload.isDownloading = false;
      activeDownload.status = 'idle';
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, message: 'Download cancelled' }));
    }

    if (pathname === '/api/download-model') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end('Method Not Allowed');
      }
      if (activeDownload.isDownloading) {
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: false, error: `Already downloading ${activeDownload.filename}. Please wait or cancel first.` }));
      }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const params = JSON.parse(body);
          const { repo, filename, targetFolder, customFilename } = params;
          if (!repo || !filename || !targetFolder) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: 'Missing required parameters' }));
          }
          const finalFilename = customFilename || path.basename(filename);
          const destDir = path.join(rootDir, targetFolder);
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          const targetPath = path.join(destDir, finalFilename);
          const downloadUrl = `https://huggingface.co/${repo}/resolve/main/${filename}`;

          activeDownload = {
            isDownloading: true,
            filename: finalFilename,
            repo,
            targetFolder,
            targetPath,
            downloadedBytes: 0,
            totalBytes: 0,
            percent: 0,
            speedMBs: 0,
            status: 'downloading',
            startTime: Date.now()
          };

          try {
            const headRes = await fetch(downloadUrl, { method: 'HEAD' });
            const len = headRes.headers.get('content-length');
            if (len) activeDownload.totalBytes = parseInt(len, 10);
          } catch (e) {}

          const curlProc = spawn('curl.exe', ['-L', downloadUrl, '-o', targetPath, '--silent', '--show-error'], { windowsHide: true });
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

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, targetPath }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === '/api/sd-generate') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end('Method Not Allowed');
      }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const params = JSON.parse(body);
          const execPath = getSdCliExecutable();
          const workingDir = path.dirname(execPath);

          const outFilename = `gen_${Date.now()}.png`;
          const outFullPath = path.join(userOutputsDir, outFilename);

          // Resolve all model paths using shared utility
          const resolvedParams = {
            ...params,
            modelPath: resolveModel(params.modelPath),
            clipPath: resolveModel(params.clipPath),
            t5Path: resolveModel(params.t5Path),
            vaePath: resolveModel(params.vaePath)
          };

          if (!resolvedParams.modelPath || !fs.existsSync(resolvedParams.modelPath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: `Model file not found: ${params.modelPath}` }));
          }

          const args = buildSdCliArgs(resolvedParams, outFullPath);
          console.log(`[NexusAI sd-generate] Spawning: ${execPath}\n  Args: ${args.join(' ')}`);

          const procEnv = {
            ...process.env,
            PATH: `${workingDir};${path.join(rootDir, 'backend/win/cuda')};${path.join(rootDir, 'backend/win/vulkan')};${path.join(rootDir, 'backend/win/llama')};${process.env.PATH || ''}`
          };

          try {
            const result = await runSdCli({ execPath, args, outFullPath, outFilename, workingDir, env: procEnv,
              onStdout: (line) => console.log('[sd-cli]', line)
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (genErr) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: genErr.message }));
          }
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ─── Static File Serving (dist/ and public/) ─────────────────────────────
    let requestedFile = pathname === '/' ? '/index.html' : pathname;

    // /outputs/* — serve from user-writable data dir first, then publicDir
    let filePath;
    if (requestedFile.startsWith('/outputs/')) {
      const outputFilename = requestedFile.replace(/^.*\//, '').split('?')[0];
      const userFile = path.join(userOutputsDir, outputFilename);
      const publicFile = path.join(publicDir, 'outputs', outputFilename);
      filePath = fs.existsSync(userFile) ? userFile : publicFile;
    } else {
      // Check public directory (themes, icons)
      filePath = path.join(publicDir, requestedFile);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, requestedFile);
      }
      // Fallback to index.html for SPA client-side routing
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  return {
    server,
    listen: (port, callback) => server.listen(port, '127.0.0.1', callback),
    close: (cb) => {
      if (llamaProc) {
        try { llamaProc.kill('SIGKILL'); } catch (e) {}
      }
      server.close(cb);
    }
  };
}

module.exports = { createServer };