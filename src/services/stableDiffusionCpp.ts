import { safeInvoke, isTauriEnvironment } from './tauriBridge';

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

    // 1. Native Desktop Tauri Shell Execution
    if (isTauriEnvironment()) {
      const outputFilename = `output_${Date.now()}.png`;

      try {
        const resultPath = await safeInvoke<string>('generate_image_cmd', {
          params: {
            pipeline: finalParams.pipeline,
            model: finalParams.modelPath,
            clip_model: finalParams.clipPath || null,
            t5_model: finalParams.t5Path || null,
            vae_model: finalParams.vaePath || null,
            lora_model: finalParams.loraPath || null,
            lora_strength: finalParams.loraStrength || null,
            prompt: finalParams.prompt,
            negative_prompt: finalParams.negativePrompt || null,
            width: finalParams.width,
            height: finalParams.height,
            steps: finalParams.steps,
            cfg: finalParams.cfgScale,
            seed: seedUsed,
            output_path: outputFilename
          }
        });

        const { convertFileSrc } = await import('@tauri-apps/api/core');
        return {
          imageUrl: convertFileSrc(resultPath),
          seedUsed,
          outputPath: resultPath
        };
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
        throw new Error(`stable-diffusion.cpp Execution Error:\n\n${msg}\n\n💡 Ensure 'sd-cli.exe' is present in 'backend/win/vulkan/' or 'backend/win/cuda/'.`);
      }
    }

    // 2. Direct GPU Inference via Local Backend API Bridge (Web Browser Mode)
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
      throw new Error(`GPU Inference Error:\n\n${err.message}`);
    }
  }
}

export const sdCppService = new StableDiffusionCppService();
