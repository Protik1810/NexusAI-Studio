<div align="center">

# ✨ NexusAI Studio

**Autonomous, Sovereign & Zero-Cloud Local Generative AI Workstation**

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge&logo=windows)](https://github.com/Protik1810/NexusAI-Studio)
[![Hardware](https://img.shields.io/badge/Hardware-NVIDIA%20CUDA%20%7C%20AMD%2FIntel%20Vulkan-success?style=for-the-badge&logo=nvidia)](https://github.com/Protik1810/NexusAI-Studio)
[![Engine](https://img.shields.io/badge/Diffusion%20Engine-stable--diffusion.cpp-orange?style=for-the-badge)](https://github.com/leejet/stable-diffusion.cpp)
[![LLM](https://img.shields.io/badge/Dialogue%20Engine-llama.cpp%20GGUF-purple?style=for-the-badge)](https://github.com/ggerganov/llama.cpp)
[![License](https://img.shields.io/badge/License-GNU%20GPL%20v3.0-blue?style=for-the-badge)](LICENSE)

<br/>

*Designed & Engineered by **Protik***

</div>

---

## 🌟 Overview

**NexusAI Studio** is a standalone, self-contained desktop generative AI suite engineered for 100% private, offline inference. Combining **`stable-diffusion.cpp`** (supporting FLUX.2 Klein, SDXL Lightning, and standard SD checkpoints) with **`llama.cpp`** (running GGUF text models with full GPU offloading), NexusAI Studio brings high-performance generative AI directly to consumer hardware with zero subscription fees, zero cloud telemetry, and complete offline autonomy.

---

## 🚀 Key Features

### 🎨 1. Image Studio (Multi-Architecture Diffusion)
- **FLUX.2-Klein Architecture Support**: Auto-configured `--prediction flux2_flow` with 32-channel VAEs (`flux2-vae.safetensors` / `ae.safetensors`) and GGUF text encoders.
- **SDXL Lightning & Turbo**: 4-step ultra-fast photo-realistic generation.
- **LoRA Dynamic Stacking**: Real-time slider strength control for fine-tuned LoRA weights.
- **Distraction-Free Canvas**: Pure studio neutral generation viewport for accurate color fidelity.

### 💬 2. Uncensored Local LLM Chat
- **Native `llama.cpp` GPU Server**: Stream tokens in real time from quantized GGUF models (DeepSeek, Qwen 2.5, Gemma 4, Llama 3, Dolphin).
- **Custom Personas**: Seamless roleplay switching (Creative Visionary, Technical Prompt Engineer, Uncensored Assistant).
- **Cross-Studio Pipeline**: Send generated prompts directly to the Image Studio with one click.

### 🎮 3. Dynamic Hardware Auto-Detection
- **NVIDIA GPUs**: Auto-routes to **CUDA** (`backend/win/cuda/`) leveraging Tensor Cores.
- **AMD Radeon & Intel Arc GPUs**: Auto-routes to **Vulkan** (`backend/win/vulkan/`) using cross-platform compute shaders.
- **CPU Fallback**: Automatic multi-threaded AVX2 CPU execution when no discrete GPU is found.

### 🗄️ 4. Universal Dynamic Model Scanner
- **Multi-Drive Auto-Discovery**: Dynamically detects mounted drive letters (`C:`, `D:`, `E:`, `Z:`) and indexes standard AI directories (`/models`, `/ComfyUI/models`, `/stable-diffusion-webui/models`, `/LLM`).
- **Instant Load with Disk Cache**: Persists scan indices to `~/.nexusai/scan_cache.json` for sub-millisecond cold starts.
- **Hugging Face Hub Downloader**: Built-in repository tree explorer with real-time download speed and progress tracking.

### 🌌 5. 6 Generative AI Ambient Themes
- **Visual Theme Gallery Modal**: Card previews of high-resolution AI-generated wallpaper backdrops.
- **Themes**:
  1. 🌌 **Dark Void** (Cosmic Neural Dust)
  2. ⚡ **Neon Cyber** (Rainy Cyberpunk Streets)
  3. 🎬 **Cinema Gold** (Vintage 35mm Hollywood Film Set)
  4. 🕶️ **Synthwave Sunset** (Retro 80s Wireframe Grid)
  5. 🌸 **Anime Fantasy** (Ethereal Sakura Shrine Twilight)
  6. 🟢 **Emerald Matrix** (Bioluminescent Cyber Mainframe)

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Desktop Wrapper** | Electron v36+ (Chromium runtime, dark chrome, custom tray & splash) |
| **Frontend Framework** | React 19 + TypeScript + Vite |
| **Styling** | Vanilla CSS Glassmorphism + Dynamic CSS Variables |
| **Image Synthesis Engine** | `stable-diffusion.cpp` (CUDA / Vulkan / CPU C++ kernels) |
| **Language Dialogue Engine** | `llama.cpp` (`llama-server.exe` CUDA / Vulkan) |
| **Model Persistence** | Global JSON Cache (`~/.nexusai/scan_cache.json`) |
| **Testing** | Vitest unit test suite |

---

## 📦 Getting Started

### Prerequisites
- Windows 10/11 x64, Linux, or macOS
- Node.js (v18+) & npm

### Running the Standalone Executable
Double-click `NexusAI Studio.lnk` or run:
```bash
release-pkg\NexusAI Studio-win32-x64\NexusAI Studio.exe
```

### 🐧 Linux & 🍎 macOS Quick Terminal Install
```bash
git clone https://github.com/Protik1810/NexusAI-Studio.git && cd NexusAI-Studio && npm install && npm run dev
```

### Running in Development Mode
```bash
# 1. Clone repository
git clone https://github.com/Protik1810/NexusAI-Studio.git
cd NexusAI-Studio

# 2. Install dependencies
npm install

# 3. Run unit tests
npm test

# 4. Start local development server
npm run dev
```

### Building the Desktop Executables & Installers
```bash
# Build production bundle
npm run build

# Build Windows Setup Installers (Complete + Lightweight)
npm run build:installer
```

---

## 👤 Author & Credits

- **Creator & Lead Architect**: **Protik** ([GitHub](https://github.com/Protik1810))
- **Core Open Source Engines**: [`stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp), [`llama.cpp`](https://github.com/ggerganov/llama.cpp)