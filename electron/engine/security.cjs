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
 * isAllowedOrigin's "no Origin header = allow" branch has a gap: after a
 * DNS rebind, an attacker's page becomes same-origin with 127.0.0.1:<port>
 * from the browser's own perspective and sends no Origin header at all —
 * so it sails through the origin check untouched. The browser is still
 * required to send a Host header naming the real destination, though, and
 * that can't be spoofed the same way. Check it before the origin check.
 */
function isAllowedHost(req, port) {
  const host = req.headers.host;
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
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

/**
 * `style-src` needs 'unsafe-inline': this app sets React's `style={{...}}`
 * prop pervasively, and tightening this later would mean auditing every
 * component. Everything else stays locked to 'self' — this app has no CDN
 * dependencies and no reason to load script/style/connections from anywhere
 * but its own origin.
 *
 * `script-src` additionally needs 'unsafe-inline' in dev mode only: Vite's
 * React-refresh plugin injects an inline `<script type="module">` preamble
 * into index.html to wire up Fast Refresh, and a strict `script-src 'self'`
 * blocks it outright (confirmed live — it whited out the whole dev app with
 * "@vitejs/plugin-react can't detect preamble"). The packaged production
 * app never has this problem: dist/index.html only ever references bundled
 * files via `<script src="...">`, never inline script content.
 *
 * `style-src`/`font-src` also need Google Fonts explicitly allowed:
 * src/index.css `@import`s Plus Jakarta Sans + JetBrains Mono from
 * fonts.googleapis.com, which in turn references woff2 files hosted on
 * fonts.gstatic.com — both confirmed live (default 'self'-only blocked the
 * stylesheet import outright, silently reverting the whole app to fallback
 * fonts).
 */
function buildCsp(isDev) {
  return [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `script-src 'self'${isDev ? " 'unsafe-inline'" : ''}`,
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'"
  ].join('; ');
}

/**
 * Applied as the first thing `apiRoutes.cjs::handle()` does for every
 * request, before any pathname routing — this is the one shared insertion
 * point that both vite.config.ts (dev) and electron/server.cjs (prod) hit
 * for every response, matched or not, since both call `handle()` first and
 * reuse the same `res` for their own fallback static-file serving.
 */
function applySecurityHeaders(res, isDev) {
  res.setHeader('Content-Security-Policy', buildCsp(isDev));
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

module.exports = { isAllowedOrigin, isAllowedHost, safeJoin, applySecurityHeaders };
