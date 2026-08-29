/**
 * security.cjs — Local server hardening helpers
 * Shared between electron/server.cjs (production) and vite.config.ts (dev mode)
 */
'use strict';
const path = require('path');

/**
 * The local API server has no auth, so it must not answer requests that a
 * malicious page loaded in the user's regular browser could trigger (CSRF /
 * "localhost drive-by"). Browsers always attach an Origin header on
 * cross-origin fetch/XHR; same-origin requests and non-browser tools may omit
 * it. We only accept requests whose declared Origin matches this app's own
 * origin — anything else is rejected before it reaches a route handler.
 */
function isAllowedOrigin(req, port) {
  const origin = req.headers.origin;
  if (!origin) return true; // no Origin header: not a cross-origin browser request
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

/**
 * Join untrusted path segments onto a trusted base directory, and verify the
 * resolved path did not escape that directory (e.g. via "../../"). Throws if
 * it did. Always use this instead of path.join()/path.resolve() when any
 * segment comes from request input.
 */
function safeJoin(baseDir, ...segments) {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`Path escapes allowed directory: ${segments.join('/')}`);
  }
  return target;
}

module.exports = { isAllowedOrigin, safeJoin };
