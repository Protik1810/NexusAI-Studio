# ✨ Solframe Studio v1.1.0

**The Sovereign Desktop Generative AI Workstation** — by **Protik**

[![License: GPL v3](https://img.shields.io/badge/License-GNU%20GPL%20v3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%26%20macOS%20(full)%20%7C%20Linux%20(UI%20preview)-blue.svg)](https://github.com/Protik1810/Solframe-Studio)
[![CI](https://github.com/Protik1810/Solframe-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Protik1810/Solframe-Studio/actions/workflows/ci.yml)

---

Solframe Studio is a standalone, self-contained desktop app for 100% private, offline generative AI — image synthesis and LLM chat running as native C++ inference directly on your own GPU, with zero cloud calls, zero subscriptions, and zero telemetry.

## 🆕 What's new in v1.1.0

### 🍎 Real macOS support (Apple Silicon + Intel)
- Native Metal-accelerated inference — `stable-diffusion.cpp` and `llama.cpp`, universal binaries covering both Apple Silicon and Intel Macs.
- Hardware detection now correctly identifies your Apple chip and reports Metal, instead of falling back to a Windows-only "CPU AVX2" message that never applied on Mac.
- Model auto-discovery now scans `/Volumes/*` (Mac's equivalent of drive letters) and the correct `~/Library/Application Support/Solframe Studio/models` folder.
- Verified end-to-end on an actual Apple M4.

### 🎨 Image Studio
- **New resolution presets**: 1080p, 1440p, 2K, and 4K, plus a **Custom** width/height option. Note: SDXL/FLUX are trained around ~1024px and this app has no tiling/hires-fix pass, so the higher presets trade off quality — 4K is a ceiling this UI offers, not a quality guarantee.
- The prompt box now always starts empty and clears itself after every generation — a compact, translucent **prompt viewer** appears over the generated image instead, showing exactly what produced it, with a one-click **"Use Again"** button to reuse it without retyping.
- The generated image and your in-progress settings now **survive switching tabs** instead of resetting — a manual **Reset** button clears the canvas when you actually want to.
- The sidebar's Image Studio icon now shows a live generation progress ring, plus a "ready to view" badge once a result is waiting for you on another tab.

### 🗄️ Model Hub & Downloads
- Fixed three curated presets that were pointing at renamed/moved files (404s on download) and removed three that were either off-topic or fundamentally incompatible with this app's single-file model loading.
- Downloads now save to the portable `AppData/Solframe Studio` location instead of the app's own install folder — the old location silently failed or lost files on Linux AppImage, `.deb`, and packaged macOS builds.
- "Rescan" buttons now actually trigger a fresh scan instead of re-reading a stale cache — a freshly downloaded model shows up without restarting the app.
- A cancelled download no longer leaves a corrupt partial file that gets mistakenly reported as "Installed."
- Download failures (bad URL, gated repo, disk full) now surface as a real error message instead of the progress bar silently vanishing.
- The download progress bar now shows a percentage, not just a fill bar.

### 🔧 Packaging fix
- The Windows installers were unintentionally bundling the new macOS engine binaries (~175MB of unrelated `.dylib`/Unix files) due to an overly broad resource-copying rule. Fixed — Windows builds only ever contain Windows binaries again.

---

### 🎨 Image Studio (from v1.0.0)
- **FLUX.2-Klein & SDXL Lightning** via native `stable-diffusion.cpp` — CUDA, Vulkan, Metal, or CPU, auto-detected.
- **LoRA support** with a live strength slider, applied via `sd-cli`'s own `<lora:name:strength>` prompt-tag mechanism.
- **Cancel Generation** — abort a run mid-flight instead of waiting it out or force-closing the app.

### 💬 Uncensored Local LLM Chat
- **Native `llama.cpp` GPU server**, streaming tokens in real time from any GGUF model on disk.
- **LM Studio-style load parameters** — Context Length, GPU Layers, Batch Size, Flash Attention, and K/V Cache Quantization.
- Custom personas, with one-click handoff of a written prompt straight into Image Studio.
- A visible disclaimer wherever uncensored models are used — see [TERMS.md](TERMS.md) for the full terms.

### 🌌 Six Ambient Themes
Dark Void, Neon Cyber, Cinema Gold (default), Synthwave Sunset, Anime Fantasy, and Emerald Matrix.

### 🔒 Security & Privacy
- The local control server validates every request's Origin before acting on it.
- Every mutating endpoint (rescan, engine start/stop, downloads, generation) is POST-only and path-traversal-guarded.
- 100% offline by design: no telemetry, no analytics, no phone-home of any kind.

---

### 📦 Downloads

| Platform | File | Size | Direct Link |
|---|---|---|---|
| 🪟 Windows | Complete Setup | ~785 MB | [Solframe-Studio-Setup-1.1.0.exe](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe-Studio-Setup-1.1.0.exe) |
| 🪟 Windows | Lightweight Setup | ~100 MB | [Solframe-Studio-Setup-1.1.0-Lightweight.exe](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe-Studio-Setup-1.1.0-Lightweight.exe) |
| 🪟 Windows | Portable | ~782 MB | [Solframe-Studio-Portable-1.1.0.exe](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe-Studio-Portable-1.1.0.exe) |
| 🍎 macOS | Apple Silicon `.zip` | ~199 MB | [Solframe.Studio-1.1.0-arm64-mac.zip](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe.Studio-1.1.0-arm64-mac.zip) |
| 🍎 macOS | Intel `.zip` | ~204 MB | [Solframe.Studio-1.1.0-mac.zip](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe.Studio-1.1.0-mac.zip) |
| 🐧 Linux | AppImage | ~143 MB | [Solframe.Studio-1.1.0.AppImage](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe.Studio-1.1.0.AppImage) |
| 🐧 Linux | `.deb` | ~93 MB | [solframe-studio_1.1.0_amd64.deb](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/solframe-studio_1.1.0_amd64.deb) |

**Platform note:** Windows and macOS ship full local inference (CUDA/Vulkan/CPU on Windows, Metal/CPU on macOS). Linux currently runs the UI shell and Model Hub only — a native engine build is planned.

#### 🔐 Verify Your Download (SHA-256)
Published as [CHECKSUMS.txt](https://raw.githubusercontent.com/Protik1810/Solframe-Studio/main/CHECKSUMS.txt) — download it, then verify with `sha256sum -c CHECKSUMS.txt` (Linux/macOS) or `Get-FileHash <file> -Algorithm SHA256` (Windows PowerShell).

#### 🪟 Windows
Download an installer above. There is currently no winget package.

#### 🍎 macOS
Download the `.zip` matching your Mac above, unzip, move to Applications. Unsigned build — **Control-click → Open** on first launch (or `xattr -cr` the `.app` in Terminal if macOS calls it "damaged").

#### 🐧 Linux — UI Preview
```bash
curl -fsSL https://raw.githubusercontent.com/Protik1810/Solframe-Studio/main/install.sh | bash
```

#### 🐧 Linux & 🍎 macOS — Build From Source
```bash
git clone https://github.com/Protik1810/Solframe-Studio.git && cd Solframe-Studio && npm install && npm run electron:build:linux
```
*(swap `electron:build:linux` for `electron:build:mac` on macOS)*

---

### 📜 License

Released under the **GNU General Public License v3.0 (GPL-3.0)**.
Powered by [`stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp) & [`llama.cpp`](https://github.com/ggerganov/llama.cpp).

*Created & Engineered by **[Protik](https://github.com/Protik1810)**.*
