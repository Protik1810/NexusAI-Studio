import React, { useState, useEffect } from 'react';
import {
  Settings,
  HardDrive,
  Activity,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Bot,
  Zap,
  Info,
  FolderPlus,
  Trash2,
  FolderCheck,
  Folder,
  Copy,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { LLMStatus } from '../services/llmApi';
import { systemModelsService, SystemScanPath, SystemModelsResult } from '../services/systemModelsApi';
import { agentServerService, AgentServerStatus } from '../services/agentServerApi';

interface SettingsStudioProps {
  llmStatus: LLMStatus;
  onRefreshStatus: () => Promise<void>;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
}

export const SettingsStudio: React.FC<SettingsStudioProps> = ({
  llmStatus,
  onRefreshStatus,
  onSuccess,
  onError
}) => {
  const [checking, setChecking] = useState<boolean>(false);

  // Agent API Server State
  const [agentStatus, setAgentStatus] = useState<AgentServerStatus | null>(null);
  const [agentPortInput, setAgentPortInput] = useState<string>('8765');
  const [isTogglingAgent, setIsTogglingAgent] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const fetchAgentStatus = async () => {
    try {
      const status = await agentServerService.getStatus();
      setAgentStatus(status);
      setAgentPortInput(String(status.port));
    } catch (e) {
      console.error('Failed to fetch agent server status', e);
    }
  };

  useEffect(() => {
    fetchAgentStatus();
  }, []);

  const handleToggleAgentServer = async () => {
    if (!agentStatus) return;
    setIsTogglingAgent(true);
    try {
      const next = await agentServerService.setConfig({ enabled: !agentStatus.enabled });
      setAgentStatus(next);
      onSuccess(
        next.enabled ? 'Agent API Server Started' : 'Agent API Server Stopped',
        next.enabled ? `Listening on http://127.0.0.1:${next.port}` : 'Other programs can no longer reach your engines.'
      );
    } catch (e: any) {
      onError('Agent API Server Error', e.message);
    } finally {
      setIsTogglingAgent(false);
    }
  };

  const handleSaveAgentPort = async () => {
    const port = parseInt(agentPortInput, 10);
    if (!port || port < 1 || port > 65535) {
      onError('Invalid Port', 'Enter a port number between 1 and 65535.');
      return;
    }
    setIsTogglingAgent(true);
    try {
      const next = await agentServerService.setConfig({ port });
      setAgentStatus(next);
      onSuccess('Port Updated', `Agent API Server port set to ${next.port}.`);
    } catch (e: any) {
      onError('Failed to Update Port', e.message);
    } finally {
      setIsTogglingAgent(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    try {
      const apiKey = await agentServerService.regenerateKey();
      setAgentStatus(prev => (prev ? { ...prev, apiKey } : prev));
      onSuccess('API Key Regenerated', 'The previous key no longer works — update any agents using it.');
    } catch (e: any) {
      onError('Failed to Regenerate Key', e.message);
    }
  };

  const handleCopyApiKey = () => {
    if (!agentStatus) return;
    navigator.clipboard.writeText(agentStatus.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

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

  const handleRefreshEngineStatus = async () => {
    setChecking(true);
    try {
      await onRefreshStatus();
      onSuccess('Status Refreshed', 'Re-checked the embedded engine connection.');
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

        {llmStatus.connected && (
          <div style={{ marginBottom: '12px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>Active Model:</strong> {llmStatus.currentModel || 'Default Model'}</div>
          </div>
        )}

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
          <p>💡 <strong>Native llama.cpp Engine:</strong></p>
          <p>In Chat Studio, select any detected GGUF model and click <strong>'Start Engine (CUDA)'</strong> to run with maximum GPU acceleration. Image generation runs the same way, automatically via <code>sd-cli.exe</code> — no external servers required.</p>
        </div>
      </div>

      {/* AGENT API SERVER */}
      <div className="glass-panel" style={{ padding: '20px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#f59e0b" /> Agent API Server
          </h3>
          {agentStatus && (
            <button
              type="button"
              onClick={handleToggleAgentServer}
              disabled={isTogglingAgent}
              className={agentStatus.enabled ? 'btn-danger' : 'btn-primary'}
              style={{ fontSize: '12px', padding: '7px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {agentStatus.running ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              {agentStatus.enabled ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
          Let other local programs and agents use your embedded engines for text and image generation over HTTP —
          an OpenAI-compatible <code>/v1/chat/completions</code> and <code>/v1/images/generations</code> API. Off by default,
          bound to <code>127.0.0.1</code> only, and gated by the API key below.
        </p>

        {agentStatus && (
          <>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 140px' }}>
                <label className="control-label" style={{ fontSize: '11px' }}>Port</label>
                <input
                  type="number"
                  value={agentPortInput}
                  onChange={(e) => setAgentPortInput(e.target.value)}
                  className="styled-input"
                  style={{ fontSize: '13px' }}
                />
              </div>
              <button
                type="button"
                onClick={handleSaveAgentPort}
                disabled={isTogglingAgent || agentPortInput === String(agentStatus.port)}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '9px 14px', borderRadius: '6px' }}
              >
                Save Port
              </button>
              <span style={{ fontSize: '12px', color: agentStatus.running ? '#10b981' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
                {agentStatus.running ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                {agentStatus.running ? `Listening on 127.0.0.1:${agentStatus.port}` : 'Not running'}
              </span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="control-label" style={{ fontSize: '11px' }}>API Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={showApiKey ? agentStatus.apiKey : agentStatus.apiKey.replace(/./g, '•').slice(0, 32)}
                  className="styled-input"
                  style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', flex: 1 }}
                />
                <button type="button" onClick={() => setShowApiKey(v => !v)} className="icon-btn" title={showApiKey ? 'Hide key' : 'Reveal key'}>
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button type="button" onClick={handleCopyApiKey} className="icon-btn" title="Copy key">
                  {copiedKey ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
                <button type="button" onClick={handleRegenerateApiKey} className="icon-btn" title="Regenerate key (invalidates the old one)">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', fontFamily: 'var(--font-mono)', lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre' }}>
{`curl http://127.0.0.1:${agentStatus.port}/v1/chat/completions \\
  -H "Authorization: Bearer ${showApiKey ? agentStatus.apiKey : '<your-api-key>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"your-model.gguf","messages":[{"role":"user","content":"Hi"}]}'`}
            </div>
          </>
        )}
      </div>

      {/* Refresh Button */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleRefreshEngineStatus}
          disabled={checking}
          className="generate-btn"
          style={{ width: 'auto', padding: '12px 28px' }}
        >
          <RefreshCw size={16} className={checking ? 'spin' : ''} />
          {checking ? 'Checking...' : 'Refresh Engine Status'}
        </button>
      </div>
    </div>
  );
};
