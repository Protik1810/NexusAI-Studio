import React from 'react';
import { Download, Maximize2, Image as ImageIcon } from 'lucide-react';

export interface ImageCanvasProps {
  activeGpu: string;
  checkpointModel: string;
  loraModel: string;
  loraStrength: number;
  useLora: boolean;
  lastSeed: number | null;
  currentImage: string | null;
  generating: boolean;
  progress: { step: number; total: number; node?: string };
  onDownloadImage: () => void;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  activeGpu,
  checkpointModel,
  loraModel,
  loraStrength,
  useLora,
  lastSeed,
  currentImage,
  generating,
  progress,
  onDownloadImage
}) => {
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
  );
};