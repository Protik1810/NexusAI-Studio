import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatStudio } from '../../components/ChatStudio';
import { llmService } from '../../services/llmApi';

vi.mock('../../services/llmApi', async () => {
  const actual = await vi.importActual<typeof import('../../services/llmApi')>('../../services/llmApi');
  return {
    ...actual,
    llmService: {
      getLocalGgufModels: vi.fn(),
      getLocalMmprojModels: vi.fn(),
      getEmbeddedLlamaStatus: vi.fn(),
      streamChat: vi.fn()
    }
  };
});

const testModel = {
  filename: 'test-model.gguf',
  fullPath: 'models/llm/test-model.gguf',
  sizeBytes: 1024,
  formattedSize: '1 KB',
  source: 'local',
  isGguf: true
};

// Node's own built-in localStorage (globalThis.localStorage, present since
// Node 22 regardless of jsdom) shadows jsdom's implementation in this
// environment and its .clear()/.getItem() don't behave like a real Storage
// without a backing --localstorage-file — stub a plain in-memory one instead
// of fighting that for what ChatStudio only ever uses as opaque key/value
// storage (chat history + load params).
function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear()
  };
}

describe('ChatStudio', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
    (llmService.getLocalGgufModels as any).mockResolvedValue([testModel]);
    (llmService.getLocalMmprojModels as any).mockResolvedValue([]);
    (llmService.getEmbeddedLlamaStatus as any).mockResolvedValue({
      running: true, port: 8080, model: 'test-model.gguf'
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const llmStatus = { connected: true, type: 'embedded-llama' as const, models: [] };

  it('renders and picks up the locally scanned GGUF model', async () => {
    render(
      <ChatStudio
        llmStatus={llmStatus}
        onSendToImageStudio={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(await screen.findByRole('option', { name: /test-model\.gguf/i })).toBeInTheDocument();
  });

  it('streams tokens into the assistant bubble as they arrive', async () => {
    (llmService.streamChat as any).mockImplementation(
      async (_messages: any, _model: any, _system: any, _temp: any, onToken: (t: string) => void) => {
        onToken('Hello');
        onToken(' there');
        return 'Hello there';
      }
    );

    const user = userEvent.setup();
    render(
      <ChatStudio
        llmStatus={llmStatus}
        onSendToImageStudio={vi.fn()}
        onError={vi.fn()}
      />
    );

    await screen.findByRole('option', { name: /test-model\.gguf/i });

    const input = screen.getByPlaceholderText(/type your uncensored request/i);
    await user.type(input, 'hi there');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(llmService.streamChat).toHaveBeenCalled();
  });
});
