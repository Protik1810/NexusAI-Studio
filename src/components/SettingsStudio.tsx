import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  HardDrive, 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  Flame,
  Bot,
  Zap,
  Info,
  FolderPlus,
  Trash2,
  FolderCheck,
  Folder
} from 'lucide-react';
import { comfyService, ComfyStatus } from '../services/comfyApi';
import { llmService, LLMStatus } from '../services/llmApi';
import { systemModelsService, SystemScanPath, SystemModelsResult } from '../services/systemModelsApi';

interface SettingsStudioProps {
  comfyStatus: ComfyStatus;
  llmStatus: LLMStatus;
  onRefreshStatus: () => Promise<void>;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
}

export const SettingsStudio: React.FC<SettingsStudioProps> = ({
  comfyStatus,
  llmStatus,
  onRefreshStatus,
  onSuccess,
  onError
}) => {
  const [comfyUrl, setComfyUrl] = useState<string>(comfyService.getBaseUrl());
  const [llmUrl, setLlmUrl] = useState<string>(llmService.getBaseUrl());
  const [checking, setChecking] = useState<boolean>(false);

  // System Model Scanning State
  const [scanPaths, setScanPaths] = useState<SystemScanPath[]>([]);
  const [customPaths, setCustomPaths] = useState<string[]>([]);
  const [newPathInput, setNewPathInput] = useState<string>('');
  const [isScanningSystem, setIsScanningSystem] = useState<boolean>(false);
  const [systemModelsData, setSystemModelsData] = useState<SystemModelsResult | null>(null);

  const fetchSystemPathsAndModels = async () => {
    setIsScanningSystem(true);
    try {
      const [pathsData, modelsData] = await Promise.all([
        systemModelsService.getCustomPaths(),
        systemModelsService.fetchSystemModels()
      ]);
      setScanPaths(pathsData.scanPaths || []);
      setCustomPaths(pathsData.customPaths || []);
      setSystemModelsData(modelsData);
    } catch (e) {
      console.error('Failed to scan system paths', e);
    } finally {
      setIsScanningSystem(false);
    }
  };

  useEffect(() => {
    fetchSystemPathsAndModels();
  }, []);

  const handleAddCustomPath = async () => {
    if (!newPathInput.trim()) return;
    try {
      const res = await systemModelsService.addCustomPath(newPathInput.trim());
      if (res.success) {
        onSuccess('Folder Added', `Added ${newPathInput.trim()} to model search paths.`);
        setNewPathInput('');
        fetchSystemPathsAndModels();
      } else {
        onError('Invalid Directory', res.error || 'Could not access or find this directory path on your PC.');
      }
    } catch (e: any) {
      onError('Error Adding Path', e.message);
    }
  };

  const handleRemoveCustomPath = async (dir: string) => {
    try {
      await systemModelsService.removeCustomPath(dir);
      onSuccess('Folder Removed', `Removed ${dir} from search paths.`);
      fetchSystemPathsAndModels();
    } catch (e: any) {
      onError('Error Removing Path', e.message);
    }
  };

  const handleSaveEndpoints = async () => {
    setChecking(true);
    comfyService.setBaseUrl(comfyUrl);
    llmService.setBaseUrl(llmUrl);
    localStorage.setItem('solframe_comfy_url', comfyUrl);
    localStorage.setItem('solframe_llm_url', llmUrl);

    try {
      await onRefreshStatus();
      onSuccess('Endpoints Updated', 'Saved and verified backend connections.');
    } catch (e: any) {
      onError('Connection Test Failed', e.message);
    } finally {
      setChecking(false);
    }
  };

  const totalSystemModelsCount = systemModelsData
    ? (systemModelsData.checkpoints.length +
       systemModelsData.unets.length +
       systemModelsData.clips.length +
       systemModelsData.loras.length +
       systemModelsData.vaes.length +
       systemModelsData.controlnets.length +
       systemModelsData.llms.length)
    : 0;

  return (
    <div className="settings-layout" style={{ height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={22} color="var(--accent)" /> Engine Orchestration & System Model Paths
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Configure AI execution engines, auto-detect all models across your entire PC, and add custom model folders.
        </p>
      </div>

      {/* SYSTEM-WIDE MODEL FOLDERS & DISCOVERY PANEL */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <HardDrive size={18} color="var(--accent)" /> System-Wide Model Storage & Discovery
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Detected <strong>{totalSystemModelsCount} models</strong> across {scanPaths.length} active directories on your system.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSystemPathsAndModels}
            disabled={isScanningSystem}
            className="btn-primary"
            style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={isScanningSystem ? 'spin-anim' : ''} />
            {isScanningSystem ? 'Scanning System...' : '🔄 Rescan All Drives'}
          </button>
        </div>

        {/* Add Custom Directory Input */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            type="text"
            value={newPathInput}
            onChange={(e) => setNewPathInput(e.target.value)}
            placeholder="Add custom folder path (e.g. D:\ComfyUI\models or E:\MyModels or C:\AI)..."
            className="styled-input"
            style={{ flex: 1, fontSize: '13px' }}
          />
          <button
            type="button"
            onClick={handleAddCustomPath}
            disabled={!newPathInput.trim()}
            className="generate-btn"
            style={{ width: 'auto', padding: '0 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FolderPlus size={14} /> Add Folder
          </button>
        </div>

        {/* List of Active Search Paths */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
          {scanPaths.map((sp) => (
            <div
              key={sp.path}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                padding: '10px 14px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <Folder size={13} color="var(--accent)" />
                  <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{sp.label}</strong>
                  <span className="badge-pill" style={{ fontSize: '9px', background: sp.isBuiltIn ? 'rgba(6, 182, 212, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: sp.isBuiltIn ? 'var(--accent)' : '#c084fc' }}>
                    {sp.isBuiltIn ? 'Auto-Detected' : 'Custom'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                  {sp.path}
                </div>
              </div>

              {!sp.isBuiltIn && (
                <button
                  type="button"
                  onClick={() => handleRemoveCustomPath(sp.path)}
                  className="icon-btn"
                  title="Remove this search directory"
                  style={{ color: '#f87171', padding: '4px' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* COMFYUI CONFIG */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="#c084fc" /> Image Generation Engine (ComfyUI)
            </h3>
            <span style={{ fontSize: '12px', color: comfyStatus.connected ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {comfyStatus.connected ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {comfyStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="input-group">
            <label className="control-label">ComfyUI REST & WebSocket Endpoint</label>
            <input
              type="text"
              value={comfyUrl}
              onChange={(e) => setComfyUrl(e.target.value)}
              placeholder="http://127.0.0.1:8188"
              className="styled-input"
            />
          </div>

          {comfyStatus.connected && (
            <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>Hardware Device:</strong> {comfyStatus.device}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Free VRAM:</strong> {comfyStatus.vramFree} / {comfyStatus.vramTotal}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>ComfyUI Version:</strong> {comfyStatus.version}</div>
            </div>
          )}

          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
            <p>💡 <strong>Native sd-cli Engine:</strong></p>
            <p>Direct GPU inference runs automatically via <code>sd-cli.exe</code> on NVIDIA RTX GPUs without requiring external servers.</p>
          </div>
        </div>

        {/* LLM CONFIG */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="#06b6d4" /> LLM Dialogue Engine
            </h3>
            <span style={{ fontSize: '12px', color: llmStatus.connected ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {llmStatus.connected ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {llmStatus.connected ? 'Connected' : 'Ready to Launch'}
            </span>
          </div>

          <div className="input-group">
            <label className="control-label">External OpenAI-Compatible / Ollama URL</label>
            <input
              type="text"
              value={llmUrl}
              onChange={(e) => setLlmUrl(e.target.value)}
              placeholder="http://localhost:1234/v1"
              className="styled-input"
            />
          </div>

          {llmStatus.connected && (
            <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>Engine Type:</strong> {llmStatus.type.toUpperCase()}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Active Model:</strong> {llmStatus.currentModel || 'Default Model'}</div>
            </div>
          )}

          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
            <p>💡 <strong>Native llama.cpp Engine:</strong></p>
            <p>In Chat Studio, select any detected GGUF model and click <strong>'Start Engine (CUDA)'</strong> to run with maximum GPU acceleration.</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleSaveEndpoints}
          disabled={checking}
          className="generate-btn"
          style={{ width: 'auto', padding: '12px 28px' }}
        >
          <RefreshCw size={16} className={checking ? 'spin' : ''} />
          {checking ? 'Testing & Saving...' : 'Save & Test Connection'}
        </button>
      </div>
    </div>
  );
};
