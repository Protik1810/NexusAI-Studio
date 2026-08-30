export interface SystemModelItem {
  name: string;
  filename: string;
  fullPath: string;
  relativePath: string;
  sizeBytes: number;
  formattedSize: string;
  source: string;
  category: 'checkpoints' | 'unets' | 'clips' | 'loras' | 'vaes' | 'controlnets' | 'llms';
  isGguf: boolean;
}

export interface SystemScanPath {
  path: string;
  label: string;
  isBuiltIn: boolean;
}

export interface SystemModelsResult {
  checkpoints: SystemModelItem[];
  unets: SystemModelItem[];
  clips: SystemModelItem[];
  loras: SystemModelItem[];
  vaes: SystemModelItem[];
  controlnets: SystemModelItem[];
  llms: SystemModelItem[];
  scanPaths: SystemScanPath[];
}

export class SystemModelsService {
  async fetchSystemModels(): Promise<SystemModelsResult> {
    try {
      const res = await fetch('/api/system-models');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch system models', e);
    }
    return {
      checkpoints: [],
      unets: [],
      clips: [],
      loras: [],
      vaes: [],
      controlnets: [],
      llms: [],
      scanPaths: []
    };
  }

  /**
   * Starts a fresh background scan (clears the cache first) and polls
   * /api/system-models until scanStatus flips away from 'scanning', then
   * returns the fresh result. fetchSystemModels() alone only ever reads the
   * cache, so a just-downloaded model wouldn't show up without this.
   */
  async triggerRescan(): Promise<SystemModelsResult> {
    try {
      await fetch('/api/rescan', { method: 'POST' });
    } catch (e) {
      console.error('Failed to start rescan', e);
    }
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const result = await this.fetchSystemModels() as SystemModelsResult & { scanStatus?: string };
      if (result.scanStatus !== 'scanning') return result;
    }
    return this.fetchSystemModels();
  }

  async getCustomPaths(): Promise<{ customPaths: string[]; scanPaths: SystemScanPath[] }> {
    try {
      const res = await fetch('/api/custom-scan-paths');
      if (res.ok) return await res.json();
    } catch (e) {}
    return { customPaths: [], scanPaths: [] };
  }

  async addCustomPath(dirPath: string): Promise<{ success: boolean; customPaths?: string[]; scanPaths?: SystemScanPath[]; error?: string }> {
    const res = await fetch('/api/custom-scan-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', dirPath })
    });
    return await res.json();
  }

  async removeCustomPath(dirPath: string): Promise<{ success: boolean; customPaths?: string[]; scanPaths?: SystemScanPath[]; error?: string }> {
    const res = await fetch('/api/custom-scan-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', dirPath })
    });
    return await res.json();
  }
}

export const systemModelsService = new SystemModelsService();
