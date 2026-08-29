import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SystemModelsResult } from '../../services/systemModelsApi';

export interface LocalModelListProps {
  systemModels: SystemModelsResult;
  onNavigateToStudio?: () => void;
  onNavigateToChat?: () => void;
}

export const LocalModelList: React.FC<LocalModelListProps> = ({
  systemModels,
  onNavigateToStudio,
  onNavigateToChat
}) => {
  const categories = [
    { title: '💬 LLM Text Generation Models (llama.cpp)', list: systemModels.llms, isLlm: true },
    { title: '🎯 SDXL & Standalone Checkpoints', list: systemModels.checkpoints },
    { title: '⚡ FLUX UNet Diffusion Models', list: systemModels.unets },
    { title: '🔤 Text Encoders & Conditioners', list: systemModels.clips },
    { title: '✨ Fine-tuned LoRA Models', list: systemModels.loras },
    { title: '🔮 VAE Latent Decoders', list: systemModels.vaes },
    { title: '🕹️ ControlNet Models', list: systemModels.controlnets }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Summary Badges Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LLM Text (GGUF)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>{systemModels.llms.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Checkpoints (SDXL)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{systemModels.checkpoints.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FLUX UNets</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>{systemModels.unets.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Text Encoders</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#f472b6', marginTop: '4px' }}>{systemModels.clips.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LoRA Adapters</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#fb923c', marginTop: '4px' }}>{systemModels.loras.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VAE Decoders</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#4ade80', marginTop: '4px' }}>{systemModels.vaes.length}</div>
        </div>
      </div>

      {/* Detailed Lists by Category */}
      {categories.map((cat) => (
        <div key={cat.title} className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {cat.title} <span className="badge-pill" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: '11px' }}>{cat.list.length}</span>
            </h3>
          </div>

          {cat.list.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
              No models found in this category. Download one from <strong>Hugging Face Live Search</strong> or add a folder path in <strong>Settings</strong>!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {cat.list.map((m) => (
                <div 
                  key={m.fullPath} 
                  style={{ 
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid rgba(255,255,255,0.07)', 
                    padding: '14px', 
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '10px' }}>
                        🟢 Ready ({m.formattedSize})
                      </span>
                      <span className="badge-pill" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: '10px' }}>
                        📍 {m.source}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                      {m.name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={m.fullPath}>
                      {m.fullPath}
                    </span>
                    {cat.isLlm && onNavigateToChat ? (
                      <button
                        type="button"
                        className="bubble-action-btn"
                        onClick={onNavigateToChat}
                        style={{ color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.3)' }}
                      >
                        Chat with llama.cpp <ArrowRight size={12} />
                      </button>
                    ) : onNavigateToStudio ? (
                      <button
                        type="button"
                        className="bubble-action-btn"
                        onClick={onNavigateToStudio}
                        style={{ color: 'var(--accent)', border: '1px solid rgba(6, 182, 212, 0.3)' }}
                      >
                        Open in Studio <ArrowRight size={12} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};