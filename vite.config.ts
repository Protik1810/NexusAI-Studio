import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Dev-mode backend. This wires the same electron/engine/*.cjs modules and the
// same apiRoutes.cjs request handler used by electron/server.cjs in the
// packaged app — there is exactly one implementation of the API, shared by
// both `npm run dev` and the production Electron build.
function sdCppBackendPlugin() {
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  const port = 1420;

  const { getSdCliExecutable, getLlamaExecutable, resolveModelFullPath } = require('./electron/engine/pathUtils.cjs');
  const { getOutputDir } = require('./electron/engine/sdEngine.cjs');
  const { createApiRouter } = require('./electron/engine/apiRoutes.cjs');

  function loadCustomScanPaths(): string[] {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    if (fs.existsSync(cfgFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        if (Array.isArray(data)) return data.filter((p: unknown) => typeof p === 'string' && fs.existsSync(p));
      } catch (e: any) {
        console.warn(`[Solframe] Failed to parse ${cfgFile} — your custom scan paths won't be included until this is fixed: ${e.message}`);
      }
    }
    return [];
  }

  function saveCustomScanPaths(pathsList: string[]) {
    const cfgFile = path.join(rootDir, 'models/custom_paths.json');
    try {
      const dir = path.dirname(cfgFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cfgFile, JSON.stringify(Array.from(new Set(pathsList)), null, 2));
    } catch (e: any) {
      console.warn(`[Solframe] Failed to save custom scan paths to ${cfgFile} — the paths you just added won't persist across restarts: ${e.message}`);
    }
  }

  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const cacheFilePaths = {
    globalCacheDir: path.join(userHome, '.solframe'),
    globalCacheFile: path.join(userHome, '.solframe', 'scan_cache.json'),
    localCacheFile: path.join(rootDir, 'models/.scan_cache.json')
  };

  const userOutputsDir = getOutputDir(publicDir);

  const apiRouter = createApiRouter({
    rootDir,
    resourcesPath: rootDir,
    port,
    getSdCliExecutable: () => getSdCliExecutable({ rootDir, resourcesPath: rootDir }),
    getLlamaExecutable: () => getLlamaExecutable({ rootDir, resourcesPath: rootDir }),
    resolveModel: (p: string) => resolveModelFullPath(p, rootDir, loadCustomScanPaths()),
    loadCustomScanPaths,
    saveCustomScanPaths,
    userOutputsDir,
    cacheFilePaths
  });

  return {
    name: 'sd-cpp-backend-plugin',
    configureServer(server: any) {
      apiRouter.init();
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const parsedUrl = new URL(req.url, `http://localhost:${port}`);
        const handled = await apiRouter.handle(req, res, parsedUrl);
        if (!handled) next();
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), sdCppBackendPlugin()],
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      // /llama-api has no entry here on purpose: apiRoutes.cjs's own
      // dynamic-port proxy (registered directly in configureServer below,
      // which runs before Vite's built-in proxy middleware) already
      // handles it in both dev and production — a hardcoded-port entry
      // here would be dead code that also can't follow the engine to
      // whatever port it actually started on.
      '/comfy-api': {
        target: 'http://127.0.0.1:8188',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comfy-api/, ''),
        ws: true,
        headers: { Origin: 'http://127.0.0.1:8188', Host: '127.0.0.1:8188' }
      },
      '/comfy-ws': {
        target: 'ws://127.0.0.1:8188',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comfy-ws/, ''),
        headers: { Origin: 'http://127.0.0.1:8188', Host: '127.0.0.1:8188' }
      }
    }
  },
  envPrefix: ['VITE_', 'TAURI_'],
})
