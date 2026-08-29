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

export const AboutStudio: React.FC = () => {
  const [hwInfo, setHwInfo] = useState<HardwareInfo | null>(null);
  const [modelStats, setModelStats] = useState<{ totalModels: number; scanPathsCount: number }>({
    totalModels: 0,
    scanPathsCount: 0
  });

  useEffect(() => {
    // Fetch dynamic hardware info
    fetch('/api/hardware-info')
      .then(res => res.json())
      .then(data => setHwInfo(data))
      .catch(() => {});

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
          <img src="/logo.png" alt="NexusAI Studio Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              NexusAI Studio
            </h1>
            <span className="badge-pill" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent)', border: '1px solid rgba(6, 182, 212, 0.3)', fontSize: '11px', padding: '4px 10px' }}>
              v1.0.0 Production Release
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
              <span>Crafted with passion for AI sovereignty</span> &bull; <span>NexusAI Studio Engine 2026</span>
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
          NexusAI Studio &bull; Created by <strong>Protik</strong>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Powered by <code>stable-diffusion.cpp</code>, <code>llama.cpp</code>, Electron, React 19, and Vite.
        </div>
      </div>

    </div>
  );
};