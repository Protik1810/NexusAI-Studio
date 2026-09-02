import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ModelManager } from '../../components/ModelManager';
import { systemModelsService } from '../../services/systemModelsApi';
import { hfHubService } from '../../services/hfHubApi';

vi.mock('../../services/systemModelsApi', () => ({
  systemModelsService: {
    fetchSystemModels: vi.fn(),
    triggerRescan: vi.fn()
  }
}));

vi.mock('../../services/hfHubApi', () => ({
  hfHubService: {
    searchModels: vi.fn(),
    getDownloadProgress: vi.fn()
  }
}));

const emptyScan = {
  checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [], scanPaths: []
};

const idleDownload = {
  isDownloading: false, filename: '', repo: '', targetFolder: '', targetPath: '',
  downloadedBytes: 0, totalBytes: 0, percent: 0, speedMBs: 0, status: 'idle' as const
};

describe('ModelManager', () => {
  beforeEach(() => {
    (systemModelsService.fetchSystemModels as any).mockResolvedValue(emptyScan);
    (hfHubService.searchModels as any).mockResolvedValue([]);
    (hfHubService.getDownloadProgress as any).mockResolvedValue(idleDownload);
  });

  afterEach(() => {
    // Unmounts the tree, which clears ModelManager's 1s progress-poll
    // interval — otherwise it keeps firing against mocks torn down by the
    // next test.
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders with an empty scan result instead of crashing', async () => {
    render(
      <ModelManager
        onDownloadModel={vi.fn()}
        onSuccess={vi.fn()}
        onError={vi.fn()}
      />
    );

    expect(await screen.findByText(/model hub & downloader/i)).toBeInTheDocument();
    expect(systemModelsService.fetchSystemModels).toHaveBeenCalled();
  });
});
