/**
 * modelScanner.cjs — Model file discovery, classification, and caching
 * Shared between electron/server.cjs (production) and vite.config.ts (dev mode)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { getAllSystemScanPaths } = require('./pathUtils.cjs');

const MODEL_EXTENSIONS = ['.safetensors', '.gguf', '.ckpt', '.bin', '.pt'];
const MIN_MODEL_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB minimum

/**
 * Recursively scan a directory for AI model files.
 */
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
        if (MODEL_EXTENSIONS.includes(ext)) {
          try {
            const stat = fs.statSync(full);
            if (stat.size > MIN_MODEL_SIZE_BYTES) results.push(full);
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  return results;
}

/**
 * Classify a model file into a category based on path/name heuristics.
 * Returns null for files that should be skipped (e.g. vocab files).
 */
function classifyModelFile(fullPath, sourceLabel, rootDir = '') {
  const filename = path.basename(fullPath);
  const lower = fullPath.toLowerCase().replace(/\\/g, '/');
  const stat = fs.statSync(fullPath);
  const sizeMB = stat.size / (1024 * 1024);
  const sizeGB = sizeMB / 1024;
  const formattedSize = sizeGB >= 1 ? `${sizeGB.toFixed(2)} GB` : `${sizeMB.toFixed(0)} MB`;
  const isGguf = filename.toLowerCase().endsWith('.gguf');

  if (isGguf && filename.startsWith('ggml-vocab-')) return null;

  // Always assigned below — the chain ends in an unconditional else.
  let category;
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
  } else if (
    lower.includes('/llm/') || lower.includes('\\llm\\') ||
    lower.includes('qwen') || lower.includes('llama') ||
    lower.includes('instruct') || lower.includes('bge-') ||
    lower.includes('embedding') || lower.includes('bert')
  ) {
    category = 'llms';
  } else {
    category = 'checkpoints';
  }

  return {
    name: filename,
    filename,
    fullPath: fullPath.replace(/\\/g, '/'),
    relativePath: rootDir ? path.relative(rootDir, fullPath).replace(/\\/g, '/') : filename,
    sizeBytes: stat.size,
    formattedSize,
    source: sourceLabel,
    category,
    isGguf
  };
}

/**
 * Perform a full system scan and return models grouped by category.
 * @param {string} rootDir - App root directory
 * @param {string[]} customPaths - Additional user-defined paths
 * @param {{ scanProgress?: number, scanTotal?: number }} state - Mutable scan state ref
 */
function getFullSystemModels(rootDir = '', customPaths = [], state = {}) {
  const scanPaths = getAllSystemScanPaths(rootDir, customPaths);
  const seenPaths = new Set();
  const modelsByCategory = {
    checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: []
  };

  state.scanTotal = scanPaths.length;
  state.scanProgress = 0;

  for (const sp of scanPaths) {
    state.scanProgress = (state.scanProgress || 0) + 1;
    const files = scanDirectoryRecursive(sp.path);
    for (const f of files) {
      const norm = path.normalize(f);
      if (seenPaths.has(norm)) continue;
      seenPaths.add(norm);
      try {
        const item = classifyModelFile(f, sp.label, rootDir);
        if (!item) continue;
        if (!modelsByCategory[item.category]) modelsByCategory[item.category] = [];
        modelsByCategory[item.category].push(item);
      } catch (e) {}
    }
  }

  // Sort categories: put dedicated models/ folders and prominent models first
  const checkpointScore = (m) => {
    const p = m.fullPath.toLowerCase();
    if (p.includes('/checkpoints/') || p.includes('\\checkpoints\\')) return 100;
    if (p.includes('lightning') || p.includes('realvis') || p.includes('juggernaut')) return 80;
    if (p.includes('sdxl') || p.includes('nsfw') || p.includes('pony')) return 60;
    return 10;
  };
  modelsByCategory.checkpoints.sort((a, b) => checkpointScore(b) - checkpointScore(a));

  return { modelsByCategory, scanPaths };
}

/**
 * Load scan cache from disk (global ~/.solframe or local models/.scan_cache.json).
 */
function loadScanCache(paths = {}) {
  const { globalCacheFile, localCacheFile } = paths;
  const tryParse = (file) => {
    try {
      if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {}
    return null;
  };
  return tryParse(globalCacheFile) || tryParse(localCacheFile) || null;
}

/**
 * Persist scan results to cache files.
 */
function saveScanCache(data, paths = {}) {
  const { globalCacheFile, globalCacheDir, localCacheFile } = paths;
  const payload = JSON.stringify({ ...data, cachedAt: Date.now() }, null, 2);
  if (globalCacheFile) {
    try {
      if (globalCacheDir && !fs.existsSync(globalCacheDir)) fs.mkdirSync(globalCacheDir, { recursive: true });
      fs.writeFileSync(globalCacheFile, payload);
    } catch (e) {}
  }
  if (localCacheFile) {
    try {
      const dir = path.dirname(localCacheFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(localCacheFile, payload);
    } catch (e) {}
  }
}

module.exports = { scanDirectoryRecursive, classifyModelFile, getFullSystemModels, loadScanCache, saveScanCache };
