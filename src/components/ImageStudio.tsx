import React, { useState, useEffect, useRef } from 'react';
import { sdCppService } from '../services/stableDiffusionCpp';
import { AvailableModels, ComfyStatus } from '../services/comfyApi';
import { ImageCanvas } from './image/ImageCanvas';
import { ImageControls, AspectRatioOption, LocalModelsState } from './image/ImageControls';

interface ImageStudioProps {
  comfyStatus?: ComfyStatus;
  availableModels?: AvailableModels;
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
}

const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '1:1', name: 'Square', width: 512, height: 512, icon: '■' },
  { label: '9:16', name: 'Portrait (Stories)', width: 512, height: 768, icon: '▮' },
  { label: '16:9', name: 'Landscape (Cinematic)', width: 768, height: 512, icon: '▬' },
  { label: '4:3', name: 'Standard Photo', width: 768, height: 576, icon: '▰' },
  { label: '3:2', name: 'Classic 35mm', width: 768, height: 512, icon: '▭' },
  { label: '21:9', name: 'Ultrawide Banner', width: 896, height: 384, icon: '━' }
];

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
  onGenerateEnd
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
  const [unetModel, setUnetModel] = useState<string>('models/unet/flux2-klein-9b-uncensored-q8_0.gguf');
  const [clipModel, setClipModel] = useState<string>('models/clip/flux2-klein-9b-uncensored-text-encoder-q8_0.gguf');
  const [vaeModel, setVaeModel] = useState<string>('models/vae/flux2-vae.safetensors');
  const [activeGpu, setActiveGpu] = useState<string>('');

  // LoRA Stack — no LoRA pre-selected; the user opts in explicitly.
  const [loraModel, setLoraModel] = useState<string>('');
  const [loraStrength, setLoraStrength] = useState<number>(0.85);
  const [useLora, setUseLora] = useState<boolean>(false);

  // Generation Parameters
  const [prompt, setPrompt] = useState<string>(initialPrompt || 'Sensual photorealistic portrait of an alluring woman, intricate realistic skin texture, soft dramatic studio lighting, 8k resolution, raw photo, natural eyes');
  const [negativePrompt, setNegativePrompt] = useState<string>('ugly, distorted, blurry, deformed hands, extra limbs, bad anatomy, cartoon, watermark, signature');
  const [selectedRatio, setSelectedRatio] = useState<number>(1);
  const [steps, setSteps] = useState<number>(4);
  const [cfg, setCfg] = useState<number>(1.8);
  const [seed, setSeed] = useState<number>(-1);
  const [samplingMethod, setSamplingMethod] = useState<string>('euler_a');

  // State
  const [generating, setGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ step: number; total: number; node?: string }>({ step: 0, total: 4 });
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [lastSeed, setLastSeed] = useState<number | null>(null);
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

  const reloadLocalModels = async () => {
    setIsReloadingModels(true);
    try {
      const res = await fetch('/api/local-models');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const toArr = (arr: any[]) => arr || [];
          setLocalModels({
            checkpoints: toArr(data.checkpoints),
            unets: toArr(data.unets),
            clips: toArr(data.clips),
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
          if (data.unets?.length > 0) {
            setUnetModel(prev => {
              const exists = data.unets.some((u: any) => u.fullPath === prev);
              return exists ? prev : data.unets[0].fullPath;
            });
          }

          // Only auto-select a text encoder we're actually confident is
          // one — "q8_0" alone matches almost any quantized GGUF file
          // regardless of what it actually is, and silently falling back
          // to data.clips[0] risks handing sd-cli a completely incompatible
          // file (wrong tensor layout), surfacing as a cryptic native
          // "tensor not in model metadata" error deep in generation
          // instead of a clear "please pick one" message here.
          const bestClip = data.clips?.find((c: any) => c.name.toLowerCase().includes('text-encoder'));
          if (bestClip) {
            setClipModel(prev => {
              const prevStillValid = data.clips.some((c: any) => c.fullPath === prev);
              return prevStillValid ? prev : bestClip.fullPath;
            });
          } else if (!data.clips?.some((c: any) => c.fullPath === clipModel)) {
            setClipModel('');
            if (pipeline === 'flux') {
              onError(
                'No Text Encoder Found',
                'FLUX generation needs a text encoder (a file with "text-encoder" in its name, e.g. flux2-klein-9b-uncensored-text-encoder-q8_0.gguf). None was found automatically — select one manually in Studio Controls, or switch to the Standalone Checkpoint pipeline.'
              );
            }
          }

          const bestVae = data.vaes?.find((v: any) =>
            v.name.toLowerCase().includes('flux2-vae') || v.name.toLowerCase().includes('ae.')
          ) || data.vaes?.[0];
          if (bestVae) setVaeModel(bestVae.fullPath);

          const count = (data.checkpoints?.length || 0) + (data.unets?.length || 0) + (data.clips?.length || 0) + (data.loras?.length || 0) + (data.vaes?.length || 0);
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

  const handlePipelineSwitch = (newPipeline: 'flux' | 'standard') => {
    setPipeline(newPipeline);
    if (newPipeline === 'flux') {
      setSteps(6);
      setCfg(1.0);
      setSamplingMethod('euler');
    } else {
      setSteps(4);
      setCfg(1.8);
      setSamplingMethod('euler_a');
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
        prompt,
        negativePrompt: pipeline === 'standard' ? negativePrompt : undefined,
        width: activeRatio.width,
        height: activeRatio.height,
        steps,
        cfgScale: cfg,
        seed,
        samplingMethod
      }, (step, total, node) => {
        setProgress({ step, total, node });
      }, controller.signal);

      setCurrentImage(result.imageUrl);
      setLastSeed(result.seedUsed);

      onImageGenerated({
        id: 'img_' + Date.now(),
        url: result.imageUrl,
        prompt,
        negativePrompt,
        model: pipeline === 'flux' ? unetModel : checkpointModel,
        pipeline,
        width: activeRatio.width,
        height: activeRatio.height,
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
        generating={generating}
        progress={progress}
        onDownloadImage={handleDownloadImage}
        onCancelGenerate={handleCancelGenerate}
      />

      <ImageControls
        pipeline={pipeline}
        onPipelineSwitch={handlePipelineSwitch}
        localModels={localModels}
        checkpointModel={checkpointModel}
        onModelChange={handleModelChange}
        unetModel={unetModel}
        setUnetModel={setUnetModel}
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
        prompt={prompt}
        setPrompt={setPrompt}
        negativePrompt={negativePrompt}
        setNegativePrompt={setNegativePrompt}
        promptTags={PROMPT_TAGS}
        onAddTag={handleAddTag}
        aspectRatios={ASPECT_RATIOS}
        selectedRatio={selectedRatio}
        setSelectedRatio={setSelectedRatio}
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