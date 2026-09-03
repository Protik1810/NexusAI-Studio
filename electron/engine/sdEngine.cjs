/**
 * sdEngine.cjs — stable-diffusion.cpp process management
 * Shared between electron/server.cjs (production) and vite.config.ts (dev mode)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

/**
 * Spawn sd-cli.exe with the given arguments and wait for it to finish,
 * verifying image output rather than trusting the exit code.
 * (sd-cli on Windows/CUDA always exits with code 1 even on success.)
 *
 * @param {object} opts
 * @param {string} opts.execPath - Full path to sd-cli.exe
 * @param {string[]} opts.args - CLI arguments
 * @param {string} opts.outFullPath - Expected output image path
 * @param {string} opts.outFilename - Filename portion (for URL)
 * @param {string} opts.workingDir - Working directory for the process
 * @param {object} opts.env - Environment variables
 * @param {function} [opts.onStdout] - Callback for stdout lines
 * @param {function} [opts.onSpawn] - Callback with the ChildProcess, so callers can cancel it
 * @returns {Promise<{success:true, imageUrl:string, outputPath:string}>}
 */
function runSdCli({ execPath, args, outFullPath, outFilename, workingDir, env, onStdout, onSpawn }) {
  return new Promise((resolve, reject) => {
    const child = spawn(execPath, args, { cwd: workingDir, env, windowsHide: true });
    if (onSpawn) onSpawn(child);
    let stderrLog = '';

    child.stderr?.on('data', d => { stderrLog += d.toString(); });
    child.stdout?.on('data', d => {
      if (!onStdout) return;
      // sd-cli redraws its progress bar in place with '\r', not '\n' — a
      // single 'data' chunk can contain many progress ticks. Split on both
      // so each tick reaches the caller instead of one giant blended line.
      d.toString().split(/[\r\n]+/).map(s => s.trim()).filter(Boolean).forEach(onStdout);
    });

    child.on('close', code => {
      // Check image file existence with retry to handle async CUDA file flush
      const checkAndRespond = (attempt) => {
        try {
          const imageGenerated = fs.existsSync(outFullPath) && fs.statSync(outFullPath).size > 1000;
          if (imageGenerated) {
            console.log(`[sdEngine] SUCCESS: ${outFullPath}`);
            resolve({
              success: true,
              imageUrl: `/outputs/${outFilename}?t=${Date.now()}`,
              outputPath: outFullPath
            });
          } else if (attempt < 3) {
            // Retry up to 3x with 300ms gap — CUDA file write may lag behind process exit
            setTimeout(() => checkAndRespond(attempt + 1), 300);
          } else {
            console.error('[sdEngine] STDERR:', stderrLog);
            console.error('[sdEngine] Expected output at:', outFullPath, '— exists:', fs.existsSync(outFullPath));
            const errMsg = stderrLog
              ? `sd-cli exit code ${code}:\n${stderrLog.slice(-2000)}`
              : `sd-cli exited with code ${code}. Check model path or GPU memory.`;
            reject(new Error(errMsg));
          }
        } catch (e) {
          reject(e);
        }
      };
      checkAndRespond(0);
    });

    child.on('error', reject);
  });
}

/**
 * Ensure the output directory exists and is writable.
 * Prefers APPDATA/Solframe Studio/outputs over app publicDir/outputs.
 * @param {string} publicDir - Application public directory
 * @returns {string} Writable output directory path
 */
function getOutputDir(publicDir) {
  const userDataDir = path.join(
    process.env.APPDATA || process.env.HOME || publicDir,
    'Solframe Studio'
  );
  const userOutputsDir = path.join(userDataDir, 'outputs');
  try {
    if (!fs.existsSync(userOutputsDir)) fs.mkdirSync(userOutputsDir, { recursive: true });
    const testFile = path.join(userOutputsDir, '.write-test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return userOutputsDir;
  } catch (e) {
    // Fallback to publicDir/outputs (dev mode)
    const fallback = path.join(publicDir, 'outputs');
    try { if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true }); } catch (e2) {}
    return fallback;
  }
}

let _vulkanDeviceCache;

/**
 * Pick which Vulkan device sd-cli should run on.
 *
 * sd-cli defaults to Vulkan device 0, which on a hybrid-graphics laptop is
 * the integrated GPU — it shares system RAM through a small carve-out and
 * dies with ErrorOutOfDeviceMemory on a ~1GB allocation, even though a
 * perfectly good discrete card sits at device 1. Verified on a Ryzen 4600H
 * + GTX 1650 Ti laptop: device 0 (AMD RENOIR, uma:1) OOMs immediately,
 * device 1 (the 1650 Ti, uma:0) loads and samples.
 *
 * Device order is a driver-enumeration detail, not something we can assume,
 * so ask the binary itself. `uma: 1` marks a unified-memory (integrated)
 * device, so the first `uma: 0` entry is the discrete one.
 *
 * Returns an index, or null to leave sd-cli on its own default.
 */
function detectVulkanDevice(execPath) {
  if (_vulkanDeviceCache !== undefined) return _vulkanDeviceCache;
  _vulkanDeviceCache = null;
  try {
    // spawnSync, not execFileSync: the per-device "uma" flags this needs are
    // printed to stderr, while stdout carries only a bare "Vulkan0<TAB>name"
    // list with no way to tell integrated from discrete. spawnSync hands
    // back both streams, and doesn't throw on a non-zero exit.
    const res = spawnSync(execPath, ['--list-devices'], {
      encoding: 'utf8', timeout: 30000, cwd: path.dirname(execPath), windowsHide: true
    });
    const combined = `${res.stdout || ''}\n${res.stderr || ''}`;
    _vulkanDeviceCache = parseVulkanDevices(combined);
    if (_vulkanDeviceCache === null && res.error) {
      console.warn(`[Solframe] Couldn't enumerate Vulkan devices (${res.error.message}) — letting sd-cli choose.`);
    }
  } catch (e) {
    console.warn(`[Solframe] Couldn't enumerate Vulkan devices (${e.message.split('\n')[0]}) — letting sd-cli choose.`);
  }
  return _vulkanDeviceCache;
}

function parseVulkanDevices(text) {
  const devices = [];
  for (const line of String(text).split('\n')) {
    // "ggml_vulkan: 1 = NVIDIA GeForce GTX 1650 Ti (NVIDIA) | uma: 0 | ..."
    const m = /ggml_vulkan:\s*(\d+)\s*=\s*(.+?)\s*\|\s*uma:\s*(\d)/.exec(line);
    if (m) devices.push({ index: Number(m[1]), name: m[2], uma: m[3] === '1' });
  }
  if (devices.length < 2) return null;      // nothing to choose between
  const discrete = devices.find(d => !d.uma);
  if (!discrete) return null;
  if (discrete.index !== 0) {
    console.log(`[Solframe] Using discrete GPU for diffusion: Vulkan${discrete.index} (${discrete.name}) — device 0 is integrated.`);
  }
  return discrete.index;
}

/**
 * Build sd-cli argument array from generation parameters.
 * @param {object} params - Generation parameters
 * @param {string} outFullPath - Output file path
 */
function buildSdCliArgs(params, outFullPath) {
  const args = [];
  let prompt = params.prompt || '';
  if (params.pipeline === 'flux') {
    args.push('--diffusion-model', params.modelPath);
    // "flux2_flow" was the prediction-type name in older sd-cli builds;
    // current builds renamed it to "flux_flow" (shared with FLUX.1) and
    // reject the old name outright (dumps --help and exits) — verified
    // against a real generation run after the June-2026-era Windows CUDA
    // binary was replaced with a current build to get correct fp8 support.
    const isKlein = (params.modelPath || '').toLowerCase().includes('klein');
    if (isKlein) args.push('--prediction', 'flux_flow');
    if (params.clipPath && fs.existsSync(params.clipPath)) args.push('--llm', params.clipPath);
    if (params.t5Path && fs.existsSync(params.t5Path)) args.push('--t5xxl', params.t5Path);
    if (params.vaePath && fs.existsSync(params.vaePath)) args.push('--vae', params.vaePath);
    // Flash attention in the diffusion model is a strict win for FLUX on
    // CUDA: it's mathematically exact (not an approximation), and on a 9B
    // Klein model it cut real VRAM use from 17.3GB to 9.1GB — enough to
    // stop the driver from silently oversubscribing VRAM via CUDA's VMM,
    // which was the actual cause of ~39s/it thrashing (not raw compute
    // cost). Verified: 371s -> 103s end-to-end on a 12GB card, same output.
    args.push('--diffusion-fa');
    // Uncensored FLUX.2 text encoders are often full LLMs (7-9B dense
    // params) and can need more VRAM alone than the diffusion model.
    // --offload-to-cpu keeps ALL module weights (diffusion + text encoder +
    // vae) resident in system RAM and stages each into VRAM only when it's
    // actually computing — unlike the old --backend te=cpu, which forced
    // the text encoder's compute itself onto the CPU, everything still runs
    // on the GPU here, only weight *residency* moves to RAM. Verified
    // faster than te=cpu (103s vs 128s on the same 9B model+prompt) and is
    // the flag stable-diffusion.cpp's own docs/flux2.md recommends for
    // Klein-scale models on constrained VRAM.
    if (params.offloadTextEncoder) args.push('--offload-to-cpu');
    // -r/--ref-image is FLUX Kontext-style image editing: the diffusion
    // model conditions directly on the reference image's own latents, not
    // through the text encoder — verified working this session (used for a
    // real relighting LoRA test). Not every FLUX checkpoint supports it
    // (Kontext-capability isn't detectable from a filename), so this is
    // opt-in via the UI rather than assumed.
    if (params.refImagePath && fs.existsSync(params.refImagePath)) args.push('-r', params.refImagePath);
  } else {
    args.push('-m', params.modelPath);
  }

  // -n applies to both pipelines. For FLUX it only has a visible effect
  // once real classifier-free guidance is active (cfg > 1, e.g. the "base"
  // Klein variants at cfg 4.0) — the distilled models default to cfg 1.0,
  // where CFG is a no-op and a negative prompt does nothing. It's harmless
  // either way, so it's not worth gating behind a pipeline check.
  if (params.negativePrompt) args.push('-n', params.negativePrompt);

  // sd-cli has no standalone --lora flag: LoRAs are applied via a
  // <lora:name:strength> tag inside the prompt text itself, plus
  // --lora-model-dir pointing at the folder containing that file (verified
  // against the real binary — confirmed "loading LoRA from ..." in its log).
  if (params.loraPath && fs.existsSync(params.loraPath)) {
    const loraName = path.basename(params.loraPath, path.extname(params.loraPath));
    const loraStrength = params.loraStrength !== undefined ? params.loraStrength : 1;
    args.push('--lora-model-dir', path.dirname(params.loraPath));
    prompt = `${prompt} <lora:${loraName}:${loraStrength}>`;
  }

  args.push(
    '-p', prompt,
    '-o', outFullPath,
    '-W', String(params.width || 512),
    '-H', String(params.height || 512),
    '--steps', String(params.steps || 4),
    '--cfg-scale', String(params.cfgScale || 1.8)
  );
  args.push('--seed', String(params.seed !== undefined ? params.seed : Math.floor(Math.random() * 1000000)));
  if (params.samplingMethod) args.push('--sampling-method', params.samplingMethod);
  return args;
}

module.exports = { runSdCli, getOutputDir, buildSdCliArgs, detectVulkanDevice };
