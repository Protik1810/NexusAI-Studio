export interface SDCppGenerationParams {
  pipeline: 'flux' | 'standard';
  modelPath: string;
  clipPath?: string;
  t5Path?: string;
  vaePath?: string;
  loraPath?: string;
  loraStrength?: number;
  offloadTextEncoder?: boolean;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  seed: number;
  samplingMethod?: string;
  threads?: number;
}

export interface SDCppResult {
  imageUrl: string;
  seedUsed: number;
  outputPath: string;
}

export const SD_CPP_SAMPLERS = [
  { id: 'euler', name: 'Euler (Recommended for FLUX & Fast)' },
  { id: 'euler_a', name: 'Euler Ancestral' },
  { id: 'dpm++2m', name: 'DPM++ 2M Karras' },
  { id: 'dpm++2s_a', name: 'DPM++ 2S Ancestral' },
  { id: 'heun', name: 'Heun' },
  { id: 'lcm', name: 'LCM (Latent Consistency / Lightning)' }
];

export class StableDiffusionCppService {
  async generateImage(
    req: SDCppGenerationParams,
    onProgress: (step: number, total: number, message?: string) => void,
    signal?: AbortSignal
  ): Promise<SDCppResult> {
    const seedUsed = req.seed === -1 ? Math.floor(Math.random() * 1000000) : req.seed;
    const finalParams = { ...req, seed: seedUsed };

    onProgress(0, req.steps, 'stable-diffusion.cpp: Initializing GPU Tensor Pipeline...');

    let res: Response;
    try {
      res = await fetch('/api/sd-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalParams),
        signal
      });
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Generation cancelled.', { cause: err });
      throw new Error(`GPU Inference Error:\n\n${err.message}`, { cause: err });
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status} Server Error` }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    if (!res.body) {
      throw new Error('Server did not return a progress stream.');
    }

    // The server streams real sd-cli progress as Server-Sent Events (one
    // "data: {...}\n\n" per sampling step) instead of a single blocking JSON
    // response, so the progress bar reflects what the GPU is actually doing.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLine = rawEvent.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(6));

          if (payload.done) {
            if (!payload.success) {
              throw new Error(payload.error || 'Failed to generate image on GPU');
            }
            onProgress(req.steps, req.steps, 'stable-diffusion.cpp: VAE Decode complete!');
            return {
              imageUrl: payload.imageUrl,
              seedUsed,
              outputPath: payload.outputPath
            };
          }
          onProgress(payload.step, payload.total, payload.message);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Generation cancelled.', { cause: err });
      throw new Error(`GPU Inference Error:\n\n${err.message}`, { cause: err });
    }

    throw new Error('GPU Inference Error:\n\nConnection closed before generation finished.');
  }
}

export const sdCppService = new StableDiffusionCppService();
