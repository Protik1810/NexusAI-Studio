/**
 * hardware.cjs — GPU/CPU auto-detection shared engine module
 * Used by both electron/server.cjs (production) and vite.config.ts (dev mode)
 */
'use strict';
const { execSync } = require('child_process');

let _cached = null;

function detectHardware() {
  if (_cached) return _cached;

  let gpus = [];
  // Always recomputed from `gpus` in the exhaustive if/else below.
  let preferredBackend;
  let primaryGpu = 'Auto-Detect GPU';

  try {
    const smiOut = execSync(
      'nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits',
      { encoding: 'utf8', windowsHide: true, timeout: 2000 }
    );
    for (const l of smiOut.trim().split('\n')) {
      const parts = l.split(',').map(s => s.trim());
      if (!parts[0]) continue;
      const vramMB = parseInt(parts[1] || '0', 10);
      gpus.push({
        name: parts[0], vendor: 'NVIDIA',
        vram: `${(vramMB / 1024).toFixed(1)} GB`, vramMB,
        driver: parts[2] || '', isNvidia: true, backend: 'cuda'
      });
    }
    if (gpus.length > 0) {
      primaryGpu = `${gpus[0].name} (${gpus[0].vram} - CUDA)`;
    }
  } catch (e) {}

  if (process.platform === 'darwin') {
    try {
      const chipName = execSync('sysctl -n machdep.cpu.brand_string', {
        encoding: 'utf8', timeout: 2000
      }).trim() || (process.arch === 'arm64' ? 'Apple Silicon' : 'Intel Mac');
      // Apple Silicon (and modern Intel Macs) don't expose a discrete VRAM
      // pool — Metal shares the system's unified memory, so total RAM is the
      // honest number to show instead of a made-up VRAM figure.
      const os = require('os');
      const totalRamGB = os.totalmem() / (1024 ** 3);
      gpus.push({
        name: chipName,
        vendor: 'Apple',
        vram: `${totalRamGB.toFixed(0)} GB unified`,
        vramMB: Math.round(totalRamGB * 1024),
        driver: '',
        isNvidia: false,
        isApple: true,
        backend: 'metal'
      });
    } catch (e) {}
  }

  if (process.platform === 'win32') {
    try {
      const psOut = execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | ConvertTo-Json"',
        { encoding: 'utf8', windowsHide: true, timeout: 3000 }
      );
      const items = [].concat(JSON.parse(psOut)).filter(Boolean);
      for (const item of items) {
        if (!item.Name) continue;
        const name = item.Name;
        const lower = name.toLowerCase();
        const isNvidia = lower.includes('nvidia') || lower.includes('geforce') || lower.includes('rtx') || lower.includes('gtx');
        const isAmd = lower.includes('amd') || lower.includes('radeon');
        const isIntel = lower.includes('intel') || lower.includes('arc') || lower.includes('iris');
        if (!gpus.some(g => g.name.toLowerCase() === lower)) {
          const ramMB = item.AdapterRAM ? Math.round(item.AdapterRAM / (1024 * 1024)) : 0;
          gpus.push({
            name, isNvidia,
            vendor: isNvidia ? 'NVIDIA' : isAmd ? 'AMD' : isIntel ? 'Intel' : 'Generic',
            vram: ramMB > 1024 ? `${(ramMB / 1024).toFixed(1)} GB` : `${ramMB} MB`,
            vramMB: ramMB,
            driver: item.DriverVersion || '',
            backend: isNvidia ? 'cuda' : (isAmd || isIntel) ? 'vulkan' : 'cpu'
          });
        }
      }
    } catch (e) {}
  }

  const hasNvidia = gpus.some(g => g.isNvidia);
  const hasAmdOrIntel = gpus.some(g => g.vendor === 'AMD' || g.vendor === 'Intel');
  const hasApple = gpus.some(g => g.isApple);
  if (hasNvidia) {
    // CUDA everywhere except Linux, where neither stable-diffusion.cpp nor
    // llama.cpp publishes a prebuilt CUDA binary — the shipped Linux engine
    // is the Vulkan one, which drives NVIDIA cards fine. Reporting "CUDA"
    // there would name a backend the app has no binary for.
    const nvidiaBackend = process.platform === 'linux' ? 'vulkan' : 'cuda';
    preferredBackend = nvidiaBackend;
    if (!primaryGpu || primaryGpu === 'Auto-Detect GPU') {
      const g = gpus.find(g => g.isNvidia);
      primaryGpu = `${g.name} (${g.vram} - ${nvidiaBackend.toUpperCase()})`;
    }
  } else if (hasAmdOrIntel) {
    preferredBackend = 'vulkan';
    const g = gpus.find(g => g.vendor === 'AMD' || g.vendor === 'Intel');
    primaryGpu = `${g.name} (${g.vram} - Vulkan)`;
  } else if (hasApple) {
    preferredBackend = 'metal';
    const g = gpus.find(g => g.isApple);
    primaryGpu = `${g.name} (${g.vram} - Metal)`;
  } else if (process.platform === 'darwin') {
    // sysctl failed for some reason — still darwin, so CPU fallback here
    // means "run the universal Mac binary without GPU offload", not the
    // Windows AVX2 CPU kernel.
    preferredBackend = 'metal';
    primaryGpu = 'CPU Fallback (Apple Silicon/Intel)';
  } else {
    preferredBackend = 'cpu';
    primaryGpu = 'CPU Fallback (AVX2)';
  }

  _cached = { gpus, preferredBackend, primaryGpu, os: `${process.platform} ${process.arch}`, nodeVersion: process.version };
  return _cached;
}

module.exports = { detectHardware };
