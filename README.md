<div align="center">

# ✨ Solframe Studio

**Autonomous, Sovereign & Zero-Cloud Local Generative AI Workstation**

[![Platform](https://img.shields.io/badge/Platform-Windows%20%26%20macOS%20(full)%20%7C%20Linux%20(UI%20preview)-blue?style=for-the-badge&logo=windows)](https://github.com/Protik1810/Solframe-Studio)
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

> **Platform status:** Windows (`backend/win/**`, CUDA/Vulkan/CPU) and macOS (`backend/mac/**`, Metal-accelerated, universal x86_64+arm64) both ship real, working inference engines — image generation and local LLM chat run out of the box on either. On Linux, only the UI shell currently runs (see [Getting Started](#-getting-started)) — a native Linux engine build is planned, not shipped yet.

<div align="center">
<table>
<tr>
<td><img src="public/screenshots/studio-image-canvas.webp" alt="Image Studio canvas" width="270"/></td>
<td><img src="public/screenshots/llm-chat-studio.webp" alt="Uncensored LLM chat" width="270"/></td>
<td><img src="public/screenshots/sampling-progress-step44.webp" alt="Live GPU sampling progress" width="270"/></td>
</tr>
<tr>
<td align="center"><sub>Image Studio</sub></td>
<td align="center"><sub>LLM Chat</sub></td>
<td align="center"><sub>Live sampling progress</sub></td>
</tr>
</table>
</div>

### 🖼️ Generated with Solframe Studio

Real output from both pipelines, unedited — prompt included for each. Solframe Studio is an uncensored tool; the examples below are kept safe-for-work on purpose, since this README is public.

<div align="center">
<table>
<tr>
<td width="50%">

<img src="public/screenshots/showcase-lion-artwork.webp" width="100%"/>

**Standard checkpoint pipeline** (SDXL, `Juggernaut-XL_v9` + a LoRA)
> Sensual photorealistic portrait of an alluring mystic lion, intricate realistic skin texture, soft dramatic studio lighting, 8k resolution, raw photo, natural eyes

</td>
<td width="50%">

<img src="public/screenshots/showcase-flux-ramen-chef.webp" width="100%"/>

**FLUX.2 Klein pipeline** (`flux-2-klein-4b-fp8-official` + a LoRA)
> Candid 35mm photograph of an elderly Japanese ramen chef with intense focus, dusting flour off his hands over a steaming, boiling pot of rich tonkotsu broth in a tiny, atmospheric Tokyo alleyway stall at night. Thick white volumetric steam swirls upward, backlit by warm vintage pendant lights hanging from the wooden ceiling...

</td>
</tr>
</table>
</div>

**FLUX Kontext-style reference-image editing** (`-r/--ref-image` — attach an image, describe the change, no re-generating from scratch):

<div align="center">
<table>
<tr>
<td width="50%" align="center"><img src="public/screenshots/showcase-flux-edit-before.webp" width="100%"/><br/><sub>Original (attached as the reference image)</sub></td>
<td width="50%" align="center"><img src="public/screenshots/showcase-flux-edit-after-pose.webp" width="100%"/><br/><sub>Edit prompt: <code>change the action pose</code></sub></td>
</tr>
</table>
</div>

Another edit, on a different reference image:

<div align="center">
<img src="public/screenshots/showcase-flux-edit-lady-to-man.webp" width="60%"/>
<br/><sub>Edit prompt: <code>change the lady to a man</code></sub>
</div>

---

## 🚀 Key Features

### 🎨 1. Image Studio (Multi-Architecture Diffusion)
- **FLUX.2-Klein Architecture Support**: Auto-configured `--prediction flux_flow` with 32-channel VAEs (`flux2-vae.safetensors` / `ae.safetensors`) and safetensors text encoders — GGUF is reserved for LLM Chat, not image generation.
- **Flash Attention + RAM Offload**: `--diffusion-fa` runs by default on the FLUX pipeline, and weight offloading to system RAM auto-enables above ~512x512 to avoid VRAM overflow on constrained cards — both are silent, automatic optimizations, not settings you need to tune.
- **Automatic Base-Model Detection**: FLUX.2 Klein's distilled and "base" (non-distilled) variants need very different steps/cfg defaults — Studio detects which one is loaded from the filename and switches automatically.
- **SDXL Lightning & Turbo**: 4-step ultra-fast photo-realistic generation.
- **LoRA Support**: One LoRA slot with a real-time strength slider, applied via `--lora-model-dir`. Must match the loaded diffusion model's architecture — a FLUX.1 LoRA is not compatible with a FLUX.2 Klein model (different hidden dimensions), so pick LoRAs trained specifically for the Klein size you're running.
- **Cancel Generation**: Abort a run mid-flight instead of waiting it out or force-closing the app.
- **Distraction-Free Canvas**: Pure studio neutral generation viewport for accurate color fidelity.

### 💬 2. Uncensored Local LLM Chat
- **Native `llama.cpp` GPU Server**: Stream tokens in real time from quantized GGUF models (DeepSeek, Qwen 2.5, Gemma 4, Llama 3, Dolphin).
- **Configurable Load Parameters**: Context Length, GPU Layers, Batch Size, and Flash Attention, set before loading instead of hardcoded.
- **Custom Personas**: Seamless roleplay switching (Unfiltered Storyteller, Visual Director & Prompt Crafter, Raw Technical Companion).
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

### 🔌 6. Agent API Server
- **OpenAI-Compatible Endpoints**: `/v1/chat/completions` and `/v1/images/generations` — point any OpenAI-SDK-compatible tool or agent at your local engines.
- **Off by Default, API-Key Gated**: Enable it from Settings → Agent API Server. Bound to `127.0.0.1` only; every request (except `/health`) requires an `Authorization: Bearer <key>` header, checked with a constant-time comparison.
- **Auto-Starts the Right Model**: A chat request for a model that isn't currently loaded starts `llama-server` for it automatically — no separate "start engine" call needed.
- **Model Discovery**: `GET /v1/models` lists every GGUF/checkpoint the built-in scanner has already indexed on your system, ready to reference by filename.

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

### 🍎 macOS Setup (Installer)
Download `Solframe-Studio-<version>-mac.zip` (Intel) or `Solframe-Studio-<version>-arm64-mac.zip` (Apple Silicon) from [Releases](https://github.com/Protik1810/Solframe-Studio/releases/latest), unzip, and move `Solframe Studio.app` to Applications. The build isn't code-signed/notarized, so the first launch needs **Control-click → Open** (not a double-click) to get past Gatekeeper — or run `xattr -cr "/path/to/Solframe Studio.app"` in Terminal if macOS reports it as "damaged."

### 🐧 Linux (UI Preview — 1-Line Terminal Install)
```bash
curl -fsSL https://raw.githubusercontent.com/Protik1810/Solframe-Studio/main/install.sh | bash
```
This clones the repo and runs `npm run dev`, which brings up the Solframe Studio interface. There's no `backend/linux/` engine yet, so **image generation and local LLM chat will not run** until a native Linux build ships — this path is useful today for UI development and preview, not for production inference.

Prefer an installable app over the terminal preview? `npm run electron:build:linux` (AppImage + .deb) packages the same UI-only build as a native app — run it on the target OS, or grab the artifact from the [Build Linux/macOS Installers](https://github.com/Protik1810/Solframe-Studio/actions/workflows/release-build.yml) GitHub Actions workflow. Note that workflow's macOS job produces a UI-only build too (it has no access to the `backend/mac/` binaries, which — like `backend/win/` — are large local build inputs, not committed to the repo); the real inference-capable macOS build linked above is built and packaged separately.

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

# macOS: build .zip (needs backend/mac/ locally to include real inference —
# see Platform status above; .dmg requires dmg-license, which only builds on
# real macOS, so this repo's own pipeline produces .zip only)
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