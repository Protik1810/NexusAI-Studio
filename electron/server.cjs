const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function createServer(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const resourcesPath = options.resourcesPath || rootDir;
  const isPackaged = options.isPackaged || false;
  const distDir = options.distDir || path.join(rootDir, 'dist');
  const publicDir = options.publicDir || path.join(rootDir, 'public');

  let llamaProc = null;
  let currentLlamaModel = null;
  let llamaPort = 8080;

  let activeDownload = {
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

  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const GLOBAL_CACHE_DIR = path.join(userHome, '.nexusai');
  const GLOBAL_CACHE_FILE = path.join(GLOBAL_CACHE_DIR, 'scan_cache.json');
  const LOCAL_CACHE_FILE = path.join(rootDir, 'models/.scan_cache.json');
  let scanState = 'idle';
  let scanProgress = 0;
  let scanTotal = 0;
  let cachedModels = null;

  function loadScanCache() {
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

  function saveScanCache(data) {
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

  
  const { execSync } = require('child_process');

  function detectHardware() {
    let gpus = [];
    let preferredBackend = 'vulkan';
    let primaryGpu = 'Auto-Detect GPU';

    try {
      const smiOut = execSync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits', { encoding: 'utf8', windowsHide: true, timeout: 2000 });
      const lines = smiOut.trim().split('\n');
      for (const l of lines) {
        const parts = l.split(',').map(s => s.trim());
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

  function getAllSystemScanPaths() {
    const userHome = process.env.USERPROFILE || process.env.HOME || '';
    const exeDir = path.dirname(process.execPath || '');
    const candidates = [];

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
      { path: path.join(rootDir, 'models'), label: 'Local models/' },
      { path: path.join(rootDir, 'llm-models'), label: 'Local llm-models/' },
      { path: path.join(exeDir, 'models'), label: 'Portable models/' },
      { path: path.join(exeDir, '..', 'models'), label: 'Parent models/' }
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
    const seen = new Set();
    return candidates.filter(c => {
      const norm = path.normalize(c.path).toLowerCase();
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }

  function scanDirectoryRecursive(dir, maxDepth = 5, currentDepth = 0) {
    if (currentDepth > maxDepth || !fs.existsSync(dir)) return [];
    let results = [];
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

  function classifyModelFile(fullPath, sourceLabel) {
    const filename = path.basename(fullPath);
    const lower = fullPath.toLowerCase().replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);
    const sizeMB = stat.size / (1024 * 1024);
    const sizeGB = sizeMB / 1024;
    const formattedSize = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
    const isGguf = filename.toLowerCase().endsWith('.gguf');

    if (isGguf && filename.startsWith('ggml-vocab-')) return null;

    let category = 'checkpoints';

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

  function resolveModelFullPath(nameOrPath) {
    if (!nameOrPath) return '';
    if (path.isAbsolute(nameOrPath) && fs.existsSync(nameOrPath)) return nameOrPath;
    
    const relPath = path.join(rootDir, nameOrPath);
    if (fs.existsSync(relPath)) return relPath;

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
    const seenPaths = new Set();
    const modelsByCategory = {
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
          if (!item) continue;
          modelsByCategory[item.category].push(item);
        } catch (e) {}
      }
    }

    return { modelsByCategory, scanPaths };
  }

  function runBackgroundScan() {
    if (scanState === 'scanning') return;
    scanState = 'scanning';
    scanProgress = 0;
    console.log('[NexusAI Standalone Engine] Starting background model scan...');
    setImmediate(() => {
      try {
        const result = getFullSystemModels();
        cachedModels = result;
        saveScanCache(result);
        scanState = 'ready';
        const total = Object.values(result.modelsByCategory).reduce((acc, arr) => acc + arr.length, 0);
        console.log(`[NexusAI Standalone Engine] Scan complete: ${total} models found.`);
      } catch (e) {
        scanState = 'error';
        console.error('[NexusAI Standalone Engine] Scan error:', e.message);
      }
    });
  }

  cachedModels = loadScanCache();
  if (cachedModels) {
    scanState = 'ready';
  } else {
    try {
      cachedModels = getFullSystemModels();
      saveScanCache(cachedModels);
      scanState = 'ready';
    } catch (e) {}
  }
  runBackgroundScan();

  function getSdCliExecutable() {
    const hw = detectHardware();
    const isCuda = hw.preferredBackend === 'cuda';

    const searchDirs = isCuda ? [
      path.join(resourcesPath, 'backend/win/cuda/sd-cli.exe'),
      path.join(resourcesPath, 'backend/win/cuda/sd-cuda.exe'),
      path.join(rootDir, 'backend/win/cuda/sd-cli.exe'),
      'D:/genimg_comic/backend/win/cuda/sd-cli.exe',
      path.join(resourcesPath, 'backend/win/vulkan/sd-cli.exe'),
      path.join(rootDir, 'backend/win/vulkan/sd-cli.exe')
    ] : [
      path.join(resourcesPath, 'backend/win/vulkan/sd-cli.exe'),
      path.join(resourcesPath, 'backend/win/vulkan/sd-vulkan.exe'),
      path.join(rootDir, 'backend/win/vulkan/sd-cli.exe'),
      'D:/genimg_comic/backend/win/vulkan/sd-cli.exe',
      path.join(resourcesPath, 'backend/win/cuda/sd-cli.exe'),
      path.join(rootDir, 'backend/win/cuda/sd-cli.exe')
    ];

    for (const p of searchDirs) {
      if (fs.existsSync(p)) return p;
    }
    return searchDirs[0];
  }

  function getLlamaExecutable() {
    const searchDirs = [
      path.join(resourcesPath, 'backend/win/llama/llama-server.exe'),
      path.join(rootDir, 'backend/win/llama/llama-server.exe')
    ];
    for (const p of searchDirs) {
      if (fs.existsSync(p)) return p;
    }
    return searchDirs[0];
  }

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

          const outDir = path.join(publicDir, 'outputs');
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

          const outFilename = `gen_${Date.now()}.png`;
          const outFullPath = path.join(outDir, outFilename);
          const modelFullPath = resolveModelFullPath(params.modelPath);
          const clipFullPath = resolveModelFullPath(params.clipPath);
          const t5FullPath = resolveModelFullPath(params.t5Path);
          const vaeFullPath = resolveModelFullPath(params.vaePath);

          const args = [];
          if (params.pipeline === 'flux') {
            args.push('--diffusion-model', modelFullPath);
            const isKlein = modelFullPath.toLowerCase().includes('klein') || (params.modelPath || '').toLowerCase().includes('klein');
            if (isKlein) {
              args.push('--prediction', 'flux2_flow');
            }
            if (clipFullPath) args.push('--llm', clipFullPath);
            if (t5FullPath) args.push('--t5xxl', t5FullPath);
            if (vaeFullPath) args.push('--vae', vaeFullPath);
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
          child.stderr?.on('data', d => { stderrLog += d.toString(); });
          child.stdout?.on('data', d => { console.log('[sd-cli]', d.toString().trim()); });
          child.on('close', code => {
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
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ─── Static File Serving (dist/ and public/) ─────────────────────────────
    let requestedFile = pathname === '/' ? '/index.html' : pathname;
    
    // Check public directory (outputs, themes, icons)
    let filePath = path.join(publicDir, requestedFile);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, requestedFile);
    }
    // Fallback to index.html for SPA client-side routing
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
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