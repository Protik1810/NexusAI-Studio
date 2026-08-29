export interface ModelPreset {
  id: string;
  name: string;
  repo: string;
  architecture: 'FLUX.2' | 'FLUX.1' | 'SDXL' | 'SD1.5' | 'Custom';
  category: 'unet' | 'checkpoint' | 'clip' | 'lora' | 'vae' | 'controlnet';
  description: string;
  recommendedFilename: string;
  targetFolder: string;
  size: string;
  downloadUrl: string;
  recommendedSteps: number;
  recommendedCfg: number;
  isUncensored: boolean;
  tags: string[];
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
    id: 'pornmaster-klein-9b',
    name: 'PornMaster Klein 9B',
    repo: 'rectangleworm/PornMaster_Klein-9b',
    architecture: 'FLUX.2',
    category: 'unet',
    description: 'High-power uncensored diffusion model based on FLUX.2 Klein 9B architecture. Delivers exceptional anatomy and photorealism without safety filters.',
    recommendedFilename: 'PornMaster_Klein-9b.safetensors',
    targetFolder: 'models/unet (or models/checkpoints)',
    size: '~9.2 GB',
    downloadUrl: 'https://huggingface.co/rectangleworm/PornMaster_Klein-9b/resolve/main/PornMaster_Klein-9b.safetensors',
    recommendedSteps: 20,
    recommendedCfg: 3.5,
    isUncensored: true,
    tags: ['FLUX.2', '9B', 'Uncensored', 'Photorealistic', 'High Detail']
  },
  {
    id: 'nsfw-gen-v2',
    name: 'NSFW-gen v2',
    repo: 'UnfilteredAI/NSFW-gen-v2',
    architecture: 'Custom',
    category: 'checkpoint',
    description: 'Specialized 3-Billion parameter unfiltered text-to-image generator designed for raw, explicit uncensored concept generation.',
    recommendedFilename: 'NSFW-gen-v2.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~3.1 GB',
    downloadUrl: 'https://huggingface.co/UnfilteredAI/NSFW-gen-v2/resolve/main/NSFW-gen-v2.safetensors',
    recommendedSteps: 25,
    recommendedCfg: 7.0,
    isUncensored: true,
    tags: ['3B Checkpoint', 'Unfiltered', 'NSFW', 'Direct T2I']
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
    recommendedFilename: 'RealVisXL_V5.0_Lightning.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~6.6 GB',
    downloadUrl: 'https://huggingface.co/SG161222/RealVisXL_V5.0_Lightning/resolve/main/RealVisXL_V5.0_Lightning.safetensors',
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
    recommendedFilename: 'pornworks-real-porn-photo-realistic-sdxl.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~6.6 GB',
    downloadUrl: 'https://huggingface.co/Manjushri/pornworks-real-porn-photo-realistic-nsfw-sdxl-and-pony-chekpoint/resolve/main/pornworks_v1.safetensors',
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
    recommendedFilename: 'LUSTIFY-SDXL-NSFW-v2.safetensors',
    targetFolder: 'models/checkpoints',
    size: '~6.6 GB',
    downloadUrl: 'https://huggingface.co/andro-flock/LUSTIFY-SDXL-NSFW-checkpoint-v2-0-INPAINTING/resolve/main/lustify_sdxl_v2.safetensors',
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
  {
    id: 'shauray-flux-uncensored-merged',
    name: 'Shauray FLUX-UNCENSORED Merged Base',
    repo: 'shauray/FLUX-UNCENSORED-merged',
    architecture: 'FLUX.1',
    category: 'unet',
    description: 'Full FLUX.1-dev base model with uncensored weights directly merged into the transformer diffusion UNet.',
    recommendedFilename: 'flux1-dev-uncensored-merged.safetensors',
    targetFolder: 'models/unet',
    size: '~23.8 GB (or Quantized Q4/Q8)',
    downloadUrl: 'https://huggingface.co/shauray/FLUX-UNCENSORED-merged',
    recommendedSteps: 20,
    recommendedCfg: 3.5,
    isUncensored: true,
    tags: ['FLUX.1', 'UNet', 'Merged Base', 'Uncensored']
  }
];
