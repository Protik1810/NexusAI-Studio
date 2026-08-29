export interface GenerationOptions {
  pipeline: 'flux' | 'standard';
  unetModel: string;
  clipModel: string;
  vaeModel: string;
  checkpointModel: string;
  loraModel?: string;
  loraStrength?: number;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  samplerName: string;
  scheduler: string;
  denoise: number;
}

export interface ComfyStatus {
  connected: boolean;
  vramFree?: string;
  vramTotal?: string;
  device?: string;
  version?: string;
  error?: string;
}

export interface AvailableModels {
  checkpoints: string[];
  unets: string[];
  clips: string[];
  loras: string[];
  vaes: string[];
  controlnets?: string[];
}

export class ComfyService {
  private baseUrl: string;
  private clientId: string;

  constructor(baseUrl: string = 'http://127.0.0.1:8188') {
    const saved = localStorage.getItem('nexus_comfy_url');
    this.baseUrl = (saved || baseUrl).replace(/\/+$/, '');
    this.clientId = 'nexus_studio_' + Math.random().toString(36).substring(2, 9);
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  /**
   * Translates the ComfyUI target into a Vite reverse-proxy URL when running locally in browser,
   * completely avoiding ComfyUI's 403 Origin/Host mismatch warning.
   */
  private getApiUrl(path: string = ''): string {
    const isLocalhost8188 = this.baseUrl.includes('8188') || this.baseUrl.includes('127.0.0.1') || this.baseUrl.includes('localhost');
    const isBrowserMode = typeof window !== 'undefined' && (window.location.port === '1420' || window.location.port === '5173');

    if (isBrowserMode && isLocalhost8188) {
      return `/comfy-api${path.startsWith('/') ? path : '/' + path}`;
    }
    return `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  private getWsUrl(): string {
    const isLocalhost8188 = this.baseUrl.includes('8188') || this.baseUrl.includes('127.0.0.1') || this.baseUrl.includes('localhost');
    const isBrowserMode = typeof window !== 'undefined' && (window.location.port === '1420' || window.location.port === '5173');

    if (isBrowserMode && isLocalhost8188) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/comfy-ws/ws?clientId=${this.clientId}`;
    }

    const wsProto = this.baseUrl.startsWith('https') ? 'wss:' : 'ws:';
    const cleanHost = this.baseUrl.replace(/^https?:\/\//, '');
    return `${wsProto}//${cleanHost}/ws?clientId=${this.clientId}`;
  }

  async checkStatus(): Promise<ComfyStatus> {
    try {
      const res = await fetch(this.getApiUrl('/system_stats'), { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const device = data.devices?.[0];
      const vramFree = device ? (device.vram_free / (1024 * 1024 * 1024)).toFixed(1) + ' GB' : 'N/A';
      const vramTotal = device ? (device.vram_total / (1024 * 1024 * 1024)).toFixed(1) + ' GB' : 'N/A';
      return {
        connected: true,
        vramFree,
        vramTotal,
        device: device?.name || 'GPU Detected',
        version: data.system?.comfyui_version || 'Ready'
      };
    } catch (e: any) {
      return {
        connected: false,
        error: e.message || 'Cannot reach ComfyUI on ' + this.baseUrl
      };
    }
  }

  async fetchModels(): Promise<AvailableModels> {
    try {
      const res = await fetch(this.getApiUrl('/object_info'), { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const checkpoints = data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
      const unets = data.UNETLoader?.input?.required?.unet_name?.[0] || [];
      const clips = data.CLIPLoader?.input?.required?.clip_name?.[0] || data.DualCLIPLoader?.input?.required?.clip_name1?.[0] || [];
      const loras = data.LoraLoader?.input?.required?.lora_name?.[0] || [];
      const vaes = data.VAELoader?.input?.required?.vae_name?.[0] || [];

      return {
        checkpoints: Array.isArray(checkpoints) ? checkpoints : [],
        unets: Array.isArray(unets) ? unets : [],
        clips: Array.isArray(clips) ? clips : [],
        loras: Array.isArray(loras) ? loras : [],
        vaes: Array.isArray(vaes) ? vaes : []
      };
    } catch (e) {
      return {
        checkpoints: ['NSFW-gen-v2.safetensors', 'RealVisXL_V5.0_Lightning.safetensors', 'Juggernaut_RunDiffusionPhoto2_Lightning_4Steps.safetensors'],
        unets: ['PornMaster_Klein-9b.safetensors', 'flux1-dev.safetensors', 'flux1-schnell.safetensors'],
        clips: ['flux2-klein-4b-uncensored-text-encoder.safetensors', 't5xxl_fp16.safetensors', 'clip_l.safetensors'],
        loras: ['Flux_Lustly.ai_Uncensored_nsfw_v1.safetensors'],
        vaes: ['ae.safetensors']
      };
    }
  }

  buildFluxPrompt(opts: GenerationOptions) {
    const hasLora = Boolean(opts.loraModel && opts.loraStrength && opts.loraStrength > 0);

    const promptObj: Record<string, any> = {
      // 1. UNET Loader (e.g. PornMaster_Klein-9b)
      "1": {
        "inputs": {
          "unet_name": opts.unetModel || "PornMaster_Klein-9b.safetensors",
          "weight_dtype": "default"
        },
        "class_type": "UNETLoader"
      },
      // 2. CLIP Text Encoder (e.g. flux2-klein-4b-uncensored-text-encoder)
      "2": {
        "inputs": {
          "clip_name": opts.clipModel || "flux2-klein-4b-uncensored-text-encoder.safetensors",
          "type": "flux"
        },
        "class_type": "CLIPLoader"
      },
      // 3. VAE Loader
      "3": {
        "inputs": {
          "vae_name": opts.vaeModel || "ae.safetensors"
        },
        "class_type": "VAELoader"
      },
      // 4. Empty Latent Image
      "4": {
        "inputs": {
          "width": opts.width,
          "height": opts.height,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      // 5. Positive Prompt Text Encode
      "5": {
        "inputs": {
          "text": opts.prompt,
          "clip": hasLora ? ["10", 1] : ["2", 0]
        },
        "class_type": "CLIPTextEncode"
      },
      // 6. Flux Guidance Scale
      "6": {
        "inputs": {
          "guidance": opts.cfg || 3.5,
          "conditioning": ["5", 0]
        },
        "class_type": "FluxGuidance"
      },
      // 7. KSampler
      "7": {
        "inputs": {
          "seed": opts.seed === -1 ? Math.floor(Math.random() * 10000000000000) : opts.seed,
          "steps": opts.steps || 20,
          "cfg": 1.0,
          "sampler_name": opts.samplerName || "euler",
          "scheduler": opts.scheduler || "simple",
          "denoise": opts.denoise || 1.0,
          "model": hasLora ? ["10", 0] : ["1", 0],
          "positive": ["6", 0],
          "negative": ["5", 0],
          "latent_image": ["4", 0]
        },
        "class_type": "KSampler"
      },
      // 8. VAE Decode
      "8": {
        "inputs": {
          "samples": ["7", 0],
          "vae": ["3", 0]
        },
        "class_type": "VAEDecode"
      },
      // 9. Save Image
      "9": {
        "inputs": {
          "filename_prefix": "NexusStudio_FLUX",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      }
    };

    if (hasLora) {
      promptObj["10"] = {
        "inputs": {
          "lora_name": opts.loraModel,
          "strength_model": opts.loraStrength || 1.0,
          "strength_clip": opts.loraStrength || 1.0,
          "model": ["1", 0],
          "clip": ["2", 0]
        },
        "class_type": "LoraLoader"
      };
    }

    return promptObj;
  }

  buildStandardPrompt(opts: GenerationOptions) {
    const hasLora = Boolean(opts.loraModel && opts.loraStrength && opts.loraStrength > 0);

    const promptObj: Record<string, any> = {
      // 1. Checkpoint Loader (e.g. NSFW-gen-v2 or RealVisXL)
      "1": {
        "inputs": {
          "ckpt_name": opts.checkpointModel || "NSFW-gen-v2.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      // 2. Positive Prompt
      "2": {
        "inputs": {
          "text": opts.prompt,
          "clip": hasLora ? ["10", 1] : ["1", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      // 3. Negative Prompt
      "3": {
        "inputs": {
          "text": opts.negativePrompt || "ugly, blurry, low quality, distorted, deformed",
          "clip": hasLora ? ["10", 1] : ["1", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      // 4. Empty Latent
      "4": {
        "inputs": {
          "width": opts.width,
          "height": opts.height,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      // 5. KSampler
      "5": {
        "inputs": {
          "seed": opts.seed === -1 ? Math.floor(Math.random() * 10000000000000) : opts.seed,
          "steps": opts.steps || 25,
          "cfg": opts.cfg || 7.0,
          "sampler_name": opts.samplerName || "euler_ancestral",
          "scheduler": opts.scheduler || "karras",
          "denoise": opts.denoise || 1.0,
          "model": hasLora ? ["10", 0] : ["1", 0],
          "positive": ["2", 0],
          "negative": ["3", 0],
          "latent_image": ["4", 0]
        },
        "class_type": "KSampler"
      },
      // 6. VAE Decode
      "6": {
        "inputs": {
          "samples": ["5", 0],
          "vae": ["1", 2]
        },
        "class_type": "VAEDecode"
      },
      // 7. Save Image
      "7": {
        "inputs": {
          "filename_prefix": "NexusStudio_SD",
          "images": ["6", 0]
        },
        "class_type": "SaveImage"
      }
    };

    if (hasLora) {
      promptObj["10"] = {
        "inputs": {
          "lora_name": opts.loraModel,
          "strength_model": opts.loraStrength || 1.0,
          "strength_clip": opts.loraStrength || 1.0,
          "model": ["1", 0],
          "clip": ["1", 1]
        },
        "class_type": "LoraLoader"
      };
    }

    return promptObj;
  }

  async generate(
    opts: GenerationOptions,
    onProgress: (step: number, total: number, nodeName?: string) => void
  ): Promise<{ imageUrl: string; filename: string; seedUsed: number }> {
    const seedUsed = opts.seed === -1 ? Math.floor(Math.random() * 10000000000000) : opts.seed;
    const finalOpts = { ...opts, seed: seedUsed };

    const workflow = opts.pipeline === 'flux' 
      ? this.buildFluxPrompt(finalOpts)
      : this.buildStandardPrompt(finalOpts);

    const wsUrl = this.getWsUrl();
    const ws = new WebSocket(wsUrl);

    let outputFilename = '';
    let outputSubfolder = '';
    let outputType = 'output';

    const promise = new Promise<{ imageUrl: string; filename: string; seedUsed: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Generation timed out after 180s.'));
      }, 180000);

      ws.onmessage = (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const msg = JSON.parse(event.data);

          if (msg.type === 'progress') {
            const { value, max } = msg.data;
            onProgress(value, max, 'Sampling');
          } else if (msg.type === 'executing') {
            const node = msg.data.node;
            if (node) {
              const nodeClass = workflow[node]?.class_type || 'Processing';
              onProgress(0, opts.steps, nodeClass);
            } else if (msg.data.node === null) {
              // Finished
            }
          } else if (msg.type === 'executed') {
            if (msg.data.output?.images?.[0]) {
              const img = msg.data.output.images[0];
              outputFilename = img.filename;
              outputSubfolder = img.subfolder || '';
              outputType = img.type || 'output';

              const imageUrl = this.getApiUrl(`/view?filename=${encodeURIComponent(outputFilename)}&subfolder=${encodeURIComponent(outputSubfolder)}&type=${outputType}&t=${Date.now()}`);
              clearTimeout(timeout);
              ws.close();
              resolve({ imageUrl, filename: outputFilename, seedUsed });
            }
          } else if (msg.type === 'execution_error') {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`ComfyUI Execution Error: ${msg.data.exception_message || 'Unknown node error'}`));
          }
        } catch (err) {
          // skip
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection error with ComfyUI.'));
      };
    });

    // Wait for WS to connect
    await new Promise<void>((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.onopen = () => resolve();
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) reject(new Error('Failed to connect WebSocket to ComfyUI. Ensure ComfyUI is running.'));
      }, 5000);
    });

    // Submit Prompt
    const res = await fetch(this.getApiUrl('/prompt'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: workflow,
        client_id: this.clientId
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to queue prompt: HTTP ${res.status} - ${errText}`);
    }

    return promise;
  }
}

export const comfyService = new ComfyService();
