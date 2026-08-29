import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Sparkles, 
  Layers, 
  Sliders, 
  Maximize2, 
  Download, 
  Copy, 
  RefreshCw, 
  Check, 
  Image as ImageIcon,
  Flame,
  Cpu,
  ChevronDown,
  Info
} from 'lucide-react';
import { sdCppService, SD_CPP_SAMPLERS } from '../services/stableDiffusionCpp';
import { AvailableModels, ComfyStatus } from '../services/comfyApi';

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

const ASPECT_RATIOS = [
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
  const [localModels, setLocalModels] = useState<{
    checkpoints: { name: string; fullPath: string; size?: string }[];
    unets: { name: string; fullPath: string; size?: string }[];
    clips: { name: string; fullPath: string; size?: string }[];
    loras: { name: string; fullPath: string; size?: string }[];
    vaes: { name: string; fullPath: string; size?: string }[];
  }>({
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

  // Selected Checkpoint (stores the fullPath for sd-cli)
  const [checkpointModel, setCheckpointModel] = useState<string>('models/checkpoints/RealVisXL_V5.0_Lightning_fp16.safetensors');

  // FLUX Multi-Model Stack (stores fullPaths)
  const [unetModel, setUnetModel] = useState<string>('models/unet/flux2-klein-9b-uncensored-q8_0.gguf');
  const [clipModel, setClipModel] = useState<string>('models/clip/flux2-klein-9b-uncensored-text-encoder-q8_0.gguf');
  const [vaeModel, setVaeModel] = useState<string>('models/vae/flux2-vae.safetensors');

  // Scan status
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'ready' | 'error'>('idle');
  const [scanModelCount, setScanModelCount] = useState<number>(0);
  const [activeGpu, setActiveGpu] = useState<string>('');

  // Fetch hardware on mount
  useEffect(() => {
    fetch('/api/hardware-info')
      .then(res => res.json())
      .then(data => {
        if (data.primaryGpu) setActiveGpu(data.primaryGpu);
      })
      .catch(() => {});
  }, []);


  // LoRA Stack
  const [loraModel, setLoraModel] = useState<string>('flux_lustly-ai_v1.safetensors');
  const [loraStrength, setLoraStrength] = useState<number>(0.85);
  const [useLora, setUseLora] = useState<boolean>(true);

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

  const reloadLocalModels = async () => {
    setIsReloadingModels(true);
    try {
      const res = await fetch('/api/local-models');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          // API now returns [{name, fullPath, size}] objects
          const toArr = (arr: any[]) => arr || [];
          setLocalModels({
            checkpoints: toArr(data.checkpoints),
            unets: toArr(data.unets),
            clips: toArr(data.clips),
            loras: toArr(data.loras),
            vaes: toArr(data.vaes)
          });

          if (data.scanStatus) setScanStatus(data.scanStatus);

          // Set defaults: prefer fullPath
          if (data.checkpoints?.length > 0) {
            setCheckpointModel(data.checkpoints[0].fullPath);
          }
          if (data.unets?.length > 0) {
            setUnetModel(data.unets[0].fullPath);
          }

          // Prioritize GGUF text encoder for FLUX.2-Klein
          const bestClip = data.clips?.find((c: any) =>
            c.name.toLowerCase().includes('text-encoder') || c.name.toLowerCase().includes('q8_0')
          ) || data.clips?.[0];
          if (bestClip) setClipModel(bestClip.fullPath);

          const bestVae = data.vaes?.find((v: any) =>
            v.name.toLowerCase().includes('flux2-vae') || v.name.toLowerCase().includes('ae.')
          ) || data.vaes?.[0];
          if (bestVae) setVaeModel(bestVae.fullPath);

          const count = (data.checkpoints?.length || 0) + (data.unets?.length || 0) + (data.clips?.length || 0) + (data.loras?.length || 0) + (data.vaes?.length || 0);
          setReloadSuccessMsg(`Found ${count} models across system`);
          setScanModelCount(count);
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
    if (scanStatus === 'scanning') {
      interval = setInterval(async () => {
        try {
          const r = await fetch('/api/scan-status');
          if (r.ok) {
            const d = await r.json();
            setScanStatus(d.status);
            setScanModelCount(d.modelCount || 0);
            if (d.status === 'ready') {
              reloadLocalModels(); // refresh with new data
              clearInterval(interval);
            }
          }
        } catch {}
      }, 2000);
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

    try {
      const result = await sdCppService.generateImage({
        pipeline,
        // Pass absolute fullPath directly — backend no longer needs to resolve
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
      });

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
      onError('GPU Generation Error', err.message || 'An error occurred during inference.');
    } finally {
      setGenerating(false);
      onGenerateEnd?.();
    }
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
    a.download = `Nexus_Art_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="studio-layout">
      {/* LEFT: PREVIEW CANVAS */}
      <div className="studio-canvas glass-panel">
        <div className="canvas-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge-pill" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              ⚡ {activeGpu ? `GPU: ${activeGpu}` : 'Engine: stable-diffusion.cpp'}
            </span>
            <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              🟢 {checkpointModel.split('/').pop()?.replace('.safetensors', '') || checkpointModel}
            </span>

            {useLora && loraModel && (
              <span className="badge-pill" style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6' }}>
                ✨ LoRA: {loraModel.replace('.safetensors', '')} ({loraStrength})
              </span>
            )}
            {lastSeed !== null && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Seed: {lastSeed}
              </span>
            )}
          </div>

          {currentImage && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="icon-btn" onClick={handleDownloadImage} title="Download High-Res PNG">
                <Download size={16} />
              </button>
              <button className="icon-btn" onClick={() => window.open(currentImage, '_blank')} title="View Fullscreen">
                <Maximize2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Viewport */}
        <div className="canvas-viewport">
          {generating ? (
            <div className="generating-overlay">
              <div className="futuristic-spinner" />
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {progress.node || 'stable-diffusion.cpp: Synthesizing Latents...'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {progress.total > 0 ? `Step ${progress.step} of ${progress.total}` : 'Executing CUDA/Vulkan C++ Kernels...'}
                </p>
              </div>
              <div className="progress-bar-track">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progress.total > 0 ? (progress.step / progress.total) * 100 : 35}%` }}
                />
              </div>
            </div>
          ) : currentImage ? (
            <img 
              src={currentImage} 
              alt="Generated Art" 
              className="rendered-image"
            />
          ) : (
            <div className="empty-canvas-state">
              <div className="empty-icon-circle">
                <ImageIcon size={48} opacity={0.3} />
              </div>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>
                stable-diffusion.cpp GPU Canvas
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '420px', lineHeight: 1.6 }}>
                <strong>{checkpointModel.split('/').pop()?.replace('.safetensors', '') || ''}</strong>{loraModel ? <> + <strong>{loraModel.split('/').pop()?.replace('.safetensors', '')}</strong></> : ''} ready in GPU memory. Click <strong>Generate Artwork</strong> to create!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: CONTROLS & MODEL CONFIG PANEL */}
      <div className="studio-controls glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent)" /> Studio Controls
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={reloadLocalModels}
              disabled={isReloadingModels}
              title="Reload newly added models from models/ directory"
              style={{
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                color: 'var(--accent-hover)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={12} className={isReloadingModels ? 'spin-anim' : ''} />
              {isReloadingModels ? 'Scanning...' : reloadSuccessMsg || 'Reload Models'}
            </button>
            <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <Cpu size={12} style={{ marginRight: '4px' }} /> RTX 4070 Ti (12GB)
            </span>
          </div>
        </div>

        {/* 1. ARCHITECTURE / PIPELINE SELECTOR */}
        <div className="control-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="control-label" style={{ marginBottom: 0 }}>Pipeline Architecture</label>
          </div>
          <div className="tab-pill-group">
            <button
              type="button"
              className={`tab-pill ${pipeline === 'standard' ? 'active' : ''}`}
              onClick={() => handlePipelineSwitch('standard')}
            >
              <Layers size={14} /> Standalone Checkpoint (Ultra Fast ⚡)
            </button>
            <button
              type="button"
              className={`tab-pill ${pipeline === 'flux' ? 'active' : ''}`}
              onClick={() => handlePipelineSwitch('flux')}
            >
              <Flame size={14} /> Multi-File FLUX Stack
            </button>
          </div>
        </div>

        {/* 2. MODEL SELECTION */}
        {pipeline === 'standard' ? (
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="control-label" style={{ marginBottom: 0 }}>
                Downloaded Checkpoint Model (-m)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {localModels.checkpoints.length} available
              </span>
            </div>
            <select 
              value={checkpointModel} 
              onChange={(e) => handleModelChange(e.target.value)}
              className="select-input"
            >
              {localModels.checkpoints.map(m => (
                <option key={m.fullPath} value={m.fullPath}>🟢 {m.name}{m.size ? ` (${m.size})` : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="model-stack-box">
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="control-label" style={{ fontSize: '11px', marginBottom: 0 }}>
                  FLUX Diffusion UNET (--diffusion-model)
                </label>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {localModels.unets.length} available
                </span>
              </div>
              <select 
                value={unetModel} 
                onChange={(e) => setUnetModel(e.target.value)}
                className="select-input"
              >
                {localModels.unets.map(m => (
                  <option key={m.fullPath} value={m.fullPath}>🟢 {m.name}{m.size ? ` (${m.size})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="control-label" style={{ fontSize: '11px', marginBottom: 0 }}>
                  Text Encoder / LLM (--llm / --clip_l)
                </label>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {localModels.clips.length} available
                </span>
              </div>
              <select 
                value={clipModel} 
                onChange={(e) => setClipModel(e.target.value)}
                className="select-input"
              >
                {localModels.clips.map(m => {
                  const name = m.name;
                  const isGGUF = name.toLowerCase().includes('q8_0') || name.toLowerCase().endsWith('.gguf');
                  const isPonpoke = name.toLowerCase().includes('ponpoke');
                  const isBrokenFP8 = name.toLowerCase().includes('qwen_3_8b_fp8mixed');
                  const label = isGGUF
                    ? `🟢 ${name} (Recommended GGUF Fast)`
                    : isPonpoke
                    ? `🟢 ${name} (Uncensored Full)`
                    : isBrokenFP8
                    ? `⚠️ ${name} (Incompatible ComfyUI FP8)`
                    : `🟢 ${name}`;
                  return (
                    <option key={m.fullPath} value={m.fullPath} style={{ color: isBrokenFP8 ? '#f87171' : 'inherit' }}>
                      {label}{m.size ? ` — ${m.size}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="input-group" style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="control-label" style={{ fontSize: '11px', marginBottom: 0 }}>
                  FLUX VAE Decoder (--vae)
                </label>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {localModels.vaes.length} available
                </span>
              </div>
              <select 
                value={vaeModel} 
                onChange={(e) => setVaeModel(e.target.value)}
                className="select-input"
              >
                {localModels.vaes.map(m => {
                  const name = m.name;
                  const isFlux2 = name.toLowerCase().includes('flux2');
                  const label = isFlux2 ? `🟢 ${name} (32-ch for FLUX.2)` : `🟢 ${name} (16-ch for FLUX.1)`;
                  return (
                    <option key={m.fullPath} value={m.fullPath}>{label}{m.size ? ` — ${m.size}` : ''}</option>
                  );
                })}
              </select>
            </div>

            {clipModel.toLowerCase().includes('qwen_3_8b_fp8mixed') && (
              <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', fontSize: '11px', color: '#fca5a5', lineHeight: 1.4 }}>
                ⚠️ <strong>Incompatible Text Encoder:</strong> <code>qwen_3_8b_fp8mixed.safetensors</code> has a ComfyUI-only tensor format. Please select <strong><code>flux2-klein-9b-uncensored-text-encoder-q8_0.gguf</code></strong> or <strong><code>ponpoke...safetensors</code></strong> above.
              </div>
            )}

            {unetModel.toLowerCase().includes('flux-2') && vaeModel === 'ae.safetensors' && (
              <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '6px', fontSize: '11px', color: '#fde047', lineHeight: 1.4 }}>
                ℹ️ <strong>FLUX.2 Notice:</strong> FLUX.2 Klein requires a 32-channel VAE (<code>flux2-vae.safetensors</code>). For immediate generation without extra downloads, switch to <strong>Standalone Checkpoint</strong> mode (SDXL Lightning).
              </div>
            )}
          </div>
        )}

        {/* 3. LORA SECTION */}
        <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="checkbox" 
                checked={useLora} 
                onChange={(e) => setUseLora(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Apply Uncensored LoRA (--lora)
            </label>
            {useLora && (
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
                Strength: {loraStrength.toFixed(2)}
              </span>
            )}
          </div>

          {useLora && (
            <>
              <select 
                value={loraModel} 
                onChange={(e) => setLoraModel(e.target.value)}
                className="select-input"
                style={{ marginBottom: '8px' }}
              >
                {localModels.loras.map(m => (
                  <option key={m.fullPath} value={m.fullPath}>✨ {m.name}{m.size ? ` (${m.size})` : ''}</option>
                ))}
              </select>
              <input 
                type="range" 
                min="0.1" 
                max="1.5" 
                step="0.05" 
                value={loraStrength} 
                onChange={(e) => setLoraStrength(parseFloat(e.target.value))}
                className="slider-input"
              />
            </>
          )}
        </div>

        {/* 4. PROMPT INPUT */}
        <div className="input-group" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="control-label">Prompt (-p)</label>
            <button 
              type="button" 
              onClick={handleCopyPrompt} 
              style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '2px 6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)} 
            placeholder="Describe your scene in rich detail..."
            rows={4}
            className="styled-textarea"
          />
        </div>

        {/* Quick Tag Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0 12px 0' }}>
          {PROMPT_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              className="tag-pill"
              onClick={() => handleAddTag(tag)}
            >
              + {tag}
            </button>
          ))}
        </div>

        {/* 5. NEGATIVE PROMPT */}
        {pipeline === 'standard' && (
          <div className="input-group" style={{ marginBottom: '12px' }}>
            <label className="control-label">Negative Prompt (-n)</label>
            <textarea 
              value={negativePrompt} 
              onChange={(e) => setNegativePrompt(e.target.value)} 
              rows={2}
              className="styled-textarea"
            />
          </div>
        )}

        {/* 6. ASPECT RATIO SELECTOR */}
        <div className="control-group">
          <label className="control-label">Resolution (-W x -H)</label>
          <div className="ratio-grid">
            {ASPECT_RATIOS.map((r, i) => (
              <button
                key={r.label}
                type="button"
                className={`ratio-btn ${selectedRatio === i ? 'active' : ''}`}
                onClick={() => setSelectedRatio(i)}
              >
                <span style={{ fontSize: '14px' }}>{r.icon}</span>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>{r.width}x{r.height}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 7. ADVANCED ACCORDION */}
        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
          <button 
            type="button"
            className="accordion-header"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              <Sliders size={14} /> stable-diffusion.cpp Parameters
            </span>
            <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showAdvanced && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <div className="input-group">
                <label className="control-label" style={{ fontSize: '11px' }}>Sampling Method</label>
                <select 
                  value={samplingMethod} 
                  onChange={(e) => setSamplingMethod(e.target.value)}
                  className="select-input"
                >
                  {SD_CPP_SAMPLERS.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="control-label">Sampling Steps (--steps): {steps}</label>
                <input 
                  type="range" 
                  min="2" 
                  max="50" 
                  value={steps} 
                  onChange={(e) => setSteps(parseInt(e.target.value))}
                  className="slider-input"
                  style={{ width: '140px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="control-label">CFG Scale (--cfg-scale): {cfg.toFixed(1)}</label>
                <input 
                  type="range" 
                  min="1.0" 
                  max="15.0" 
                  step="0.2"
                  value={cfg} 
                  onChange={(e) => setCfg(parseFloat(e.target.value))}
                  className="slider-input"
                  style={{ width: '140px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="control-label">Seed (-s)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="number" 
                    value={seed} 
                    onChange={(e) => setSeed(parseInt(e.target.value) || -1)}
                    placeholder="-1 for Random"
                    className="select-input"
                    style={{ width: '120px', padding: '6px 10px', fontSize: '12px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setSeed(-1)} 
                    className="icon-btn" 
                    title="Randomize Seed"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 8. GENERATE BUTTON */}
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button
            type="button"
            className="generate-btn"
            onClick={handleGenerate}
            disabled={generating}
          >
            <Play size={18} fill="currentColor" />
            {generating ? 'GPU Processing (Step ' + progress.step + '/' + progress.total + ')...' : 'Generate Artwork'}
          </button>
        </div>
      </div>
    </div>
  );
};
