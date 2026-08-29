import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ImageStudio } from './components/ImageStudio';
import { ChatStudio } from './components/ChatStudio';
import { ModelManager } from './components/ModelManager';
import { GalleryStudio, GalleryItem } from './components/GalleryStudio';
import { SettingsStudio } from './components/SettingsStudio';
import { AboutStudio } from './components/AboutStudio';
import { ErrorModal, ModalProps } from './components/ErrorModal';
import { comfyService, ComfyStatus, AvailableModels } from './services/comfyApi';
import { llmService, LLMStatus } from './services/llmApi';
import { safeInvoke, safeListen, isTauriEnvironment } from './services/tauriBridge';
import './index.css';

export function App() {
  const [activeTab, setActiveTab] = useState<'image' | 'chat' | 'gallery' | 'models' | 'about' | 'settings'>('image');

  
  // Backend Statuses
  const [comfyStatus, setComfyStatus] = useState<ComfyStatus>({ connected: false });
  const [llmStatus, setLlmStatus] = useState<LLMStatus>({ connected: false, type: 'lmstudio', models: [] });
  const [availableModels, setAvailableModels] = useState<AvailableModels>({
    checkpoints: [],
    unets: [],
    clips: [],
    loras: [],
    vaes: []
  });

  // Gallery
  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_gallery');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Cross-Studio Prompt Transfer
  const [studioPrompt, setStudioPrompt] = useState<string>('');

  // Download tracking
  const [downloadProgress, setDownloadProgress] = useState<{ [filename: string]: number }>({});

  // Modal Dialogue
  const [modal, setModal] = useState<ModalProps>({
    show: false,
    type: 'error',
    title: '',
    message: '',
    onClose: () => setModal(prev => ({ ...prev, show: false }))
  });

  // Library Health Status
  const [libraryData, setLibraryData] = useState<{
    allReady: boolean;
    missingCount: number;
  }>({
    allReady: true,
    missingCount: 0
  });

  const [isEngineRunning, setIsEngineRunning] = useState<boolean>(false);

  const checkLibrariesHealth = () => {
    fetch('/api/libraries-status')
      .then(res => res.json())
      .then(data => {
        setLibraryData({
          allReady: data.allReady !== undefined ? data.allReady : true,
          missingCount: data.missingCount || 0
        });
      })
      .catch(() => {});
  };

  // Initial Boot & Health Checks
  const refreshBackendStatus = async () => {
    checkLibrariesHealth();

    // 1. Fetch Local Models from disk
    try {
      const res = await fetch('/api/local-models');
      if (res.ok) {
        const local = await res.json();
        setAvailableModels(prev => ({
          ...prev,
          checkpoints: local.checkpoints || [],
          unets: local.unets || [],
          clips: local.clips || [],
          loras: local.loras || [],
          vaes: local.vaes || [],
          controlnets: local.controlnets || []
        }));
      }
    } catch {}

    // 2. Check ComfyUI (optional server)
    const cStatus = await comfyService.checkStatus();
    setComfyStatus(cStatus);
    if (cStatus.connected) {
      const models = await comfyService.fetchModels();
      setAvailableModels(models);
    }

    // 3. Check LLM
    const lStatus = await llmService.detectBackend();
    setLlmStatus(lStatus);
  };

  useEffect(() => {
    refreshBackendStatus();
    const interval = setInterval(refreshBackendStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Listen to Tauri native download events if in desktop environment
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    async function setupTauriListeners() {
      if (!isTauriEnvironment()) return;
      unlistenFn = await safeListen<{ filename: string; downloaded: number; total: number | null }>(
        'download_progress', 
        (event) => {
          if (event.payload.total) {
            const pct = Math.round((event.payload.downloaded / event.payload.total) * 100);
            setDownloadProgress(prev => ({
              ...prev,
              [event.payload.filename]: pct
            }));
          }
        }
      );
    }
    setupTauriListeners();
    return () => { if (unlistenFn) unlistenFn(); };
  }, []);

  // Save gallery changes
  useEffect(() => {
    localStorage.setItem('nexus_gallery', JSON.stringify(gallery));
  }, [gallery]);

  const handleImageGenerated = (image: GalleryItem) => {
    setIsEngineRunning(false);
    setGallery(prev => [image, ...prev]);
    triggerSuccess('Artwork Generated', `Saved to gallery: ${image.prompt.slice(0, 30)}...`);
  };

  const handleGenerateStart = () => {
    setIsEngineRunning(true);
  };

  const handleGenerateEnd = () => {
    setIsEngineRunning(false);
  };

  const handleDeleteImage = (id: string) => {
    setGallery(prev => prev.filter(img => img.id !== id));
  };

  const handleReuseSettings = (item: GalleryItem) => {
    setStudioPrompt(item.prompt);
    setActiveTab('image');
  };

  const handleSendToImageStudio = (text: string) => {
    const cleaned = text.replace(/```(?:markdown|prompt|txt)?/g, '').replace(/```/g, '').trim();
    setStudioPrompt(cleaned);
    setActiveTab('image');
    setModal({
      show: true,
      type: 'success',
      title: 'Prompt Loaded to Image Studio',
      message: `Extracted prompt:\n\n"${cleaned.substring(0, 160)}..."`,
      onClose: () => setModal(prev => ({ ...prev, show: false }))
    });
  };

  const handleDownloadModel = async (url: string, filename: string, targetFolder: string) => {
    try {
      // Use backend curl downloader with live progress
      const res = await fetch('/api/download-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: url.replace('https://huggingface.co/', '').split('/resolve/')[0].split('/raw/')[0],
          filename: url.split('/resolve/main/')[1] || url.split('/raw/main/')[1] || filename,
          targetFolder,
          customFilename: filename
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerSuccess('Download Started', `Downloading ${filename} to ${targetFolder}`);
        return;
      }
    } catch (e) {}

    // Fallback: direct browser download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  const triggerError = (title: string, message: string) => {
    setModal({
      show: true,
      type: 'error',
      title,
      message,
      onClose: () => setModal(prev => ({ ...prev, show: false }))
    });
  };

  const triggerSuccess = (title: string, message: string) => {
    setModal({
      show: true,
      type: 'success',
      title,
      message,
      onClose: () => setModal(prev => ({ ...prev, show: false }))
    });
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        comfyStatus={comfyStatus}
        llmStatus={llmStatus}
        isEngineRunning={isEngineRunning}
        librariesReady={libraryData.allReady}
        missingLibrariesCount={libraryData.missingCount}
      />

      {/* Main Studio Viewport */}
      <main className="workspace-area">
        {activeTab === 'image' && (
          <ImageStudio
            comfyStatus={comfyStatus}
            availableModels={availableModels}
            onImageGenerated={handleImageGenerated}
            onError={triggerError}
            initialPrompt={studioPrompt}
            onGenerateStart={handleGenerateStart}
            onGenerateEnd={handleGenerateEnd}
          />
        )}

        {activeTab === 'chat' && (
          <ChatStudio
            llmStatus={llmStatus}
            onSendToImageStudio={handleSendToImageStudio}
            onError={triggerError}
            onNavigateToHub={() => setActiveTab('models')}
          />
        )}

        {activeTab === 'gallery' && (
          <GalleryStudio
            gallery={gallery}
            onDeleteImage={handleDeleteImage}
            onReuseSettings={handleReuseSettings}
          />
        )}

        {activeTab === 'models' && (
          <ModelManager
            availableModels={availableModels}
            onDownloadModel={handleDownloadModel}
            downloadProgress={downloadProgress}
            onNavigateToStudio={() => setActiveTab('image')}
            onNavigateToChat={() => setActiveTab('chat')}
            onSuccess={triggerSuccess}
            onError={triggerError}
          />
        )}

        {activeTab === 'about' && (
          <AboutStudio />
        )}

        {activeTab === 'settings' && (
          <SettingsStudio
            comfyStatus={comfyStatus}
            llmStatus={llmStatus}
            onRefreshStatus={refreshBackendStatus}
            onSuccess={triggerSuccess}
            onError={triggerError}
          />
        )}

      </main>

      {/* Global Dialog Modal */}
      <ErrorModal
        show={modal.show}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal(prev => ({ ...prev, show: false }))}
        actionText={modal.actionText}
        onAction={modal.onAction}
      />
    </div>
  );
}

export default App;
