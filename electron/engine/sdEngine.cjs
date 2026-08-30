/**
 * sdEngine.cjs — stable-diffusion.cpp process management
 * Shared between electron/server.cjs (production) and vite.config.ts (dev mode)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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
    const isKlein = (params.modelPath || '').toLowerCase().includes('klein');
    if (isKlein) args.push('--prediction', 'flux2_flow');
    if (params.clipPath && fs.existsSync(params.clipPath)) args.push('--llm', params.clipPath);
    if (params.t5Path && fs.existsSync(params.t5Path)) args.push('--t5xxl', params.t5Path);
    if (params.vaePath && fs.existsSync(params.vaePath)) args.push('--vae', params.vaePath);
  } else {
    args.push('-m', params.modelPath);
    if (params.negativePrompt) args.push('-n', params.negativePrompt);
  }

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

module.exports = { runSdCli, getOutputDir, buildSdCliArgs };
