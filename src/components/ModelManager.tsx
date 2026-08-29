import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Database, 
  ExternalLink, 
  Check, 
  Copy, 
  HardDrive, 
  FolderCheck, 
  Sparkles,
  Layers,
  Flame,
  FileCode,
  Search,
  RefreshCw,
  Folder,
  Sliders,
  ArrowRight,
  ShieldCheck,
  Globe,
  FileDown,
  X,
  Loader2,
  Cpu
} from 'lucide-react';
import { PRESET_MODELS, ModelPreset } from '../services/modelCatalog';
import { AvailableModels } from '../services/comfyApi';
import { hfHubService, HfModelResult, HfRepoFile, DownloadProgressState } from '../services/hfHubApi';
import { systemModelsService, SystemModelsResult } from '../services/systemModelsApi';

interface ModelManagerProps {
  availableModels: AvailableModels;
  onDownloadModel: (url: string, filename: string, targetFolder: string) => Promise<void>;
  downloadProgress: { [filename: string]: number };
  onNavigateToStudio?: () => void;
  onNavigateToChat?: () => void;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({
  availableModels,
  onDownloadModel,
  downloadProgress,
  onNavigateToStudio,
  onNavigateToChat,
  onSuccess,
  onError
}) => {
  const [activeView, setActiveView] = useState<'installed' | 'catalog' | 'hf-search'>('installed');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customFilename, setCustomFilename] = useState<string>('');
  const [customTargetFolder, setCustomTargetFolder] = useState<string>('models/checkpoints');
  const [downloadingCustom, setDownloadingCustom] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Hugging Face Live Search State
  const [hfQuery, setHfQuery] = useState<string>('Qwen2.5-Coder-7B-Instruct-GGUF');
  const [hfTagFilter, setHfTagFilter] = useState<string>('');
  const [hfResults, setHfResults] = useState<HfModelResult[]>([]);
  const [isHfSearching, setIsHfSearching] = useState<boolean>(false);
  const [selectedHfRepo, setSelectedHfRepo] = useState<string | null>(null);
  const [repoFiles, setRepoFiles] = useState<HfRepoFile[]>([]);
  const [isLoadingRepoFiles, setIsLoadingRepoFiles] = useState<boolean>(false);
  const [fileTargetFolder, setFileTargetFolder] = useState<string>('models/llm');

  // Live Download State from API
  const [activeDownloadState, setActiveDownloadState] = useState<DownloadProgressState>({
    isDownloading: false,
    filename: '',
    repo: '',
    targetFolder: '',
    targetPath: '',
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    speedMBs: 0,
    status: 'idle'
  });

  const [systemModels, setSystemModels] = useState<SystemModelsResult>({
    checkpoints: [],
    unets: [],
    clips: [],
    loras: [],
    vaes: [],
    controlnets: [],
    llms: [],
    scanPaths: []
  });

  const fetchLocalModels = async () => {
    setIsScanning(true);
    try {
      const data = await systemModelsService.fetchSystemModels();
      setSystemModels(data);
    } catch (e) {
      console.error('Failed to scan system models', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleHfSearch = async (queryToSearch?: string, tagToFilter?: string) => {
    const q = queryToSearch !== undefined ? queryToSearch : hfQuery;
    const tag = tagToFilter !== undefined ? tagToFilter : hfTagFilter;
    if (!q.trim() && !tag) return;

    setIsHfSearching(true);
    try {
      const results = await hfHubService.searchModels(q.trim(), tag || undefined, 30);
      setHfResults(results);
    } catch (e: any) {
      onError('Hugging Face Search Failed', e.message || 'Could not query Hugging Face API');
    } finally {
      setIsHfSearching(false);
    }
  };

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

  useEffect(() => {
    fetchLocalModels();
    handleHfSearch('Qwen2.5-Coder-7B-Instruct-GGUF');

    // Poll download progress
    const timer = setInterval(async () => {
      const prog = await hfHubService.getDownloadProgress();
      setActiveDownloadState(prog);
      if (prog.status === 'completed') {
        fetchLocalModels();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const totalLocalCount = 
    systemModels.checkpoints.length + 
    systemModels.unets.length + 
    systemModels.clips.length + 
    systemModels.loras.length + 
    systemModels.vaes.length + 
    systemModels.controlnets.length + 
    systemModels.llms.length;

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

  const handleCustomDownload = async () => {
    if (!customUrl.trim()) {
      onError('Missing URL', 'Please paste a direct HuggingFace or Civitai download link.');
      return;
    }

    let fname = customFilename.trim();
    if (!fname) {
      const parts = customUrl.split('/');
      fname = parts[parts.length - 1].split('?')[0] || 'model.safetensors';
    }

    setDownloadingCustom(true);
    try {
      await onDownloadModel(customUrl.trim(), fname, customTargetFolder);
      onSuccess('Download Initialized', `Started downloading ${fname} to ${customTargetFolder}`);
      setCustomUrl('');
      setCustomFilename('');
      setTimeout(fetchLocalModels, 2000);
    } catch (e: any) {
      onError('Download Failed', e.message || 'Could not start download');
    } finally {
      setDownloadingCustom(false);
    }
  };

  return (
    <div className="model-manager-layout" style={{ height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      {/* HEADER & VIEW TOGGLE */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={24} color="var(--accent)" /> Model Hub & Downloader
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Detecting models across all system drives ({systemModels.scanPaths.length} scan folders active), Hugging Face Hub cache, and workspace folders.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="icon-btn"
              onClick={fetchLocalModels}
              disabled={isScanning}
              title="Rescan models directory on disk"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', fontSize: '13px' }}
            >
              <RefreshCw size={15} className={isScanning ? 'spin-anim' : ''} /> Rescan System
            </button>
          </div>
        </div>

        {/* ACTIVE DOWNLOAD BAR (IF DOWNLOADING) */}
        {activeDownloadState.isDownloading && (
          <div style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="spin-anim" color="var(--accent)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Downloading {activeDownloadState.filename}
                </span>
                <span className="badge-pill" style={{ background: 'rgba(255,255,255,0.1)', fontSize: '11px' }}>
                  📁 {activeDownloadState.targetFolder}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700 }}>
                  {activeDownloadState.speedMBs} MB/s
                </span>
                <button
                  type="button"
                  onClick={() => hfHubService.cancelDownload()}
                  className="icon-btn"
                  title="Cancel Download"
                  style={{ color: '#f87171', padding: '4px 8px', fontSize: '11px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ background: 'var(--accent)', height: '100%', width: `${activeDownloadState.percent}%`, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* TOP VIEW SWITCHER TABS */}
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`tab-pill ${activeView === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveView('installed')}
            style={{ fontSize: '14px', padding: '10px 18px' }}
          >
            <HardDrive size={16} /> 💾 System Installed ({totalLocalCount})
          </button>
          <button
            type="button"
            className={`tab-pill ${activeView === 'hf-search' ? 'active' : ''}`}
            onClick={() => setActiveView('hf-search')}
            style={{ fontSize: '14px', padding: '10px 18px' }}
          >
            <Globe size={16} /> 🔍 Hugging Face Live Search
          </button>
          <button
            type="button"
            className={`tab-pill ${activeView === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveView('catalog')}
            style={{ fontSize: '14px', padding: '10px 18px' }}
          >
            <Sparkles size={16} /> ⚡ Curated Presets
          </button>
        </div>

        {/* Custom URL Downloader */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: '100%', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} color="var(--accent)" /> Direct URL Downloader (HuggingFace / Civitai):
          </div>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Paste direct download URL (e.g. https://huggingface.co/.../model.safetensors)..."
            className="styled-input"
            style={{ flex: '2', minWidth: '260px' }}
          />

          <input
            type="text"
            value={customFilename}
            onChange={(e) => setCustomFilename(e.target.value)}
            placeholder="Filename (optional, e.g. model.safetensors)"
            className="styled-input"
            style={{ flex: '1', minWidth: '160px' }}
          />

          <select
            value={customTargetFolder}
            onChange={(e) => setCustomTargetFolder(e.target.value)}
            className="select-input"
            style={{ width: '180px' }}
          >
            <option value="models/checkpoints">models/checkpoints</option>
            <option value="models/llm">models/llm (Text LLM)</option>
            <option value="models/unet">models/unet (FLUX)</option>
            <option value="models/clip">models/clip (Text Encoders)</option>
            <option value="models/loras">models/loras</option>
            <option value="models/vae">models/vae</option>
            <option value="models/controlnet">models/controlnet</option>
          </select>

          <button
            type="button"
            onClick={handleCustomDownload}
            disabled={downloadingCustom || !customUrl.trim()}
            className="generate-btn"
            style={{ width: 'auto', padding: '0 20px' }}
          >
            <Download size={15} /> Download
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. INSTALLED MODELS VIEW */}
      {/* ========================================================================= */}
      {activeView === 'installed' && (
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
          {[
            { title: '💬 LLM Text Generation Models (llama.cpp)', list: systemModels.llms, isLlm: true },
            { title: '🎯 SDXL & Standalone Checkpoints', list: systemModels.checkpoints },
            { title: '⚡ FLUX UNet Diffusion Models', list: systemModels.unets },
            { title: '🔤 Text Encoders & Conditioners', list: systemModels.clips },
            { title: '✨ Fine-tuned LoRA Models', list: systemModels.loras },
            { title: '🔮 VAE Latent Decoders', list: systemModels.vaes },
            { title: '🕹️ ControlNet Models', list: systemModels.controlnets }
          ].map((cat) => (
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
      )}

      {/* ========================================================================= */}
      {/* 2. HUGGING FACE LIVE SEARCH & EXPLORER VIEW */}
      {/* ========================================================================= */}
      {activeView === 'hf-search' && (
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
                    if (e.key === 'Enter') handleHfSearch();
                  }}
                  placeholder="Search ANY model on Hugging Face (e.g. Qwen2.5-Coder-GGUF, Llama-3, SDXL, Pony, FLUX LoRA)..."
                  className="styled-input"
                  style={{ paddingLeft: '38px', fontSize: '14px', height: '42px' }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleHfSearch()}
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
                    handleHfSearch(chip.q);
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
                {/* Modal Header */}
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

                {/* Target Folder Selector */}
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

                {/* Files List */}
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
      )}

      {/* ========================================================================= */}
      {/* 3. PRESET CATALOG VIEW */}
      {/* ========================================================================= */}
      {activeView === 'catalog' && (
        <>
          {/* FILTER TABS & SEARCH */}
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

          {/* PRESET MODEL CARDS GRID */}
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
      )}
    </div>
  );
};

