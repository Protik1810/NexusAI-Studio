import React from 'react';
import { 
  Play, 
  Sparkles, 
  Layers, 
  Sliders, 
  Copy, 
  RefreshCw, 
  Check, 
  Flame, 
  Cpu, 
  ChevronDown 
} from 'lucide-react';
import { SD_CPP_SAMPLERS } from '../../services/stableDiffusionCpp';

export interface AspectRatioOption {
  label: string;
  name: string;
  width: number;
  height: number;
  icon: string;
}

export interface LocalModelItem {
  name: string;
  fullPath: string;
  size?: string;
}

export interface LocalModelsState {
  checkpoints: LocalModelItem[];
  unets: LocalModelItem[];
  clips: LocalModelItem[];
  loras: LocalModelItem[];
  vaes: LocalModelItem[];
}

export interface ImageControlsProps {
  pipeline: 'standard' | 'flux';
  onPipelineSwitch: (p: 'standard' | 'flux') => void;
  localModels: LocalModelsState;
  checkpointModel: string;
  onModelChange: (model: string) => void;
  unetModel: string;
  setUnetModel: (m: string) => void;
  clipModel: string;
  setClipModel: (m: string) => void;
  vaeModel: string;
  setVaeModel: (m: string) => void;
  useLora: boolean;
  setUseLora: (u: boolean) => void;
  loraModel: string;
  setLoraModel: (m: string) => void;
  loraStrength: number;
  setLoraStrength: (s: number) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  negativePrompt: string;
  setNegativePrompt: (n: string) => void;
  promptTags: string[];
  onAddTag: (t: string) => void;
  aspectRatios: AspectRatioOption[];
  selectedRatio: number;
  setSelectedRatio: (r: number) => void;
  showAdvanced: boolean;
  setShowAdvanced: (s: boolean) => void;
  samplingMethod: string;
  setSamplingMethod: (m: string) => void;
  steps: number;
  setSteps: (s: number) => void;
  cfg: number;
  setCfg: (c: number) => void;
  seed: number;
  setSeed: (s: number) => void;
  generating: boolean;
  progress: { step: number; total: number; node?: string };
  onGenerate: () => void;
  isReloadingModels: boolean;
  reloadSuccessMsg: string | null;
  onReloadLocalModels: () => void;
  copied: boolean;
  onCopyPrompt: () => void;
}

export const ImageControls: React.FC<ImageControlsProps> = ({
  pipeline,
  onPipelineSwitch,
  localModels,
  checkpointModel,
  onModelChange,
  unetModel,
  setUnetModel,
  clipModel,
  setClipModel,
  vaeModel,
  setVaeModel,
  useLora,
  setUseLora,
  loraModel,
  setLoraModel,
  loraStrength,
  setLoraStrength,
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  promptTags,
  onAddTag,
  aspectRatios,
  selectedRatio,
  setSelectedRatio,
  showAdvanced,
  setShowAdvanced,
  samplingMethod,
  setSamplingMethod,
  steps,
  setSteps,
  cfg,
  setCfg,
  seed,
  setSeed,
  generating,
  progress,
  onGenerate,
  isReloadingModels,
  reloadSuccessMsg,
  onReloadLocalModels,
  copied,
  onCopyPrompt
}) => {
  return (
    <div className="studio-controls glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="var(--accent)" /> Studio Controls
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onReloadLocalModels}
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
            onClick={() => onPipelineSwitch('standard')}
          >
            <Layers size={14} /> Standalone Checkpoint (Ultra Fast ⚡)
          </button>
          <button
            type="button"
            className={`tab-pill ${pipeline === 'flux' ? 'active' : ''}`}
            onClick={() => onPipelineSwitch('flux')}
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
            onChange={(e) => onModelChange(e.target.value)}
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
            onClick={onCopyPrompt} 
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
        {promptTags.map(tag => (
          <button
            key={tag}
            type="button"
            className="tag-pill"
            onClick={() => onAddTag(tag)}
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
          {aspectRatios.map((r, i) => (
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
          onClick={onGenerate}
          disabled={generating}
        >
          <Play size={18} fill="currentColor" />
          {generating ? 'GPU Processing (Step ' + progress.step + '/' + progress.total + ')...' : 'Generate Artwork'}
        </button>
      </div>
    </div>
  );
};