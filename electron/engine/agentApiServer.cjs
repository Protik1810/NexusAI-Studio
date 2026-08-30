/**
 * agentApiServer.cjs — External Agent API: lets other local programs use
 * Solframe Studio's embedded llama.cpp and stable-diffusion.cpp engines for
 * text and image generation over HTTP, without going through the app's own
 * UI. This is a separate listener from the internal apiRoutes.cjs server:
 * that one only accepts same-origin requests from the app's own renderer
 * (Origin/Host checks, no auth needed because nothing else is meant to
 * reach it); this one is deliberately reachable by other processes, so it
 * gates every route (except /health) behind a bearer API key instead.
 *
 * Binds to 127.0.0.1 only — this is "other programs on your machine can
 * use your GPU", not "expose an inference endpoint to your LAN or the
 * internet". Off by default; the user opts in from Settings.
 */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { isAuthorized } = require('./agentAuth.cjs');

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message, type = 'invalid_request_error') {
  sendJson(res, statusCode, { error: { message, type } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * @param {object} ctx
 * @param {import('./engineCore.cjs').ReturnType} ctx.engineCore - shared with apiRoutes.cjs
 * @param {() => {modelsByCategory: object}} ctx.getCachedModels
 * @param {string} ctx.userOutputsDir
 * @param {() => string} ctx.getApiKey - current API key (re-read live so a regenerate takes effect without a restart)
 */
function createAgentApiServer(ctx) {
  const { engineCore, getCachedModels, userOutputsDir, getApiKey } = ctx;
  let server = null;

  function listModels() {
    const data = getCachedModels() || { modelsByCategory: {} };
    const m = data.modelsByCategory || {};
    const llmModels = [...(m.llms || []), ...(m.clips || []).filter(item => item.isGguf)]
      .map(item => ({ id: item.filename, object: 'model', type: 'text', size: item.formattedSize }));
    const imageModels = (m.checkpoints || [])
      .map(item => ({ id: item.filename, object: 'model', type: 'image', pipeline: 'standard', size: item.formattedSize }));
    const fluxUnets = (m.unets || [])
      .map(item => ({ id: item.filename, object: 'model', type: 'image', pipeline: 'flux', size: item.formattedSize }));
    return [...llmModels, ...imageModels, ...fluxUnets];
  }

  /**
   * /v1/models advertises bare filenames as model ids (OpenAI convention),
   * but the scanner can find the same filename several directories deep
   * under a scan root — deeper than engineCore's generic path resolver
   * checks. Look the id up against the actual scan results first, so a
   * model id straight out of /v1/models always resolves; fall back to the
   * raw id otherwise (still lets a caller pass a real full path directly).
   */
  function resolveModelId(id, categories) {
    if (!id) return id;
    const data = getCachedModels() || { modelsByCategory: {} };
    const m = data.modelsByCategory || {};
    for (const category of categories) {
      const match = (m[category] || []).find(item => item.filename === id);
      if (match) return match.fullPath;
    }
    return id;
  }

  async function handleChatCompletions(req, res, body) {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return sendError(res, 400, 'Invalid JSON body');
    }
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return sendError(res, 400, '"messages" must be a non-empty array');
    }

    try {
      if (payload.model) {
        await engineCore.ensureLlamaRunning(resolveModelId(payload.model, ['llms', 'clips']));
      } else if (!engineCore.getLlamaStatus().running) {
        return sendError(res, 409, 'No model is loaded and no "model" was specified to auto-start one. Pass a GGUF filename as "model".');
      }
    } catch (e) {
      return sendError(res, e.statusCode || 500, e.message, 'engine_start_error');
    }

    const llamaPort = engineCore.getLlamaPort();
    const upstream = http.request({
      host: '127.0.0.1',
      port: llamaPort,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, upstreamRes => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) sendError(res, 502, 'llama.cpp engine is not reachable.', 'engine_error');
      else res.end();
    });
    upstream.end(JSON.stringify({ ...payload, model: payload.model || 'default' }));
  }

  async function handleImageGenerations(req, res, body) {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return sendError(res, 400, 'Invalid JSON body');
    }
    if (!payload.prompt || typeof payload.prompt !== 'string') {
      return sendError(res, 400, '"prompt" is required');
    }

    let width = payload.width;
    let height = payload.height;
    if (!width && !height && typeof payload.size === 'string') {
      const m = payload.size.match(/^(\d+)x(\d+)$/);
      if (m) { width = Number(m[1]); height = Number(m[2]); }
    }

    const pipeline = payload.pipeline === 'flux' ? 'flux' : 'standard';
    const genParams = {
      pipeline,
      prompt: payload.prompt,
      negativePrompt: payload.negative_prompt,
      width: width || 512,
      height: height || 512,
      steps: payload.steps,
      cfgScale: payload.cfg_scale,
      seed: payload.seed,
      samplingMethod: payload.sampling_method,
      loraStrength: payload.lora_strength
    };
    if (pipeline === 'flux') {
      genParams.modelPath = resolveModelId(payload.unet_model || payload.model, ['unets']);
      genParams.clipPath = resolveModelId(payload.clip_model, ['clips']);
      genParams.t5Path = resolveModelId(payload.t5_model, ['clips']);
      genParams.vaePath = resolveModelId(payload.vae_model, ['vaes']);
      genParams.loraPath = resolveModelId(payload.lora_model, ['loras']);
    } else {
      genParams.modelPath = resolveModelId(payload.model, ['checkpoints']);
      genParams.loraPath = resolveModelId(payload.lora_model, ['loras']);
    }
    if (!genParams.modelPath) {
      return sendError(res, 400, pipeline === 'flux' ? '"unet_model" (or "model") is required for pipeline=flux' : '"model" is required');
    }

    try {
      const result = await engineCore.generateImage(genParams);
      const filename = path.basename(result.outputPath);
      const responseFormat = payload.response_format === 'b64_json' ? 'b64_json' : 'url';

      let item;
      if (responseFormat === 'b64_json') {
        const bytes = fs.readFileSync(result.outputPath);
        item = { b64_json: bytes.toString('base64') };
      } else {
        item = { url: `/v1/files/${encodeURIComponent(filename)}` };
      }
      sendJson(res, 200, { created: Math.floor(Date.now() / 1000), data: [item] });
    } catch (e) {
      sendError(res, e.statusCode || 500, e.message, 'generation_error');
    }
  }

  function handleFileServe(req, res, pathname) {
    const filename = path.basename(decodeURIComponent(pathname.replace(/^\/v1\/files\//, '')));
    const filePath = path.join(userOutputsDir, filename);
    if (!filePath.startsWith(path.resolve(userOutputsDir)) || !fs.existsSync(filePath)) {
      return sendError(res, 404, 'File not found');
    }
    res.setHeader('Content-Type', 'image/png');
    fs.createReadStream(filePath).pipe(res);
  }

  async function handle(req, res, parsedUrl) {
    const pathname = parsedUrl.pathname;

    if (pathname === '/health') {
      return sendJson(res, 200, { status: 'ok' });
    }

    if (!isAuthorized(req, getApiKey())) {
      return sendError(res, 401, 'Missing or invalid API key. Pass "Authorization: Bearer <key>".', 'authentication_error');
    }

    if (pathname === '/v1/models' && req.method === 'GET') {
      return sendJson(res, 200, { object: 'list', data: listModels() });
    }

    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      const body = await readBody(req);
      return handleChatCompletions(req, res, body);
    }

    if (pathname === '/v1/images/generations' && req.method === 'POST') {
      const body = await readBody(req);
      return handleImageGenerations(req, res, body);
    }

    if (pathname.startsWith('/v1/files/') && req.method === 'GET') {
      return handleFileServe(req, res, pathname);
    }

    return sendError(res, 404, 'Not found');
  }

  function start(port) {
    if (server) return Promise.resolve(port);
    return new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        handle(req, res, parsedUrl).catch(e => {
          console.error('[Solframe Agent API] Unhandled error:', e);
          if (!res.headersSent) sendError(res, 500, 'Internal server error');
          else res.end();
        });
      });
      server.on('error', err => { server = null; reject(err); });
      server.listen(port, '127.0.0.1', () => {
        console.log(`[Solframe Agent API] Listening on http://127.0.0.1:${port}`);
        resolve(port);
      });
    });
  }

  function stop() {
    return new Promise(resolve => {
      if (!server) return resolve();
      server.close(() => { server = null; resolve(); });
    });
  }

  function isRunning() {
    return !!server;
  }

  return { start, stop, isRunning };
}

module.exports = { createAgentApiServer };
