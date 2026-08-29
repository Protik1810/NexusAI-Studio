export interface SDCppGenerationParams {
  pipeline: 'flux' | 'standard';
  modelPath: string;
  clipPath?: string;
  t5Path?: string;
  vaePath?: string;
  loraPath?: string;
  loraStrength?: number;
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
    onProgress: (step: number, total: number, message?: string) => void
  ): Promise<SDCppResult> {
    const seedUsed = req.seed === -1 ? Math.floor(Math.random() * 1000000) : req.seed;
    const finalParams = { ...req, seed: seedUsed };

    onProgress(1, req.steps, 'stable-diffusion.cpp: Initializing GPU Tensor Pipeline...');
    let simulatedStep = 1;
    const progressInterval = setInterval(() => {
      if (simulatedStep < req.steps) {
        simulatedStep++;
        onProgress(simulatedStep, req.steps, `stable-diffusion.cpp GPU: Sampling Step ${simulatedStep}/${req.steps}...`);
      }
    }, 600);

    try {
      const res = await fetch('/api/sd-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalParams)
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status} Server Error` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate image on GPU');
      }

      onProgress(req.steps, req.steps, 'stable-diffusion.cpp: VAE Decode complete!');

      return {
        imageUrl: data.imageUrl,
        seedUsed,
        outputPath: data.outputPath
      };
    } catch (err: any) {
      clearInterval(progressInterval);
      throw new Error(`GPU Inference Error:\n\n${err.message}`, { cause: err });
    }
  }
}

export const sdCppService = new StableDiffusionCppService();
