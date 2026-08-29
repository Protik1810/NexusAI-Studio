# ✨ Solframe Studio v1.1.0

> **Renamed from NexusAI Studio.** This release also rebrands the project — same app, same code, new name. Anywhere you see "NexusAI Studio" below (asset filenames, the GitHub repo URL, the `~/.nexusai` cache path) is describing what shipped as of this exact release; new builds and future releases use the Solframe name throughout.

Autonomous, sovereign & 100% offline local Generative AI workstation by **Protik**.

[![License: GPL v3](https://img.shields.io/badge/License-GNU%20GPL%20v3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20(full)%20%7C%20Linux%2FmacOS%20(UI%20preview)-blue.svg)](https://github.com/Protik1810/NexusAI-Studio)
[![CI](https://github.com/Protik1810/NexusAI-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Protik1810/NexusAI-Studio/actions/workflows/ci.yml)

---

### 🩹 Critical Fix

- **The desktop app build was broken.** Root `index.html` — the actual entry point Vite and Electron load — had been overwritten by the GitHub Pages showcase page in a prior release, so `npm run build` silently produced a marketing page instead of the real app. Restored it, fixed the generator script so it can't happen again, and added CI that fails the build if this regresses.

### 🔒 Security Hardening

- The local control server (`127.0.0.1:1420`) accepted requests from **any website** open in your browser, not just the app itself — a malicious page could have spawned processes, triggered downloads, or read your filesystem layout. It now validates the request's Origin before doing anything.
- `/api/download-model` didn't validate its target path — a crafted request could write outside the app directory via `../..`. Fixed with a path-containment check.
- Removed `webSecurity: false` from the main window, which had disabled same-origin protections in the renderer for no documented reason.

### 🐛 Bug Fixes

- **Download progress bars in the Model Hub never updated.** The per-model progress state was wired to a setter that nothing ever called; every download silently showed 0% regardless of real progress. Now reads from the poller that already worked correctly elsewhere in the same screen.
- A failed Hugging Face download (bad repo/filename, 404) was reported as **"completed"** instead of an error, because `curl` was missing `--fail`. Fixed.
- `/api/llama/start` resolved model paths without searching custom scan folders, unlike every other model-loading path in the app. Now consistent.
- Two engine modules carried genuinely dead code (a value always overwritten before being read) — caught by finally turning linting on for the first time; cleaned up.

### 🐧🍎 New: Linux & macOS Builds

First real cross-platform installers, built and verified end-to-end (not just configured):

| Platform | Format | Size | Notes |
|---|---|---|---|
| Linux | AppImage | ~133 MB | Portable, no install — `chmod +x` and run |
| Linux | `.deb` | ~86 MB | `sudo apt install ./nexusai-studio_1.0.0_amd64.deb` |
| macOS | `.zip` | ~127 MB | Unsigned — right-click → Open on first launch |

These ship the UI shell only — the bundled diffusion/LLM engines are still Windows-only binaries. Get them from [Releases](https://github.com/Protik1810/NexusAI-Studio/releases/latest), or build your own: `npm run electron:build:linux` / `electron:build:mac`.

### 🌐 Showcase Page

The [GitHub Pages site](https://protik1810.github.io/NexusAI-Studio/) now detects your OS and highlights the right install method automatically, and has real download cards for Linux and macOS alongside Windows — not just a terminal command. The old "Windows (winget)" install command is gone; it never worked (no such package exists, and that wasn't valid winget syntax regardless).

### ⚙️ Engineering

- Added CI (lint, unit tests, build) running on every push/PR, plus a workflow that builds the Linux/macOS installers on native GitHub-hosted runners.
- Added ESLint + Prettier — previously nothing enforced code style or caught obvious bugs before merge.
- Unified the dev-server and production local API implementations into one shared module; they were two independent ~700-line copies that had already started drifting.
- Removed ~26 MB of duplicated showcase-page HTML that had been committed three times over; consolidated to one generated source.
- Removed `scripts/sync-release.js` and the abandoned `electron-packager`/`release-pkg` build path it fed — the Inno Setup installer scripts now read from `electron-builder`'s output and use portable paths instead of one machine's hardcoded absolute path.

---

### 📦 Downloads

| Platform | File | Size | Direct Link |
|---|---|---|---|
| 🪟 Windows | Complete Setup | ~806 MB | [NexusAI-Studio-Setup-1.0.0.exe](https://github.com/Protik1810/NexusAI-Studio/releases/download/v1.1.0/NexusAI-Studio-Setup-1.0.0.exe) |
| 🪟 Windows | Lightweight Setup | ~120 MB | [NexusAI-Studio-Setup-1.0.0-Lightweight.exe](https://github.com/Protik1810/NexusAI-Studio/releases/download/v1.1.0/NexusAI-Studio-Setup-1.0.0-Lightweight.exe) |
| 🐧 Linux | AppImage | ~133 MB | [NexusAI-Studio-1.0.0-x86_64.AppImage](https://github.com/Protik1810/NexusAI-Studio/releases/download/v1.1.0/NexusAI-Studio-1.0.0-x86_64.AppImage) |
| 🐧 Linux | `.deb` | ~86 MB | [nexusai-studio_1.0.0_amd64.deb](https://github.com/Protik1810/NexusAI-Studio/releases/download/v1.1.0/nexusai-studio_1.0.0_amd64.deb) |
| 🍎 macOS | `.zip` | ~127 MB | [NexusAI-Studio-1.0.0-mac.zip](https://github.com/Protik1810/NexusAI-Studio/releases/download/v1.1.0/NexusAI-Studio-1.0.0-mac.zip) |

**Note:** all five are attached to the `v1.1.0` release tag (verified live — each link 302s to a real signed asset).

---

### 💻 Quick Installation Commands

#### 🪟 Windows
Download an installer from the table above. There is currently no winget package.

#### 🐧 Linux & 🍎 macOS — UI Preview
```bash
curl -fsSL https://raw.githubusercontent.com/Protik1810/NexusAI-Studio/main/install.sh | bash
```

#### 🐧 Linux & 🍎 macOS — Native Installer (Recommended)
```bash
git clone https://github.com/Protik1810/NexusAI-Studio.git && cd NexusAI-Studio && npm install && npm run electron:build:linux
```
*(swap `electron:build:linux` for `electron:build:mac` on macOS)*

---

### 📜 License
Released under the **GNU General Public License v3.0 (GPL-3.0)**.
*Created & Engineered by **[Protik](https://github.com/Protik1810)**.*

---

## Previous Releases

### v1.0.0

- **Image Studio**: Native `stable-diffusion.cpp` support for FLUX.2-Klein, SDXL Lightning (4-step), and LoRA dynamic stacking.
- **Uncensored LLM Chat**: Native `llama.cpp` streaming engine for GGUF models (Qwen 2.5, Llama 3, DeepSeek) with 1-click prompt export to Image Studio.
- **Dynamic Drive Scanner**: Auto-discovers checkpoints and weights across all drives (`C:`, `D:`, `E:`, ComfyUI, WebUI) with sub-ms cache load.
- **Hardware Acceleration**: Automatic routing to NVIDIA CUDA 12, AMD/Intel Vulkan, or AVX2 CPU.
- **6 Ambient Themes**: Dark Void, Neon Cyber, Cinema Gold, Synthwave Sunset, Anime Fantasy, and Emerald Matrix.
- Fixed CUDA exit code 1 file flush handling via async retry poller.
- Enhanced multi-drive recursive checkpoint auto-discovery.
- Fixed non-diffusion model misclassification.
- Modularized core backend engine and decoupled React 19 UI components.
