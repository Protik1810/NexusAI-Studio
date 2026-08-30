const http = require('http');
const path = require('path');
const fs = require('fs');

// ─── Shared Engine Modules ────────────────────────────────────────────────────
const {
  getSdCliExecutable: _getSdCliExec,
  getLlamaExecutable: _getLlamaExec,
  resolveModelFullPath
} = require('./engine/pathUtils.cjs');
const { getOutputDir } = require('./engine/sdEngine.cjs');
const { createApiRouter } = require('./engine/apiRoutes.cjs');
const { safeJoin } = require('./engine/security.cjs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function createServer(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const resourcesPath = options.resourcesPath || rootDir;
  const distDir = options.distDir || path.join(rootDir, 'dist');
  const publicDir = options.publicDir || path.join(rootDir, 'public');
  const port = options.port || 1420;

  const loadCustomScanPaths = () => {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    if (fs.existsSync(cfgFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        if (Array.isArray(data)) return data.filter(p => typeof p === 'string' && fs.existsSync(p));
      } catch (e) {
        console.warn(`[Solframe] Failed to parse ${cfgFile} — your custom scan paths won't be included until this is fixed: ${e.message}`);
      }
    }
    return [];
  };

  const saveCustomScanPaths = pathsList => {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    try {
      const dir = path.dirname(cfgFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cfgFile, JSON.stringify(Array.from(new Set(pathsList)), null, 2));
    } catch (e) {
      console.warn(`[Solframe] Failed to save custom scan paths to ${cfgFile} — the paths you just added won't persist across restarts: ${e.message}`);
    }
  };

  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const cacheFilePaths = {
    globalCacheDir: path.join(userHome, '.solframe'),
    globalCacheFile: path.join(userHome, '.solframe', 'scan_cache.json'),
    localCacheFile: path.join(rootDir, 'models/.scan_cache.json')
  };

  const userOutputsDir = getOutputDir(publicDir);

  const apiRouter = createApiRouter({
    rootDir,
    resourcesPath,
    port,
    getSdCliExecutable: () => _getSdCliExec({ rootDir, resourcesPath }),
    getLlamaExecutable: () => _getLlamaExec({ rootDir, resourcesPath }),
    resolveModel: p => resolveModelFullPath(p, rootDir, loadCustomScanPaths()),
    loadCustomScanPaths,
    saveCustomScanPaths,
    userOutputsDir,
    cacheFilePaths
  });
  apiRouter.init();

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');

    const handled = await apiRouter.handle(req, res, parsedUrl);
    if (handled) return;

    // ─── Static File Serving (dist/ and public/) ─────────────────────────────
    const pathname = parsedUrl.pathname;
    let requestedFile = pathname === '/' ? '/index.html' : pathname;

    // requestedFile comes straight from the request URL — WHATWG URL
    // parsing already normalizes "..", "%2e%2e", and similar tricks out of
    // pathname before we ever see it, so this is safe today regardless, but
    // safeJoin is what every other request-driven path in this codebase
    // uses and costs nothing here.
    let filePath;
    try {
      // /outputs/* — serve from user-writable data dir first, then publicDir
      if (requestedFile.startsWith('/outputs/')) {
        const outputFilename = requestedFile.replace(/^.*\//, '').split('?')[0];
        const userFile = safeJoin(userOutputsDir, outputFilename);
        const publicFile = safeJoin(publicDir, 'outputs', outputFilename);
        filePath = fs.existsSync(userFile) ? userFile : publicFile;
      } else {
        // safeJoin resolves a leading "/" as a Windows drive-root anchor
        // (path.resolve(base, "/x") discards base entirely) — strip it so
        // the segment is relative to publicDir/distDir like it should be.
        const relFile = requestedFile.replace(/^\/+/, '');
        // Check public directory (themes, icons)
        filePath = safeJoin(publicDir, relFile);
        if (!fs.existsSync(filePath)) {
          filePath = safeJoin(distDir, relFile);
        }
        // Fallback to index.html for SPA client-side routing
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(distDir, 'index.html');
        }
      }
    } catch (e) {
      filePath = path.join(distDir, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  return {
    server,
    listen: (listenPort, callback) => server.listen(listenPort || port, '127.0.0.1', callback),
    close: cb => {
      apiRouter.dispose();
      server.close(cb);
    }
  };
}

module.exports = { createServer };
