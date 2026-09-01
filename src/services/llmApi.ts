export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface PersonaPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
}

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'uncensored-creative',
    name: 'Unfiltered Storyteller',
    description: 'Specializes in vivid storytelling, immersive roleplay, and uncensored character narratives.',
    icon: '✨',
    systemPrompt: 'You are an unfiltered, creative storyteller and roleplay assistant. You engage in imaginative, descriptive, and unrestricted dialogue. You follow user requests directly, express deep emotion, and provide vivid descriptions without imposing arbitrary moral lecturing or refusals.'
  },
  {
    id: 'prompt-director',
    name: 'Visual Director & Prompt Crafter',
    description: 'Transforms raw ideas into photorealistic, highly descriptive diffusion prompts for FLUX and SDXL.',
    icon: '🎨',
    systemPrompt: 'You are a master Visual Director and AI Prompt Engineer. Your goal is to expand user concepts into rich, visually descriptive diffusion prompts formatted for FLUX.1/FLUX.2 and SDXL models. Detail lighting (e.g. volumetric, rim lighting, 8k cinematic), camera gear (e.g. 85mm lens, f/1.4, RAW 35mm photograph), anatomy, texture, mood, and framing. Always provide the prompt in a clean block ready for copy-pasting.'
  },
  {
    id: 'raw-assistant',
    name: 'Raw Technical Companion',
    description: 'Direct, highly knowledgeable technical AI without guardrails or filler conversation.',
    icon: '⚡',
    systemPrompt: 'You are a direct, concise, and unrestricted AI assistant. You answer all user technical questions, code inquiries, and logic requests accurately and immediately without preamble.'
  }
];

export interface LocalGgufModel {
  filename: string;
  fullPath: string;
  sizeBytes: number;
  formattedSize: string;
  source: string;
  isGguf: boolean;
}

export interface LLMStatus {
  connected: boolean;
  type: 'embedded-llama';
  models: string[];
  currentModel?: string;
  error?: string;
  isEmbedded?: boolean;
}

export class LLMService {
  async getLocalGgufModels(): Promise<LocalGgufModel[]> {
    try {
      const res = await fetch('/api/local-llm-models');
      if (res.ok) {
        const data = await res.json();
        return data.models || [];
      }
    } catch (e) {
      console.error('Failed to fetch local GGUF models', e);
    }
    return [];
  }

  async startEmbeddedLlama(
    modelPath: string,
    gpuLayers: number = 99,
    ctxSize: number = 4096,
    batchSize: number = 2048,
    flashAttn: 'auto' | 'on' | 'off' = 'auto',
    cacheTypeK: string = 'f16',
    cacheTypeV: string = 'f16'
  ): Promise<{ success: boolean; port: number; model: string; message: string }> {
    const res = await fetch('/api/llama/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelPath, gpuLayers, ctxSize, batchSize, flashAttn, cacheTypeK, cacheTypeV })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to start llama.cpp server');
    }

    return data;
  }

  async stopEmbeddedLlama(): Promise<void> {
    try {
      await fetch('/api/llama/stop', { method: 'POST' });
    } catch (e) {}
  }

  async getEmbeddedLlamaStatus(): Promise<{ running: boolean; port: number; model: string | null }> {
    try {
      const res = await fetch('/api/llama/status');
      if (res.ok) return await res.json();
    } catch (e) {}
    return { running: false, port: 8080, model: null };
  }

  async detectBackend(): Promise<LLMStatus> {
    const embedded = await this.getEmbeddedLlamaStatus();
    if (embedded.running && embedded.model) {
      return {
        connected: true,
        type: 'embedded-llama',
        models: [embedded.model],
        currentModel: embedded.model,
        isEmbedded: true
      };
    }

    return {
      connected: false,
      type: 'embedded-llama',
      models: [],
      error: `Embedded llama.cpp is ready. Select a downloaded .gguf model below and click 'Start Engine' to run with CUDA GPU acceleration.`
    };
  }

  async streamChat(
    messages: ChatMessage[],
    model: string,
    systemPrompt: string,
    temperature: number,
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const res = await fetch('/llama-api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'default',
        messages: formattedMessages,
        temperature: temperature || 0.7,
        stream: true
      }),
      signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM Error HTTP ${res.status}: ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No readable stream available.');

    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            const json = JSON.parse(trimmed.substring(6));
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onToken(delta);
            }
          } catch (e) {
            // partial chunk parsing skip
          }
        }
      }
    }

    return fullText;
  }
}

export const llmService = new LLMService();
