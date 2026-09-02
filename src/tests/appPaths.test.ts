import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Regression guard for the v1.1.2 launch crash.
 *
 * electron/main.cjs computed the packaged rootDir as
 * `<resources>/app` — a path that exists in no packaged build on any
 * platform, because the app ships as `<resources>/app.asar`. The automatic
 * update check then did `require(rootDir + '/package.json')` and threw an
 * unhandled rejection that killed the app seconds after launch.
 *
 * main.cjs can't be imported here — requiring it boots Electron — so this
 * asserts on its source instead. That is deliberately crude, but it pins
 * the one character (`.asar`) whose absence shipped a crash to users.
 */
describe('packaged app paths (main.cjs)', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'electron', 'main.cjs'),
    'utf8'
  );

  it('resolves the packaged rootDir inside app.asar', () => {
    expect(source).toMatch(/rootDir\s*=\s*path\.join\(\s*process\.resourcesPath\s*,\s*["']app\.asar["']\s*\)/);
  });

  it('never points a packaged path at the non-existent resources/app folder', () => {
    const bareAppPaths = source.match(/process\.resourcesPath\s*,\s*["']app["']/g);
    expect(bareAppPaths).toBeNull();
  });

  it('falls back to asar-qualified dist/public directories', () => {
    expect(source).toContain('"app.asar", "dist"');
    expect(source).toContain('"app.asar", "public"');
  });
});

/**
 * The update-check handler must not be able to take the app down again:
 * its version lookup has to sit inside a try, since an unhandled rejection
 * in that async route is fatal.
 */
describe('check-update resilience (apiRoutes.cjs)', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'electron', 'engine', 'apiRoutes.cjs'),
    'utf8'
  );

  it('guards the package.json version lookup', () => {
    const idx = source.indexOf("pathname === '/api/check-update'");
    expect(idx).toBeGreaterThan(-1);
    const handler = source.slice(idx, idx + 900);
    const requireIdx = handler.indexOf("require(path.join(rootDir, 'package.json'))");
    const tryIdx = handler.indexOf('try {');
    expect(requireIdx).toBeGreaterThan(-1);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(tryIdx).toBeLessThan(requireIdx);
  });
});
