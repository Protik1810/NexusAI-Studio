import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Bot,
  User,
  StopCircle,
  Image as ImageIcon,
  RefreshCw,
  Sliders,
  Cpu,
  Play,
  Square,
  HardDrive,
  FolderOpen,
  AlertTriangle,
  Paperclip,
  X,
  ChevronDown,
  Brain,
  FileText
} from 'lucide-react';
import { llmService, ChatMessage, ChatAttachment, PERSONA_PRESETS, PersonaPreset, LLMStatus, LocalGgufModel } from '../services/llmApi';
// Cap on extracted PDF text length — a full book-length PDF would blow past
// any reasonable context window; truncating with a visible note is more
// honest than silently cutting the model's context off mid-document.
const MAX_PDF_TEXT_CHARS = 20000;

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;
// pdfjs-dist adds ~500KB to whatever bundle imports it — dynamic import
// keeps that cost out of the app's initial load entirely, paid only the
// first time someone actually attaches a PDF in a session.
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import('pdfjs-dist'),
      // Bundled locally via Vite's ?url asset import — never fetched from a
      // CDN, consistent with this app's offline-only design (pdfjs-dist's
      // default of pulling its worker from a CDN URL would otherwise be the
      // one network call anywhere in the whole app).
      import('pdfjs-dist/build/pdf.worker.mjs?url')
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item: any) => item.str || '').join(' '));
  }
  const fullText = pageTexts.join('\n\n');
  return fullText.length > MAX_PDF_TEXT_CHARS
    ? `${fullText.slice(0, MAX_PDF_TEXT_CHARS)}\n\n[...truncated, ${fullText.length - MAX_PDF_TEXT_CHARS} more characters omitted...]`
    : fullText;
}

interface ChatStudioProps {
  llmStatus: LLMStatus;
  onSendToImageStudio: (prompt: string) => void;
  onError: (title: string, message: string) => void;
  onNavigateToHub?: () => void;
}

// llama.cpp's allowed KV cache quantization types (verified against the
// bundled llama-server.exe's own --help). Quantized V-cache (anything but
// f32/f16) additionally requires Flash Attention to be on/auto.
const KV_CACHE_TYPES = ['f32', 'f16', 'bf16', 'q8_0', 'q4_0', 'q4_1', 'iq4_nl', 'q5_0', 'q5_1'];

// Label-left / control-right row layout for the GGUF load-parameters panel,
// matching LM Studio's own "Load" tab.
const loadParamRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '7px 0',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  gap: '10px'
};
const loadParamLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0
};
const loadParamControlStyle: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: '12px',
  width: '120px',
  flexShrink: 0
};

export const ChatStudio: React.FC<ChatStudioProps> = ({
  llmStatus,
  onSendToImageStudio,
  onError,
  onNavigateToHub
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('solframe_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState<string>('');
  const [activePersona, setActivePersona] = useState<PersonaPreset>(PERSONA_PRESETS[0]);
  const [localGgufModels, setLocalGgufModels] = useState<LocalGgufModel[]>([]);
  const [mmprojModels, setMmprojModels] = useState<LocalGgufModel[]>([]);
  const [selectedGgufPath, setSelectedGgufPath] = useState<string>('');
  const [isStartingServer, setIsStartingServer] = useState<boolean>(false);
  const [embeddedServerStatus, setEmbeddedServerStatus] = useState<{ running: boolean; port: number; model: string | null }>({ running: false, port: 8080, model: null });
  const [loadParams, setLoadParams] = useState<{
    ctxSize: number; gpuLayers: number; batchSize: number; flashAttn: 'auto' | 'on' | 'off';
    cacheTypeK: string; cacheTypeV: string; cacheTypeKEnabled: boolean; cacheTypeVEnabled: boolean;
    mmprojPath: string; reasoningEnabled: boolean;
  }>(() => {
    const defaults = {
      ctxSize: 4096, gpuLayers: 99, batchSize: 2048, flashAttn: 'auto' as const, cacheTypeK: 'f16', cacheTypeV: 'f16', cacheTypeKEnabled: false, cacheTypeVEnabled: false,
      mmprojPath: '', reasoningEnabled: false
    };
    try {
      const saved = localStorage.getItem('solframe_llm_load_params');
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });
  const [temperature, setTemperature] = useState<number>(0.7);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isScanningModels, setIsScanningModels] = useState<boolean>(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  // Reasoning panels are collapsed by default (traces can be long) — tracked
  // per message index rather than one global flag.
  const [expandedReasoning, setExpandedReasoning] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const refreshLocalGgufModels = async () => {
    setIsScanningModels(true);
    try {
      const models = await llmService.getLocalGgufModels();
      setLocalGgufModels(models);
      if (models.length > 0 && !selectedGgufPath) {
        setSelectedGgufPath(models[0].fullPath);
      }
      const mmprojs = await llmService.getLocalMmprojModels();
      setMmprojModels(mmprojs);
      const status = await llmService.getEmbeddedLlamaStatus();
      setEmbeddedServerStatus(status);
    } catch (e) {
      console.error('Failed to load local GGUF models', e);
    } finally {
      setIsScanningModels(false);
    }
  };

  useEffect(() => {
    refreshLocalGgufModels();
  }, []);

  useEffect(() => {
    localStorage.setItem('solframe_chat_history', JSON.stringify(messages));
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('solframe_llm_load_params', JSON.stringify(loadParams));
  }, [loadParams]);

  const handleStartEmbeddedServer = async () => {
    if (!selectedGgufPath) {
      onError('No GGUF Model Selected', 'Please select a downloaded .gguf text model from the dropdown or download one from the Model Hub.');
      return;
    }

    setIsStartingServer(true);
    try {
      const res = await llmService.startEmbeddedLlama(
        selectedGgufPath, loadParams.gpuLayers, loadParams.ctxSize, loadParams.batchSize, loadParams.flashAttn,
        loadParams.cacheTypeKEnabled ? loadParams.cacheTypeK : 'f16',
        loadParams.cacheTypeVEnabled ? loadParams.cacheTypeV : 'f16',
        loadParams.mmprojPath || undefined,
        loadParams.reasoningEnabled
      );
      setEmbeddedServerStatus({ running: true, port: res.port, model: res.model });
    } catch (err: any) {
      onError('llama.cpp Startup Error', err.message || 'Failed to initialize CUDA llama-server on GPU.');
    } finally {
      setIsStartingServer(false);
    }
  };

  const handleStopEmbeddedServer = async () => {
    await llmService.stopEmbeddedLlama();
    setEmbeddedServerStatus({ running: false, port: 8080, model: null });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || streaming) return;

    if (!embeddedServerStatus.running) {
      if (selectedGgufPath) {
        await handleStartEmbeddedServer();
      } else {
        onError('Engine Not Running', "Please select a .gguf text model and click 'Start Engine' to launch native GPU text generation.");
        return;
      }
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setPendingAttachments([]);
    setStreaming(true);

    const assistantPlaceholder: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    setMessages([...newMessages, assistantPlaceholder]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      await llmService.streamChat(
        newMessages,
        embeddedServerStatus.model || 'local-gguf',
        activePersona.systemPrompt,
        temperature,
        (token) => {
          accumulatedContent += token;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: accumulatedContent
            };
            return copy;
          });
        },
        controller.signal,
        (reasoningToken) => {
          accumulatedReasoning += reasoningToken;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              reasoningContent: accumulatedReasoning
            };
            return copy;
          });
        }
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError('LLM Chat Error', err.message || 'Stream interrupted.');
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStreaming(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem('solframe_chat_history');
  };

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-attaching the same file after removing it
    files.forEach(async (file) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingAttachments((prev) => [...prev, { type: 'image', name: file.name, mimeType: file.type, dataUrl: reader.result as string }]);
        };
        reader.readAsDataURL(file);
        return;
      }

      if (isPdf) {
        try {
          const extractedText = await extractPdfText(file);
          setPendingAttachments((prev) => [...prev, { type: 'document', name: file.name, mimeType: file.type, extractedText }]);
        } catch (err: any) {
          onError('PDF Extraction Failed', `Couldn't read text from "${file.name}": ${err.message || 'unknown error'}`);
        }
        return;
      }

      // Plain text (.txt/.md) needs no library — just the raw read result.
      const reader = new FileReader();
      reader.onload = () => {
        setPendingAttachments((prev) => [...prev, { type: 'document', name: file.name, mimeType: file.type, extractedText: reader.result as string }]);
      };
      reader.readAsText(file);
    });
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleReasoningExpanded = (index: number) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  return (
    <div className="chat-layout">
      {/* LEFT: CHAT AREA */}
      <div className="chat-main glass-panel">
        {/* Chat Header */}
        <div className="chat-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>{activePersona.icon}</span>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activePersona.name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                {embeddedServerStatus.running ? (
                  <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <Cpu size={11} style={{ marginRight: '4px' }} /> llama.cpp CUDA (GPU Active: {embeddedServerStatus.model})
                  </span>
                ) : llmStatus.connected ? (
                  <span className="badge-pill" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                    Connected (llama.cpp CUDA)
                  </span>
                ) : (
                  <span className="badge-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    Engine Offline (Ready to launch)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {messages.length > 0 && (
              <button 
                className="icon-btn" 
                onClick={handleClearChat} 
                title="Clear Conversation"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Uncensored Model Disclaimer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '12px',
            lineHeight: 1.5,
            color: '#fca5a5',
            background: 'rgba(239, 68, 68, 0.08)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>
            Uncensored models can produce inaccurate, offensive, or unsafe content. Use at your own risk — you are solely responsible for what you generate and how you use it.
          </span>
        </div>

        {/* Message Feed */}
        <div className="chat-feed">
          {messages.length === 0 ? (
            <div className="empty-chat-state">
              <Bot size={44} opacity={0.3} color="var(--accent)" />
              <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>
                Uncensored AI Dialogue & Prompt Architect
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '440px', lineHeight: 1.6 }}>
                Powered by native <strong>llama.cpp CUDA</strong>. Direct GPU execution for any downloaded GGUF text model without relying on external software!
              </p>

              {/* Persona Quick Switches */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {PERSONA_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`persona-card ${activePersona.id === p.id ? 'active' : ''}`}
                    onClick={() => setActivePersona(p)}
                  >
                    <span style={{ fontSize: '20px' }}>{p.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`chat-bubble-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
              >
                <div className="bubble-avatar">
                  {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} color="var(--accent)" />}
                </div>

                <div className={`chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {msg.attachments.map((att, attIdx) => (
                        att.type === 'image' ? (
                          <img
                            key={attIdx}
                            src={att.dataUrl}
                            alt={att.name}
                            title={att.name}
                            style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }}
                          />
                        ) : (
                          <span
                            key={attIdx}
                            title={att.name}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            <FileText size={11} /> {att.name}
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  {msg.reasoningContent && (
                    <div style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                      <button
                        type="button"
                        className="accordion-header"
                        onClick={() => toggleReasoningExpanded(idx)}
                        style={{ fontSize: '11px' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Brain size={12} /> Thinking
                        </span>
                        <ChevronDown size={12} style={{ transform: expandedReasoning.has(idx) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                      {expandedReasoning.has(idx) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                          {msg.reasoningContent}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bubble-text">
                    {msg.content || (streaming && idx === messages.length - 1 ? (
                      <span className="pulse-dots">Synthesizing response<span>.</span><span>.</span><span>.</span></span>
                    ) : '')}
                  </div>

                  {msg.role === 'assistant' && msg.content && (
                    <div className="bubble-actions">
                      <button 
                        className="bubble-action-btn" 
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        title="Copy text"
                      >
                        {copiedIndex === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        {copiedIndex === idx ? 'Copied' : 'Copy'}
                      </button>

                      <button 
                        className="bubble-action-btn" 
                        onClick={() => onSendToImageStudio(msg.content)}
                        title="Send this response as prompt to Image Studio"
                      >
                        <ImageIcon size={12} color="var(--accent)" />
                        Send to Studio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 20px 0', background: 'rgba(0, 0, 0, 0.2)' }}>
            {pendingAttachments.map((att, i) => (
              <span
                key={i}
                title={att.name}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '4px 6px 4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', maxWidth: '180px' }}
              >
                {att.type === 'image' ? (
                  <img src={att.dataUrl} alt={att.name} style={{ width: '18px', height: '18px', objectFit: 'cover', borderRadius: '3px' }} />
                ) : (
                  <FileText size={12} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(i)}
                  title="Remove attachment"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="chat-input-bar">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,.txt,.md,.pdf"
            style={{ display: 'none' }}
            onChange={handleAttachFiles}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach an image or text file"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your uncensored request or ask for a detailed image prompt..."
            rows={1}
            className="chat-textarea"
          />

          {streaming ? (
            <button className="chat-send-btn stop" onClick={handleStopStream} title="Stop Generating">
              <StopCircle size={18} />
            </button>
          ) : (
            <button 
              className="chat-send-btn" 
              onClick={handleSendMessage} 
              disabled={!input.trim()}
              title="Send Message"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: CONFIGURATION & LLAMA.CPP ENGINE CONTROLS */}
      <div className="chat-sidebar glass-panel">
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders size={16} color="var(--accent)" /> LLM Engine & Config
        </h3>

        {/* EMBEDDED LLAMA.CPP CONTROLS */}
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="control-label" style={{ marginBottom: 0, fontSize: '12px' }}>
                Local GGUF Models (models/llm)
              </label>
              <button
                type="button"
                onClick={refreshLocalGgufModels}
                disabled={isScanningModels}
                className="icon-btn"
                title="Rescan disk for GGUF models"
                style={{ fontSize: '11px', padding: '2px 6px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={11} className={isScanningModels ? 'spin-anim' : ''} />
                Rescan
              </button>
            </div>

            {localGgufModels.length > 0 ? (
              <>
                <select
                  value={selectedGgufPath}
                  onChange={(e) => setSelectedGgufPath(e.target.value)}
                  className="select-input"
                  style={{ marginBottom: '10px' }}
                >
                  {localGgufModels.map((m) => (
                    <option key={m.fullPath} value={m.fullPath}>
                      🟢 {m.filename} ({m.formattedSize})
                    </option>
                  ))}
                </select>

                {/* GGUF Load Parameters — label-left/control-right rows, matching LM Studio's Load panel layout */}
                <div style={{ marginBottom: '10px', opacity: embeddedServerStatus.running ? 0.5 : 1 }}>
                  <div style={loadParamRowStyle}>
                    <label style={loadParamLabelStyle}>Context Length</label>
                    <input
                      type="number"
                      min={512}
                      max={131072}
                      step={512}
                      value={loadParams.ctxSize}
                      disabled={embeddedServerStatus.running}
                      onChange={(e) => setLoadParams({ ...loadParams, ctxSize: parseInt(e.target.value, 10) || loadParams.ctxSize })}
                      className="select-input"
                      style={loadParamControlStyle}
                    />
                  </div>
                  <div style={loadParamRowStyle}>
                    <label style={loadParamLabelStyle}>GPU Layers (99 = Max)</label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={loadParams.gpuLayers}
                      disabled={embeddedServerStatus.running}
                      onChange={(e) => setLoadParams({ ...loadParams, gpuLayers: parseInt(e.target.value, 10) || 0 })}
                      className="select-input"
                      style={loadParamControlStyle}
                    />
                  </div>
                  <div style={loadParamRowStyle}>
                    <label style={loadParamLabelStyle}>Batch Size</label>
                    <input
                      type="number"
                      min={32}
                      max={8192}
                      step={32}
                      value={loadParams.batchSize}
                      disabled={embeddedServerStatus.running}
                      onChange={(e) => setLoadParams({ ...loadParams, batchSize: parseInt(e.target.value, 10) || loadParams.batchSize })}
                      className="select-input"
                      style={loadParamControlStyle}
                    />
                  </div>
                  <div style={loadParamRowStyle}>
                    <label style={loadParamLabelStyle}>Flash Attention</label>
                    <select
                      value={loadParams.flashAttn}
                      disabled={embeddedServerStatus.running}
                      onChange={(e) => {
                        const flashAttn = e.target.value as 'auto' | 'on' | 'off';
                        // Quantized V-cache requires Flash Attention — drop back
                        // to f16 rather than let an invalid combo get saved.
                        const vStillValid = flashAttn !== 'off';
                        setLoadParams({ ...loadParams, flashAttn, cacheTypeVEnabled: vStillValid ? loadParams.cacheTypeVEnabled : false });
                      }}
                      className="select-input"
                      style={loadParamControlStyle}
                    >
                      <option value="auto">Auto</option>
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                  <div style={{ ...loadParamRowStyle, borderBottom: 'none' }}>
                    <label style={loadParamLabelStyle}>
                      K Cache Quantization
                      <input
                        type="checkbox"
                        checked={loadParams.cacheTypeKEnabled}
                        disabled={embeddedServerStatus.running}
                        onChange={(e) => setLoadParams({ ...loadParams, cacheTypeKEnabled: e.target.checked })}
                        style={{ marginLeft: '6px', verticalAlign: 'middle', accentColor: 'var(--accent)' }}
                        title="Override the K cache's data type (defaults to f16)"
                      />
                    </label>
                    <select
                      value={loadParams.cacheTypeK}
                      disabled={embeddedServerStatus.running || !loadParams.cacheTypeKEnabled}
                      onChange={(e) => setLoadParams({ ...loadParams, cacheTypeK: e.target.value })}
                      className="select-input"
                      style={loadParamControlStyle}
                    >
                      {KV_CACHE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ ...loadParamRowStyle, borderBottom: 'none' }}>
                    <label style={loadParamLabelStyle}>
                      V Cache Quantization
                      <input
                        type="checkbox"
                        checked={loadParams.cacheTypeVEnabled}
                        disabled={embeddedServerStatus.running || loadParams.flashAttn === 'off'}
                        onChange={(e) => setLoadParams({ ...loadParams, cacheTypeVEnabled: e.target.checked })}
                        style={{ marginLeft: '6px', verticalAlign: 'middle', accentColor: 'var(--accent)' }}
                        title={loadParams.flashAttn === 'off' ? 'Requires Flash Attention (On or Auto) to use a quantized V-cache' : "Override the V cache's data type (defaults to f16)"}
                      />
                    </label>
                    <select
                      value={loadParams.cacheTypeV}
                      disabled={embeddedServerStatus.running || !loadParams.cacheTypeVEnabled || loadParams.flashAttn === 'off'}
                      onChange={(e) => setLoadParams({ ...loadParams, cacheTypeV: e.target.value })}
                      className="select-input"
                      style={loadParamControlStyle}
                      title={loadParams.flashAttn === 'off' ? 'Requires Flash Attention (On or Auto) to use a quantized V-cache' : undefined}
                    >
                      {KV_CACHE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ ...loadParamRowStyle, borderBottom: 'none' }}>
                    <label style={loadParamLabelStyle}>
                      <Brain size={12} style={{ marginRight: '5px' }} /> Reasoning / Thinking
                    </label>
                    <input
                      type="checkbox"
                      checked={loadParams.reasoningEnabled}
                      disabled={embeddedServerStatus.running}
                      onChange={(e) => setLoadParams({ ...loadParams, reasoningEnabled: e.target.checked })}
                      style={{ accentColor: 'var(--accent)' }}
                      title="For reasoning models (e.g. DeepSeek-R1 style) — shows the model's reasoning trace in a collapsible panel above its final answer, instead of it leaking into the visible reply."
                    />
                  </div>
                </div>

                {mmprojModels.length > 0 && (
                  <div style={{ marginBottom: '10px', opacity: embeddedServerStatus.running ? 0.5 : 1 }}>
                    <label style={{ ...loadParamLabelStyle, display: 'block', marginBottom: '4px' }}>
                      Vision Projector (mmproj) — optional
                    </label>
                    <select
                      value={loadParams.mmprojPath}
                      disabled={embeddedServerStatus.running}
                      onChange={(e) => setLoadParams({ ...loadParams, mmprojPath: e.target.value })}
                      className="select-input"
                    >
                      <option value="">None (text-only)</option>
                      {mmprojModels.map((m) => (
                        <option key={m.fullPath} value={m.fullPath}>
                          🖼️ {m.filename} ({m.formattedSize})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {embeddedServerStatus.running && (
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '-6px', marginBottom: '10px' }}>
                    Stop the engine to change load parameters.
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  {embeddedServerStatus.running ? (
                    <button
                      type="button"
                      onClick={handleStopEmbeddedServer}
                      className="btn-danger"
                      style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                    >
                      <Square size={13} fill="currentColor" /> Stop Server
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEmbeddedServer}
                      disabled={isStartingServer}
                      className="btn-primary"
                      style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Play size={13} fill="currentColor" /> {isStartingServer ? 'Loading to GPU...' : 'Start Engine (CUDA)'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 6px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  No GGUF text models found in <code>models/llm/</code>.
                </p>
                {onNavigateToHub && (
                  <button
                    type="button"
                    onClick={onNavigateToHub}
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <HardDrive size={12} /> Search & Download in Model Hub
                  </button>
                )}
              </div>
            )}
          </div>

        {/* Active Persona */}
        <div className="control-group">
          <label className="control-label">Active Persona</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PERSONA_PRESETS.map((p) => (
              <div
                key={p.id}
                className={`persona-list-item ${activePersona.id === p.id ? 'active' : ''}`}
                onClick={() => setActivePersona(p)}
              >
                <span style={{ fontSize: '18px' }}>{p.icon}</span>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Temperature */}
        <div className="control-group" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className="control-label">Creativity / Temp</label>
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{temperature.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="1.5" 
            step="0.05"
            value={temperature} 
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="slider-input"
          />
        </div>
      </div>
    </div>
  );
};

