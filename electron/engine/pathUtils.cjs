/**
 * pathUtils.cjs — Model path resolution and executable discovery
 * Shared between electron/server.cjs (production) and vite.config.ts (dev mode)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { detectHardware } = require('./hardware.cjs');

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

  // 1. Dynamic drive scanning (Windows: C:, D:, E: … Z:)
  for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')) {
    const driveRoot = `${letter}:/`;
    try {
      if (fs.existsSync(driveRoot)) {
        for (const sub of STANDARD_MODEL_DIRS) {
          const full = path.join(driveRoot, sub);
          if (fs.existsSync(full)) {
            candidates.push({ path: full.replace(/\\/g, '/'), label: `${letter}: ${sub}`, isBuiltIn: true });
          }
        }
      }
    } catch (e) {}
  }

  // 2. User home directories (HuggingFace, LM Studio, Ollama, etc.)
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

module.exports = { getAllSystemScanPaths, resolveModelFullPath, getSdCliExecutable, getLlamaExecutable };
