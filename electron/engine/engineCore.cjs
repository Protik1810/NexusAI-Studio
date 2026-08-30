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
const { spawn } = require('child_process');
const { runSdCli, buildSdCliArgs } = require('./sdEngine.cjs');

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
   * @param {{modelPath:string, port?:number, ctxSize?:number, gpuLayers?:number, batchSize?:number, flashAttn?:string, cacheTypeK?:string, cacheTypeV?:string}} params
   * @returns {Promise<{success:true, port:number, model:string, message:string}>}
   */
  async function startLlama(params) {
    const modelFullPath = resolveModel(params.modelPath);
    if (!modelFullPath || !fs.existsSync(modelFullPath)) {
      const err = new Error(`Model file not found: ${params.modelPath}`);
      err.statusCode = 404;
      throw err;
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
    const cacheTypeK = ALLOWED_CACHE_TYPES.includes(params.cacheTypeK) ? params.cacheTypeK : 'f16';
    const cacheTypeV = ALLOWED_CACHE_TYPES.includes(params.cacheTypeV) ? params.cacheTypeV : 'f16';

    const args = ['-m', modelFullPath, '--port', String(requestedPort), '--host', '127.0.0.1', '-ngl', String(gpuLayers), '-c', String(ctxSize), '-b', String(batchSize), '-fa', flashAttn, '-ctk', cacheTypeK, '-ctv', cacheTypeV];
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

    const resolvedParams = {
      ...params,
      modelPath: resolveModel(params.modelPath),
      clipPath: resolveModel(params.clipPath),
      t5Path: resolveModel(params.t5Path),
      vaePath: resolveModel(params.vaePath),
      loraPath: params.loraPath ? resolveModel(params.loraPath) : undefined
    };

    if (!resolvedParams.modelPath || !fs.existsSync(resolvedParams.modelPath)) {
      const err = new Error(`Model file not found: ${params.modelPath}`);
      err.statusCode = 404;
      throw err;
    }

    const args = buildSdCliArgs(resolvedParams, outFullPath);
    console.log(`[Solframe engineCore] Spawning: ${execPath}\n  Args: ${args.join(' ')}`);

    const procEnv = {
      ...process.env,
      PATH: `${workingDir};${path.join(rootDir, 'backend/win/cuda')};${path.join(rootDir, 'backend/win/vulkan')};${path.join(rootDir, 'backend/win/llama')};${process.env.PATH || ''}`
    };

    return runSdCli({
      execPath, args, outFullPath, outFilename, workingDir, env: procEnv,
      onSpawn: proc => { activeSdProc = proc; },
      onStdout: opts.onStdout
    }).finally(() => { activeSdProc = null; });
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
