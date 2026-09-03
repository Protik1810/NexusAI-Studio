/**
 * pathUtils.cjs — Model path resolution and executable discovery
 * Shared between electron/server.cjs (production) and vite.config.ts (dev mode)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { detectHardware } = require('./hardware.cjs');
const { getModelsRoot } = require('./userSettings.cjs');

/**
 * Where new model downloads go: ~/Downloads/Solframe Studio by default, or
 * wherever the user pointed it in Settings. Always writable without
 * elevation, and — unlike the app-data folder this used to be — somewhere
 * a person can actually find a 7 GB checkpoint they downloaded.
 *
 * Never rootDir/resourcesPath: in a packaged build that's read-only (Linux
 * AppImage), root-owned (.deb under /opt), or not a directory at all (the
 * app ships as an asar archive, so writes fail with ENOTDIR).
 */
function getUserModelsRoot() {
  return getModelsRoot();
}

/**
 * The pre-1.1.3 download location (%APPDATA%\Solframe Studio, ~/Library/
 * Application Support/Solframe Studio). New downloads no longer go here,
 * but anyone upgrading already has models in it — it stays a scan path so
 * their library doesn't vanish, and nothing has to be moved.
 */
function getLegacyModelsRoot() {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const appDataDir = process.env.APPDATA || (
    process.platform === 'win32' ? path.join(userHome, 'AppData/Roaming') :
    process.platform === 'darwin' ? path.join(userHome, 'Library/Application Support') :
    userHome
  );
  return path.join(appDataDir, 'Solframe Studio');
}

const STANDARD_MODEL_DIRS = [
  'models', 'AI/models', 'AI_Models', 'LLM',
  'Development/LLM', 'Development/Meta Llama', 'Development',
  'ComfyUI/models', 'Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/models',
  'stable-diffusion-webui/models', 'text-generation-webui/models',
  'Fooocus/models', 'InvokeAI/models', 'Uncensored-Local-Studio-main/app/llm-models'
];

/**
 * Get all system paths to scan for models.
 * @param {string} rootDir - App root directory
 * @param {string[]} customPaths - User-defined additional paths
 */
function getAllSystemScanPaths(rootDir = '', customPaths = []) {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const exeDir = path.dirname(process.execPath || '');
  const candidates = [];

  // 1. Dynamic drive scanning
  //    Windows: C:, D:, E: … Z:.  macOS/Linux have no drive letters — the
  //    closest equivalent is /Volumes/* (macOS mount points for external
  //    drives; the internal disk's own folders are covered by the user-home
  //    scan below, same as Windows' C:/Users equivalent already is).
  const driveRoots = process.platform === 'win32'
    ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => ({ root: `${letter}:/`, label: `${letter}:` }))
    : (fs.existsSync('/Volumes')
        ? fs.readdirSync('/Volumes', { withFileTypes: true })
            .filter(e => e.isDirectory() && e.name !== 'Macintosh HD')
            .map(e => ({ root: `/Volumes/${e.name}/`, label: e.name }))
        : []);

  for (const { root: driveRoot, label: driveLabel } of driveRoots) {
    try {
      if (fs.existsSync(driveRoot)) {
        // Direct standard AI directories
        for (const sub of STANDARD_MODEL_DIRS) {
          const full = path.join(driveRoot, sub);
          if (fs.existsSync(full)) {
            candidates.push({ path: full.replace(/\\/g, '/'), label: `${driveLabel} ${sub}`, isBuiltIn: true });
          }
        }

        // Auto-discover any top-level project folders containing models/ or checkpoints/
        try {
          const topEntries = fs.readdirSync(driveRoot, { withFileTypes: true });
          for (const entry of topEntries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('$') || entry.name.startsWith('.') || ['Windows', 'Program Files', 'Program Files (x86)', 'System Volume Information', '$Recycle.Bin'].includes(entry.name)) continue;

            const subModels = path.join(driveRoot, entry.name, 'models');
            if (fs.existsSync(subModels)) {
              candidates.push({ path: subModels.replace(/\\/g, '/'), label: `${driveLabel} ${entry.name}/models`, isBuiltIn: true });
            }
            const subCheckpoints = path.join(driveRoot, entry.name, 'checkpoints');
            if (fs.existsSync(subCheckpoints)) {
              candidates.push({ path: subCheckpoints.replace(/\\/g, '/'), label: `${driveLabel} ${entry.name}/checkpoints`, isBuiltIn: true });
            }
          }
        } catch (e2) {}
      }
    } catch (e) {}
  }

  // 2. User home & AppData directories (HuggingFace, LM Studio, Ollama, Solframe, etc.)
  const userDirs = [
    { path: path.join(getUserModelsRoot(), 'models'), label: 'Solframe Models (Downloads)' },
    // Chat models download to <root>/llm-models, a sibling of models/ — it
    // needs its own entry or downloaded GGUFs are invisible to the scanner.
    { path: path.join(getUserModelsRoot(), 'llm-models'), label: 'Solframe LLM Models (Downloads)' },
    // Pre-1.1.3 downloads lived in app-data. Kept so upgrading users keep
    // seeing models they already have.
    { path: path.join(getLegacyModelsRoot(), 'models'), label: 'Solframe Models (legacy AppData)' },
    { path: path.join(getLegacyModelsRoot(), 'llm-models'), label: 'Solframe LLM Models (legacy AppData)' },
    { path: path.join(userHome, '.solframe/models'), label: 'User Home Solframe Models' },
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
  if (rootDir) {
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
  }

  // 4. User-defined custom paths
  for (const c of customPaths) {
    if (fs.existsSync(c)) {
      candidates.push({ path: c.replace(/\\/g, '/'), label: `Custom (${path.basename(c)})`, isBuiltIn: false });
    }
  }

  // Deduplicate
  const seen = new Set();
  return candidates.filter(c => {
    const norm = path.normalize(c.path).toLowerCase();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

/**
 * Resolve a model name or relative path to an absolute path by searching system paths.
 * @param {string} p - Model name or relative/absolute path
 * @param {string} rootDir - App root directory
 * @param {string[]} customPaths - User-defined additional scan paths
 */
function resolveModelFullPath(p, rootDir = '', customPaths = []) {
  if (!p) return '';
  if (path.isAbsolute(p) && fs.existsSync(p)) return p;
  const rootCandidate = path.resolve(rootDir, p);
  if (fs.existsSync(rootCandidate)) return rootCandidate;
  const baseName = path.basename(p);
  const allPaths = getAllSystemScanPaths(rootDir, customPaths);
  for (const sp of allPaths) {
    const direct = path.join(sp.path, baseName);
    if (fs.existsSync(direct)) return direct;
    for (const sub of ['checkpoints', 'unet', 'clip', 'vae', 'loras', 'llm']) {
      const subCandidate = path.join(sp.path, sub, baseName);
      if (fs.existsSync(subCandidate)) return subCandidate;
    }
  }
  return rootCandidate;
}

/**
 * Find the best available sd-cli executable based on GPU backend.
 * @param {object} opts - { rootDir, resourcesPath }
 */
function getSdCliExecutable({ rootDir = '', resourcesPath = '' } = {}) {
  const hw = detectHardware();
  const isCuda = hw.preferredBackend === 'cuda';
  const exeDir = path.dirname(process.execPath || '');

  if (process.platform === 'darwin') {
    const metalCandidates = [
      path.join(rootDir, 'backend/mac/metal/sd-cli'),
      path.join(resourcesPath, 'app/backend/mac/metal/sd-cli'),
      path.join(resourcesPath, 'backend/mac/metal/sd-cli'),
      path.join(exeDir, '../Resources/app/backend/mac/metal/sd-cli'),
      path.join(exeDir, '../Resources/backend/mac/metal/sd-cli'),
      path.join(__dirname, '../../backend/mac/metal/sd-cli')
    ];
    for (const c of metalCandidates) {
      if (fs.existsSync(c)) return c;
    }
    return metalCandidates[0];
  }

  if (process.platform === 'linux') {
    // CUDA first when an NVIDIA card is present, then Vulkan, then CPU.
    //
    // Upstream publishes no prebuilt Linux CUDA binary (only vulkan/rocm/
    // cpu), so backend/linux/cuda is built from source by us — see
    // scripts/build-linux-cuda.sh. It is therefore optional: on a machine
    // without it, or without an NVIDIA GPU, this falls straight through to
    // Vulkan, which drives NVIDIA, AMD and Intel alike.
    // Keyed off the GPU vendor, not hw.preferredBackend: that reports
    // "vulkan" for NVIDIA on Linux (the always-available default), so using
    // it here would skip the CUDA tier even when it is installed.
    const hasNvidia = (hw.gpus || []).some(g => g.isNvidia);
    const backends = hasNvidia ? ['cuda', 'vulkan', 'cpu'] : ['vulkan', 'cpu'];
    const linuxCandidates = [];
    for (const backend of backends) {
      linuxCandidates.push(
        path.join(rootDir, `backend/linux/${backend}/sd-cli`),
        path.join(resourcesPath, `backend/linux/${backend}/sd-cli`),
        path.join(resourcesPath, `app/backend/linux/${backend}/sd-cli`),
        path.join(exeDir, `resources/backend/linux/${backend}/sd-cli`),
        path.join(exeDir, `backend/linux/${backend}/sd-cli`),
        path.join(__dirname, `../../backend/linux/${backend}/sd-cli`)
      );
    }
    for (const c of linuxCandidates) {
      if (fs.existsSync(c)) return c;
    }
    return linuxCandidates[0];
  }

  const cudaCandidates = [
    path.join(rootDir, 'backend/win/cuda/sd-cli.exe'),
    path.join(rootDir, 'backend/win/cuda/sd-cuda.exe'),
    path.join(resourcesPath, 'app/backend/win/cuda/sd-cli.exe'),
    path.join(resourcesPath, 'backend/win/cuda/sd-cli.exe'),
    path.join(exeDir, 'resources/app/backend/win/cuda/sd-cli.exe'),
    path.join(exeDir, 'backend/win/cuda/sd-cli.exe'),
    path.join(__dirname, '../../backend/win/cuda/sd-cli.exe')
  ];
  const vulkanCandidates = [
    path.join(rootDir, 'backend/win/vulkan/sd-cli.exe'),
    path.join(rootDir, 'backend/win/vulkan/sd-vulkan.exe'),
    path.join(resourcesPath, 'app/backend/win/vulkan/sd-cli.exe'),
    path.join(resourcesPath, 'backend/win/vulkan/sd-cli.exe'),
    path.join(exeDir, 'resources/app/backend/win/vulkan/sd-cli.exe'),
    path.join(exeDir, 'backend/win/vulkan/sd-cli.exe'),
    path.join(__dirname, '../../backend/win/vulkan/sd-cli.exe')
  ];
  const cpuCandidates = [
    path.join(rootDir, 'backend/win/cpu/sd-cli.exe'),
    path.join(resourcesPath, 'app/backend/win/cpu/sd-cli.exe'),
    path.join(resourcesPath, 'backend/win/cpu/sd-cli.exe'),
    path.join(exeDir, 'resources/app/backend/win/cpu/sd-cli.exe'),
    path.join(__dirname, '../../backend/win/cpu/sd-cli.exe')
  ];

  const list = isCuda
    ? [...cudaCandidates, ...vulkanCandidates, ...cpuCandidates]
    : [...vulkanCandidates, ...cudaCandidates, ...cpuCandidates];

  for (const c of list) {
    if (fs.existsSync(c)) return c;
  }
  return cudaCandidates[0];
}

/**
 * Find the best available llama-server executable.
 * @param {object} opts - { rootDir, resourcesPath }
 */
function getLlamaExecutable({ rootDir = '', resourcesPath = '' } = {}) {
  const exeDir = path.dirname(process.execPath || '');

  if (process.platform === 'darwin') {
    const macCandidates = [
      path.join(rootDir, 'backend/mac/llama/llama-server'),
      path.join(resourcesPath, 'app/backend/mac/llama/llama-server'),
      path.join(resourcesPath, 'backend/mac/llama/llama-server'),
      path.join(exeDir, '../Resources/app/backend/mac/llama/llama-server'),
      path.join(exeDir, '../Resources/backend/mac/llama/llama-server'),
      path.join(__dirname, '../../backend/mac/llama/llama-server')
    ];
    for (const c of macCandidates) {
      if (fs.existsSync(c)) return c;
    }
    return macCandidates[0];
  }

  if (process.platform === 'linux') {
    // llama-cuda is built from source alongside the diffusion engine (see
    // scripts/build-linux-cuda.sh) and is optional — falls back to the
    // shipped Vulkan build when absent.
    const linuxCandidates = [];
    for (const backend of ['llama-cuda', 'llama']) {
      linuxCandidates.push(
        path.join(rootDir, `backend/linux/${backend}/llama-server`),
        path.join(resourcesPath, `backend/linux/${backend}/llama-server`),
        path.join(resourcesPath, `app/backend/linux/${backend}/llama-server`),
        path.join(exeDir, `resources/backend/linux/${backend}/llama-server`),
        path.join(exeDir, `backend/linux/${backend}/llama-server`),
        path.join(__dirname, `../../backend/linux/${backend}/llama-server`)
      );
    }
    for (const c of linuxCandidates) {
      if (fs.existsSync(c)) return c;
    }
    return linuxCandidates[0];
  }

  const candidates = [
    path.join(rootDir, 'backend/win/llama/llama-server.exe'),
    path.join(resourcesPath, 'app/backend/win/llama/llama-server.exe'),
    path.join(resourcesPath, 'backend/win/llama/llama-server.exe'),
    path.join(exeDir, 'resources/app/backend/win/llama/llama-server.exe'),
    path.join(exeDir, 'backend/win/llama/llama-server.exe'),
    path.join(__dirname, '../../backend/win/llama/llama-server.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

module.exports = { getAllSystemScanPaths, resolveModelFullPath, getSdCliExecutable, getLlamaExecutable, getUserModelsRoot, getLegacyModelsRoot };
