# ✨ Solframe Studio v1.0.0

**The Sovereign Desktop Generative AI Workstation** — by **Protik**

[![License: GPL v3](https://img.shields.io/badge/License-GNU%20GPL%20v3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20(full)%20%7C%20Linux%2FmacOS%20(UI%20preview)-blue.svg)](https://github.com/Protik1810/Solframe-Studio)
[![CI](https://github.com/Protik1810/Solframe-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Protik1810/Solframe-Studio/actions/workflows/ci.yml)

---

Solframe Studio is a standalone, self-contained desktop app for 100% private, offline generative AI — image synthesis and LLM chat running as native C++ inference directly on your own GPU, with zero cloud calls, zero subscriptions, and zero telemetry. This is the first public release.

### 🎨 Image Studio

- **FLUX.2-Klein & SDXL Lightning** via native `stable-diffusion.cpp` — CUDA, Vulkan, or CPU, auto-detected.
- **LoRA support** with a live strength slider, applied via `sd-cli`'s own `<lora:name:strength>` prompt-tag mechanism.
- **Cancel Generation** — abort a run mid-flight instead of waiting it out or force-closing the app.
- Six aspect ratios, adjustable sampling steps/CFG/seed, and a distraction-free canvas.

### 💬 Uncensored Local LLM Chat

- **Native `llama.cpp` GPU server**, streaming tokens in real time from any GGUF model on disk.
- **LM Studio-style load parameters** — Context Length, GPU Layers, Batch Size, and Flash Attention — instead of hardcoded defaults.
- Custom personas (Creative Writer, Prompt Crafter, Raw Technical Companion), with one-click handoff of a written prompt straight into Image Studio.
- A visible disclaimer wherever uncensored models are used: they can produce inaccurate, offensive, or unsafe content, and you're solely responsible for what you generate. See [TERMS.md](TERMS.md) for the full terms.

### 🗄️ Model Hub

- **Multi-drive auto-discovery** across mounted drives and standard AI directories (ComfyUI, WebUI, LM Studio, Hugging Face cache), with a persistent disk cache for instant reloads.
- **Hugging Face downloader** built on Node's own `fetch` (no external `curl` dependency, so this works on the Linux/macOS build too) — cancellable mid-transfer, with real-time speed and progress.

### 🌌 Six Ambient Themes

Dark Void, Neon Cyber, Cinema Gold (default), Synthwave Sunset, Anime Fantasy, and Emerald Matrix — full-screen AI-generated wallpaper backdrops, switchable live.

### 🔒 Security & Privacy

- The local control server validates every request's Origin before acting on it — no page in your regular browser can script requests against it.
- Every mutating endpoint (rescan, engine start/stop, downloads, generation) is POST-only and path-traversal-guarded.
- Electron's window-open and navigation handlers are locked to the app's own origin, so no untrusted page can load inside the app shell or hijack the main window.
- 100% offline by design: no telemetry, no analytics, no phone-home of any kind.

---

### 📦 Downloads

| Platform | File | Size | Direct Link |
|---|---|---|---|
| 🪟 Windows | Complete Setup | ~783 MB | [Solframe-Studio-Setup-1.0.0.exe](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-Setup-1.0.0.exe) |
| 🪟 Windows | Lightweight Setup | ~97 MB | [Solframe-Studio-Setup-1.0.0-Lightweight.exe](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-Setup-1.0.0-Lightweight.exe) |
| 🐧 Linux | AppImage | ~138 MB | [Solframe-Studio-1.0.0-x86_64.AppImage](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-1.0.0-x86_64.AppImage) |
| 🐧 Linux | `.deb` | ~90 MB | [solframe-studio_1.0.0_amd64.deb](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/solframe-studio_1.0.0_amd64.deb) |
| 🍎 macOS | `.zip` | ~133 MB | [Solframe-Studio-1.0.0-mac.zip](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-1.0.0-mac.zip) |

**Platform note:** Windows ships full local inference (CUDA / Vulkan / CPU). Linux and macOS currently run the UI shell and Model Hub only — the bundled diffusion/LLM engines are Windows-only binaries; native builds for those platforms are planned.

#### 🔐 Verify Your Download (SHA-256)

```
4fd1774f1b3f9b61b07868b209a586f17476a0f828b9e1245b113345acc74fa5  Solframe-Studio-Setup-1.0.0.exe
f28f9eabcac9e0af3e90c00842b40669fffb79f3be2b0779d1fcbe2a6f583230  Solframe-Studio-Setup-1.0.0-Lightweight.exe
80e85f7855857486ab88333c29f87c0da2e2e20575a740e90e494f0fa7d3e9c0  Solframe-Studio-1.0.0-x86_64.AppImage
3610df496b8181b75454bef239d4d9c8831cd5a2a25d9f5db717c478fcd1d042  solframe-studio_1.0.0_amd64.deb
87b30bd8c5d71e63795883e35481b3cb15d609d2d11d9e1f8eef78bd9b68707d  Solframe-Studio-1.0.0-mac.zip
```

Also published as [CHECKSUMS.txt](CHECKSUMS.txt). Verify with `sha256sum -c CHECKSUMS.txt` (Linux/macOS) or `Get-FileHash <file> -Algorithm SHA256` (Windows PowerShell).

#### 🪟 Windows
Download an installer above. There is currently no winget package.

#### 🐧 Linux & 🍎 macOS — UI Preview
```bash
curl -fsSL https://raw.githubusercontent.com/Protik1810/Solframe-Studio/main/install.sh | bash
```

#### 🐧 Linux & 🍎 macOS — Native Installer
```bash
git clone https://github.com/Protik1810/Solframe-Studio.git && cd Solframe-Studio && npm install && npm run electron:build:linux
```
*(swap `electron:build:linux` for `electron:build:mac` on macOS)*

---

### 📜 License

Released under the **GNU General Public License v3.0 (GPL-3.0)**.
Powered by [`stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp) & [`llama.cpp`](https://github.com/ggerganov/llama.cpp).

*Created & Engineered by **[Protik](https://github.com/Protik1810)**.*
