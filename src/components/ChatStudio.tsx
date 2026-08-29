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
  Zap, 
  RefreshCw, 
  Sliders,
  Cpu,
  Play,
  Square,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import { llmService, ChatMessage, PERSONA_PRESETS, PersonaPreset, LLMStatus, LocalGgufModel } from '../services/llmApi';

interface ChatStudioProps {
  llmStatus: LLMStatus;
  onSendToImageStudio: (prompt: string) => void;
  onError: (title: string, message: string) => void;
  onNavigateToHub?: () => void;
}

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
  const [engineMode, setEngineMode] = useState<'embedded' | 'external'>('embedded');
  const [localGgufModels, setLocalGgufModels] = useState<LocalGgufModel[]>([]);
  const [selectedGgufPath, setSelectedGgufPath] = useState<string>('');
  const [isStartingServer, setIsStartingServer] = useState<boolean>(false);
  const [embeddedServerStatus, setEmbeddedServerStatus] = useState<{ running: boolean; port: number; model: string | null }>({ running: false, port: 8080, model: null });
  const [selectedModel, setSelectedModel] = useState<string>(llmStatus.currentModel || 'default');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isScanningModels, setIsScanningModels] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const refreshLocalGgufModels = async () => {
    setIsScanningModels(true);
    try {
      const models = await llmService.getLocalGgufModels();
      setLocalGgufModels(models);
      if (models.length > 0 && !selectedGgufPath) {
        setSelectedGgufPath(models[0].path);
      }
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
    if (llmStatus.models.length > 0 && !llmStatus.models.includes(selectedModel)) {
      setSelectedModel(llmStatus.models[0]);
    }
  }, [llmStatus.models]);

  const handleStartEmbeddedServer = async () => {
    if (!selectedGgufPath) {
      onError('No GGUF Model Selected', 'Please select a downloaded .gguf text model from the dropdown or download one from the Model Hub.');
      return;
    }

    setIsStartingServer(true);
    try {
      const res = await llmService.startEmbeddedLlama(selectedGgufPath, 99, 4096);
      setEmbeddedServerStatus({ running: true, port: res.port, model: res.model });
      setEngineMode('embedded');
      llmService.setMode('embedded');
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

    if (engineMode === 'embedded' && !embeddedServerStatus.running) {
      if (selectedGgufPath) {
        await handleStartEmbeddedServer();
      } else {
        onError('Engine Not Running', "Please select a .gguf text model and click 'Start Engine' to launch native GPU text generation.");
        return;
      }
    } else if (engineMode === 'external' && !llmStatus.connected) {
      onError(
        'LLM Backend Offline',
        `Cannot connect to local LLM backend at ${llmService.getBaseUrl()}.\n\nTo chat:\n1. Switch to 'Native llama.cpp' above.\n2. Or start LM Studio on port 1234.\n3. Or start Ollama on port 11434.`
      );
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
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

    try {
      const activeModel = engineMode === 'embedded' ? (embeddedServerStatus.model || 'local-gguf') : selectedModel;
      await llmService.streamChat(
        newMessages,
        activeModel,
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
        controller.signal
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
                    Connected via {llmStatus.type.toUpperCase()}
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

        {/* Input Bar */}
        <div className="chat-input-bar">
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

        {/* Engine Switcher */}
        <div className="control-group">
          <label className="control-label">Inference Engine</label>
          <div className="tab-pill-group">
            <button
              type="button"
              className={`tab-pill ${engineMode === 'embedded' ? 'active' : ''}`}
              onClick={() => {
                setEngineMode('embedded');
                llmService.setMode('embedded');
              }}
            >
              <Cpu size={13} /> Native llama.cpp
            </button>
            <button
              type="button"
              className={`tab-pill ${engineMode === 'external' ? 'active' : ''}`}
              onClick={() => {
                setEngineMode('external');
                llmService.setMode('external');
              }}
            >
              <Zap size={13} /> External Server
            </button>
          </div>
        </div>

        {/* EMBEDDED LLAMA.CPP CONTROLS */}
        {engineMode === 'embedded' ? (
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
                    <option key={m.path} value={m.path}>
                      🟢 {m.filename} ({m.formattedSize})
                    </option>
                  ))}
                </select>

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
        ) : (
          <div className="control-group" style={{ marginBottom: '16px' }}>
            <label className="control-label">External Server Model</label>
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              className="select-input"
            >
              {llmStatus.models.length > 0 ? (
                llmStatus.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))
              ) : (
                <option value="default">Default Active Model</option>
              )}
            </select>
          </div>
        )}

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

