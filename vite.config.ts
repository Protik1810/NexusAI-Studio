import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

function sdCppBackendPlugin() {
  const rootDir = process.cwd();
  let llamaProc: any = null;
  let currentLlamaModel: string | null = null;
  let llamaPort: number = 8080;

  let activeDownload: {
    isDownloading: boolean;
    filename: string;
    repo: string;
    targetFolder: string;
    targetPath: string;
    downloadedBytes: number;
    totalBytes: number;
    percent: number;
    speedMBs: number;
    status: 'idle' | 'downloading' | 'completed' | 'error';
    error?: string;
    childProc?: any;
    startTime?: number;
  } = {
    isDownloading: false,
    filename: '',
    repo: '',
    targetFolder: '',
    targetPath: '',
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    speedMBs: 0,
    status: 'idle'
  };

  // ─── Model Scan Cache ────────────────────────────────────────────────────────
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const GLOBAL_CACHE_DIR = path.join(userHome, '.nexusai');
  const GLOBAL_CACHE_FILE = path.join(GLOBAL_CACHE_DIR, 'scan_cache.json');
  const LOCAL_CACHE_FILE = path.join(rootDir, 'models/.scan_cache.json');
  let scanState: 'idle' | 'scanning' | 'ready' | 'error' = 'idle';
  let scanProgress = 0;
  let scanTotal = 0;
  let cachedModels: any = null;

  function loadScanCache(): any | null {
    try {
      if (fs.existsSync(GLOBAL_CACHE_FILE)) {
        const raw = fs.readFileSync(GLOBAL_CACHE_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {}
    try {
      if (fs.existsSync(LOCAL_CACHE_FILE)) {
        const raw = fs.readFileSync(LOCAL_CACHE_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {}
    return null;
  }

  function saveScanCache(data: any) {
    try {
      if (!fs.existsSync(GLOBAL_CACHE_DIR)) fs.mkdirSync(GLOBAL_CACHE_DIR, { recursive: true });
      fs.writeFileSync(GLOBAL_CACHE_FILE, JSON.stringify({ ...data, cachedAt: Date.now() }, null, 2));
    } catch (e) {}
    try {
      const localDir = path.dirname(LOCAL_CACHE_FILE);
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(LOCAL_CACHE_FILE, JSON.stringify({ ...data, cachedAt: Date.now() }, null, 2));
    } catch (e) {}
  }

  function runBackgroundScan() {
    if (scanState === 'scanning') return;
    scanState = 'scanning';
    scanProgress = 0;
    console.log('[NexusAI] Starting background model scan...');
    Promise.resolve().then(() => {
      try {
        const result = getFullSystemModels();
        cachedModels = result;
        saveScanCache(result);
        scanState = 'ready';
        const total = Object.values(result.modelsByCategory as Record<string, any[]>).reduce((acc: number, arr: any[]) => acc + arr.length, 0);
        console.log(`[NexusAI] Scan complete: ${total} models found across ${result.scanPaths.length} directories.`);
      } catch (e: any) {
        scanState = 'error';
        console.error('[NexusAI] Scan error:', e.message);
      }
    });
  }

  function loadCustomScanPaths(): string[] {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    if (fs.existsSync(cfgFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        if (Array.isArray(data)) return data.filter(p => typeof p === 'string' && fs.existsSync(p));
      } catch (e) {}
    }
    return [];
  }

  function saveCustomScanPaths(pathsList: string[]) {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    try {
      fs.writeFileSync(cfgFile, JSON.stringify(Array.from(new Set(pathsList)), null, 2));
    } catch (e) {}
  }

  
  const { execSync } = require('child_process');

  function detectHardware() {
    let gpus: any[] = [];
    let preferredBackend = 'vulkan';
    let primaryGpu = 'Auto-Detect GPU';

    try {
      const smiOut = execSync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits', { encoding: 'utf8', windowsHide: true, timeout: 2000 });
      const lines = smiOut.trim().split('\n');
      for (const l of lines) {
        const parts = l.split(',').map((s: string) => s.trim());
        if (parts[0]) {
          const vramMB = parseInt(parts[1] || '0', 10);
          const vramGB = (vramMB / 1024).toFixed(1);
          gpus.push({
            name: parts[0],
            vendor: 'NVIDIA',
            vram: `${vramGB} GB`,
            vramMB,
            driver: parts[2] || '',
            isNvidia: true,
            backend: 'cuda'
          });
        }
      }
      if (gpus.length > 0) {
        preferredBackend = 'cuda';
        primaryGpu = `${gpus[0].name} (${gpus[0].vram} - CUDA)`;
      }
    } catch (e) {}

    if (process.platform === 'win32') {
      try {
        const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | ConvertTo-Json"`;
        const psOut = execSync(psCmd, { encoding: 'utf8', windowsHide: true, timeout: 3000 });
        const data = JSON.parse(psOut);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (!item || !item.Name) continue;
          const name = item.Name;
          const isNvidia = name.toLowerCase().includes('nvidia') || name.toLowerCase().includes('geforce') || name.toLowerCase().includes('rtx') || name.toLowerCase().includes('gtx');
          const isAmd = name.toLowerCase().includes('amd') || name.toLowerCase().includes('radeon');
          const isIntel = name.toLowerCase().includes('intel') || name.toLowerCase().includes('arc') || name.toLowerCase().includes('iris');
          
          if (!gpus.some(g => g.name.toLowerCase() === name.toLowerCase())) {
            let ramMB = item.AdapterRAM ? Math.round(item.AdapterRAM / (1024 * 1024)) : 0;
            let vramStr = ramMB > 1024 ? `${(ramMB / 1024).toFixed(1)} GB` : `${ramMB} MB`;
            let vendor = isNvidia ? 'NVIDIA' : isAmd ? 'AMD' : isIntel ? 'Intel' : 'Generic';
            let backend = isNvidia ? 'cuda' : (isAmd || isIntel) ? 'vulkan' : 'cpu';

            gpus.push({
              name,
              vendor,
              vram: vramStr,
              vramMB: ramMB,
              driver: item.DriverVersion || '',
              isNvidia,
              backend
            });
          }
        }
      } catch (e) {}
    }

    const hasNvidia = gpus.some(g => g.isNvidia);
    const hasAmdOrIntel = gpus.some(g => g.vendor === 'AMD' || g.vendor === 'Intel');

    if (hasNvidia) {
      preferredBackend = 'cuda';
      if (!primaryGpu || primaryGpu === 'Auto-Detect GPU') {
        const nGpu = gpus.find(g => g.isNvidia);
        primaryGpu = `${nGpu.name} (${nGpu.vram} - CUDA)`;
      }
    } else if (hasAmdOrIntel) {
      preferredBackend = 'vulkan';
      const aGpu = gpus.find(g => g.vendor === 'AMD' || g.vendor === 'Intel');
      primaryGpu = `${aGpu.name} (${aGpu.vram} - Vulkan)`;
    } else {
      preferredBackend = 'cpu';
      primaryGpu = 'CPU Fallback (AVX2)';
    }

    return {
      gpus,
      preferredBackend,
      primaryGpu,
      os: `${process.platform} ${process.arch}`,
      nodeVersion: process.version
    };
  }

  function getAllSystemScanPaths(): { path: string; label: string; isBuiltIn: boolean }[] {
    const userHome = process.env.USERPROFILE || process.env.HOME || '';
    const candidates: { path: string; label: string; isBuiltIn: boolean }[] = [];

    // 1. Dynamic Drive Scanning (C:, D:, E:, F:, G:, H:, Z:, etc.)
    const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const standardModelDirs = [
      'models',
      'AI/models',
      'AI_Models',
      'LLM',
      'Development/LLM',
      'Development/Meta Llama',
      'Development',
      'ComfyUI/models',
      'Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/models',
      'stable-diffusion-webui/models',
      'text-generation-webui/models',
      'Fooocus/models',
      'InvokeAI/models',
      'Uncensored-Local-Studio-main/app/llm-models',
      'genimg_comic/models',
      'genimg_comic/llm-models'
    ];

    for (const letter of driveLetters) {
      const driveRoot = `${letter}:/`;
      try {
        if (fs.existsSync(driveRoot)) {
          for (const sub of standardModelDirs) {
            const full = path.join(driveRoot, sub);
            if (fs.existsSync(full)) {
              candidates.push({ path: full.replace(/\\/g, '/'), label: `${letter}: ${sub}`, isBuiltIn: true });
            }
          }
        }
      } catch (e) {}
    }

    // 2. User home directories on any operating system
    const userDirs = [
      { path: path.join(userHome, '.cache/huggingface/hub'), label: 'Hugging Face Cache' },
      { path: path.join(userHome, '.lmstudio/models'), label: 'LM Studio Models' },
      { path: path.join(userHome, '.lmstudio/.internal/bundled-models'), label: 'LM Studio Built-in' },
      { path: path.join(userHome, '.cache/lm-studio/models'), label: 'LM Studio Cache' },
      { path: path.join(userHome, 'AppData/Local/Programs/LM Studio/resources/app/.webpack/bin/bundled-models'), label: 'LM Studio App Bundled' },
      { path: path.join(userHome, '.ollama/models'), label: 'Ollama Models' },
      { path: path.join(userHome, 'AppData/Local/ai.unsloth.studio'), label: 'Unsloth Studio' },
      { path: path.join(userHome, '.unsloth/llama.cpp/models'), label: 'Unsloth llama.cpp' }
    ];
    for (const ud of userDirs) {
      if (fs.existsSync(ud.path)) {
        candidates.push({ path: ud.path.replace(/\\/g, '/'), label: ud.label, isBuiltIn: true });
      }
    }

    // 3. Application local and portable paths
    const appDirs = [
      { path: path.join(rootDir, 'models'), label: 'Workspace models/' },
      { path: path.join(rootDir, 'llm-models'), label: 'Workspace llm-models/' }
    ];
    for (const ad of appDirs) {
      if (fs.existsSync(ad.path)) {
        candidates.push({ path: ad.path.replace(/\\/g, '/'), label: ad.label, isBuiltIn: true });
      }
    }

    // 4. Custom user paths from UI
    const custom = loadCustomScanPaths();
    for (const c of custom) {
      if (fs.existsSync(c)) {
        candidates.push({ path: c.replace(/\\/g, '/'), label: `Custom (${path.basename(c)})`, isBuiltIn: false });
      }
    }

    // Deduplicate paths
    const seen = new Set<string>();
    return candidates.filter(c => {
      const norm = path.normalize(c.path).toLowerCase();
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }

  function scanDirectoryRecursive(dir: string, maxDepth: number = 5, currentDepth: number = 0): string[] {
    if (currentDepth > maxDepth || !fs.existsSync(dir)) return [];
    let results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.cache') continue;
        if (['node_modules', '$RECYCLE.BIN', 'System Volume Information', 'Windows', 'Program Files'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(scanDirectoryRecursive(full, maxDepth, currentDepth + 1));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.safetensors', '.gguf', '.ckpt', '.bin', '.pt'].includes(ext)) {
            try {
              const stat = fs.statSync(full);
              if (stat.size > 5 * 1024 * 1024) {
                results.push(full);
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    return results;
  }

  function classifyModelFile(fullPath: string, sourceLabel: string) {
    const filename = path.basename(fullPath);
    const lower = fullPath.toLowerCase().replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);
    const sizeMB = stat.size / (1024 * 1024);
    const sizeGB = sizeMB / 1024;
    const formattedSize = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
    const isGguf = filename.toLowerCase().endsWith('.gguf');

    let category: 'checkpoints' | 'unets' | 'clips' | 'loras' | 'vaes' | 'controlnets' | 'llms' = 'checkpoints';

    // Skip tiny vocabulary/embedding GGUFs
    if (isGguf && filename.startsWith('ggml-vocab-')) return null as any;
    // Skip mmproj (multimodal projector) files — they're accessories, not standalone models
    // We still include them but classify as clips

    if (lower.includes('controlnet') || lower.includes('union-sdxl') || lower.includes('promax')) {
      category = 'controlnets';
    } else if (lower.includes('vae') || filename.toLowerCase().startsWith('ae.') || lower.includes('flux2-vae') || lower.includes('flux-vae')) {
      category = 'vaes';
    } else if (lower.includes('/loras/') || lower.includes('\\loras\\') || (lower.includes('lora') && !lower.includes('flux') && !lower.includes('llm'))) {
      category = 'loras';
    } else if (
      lower.includes('/clip/') || lower.includes('\\clip\\') ||
      lower.includes('text_encoder') || lower.includes('t5xxl') ||
      lower.includes('clip_l') || lower.includes('clip_g') ||
      lower.includes('qwen_3_8b_fp8mixed') ||
      (isGguf && (lower.includes('text-encoder') || lower.includes('mmproj')))
    ) {
      category = 'clips';
    } else if (
      lower.includes('/unet/') || lower.includes('\\unet\\') ||
      lower.includes('diffusion_model') ||
      (lower.includes('flux') && !lower.includes('lora') && !lower.includes('vae') && stat.size > 3 * 1024 * 1024 * 1024 && !lower.includes('checkpoint'))
    ) {
      category = 'unets';
    } else if (isGguf) {
      // All other GGUFs are LLMs — text generation models
      category = 'llms';
    } else {
      category = 'checkpoints';
    }

    return {
      name: filename,
      filename,
      fullPath: fullPath.replace(/\\/g, '/'),
      relativePath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
      sizeBytes: stat.size,
      formattedSize,
      source: sourceLabel,
      category,
      isGguf
    };
  }

  function resolveModelFullPath(nameOrPath: string): string {
    if (!nameOrPath) return '';
    if (path.isAbsolute(nameOrPath) && fs.existsSync(nameOrPath)) return nameOrPath;
    
    const relPath = path.join(rootDir, nameOrPath);
    if (fs.existsSync(relPath)) return relPath;

    // Search across all system scan paths
    const scanPaths = getAllSystemScanPaths();
    const targetFilename = path.basename(nameOrPath).toLowerCase();

    for (const sp of scanPaths) {
      const files = scanDirectoryRecursive(sp.path);
      for (const f of files) {
        if (path.basename(f).toLowerCase() === targetFilename) {
          return f;
        }
      }
    }

    return relPath;
  }

  function getFullSystemModels() {
    const scanPaths = getAllSystemScanPaths();
    const seenPaths = new Set<string>();
    const modelsByCategory: {
      checkpoints: any[];
      unets: any[];
      clips: any[];
      loras: any[];
      vaes: any[];
      controlnets: any[];
      llms: any[];
    } = {
      checkpoints: [],
      unets: [],
      clips: [],
      loras: [],
      vaes: [],
      controlnets: [],
      llms: []
    };

    scanTotal = scanPaths.length;
    scanProgress = 0;
    for (const sp of scanPaths) {
      scanProgress++;
      const files = scanDirectoryRecursive(sp.path);
      for (const f of files) {
        const norm = path.normalize(f);
        if (seenPaths.has(norm)) continue;
        seenPaths.add(norm);

        try {
          const item = classifyModelFile(f, sp.label);
          if (!item) continue; // filtered out (e.g. vocab files)
          modelsByCategory[item.category].push(item);
        } catch (e) {}
      }
    }

    return { modelsByCategory, scanPaths };
  }

  return {
    name: 'sd-cpp-backend-plugin',
    buildStart() {
      // Pre-load cache at startup; trigger background scan
      cachedModels = loadScanCache();
      if (cachedModels) {
        scanState = 'ready';
        console.log('[NexusAI] Loaded model cache. Running background rescan...');
      }
      runBackgroundScan();
    },
    configureServer(server: any) {
      // Pre-load cache at server start; trigger background scan
      cachedModels = loadScanCache();
      if (cachedModels) {
        scanState = 'ready';
        console.log('[NexusAI] Loaded model cache from disk. Background scan starting...');
      }
      runBackgroundScan();

      // 0. Scan status endpoint
      server.middlewares.use('/api/hardware-info', async (req: any, res: any) => {
        const hw = detectHardware();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(hw));
      });

      server.middlewares.use('/api/scan-status', (req: any, res: any) => {
        const total = cachedModels
          ? Object.values(cachedModels.modelsByCategory as Record<string, any[]>).reduce((acc: number, arr: any[]) => acc + arr.length, 0)
          : 0;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: scanState,
          progress: scanProgress,
          total: scanTotal,
          modelCount: total,
          cachedAt: (cachedModels as any)?.cachedAt || null
        }));
      });

      // 0b. Force rescan endpoint
      server.middlewares.use('/api/rescan', (req: any, res: any) => {
        if (scanState !== 'scanning') {
          cachedModels = null;
          runBackgroundScan();
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'Background rescan started' }));
      });

      // 1. Comprehensive System-Wide Models Endpoint — returns from cache instantly
      server.middlewares.use('/api/system-models', async (req: any, res: any) => {
        // Return cache immediately if available
        const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [] }, scanPaths: [] };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ...data.modelsByCategory,
          scanPaths: (data.scanPaths as any[]).map((s: any) => ({ path: s.path, label: s.label, isBuiltIn: s.isBuiltIn })),
          scanStatus: scanState,
          cachedAt: (data as any).cachedAt || null
        }));
      });

      // 2. Custom Scan Paths Endpoint
      server.middlewares.use('/api/custom-scan-paths', async (req: any, res: any) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
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
            } catch (e: any) {
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
        res.end(JSON.stringify({ customPaths: custom, scanPaths }));
      });

      // 3. Local Models Endpoint (Returns all system models classified for ImageStudio) — cache-backed
      server.middlewares.use('/api/local-models', async (req: any, res: any) => {
        const data = cachedModels || { modelsByCategory: { checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [] } };
        const modelsByCategory = data.modelsByCategory;
        const result = {
          checkpoints: modelsByCategory.checkpoints.map((m: any) => ({ name: m.filename, fullPath: m.fullPath, size: m.formattedSize })),
          unets: modelsByCategory.unets.map((m: any) => ({ name: m.filename, fullPath: m.fullPath, size: m.formattedSize })),
          clips: modelsByCategory.clips.map((m: any) => ({ name: m.filename, fullPath: m.fullPath, size: m.formattedSize })),
          loras: modelsByCategory.loras.map((m: any) => ({ name: m.filename, fullPath: m.fullPath, size: m.formattedSize })),
          vaes: modelsByCategory.vaes.map((m: any) => ({ name: m.filename, fullPath: m.fullPath, size: m.formattedSize })),
          controlnets: modelsByCategory.controlnets.map((m: any) => ({ name: m.filename, fullPath: m.fullPath, size: m.formattedSize })),
          scanStatus: scanState
        };

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      });

      // 4. Local LLM Models Endpoint (Returns all GGUFs across whole system) — cache-backed
      server.middlewares.use('/api/local-llm-models', async (req: any, res: any) => {
        const data = cachedModels || { modelsByCategory: { llms: [], clips: [] } };
        const modelsByCategory = data.modelsByCategory;
        const llmModels = [
          ...modelsByCategory.llms,
          ...modelsByCategory.clips.filter((m: any) => m.isGguf)
        ];

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ models: llmModels, scanStatus: scanState }));
      });

      server.middlewares.use('/api/llama/status', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          running: !!llamaProc && !llamaProc.killed,
          port: llamaPort,
          model: currentLlamaModel
        }));
      });

      server.middlewares.use('/api/llama/stop', (req: any, res: any) => {
        if (llamaProc) {
          try {
            llamaProc.kill('SIGKILL');
          } catch (e) {}
          llamaProc = null;
        }
        currentLlamaModel = null;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'llama-server stopped' }));
      });

      server.middlewares.use('/api/llama/start', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
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

            const llamaExe = path.join(rootDir, 'backend/win/llama/llama-server.exe');
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

            console.log(`[llama.cpp CUDA] Starting llama-server with model: ${modelFullPath}`);
            llamaProc = spawn(llamaExe, args, {
              cwd: path.dirname(llamaExe),
              windowsHide: true
            });

            currentLlamaModel = path.basename(modelFullPath);

            llamaProc.stdout.on('data', (d: any) => {
              console.log('[llama-server]', d.toString().trim());
            });

            llamaProc.stderr.on('data', (d: any) => {
              console.log('[llama-server]', d.toString().trim());
            });

            llamaProc.on('close', (code: number) => {
              console.log(`[llama-server] Process closed with code ${code}`);
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

          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      server.middlewares.use('/api/hf-search', async (req: any, res: any) => {
        try {
          const urlObj = new URL(req.url, 'http://localhost:1420');
          const q = urlObj.searchParams.get('q') || '';
          const pipelineTag = urlObj.searchParams.get('pipeline_tag') || '';
          const limit = urlObj.searchParams.get('limit') || '25';

          let hfUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=${limit}`;
          if (pipelineTag) hfUrl += `&pipeline_tag=${encodeURIComponent(pipelineTag)}`;

          const hfRes = await fetch(hfUrl);
          if (!hfRes.ok) {
            res.statusCode = hfRes.status;
            return res.end(JSON.stringify({ error: `Hugging Face API error ${hfRes.status}` }));
          }

          const data = await hfRes.json();
          const models = (Array.isArray(data) ? data : []).map((m: any) => ({
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
          res.end(JSON.stringify({ models }));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      server.middlewares.use('/api/hf-tree', async (req: any, res: any) => {
        try {
          const urlObj = new URL(req.url, 'http://localhost:1420');
          const repo = urlObj.searchParams.get('repo');
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
            .filter((f: any) => f.type === 'file')
            .map((f: any) => {
              const sizeMB = (f.size || 0) / (1024 * 1024);
              const sizeGB = sizeMB / 1024;
              const formattedSize = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
              const ext = path.extname(f.path).toLowerCase();
              const isGguf = ext === '.gguf';
              const isSafetensors = ext === '.safetensors';

              return {
                path: f.path,
                sizeBytes: f.size || 0,
                formattedSize,
                isGguf,
                isSafetensors,
                downloadUrl: `https://huggingface.co/${repo}/resolve/main/${f.path}`
              };
            });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ repo, files }));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      server.middlewares.use('/api/download-progress', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(activeDownload));
      });

      server.middlewares.use('/api/cancel-download', (req: any, res: any) => {
        if (activeDownload.childProc) {
          try { activeDownload.childProc.kill('SIGKILL'); } catch (e) {}
        }
        activeDownload.isDownloading = false;
        activeDownload.status = 'idle';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'Download cancelled' }));
      });

      server.middlewares.use('/api/download-model', (req: any, res: any) => {
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
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const params = JSON.parse(body);
            const { repo, filename, targetFolder, customFilename } = params;

            if (!repo || !filename || !targetFolder) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: 'Missing required parameters (repo, filename, targetFolder)' }));
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

            const curlProc = spawn('curl.exe', [
              '-L', downloadUrl,
              '-o', targetPath,
              '--silent',
              '--show-error'
            ], { windowsHide: true });

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

            curlProc.on('close', (code: number) => {
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

          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });

      server.middlewares.use('/api/sd-generate', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const params = JSON.parse(body);
            const candidates = [
              path.join(rootDir, 'backend/win/cuda/sd-cli.exe'),
              path.join(rootDir, 'backend/win/cuda/sd-cuda.exe'),
              path.join(rootDir, 'backend/win/vulkan/sd-cli.exe'),
              path.join(rootDir, 'backend/win/vulkan/sd-vulkan.exe'),
              path.join(rootDir, 'backend/win/cpu/sd-cli.exe')
            ];
            const execPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
            const workingDir = path.dirname(execPath);

            const outDir = path.join(rootDir, 'public/outputs');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

            const outFilename = `gen_${Date.now()}.png`;
            const outFullPath = path.join(outDir, outFilename);
            const modelFullPath = resolveModelFullPath(params.modelPath);
            const clipFullPath = resolveModelFullPath(params.clipPath);
            const t5FullPath = resolveModelFullPath(params.t5Path);
            const vaeFullPath = resolveModelFullPath(params.vaePath);

            const args: string[] = [];
            if (params.pipeline === 'flux') {
              // FLUX.2 / FLUX.2-Klein: use --diffusion-model for the UNet/transformer
              // --llm for the LLM-based text encoder (Qwen/Mistral for Klein)
              // --t5xxl for T5 encoder (FLUX.1 dev/schnell)
              // --vae for the VAE decoder
              args.push('--diffusion-model', modelFullPath);
              // Auto-detect Klein architecture
              const isKlein = modelFullPath.toLowerCase().includes('klein') || (params.modelPath || '').toLowerCase().includes('klein');
              if (isKlein) {
                args.push('--prediction', 'flux2_flow');
              }
              if (clipFullPath) args.push('--llm', clipFullPath);
              if (t5FullPath) args.push('--t5xxl', t5FullPath);
              if (vaeFullPath) args.push('--vae', vaeFullPath);
              // Use GPU backend for diffusion, CPU for text encoders to save VRAM
              args.push('--backend', 'diffusion=cuda0,llm=cpu,vae=cuda0');
            } else {
              args.push('-m', modelFullPath);
              if (params.negativePrompt) args.push('-n', params.negativePrompt);
            }

            args.push('-p', params.prompt, '-o', outFullPath, '-W', String(params.width || 512), '-H', String(params.height || 512), '--steps', String(params.steps || 4), '--cfg-scale', String(params.cfgScale || 1.8));
            args.push('--seed', String(params.seed !== undefined ? params.seed : Math.floor(Math.random() * 1000000)));
            if (params.samplingMethod) args.push('--sampling-method', params.samplingMethod);
            console.log(`[NexusAI sd-generate] Spawning: ${execPath}\n  Args: ${args.join(' ')}`);

            const child = spawn(execPath, args, { cwd: workingDir, windowsHide: true });
            let stderrLog = '';
            child.stderr?.on('data', (d: any) => { stderrLog += d.toString(); });
            child.stdout?.on('data', (d: any) => { console.log('[sd-cli]', d.toString().trim()); });
            child.on('close', (code: number) => {
              if (code === 0 && fs.existsSync(outFullPath)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, imageUrl: `/outputs/${outFilename}?t=${Date.now()}`, outputPath: outFullPath }));
              } else {
                console.error('[sd-cli STDERR]:', stderrLog);
                res.statusCode = 500;
                const errMsg = stderrLog
                  ? `sd-cli exit code ${code}:\n${stderrLog.slice(-2000)}`
                  : `sd-cli exited with code ${code}. Model not found or CUDA error.`;
                res.end(JSON.stringify({ success: false, error: errMsg }));
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), sdCppBackendPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/llama-api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llama-api/, ''),
      },
      '/comfy-api': {
        target: 'http://127.0.0.1:8188',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comfy-api/, ''),
        ws: true,
        headers: { Origin: 'http://127.0.0.1:8188', Host: '127.0.0.1:8188' }
      },
      '/comfy-ws': {
        target: 'ws://127.0.0.1:8188',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comfy-ws/, ''),
        headers: { Origin: 'http://127.0.0.1:8188', Host: '127.0.0.1:8188' }
      }
    }
  },
  envPrefix: ['VITE_', 'TAURI_'],
})
