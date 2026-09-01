import React, { useState, useEffect, useRef } from 'react';
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

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onImageGenerated,
  onError,
  initialPrompt,
  onGenerateStart,
  onGenerateEnd,
  onGenerateProgress
}) => {
  const [localModels, setLocalModels] = useState<LocalModelsState>({
    checkpoints: [
      { name: 'RealVisXL_V5.0_Lightning_fp16.safetensors', fullPath: 'models/checkpoints/RealVisXL_V5.0_Lightning_fp16.safetensors' },
      { name: 'NSFW-gen-v2.safetensors', fullPath: 'models/checkpoints/NSFW-gen-v2.safetensors' },
    ],
    unets: [{ name: 'flux2-klein-9b-uncensored-q8_0.gguf', fullPath: 'models/unet/flux2-klein-9b-uncensored-q8_0.gguf' }],
    clips: [{ name: 'flux2-klein-9b-uncensored-text-encoder-q8_0.gguf', fullPath: 'models/clip/flux2-klein-9b-uncensored-text-encoder-q8_0.gguf' }],
    loras: [{ name: 'flux_lustly-ai_v1.safetensors', fullPath: 'models/loras/flux_lustly-ai_v1.safetensors' }],
    vaes: [{ name: 'ae.safetensors', fullPath: 'models/vae/ae.safetensors' }]
  });

  const [pipeline, setPipeline] = useState<'standard' | 'flux'>('standard');
  const [checkpointModel, setCheckpointModel] = useState<string>('models/checkpoints/RealVisXL_V5.0_Lightning_fp16.safetensors');
  // Safetensors only — GGUF is reserved for LLM Chat (see reloadLocalModels'
  // noGguf filter below, which is the actual enforcement; these are just
  // sane initial values before the first scan populates real options).
  const [unetModel, setUnetModel] = useState<string>('models/unet/flux-2-klein-base-9b-fp8.safetensors');
  const [clipModel, setClipModel] = useState<string>('models/clip/ponpokeflux2-klein-9b-uncensored-text-encoder.safetensors');
  const [vaeModel, setVaeModel] = useState<string>('models/vae/flux2-vae.safetensors');
  const [activeGpu, setActiveGpu] = useState<string>('');

  // LoRA Stack — no LoRA pre-selected; the user opts in explicitly.
  const [loraModel, setLoraModel] = useState<string>('');
  const [loraStrength, setLoraStrength] = useState<number>(0.85);
  const [useLora, setUseLora] = useState<boolean>(false);

  // Uncensored FLUX.2 text encoders are often full 7-9B LLMs — on a 12GB
  // card that plus even an fp8 diffusion model can exceed VRAM. Off by
  // default (fastest) since not every card/model combo needs it.
  const [offloadTextEncoder, setOffloadTextEncoder] = useState<boolean>(false);

  // Generation Parameters — prompt box always starts empty; it's only ever
  // filled by an explicit user action (typing, or a "send to Image Studio"
  // transfer from Chat/Gallery via initialPrompt) and is cleared again after
  // every successful generation so the next prompt starts fresh.
  const [prompt, setPrompt] = useState<string>(initialPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState<string>(STANDARD_DEFAULT_NEGATIVE_PROMPT);
  const [selectedRatio, setSelectedRatio] = useState<number>(1);
  const [customWidth, setCustomWidth] = useState<number>(1024);
  const [customHeight, setCustomHeight] = useState<number>(1024);
  const [steps, setSteps] = useState<number>(4);
  const [cfg, setCfg] = useState<number>(1.8);
  const [seed, setSeed] = useState<number>(-1);
  const [samplingMethod, setSamplingMethod] = useState<string>('euler_a');

  // State
  const [generating, setGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ step: number; total: number; node?: string }>({ step: 0, total: 4 });
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  // The prompt that produced currentImage — kept separately from the (now
  // always-cleared) `prompt` input state so the canvas can still show/reuse
  // it after the input box resets.
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isReloadingModels, setIsReloadingModels] = useState<boolean>(false);
  const [reloadSuccessMsg, setReloadSuccessMsg] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/hardware-info')
      .then(res => res.json())
      .then(data => {
        if (data.primaryGpu) setActiveGpu(data.primaryGpu);
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
    if (pipeline !== 'flux' || offloadTextEncoder) return;
    const activeRatio = ASPECT_RATIOS[selectedRatio];
    const targetWidth = activeRatio.isCustom ? customWidth : activeRatio.width;
    const targetHeight = activeRatio.isCustom ? customHeight : activeRatio.height;
    if (targetWidth * targetHeight > 512 * 512) {
      setOffloadTextEncoder(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, selectedRatio, customWidth, customHeight]);

  const reloadLocalModels = async () => {
    setIsReloadingModels(true);
    try {
      const res = await fetch('/api/local-models');
      if (res.ok) {
        const data = await res.json();
        if (data) {
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
          setLocalModels({
            checkpoints: toArr(data.checkpoints),
            unets: unetsNoGguf,
            clips: clipsNoGguf,
            loras: toArr(data.loras),
            vaes: toArr(data.vaes)
          });

          if (data.scanStatus) setScanStatus(data.scanStatus);

          // Select first available checkpoint if none or placeholder currently selected
          if (data.checkpoints?.length > 0) {
            setCheckpointModel(prev => {
              const exists = data.checkpoints.some((c: any) => c.fullPath === prev);
              return exists ? prev : data.checkpoints[0].fullPath;
            });
          }
          if (unetsNoGguf.length > 0) {
            setUnetModel(prev => {
              const exists = unetsNoGguf.some((u: any) => u.fullPath === prev);
              return exists ? prev : unetsNoGguf[0].fullPath;
            });
          }

          // Only auto-select a text encoder we're actually confident is
          // one — "q8_0" alone matches almost any quantized GGUF file
          // regardless of what it actually is, and silently falling back
          // to clipsNoGguf[0] risks handing sd-cli a completely incompatible
          // file (wrong tensor layout), surfacing as a cryptic native
          // "tensor not in model metadata" error deep in generation
          // instead of a clear "please pick one" message here.
          const bestClip = clipsNoGguf.find((c: any) => c.name.toLowerCase().includes('text-encoder'));
          if (bestClip) {
            setClipModel(prev => {
              const prevStillValid = clipsNoGguf.some((c: any) => c.fullPath === prev);
              return prevStillValid ? prev : bestClip.fullPath;
            });
          } else if (!clipsNoGguf.some((c: any) => c.fullPath === clipModel)) {
            setClipModel('');
            if (pipeline === 'flux') {
              onError(
                'No Text Encoder Found',
                'FLUX generation needs a safetensors text encoder (a file with "text-encoder" in its name, e.g. flux2-klein-9b-uncensored-text-encoder.safetensors — GGUF text encoders are reserved for LLM Chat). None was found automatically — select one manually in Studio Controls, or switch to the Standalone Checkpoint pipeline.'
              );
            }
          }

          const bestVae = data.vaes?.find((v: any) =>
            v.name.toLowerCase().includes('flux2-vae') || v.name.toLowerCase().includes('ae.')
          ) || data.vaes?.[0];
          if (bestVae) setVaeModel(bestVae.fullPath);

          const count = (data.checkpoints?.length || 0) + unetsNoGguf.length + clipsNoGguf.length + (data.loras?.length || 0) + (data.vaes?.length || 0);
          setReloadSuccessMsg(`Found ${count} models across system`);
          setTimeout(() => setReloadSuccessMsg(null), 4000);
        }
      }
    } catch (e) {
      console.error('Failed to reload models', e);
    } finally {
      setIsReloadingModels(false);
    }
  };

  // Poll scan status while scanning
  useEffect(() => {
    let interval: any;
    if (scanStatus === 'scanning' || scanStatus === 'idle') {
      interval = setInterval(async () => {
        try {
          const r = await fetch('/api/scan-status');
          if (r.ok) {
            const d = await r.json();
            setScanStatus(d.status);
            if (d.status === 'ready') {
              reloadLocalModels();
              clearInterval(interval);
            }
          }
        } catch {}
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [scanStatus]);

  useEffect(() => {
    reloadLocalModels();
  }, []);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // FLUX.2 Klein ships two variants per size: the distilled model (e.g.
  // "flux-2-klein-9b...") wants few steps at cfg~1, while the "base"
  // variant (e.g. "flux-2-klein-base-9b...") is the un-distilled model and
  // needs a real step count and cfg — using distilled settings on a base
  // model doesn't error, it just silently renders malformed output (verified:
  // cfg 1/6 steps produced a warped, non-apple blob from the base 9B model;
  // cfg 4/20 steps from the same file produced a correct, sharp apple).
  const isBaseFluxVariant = (modelPath: string) => /(^|[-_])base([-_]|$)/i.test(
    modelPath.split('/').pop()?.split('\\').pop() || modelPath
  );

  const handlePipelineSwitch = (newPipeline: 'flux' | 'standard') => {
    setPipeline(newPipeline);
    if (newPipeline === 'flux') {
      if (isBaseFluxVariant(unetModel)) {
        setSteps(20);
        setCfg(4.0);
      } else {
        setSteps(6);
        setCfg(1.0);
      }
      setSamplingMethod('euler');
      // FLUX's negative prompt is opt-in — the standard pipeline's SDXL
      // boilerplate (anatomy/watermark negatives) isn't meant for FLUX and
      // would otherwise carry over silently on switch.
      setNegativePrompt(prev => prev === STANDARD_DEFAULT_NEGATIVE_PROMPT ? '' : prev);
    } else {
      setSteps(4);
      setCfg(1.8);
      setSamplingMethod('euler_a');
      setNegativePrompt(prev => prev === '' ? STANDARD_DEFAULT_NEGATIVE_PROMPT : prev);
    }
  };

  const handleUnetModelChange = (modelFullPath: string) => {
    setUnetModel(modelFullPath);
    if (isBaseFluxVariant(modelFullPath)) {
      setSteps(20);
      setCfg(4.0);
    } else {
      setSteps(6);
      setCfg(1.0);
    }
  };

  const handleModelChange = (modelFullPath: string) => {
    setCheckpointModel(modelFullPath);
    const model = modelFullPath.split('/').pop()?.split('\\').pop() || modelFullPath;
    if (model.includes('Lightning') || model.includes('4Steps')) {
      setSteps(4);
      setCfg(1.8);
    } else if (model.includes('NSFW-gen')) {
      setSteps(4);
      setCfg(2.0);
    } else {
      setSteps(20);
      setCfg(7.0);
    }
  };

  const handleAddTag = (tag: string) => {
    if (!prompt.includes(tag)) {
      setPrompt(prev => prev ? `${prev}, ${tag}` : tag);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      onError('Missing Prompt', 'Please write a prompt describing the image you want to create.');
      return;
    }

    setGenerating(true);
    onGenerateStart?.();
    setProgress({ step: 0, total: steps, node: 'stable-diffusion.cpp: Preparing GPU VRAM...' });

    const activeRatio = ASPECT_RATIOS[selectedRatio];
    const targetWidth = activeRatio.isCustom ? customWidth : activeRatio.width;
    const targetHeight = activeRatio.isCustom ? customHeight : activeRatio.height;
    const generatedPrompt = prompt;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await sdCppService.generateImage({
        pipeline,
        modelPath: pipeline === 'flux' ? unetModel : checkpointModel,
        clipPath: pipeline === 'flux' ? clipModel : undefined,
        vaePath: pipeline === 'flux' ? vaeModel : undefined,
        loraPath: useLora && loraModel ? loraModel : undefined,
        loraStrength: useLora ? loraStrength : undefined,
        offloadTextEncoder: pipeline === 'flux' ? offloadTextEncoder : undefined,
        prompt,
        // Optional for both pipelines now — sd-cli's -n applies universally;
        // for FLUX it only has a visible effect once real CFG is active
        // (base-variant models at cfg > 1), a no-op at the distilled cfg 1.0
        // default, harmless either way.
        negativePrompt: negativePrompt.trim() ? negativePrompt : undefined,
        width: targetWidth,
        height: targetHeight,
        steps,
        cfgScale: cfg,
        seed,
        samplingMethod
      }, (step, total, node) => {
        setProgress({ step, total, node });
        onGenerateProgress?.({ step, total });
      }, controller.signal);

      setCurrentImage(result.imageUrl);
      setLastSeed(result.seedUsed);
      setLastGeneratedPrompt(generatedPrompt);
      setPrompt('');

      onImageGenerated({
        id: 'img_' + Date.now(),
        url: result.imageUrl,
        prompt: generatedPrompt,
        negativePrompt,
        model: pipeline === 'flux' ? unetModel : checkpointModel,
        pipeline,
        width: targetWidth,
        height: targetHeight,
        steps,
        cfg,
        seed: result.seedUsed,
        timestamp: Date.now()
      });
    } catch (err: any) {
      if (err.message !== 'Generation cancelled.') {
        onError('GPU Generation Error', err.message || 'An error occurred during inference.');
      }
    } finally {
      abortControllerRef.current = null;
      setGenerating(false);
      onGenerateEnd?.();
    }
  };

  const handleCancelGenerate = () => {
    abortControllerRef.current?.abort();
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = () => {
    if (!currentImage) return;
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = `Solframe_Art_${Date.now()}.png`;
    a.click();
  };

  const handleResetImage = () => {
    setCurrentImage(null);
    setLastSeed(null);
    setLastGeneratedPrompt(null);
  };

  const handleReusePrompt = () => {
    if (lastGeneratedPrompt) setPrompt(lastGeneratedPrompt);
  };

  return (
    <div className="studio-layout">
      <ImageCanvas
        activeGpu={activeGpu}
        checkpointModel={checkpointModel}
        loraModel={loraModel}
        loraStrength={loraStrength}
        useLora={useLora}
        lastSeed={lastSeed}
        currentImage={currentImage}
        lastPrompt={lastGeneratedPrompt}
        generating={generating}
        progress={progress}
        onDownloadImage={handleDownloadImage}
        onCancelGenerate={handleCancelGenerate}
        onResetImage={handleResetImage}
        onReusePrompt={handleReusePrompt}
      />

      <ImageControls
        pipeline={pipeline}
        onPipelineSwitch={handlePipelineSwitch}
        localModels={localModels}
        checkpointModel={checkpointModel}
        onModelChange={handleModelChange}
        unetModel={unetModel}
        setUnetModel={handleUnetModelChange}
        clipModel={clipModel}
        setClipModel={setClipModel}
        vaeModel={vaeModel}
        setVaeModel={setVaeModel}
        useLora={useLora}
        setUseLora={setUseLora}
        loraModel={loraModel}
        setLoraModel={setLoraModel}
        loraStrength={loraStrength}
        setLoraStrength={setLoraStrength}
        offloadTextEncoder={offloadTextEncoder}
        setOffloadTextEncoder={setOffloadTextEncoder}
        prompt={prompt}
        setPrompt={setPrompt}
        negativePrompt={negativePrompt}
        setNegativePrompt={setNegativePrompt}
        promptTags={PROMPT_TAGS}
        onAddTag={handleAddTag}
        aspectRatios={ASPECT_RATIOS}
        selectedRatio={selectedRatio}
        setSelectedRatio={setSelectedRatio}
        customWidth={customWidth}
        setCustomWidth={setCustomWidth}
        customHeight={customHeight}
        setCustomHeight={setCustomHeight}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        samplingMethod={samplingMethod}
        setSamplingMethod={setSamplingMethod}
        steps={steps}
        setSteps={setSteps}
        cfg={cfg}
        setCfg={setCfg}
        seed={seed}
        setSeed={setSeed}
        generating={generating}
        progress={progress}
        onGenerate={handleGenerate}
        isReloadingModels={isReloadingModels}
        reloadSuccessMsg={reloadSuccessMsg}
        onReloadLocalModels={reloadLocalModels}
        copied={copied}
        onCopyPrompt={handleCopyPrompt}
      />
    </div>
  );
};