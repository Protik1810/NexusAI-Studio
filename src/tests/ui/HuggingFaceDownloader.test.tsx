import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HuggingFaceDownloader } from '../../components/models/HuggingFaceDownloader';
import { PRESET_MODELS } from '../../services/modelCatalog';
import { hfHubService } from '../../services/hfHubApi';

vi.mock('../../services/hfHubApi', () => ({
  hfHubService: {
    getRepoFiles: vi.fn()
  }
}));

const emptySystemModels = {
  checkpoints: [], unets: [], clips: [], loras: [], vaes: [], controlnets: [], llms: [], scanPaths: []
};

const baseProps = {
  systemModels: emptySystemModels,
  hfQuery: '',
  setHfQuery: vi.fn(),
  hfResults: [],
  isHfSearching: false,
  onHfSearch: vi.fn(),
  onDownloadModel: vi.fn().mockResolvedValue(undefined),
  downloadProgress: {},
  onSuccess: vi.fn(),
  onError: vi.fn()
};

describe('HuggingFaceDownloader - catalog view', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a live progress bar for a preset that is currently downloading', () => {
    const target = PRESET_MODELS[0];
    render(
      <HuggingFaceDownloader
        {...baseProps}
        viewMode="catalog"
        downloadProgress={{ [target.recommendedFilename]: 42 }}
      />
    );

    expect(screen.getByText('Downloading...')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders a Download button (not a progress bar) for a preset with no active download', () => {
    render(<HuggingFaceDownloader {...baseProps} viewMode="catalog" downloadProgress={{}} />);
    expect(screen.queryByText('Downloading...')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Download to App/i).length).toBeGreaterThan(0);
  });
});

describe('HuggingFaceDownloader - hf-search view', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens the repo file modal on "Browse Files & Download" and closes it on X', async () => {
    (hfHubService.getRepoFiles as any).mockResolvedValue([
      { path: 'model.Q4_K_M.gguf', formattedSize: '4.1 GB', isGguf: true }
    ]);
    const user = userEvent.setup();

    render(
      <HuggingFaceDownloader
        {...baseProps}
        viewMode="hf-search"
        hfResults={[
          { id: 'org/some-gguf-repo', name: 'Some GGUF Repo', author: 'org', likes: 3, downloads: 10, tags: [], pipeline_tag: 'text-generation' } as any
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: /browse files & download/i }));

    const modalHeading = await screen.findByText(/files in org\/some-gguf-repo/i);
    expect(modalHeading).toBeInTheDocument();
    expect(await screen.findByText('model.Q4_K_M.gguf')).toBeInTheDocument();

    const modal = modalHeading.closest('div')!.parentElement!.parentElement!;
    await user.click(within(modal).getByRole('button', { name: '' }));

    expect(screen.queryByText(/files in org\/some-gguf-repo/i)).not.toBeInTheDocument();
  });
});
