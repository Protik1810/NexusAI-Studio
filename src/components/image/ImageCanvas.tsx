import React, { useState } from 'react';
import { Download, Maximize2, Image as ImageIcon, X, RotateCcw, Repeat, Check } from 'lucide-react';

export interface ImageCanvasProps {
  activeGpu: string;
  checkpointModel: string;
  loraModel: string;
  loraStrength: number;
  useLora: boolean;
  lastSeed: number | null;
  currentImage: string | null;
  lastPrompt?: string | null;
  generating: boolean;
  progress: { step: number; total: number; node?: string };
  onDownloadImage: () => void;
  onCancelGenerate?: () => void;
  onResetImage?: () => void;
  onReusePrompt?: () => void;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  activeGpu,
  checkpointModel,
  loraModel,
  loraStrength,
  useLora,
  lastSeed,
  currentImage,
  lastPrompt,
  generating,
  progress,
  onDownloadImage,
  onCancelGenerate,
  onResetImage,
  onReusePrompt
}) => {
  const [promptReused, setPromptReused] = useState(false);

  const handleReuseClick = () => {
    onReusePrompt?.();
    setPromptReused(true);
    setTimeout(() => setPromptReused(false), 1500);
  };
  return (
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
            <button className="icon-btn" onClick={onDownloadImage} title="Download High-Res PNG">
              <Download size={16} />
            </button>
            <button className="icon-btn" onClick={() => window.open(currentImage, '_blank')} title="View Fullscreen">
              <Maximize2 size={16} />
            </button>
            {onResetImage && (
              <button className="icon-btn" onClick={onResetImage} title="Clear canvas (image stays in Gallery)">
                <RotateCcw size={16} />
              </button>
            )}
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
            {onCancelGenerate && (
              <button
                type="button"
                onClick={onCancelGenerate}
                className="btn-secondary"
                style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
              >
                <X size={14} /> Cancel Generation
              </button>
            )}
          </div>
        ) : currentImage ? (
          <>
            <img
              src={currentImage}
              alt="Generated Art"
              className="rendered-image"
            />
            {lastPrompt && (
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  right: '12px',
                  bottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(10, 12, 20, 0.45)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <p
                  title={lastPrompt}
                  style={{
                    flex: 1,
                    margin: 0,
                    fontSize: '12px',
                    lineHeight: 1.4,
                    color: 'rgba(255, 255, 255, 0.85)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {lastPrompt}
                </p>
                {onReusePrompt && (
                  <button
                    type="button"
                    onClick={handleReuseClick}
                    title="Use this prompt again"
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: promptReused ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: promptReused ? '#34d399' : 'var(--text-primary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '5px 9px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {promptReused ? <Check size={12} /> : <Repeat size={12} />}
                    {promptReused ? 'Loaded' : 'Use Again'}
                  </button>
                )}
              </div>
            )}
          </>
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
  );
};