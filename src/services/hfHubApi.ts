export interface HfModelResult {
  id: string;
  author: string;
  name: string;
  downloads: number;
  likes: number;
  pipeline_tag: string;
  tags: string[];
  lastModified: string;
}

export interface HfRepoFile {
  path: string;
  sizeBytes: number;
  formattedSize: string;
  isGguf: boolean;
  isSafetensors: boolean;
  downloadUrl: string;
}

export interface DownloadProgressState {
  isDownloading: boolean;
  filename: string;
  repo: string;
  targetFolder: string;
  targetPath: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  speedMBs: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  error?: string;
}

export class HfHubService {
  async searchModels(query: string, pipelineTag?: string, limit: number = 25): Promise<HfModelResult[]> {
    try {
      let url = `/api/hf-search?q=${encodeURIComponent(query)}&limit=${limit}`;
      if (pipelineTag) url += `&pipeline_tag=${encodeURIComponent(pipelineTag)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data.models || [];
      }
    } catch (e) {
      console.error('Failed to search Hugging Face models', e);
    }
    return [];
  }

  async getRepoFiles(repo: string): Promise<HfRepoFile[]> {
    const res = await fetch(`/api/hf-tree?repo=${encodeURIComponent(repo)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to load files for ${repo} (HTTP ${res.status})`);
    }
    return data.files || [];
  }

  async startDownload(repo: string, filename: string, targetFolder: string, customFilename?: string): Promise<{ success: boolean; targetPath?: string; error?: string }> {
    const res = await fetch('/api/download-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, filename, targetFolder, customFilename })
    });
    return await res.json();
  }

  async getDownloadProgress(): Promise<DownloadProgressState> {
    try {
      const res = await fetch('/api/download-progress');
      if (res.ok) return await res.json();
    } catch (e) {}
    return {
      isDownloading: false,
      filename: '',
      repo: '',
      targetFolder: '',
      targetPath: '',
      downloadedBytes: 0,
      totalBytes: 0,
      percent: 0,
      speedMBs: 0,
      status: 'idle'
    };
  }

  async cancelDownload(): Promise<void> {
    try {
      await fetch('/api/cancel-download', { method: 'POST' });
    } catch (e) {}
  }
}

export const hfHubService = new HfHubService();
