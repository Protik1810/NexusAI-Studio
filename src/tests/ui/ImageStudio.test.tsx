import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageStudio } from '../../components/ImageStudio';
import { sdCppService } from '../../services/stableDiffusionCpp';

vi.mock('../../services/stableDiffusionCpp', () => ({
  sdCppService: {
    generateImage: vi.fn()
  }
}));

describe('ImageStudio', () => {
  beforeEach(() => {
    // ImageStudio talks to the backend via raw fetch() calls (hardware info,
    // /api/local-models, /api/scan-status polling) rather than a service
    // wrapper — stub a generic empty-but-ok response so mount doesn't hang
    // on unresolved promises or log fetch errors to the console.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({})
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders with an empty model scan and a usable Generate Artwork button', async () => {
    render(<ImageStudio onImageGenerated={vi.fn()} onError={vi.fn()} />);

    // reloadLocalModels() resolves the stubbed fetch and clears the
    // component's hardcoded placeholder model list down to empty.
    expect(await screen.findByText(/found 0 models across system/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate artwork/i })).toBeEnabled();
  });

  it('blocks generation on an empty prompt instead of calling the backend', async () => {
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<ImageStudio onImageGenerated={vi.fn()} onError={onError} />);

    await screen.findByText(/found 0 models across system/i);
    await user.click(screen.getByRole('button', { name: /generate artwork/i }));

    expect(onError).toHaveBeenCalledWith('Missing Prompt', expect.any(String));
    expect(sdCppService.generateImage).not.toHaveBeenCalled();
  });
});
