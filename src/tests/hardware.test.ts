import { describe, it, expect, vi, afterEach } from 'vitest';
// Deliberately require() (not `import`) — an ES module namespace binding for
// a Node builtin is frozen/non-configurable, which vi.spyOn cannot redefine.
// require() returns the same underlying object hardware.cjs itself reads
// from (also via require), as a plain mutable object spyOn can patch.
const cp = require('child_process');

// hardware.cjs is a plain CJS module loaded via require() outside Vite's
// module graph, so vi.mock('child_process', ...) does not intercept its own
// internal require('child_process') call (confirmed: it still ran the real
// nvidia-smi on the dev machine under a mocked module). Spying directly on
// the shared child_process module object works instead, since hardware.cjs
// destructures execSync from that same singleton at require-time.
const originalPlatform = process.platform;
const hardwarePath = require.resolve('../../electron/engine/hardware.cjs');

function setPlatform(value: string) {
  Object.defineProperty(process, 'platform', { value });
}

// hardware.cjs memoizes its result in a module-level `_cached` variable —
// correct for production (avoid repeated shell-outs), but it means each test
// below needs a genuinely fresh module instance: vi.resetModules() alone
// doesn't touch Node's native require.cache for a plain CJS require() call.
function freshRequireHardware() {
  delete require.cache[hardwarePath];
  return require('../../electron/engine/hardware.cjs');
}

describe('hardware.cjs - cross-platform GPU detection', () => {
  afterEach(() => {
    setPlatform(originalPlatform);
    delete require.cache[hardwarePath];
    vi.restoreAllMocks();
  });

  it('reports a Metal GPU backend on darwin when sysctl succeeds', () => {
    setPlatform('darwin');
    vi.spyOn(cp, 'execSync').mockImplementation((cmd: any) => {
      if (String(cmd).includes('sysctl')) return 'Apple M4\n' as any;
      throw new Error('nvidia-smi not found');
    });

    const { detectHardware } = freshRequireHardware();
    const hw = detectHardware();

    expect(hw.preferredBackend).toBe('metal');
    const appleGpu = hw.gpus.find((g: any) => g.isApple);
    expect(appleGpu).toBeTruthy();
    expect(appleGpu.name).toBe('Apple M4');
    expect(appleGpu.backend).toBe('metal');
    // Apple Silicon has no discrete VRAM — must not claim the Windows AVX2 CPU message.
    expect(hw.primaryGpu).not.toContain('AVX2');
  });

  it('still prefers metal on darwin even if sysctl fails (no false CPU/AVX2 fallback)', () => {
    setPlatform('darwin');
    vi.spyOn(cp, 'execSync').mockImplementation(() => {
      throw new Error('command not found');
    });

    const { detectHardware } = freshRequireHardware();
    const hw = detectHardware();

    expect(hw.preferredBackend).toBe('metal');
    expect(hw.primaryGpu).not.toContain('AVX2');
  });

  it('does not add a darwin GPU entry on win32, and stays on the cpu/AVX2 fallback with no GPU present', () => {
    setPlatform('win32');
    vi.spyOn(cp, 'execSync').mockImplementation((cmd: any) => {
      if (String(cmd).includes('nvidia-smi')) throw new Error('not found');
      if (String(cmd).toLowerCase().includes('powershell')) return '[]' as any;
      throw new Error('unexpected command: ' + cmd);
    });

    const { detectHardware } = freshRequireHardware();
    const hw = detectHardware();

    expect(hw.gpus.some((g: any) => g.isApple)).toBe(false);
    expect(hw.preferredBackend).toBe('cpu');
    expect(hw.primaryGpu).toContain('AVX2');
  });
});
