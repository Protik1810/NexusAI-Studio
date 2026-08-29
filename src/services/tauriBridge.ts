/**
 * Safe Tauri Bridge for hybrid web-preview and native desktop execution.
 * Prevents "Cannot read properties of undefined (reading 'invoke')" when previewing in standard browsers.
 */

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && Boolean(
    (window as any).__TAURI_INTERNALS__ || 
    (window as any).__TAURI__
  );
};

export const safeInvoke = async <T = any>(cmd: string, args?: Record<string, any>): Promise<T> => {
  if (!isTauriEnvironment()) {
    console.warn(`[TauriBridge] '${cmd}' invoked outside native Tauri shell.`);
    throw new Error(
      `Native desktop shell required for '${cmd}'.\n\nYou are currently viewing the app inside a web browser. To run native C++ GPU inference via sd.exe, launch the app with 'npx tauri dev' or double-click the compiled .exe!`
    );
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
};

export const safeConvertFileSrc = async (filePath: string): Promise<string> => {
  if (!isTauriEnvironment()) {
    return filePath;
  }
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
};

export const safeListen = async <T = any>(
  event: string, 
  callback: (event: { payload: T }) => void
): Promise<() => void> => {
  if (!isTauriEnvironment()) {
    return () => {};
  }
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<T>(event, callback);
  } catch {
    return () => {};
  }
};
