export interface ModelPreset {
  id: string;
  name: string;
  repo: string;
  architecture: 'FLUX.2' | 'FLUX.1' | 'SDXL' | 'SD1.5' | 'LLM' | 'Custom';
  category: 'unet' | 'checkpoint' | 'clip' | 'lora' | 'vae' | 'controlnet' | 'llm';
  description: string;
  recommendedFilename: string;
  targetFolder: string;
  size: string;
  downloadUrl: string;
  recommendedSteps: number;
  recommendedCfg: number;
  isUncensored: boolean;
  tags: string[];
  /** Minimum VRAM (GB) for a comfortable run. Used to pick between quality tiers. */
  minVramGB?: number;
}

export const PRESET_MODELS: ModelPreset[] = [
  {
    id: 'controlnet-union-sdxl',
    name: 'ControlNet Union SDXL 1.0 (All-in-One)',
    repo: 'xinsir/controlnet-union-sdxl-1.0',
    architecture: 'SDXL',
    category: 'controlnet',
    description: 'Universal multi-modal ControlNet for SDXL. Supports OpenPose, Depth, Canny, Lineart, Anime Lineart, Sketch, and Normal Map in a single 2.5GB model.',
    recommendedFilename: 'diffusion_pytorch_model.safetensors',
    targetFolder: 'models/controlnet',
    size: '~2.5 GB',
    downloadUrl: 'https://huggingface.co/xinsir/controlnet-union-sdxl-1.0/resolve/main/diffusion_pytorch_model.safetensors',
    recommendedSteps: 20,
    recommendedCfg: 7.0,
    isUncensored: false,
    tags: ['SDXL', 'ControlNet', 'OpenPose', 'Depth', 'Canny', 'Lineart', 'Multi-Modal']
  },
  {
    id: 'controlnet-union-sdxl-promax',
    name: 'ControlNet Union SDXL ProMax (12 Modes)',
    repo: 'xinsir/controlnet-union-sdxl-1.0',
    architecture: 'SDXL',
    category: 'controlnet',
    description: 'Upgraded ProMax edition of ControlNet Union SDXL supporting 12+ control conditions and multi-control conditioning simultaneously.',
    recommendedFilename: 'diffusion_pytorch_model_promax.safetensors',
    targetFolder: 'models/controlnet',
    size: '~2.5 GB',
    downloadUrl: 'https://huggingface.co/xinsir/controlnet-union-sdxl-1.0/resolve/main/diffusion_pytorch_model_promax.safetensors',
    recommendedSteps: 20,
    recommendedCfg: 7.0,
    isUncensored: false,
    tags: ['SDXL', 'ControlNet', 'ProMax', '12 Modes', 'Pose', 'Depth', 'Canny']
  },
  {
    id: 'flux2-klein-4b-text-encoder',
    name: 'FLUX.2 Klein 4B Uncensored Text Encoder',
    repo: 'ponpoke/flux2-klein-4b-uncensored-text-encoder',
    architecture: 'FLUX.2',
    category: 'clip',
    description: 'Abliterated CLIP/T5 text encoder with refusal vectors surgically removed. Essential for FLUX prompt processing without censorship.',
    recommendedFilename: 'flux2-klein-4b-uncensored-text-encoder.safetensors',
    targetFolder: 'models/clip',
    size: '~4.5 GB',
    downloadUrl: 'https://huggingface.co/ponpoke/flux2-klein-4b-uncensored-text-encoder/resolve/main/flux2-klein-4b-uncensored-text-encoder.safetensors',
    recommendedSteps: 0,
    recommendedCfg: 0,
    isUncensored: true,
    tags: ['FLUX.2', 'Abliterated', 'Text Encoder', 'No Refusal', 'CLIP/T5']
  },
  {
    id: 'flux-lustly-lora',
    name: 'FLUX Lustly.ai Uncensored LoRA v1',
    repo: 'L2a-T/Flux_Lustly.ai_Uncensored_nsfw_v1',
    architecture: 'FLUX.1',
    category: 'lora',
    description: 'Fine-tuned LoRA adapter for FLUX.1. Injects high-fidelity uncensored styles, anatomical detail, and realism into any FLUX generation.',
    recommendedFilename: 'flux_lustly-ai_v1.safetensors',
    targetFolder: 'models/loras',
    size: '327 MB',
    downloadUrl: 'https://huggingface.co/L2a-T/Flux_Lustly.ai_Uncensored_nsfw_v1/resolve/main/flux_lustly-ai_v1.safetensors',
    recommendedSteps: 20,
    recommendedCfg: 3.5,
    isUncensored: true,
    tags: ['FLUX.1 LoRA', 'Adapter', 'Uncensored', 'Photoreal', 'NSFW']
  },
  {
    id: 'realvis-xl-lightning',
    name: 'RealVisXL V5.0 Lightning',
    repo: 'SG161222/RealVisXL_V5.0_Lightning',
    architecture: 'SDXL',
    category: 'checkpoint',
    description: 'The standard for ultra-fast photorealistic uncensored generation. Generates professional 1024x1024 portraits in just 4 to 6 steps.',
    recommendedFilename: 'RealVisXL_V5.0_Lightning_fp16.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~6.6 GB',
    downloadUrl: 'https://huggingface.co/SG161222/RealVisXL_V5.0_Lightning/resolve/main/RealVisXL_V5.0_Lightning_fp16.safetensors',
    recommendedSteps: 6,
    recommendedCfg: 1.8,
    isUncensored: true,
    tags: ['SDXL', 'Lightning 4-Steps', 'Photorealism', 'Fast']
  },
  {
    id: 'sdxl-turbo',
    name: 'SDXL Turbo (1-Step Real-Time)',
    repo: 'stabilityai/sdxl-turbo',
    architecture: 'SDXL',
    category: 'checkpoint',
    description: 'Adversarial diffusion model generating photorealistic images in a single step (sub-second generation) with CFG 1.0.',
    recommendedFilename: 'sd_xl_turbo_1.0_fp16.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~6.9 GB',
    downloadUrl: 'https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors',
    recommendedSteps: 1,
    recommendedCfg: 1.0,
    isUncensored: false,
    tags: ['SDXL', 'Turbo', '1-Step', 'Real-Time', 'Ultra Fast']
  },
  {
    id: 'pornworks-sdxl-pony',
    name: 'Pornworks Real Porn Photo Realistic SDXL & Pony',
    repo: 'Manjushri/pornworks-real-porn-photo-realistic-nsfw-sdxl-and-pony-chekpoint',
    architecture: 'SDXL',
    category: 'checkpoint',
    description: 'High-realism uncensored SDXL and Pony hybrid checkpoint optimized for lifelike anatomy, skin shaders, and explicit aesthetics.',
    recommendedFilename: 'pornworksRealPornPhoto_v04.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~6.6 GB',
    downloadUrl: 'https://huggingface.co/Manjushri/pornworks-real-porn-photo-realistic-nsfw-sdxl-and-pony-chekpoint/resolve/main/pornworksRealPornPhoto_v04.safetensors',
    recommendedSteps: 25,
    recommendedCfg: 6.5,
    isUncensored: true,
    tags: ['SDXL', 'Pony', 'Uncensored', 'Photoreal', 'NSFW']
  },
  {
    id: 'lustify-sdxl-v2',
    name: 'LUSTIFY SDXL NSFW Checkpoint v2.0',
    repo: 'andro-flock/LUSTIFY-SDXL-NSFW-checkpoint-v2-0-INPAINTING',
    architecture: 'SDXL',
    category: 'checkpoint',
    description: 'Photorealistic SDXL uncensored checkpoint supporting both standard text-to-image and fine inpainting detail reconstruction.',
    recommendedFilename: 'lustifySDXLNSFW_v20-inpainting.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~6.6 GB',
    downloadUrl: 'https://huggingface.co/andro-flock/LUSTIFY-SDXL-NSFW-checkpoint-v2-0-INPAINTING/resolve/main/lustifySDXLNSFW_v20-inpainting.safetensors',
    recommendedSteps: 25,
    recommendedCfg: 6.0,
    isUncensored: true,
    tags: ['SDXL', 'Inpainting', 'Uncensored', 'Photorealism']
  },
  {
    id: 'flux-vae',
    name: 'FLUX.1 VAE (ae.safetensors)',
    repo: 'black-forest-labs/FLUX.1-schnell',
    architecture: 'FLUX.1',
    category: 'vae',
    description: 'Official 16-channel VAE decoder for FLUX.1 (Schnell / Dev) pipelines.',
    recommendedFilename: 'ae.safetensors',
    targetFolder: 'models/vae',
    size: '~335 MB',
    downloadUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors',
    recommendedSteps: 0,
    recommendedCfg: 0,
    isUncensored: true,
    tags: ['FLUX.1', '16-Channel', 'VAE']
  },
  {
    id: 'flux2-vae',
    name: 'FLUX.2 / Klein 32-Channel VAE',
    repo: 'black-forest-labs/FLUX.2',
    architecture: 'FLUX.2',
    category: 'vae',
    description: 'Dedicated 32-channel VAE decoder required for all FLUX.2 and FLUX.2-Klein diffusion models.',
    recommendedFilename: 'flux2-vae.safetensors',
    targetFolder: 'models/vae',
    size: '~335 MB',
    downloadUrl: 'https://huggingface.co/Comfy-Org/flux2-klein/resolve/main/split_files/vae/flux2-vae.safetensors',
    recommendedSteps: 0,
    recommendedCfg: 0,
    isUncensored: true,
    tags: ['FLUX.2', '32-Channel', 'Klein VAE', 'Core Component']
  },
  {
    id: 'kenerateai-flux-uncensored-lora',
    name: 'KenerateAI FLUX Uncensored LoRA',
    repo: 'kenerateai/Flux-uncensored',
    architecture: 'FLUX.1',
    category: 'lora',
    description: 'High-quality uncensored LoRA adapter designed to remove content restrictions and enable unrestricted artistic generation on FLUX models.',
    recommendedFilename: 'flux_uncensored_kenerate_lora.safetensors',
    targetFolder: 'models/loras',
    size: '~335 MB',
    downloadUrl: 'https://huggingface.co/kenerateai/Flux-uncensored/resolve/main/lora.safetensors',
    recommendedSteps: 4,
    recommendedCfg: 1.0,
    isUncensored: true,
    tags: ['FLUX.1', 'FLUX.2', 'LoRA', 'NSFW/Uncensored', 'Fast']
  },

  // ---------------------------------------------------------------------
  // Starter-pack components. Every repo/filename/size below was verified
  // against the Hugging Face API rather than guessed — a broken URL in a
  // one-click starter pack is worse than no starter pack.
  // ---------------------------------------------------------------------
  {
    id: 'flux2-klein-4b',
    name: 'FLUX.2 Klein 4B (Official)',
    repo: 'black-forest-labs/FLUX.2-klein-4B',
    architecture: 'FLUX.2',
    category: 'unet',
    description: "Black Forest Labs' official FLUX.2 Klein 4B diffusion transformer, full precision. The image model itself — pair it with a text encoder and the FLUX.2 VAE.",
    recommendedFilename: 'flux-2-klein-4b.safetensors',
    targetFolder: 'models/unet',
    size: '7.22 GB',
    downloadUrl: 'https://huggingface.co/black-forest-labs/FLUX.2-klein-4B/resolve/main/flux-2-klein-4b.safetensors',
    recommendedSteps: 4,
    recommendedCfg: 1.0,
    isUncensored: false,
    minVramGB: 12,
    tags: ['FLUX.2', 'Klein 4B', 'Official', 'UNet', 'Full Precision']
  },
  {
    id: 'flux2-klein-4b-fp8',
    name: 'FLUX.2 Klein 4B fp8 (Official, Low VRAM)',
    repo: 'black-forest-labs/FLUX.2-klein-4b-fp8',
    architecture: 'FLUX.2',
    category: 'unet',
    description: 'Official fp8 build of Klein 4B — roughly half the size and VRAM of the full model, with very little quality loss. The right pick for 8 GB cards and under.',
    recommendedFilename: 'flux-2-klein-4b-fp8.safetensors',
    targetFolder: 'models/unet',
    size: '3.79 GB',
    downloadUrl: 'https://huggingface.co/black-forest-labs/FLUX.2-klein-4b-fp8/resolve/main/flux-2-klein-4b-fp8.safetensors',
    recommendedSteps: 4,
    recommendedCfg: 1.0,
    isUncensored: false,
    minVramGB: 6,
    tags: ['FLUX.2', 'Klein 4B', 'Official', 'UNet', 'fp8', 'Low VRAM']
  },
  {
    id: 'qwen3-vl-4b-heretic',
    name: 'Qwen3-VL 4B Heretic Text Encoder',
    repo: 'DreamFast/Qwen3-VL-4b-Heretic-ComfyUI',
    architecture: 'FLUX.2',
    category: 'clip',
    description: 'Qwen3-VL 4B with refusal behaviour removed via the Heretic method, packaged as a single-file text encoder for FLUX.2. Full precision.',
    recommendedFilename: 'qwen3-vl-4b-heretic.safetensors',
    targetFolder: 'models/clip',
    size: '8.27 GB',
    downloadUrl: 'https://huggingface.co/DreamFast/Qwen3-VL-4b-Heretic-ComfyUI/resolve/main/qwen3-vl-4b-heretic.safetensors',
    recommendedSteps: 0,
    recommendedCfg: 0,
    isUncensored: true,
    minVramGB: 12,
    tags: ['FLUX.2', 'Text Encoder', 'Heretic', 'Uncensored', 'Qwen3-VL']
  },
  {
    id: 'qwen3-vl-4b-heretic-fp8',
    name: 'Qwen3-VL 4B Heretic Text Encoder (fp8)',
    repo: 'DreamFast/Qwen3-VL-4b-Heretic-ComfyUI',
    architecture: 'FLUX.2',
    category: 'clip',
    description: 'fp8 build of the Heretic Qwen3-VL 4B text encoder — about half the size, same uncensored behaviour. Pair with the fp8 Klein on smaller GPUs.',
    recommendedFilename: 'qwen3-vl-4b-heretic_fp8_e4m3fn.safetensors',
    targetFolder: 'models/clip',
    size: '4.50 GB',
    downloadUrl: 'https://huggingface.co/DreamFast/Qwen3-VL-4b-Heretic-ComfyUI/resolve/main/qwen3-vl-4b-heretic_fp8_e4m3fn.safetensors',
    recommendedSteps: 0,
    recommendedCfg: 0,
    isUncensored: true,
    minVramGB: 6,
    tags: ['FLUX.2', 'Text Encoder', 'Heretic', 'Uncensored', 'fp8', 'Low VRAM']
  },
  {
    id: 'klein-unchained-v2',
    name: 'KLEIN Unchained V2 (LoRA)',
    repo: 'Keltezaa/KLEIN_Unchained_V2',
    architecture: 'FLUX.2',
    category: 'lora',
    description: 'Optional LoRA for FLUX.2 Klein that loosens content restrictions and pushes realism. Small, and easy to toggle off — add it only if you want it.',
    recommendedFilename: 'KLEIN-Unchained-V2.safetensors',
    targetFolder: 'models/loras',
    size: '311 MB',
    downloadUrl: 'https://huggingface.co/Keltezaa/KLEIN_Unchained_V2/resolve/main/KLEIN-Unchained-V2.safetensors',
    recommendedSteps: 4,
    recommendedCfg: 1.0,
    isUncensored: true,
    minVramGB: 0,
    tags: ['FLUX.2', 'Klein', 'LoRA', 'Uncensored', 'Optional']
  },
  {
    id: 'llama-32-3b-uncensored',
    name: 'Llama 3.2 3B Instruct Uncensored (GGUF)',
    repo: 'bartowski/Llama-3.2-3B-Instruct-uncensored-GGUF',
    architecture: 'LLM',
    category: 'llm',
    description: 'Uncensored Llama 3.2 3B for Chat, Q4_K_M quantised. Fast on almost any modern GPU and usable on CPU alone.',
    recommendedFilename: 'Llama-3.2-3B-Instruct-uncensored-Q4_K_M.gguf',
    targetFolder: 'llm-models',
    size: '2.09 GB',
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-uncensored-GGUF/resolve/main/Llama-3.2-3B-Instruct-uncensored-Q4_K_M.gguf',
    recommendedSteps: 0,
    recommendedCfg: 0,
    isUncensored: true,
    minVramGB: 4,
    tags: ['LLM', 'Llama 3.2', '3B', 'Uncensored', 'GGUF', 'Chat']
  },
  {
    id: 'llama-32-1b-uncensored',
    name: 'Llama 3.2 1B Instruct Uncensored (GGUF)',
    repo: 'mradermacher/Llama-3.2-1B-Instruct-Uncensored-GGUF',
    architecture: 'LLM',
    category: 'llm',
    description: 'The 1B version — smaller and weaker than the 3B, but runs comfortably on low-VRAM GPUs, integrated graphics, or CPU only.',
    recommendedFilename: 'Llama-3.2-1B-Instruct-Uncensored.Q4_K_M.gguf',
    targetFolder: 'llm-models',
    size: '0.81 GB',
    downloadUrl: 'https://huggingface.co/mradermacher/Llama-3.2-1B-Instruct-Uncensored-GGUF/resolve/main/Llama-3.2-1B-Instruct-Uncensored.Q4_K_M.gguf',
    recommendedSteps: 0,
    recommendedCfg: 0,
    isUncensored: true,
    minVramGB: 0,
    tags: ['LLM', 'Llama 3.2', '1B', 'Uncensored', 'GGUF', 'Chat', 'Low VRAM']
  }
];

/** "7.22 GB" / "311 MB" / "~6.6 GB" -> gigabytes as a number. */
export function parseSizeGB(size: string): number {
  const m = size.match(/([\d.]+)\s*(GB|MB)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return /MB/i.test(m[2]) ? n / 1024 : n;
}

export function getPreset(id: string): ModelPreset | undefined {
  return PRESET_MODELS.find(m => m.id === id);
}

export interface StarterPack {
  /** Which Image Studio pipeline this pack sets up. */
  pipeline: 'standard' | 'flux' | 'chat';
  title: string;
  summary: string;
  /** Ordered: each entry explains the role it fills in the pipeline. */
  items: Array<{ preset: ModelPreset; role: string; optional?: boolean }>;
  totalGB: number;
}

/**
 * The first-run recommendation set, chosen for the detected GPU.
 *
 * A fresh install has no models at all, and neither pipeline can produce a
 * single image until the right *combination* is present — the standard
 * pipeline needs one all-in-one checkpoint, while FLUX needs three separate
 * files (diffusion model + text encoder + VAE) that are useless
 * individually. Picking those by hand off Hugging Face is the step most
 * people never get through, so this assembles a known-good set instead.
 *
 * `vramGB` of 0 (unknown/CPU) is treated as a small GPU: the fp8 pack still
 * runs, just slowly, whereas the full-precision pack would simply fail.
 */
export function getStarterPacks(vramGB: number): StarterPack[] {
  // The full-precision FLUX pack is 7.22 GB (Klein 4B) + 8.27 GB (Qwen3-VL
  // encoder) ≈ 15.5 GB of weights, so it wants a 16 GB card; the fp8 pack is
  // 3.79 + 4.50 ≈ 8.3 GB and fits a 12 GB card with room to spare. Note that
  // GPUs report slightly under their marketing size (a "12 GB" 4070 Ti
  // reports 11.99 GiB), so this threshold must never sit exactly on a
  // nominal capacity or those cards land on the wrong side of it.
  const lowVram = vramGB < 16;
  const pick = (id: string) => getPreset(id)!;

  const fluxItems = [
    {
      preset: pick(lowVram ? 'flux2-klein-4b-fp8' : 'flux2-klein-4b'),
      role: 'Diffusion model (UNet) — the image generator itself'
    },
    {
      preset: pick(lowVram ? 'qwen3-vl-4b-heretic-fp8' : 'qwen3-vl-4b-heretic'),
      role: 'Text encoder — turns your prompt into something the model understands'
    },
    {
      preset: pick('flux2-vae'),
      role: 'VAE — decodes the result into a viewable image'
    },
    {
      preset: pick('klein-unchained-v2'),
      role: 'LoRA — optional style/content adapter',
      optional: true
    }
  ];

  const standardItems = [
    {
      preset: pick('realvis-xl-lightning'),
      role: 'All-in-one SDXL checkpoint — no extra files needed'
    }
  ];

  const chatItems = [
    {
      preset: pick(vramGB >= 4 ? 'llama-32-3b-uncensored' : 'llama-32-1b-uncensored'),
      role: 'Chat model (GGUF) for LLM Chat'
    }
  ];

  const total = (items: StarterPack['items']) =>
    Math.round(items.filter(i => !i.optional).reduce((s, i) => s + parseSizeGB(i.preset.size), 0) * 10) / 10;

  return [
    {
      pipeline: 'standard',
      title: 'Standard Checkpoint — fastest start',
      summary: 'One self-contained SDXL file. Generates in 4–6 steps and needs nothing else.',
      items: standardItems,
      totalGB: total(standardItems)
    },
    {
      pipeline: 'flux',
      title: lowVram ? 'FLUX.2 Klein (fp8 — fits smaller GPUs)' : 'FLUX.2 Klein — best quality',
      summary: lowVram
        ? 'Three-part FLUX.2 stack in fp8, sized for GPUs under 12 GB.'
        : 'Full-precision three-part FLUX.2 stack for 12 GB+ GPUs.',
      items: fluxItems,
      totalGB: total(fluxItems)
    },
    {
      pipeline: 'chat',
      title: 'LLM Chat',
      summary: vramGB >= 4
        ? 'Uncensored Llama 3.2 3B — a good default for most machines.'
        : 'Uncensored Llama 3.2 1B — sized for low-VRAM and CPU-only setups.',
      items: chatItems,
      totalGB: total(chatItems)
    }
  ];
}
