<div align="center">

# ✨ Solframe Studio

**Autonomous, Sovereign & Zero-Cloud Local Generative AI Workstation**

[![Platform](https://img.shields.io/badge/Platform-Windows%20(full)%20%7C%20Linux%2FmacOS%20(UI%20preview)-blue?style=for-the-badge&logo=windows)](https://github.com/Protik1810/Solframe-Studio)
[![Hardware](https://img.shields.io/badge/Hardware-NVIDIA%20CUDA%20%7C%20AMD%2FIntel%20Vulkan-success?style=for-the-badge&logo=nvidia)](https://github.com/Protik1810/Solframe-Studio)
[![Engine](https://img.shields.io/badge/Diffusion%20Engine-stable--diffusion.cpp-orange?style=for-the-badge)](https://github.com/leejet/stable-diffusion.cpp)
[![LLM](https://img.shields.io/badge/Dialogue%20Engine-llama.cpp%20GGUF-purple?style=for-the-badge)](https://github.com/ggerganov/llama.cpp)
[![License](https://img.shields.io/badge/License-GNU%20GPL%20v3.0-blue?style=for-the-badge)](LICENSE)
[![CI](https://github.com/Protik1810/Solframe-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Protik1810/Solframe-Studio/actions/workflows/ci.yml)

<br/>

*Designed & Engineered by **Protik***

</div>

---

## 🌟 Overview

**Solframe Studio** is a standalone, self-contained desktop generative AI suite engineered for 100% private, offline inference. Combining **`stable-diffusion.cpp`** (supporting FLUX.2 Klein, SDXL Lightning, and standard SD checkpoints) with **`llama.cpp`** (running GGUF text models with full GPU offloading), Solframe Studio brings high-performance generative AI directly to consumer hardware with zero subscription fees, zero cloud telemetry, and complete offline autonomy.

> **Platform status:** the bundled inference engines (`backend/win/**`) are Windows x64 binaries (CUDA/Vulkan/CPU). On Windows, image generation and local LLM chat both run out of the box. On Linux/macOS, only the UI shell currently runs (see [Getting Started](#-getting-started)) — native engine builds for those platforms are planned, not shipped yet.

---

## 🚀 Key Features

### 🎨 1. Image Studio (Multi-Architecture Diffusion)
- **FLUX.2-Klein Architecture Support**: Auto-configured `--prediction flux2_flow` with 32-channel VAEs (`flux2-vae.safetensors` / `ae.safetensors`) and GGUF text encoders.
- **SDXL Lightning & Turbo**: 4-step ultra-fast photo-realistic generation.
- **LoRA Dynamic Stacking**: Real-time slider strength control for fine-tuned LoRA weights.
- **Cancel Generation**: Abort a run mid-flight instead of waiting it out or force-closing the app.
- **Distraction-Free Canvas**: Pure studio neutral generation viewport for accurate color fidelity.

### 💬 2. Uncensored Local LLM Chat
- **Native `llama.cpp` GPU Server**: Stream tokens in real time from quantized GGUF models (DeepSeek, Qwen 2.5, Gemma 4, Llama 3, Dolphin).
- **LM Studio-Style Load Parameters**: Context Length, GPU Layers, Batch Size, and Flash Attention, set before loading instead of hardcoded.
- **Custom Personas**: Seamless roleplay switching (Creative Visionary, Technical Prompt Engineer, Uncensored Assistant).
- **Cross-Studio Pipeline**: Send generated prompts directly to the Image Studio with one click.

### 🎮 3. Dynamic Hardware Auto-Detection
- **NVIDIA GPUs**: Auto-routes to **CUDA** (`backend/win/cuda/`) leveraging Tensor Cores.
- **AMD Radeon & Intel Arc GPUs**: Auto-routes to **Vulkan** (`backend/win/vulkan/`) using cross-platform compute shaders.
- **CPU Fallback**: Automatic multi-threaded AVX2 CPU execution when no discrete GPU is found.

### 🗄️ 4. Universal Dynamic Model Scanner
- **Multi-Drive Auto-Discovery**: Dynamically detects mounted drive letters (`C:`, `D:`, `E:`, `Z:`) and indexes standard AI directories (`/models`, `/ComfyUI/models`, `/stable-diffusion-webui/models`, `/LLM`).
- **Instant Load with Disk Cache**: Persists scan indices to `~/.solframe/scan_cache.json` for sub-millisecond cold starts.
- **Hugging Face Hub Downloader**: Built-in repository tree explorer with real-time download speed and progress tracking, and cancellable mid-transfer. Built on Node's own `fetch` (no external `curl` dependency), so this works on the Linux/macOS build too — not just Windows.

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
| **Model Persistence** | Global JSON Cache (`~/.solframe/scan_cache.json`) |
| **Testing** | Vitest — path resolution, model classification, local-server security (origin checks, path-traversal guards, POST-only enforcement), and CLI arg construction |

### Optional Integrations
- **ComfyUI Bridge** *(optional)*: if you already run [ComfyUI](https://github.com/comfyanonymous/ComfyUI) locally, `src/services/comfyApi.ts` can proxy generation requests to your own `127.0.0.1:8188` instance instead of the bundled `stable-diffusion.cpp` engine. This is an opt-in convenience for existing ComfyUI users — it talks to a process on your own machine, never a remote service, and Solframe Studio's core Image/Chat Studios do not require it.

---

## 📦 Getting Started

### Prerequisites
- Windows 10/11 x64, Linux, or macOS
- Node.js (v18+) & npm

### 🪟 Windows Setup (Installer)
Download the latest installer from [Releases](https://github.com/Protik1810/Solframe-Studio/releases/latest):
- `Solframe-Studio-Setup-<version>.exe` — full installer (all backends)
- `Solframe-Studio-Setup-<version>-Lightweight.exe` — smaller download, **UI shell only, no image generation or local LLM chat**. There is currently no in-app way to fetch the missing engines afterward — use the Complete Installer if you need inference.

There is currently no winget package; the links above are the only official builds.

### 🐧 Linux & 🍎 macOS (UI Preview — 1-Line Terminal Install)
```bash
curl -fsSL https://raw.githubusercontent.com/Protik1810/Solframe-Studio/main/install.sh | bash
```
This clones the repo and runs `npm run dev`, which brings up the Solframe Studio interface. The bundled diffusion/LLM engines under `backend/win/` are Windows-only binaries, so **image generation and local LLM chat will not run** until native Linux/macOS engine builds ship — this path is useful today for UI development and preview, not for production inference.

Prefer an installable app over the terminal preview? `npm run electron:build:linux` (AppImage + .deb) and `npm run electron:build:mac` (.dmg + .zip) package the same UI-only build as a native app — run them on the target OS, or grab the artifacts from the [Build Linux/macOS Installers](https://github.com/Protik1810/Solframe-Studio/actions/workflows/release-build.yml) GitHub Actions workflow.

### Running in Development Mode
```bash
# 1. Clone repository
git clone https://github.com/Protik1810/Solframe-Studio.git
cd Solframe-Studio

# 2. Install dependencies
npm install

# 3. Lint and run unit tests
npm run lint
npm test

# 4. Start local development server
npm run dev
```

### Building the Desktop Executables & Installers
```bash
# Build production bundle
npm run build

# Windows: build Setup Installers (Complete + Lightweight)
npm run build:installer

# Linux: build AppImage + .deb (UI shell only, see Platform status above)
npm run electron:build:linux

# macOS: build .dmg + .zip (UI shell only, see Platform status above)
npm run electron:build:mac
```

---

## 👤 Author & Credits

- **Creator & Lead Architect**: **Protik** ([GitHub](https://github.com/Protik1810))
- **Core Open Source Engines**: [`stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp), [`llama.cpp`](https://github.com/ggerganov/llama.cpp)

---

## ⚠️ Disclaimer & Terms

Solframe Studio supports running **uncensored LLMs** for local chat. Uncensored models can produce inaccurate, offensive, or unsafe content — **use them at your own risk**. You are solely responsible for any content you generate and how you use it.

See [TERMS.md](TERMS.md) for the full Terms and Conditions, and [LICENSE](LICENSE) for the GPL-3.0 license text.