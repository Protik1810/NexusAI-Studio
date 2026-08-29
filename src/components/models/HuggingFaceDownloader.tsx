import React, { useState } from 'react';
import { 
  Download, 
  ExternalLink, 
  Check, 
  Copy, 
  Search, 
  Globe, 
  FileDown, 
  X, 
  Loader2 
} from 'lucide-react';
import { PRESET_MODELS, ModelPreset } from '../../services/modelCatalog';
import { hfHubService, HfModelResult, HfRepoFile } from '../../services/hfHubApi';
import { SystemModelsResult } from '../../services/systemModelsApi';

export interface HuggingFaceDownloaderProps {
  viewMode: 'hf-search' | 'catalog';
  systemModels: SystemModelsResult;
  hfQuery: string;
  setHfQuery: (q: string) => void;
  hfResults: HfModelResult[];
  isHfSearching: boolean;
  onHfSearch: (q?: string, tag?: string) => void;
  onDownloadModel: (url: string, filename: string, targetFolder: string) => Promise<void>;
  downloadProgress: { [filename: string]: number };
  onNavigateToStudio?: () => void;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
}

export const HuggingFaceDownloader: React.FC<HuggingFaceDownloaderProps> = ({
  viewMode,
  systemModels,
  hfQuery,
  setHfQuery,
  hfResults,
  isHfSearching,
  onHfSearch,
  onDownloadModel,
  downloadProgress,
  onNavigateToStudio,
  onSuccess,
  onError
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedHfRepo, setSelectedHfRepo] = useState<string | null>(null);
  const [repoFiles, setRepoFiles] = useState<HfRepoFile[]>([]);
  const [isLoadingRepoFiles, setIsLoadingRepoFiles] = useState<boolean>(false);
  const [fileTargetFolder, setFileTargetFolder] = useState<string>('models/llm');

  const categories = [
    { id: 'all', label: 'All Models' },
    { id: 'llm', label: '💬 LLM Text (GGUF)' },
    { id: 'flux', label: '⚡ FLUX Stack' },
    { id: 'checkpoint', label: '🎯 Checkpoints' },
    { id: 'controlnet', label: '🕹️ ControlNet' },
    { id: 'clip', label: '🔤 Text Encoders' },
    { id: 'lora', label: '✨ LoRAs' },
    { id: 'vae', label: '🔮 VAEs' }
  ];

  const handleOpenRepoFiles = async (repoId: string, suggestedCategory?: string) => {
    setSelectedHfRepo(repoId);
    setIsLoadingRepoFiles(true);

    if (suggestedCategory) {
      setFileTargetFolder(suggestedCategory);
    } else if (repoId.toLowerCase().includes('gguf') || repoId.toLowerCase().includes('instruct') || repoId.toLowerCase().includes('qwen') || repoId.toLowerCase().includes('llama')) {
      setFileTargetFolder('models/llm');
    } else if (repoId.toLowerCase().includes('lora')) {
      setFileTargetFolder('models/loras');
    } else if (repoId.toLowerCase().includes('controlnet')) {
      setFileTargetFolder('models/controlnet');
    } else {
      setFileTargetFolder('models/checkpoints');
    }

    try {
      const files = await hfHubService.getRepoFiles(repoId);
      setRepoFiles(files);
    } catch (e: any) {
      onError('Repo Files Error', e.message || 'Could not list files in this repository');
    } finally {
      setIsLoadingRepoFiles(false);
    }
  };

  const handleDownloadHfFile = async (repo: string, filename: string, targetFolder: string) => {
    try {
      const res = await hfHubService.startDownload(repo, filename, targetFolder);
      if (res.success) {
        onSuccess('Download Started', `Downloading ${filename} to ${targetFolder}`);
        setSelectedHfRepo(null);
      } else {
        onError('Download Error', res.error || 'Failed to start download');
      }
    } catch (e: any) {
      onError('Download Error', e.message || 'Failed to trigger download');
    }
  };

  const isModelInstalled = (model: ModelPreset) => {
    const fname = model.recommendedFilename.toLowerCase();
    const allFiles = [
      ...systemModels.checkpoints,
      ...systemModels.unets,
      ...systemModels.clips,
      ...systemModels.loras,
      ...systemModels.vaes,
      ...systemModels.controlnets,
      ...systemModels.llms
    ].map(f => f.filename.toLowerCase());

    return allFiles.some(f => f === fname || f.includes(fname.replace('.safetensors', '').replace('.gguf', '')));
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPresets = PRESET_MODELS.filter((m) => {
    const matchesCat = selectedCategory === 'all' 
      ? true 
      : selectedCategory === 'flux' 
        ? m.architecture.startsWith('FLUX') 
        : m.category === selectedCategory;

    const matchesSearch = searchQuery === '' || 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.repo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCat && matchesSearch;
  });

  if (viewMode === 'hf-search') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search Header & Query Bar */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={hfQuery}
                onChange={(e) => setHfQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onHfSearch();
                }}
                placeholder="Search ANY model on Hugging Face (e.g. Qwen2.5-Coder-GGUF, Llama-3, SDXL, Pony, FLUX LoRA)..."
                className="styled-input"
                style={{ paddingLeft: '38px', fontSize: '14px', height: '42px' }}
              />
            </div>
            <button
              type="button"
              onClick={() => onHfSearch()}
              disabled={isHfSearching || !hfQuery.trim()}
              className="btn-primary"
              style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
            >
              {isHfSearching ? <Loader2 size={16} className="spin-anim" /> : <Search size={16} />}
              Search HF Hub
            </button>
          </div>

          {/* Quick Filter Queries */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Quick Searches:</span>
            {[
              { label: '💬 Qwen 2.5 Coder GGUF', q: 'Qwen2.5-Coder-7B-Instruct-GGUF' },
              { label: '💬 Llama 3.2 GGUF', q: 'Llama-3.2-3B-Instruct-GGUF' },
              { label: '💬 Dolphin Uncensored GGUF', q: 'Dolphin-2.9.4-llama3.1-8b-GGUF' },
              { label: '🎯 SDXL Lightning', q: 'sdxl-lightning' },
              { label: '🕹️ ControlNet Union SDXL', q: 'controlnet-union-sdxl-1.0' },
              { label: '⚡ FLUX Uncensored', q: 'Flux-uncensored' },
              { label: '🔥 Pony Diffusion', q: 'pony-diffusion' }
            ].map((chip) => (
              <button
                key={chip.q}
                type="button"
                onClick={() => {
                  setHfQuery(chip.q);
                  onHfSearch(chip.q);
                }}
                className="tab-pill"
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        {isHfSearching ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Loader2 size={32} className="spin-anim" color="var(--accent)" />
            <p style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Searching Hugging Face Hub for "{hfQuery}"...
            </p>
          </div>
        ) : hfResults.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Globe size={40} opacity={0.3} style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No models found</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Try searching with different keywords above.</p>
          </div>
        ) : (
          <div className="models-grid">
            {hfResults.map((m) => {
              const isGgufRepo = m.id.toLowerCase().includes('gguf');
              return (
                <div key={m.id} className="model-card glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {isGgufRepo && (
                          <span className="badge-pill" style={{ background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa' }}>
                            💬 GGUF (llama.cpp)
                          </span>
                        )}
                        {m.pipeline_tag && (
                          <span className="badge-pill" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                            {m.pipeline_tag}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span>❤️ {m.likes}</span>
                        <span>⬇️ {m.downloads > 1000 ? `${(m.downloads / 1000).toFixed(1)}k` : m.downloads}</span>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0' }}>
                      {m.name}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      by <strong style={{ color: 'var(--accent)' }}>{m.author}</strong>
                    </div>

                    {m.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {m.tags.slice(0, 5).map((t) => (
                          <span key={t} style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenRepoFiles(m.id, isGgufRepo ? 'models/llm' : undefined)}
                      className="btn-primary"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <FileDown size={14} /> Browse Files & Download
                    </button>

                    <a
                      href={`https://huggingface.co/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="icon-btn"
                      title="View on Hugging Face"
                      style={{ padding: '8px' }}
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* REPO FILE EXPLORER MODAL */}
        {selectedHfRepo && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '750px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileDown size={18} color="var(--accent)" /> Files in {selectedHfRepo}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Select a file to download directly into your local models directory.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHfRepo(null)}
                  className="icon-btn"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Target Folder:
                </span>
                <select
                  value={fileTargetFolder}
                  onChange={(e) => setFileTargetFolder(e.target.value)}
                  className="select-input"
                  style={{ width: '220px', padding: '4px 10px', fontSize: '12px' }}
                >
                  <option value="models/llm">models/llm (Text Generation)</option>
                  <option value="models/checkpoints">models/checkpoints (SDXL)</option>
                  <option value="models/unet">models/unet (FLUX Base)</option>
                  <option value="models/clip">models/clip (Text Encoders)</option>
                  <option value="models/loras">models/loras (LoRA)</option>
                  <option value="models/vae">models/vae (VAEs)</option>
                  <option value="models/controlnet">models/controlnet</option>
                </select>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {isLoadingRepoFiles ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Loader2 size={28} className="spin-anim" color="var(--accent)" />
                    <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>Loading repository files...</p>
                  </div>
                ) : repoFiles.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                    No downloadable model files found in root of this repository.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {repoFiles.map((file) => (
                      <div
                        key={file.path}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '8px'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {file.path}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Size: <strong>{file.formattedSize}</strong> {file.isGguf && '• GGUF Quantization'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadHfFile(selectedHfRepo, file.path, fileTargetFolder)}
                          className="btn-primary"
                          style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                        >
                          <Download size={13} /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Catalog View
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="tab-pill-group">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`tab-pill ${selectedCategory === c.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models or tags..."
            className="styled-input"
            style={{ paddingLeft: '32px', fontSize: '13px' }}
          />
        </div>
      </div>

      <div className="models-grid">
        {filteredPresets.map((model) => {
          const isDownloading = Boolean(downloadProgress[model.recommendedFilename] !== undefined);
          const currentProgress = downloadProgress[model.recommendedFilename] || 0;
          const isInstalled = isModelInstalled(model);

          return (
            <div key={model.id} className="model-card glass-panel" style={{ border: isInstalled ? '1px solid rgba(16, 185, 129, 0.3)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span className="badge-pill" style={{ background: model.architecture.startsWith('FLUX') ? 'rgba(168, 85, 247, 0.2)' : 'rgba(6, 182, 212, 0.2)', color: model.architecture.startsWith('FLUX') ? '#c084fc' : '#22d3ee' }}>
                      {model.architecture}
                    </span>
                    <span className="badge-pill" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                      {model.category.toUpperCase()}
                    </span>
                    {isInstalled && (
                      <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                        🟢 Installed on Disk
                      </span>
                    )}
                    {model.isUncensored && (
                      <span className="badge-pill" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                        Uncensored
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '6px 0 2px 0' }}>
                    {model.name}
                  </h3>
                  <a
                    href={`https://huggingface.co/${model.repo}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                  >
                    {model.repo} <ExternalLink size={11} />
                  </a>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '6px' }}>
                  {model.size}
                </span>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5, margin: '12px 0', flex: 1 }}>
                {model.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', marginBottom: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <div><strong style={{ color: 'var(--text-primary)' }}>Target Folder:</strong> <code>{model.targetFolder}</code></div>
                <div><strong style={{ color: 'var(--text-primary)' }}>Filename:</strong> <code>{model.recommendedFilename}</code></div>
              </div>

              {isDownloading ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', color: 'var(--accent)' }}>
                    <span>Downloading...</span>
                    <span>{currentProgress}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${currentProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isInstalled ? (
                    <button
                      type="button"
                      className="generate-btn"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}
                      onClick={onNavigateToStudio}
                    >
                      <Check size={14} color="#10b981" /> Installed (Open in Studio)
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="generate-btn"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                      onClick={() => onDownloadModel(model.downloadUrl, model.recommendedFilename, model.targetFolder)}
                    >
                      <Download size={14} /> Download to App
                    </button>
                  )}

                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleCopyLink(model.downloadUrl, model.id)}
                    title="Copy Direct Download Link"
                  >
                    {copiedId === model.id ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};