/**
 * agentAuth.cjs — API key persistence + auth check for the external Agent
 * API server (agentApiServer.cjs). Separate from security.cjs's
 * isAllowedOrigin/isAllowedHost, which protect the *internal* UI-facing
 * server (electron/engine/apiRoutes.cjs) by rejecting cross-origin browser
 * requests. This server is deliberately reachable by other local programs —
 * anything that isn't the app's own renderer — so origin/host checks don't
 * apply here; a bearer API key is the actual gate.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getConfigPath() {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  return path.join(userHome, '.solframe', 'agent_server.json');
}

function generateApiKey() {
  return 'sk-solframe-' + crypto.randomBytes(24).toString('hex');
}

const DEFAULT_CONFIG = { enabled: false, port: 8765 };

/**
 * Reads the persisted config, creating one (with a freshly generated API
 * key) on first use so a key always exists once anything asks for it —
 * even before the user has ever opened the Agent API settings panel.
 */
function loadOrCreateConfig() {
  const cfgPath = getConfigPath();
  try {
    if (fs.existsSync(cfgPath)) {
      const data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (data && typeof data.apiKey === 'string' && data.apiKey) {
        return { ...DEFAULT_CONFIG, ...data };
      }
    }
  } catch (e) {
    console.warn(`[Solframe] Agent server config at ${cfgPath} is corrupt, regenerating: ${e.message}`);
  }
  const fresh = { ...DEFAULT_CONFIG, apiKey: generateApiKey() };
  saveConfig(fresh);
  return fresh;
}

function saveConfig(config) {
  const cfgPath = getConfigPath();
  try {
    const dir = path.dirname(cfgPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (e) {
    console.warn(`[Solframe] Failed to save agent server config to ${cfgPath}: ${e.message}`);
  }
}

/**
 * Constant-time string comparison — a plain `===` leaks timing information
 * proportional to how many leading characters match, which is enough for a
 * remote attacker to brute-force an API key one character at a time.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length so a length mismatch doesn't
    // return measurably faster than a same-length mismatch.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts and validates the `Authorization: Bearer <key>` header against
 * the configured API key.
 */
function isAuthorized(req, apiKey) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return safeCompare(match[1].trim(), apiKey);
}

module.exports = { getConfigPath, generateApiKey, loadOrCreateConfig, saveConfig, safeCompare, isAuthorized };
