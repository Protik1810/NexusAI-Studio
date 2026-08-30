import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Cpu, 
  HardDrive, 
  ShieldCheck, 
  Zap, 
  Code2, 
  Heart, 
  Globe, 
  Layers, 
  Image as ImageIcon, 
  MessageSquare, 
  Database, 
  CheckCircle2, 
  Terminal,
  Activity,
  Palette
} from 'lucide-react';
import pkg from '../../package.json';
import { AppThemeId, APP_THEMES } from './ThemeModal';

const APP_VERSION = pkg.version;

interface HardwareInfo {
  gpus: Array<{
    name: string;
    vendor: string;
    vram: string;
    vramMB: number;
    driver: string;
    isNvidia: boolean;
    backend: string;
  }>;
  preferredBackend: string;
  primaryGpu: string;
  os: string;
  nodeVersion: string;
}

interface LibraryFile {
  name: string;
  defaultRelativePath: string;
  absolutePath: string;
  exists: boolean;
  sizeMB: string;
  required: boolean;
}

interface LibraryEngine {
  id: string;
  name: string;
  category: string;
  description: string;
  requiredFor: string;
  installed: boolean;
  files: LibraryFile[];
}

export const AboutStudio: React.FC = () => {
  const activeThemeMeta = APP_THEMES.find((t) => t.id === (localStorage.getItem('solframe-theme') as AppThemeId)) || APP_THEMES[0];
  const [hwInfo, setHwInfo] = useState<HardwareInfo | null>(null);
  const [modelStats, setModelStats] = useState<{ totalModels: number; scanPathsCount: number }>({
    totalModels: 0,
    scanPathsCount: 0
  });
  const [libraryData, setLibraryData] = useState<{
    libraries: LibraryEngine[];
    allReady: boolean;
    missingCount: number;
  } | null>(null);
  const COMPLETE_INSTALLER_URL = `https://github.com/Protik1810/Solframe-Studio/releases/download/v${APP_VERSION}/Solframe-Studio-Setup-${APP_VERSION}.exe`;

  const fetchLibrariesStatus = () => {
    fetch('/api/libraries-status')
      .then(res => res.json())
      .then(data => {
        setLibraryData({
          libraries: data.libraries || [],
          allReady: data.allReady,
          missingCount: data.missingCount || 0
        });
        if (data.hardware) setHwInfo(data.hardware);
      })
      .catch(() => {});
  };

  useEffect(() => {
    // Fetch hardware & libraries status
    fetchLibrariesStatus();

    // Fetch model stats
    fetch('/api/scan-status')
      .then(res => res.json())
      .then(data => {
        setModelStats({
          totalModels: data.modelCount || 0,
          scanPathsCount: data.total || 0
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* ─── Hero Brand Header ─────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '36px', display: 'flex', alignItems: 'center', gap: '28px', position: 'relative', overflow: 'hidden', flexWrap: 'wrap' }}>
        {/* Background Ambient Glow */}
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '260px', height: '260px', background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{
          width: '96px',
          height: '96px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary, #8b5cf6) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 35px var(--accent-glow)',
          overflow: 'hidden',
          border: '2px solid rgba(255, 255, 255, 0.25)',
          flexShrink: 0
        }}>
          <img
            src={activeThemeMeta.emblem}
            alt="Solframe Studio Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.png';
              (e.currentTarget as HTMLImageElement).style.objectFit = 'cover';
              (e.currentTarget as HTMLImageElement).style.padding = '0';
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Solframe Studio
            </h1>
            <span className="badge-pill" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent)', border: '1px solid rgba(6, 182, 212, 0.3)', fontSize: '11px', padding: '4px 10px' }}>
              v{APP_VERSION} Production Release
            </span>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 14px 0' }}>
            A sovereign, privacy-first desktop generative AI studio combining <strong>FLUX.2 & SDXL Lightning</strong> image synthesis with <strong>llama.cpp GGUF</strong> dialogue engines.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <ShieldCheck size={12} /> 100% Offline & Private
            </span>
            <span className="badge-pill" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <Zap size={12} /> CUDA & Vulkan GPU Acceleration
            </span>
            <span className="badge-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <Sparkles size={12} /> Universal Model Scanner
            </span>
          </div>
        </div>
      </div>

      {/* ─── Creator & Lead Architect Spotlight ────────────────────────── */}
      <div className="glass-panel" style={{ padding: '28px', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
            color: '#fff',
            flexShrink: 0
          }}>
            <Code2 size={28} />
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a78bfa', fontWeight: 700 }}>
                Lead Creator & Architect
              </span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
              Protik
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 12px 0' }}>
              Designed and engineered by <strong>Protik</strong> to provide an uncompromised, zero-subscription desktop experience for local AI generation. Built with a vision for true digital autonomy, giving creators complete control over high-end diffusion models, multimodal workflows, and private uncensored language models directly on personal hardware.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Crafted with passion for AI sovereignty</span> &bull; <span>Solframe Studio Engine 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Live Dynamic Hardware Diagnostic ──────────────────────────── */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <Activity size={20} color="var(--accent)" />
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Live System & Hardware Diagnostics
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Auto-Detected Hardware
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Detected Primary GPU */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={12} color="var(--accent)" /> Active Primary GPU
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {hwInfo?.primaryGpu || 'Detecting GPU...'}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={11} /> Ready for High-Performance Inference
            </div>
          </div>

          {/* Active Acceleration Backend */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={12} color="#f59e0b" /> Inference Backend
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {hwInfo?.preferredBackend === 'cuda'
                ? 'NVIDIA CUDA (Tensor Cores)'
                : hwInfo?.preferredBackend === 'vulkan'
                ? 'Vulkan (Cross-Platform GPU)'
                : 'CPU Fallback (Multi-Threaded)'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Auto-routes NVIDIA to CUDA, AMD/Intel to Vulkan
            </div>
          </div>

          {/* Indexed Models */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={12} color="#ec4899" /> System Model Index
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {modelStats.totalModels > 0 ? `${modelStats.totalModels} Models Active` : 'Indexed across all drives'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {modelStats.scanPathsCount > 0 ? `${modelStats.scanPathsCount} scan directories searched` : 'Auto-scans C:, D:, and custom drives'}
            </div>
          </div>

          {/* Host OS Platform */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={12} color="#a78bfa" /> Runtime Environment
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {hwInfo?.os || 'Windows x64'} (Native)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Embedded Node {hwInfo?.nodeVersion || 'v25'} & Standalone Desktop
            </div>
          </div>
        </div>

        {/* All Detected GPUs list if multi-GPU */}
        {hwInfo && hwInfo.gpus && hwInfo.gpus.length > 1 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              All Detected Graphics Adapters:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hwInfo.gpus.map((g, idx) => (
                <span key={idx} className="badge-pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 10px', fontSize: '11px' }}>
                  🎮 {g.name} &bull; VRAM: {g.vram} &bull; Backend: {g.backend.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Engine & Hardware Acceleration Library Manager ────────────── */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent)" /> Engine Acceleration Libraries & Health
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Device-level status of CUDA, Vulkan, and llama.cpp native binaries.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {libraryData?.allReady ? (
              <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', fontSize: '12px' }}>
                🟢 All Libraries Installed & Ready
              </span>
            ) : (
              <a
                href={COMPLETE_INSTALLER_URL}
                className="btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                ⬇️ Get Complete Installer (Bundles All Engines)
              </a>
            )}
          </div>
        </div>

        {!libraryData?.allReady && (
          <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#eab308', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span>⚠️</span>
            <span>
              This build is missing one or more acceleration libraries below. There's no in-app downloader for individual libraries — the
              {' '}<a href={COMPLETE_INSTALLER_URL} style={{ color: 'inherit', textDecoration: 'underline' }}>Complete Installer</a>{' '}
              bundles everything and is the fastest way to get full GPU acceleration working.
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
          {libraryData?.libraries.map((lib) => (
            <div
              key={lib.id}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: lib.installed ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(239, 68, 68, 0.3)',
                padding: '14px',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {lib.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {lib.category} &bull; {lib.requiredFor}
                  </div>
                </div>

                <span
                  className="badge-pill"
                  style={{
                    background: lib.installed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: lib.installed ? '#34d399' : '#f87171',
                    fontSize: '10px'
                  }}
                >
                  {lib.installed ? '🟢 Installed' : '🔴 Missing'}
                </span>
              </div>

              {/* Files breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0, 0, 0, 0.25)', padding: '8px 10px', borderRadius: '6px', fontSize: '11px' }}>
                {lib.files.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: file.exists ? 'var(--text-secondary)' : '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={file.defaultRelativePath}>
                      {file.exists ? '✓' : '✗'} {file.name}
                    </span>
                    <span style={{ color: file.exists ? 'var(--text-muted)' : '#f87171', fontSize: '10px' }}>
                      {file.exists ? file.sizeMB : 'Required in ' + file.defaultRelativePath}
                    </span>
                  </div>
                ))}
              </div>

              {!lib.installed && (
                <a
                  href={COMPLETE_INSTALLER_URL}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 12px', alignSelf: 'flex-start', marginTop: '4px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  ⬇️ Get via Complete Installer
                </a>
              )}
            </div>
          ))}
        </div>
      </div>


      {/* ─── Core Architecture & Capabilities ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        
        {/* Feature 1 */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={18} color="var(--accent)" />
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              FLUX.2 & SDXL Image Synthesis
            </h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            Powered by <code>stable-diffusion.cpp</code> with hardware acceleration. Supports split-architecture FLUX.2 Klein models with dedicated 32-channel VAEs, GGUF text encoders, and SDXL Lightning 4-step checkpoints.
          </p>
        </div>

        {/* Feature 2 */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={18} color="#a78bfa" />
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Uncensored Local LLM Chat
            </h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            Native <code>llama.cpp</code> GPU server engine for GGUF text models (DeepSeek, Qwen 2.5, Gemma 4, Llama 3, Dolphin). Stream tokens in real time, customize persona presets, and send prompts directly to the image studio.
          </p>
        </div>

        {/* Feature 3 */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={18} color="#ec4899" />
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              6 Generative Art Themes
            </h4>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            Immersive UI with 6 distinct AI-generated artwork themes: Dark Void, Neon Cyber, Cinema Gold, Synthwave Sunset, Anime Fantasy, and Emerald Matrix with ambient glassmorphism and solid generation canvas.
          </p>
        </div>

      </div>

      {/* ─── Footer & Credits ─────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <div>
          Solframe Studio &bull; Created by <strong>Protik</strong>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Powered by <code>stable-diffusion.cpp</code>, <code>llama.cpp</code>, Electron, React 19, and Vite.
        </div>
      </div>

    </div>
  );
};