import React, { useReducer, useEffect, useRef } from 'react';
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

interface LoadParams {
  ctxSize: number;
  gpuLayers: number;
  batchSize: number;
  flashAttn: 'auto' | 'on' | 'off';
  cacheTypeK: string;
  cacheTypeV: string;
  cacheTypeKEnabled: boolean;
  cacheTypeVEnabled: boolean;
  mmprojPath: string;
  reasoningEnabled: boolean;
}

const DEFAULT_LOAD_PARAMS: LoadParams = {
  ctxSize: 4096, gpuLayers: 99, batchSize: 2048, flashAttn: 'auto', cacheTypeK: 'f16', cacheTypeV: 'f16', cacheTypeKEnabled: false, cacheTypeVEnabled: false,
  mmprojPath: '', reasoningEnabled: false
};

interface EmbeddedServerStatus {
  running: boolean;
  port: number;
  model: string | null;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  activePersona: PersonaPreset;
  localGgufModels: LocalGgufModel[];
  mmprojModels: LocalGgufModel[];
  selectedGgufPath: string;
  isStartingServer: boolean;
  embeddedServerStatus: EmbeddedServerStatus;
  loadParams: LoadParams;
  temperature: number;
  streaming: boolean;
  copiedIndex: number | null;
  isScanningModels: boolean;
  pendingAttachments: ChatAttachment[];
  // Reasoning panels are collapsed by default (traces can be long) —
  // tracked per message index rather than one global flag.
  expandedReasoning: Set<number>;
}

function initState(): ChatState {
  let messages: ChatMessage[] = [];
  try {
    const saved = localStorage.getItem('solframe_chat_history');
    if (saved) messages = JSON.parse(saved);
  } catch {}

  let loadParams = DEFAULT_LOAD_PARAMS;
  try {
    const saved = localStorage.getItem('solframe_llm_load_params');
    if (saved) loadParams = { ...DEFAULT_LOAD_PARAMS, ...JSON.parse(saved) };
  } catch {}

  return {
    messages,
    input: '',
    activePersona: PERSONA_PRESETS[0],
    localGgufModels: [],
    mmprojModels: [],
    selectedGgufPath: '',
    isStartingServer: false,
    embeddedServerStatus: { running: false, port: 8080, model: null },
    loadParams,
    temperature: 0.7,
    streaming: false,
    copiedIndex: null,
    isScanningModels: false,
    pendingAttachments: [],
    expandedReasoning: new Set()
  };
}

type Action =
  | { type: 'SET_FIELD'; field: keyof ChatState; value: any }
  | { type: 'LOAD_PARAMS_MERGE'; patch: Partial<LoadParams> }
  | { type: 'SCAN_START' }
  | { type: 'SCAN_END' }
  | { type: 'GGUF_MODELS_LOADED'; models: LocalGgufModel[] }
  | { type: 'SERVER_STARTED'; port: number; model: string | null }
  | { type: 'SERVER_STOPPED' }
  | { type: 'SEND_MESSAGE_START'; userMessage: ChatMessage }
  | { type: 'STREAM_TOKEN'; token: string }
  | { type: 'STREAM_REASONING_TOKEN'; token: string }
  | { type: 'STREAM_SETTLED' }
  | { type: 'CLEAR_CHAT' }
  | { type: 'COPY_MESSAGE'; index: number }
  | { type: 'COPY_DONE' }
  | { type: 'ADD_ATTACHMENT'; attachment: ChatAttachment }
  | { type: 'REMOVE_ATTACHMENT'; index: number }
  | { type: 'TOGGLE_REASONING_EXPANDED'; index: number };

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'LOAD_PARAMS_MERGE':
      return { ...state, loadParams: { ...state.loadParams, ...action.patch } };

    case 'SCAN_START':
      return { ...state, isScanningModels: true };

    case 'SCAN_END':
      return { ...state, isScanningModels: false };

    case 'GGUF_MODELS_LOADED': {
      const next: ChatState = { ...state, localGgufModels: action.models };
      if (action.models.length > 0 && !state.selectedGgufPath) {
        next.selectedGgufPath = action.models[0].fullPath;
      }
      return next;
    }

    case 'SERVER_STARTED':
      return { ...state, embeddedServerStatus: { running: true, port: action.port, model: action.model }, isStartingServer: false };

    case 'SERVER_STOPPED':
      return { ...state, embeddedServerStatus: { running: false, port: 8080, model: null } };

    case 'SEND_MESSAGE_START': {
      const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
      return {
        ...state,
        messages: [...state.messages, action.userMessage, assistantPlaceholder],
        input: '',
        pendingAttachments: [],
        streaming: true
      };
    }

    case 'STREAM_TOKEN': {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, content: last.content + action.token };
      return { ...state, messages };
    }

    case 'STREAM_REASONING_TOKEN': {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, reasoningContent: (last.reasoningContent || '') + action.token };
      return { ...state, messages };
    }

    case 'STREAM_SETTLED':
      return { ...state, streaming: false };

    case 'CLEAR_CHAT':
      return { ...state, messages: [] };

    case 'COPY_MESSAGE':
      return { ...state, copiedIndex: action.index };

    case 'COPY_DONE':
      return { ...state, copiedIndex: null };

    case 'ADD_ATTACHMENT':
      return { ...state, pendingAttachments: [...state.pendingAttachments, action.attachment] };

    case 'REMOVE_ATTACHMENT':
      return { ...state, pendingAttachments: state.pendingAttachments.filter((_, i) => i !== action.index) };

    case 'TOGGLE_REASONING_EXPANDED': {
      const next = new Set(state.expandedReasoning);
      if (next.has(action.index)) next.delete(action.index); else next.add(action.index);
      return { ...state, expandedReasoning: next };
    }

    default:
      return state;
  }
}

export const ChatStudio: React.FC<ChatStudioProps> = ({
  llmStatus,
  onSendToImageStudio,
  onError,
  onNavigateToHub
}) => {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const setField = <K extends keyof ChatState>(field: K, value: ChatState[K]) =>
    dispatch({ type: 'SET_FIELD', field, value });

  const refreshLocalGgufModels = async () => {
    dispatch({ type: 'SCAN_START' });
    try {
      const models = await llmService.getLocalGgufModels();
      dispatch({ type: 'GGUF_MODELS_LOADED', models });
      const mmprojs = await llmService.getLocalMmprojModels();
      setField('mmprojModels', mmprojs);
      const status = await llmService.getEmbeddedLlamaStatus();
      setField('embeddedServerStatus', status);
    } catch (e) {
      console.error('Failed to load local GGUF models', e);
    } finally {
      dispatch({ type: 'SCAN_END' });
    }
  };

  useEffect(() => {
    refreshLocalGgufModels();
  }, []);

  useEffect(() => {
    localStorage.setItem('solframe_chat_history', JSON.stringify(state.messages));
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  useEffect(() => {
    localStorage.setItem('solframe_llm_load_params', JSON.stringify(state.loadParams));
  }, [state.loadParams]);

  const handleStartEmbeddedServer = async () => {
    if (!state.selectedGgufPath) {
      onError('No GGUF Model Selected', 'Please select a downloaded .gguf text model from the dropdown or download one from the Model Hub.');
      return;
    }

    setField('isStartingServer', true);
    try {
      const res = await llmService.startEmbeddedLlama(
        state.selectedGgufPath, state.loadParams.gpuLayers, state.loadParams.ctxSize, state.loadParams.batchSize, state.loadParams.flashAttn,
        state.loadParams.cacheTypeKEnabled ? state.loadParams.cacheTypeK : 'f16',
        state.loadParams.cacheTypeVEnabled ? state.loadParams.cacheTypeV : 'f16',
        state.loadParams.mmprojPath || undefined,
        state.loadParams.reasoningEnabled
      );
      dispatch({ type: 'SERVER_STARTED', port: res.port, model: res.model });
    } catch (err: any) {
      onError('llama.cpp Startup Error', err.message || 'Failed to initialize CUDA llama-server on GPU.');
      setField('isStartingServer', false);
    }
  };

  const handleStopEmbeddedServer = async () => {
    await llmService.stopEmbeddedLlama();
    dispatch({ type: 'SERVER_STOPPED' });
  };

  const handleSendMessage = async () => {
    if (!state.input.trim() || state.streaming) return;

    if (!state.embeddedServerStatus.running) {
      if (state.selectedGgufPath) {
        await handleStartEmbeddedServer();
      } else {
        onError('Engine Not Running', "Please select a .gguf text model and click 'Start Engine' to launch native GPU text generation.");
        return;
      }
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: state.input.trim(),
      attachments: state.pendingAttachments.length > 0 ? state.pendingAttachments : undefined,
      timestamp: Date.now()
    };

    // The messages array sent to streamChat must include this user message
    // but not yet the empty assistant placeholder SEND_MESSAGE_START also
    // adds to state — build it here rather than reading state back after
    // dispatch, since dispatch doesn't resolve synchronously.
    const newMessages = [...state.messages, userMessage];
    dispatch({ type: 'SEND_MESSAGE_START', userMessage });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await llmService.streamChat(
        newMessages,
        state.embeddedServerStatus.model || 'local-gguf',
        state.activePersona.systemPrompt,
        state.temperature,
        (token) => dispatch({ type: 'STREAM_TOKEN', token }),
        controller.signal,
        (reasoningToken) => dispatch({ type: 'STREAM_REASONING_TOKEN', token: reasoningToken })
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError('LLM Chat Error', err.message || 'Stream interrupted.');
      }
    } finally {
      dispatch({ type: 'STREAM_SETTLED' });
      abortControllerRef.current = null;
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      dispatch({ type: 'STREAM_SETTLED' });
    }
  };

  const handleClearChat = () => {
    dispatch({ type: 'CLEAR_CHAT' });
    localStorage.removeItem('solframe_chat_history');
  };

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    dispatch({ type: 'COPY_MESSAGE', index });
    setTimeout(() => dispatch({ type: 'COPY_DONE' }), 2000);
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
          dispatch({ type: 'ADD_ATTACHMENT', attachment: { type: 'image', name: file.name, mimeType: file.type, dataUrl: reader.result as string } });
        };
        reader.readAsDataURL(file);
        return;
      }

      if (isPdf) {
        try {
          const extractedText = await extractPdfText(file);
          dispatch({ type: 'ADD_ATTACHMENT', attachment: { type: 'document', name: file.name, mimeType: file.type, extractedText } });
        } catch (err: any) {
          onError('PDF Extraction Failed', `Couldn't read text from "${file.name}": ${err.message || 'unknown error'}`);
        }
        return;
      }

      // Plain text (.txt/.md) needs no library — just the raw read result.
      const reader = new FileReader();
      reader.onload = () => {
        dispatch({ type: 'ADD_ATTACHMENT', attachment: { type: 'document', name: file.name, mimeType: file.type, extractedText: reader.result as string } });
      };
      reader.readAsText(file);
    });
  };

  const handleRemoveAttachment = (index: number) => {
    dispatch({ type: 'REMOVE_ATTACHMENT', index });
  };

  const toggleReasoningExpanded = (index: number) => {
    dispatch({ type: 'TOGGLE_REASONING_EXPANDED', index });
  };

  const { messages, input, activePersona, localGgufModels, mmprojModels, selectedGgufPath, isStartingServer, embeddedServerStatus, loadParams, temperature, streaming, copiedIndex, isScanningModels, pendingAttachments, expandedReasoning } = state;

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
                    onClick={() => setField('activePersona', p)}
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
            onChange={(e) => setField('input', e.target.value)}
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
                  onChange={(e) => setField('selectedGgufPath', e.target.value)}
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
                      onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { ctxSize: parseInt(e.target.value, 10) || loadParams.ctxSize } })}
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
                      onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { gpuLayers: parseInt(e.target.value, 10) || 0 } })}
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
                      onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { batchSize: parseInt(e.target.value, 10) || loadParams.batchSize } })}
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
                        dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { flashAttn, cacheTypeVEnabled: vStillValid ? loadParams.cacheTypeVEnabled : false } });
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
                        onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { cacheTypeKEnabled: e.target.checked } })}
                        style={{ marginLeft: '6px', verticalAlign: 'middle', accentColor: 'var(--accent)' }}
                        title="Override the K cache's data type (defaults to f16)"
                      />
                    </label>
                    <select
                      value={loadParams.cacheTypeK}
                      disabled={embeddedServerStatus.running || !loadParams.cacheTypeKEnabled}
                      onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { cacheTypeK: e.target.value } })}
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
                        onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { cacheTypeVEnabled: e.target.checked } })}
                        style={{ marginLeft: '6px', verticalAlign: 'middle', accentColor: 'var(--accent)' }}
                        title={loadParams.flashAttn === 'off' ? 'Requires Flash Attention (On or Auto) to use a quantized V-cache' : "Override the V cache's data type (defaults to f16)"}
                      />
                    </label>
                    <select
                      value={loadParams.cacheTypeV}
                      disabled={embeddedServerStatus.running || !loadParams.cacheTypeVEnabled || loadParams.flashAttn === 'off'}
                      onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { cacheTypeV: e.target.value } })}
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
                      onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { reasoningEnabled: e.target.checked } })}
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
                      onChange={(e) => dispatch({ type: 'LOAD_PARAMS_MERGE', patch: { mmprojPath: e.target.value } })}
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
                onClick={() => setField('activePersona', p)}
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
            onChange={(e) => setField('temperature', parseFloat(e.target.value))}
            className="slider-input"
          />
        </div>
      </div>
    </div>
  );
};
