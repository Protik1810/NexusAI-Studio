/**
 * engineCore.cjs — llama.cpp process lifecycle + image generation, extracted
 * so both apiRoutes.cjs (the internal, origin-checked UI API) and
 * agentApiServer.cjs (the API-key-checked external agent API) drive the
 * exact same llama-server process and sd-cli invocations instead of each
 * maintaining its own copy of this state — two independent copies would
 * race on the same GPU/process and could each think they own it.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { runSdCli, buildSdCliArgs, detectVulkanDevice } = require('./sdEngine.cjs');

// Decodes a "data:image/png;base64,...." URL (from a browser FileReader)
// into a temp file on disk — sd-cli needs a real file path for -r/--ref-image,
// it has no way to accept image bytes directly. Written to os.tmpdir()
// rather than userOutputsDir so it never gets mistaken for a generated
// result by anything that scans the outputs folder (e.g. the gallery).
function writeRefImageTempFile(dataUrl) {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Invalid reference image data URL');
  const [, ext, base64Data] = match;
  const tempPath = path.join(os.tmpdir(), `solframe-refimg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));
  return tempPath;
}

// llama.cpp's allowed KV cache quantization types (from llama-server.exe's
// own --help). Quantized V-cache (anything but f32/f16) requires Flash
// Attention — that constraint is enforced in the UI (ChatStudio.tsx), not
// here; this is just the last line of defense against a bad value reaching
// spawn() at all, e.g. from the Agent API's arbitrary request body.
const ALLOWED_CACHE_TYPES = ['f32', 'f16', 'bf16', 'q8_0', 'q4_0', 'q4_1', 'iq4_nl', 'q5_0', 'q5_1'];

/**
 * @param {object} ctx
 * @param {() => string} ctx.getSdCliExecutable
 * @param {() => string} ctx.getLlamaExecutable
 * @param {(p: string) => string} ctx.resolveModel
 * @param {string} ctx.rootDir
 * @param {string} ctx.userOutputsDir
 */
function createEngineCore(ctx) {
  const { getSdCliExecutable, getLlamaExecutable, resolveModel, rootDir, userOutputsDir } = ctx;

  let llamaProc = null;
  let currentLlamaModel = null;
  let llamaPort = 8080;
  let activeSdProc = null;

  function getLlamaStatus() {
    return { running: !!llamaProc && !llamaProc.killed, port: llamaPort, model: currentLlamaModel };
  }

  function getLlamaPort() {
    return llamaPort;
  }

  /**
   * @param {{modelPath:string, port?:number, ctxSize?:number, gpuLayers?:number, batchSize?:number, flashAttn?:string, cacheTypeK?:string, cacheTypeV?:string, mmprojPath?:string, reasoning?:boolean}} params
   * @returns {Promise<{success:true, port:number, model:string, message:string}>}
   */
  async function startLlama(params) {
    const modelFullPath = resolveModel(params.modelPath);
    if (!modelFullPath || !fs.existsSync(modelFullPath)) {
      const err = new Error(`Model file not found: ${params.modelPath}`);
      err.statusCode = 404;
      throw err;
    }
    // mmproj is optional (only vision models need it) — a bad/stale path
    // here shouldn't block starting a normal text-only model, so this
    // silently drops it rather than throwing, unlike the hard-required
    // modelPath check above.
    const mmprojFullPath = params.mmprojPath ? resolveModel(params.mmprojPath) : null;
    const mmprojValid = mmprojFullPath && fs.existsSync(mmprojFullPath) ? mmprojFullPath : null;
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
    const cacheTypeK = ALLOWED_CACHE_TYPES.includes(params.cacheTypeK) ? params.cacheTypeK : 'f16';
    const cacheTypeV = ALLOWED_CACHE_TYPES.includes(params.cacheTypeV) ? params.cacheTypeV : 'f16';

    const args = ['-m', modelFullPath, '--port', String(requestedPort), '--host', '127.0.0.1', '-ngl', String(gpuLayers), '-c', String(ctxSize), '-b', String(batchSize), '-fa', flashAttn, '-ctk', cacheTypeK, '-ctv', cacheTypeV];
    if (mmprojValid) args.push('--mmproj', mmprojValid);
    // "deepseek" (not "deepseek-legacy") puts reasoning in its own
    // reasoning_content field instead of embedding <think> tags in the
    // visible content — that's what streamChat()'s SSE parser expects, so
    // the UI can render it as a separate collapsible panel.
    if (params.reasoning) args.push('--reasoning-format', 'deepseek');
    console.log(`[llama.cpp] Starting llama-server: ${llamaExe}`);
    const llamaDir = path.dirname(llamaExe);
    const llamaEnv = process.platform === 'darwin'
      ? { ...process.env, DYLD_LIBRARY_PATH: [llamaDir, process.env.DYLD_LIBRARY_PATH || ''].filter(Boolean).join(path.delimiter) }
      : process.env;
    const proc = spawn(llamaExe, args, { cwd: llamaDir, env: llamaEnv, windowsHide: true });
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
    const startTime = Date.now();
    const timeoutMs = 120000;
    let ready = false;
    while (Date.now() - startTime < timeoutMs) {
      if (spawnError) {
        const err = new Error(`Failed to launch llama-server: ${spawnError}`);
        err.statusCode = 500;
        throw err;
      }
      if (exited) {
        const tail = stderrTail.trim().split('\n').slice(-5).join(' | ');
        const err = new Error(`llama-server exited before it was ready.${tail ? ' ' + tail : ''}`);
        err.statusCode = 500;
        throw err;
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
      const err = new Error('Timed out waiting for llama-server to become ready (model may be too large for available VRAM).');
      err.statusCode = 500;
      throw err;
    }

    return { success: true, port: requestedPort, model: currentLlamaModel, message: `llama.cpp server started on port ${requestedPort}` };
  }

  function stopLlama() {
    if (llamaProc) {
      try { llamaProc.kill('SIGKILL'); } catch (e) {}
      llamaProc = null;
    }
    currentLlamaModel = null;
  }

  /**
   * Ensures a llama-server is running with the given model, starting one if
   * needed. No-op (returns the current status) if a server is already
   * running with that exact model.
   */
  async function ensureLlamaRunning(modelPath, opts = {}) {
    const status = getLlamaStatus();
    const wantedBasename = path.basename(resolveModel(modelPath) || modelPath || '');
    if (status.running && (!modelPath || status.model === wantedBasename)) {
      return status;
    }
    return startLlama({ modelPath, ...opts });
  }

  /**
   * @param {object} params - Same shape as buildSdCliArgs expects, plus
   *   modelPath/clipPath/t5Path/vaePath/loraPath as model names/paths to
   *   resolve via ctx.resolveModel.
   * @param {{onStdout?: (line:string)=>void}} [opts]
   * @returns {Promise<{success:true, imageUrl:string, outputPath:string}>}
   */
  async function generateImage(params, opts = {}) {
    const execPath = getSdCliExecutable();
    const workingDir = path.dirname(execPath);

    const outFilename = `gen_${Date.now()}.png`;
    const outFullPath = path.join(userOutputsDir, outFilename);

    // refImageDataUrl comes from the browser (FileReader on a user-attached
    // file), not the models/ scan tree — resolveModel's directory-search
    // logic doesn't apply to it, so it's decoded to its own temp file
    // instead of going through resolveModel like every other path here.
    let refImageTempPath = null;
    if (params.refImageDataUrl) {
      refImageTempPath = writeRefImageTempFile(params.refImageDataUrl);
    }

    const resolvedParams = {
      ...params,
      modelPath: resolveModel(params.modelPath),
      clipPath: resolveModel(params.clipPath),
      t5Path: resolveModel(params.t5Path),
      vaePath: resolveModel(params.vaePath),
      loraPath: params.loraPath ? resolveModel(params.loraPath) : undefined,
      refImagePath: refImageTempPath || undefined
    };

    if (!resolvedParams.modelPath || !fs.existsSync(resolvedParams.modelPath)) {
      if (refImageTempPath) { try { fs.unlinkSync(refImageTempPath); } catch (e) {} }
      const err = new Error(`Model file not found: ${params.modelPath}`);
      err.statusCode = 404;
      throw err;
    }

    const args = buildSdCliArgs(resolvedParams, outFullPath);

    // Pin every module to the discrete GPU when the Vulkan engine is in
    // play. Left alone, sd-cli takes Vulkan device 0, which on a
    // hybrid-graphics laptop is the integrated chip — it OOMs on a ~1GB
    // allocation while the real GPU sits idle at device 1. Only applied
    // when a discrete device is actually found, so single-GPU machines
    // keep sd-cli's own default.
    if (execPath.includes('vulkan')) {
      const device = detectVulkanDevice(execPath);
      if (device !== null && !args.includes('--backend')) {
        args.push('--backend', `diffusion=vulkan${device},clip=vulkan${device},vae=vulkan${device}`);
      }
    }

    console.log(`[Solframe engineCore] Spawning: ${execPath}\n  Args: ${args.join(' ')}`);

    // Windows needs its DLL search dirs (CUDA/Vulkan/llama) on PATH; macOS
    // resolves .dylib deps via DYLD_LIBRARY_PATH (or the binary's own
    // @rpath) instead — PATH there is just the normal shell PATH. Using
    // path.delimiter instead of a hardcoded ';' matters here: a literal ';'
    // is not a POSIX path separator, so the old unconditional version
    // silently corrupted PATH into one unparseable entry on any non-Windows
    // platform.
    const procEnv = { ...process.env };
    if (process.platform === 'win32') {
      const winDirs = [workingDir, path.join(rootDir, 'backend/win/cuda'), path.join(rootDir, 'backend/win/vulkan'), path.join(rootDir, 'backend/win/llama')];
      procEnv.PATH = [...winDirs, process.env.PATH || ''].join(path.delimiter);
    } else if (process.platform === 'darwin') {
      procEnv.DYLD_LIBRARY_PATH = [workingDir, process.env.DYLD_LIBRARY_PATH || ''].filter(Boolean).join(path.delimiter);
    } else if (process.platform === 'linux') {
      // The CUDA engine links libcudart/libcublas/libcublasLt dynamically,
      // and they're bundled beside sd-cli so end users need no CUDA toolkit
      // — but the loader only looks in system paths, so without this it
      // fails at startup on exactly the machines the bundling was for.
      // Harmless for the Vulkan/CPU engines, which have nothing extra here.
      procEnv.LD_LIBRARY_PATH = [workingDir, process.env.LD_LIBRARY_PATH || ''].filter(Boolean).join(path.delimiter);
    }

    return runSdCli({
      execPath, args, outFullPath, outFilename, workingDir, env: procEnv,
      onSpawn: proc => { activeSdProc = proc; },
      onStdout: opts.onStdout
    }).finally(() => {
      activeSdProc = null;
      if (refImageTempPath) { try { fs.unlinkSync(refImageTempPath); } catch (e) {} }
    });
  }

  function cancelImage() {
    if (activeSdProc) {
      try { activeSdProc.kill('SIGKILL'); } catch (e) {}
    }
  }

  function dispose() {
    stopLlama();
    cancelImage();
  }

  return {
    getLlamaStatus, getLlamaPort, startLlama, stopLlama, ensureLlamaRunning,
    generateImage, cancelImage, dispose
  };
}

module.exports = { createEngineCore };
