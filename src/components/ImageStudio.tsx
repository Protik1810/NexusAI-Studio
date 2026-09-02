import React, { useReducer, useEffect, useRef } from 'react';
import { sdCppService } from '../services/stableDiffusionCpp';
import { ImageCanvas } from './image/ImageCanvas';
import { ImageControls, AspectRatioOption, LocalModelsState } from './image/ImageControls';

interface ImageStudioProps {
  onImageGenerated: (image: {
    id: string;
    url: string;
    prompt: string;
    negativePrompt?: string;
    model: string;
    pipeline: string;
    width: number;
    height: number;
    steps: number;
    cfg: number;
    seed: number;
    timestamp: number;
  }) => void;
  onError: (title: string, message: string) => void;
  initialPrompt?: string;
  onGenerateStart?: () => void;
  onGenerateEnd?: () => void;
  onGenerateProgress?: (progress: { step: number; total: number }) => void;
}

const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '1:1', name: 'Square', width: 512, height: 512, icon: '■' },
  { label: '9:16', name: 'Portrait (Stories)', width: 512, height: 768, icon: '▮' },
  { label: '16:9', name: 'Landscape (Cinematic)', width: 768, height: 512, icon: '▬' },
  { label: '4:3', name: 'Standard Photo', width: 768, height: 576, icon: '▰' },
  { label: '3:2', name: 'Classic 35mm', width: 768, height: 512, icon: '▭' },
  { label: '21:9', name: 'Ultrawide Banner', width: 896, height: 384, icon: '━' },
  // Fixed high-resolution presets. Note: these are well above what SDXL/FLUX
  // were trained at (~1024px) — stable-diffusion.cpp has no built-in
  // tiling/hires-fix pass, so direct single-pass generation at these sizes
  // trades off quality (duplicated subjects, artifacts) and needs
  // considerably more VRAM/time as size increases. 4K is the practical
  // ceiling this UI offers, not a quality guarantee.
  { label: '1080p', name: 'Full HD', width: 1920, height: 1080, icon: '🖥' },
  { label: '1440p', name: 'Quad HD', width: 2560, height: 1440, icon: '🖥' },
  { label: '2K', name: 'DCI 2K', width: 2048, height: 1080, icon: '🎬' },
  { label: '4K', name: 'Ultra HD (Max)', width: 3840, height: 2160, icon: '🎬' },
  { label: 'Custom', name: 'Custom Resolution', width: 0, height: 0, icon: '⚙', isCustom: true }
];

// SDXL/checkpoint-style negative-prompt boilerplate — meaningful for the
// standard pipeline's non-distilled samplers, but not something FLUX
// should inherit by default (its own negative prompt is opt-in and starts
// empty, see handlePipelineSwitch).
const STANDARD_DEFAULT_NEGATIVE_PROMPT = 'ugly, distorted, blurry, deformed hands, extra limbs, bad anatomy, cartoon, watermark, signature';

const PROMPT_TAGS = [
  '8k masterpiece',
  'photorealistic raw photograph',
  'hyperdetailed skin texture',
  'cinematic rim lighting',
  'volumetric illumination',
  '85mm portrait lens f/1.4',
  'anatomically perfect',
  'high sensual detail'
];

// FLUX.2 Klein ships two variants per size: the distilled model (e.g.
// "flux-2-klein-9b...") wants few steps at cfg~1, while the "base" variant
// (e.g. "flux-2-klein-base-9b...") is the un-distilled model and needs a
// real step count and cfg — using distilled settings on a base model
// doesn't error, it just silently renders malformed output (verified: cfg
// 1/6 steps produced a warped, non-apple blob from the base 9B model; cfg
// 4/20 steps from the same file produced a correct, sharp apple).
const isBaseFluxVariant = (modelPath: string) => /(^|[-_])base([-_]|$)/i.test(
  modelPath.split('/').pop()?.split('\\').pop() || modelPath
);

interface ImageStudioState {
  localModels: LocalModelsState;
  pipeline: 'standard' | 'flux';
  checkpointModel: string;
  unetModel: string;
  clipModel: string;
  vaeModel: string;
  activeGpu: string;
  loraModel: string;
  loraStrength: number;
  useLora: boolean;
  refImageDataUrl: string | null;
  refImageFileName: string | null;
  offloadTextEncoder: boolean;
  prompt: string;
  negativePrompt: string;
  selectedRatio: number;
  customWidth: number;
  customHeight: number;
  steps: number;
  cfg: number;
  seed: number;
  samplingMethod: string;
  generating: boolean;
  progress: { step: number; total: number; node?: string };
  currentImage: string | null;
  lastSeed: number | null;
  // The prompt that produced currentImage — kept separately from the (now
  // always-cleared) `prompt` field so the canvas can still show/reuse it
  // after the input box resets.
  lastGeneratedPrompt: string | null;
  copied: boolean;
  showAdvanced: boolean;
  isReloadingModels: boolean;
  reloadSuccessMsg: string | null;
  scanStatus: string;
  // A model-scan result can determine, at the moment it lands, that FLUX
  // has no usable text encoder — but the reducer must stay pure (no
  // calling onError directly), so it records the fact here instead and a
  // useEffect below is what actually surfaces it and clears the flag.
  missingTextEncoderWarning: boolean;
}

function initState(initialPrompt?: string): ImageStudioState {
  return {
    localModels: {
      checkpoints: [
        { name: 'RealVisXL_V5.0_Lightning_fp16.safetensors', fullPath: 'models/checkpoints/RealVisXL_V5.0_Lightning_fp16.safetensors' },
        { name: 'NSFW-gen-v2.safetensors', fullPath: 'models/checkpoints/NSFW-gen-v2.safetensors' },
      ],
      unets: [{ name: 'flux2-klein-9b-uncensored-q8_0.gguf', fullPath: 'models/unet/flux2-klein-9b-uncensored-q8_0.gguf' }],
      clips: [{ name: 'flux2-klein-9b-uncensored-text-encoder-q8_0.gguf', fullPath: 'models/clip/flux2-klein-9b-uncensored-text-encoder-q8_0.gguf' }],
      loras: [{ name: 'flux_lustly-ai_v1.safetensors', fullPath: 'models/loras/flux_lustly-ai_v1.safetensors' }],
      vaes: [{ name: 'ae.safetensors', fullPath: 'models/vae/ae.safetensors' }]
    },
    pipeline: 'standard',
    checkpointModel: 'models/checkpoints/RealVisXL_V5.0_Lightning_fp16.safetensors',
    // Safetensors only — GGUF is reserved for LLM Chat (see the
    // MODELS_RELOADED case's noGguf filter, which is the actual
    // enforcement; these are just sane initial values before the first
    // scan populates real options).
    unetModel: 'models/unet/flux-2-klein-base-9b-fp8.safetensors',
    clipModel: 'models/clip/ponpokeflux2-klein-9b-uncensored-text-encoder.safetensors',
    vaeModel: 'models/vae/flux2-vae.safetensors',
    activeGpu: '',
    // LoRA Stack — no LoRA pre-selected; the user opts in explicitly.
    loraModel: '',
    loraStrength: 0.85,
    useLora: false,
    // FLUX Kontext-style reference-image editing — no image pre-attached;
    // the user opts in explicitly. Only meaningful for the flux pipeline
    // (see sdEngine.cjs's buildSdCliArgs, which only pushes -r inside the
    // flux branch).
    refImageDataUrl: null,
    refImageFileName: null,
    // Uncensored FLUX.2 text encoders are often full 7-9B LLMs — on a 12GB
    // card that plus even an fp8 diffusion model can exceed VRAM. Off by
    // default (fastest) since not every card/model combo needs it.
    offloadTextEncoder: false,
    // Generation Parameters — prompt box always starts empty; it's only
    // ever filled by an explicit user action (typing, or a "send to Image
    // Studio" transfer from Chat/Gallery via initialPrompt) and is cleared
    // again after every successful generation so the next prompt starts
    // fresh.
    prompt: initialPrompt || '',
    negativePrompt: STANDARD_DEFAULT_NEGATIVE_PROMPT,
    selectedRatio: 1,
    customWidth: 1024,
    customHeight: 1024,
    steps: 4,
    cfg: 1.8,
    seed: -1,
    samplingMethod: 'euler_a',
    generating: false,
    progress: { step: 0, total: 4 },
    currentImage: null,
    lastSeed: null,
    lastGeneratedPrompt: null,
    copied: false,
    showAdvanced: false,
    isReloadingModels: false,
    reloadSuccessMsg: null,
    scanStatus: 'idle',
    missingTextEncoderWarning: false
  };
}

type Action =
  | { type: 'SET_FIELD'; field: keyof ImageStudioState; value: any }
  | { type: 'RELOAD_START' }
  | { type: 'RELOAD_END' }
  | { type: 'MODELS_RELOADED'; data: any }
  | { type: 'SWITCH_PIPELINE'; pipeline: 'flux' | 'standard' }
  | { type: 'UNET_MODEL_CHANGED'; modelFullPath: string }
  | { type: 'CHECKPOINT_MODEL_CHANGED'; modelFullPath: string }
  | { type: 'ADD_TAG'; tag: string }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_PROGRESS'; progress: { step: number; total: number; node?: string } }
  | { type: 'GENERATE_SUCCESS'; imageUrl: string; seedUsed: number; generatedPrompt: string }
  | { type: 'GENERATE_SETTLED' }
  | { type: 'RESET_IMAGE' }
  | { type: 'REUSE_PROMPT' }
  | { type: 'COPY_PROMPT' }
  | { type: 'COPY_DONE' }
  | { type: 'RELOAD_SUCCESS_MSG_CLEARED' }
  | { type: 'MISSING_TEXT_ENCODER_WARNING_SHOWN' };

function reducer(state: ImageStudioState, action: Action): ImageStudioState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'RELOAD_START':
      return { ...state, isReloadingModels: true };

    case 'RELOAD_END':
      return { ...state, isReloadingModels: false };

    case 'MODELS_RELOADED': {
      const data = action.data;
      const toArr = (arr: any[]) => arr || [];
      // FLUX image generation only uses safetensors unets/text-encoders now
      // — GGUF is reserved for the LLM Chat feature (see PERSONA_PRESETS in
      // llmApi.ts). Filtering here (not in apiRoutes.cjs) keeps the same
      // /api/local-models response still backing /api/local-llm-models'
      // GGUF-clip cross-use for chat; this is the single place both the
      // dropdown rendering and the auto-select fallback below read from.
      const noGguf = (arr: any[]) => toArr(arr).filter(m => !m.name?.toLowerCase().endsWith('.gguf'));
      const unetsNoGguf = noGguf(data.unets);
      const clipsNoGguf = noGguf(data.clips);

      const next: ImageStudioState = {
        ...state,
        localModels: {
          checkpoints: toArr(data.checkpoints),
          unets: unetsNoGguf,
          clips: clipsNoGguf,
          loras: toArr(data.loras),
          vaes: toArr(data.vaes)
        }
      };

      if (data.scanStatus) next.scanStatus = data.scanStatus;

      // Select first available checkpoint if none or placeholder currently selected
      if (data.checkpoints?.length > 0) {
        const exists = data.checkpoints.some((c: any) => c.fullPath === state.checkpointModel);
        next.checkpointModel = exists ? state.checkpointModel : data.checkpoints[0].fullPath;
      }
      if (unetsNoGguf.length > 0) {
        const exists = unetsNoGguf.some((u: any) => u.fullPath === state.unetModel);
        next.unetModel = exists ? state.unetModel : unetsNoGguf[0].fullPath;
      }

      // Only auto-select a text encoder we're actually confident is one —
      // "q8_0" alone matches almost any quantized GGUF file regardless of
      // what it actually is, and silently falling back to clipsNoGguf[0]
      // risks handing sd-cli a completely incompatible file (wrong tensor
      // layout), surfacing as a cryptic native "tensor not in model
      // metadata" error deep in generation instead of a clear "please pick
      // one" message here.
      const bestClip = clipsNoGguf.find((c: any) => c.name.toLowerCase().includes('text-encoder'));
      if (bestClip) {
        const prevStillValid = clipsNoGguf.some((c: any) => c.fullPath === state.clipModel);
        next.clipModel = prevStillValid ? state.clipModel : bestClip.fullPath;
      } else if (!clipsNoGguf.some((c: any) => c.fullPath === state.clipModel)) {
        next.clipModel = '';
        if (state.pipeline === 'flux') next.missingTextEncoderWarning = true;
      }

      const bestVae = data.vaes?.find((v: any) =>
        v.name.toLowerCase().includes('flux2-vae') || v.name.toLowerCase().includes('ae.')
      ) || data.vaes?.[0];
      if (bestVae) next.vaeModel = bestVae.fullPath;

      const count = (data.checkpoints?.length || 0) + unetsNoGguf.length + clipsNoGguf.length + (data.loras?.length || 0) + (data.vaes?.length || 0);
      next.reloadSuccessMsg = `Found ${count} models across system`;

      return next;
    }

    case 'RELOAD_SUCCESS_MSG_CLEARED':
      return { ...state, reloadSuccessMsg: null };

    case 'MISSING_TEXT_ENCODER_WARNING_SHOWN':
      return { ...state, missingTextEncoderWarning: false };

    case 'SWITCH_PIPELINE': {
      const next: ImageStudioState = { ...state, pipeline: action.pipeline };
      if (action.pipeline === 'flux') {
        if (isBaseFluxVariant(state.unetModel)) {
          next.steps = 20;
          next.cfg = 4.0;
        } else {
          next.steps = 6;
          next.cfg = 1.0;
        }
        next.samplingMethod = 'euler';
        // FLUX's negative prompt is opt-in — the standard pipeline's SDXL
        // boilerplate (anatomy/watermark negatives) isn't meant for FLUX
        // and would otherwise carry over silently on switch.
        next.negativePrompt = state.negativePrompt === STANDARD_DEFAULT_NEGATIVE_PROMPT ? '' : state.negativePrompt;
      } else {
        next.steps = 4;
        next.cfg = 1.8;
        next.samplingMethod = 'euler_a';
        next.negativePrompt = state.negativePrompt === '' ? STANDARD_DEFAULT_NEGATIVE_PROMPT : state.negativePrompt;
      }
      return next;
    }

    case 'UNET_MODEL_CHANGED': {
      const next: ImageStudioState = { ...state, unetModel: action.modelFullPath };
      if (isBaseFluxVariant(action.modelFullPath)) {
        next.steps = 20;
        next.cfg = 4.0;
      } else {
        next.steps = 6;
        next.cfg = 1.0;
      }
      return next;
    }

    case 'CHECKPOINT_MODEL_CHANGED': {
      const next: ImageStudioState = { ...state, checkpointModel: action.modelFullPath };
      const model = action.modelFullPath.split('/').pop()?.split('\\').pop() || action.modelFullPath;
      if (model.includes('Lightning') || model.includes('4Steps')) {
        next.steps = 4;
        next.cfg = 1.8;
      } else if (model.includes('NSFW-gen')) {
        next.steps = 4;
        next.cfg = 2.0;
      } else {
        next.steps = 20;
        next.cfg = 7.0;
      }
      return next;
    }

    case 'ADD_TAG':
      if (state.prompt.includes(action.tag)) return state;
      return { ...state, prompt: state.prompt ? `${state.prompt}, ${action.tag}` : action.tag };

    case 'GENERATE_START':
      return { ...state, generating: true, progress: { step: 0, total: state.steps, node: 'stable-diffusion.cpp: Preparing GPU VRAM...' } };

    case 'GENERATE_PROGRESS':
      return { ...state, progress: action.progress };

    case 'GENERATE_SUCCESS':
      return {
        ...state,
        currentImage: action.imageUrl,
        lastSeed: action.seedUsed,
        lastGeneratedPrompt: action.generatedPrompt,
        prompt: ''
      };

    case 'GENERATE_SETTLED':
      return { ...state, generating: false };

    case 'RESET_IMAGE':
      return { ...state, currentImage: null, lastSeed: null, lastGeneratedPrompt: null };

    case 'REUSE_PROMPT':
      return state.lastGeneratedPrompt ? { ...state, prompt: state.lastGeneratedPrompt } : state;

    case 'COPY_PROMPT':
      return { ...state, copied: true };

    case 'COPY_DONE':
      return { ...state, copied: false };

    default:
      return state;
  }
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onImageGenerated,
  onError,
  initialPrompt,
  onGenerateStart,
  onGenerateEnd,
  onGenerateProgress
}) => {
  const [state, dispatch] = useReducer(reducer, initialPrompt, initState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const setField = <K extends keyof ImageStudioState>(field: K, value: ImageStudioState[K]) =>
    dispatch({ type: 'SET_FIELD', field, value });

  useEffect(() => {
    fetch('/api/hardware-info')
      .then(res => res.json())
      .then(data => {
        if (data.primaryGpu) setField('activeGpu', data.primaryGpu);
      })
      .catch(() => {});
  }, []);

  // Auto-enable RAM offload once resolution crosses a safe single-pass
  // budget. Verified directly: the 4B Klein pair's static weights alone
  // (12.4GB) already sit at this card's 12GB capacity, so any compute
  // buffer beyond ~512x512 pushes generation into CUDA's silent VMM paging
  // — measured 40x slower (396s vs 10s at 1024x1024) for the *identical*
  // image. --offload-to-cpu's own docs claim no speed loss once weights
  // already fit, so enabling it a bit earlier than the bare minimum is
  // close to free. offloadTextEncoder is deliberately left out of the dep
  // array: this only ever flips it ON, so a user who manually turns it back
  // off for a resolution they've confirmed works isn't fought until they
  // change the resolution again.
  useEffect(() => {
    if (state.pipeline !== 'flux' || state.offloadTextEncoder) return;
    const activeRatio = ASPECT_RATIOS[state.selectedRatio];
    const targetWidth = activeRatio.isCustom ? state.customWidth : activeRatio.width;
    const targetHeight = activeRatio.isCustom ? state.customHeight : activeRatio.height;
    if (targetWidth * targetHeight > 512 * 512) {
      setField('offloadTextEncoder', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pipeline, state.selectedRatio, state.customWidth, state.customHeight]);

  const reloadLocalModels = async () => {
    dispatch({ type: 'RELOAD_START' });
    try {
      const res = await fetch('/api/local-models');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          dispatch({ type: 'MODELS_RELOADED', data });
          setTimeout(() => dispatch({ type: 'RELOAD_SUCCESS_MSG_CLEARED' }), 4000);
        }
      }
    } catch (e) {
      console.error('Failed to reload models', e);
    } finally {
      dispatch({ type: 'RELOAD_END' });
    }
  };

  // Poll scan status while scanning
  useEffect(() => {
    let interval: any;
    if (state.scanStatus === 'scanning' || state.scanStatus === 'idle') {
      interval = setInterval(async () => {
        try {
          const r = await fetch('/api/scan-status');
          if (r.ok) {
            const d = await r.json();
            setField('scanStatus', d.status);
            if (d.status === 'ready') {
              reloadLocalModels();
              clearInterval(interval);
            }
          }
        } catch {}
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [state.scanStatus]);

  useEffect(() => {
    reloadLocalModels();
  }, []);

  useEffect(() => {
    if (initialPrompt) {
      setField('prompt', initialPrompt);
    }
  }, [initialPrompt]);

  // The reducer decides (inside MODELS_RELOADED) whether a scan result
  // leaves FLUX without a usable text encoder, but must stay pure — this
  // effect is what actually surfaces that as a user-facing error, then
  // acknowledges the flag so it doesn't fire again on every re-render.
  useEffect(() => {
    if (state.missingTextEncoderWarning) {
      onError(
        'No Text Encoder Found',
        'FLUX generation needs a safetensors text encoder (a file with "text-encoder" in its name, e.g. flux2-klein-9b-uncensored-text-encoder.safetensors — GGUF text encoders are reserved for LLM Chat). None was found automatically — select one manually in Studio Controls, or switch to the Standalone Checkpoint pipeline.'
      );
      dispatch({ type: 'MISSING_TEXT_ENCODER_WARNING_SHOWN' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.missingTextEncoderWarning]);

  const handlePipelineSwitch = (newPipeline: 'flux' | 'standard') => {
    dispatch({ type: 'SWITCH_PIPELINE', pipeline: newPipeline });
  };

  const handleUnetModelChange = (modelFullPath: string) => {
    dispatch({ type: 'UNET_MODEL_CHANGED', modelFullPath });
  };

  const handleModelChange = (modelFullPath: string) => {
    dispatch({ type: 'CHECKPOINT_MODEL_CHANGED', modelFullPath });
  };

  const handleAddTag = (tag: string) => {
    dispatch({ type: 'ADD_TAG', tag });
  };

  const handleGenerate = async () => {
    if (!state.prompt.trim()) {
      onError('Missing Prompt', 'Please write a prompt describing the image you want to create.');
      return;
    }

    dispatch({ type: 'GENERATE_START' });
    onGenerateStart?.();

    const activeRatio = ASPECT_RATIOS[state.selectedRatio];
    const targetWidth = activeRatio.isCustom ? state.customWidth : activeRatio.width;
    const targetHeight = activeRatio.isCustom ? state.customHeight : activeRatio.height;
    const generatedPrompt = state.prompt;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await sdCppService.generateImage({
        pipeline: state.pipeline,
        modelPath: state.pipeline === 'flux' ? state.unetModel : state.checkpointModel,
        clipPath: state.pipeline === 'flux' ? state.clipModel : undefined,
        vaePath: state.pipeline === 'flux' ? state.vaeModel : undefined,
        loraPath: state.useLora && state.loraModel ? state.loraModel : undefined,
        loraStrength: state.useLora ? state.loraStrength : undefined,
        offloadTextEncoder: state.pipeline === 'flux' ? state.offloadTextEncoder : undefined,
        refImageDataUrl: state.pipeline === 'flux' ? (state.refImageDataUrl || undefined) : undefined,
        prompt: state.prompt,
        // Optional for both pipelines now — sd-cli's -n applies universally;
        // for FLUX it only has a visible effect once real CFG is active
        // (base-variant models at cfg > 1), a no-op at the distilled cfg 1.0
        // default, harmless either way.
        negativePrompt: state.negativePrompt.trim() ? state.negativePrompt : undefined,
        width: targetWidth,
        height: targetHeight,
        steps: state.steps,
        cfgScale: state.cfg,
        seed: state.seed,
        samplingMethod: state.samplingMethod
      }, (step, total, node) => {
        dispatch({ type: 'GENERATE_PROGRESS', progress: { step, total, node } });
        onGenerateProgress?.({ step, total });
      }, controller.signal);

      dispatch({ type: 'GENERATE_SUCCESS', imageUrl: result.imageUrl, seedUsed: result.seedUsed, generatedPrompt });

      onImageGenerated({
        id: 'img_' + Date.now(),
        url: result.imageUrl,
        prompt: generatedPrompt,
        negativePrompt: state.negativePrompt,
        model: state.pipeline === 'flux' ? state.unetModel : state.checkpointModel,
        pipeline: state.pipeline,
        width: targetWidth,
        height: targetHeight,
        steps: state.steps,
        cfg: state.cfg,
        seed: result.seedUsed,
        timestamp: Date.now()
      });
    } catch (err: any) {
      if (err.message !== 'Generation cancelled.') {
        onError('GPU Generation Error', err.message || 'An error occurred during inference.');
      }
    } finally {
      abortControllerRef.current = null;
      dispatch({ type: 'GENERATE_SETTLED' });
      onGenerateEnd?.();
    }
  };

  const handleCancelGenerate = () => {
    abortControllerRef.current?.abort();
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(state.prompt);
    dispatch({ type: 'COPY_PROMPT' });
    setTimeout(() => dispatch({ type: 'COPY_DONE' }), 2000);
  };

  const handleDownloadImage = () => {
    if (!state.currentImage) return;
    const a = document.createElement('a');
    a.href = state.currentImage;
    a.download = `Solframe_Art_${Date.now()}.png`;
    a.click();
  };

  const handleResetImage = () => {
    dispatch({ type: 'RESET_IMAGE' });
  };

  const handleReusePrompt = () => {
    dispatch({ type: 'REUSE_PROMPT' });
  };

  return (
    <div className="studio-layout">
      <ImageCanvas
        activeGpu={state.activeGpu}
        checkpointModel={state.checkpointModel}
        loraModel={state.loraModel}
        loraStrength={state.loraStrength}
        useLora={state.useLora}
        lastSeed={state.lastSeed}
        currentImage={state.currentImage}
        lastPrompt={state.lastGeneratedPrompt}
        generating={state.generating}
        progress={state.progress}
        onDownloadImage={handleDownloadImage}
        onCancelGenerate={handleCancelGenerate}
        onResetImage={handleResetImage}
        onReusePrompt={handleReusePrompt}
      />

      <ImageControls
        activeGpu={state.activeGpu}
        pipeline={state.pipeline}
        onPipelineSwitch={handlePipelineSwitch}
        localModels={state.localModels}
        checkpointModel={state.checkpointModel}
        onModelChange={handleModelChange}
        unetModel={state.unetModel}
        setUnetModel={handleUnetModelChange}
        clipModel={state.clipModel}
        setClipModel={(m) => setField('clipModel', m)}
        vaeModel={state.vaeModel}
        setVaeModel={(m) => setField('vaeModel', m)}
        useLora={state.useLora}
        setUseLora={(u) => setField('useLora', u)}
        loraModel={state.loraModel}
        setLoraModel={(m) => setField('loraModel', m)}
        loraStrength={state.loraStrength}
        setLoraStrength={(s) => setField('loraStrength', s)}
        offloadTextEncoder={state.offloadTextEncoder}
        setOffloadTextEncoder={(o) => setField('offloadTextEncoder', o)}
        refImageDataUrl={state.refImageDataUrl}
        setRefImageDataUrl={(d) => setField('refImageDataUrl', d)}
        refImageFileName={state.refImageFileName}
        setRefImageFileName={(n) => setField('refImageFileName', n)}
        prompt={state.prompt}
        setPrompt={(p) => setField('prompt', p)}
        negativePrompt={state.negativePrompt}
        setNegativePrompt={(n) => setField('negativePrompt', n)}
        promptTags={PROMPT_TAGS}
        onAddTag={handleAddTag}
        aspectRatios={ASPECT_RATIOS}
        selectedRatio={state.selectedRatio}
        setSelectedRatio={(r) => setField('selectedRatio', r)}
        customWidth={state.customWidth}
        setCustomWidth={(w) => setField('customWidth', w)}
        customHeight={state.customHeight}
        setCustomHeight={(h) => setField('customHeight', h)}
        showAdvanced={state.showAdvanced}
        setShowAdvanced={(s) => setField('showAdvanced', s)}
        samplingMethod={state.samplingMethod}
        setSamplingMethod={(m) => setField('samplingMethod', m)}
        steps={state.steps}
        setSteps={(s) => setField('steps', s)}
        cfg={state.cfg}
        setCfg={(c) => setField('cfg', c)}
        seed={state.seed}
        setSeed={(s) => setField('seed', s)}
        generating={state.generating}
        progress={state.progress}
        onGenerate={handleGenerate}
        isReloadingModels={state.isReloadingModels}
        reloadSuccessMsg={state.reloadSuccessMsg}
        onReloadLocalModels={reloadLocalModels}
        copied={state.copied}
        onCopyPrompt={handleCopyPrompt}
      />
    </div>
  );
};
