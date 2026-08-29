import { safeInvoke, isTauriEnvironment } from './tauriBridge';

export interface NativeGenRequest {
  pipeline: 'flux' | 'standard';
  model: string;
  clipModel?: string;
  t5Model?: string;
  vaeModel?: string;
  loraModel?: string;
  loraStrength?: number;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
}

export interface NativeGenResult {
  imageUrl: string;
  seedUsed: number;
  path: string;
  isMockPreview?: boolean;
}

export class NativeCppService {
  /**
   * Generates a preview canvas when testing inside regular web browsers.
   */
  private generateMockCanvas(req: NativeGenRequest, seed: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(req.width, 1024);
    canvas.height = Math.min(req.height, 1024);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Dark sleek gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#083344');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing accents
    ctx.strokeStyle = req.pipeline === 'flux' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Metadata text
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('✨ Native C++ Engine Preview', 40, 70);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Pipeline: ${req.pipeline.toUpperCase()} | Model: ${req.model.split('/').pop()}`, 40, 110);
    ctx.fillText(`Resolution: ${req.width}x${req.height} | Steps: ${req.steps} | Seed: ${seed}`, 40, 135);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(40, 160, canvas.width - 80, 100);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'italic 14px "Plus Jakarta Sans", sans-serif';
    const lines = req.prompt.match(/.{1,60}(\s|$)/g) || [req.prompt];
    lines.slice(0, 3).forEach((line, i) => {
      ctx.fillText(`"${line.trim()}"`, 50, 195 + i * 24);
    });

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText('⚡ Standalone Binary Execution: Run "npm run tauri dev" for live GPU inference', 40, canvas.height - 50);

    return canvas.toDataURL('image/png');
  }

  async generateImage(
    req: NativeGenRequest,
    onProgress: (step: number, total: number, message?: string) => void
  ): Promise<NativeGenResult> {
    const seedUsed = req.seed === -1 ? Math.floor(Math.random() * 10000000000000) : req.seed;
    const outputFilename = `output_${Date.now()}.png`;

    // 1. If running in native Tauri desktop window -> Execute C++ Binary directly
    if (isTauriEnvironment()) {
      onProgress(1, req.steps, 'Spawning Native C++ Engine (sd.exe)...');

      try {
        const resultPath = await safeInvoke<string>('generate_image_cmd', {
          params: {
            pipeline: req.pipeline,
            model: req.model,
            clip_model: req.clipModel || null,
            t5_model: req.t5Model || null,
            vae_model: req.vaeModel || null,
            lora_model: req.loraModel || null,
            lora_strength: req.loraStrength || null,
            prompt: req.prompt,
            negative_prompt: req.negativePrompt || null,
            width: req.width,
            height: req.height,
            steps: req.steps,
            cfg: req.cfg,
            seed: seedUsed,
            output_path: outputFilename
          }
        });

        const { convertFileSrc } = await import('@tauri-apps/api/core');
        return {
          imageUrl: convertFileSrc(resultPath),
          seedUsed,
          path: resultPath,
          isMockPreview: false
        };
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
        throw new Error(`Native C++ Engine Error:\n\n${msg}\n\n💡 Ensure 'sd.exe' or 'sd-vulkan.exe' is present in 'backend/win/' or application directory.`);
      }
    }

    // 2. If running in Browser Dev Mode -> Simulate progress & produce preview
    for (let step = 1; step <= req.steps; step++) {
      await new Promise(r => setTimeout(r, 60));
      onProgress(step, req.steps, `Synthesizing Latents (Step ${step}/${req.steps})...`);
    }

    const mockDataUrl = this.generateMockCanvas(req, seedUsed);
    return {
      imageUrl: mockDataUrl,
      seedUsed,
      path: outputFilename,
      isMockPreview: true
    };
  }
}

export const nativeCppService = new NativeCppService();
