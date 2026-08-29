# ✨ Solframe Studio v1.1.0

> **Renamed from NexusAI Studio.** This release also rebrands the project — same app, same code, new name. Anywhere you see "NexusAI Studio" below (asset filenames, the GitHub repo URL, the `~/.nexusai` cache path) is describing what shipped as of this exact release; new builds and future releases use the Solframe name throughout.

Autonomous, sovereign & 100% offline local Generative AI workstation by **Protik**.

[![License: GPL v3](https://img.shields.io/badge/License-GNU%20GPL%20v3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20(full)%20%7C%20Linux%2FmacOS%20(UI%20preview)-blue.svg)](https://github.com/Protik1810/NexusAI-Studio)
[![CI](https://github.com/Protik1810/NexusAI-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Protik1810/NexusAI-Studio/actions/workflows/ci.yml)

---

### 🧹 Rebrand Follow-Up: Remaining NexusAI Traces

The rename to Solframe wasn't fully clean — a few spots survived the first pass because they weren't caught by a text search:

- **Installer wizard images.** `wizard-large.bmp` / `wizard-small.bmp` are binary bitmaps, so the old NexusAI hexagon logo kept showing up in the Windows installer's setup screens even after every line of text said "Solframe." Recropped from the new logo.
- **A real bug this introduced:** `comfyApi.ts` was still reading the old `nexus_comfy_url` localStorage key while Settings already saved to `solframe_comfy_url` — a saved ComfyUI URL would silently fail to load on a fresh rename. Fixed, along with every other leftover `nexus_*` key (`solframe_gallery`, `solframe_chat_history`, `solframe_llm_url`, `solframe-theme`).
- Deleted `docs/public/`, a stale duplicate of old-branded assets nothing referenced anymore.
- **Default theme is now Cinema Gold** on first run (no saved preference) — in both the app and the showcase page — replacing the leftover Dark Void default.
- Fixed the browser tab icon showing as broken: the favicon was reusing the full 353 KB logo image as a data URI, well past what browsers reliably paint for a tab icon. Now uses a dedicated 64×64 favicon.

### 🔧 LLM Engine: Detected Models But Couldn't Load Them

The embedded llama.cpp chat engine would list your local GGUF models fine, let you click "Start Engine," and report success — but chat never actually worked. Two stacked bugs:

- `/api/llama/start` always replied `success: true` after a fixed 1.2s timer, regardless of whether `llama-server` actually stayed running. A bad GPU-layer count or an incompatible model would make it exit almost instantly while the UI still claimed "GPU Active." It now polls the server's own `/health` endpoint (up to 120s, for large models) and reports a real error — including the process's stderr — if it never comes up.
- The bigger one: the proxy that forwards chat requests to the embedded engine (`/llama-api/*`) only ever existed in the dev-only Vite config, hardcoded to port 8080, with **no equivalent in the packaged production app**. Every chat request in the built app silently fell through to the app shell instead of reaching the model. Added the missing proxy to the shared backend module so dev and production now behave identically. Verified live against the real bundled binary — real chat completions round-trip correctly.

Also added LM Studio-style load parameters — Context Length, GPU Layers, Batch Size, and Flash Attention — to the Chat Studio engine panel instead of hardcoded defaults.

### 🎬 Showcase Page: Scroll Interactions & Real Screenshots

The showcase page now has scroll-driven motion instead of a static scroll: a top progress bar, a subtle parallax drift on the hero logo, and fade/scale-in reveals for every section as you scroll to it — the download cards and showcase tabs stagger in individually rather than all at once. Vanilla JS, no libraries, since the page is a single self-contained HTML file. Respects `prefers-reduced-motion` and still renders fully with JavaScript disabled.

The 5 showcase screenshots are now real captures of the app running — including the new disclaimer banner — replacing placeholder mockups. They were also silently untracked by git before (caught by a blanket `.gitignore` rule with no allowlist entry), so a fresh clone could never reproduce this page; that's fixed too.

### ⚠️ Disclaimer & Terms and Conditions

- Added a visible disclaimer — in the app's Chat Studio and on the showcase page — that uncensored models can produce inaccurate, offensive, or unsafe content, and that use is at your own risk.
- Added [`TERMS.md`](TERMS.md), covering license, warranty disclaimer, liability limits, the uncensored-model risk, third-party components, and privacy — linked from the README and showcase page footer.
- The Windows installer now shows a license/terms acceptance page during setup (`TERMS.txt`).

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

The [GitHub Pages site](https://protik1810.github.io/Solframe-Studio/) now detects your OS and highlights the right install method automatically, and has real download cards for Linux and macOS alongside Windows — not just a terminal command. The old "Windows (winget)" install command is gone; it never worked (no such package exists, and that wasn't valid winget syntax regardless).

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
| 🪟 Windows | Complete Setup | ~781 MB | [Solframe-Studio-Setup-1.0.0.exe](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe-Studio-Setup-1.0.0.exe) |
| 🪟 Windows | Lightweight Setup | ~96 MB | [Solframe-Studio-Setup-1.0.0-Lightweight.exe](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe-Studio-Setup-1.0.0-Lightweight.exe) |
| 🐧 Linux | AppImage | ~132 MB | [Solframe-Studio-1.0.0-x86_64.AppImage](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe-Studio-1.0.0-x86_64.AppImage) |
| 🐧 Linux | `.deb` | ~87 MB | [solframe-studio_1.0.0_amd64.deb](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/solframe-studio_1.0.0_amd64.deb) |
| 🍎 macOS | `.zip` | ~127 MB | [Solframe-Studio-1.0.0-mac.zip](https://github.com/Protik1810/Solframe-Studio/releases/download/v1.1.0/Solframe-Studio-1.0.0-mac.zip) |

**Note:** version stays **v1.1.0** — these five assets replace the previous v1.1.0 uploads on the same release tag, rebuilt from the fixes above. Re-upload them to the existing `v1.1.0` GitHub release (Edit release → drag in the new files → they'll overwrite the old ones by name).

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
