import React, { useState } from 'react';
import { 
  Images, 
  Download, 
  Copy, 
  Trash2, 
  Maximize2, 
  Sparkles, 
  Check, 
  Image as ImageIcon,
  Send
} from 'lucide-react';

export interface GalleryItem {
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
}

interface GalleryStudioProps {
  gallery: GalleryItem[];
  onDeleteImage: (id: string) => void;
  onReuseSettings: (item: GalleryItem) => void;
}

export const GalleryStudio: React.FC<GalleryStudioProps> = ({
  gallery,
  onDeleteImage,
  onReuseSettings
}) => {
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (url: string, filename?: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `Nexus_Art_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="gallery-layout">
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Images size={22} color="var(--accent)" /> Local Artwork Gallery
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            {gallery.length} masterpieces generated locally on your machine.
          </p>
        </div>
      </div>

      {gallery.length === 0 ? (
        <div className="empty-gallery-state glass-panel">
          <ImageIcon size={48} opacity={0.3} color="var(--accent)" />
          <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600, marginTop: '12px' }}>
            No Artworks Yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '360px', textAlign: 'center' }}>
            Images you generate in the Image Studio will automatically appear in your local persistent gallery.
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {gallery.map((item) => (
            <div 
              key={item.id} 
              className="gallery-card glass-panel"
              onClick={() => setSelectedImage(item)}
            >
              <img src={item.url} alt={item.prompt} className="gallery-thumb" />
              <div className="gallery-card-overlay">
                <p className="gallery-card-prompt">{item.prompt}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span className="badge-pill" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-primary)' }}>
                    {item.width}x{item.height}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="icon-btn" 
                      onClick={() => handleDownload(item.url)} 
                      title="Download"
                    >
                      <Download size={14} />
                    </button>
                    <button 
                      className="icon-btn" 
                      onClick={() => onDeleteImage(item.id)} 
                      title="Delete"
                      style={{ color: '#f87171' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div 
            className="lightbox-content glass-panel" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-image-container">
              <img src={selectedImage.url} alt={selectedImage.prompt} className="lightbox-img" />
            </div>

            <div className="lightbox-details">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="badge-pill" style={{ background: selectedImage.pipeline === 'flux' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(6, 182, 212, 0.2)', color: selectedImage.pipeline === 'flux' ? '#c084fc' : '#22d3ee' }}>
                  {selectedImage.pipeline === 'flux' ? '⚡ FLUX.2 Pipeline' : '🎯 Checkpoint Pipeline'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(selectedImage.timestamp).toLocaleString()}
                </span>
              </div>

              <div style={{ margin: '14px 0' }}>
                <label className="control-label">Prompt</label>
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5, background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                  {selectedImage.prompt}
                </p>
              </div>

              <div className="metadata-spec-grid">
                <div><span className="spec-label">Model:</span> <span className="spec-val">{selectedImage.model}</span></div>
                <div><span className="spec-label">Dimensions:</span> <span className="spec-val">{selectedImage.width} x {selectedImage.height}</span></div>
                <div><span className="spec-label">Sampling Steps:</span> <span className="spec-val">{selectedImage.steps}</span></div>
                <div><span className="spec-label">Guidance / CFG:</span> <span className="spec-val">{selectedImage.cfg}</span></div>
                <div><span className="spec-label">Seed:</span> <span className="spec-val">{selectedImage.seed}</span></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="generate-btn"
                  style={{ flex: 1, padding: '10px 14px' }}
                  onClick={() => {
                    onReuseSettings(selectedImage);
                    setSelectedImage(null);
                  }}
                >
                  <Sparkles size={16} /> Remix / Reuse Settings
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleCopyPrompt(selectedImage.prompt)}
                  title="Copy Prompt"
                >
                  {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleDownload(selectedImage.url)}
                  title="Download PNG"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
