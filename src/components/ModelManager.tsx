import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Database, 
  HardDrive, 
  Sparkles,
  RefreshCw, 
  Globe, 
  Loader2 
} from 'lucide-react';
import { hfHubService, HfModelResult, DownloadProgressState } from '../services/hfHubApi';
import { systemModelsService, SystemModelsResult } from '../services/systemModelsApi';
import { LocalModelList } from './models/LocalModelList';
import { HuggingFaceDownloader } from './models/HuggingFaceDownloader';

interface ModelManagerProps {
  onDownloadModel: (url: string, filename: string, targetFolder: string) => Promise<void>;
  onNavigateToStudio?: () => void;
  onNavigateToChat?: () => void;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({
  onDownloadModel,
  onNavigateToStudio,
  onNavigateToChat,
  onSuccess,
  onError
}) => {
  const [activeView, setActiveView] = useState<'installed' | 'catalog' | 'hf-search'>('installed');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customFilename, setCustomFilename] = useState<string>('');
  const [customTargetFolder, setCustomTargetFolder] = useState<string>('models/checkpoints');
  const [downloadingCustom, setDownloadingCustom] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Hugging Face Live Search State
  const [hfQuery, setHfQuery] = useState<string>('Qwen2.5-Coder-7B-Instruct-GGUF');
  const [hfResults, setHfResults] = useState<HfModelResult[]>([]);
  const [isHfSearching, setIsHfSearching] = useState<boolean>(false);

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

  // Tracks isDownloading across polls (not React state — this only needs to
  // be read/written inside the interval closure, and using a ref sidesteps
  // that closure capturing a stale value from the effect's first run).
  const wasDownloadingRef = useRef<boolean>(false);

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
    try {
      const data = await systemModelsService.fetchSystemModels();
      setSystemModels(data);
    } catch (e) {
      console.error('Failed to scan system models', e);
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const data = await systemModelsService.triggerRescan();
      setSystemModels(data);
    } catch (e) {
      console.error('Failed to rescan system models', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleHfSearch = async (queryToSearch?: string, tagToFilter?: string) => {
    const q = queryToSearch !== undefined ? queryToSearch : hfQuery;
    if (!q.trim() && !tagToFilter) return;

    setIsHfSearching(true);
    try {
      const results = await hfHubService.searchModels(q.trim(), tagToFilter || undefined, 30);
      setHfResults(results);
    } catch (e: any) {
      onError('Hugging Face Search Failed', e.message || 'Could not query Hugging Face API');
    } finally {
      setIsHfSearching(false);
    }
  };

  useEffect(() => {
    fetchLocalModels();
    handleHfSearch('Qwen2.5-Coder-7B-Instruct-GGUF');

    const timer = setInterval(async () => {
      const prog = await hfHubService.getDownloadProgress();
      const wasDownloading = wasDownloadingRef.current;
      wasDownloadingRef.current = prog.isDownloading;
      setActiveDownloadState(prog);
      if (prog.status === 'completed') {
        handleRescan();
      } else if (prog.status === 'error' && wasDownloading) {
        // The initial POST /api/download-model response always reports
        // success immediately (it just means "started"), since the actual
        // fetch/write happens after the response is sent — this poll is the
        // only place a real failure (404, gated repo, disk full, etc.) is
        // ever visible, so it's the only place that can surface it.
        onError('Download Failed', prog.error || `Could not download ${prog.filename || 'the model'}.`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // The backend tracks a single in-flight download; expose it to
  // HuggingFaceDownloader as a per-filename map so it can show per-card
  // progress without knowing about the underlying single-download API shape.
  const liveDownloadProgress: { [filename: string]: number } = activeDownloadState.isDownloading && activeDownloadState.filename
    ? { [activeDownloadState.filename]: activeDownloadState.percent }
    : {};

  const totalLocalCount =
    systemModels.checkpoints.length + 
    systemModels.unets.length + 
    systemModels.clips.length + 
    systemModels.loras.length + 
    systemModels.vaes.length + 
    systemModels.controlnets.length + 
    systemModels.llms.length;

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
      // The 1s progress poll above already calls handleRescan() once the
      // backend reports status:'completed' — no need for a second, fixed-
      // delay refresh here that would fire well before a multi-GB download
      // actually finishes.
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
              onClick={handleRescan}
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
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {activeDownloadState.percent.toFixed(0)}%
                </span>
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

      {activeView === 'installed' ? (
        <LocalModelList
          systemModels={systemModels}
          onNavigateToStudio={onNavigateToStudio}
          onNavigateToChat={onNavigateToChat}
        />
      ) : (
        <HuggingFaceDownloader
          viewMode={activeView}
          systemModels={systemModels}
          hfQuery={hfQuery}
          setHfQuery={setHfQuery}
          hfResults={hfResults}
          isHfSearching={isHfSearching}
          onHfSearch={handleHfSearch}
          onDownloadModel={onDownloadModel}
          downloadProgress={liveDownloadProgress}
          onNavigateToStudio={onNavigateToStudio}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
};